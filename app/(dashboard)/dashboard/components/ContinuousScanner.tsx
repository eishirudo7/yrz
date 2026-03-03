import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { X, Camera, RefreshCw, AlertTriangle, Package, Clock, Truck, XCircle, AlertCircle, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';

import { Order } from '@/app/hooks/useDashboard';

interface ContinuousScannerProps {
    onScan: (decodedText: string) => void;
    isOpen: boolean;
    onClose: () => void;
    // A mechanism to temporarily pause scanning if a dialog is open
    isPaused?: boolean;
    scannedOrder?: Order | null;
}

const getStatusColor = (status: string): string => {
    switch (status) {
        case "READY_TO_SHIP": return "bg-green-600 text-white";
        case "PROCESSED": return "bg-blue-600 text-white";
        case "SHIPPED": return "bg-indigo-600 text-white";
        case "CANCELLED": return "bg-red-600 text-white";
        case "IN_CANCEL": return "bg-yellow-600 text-white";
        case "TO_RETURN": return "bg-purple-600 text-white";
        default: return "bg-gray-600 text-white";
    }
};

const getStatusIcon = (status: string) => {
    switch (status) {
        case "READY_TO_SHIP": return <Package size={14} className="inline-block mr-1" />;
        case "PROCESSED": return <Clock size={14} className="inline-block mr-1" />;
        case "SHIPPED": return <Truck size={14} className="inline-block mr-1" />;
        case "CANCELLED": return <XCircle size={14} className="inline-block mr-1" />;
        case "IN_CANCEL": return <AlertCircle size={14} className="inline-block mr-1" />;
        case "TO_RETURN": return <RefreshCcw size={14} className="inline-block mr-1" />;
        default: return null;
    }
};

export function ContinuousScanner({ onScan, isOpen, onClose, isPaused = false, scannedOrder }: ContinuousScannerProps) {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const containerId = 'continuous-qr-reader';
    const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
    const [selectedCameraId, setSelectedCameraId] = useState<string>('');
    const [isReady, setIsReady] = useState(false);

    // Last scanned text to avoid rapid duplicate triggers
    const lastScanned = useRef<{ text: string; time: number }>({ text: '', time: 0 });

    const [permissionError, setPermissionError] = useState<string>('');
    const [scanSessionCount, setScanSessionCount] = useState<number>(0);

    const getCameras = async () => {
        try {
            setPermissionError('');

            // Explicitly request camera permission first to trigger the browser prompt
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                // Stop the stream immediately, we just needed to trigger the permission prompt
                stream.getTracks().forEach(track => track.stop());
            } catch (mediaErr) {
                console.warn('getUserMedia error:', mediaErr);
                setPermissionError('Akses kamera ditolak atau tidak ada kamera yang tersedia. Harap berikan izin kamera pada browser Anda.');
                return;
            }

            const devices = await Html5Qrcode.getCameras();
            if (devices && devices.length) {
                setCameras(devices);
                // Default to back camera if available, else first camera
                const backCamera = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment'));
                setSelectedCameraId(backCamera ? backCamera.id : devices[0].id);
            } else {
                setPermissionError('Tidak ada perangkat kamera yang terdeteksi.');
            }
        } catch (err) {
            console.error('Error getting cameras', err);
            setPermissionError('Terjadi kesalahan saat mengakses kamera. Pastikan browser memiliki izin.');
            toast.error('Tidak dapat mengakses kamera.');
        }
    };

    useEffect(() => {
        if (isOpen) {
            getCameras();
            setScanSessionCount(0); // Reset counter ketika kamera dibuka
        }
    }, [isOpen]);

    const startScanner = useCallback(async () => {
        if (!isOpen || !selectedCameraId || isPaused) return;

        try {
            if (!scannerRef.current) {
                // Focus on common 1D/2D shipping label barcodes (Code128, QR Code, DataMatrix, PDF417). 
                // Restricting formats significantly speeds up scan FPS and reduces heat/CPU on mobile.
                scannerRef.current = new Html5Qrcode(containerId, {
                    formatsToSupport: [
                        Html5QrcodeSupportedFormats.CODE_128,
                        Html5QrcodeSupportedFormats.QR_CODE,
                        Html5QrcodeSupportedFormats.DATA_MATRIX,
                        Html5QrcodeSupportedFormats.ITF,
                        Html5QrcodeSupportedFormats.CODE_39,
                    ],
                    verbose: false,
                });
            }

            const existingState = scannerRef.current.getState();
            if (existingState === 2) { // 2 = SCANNING
                return; // Already scanning
            }

            await scannerRef.current.start(
                selectedCameraId,
                {
                    fps: 10,
                    // Fix: Set width directly relative to viewfinderWidth to be wide
                    qrbox: (viewfinderWidth, viewfinderHeight) => {
                        const width = Math.floor(viewfinderWidth * 0.6); // Ambil 90% lebar layar
                        const height = Math.floor(viewfinderHeight * 0.7); // Ambil 60% tinggi layar
                        return {
                            width: viewfinderWidth > 500 ? 400 : width,
                            height: viewfinderHeight > 500 ? 250 : height
                        };
                    },
                    aspectRatio: 1.0,
                    disableFlip: true, // Meningkatkan performa, tak perlu flip vertikal kecuali kamera selfie
                },
                (decodedText) => {
                    if (isPaused) return;

                    const now = Date.now();
                    // Debounce: don't trigger if it's the exact same code within the last 3 seconds
                    if (lastScanned.current.text === decodedText && now - lastScanned.current.time < 3000) {
                        return;
                    }

                    lastScanned.current = { text: decodedText, time: now };
                    setScanSessionCount(prev => prev + 1); // Tambah counter scan sukses
                    onScan(decodedText);

                    // Optional beep sound on successful scan
                    try {
                        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                        const oscillator = audioCtx.createOscillator();
                        const gainNode = audioCtx.createGain();
                        oscillator.connect(gainNode);
                        gainNode.connect(audioCtx.destination);
                        oscillator.frequency.value = 800;
                        gainNode.gain.value = 0.1;
                        oscillator.start();
                        setTimeout(() => oscillator.stop(), 100);
                    } catch (e) { }
                },
                (errorMessage) => {
                    // parse errors are frequent while scanning, ignore them
                }
            );
            setIsReady(true);
        } catch (error) {
            console.error('Failed to start scanner', error);
            toast.error('Gagal memulai kamera.');
        }
    }, [isOpen, selectedCameraId, onScan, isPaused]);

    const stopScanner = async () => {
        if (scannerRef.current) {
            try {
                const state = scannerRef.current.getState();
                if (state === 2 || state === 3) { // SCANNING or PAUSED
                    await scannerRef.current.stop();
                }
                scannerRef.current.clear();
            } catch (err) {
                console.error('Error stopping scanner', err);
            } finally {
                // Sangat penting untuk diset ke null agar instance baru bisa dibuat saat modal dibuka lagi
                scannerRef.current = null;
                setIsReady(false);
            }
        }
    };

    // Start scanner when camera is selected or modal opens
    useEffect(() => {
        if (isOpen && selectedCameraId && !isPaused) {
            startScanner();
        } else if (isPaused || !isOpen) {
            if (scannerRef.current) {
                try {
                    const state = scannerRef.current.getState();
                    if (!isOpen) {
                        stopScanner();
                    } else if (isPaused && state === 2) {
                        scannerRef.current.pause(true); // pause video as well
                    } else if (!isPaused && state === 3) { // 3 = PAUSED
                        scannerRef.current.resume();
                    }
                } catch (e) { }
            }
        }

        return () => {
            // Kita tidak memanggil stopScanner() di sini pada dependency [isOpen, ...] 
            // karena akan mematikan stream saat isPaused berubah.
            // Cleanup utama dilakukan di !isOpen bloks di atas, dan di unmount effect di bawah.
        };
    }, [isOpen, selectedCameraId, isPaused, startScanner]);

    // Cleanup mutlak saat komponen ContinuousScanner benar-benar di-unmount dari DOM
    useEffect(() => {
        return () => {
            if (scannerRef.current) {
                try {
                    const state = scannerRef.current.getState();
                    if (state === 2 || state === 3) {
                        scannerRef.current.stop().then(() => {
                            if (scannerRef.current) scannerRef.current.clear();
                        }).catch(e => console.error(e));
                    }
                } catch (e) { }
            }
        };
    }, []);

    const switchCamera = () => {
        if (cameras.length > 1) {
            const currentIndex = cameras.findIndex(c => c.id === selectedCameraId);
            const nextIndex = (currentIndex + 1) % cameras.length;
            stopScanner().then(() => {
                setIsReady(false);
                setSelectedCameraId(cameras[nextIndex].id);
            });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="relative w-full max-w-md max-h-[95vh] bg-white dark:bg-zinc-900 rounded-xl overflow-hidden flex flex-col pt-3">
                {/* Floating Scan Counter */}
                <div className="absolute top-3 left-3 z-10 bg-black/50 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm flex items-center gap-1.5 font-semibold shadow-md">
                    <Package size={14} className="opacity-90" />
                    <span>{scanSessionCount} di-scan</span>
                </div>

                {/* Floating Close Button */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="absolute top-2 right-2 z-10 h-8 w-8 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-sm"
                >
                    <X size={16} />
                </Button>

                {/* Scanner Body */}
                <div className="w-full p-3 flex flex-col items-center gap-3 overflow-y-auto">

                    {permissionError ? (
                        <div className="w-full p-4 flex flex-col items-center text-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-900/50">
                            <AlertTriangle size={28} />
                            <p className="text-xs">{permissionError}</p>
                            <Button variant="outline" size="sm" onClick={() => getCameras()} className="mt-2 h-8 text-xs">
                                Coba Lagi
                            </Button>
                        </div>
                    ) : (
                        <div
                            id={containerId}
                            className="w-full h-auto overflow-hidden rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-700 aspect-square max-h-[300px]"
                        ></div>
                    )}

                    {!permissionError && !scannedOrder && (
                        <div className="text-xs text-center text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/50 p-2 rounded-lg w-full">
                            Arahkan kamera ke resi (QR / Barcode).
                        </div>
                    )}

                    {scannedOrder && (
                        <div className="w-full p-3 border border-emerald-200 dark:border-emerald-900/50 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/10 flex flex-col gap-1.5 shadow-sm animate-in fade-in zoom-in-95">
                            <div className="flex items-center justify-between border-b border-emerald-100 dark:border-emerald-800/50 pb-1.5 mb-0.5">
                                <span className="font-semibold text-emerald-900 dark:text-emerald-100 text-xs flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    {scannedOrder.shop_name}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center ${getStatusColor(scannedOrder.order_status)}`}>
                                    {getStatusIcon(scannedOrder.order_status)}
                                    {scannedOrder.order_status.replace(/_/g, ' ')}
                                </span>
                            </div>

                            <div className="grid grid-cols-[60px_1fr] gap-x-2 gap-y-1 text-xs items-center">
                                <span className="text-zinc-500">Order SN</span>
                                <span className="font-mono font-medium">{scannedOrder.order_sn}</span>

                                <span className="text-zinc-500">Resi</span>
                                <span className="font-mono font-medium">{scannedOrder.tracking_number || '-'}</span>
                            </div>

                            <div className="mt-1 flex flex-col gap-1 bg-white dark:bg-zinc-900 rounded p-1.5 border border-zinc-100 dark:border-zinc-800">
                                {scannedOrder.items?.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-start text-[11px]">
                                        <span className="text-zinc-700 dark:text-zinc-300 line-clamp-1 flex-1 pr-2">
                                            {item.item_sku} {item.model_name ? `(${item.model_name})` : ''}
                                        </span>
                                        <span className="font-medium shrink-0">x{item.model_quantity_purchased}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {cameras.length > 1 && (
                        <Button variant="outline" size="sm" onClick={switchCamera} disabled={!isReady} className="w-full h-8 text-xs">
                            <RefreshCw size={14} className="mr-2" />
                            Ganti Kamera
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
