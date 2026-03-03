import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { X, Camera, RefreshCw, AlertTriangle } from 'lucide-react';
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

export function ContinuousScanner({ onScan, isOpen, onClose, isPaused = false, scannedOrder }: ContinuousScannerProps) {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const containerId = 'continuous-qr-reader';
    const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
    const [selectedCameraId, setSelectedCameraId] = useState<string>('');
    const [isReady, setIsReady] = useState(false);

    // Last scanned text to avoid rapid duplicate triggers
    const lastScanned = useRef<{ text: string; time: number }>({ text: '', time: 0 });

    const [permissionError, setPermissionError] = useState<string>('');

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
        }
    }, [isOpen]);

    const startScanner = useCallback(async () => {
        if (!isOpen || !selectedCameraId || isPaused) return;

        try {
            if (!scannerRef.current) {
                scannerRef.current = new Html5Qrcode(containerId);
            }

            const existingState = scannerRef.current.getState();
            if (existingState === 2) { // 2 = SCANNING
                return; // Already scanning
            }

            await scannerRef.current.start(
                selectedCameraId,
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0,
                },
                (decodedText) => {
                    if (isPaused) return;

                    const now = Date.now();
                    // Debounce: don't trigger if it's the exact same code within the last 3 seconds
                    if (lastScanned.current.text === decodedText && now - lastScanned.current.time < 3000) {
                        return;
                    }

                    lastScanned.current = { text: decodedText, time: now };
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
                if (state === 2) { // SCANNING
                    await scannerRef.current.stop();
                }
                scannerRef.current.clear();
            } catch (err) {
                console.error('Error stopping scanner', err);
            }
        }
    };

    // Start scanner when camera is selected or modal opens
    useEffect(() => {
        if (isOpen && selectedCameraId && !isPaused) {
            startScanner();
        } else if (isPaused || !isOpen) {
            // Only pause the *processing*, we might want to keep the stream alive visually if possible.
            // But html5-qrcode's stop() actually turns off the camera light.
            // Actually, HTML5-Qrcode provides `pause()` and `resume()`, let's check
            // Yes! 
            if (scannerRef.current) {
                try {
                    const state = scannerRef.current.getState();
                    if (!isOpen) {
                        stopScanner().then(() => { setIsReady(false); });
                    } else if (isPaused && state === 2) {
                        scannerRef.current.pause(true); // pause video as well
                    } else if (!isPaused && state === 3) { // 3 = PAUSED
                        scannerRef.current.resume();
                    }
                } catch (e) { }
            }
        }

        return () => {
            // Don't stop on unmount if we just paused, wait no, if it unmounts we MUST stop
        };
    }, [isOpen, selectedCameraId, isPaused, startScanner]);

    useEffect(() => {
        return () => {
            stopScanner();
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
            <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-xl overflow-hidden flex flex-col items-center">
                {/* Header */}
                <div className="w-full flex justify-between items-center p-4 border-b dark:border-zinc-800">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Camera size={20} />
                        Scanner Kamera
                    </h3>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X size={20} />
                    </Button>
                </div>

                {/* Scanner Body */}
                <div className="w-full p-4 flex flex-col items-center justify-center gap-4 relative">

                    {permissionError ? (
                        <div className="w-full p-6 flex flex-col items-center text-center gap-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-900/50">
                            <AlertTriangle size={32} />
                            <p className="text-sm">{permissionError}</p>
                            <Button variant="outline" size="sm" onClick={() => getCameras()} className="mt-2">
                                Coba Lagi
                            </Button>
                        </div>
                    ) : (
                        <div
                            id={containerId}
                            className="w-full h-auto overflow-hidden rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-700"
                            style={{ minHeight: '300px' }}
                        ></div>
                    )}

                    {!permissionError && (
                        <div className="text-sm text-center text-zinc-500 dark:text-zinc-400">
                            Arahkan kamera ke resi (QR / Barcode).<br />
                            Pesanan akan ditampilkan di bawah ini.
                        </div>
                    )}

                    {scannedOrder && (
                        <div className="w-full mt-2 p-4 border rounded-lg bg-zinc-50 dark:bg-zinc-800/50 flex flex-col gap-2 shadow-sm animate-in fade-in slide-in-from-bottom-4">
                            <h4 className="font-semibold text-zinc-900 dark:text-zinc-50 border-b pb-2 mb-1">Detail Pesanan</h4>
                            <div className="grid grid-cols-[100px_1fr] gap-x-2 gap-y-1 text-sm">
                                <span className="text-zinc-500">Toko:</span>
                                <span className="font-medium">{scannedOrder.shop_name}</span>

                                <span className="text-zinc-500">Order SN:</span>
                                <span className="font-mono">{scannedOrder.order_sn}</span>

                                <span className="text-zinc-500">Resi:</span>
                                <span className="font-mono">{scannedOrder.tracking_number || '-'}</span>

                                <span className="text-zinc-500">Status:</span>
                                <span>{scannedOrder.order_status}</span>

                                <span className="text-zinc-500">SKU:</span>
                                <div className="flex flex-col">
                                    {scannedOrder.items?.map((item, idx) => (
                                        <span key={idx} className="text-xs">
                                            {item.item_sku} {item.model_name ? `(${item.model_name})` : ''} x{item.model_quantity_purchased}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {cameras.length > 1 && (
                        <Button variant="outline" onClick={switchCamera} className="mt-2" disabled={!isReady}>
                            <RefreshCw size={16} className="mr-2" />
                            Ganti Kamera
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
