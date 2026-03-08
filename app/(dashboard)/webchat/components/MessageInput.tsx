'use client'
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ImageIcon, Send, X, Loader2, Plus, Film, Smile, ShoppingBag, Package, MessageSquareText } from "lucide-react";
import { MessageInputProps, SelectedMedia, Order } from '../_types';
import { toast } from 'sonner';
import Image from 'next/image';
import StickerPickerContent from './StickerPicker';
import ProductPicker from './ProductPicker';
import OrderPicker from './OrderPicker';
import TemplatePicker from './TemplatePicker';

const MAX_MEDIA = 5;

const MessageInput = ({ onSendMessage, isSendingMessage, shopId, orders = [] }: MessageInputProps & { shopId: number | null; orders?: Order[] }) => {
    const [inputMessage, setInputMessage] = useState('');
    const [selectedMedia, setSelectedMedia] = useState<SelectedMedia[]>([]);
    const [isUploadingMedia, setIsUploadingMedia] = useState(false);
    const [showStickerPicker, setShowStickerPicker] = useState(false);
    const [showProductPicker, setShowProductPicker] = useState(false);
    const [showOrderPicker, setShowOrderPicker] = useState(false);
    const [showTemplatePicker, setShowTemplatePicker] = useState(false);
    const [quickTemplates, setQuickTemplates] = useState<{ id: string, title: string, content: string }[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);

    const fetchQuickTemplates = async () => {
        try {
            const res = await fetch('/api/chat-templates');
            const data = await res.json();
            if (data.data) setQuickTemplates(data.data);
        } catch {
            console.error('Gagal memuat template quick pick');
        }
    };

    useEffect(() => {
        fetchQuickTemplates();
    }, []);

    const handleSendSticker = (packageId: string, stickerId: string) => {
        onSendMessage('', 'sticker', {
            sticker_id: stickerId,
            sticker_package_id: packageId,
        });
    };

    const handleSendProduct = async (itemId: number) => {
        onSendMessage('', 'item', { item_id: itemId });
    };

    const handleSendOrder = async (orderSn: string) => {
        onSendMessage('', 'order', { order_sn: orderSn });
    };

    const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>, mediaType: 'image' | 'video') => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        if (selectedMedia.length + files.length > MAX_MEDIA) {
            toast.error(`Maksimal ${MAX_MEDIA} file media dapat dikirim sekaligus.`);
            return;
        }

        const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        const allowedVideoTypes = ['video/mp4', 'video/quicktime', 'video/x-m4v'];

        const newMedia: SelectedMedia[] = [];

        for (const file of files) {
            if (mediaType === 'image' && !allowedImageTypes.includes(file.type)) {
                toast.error(`File ${file.name} tidak didukung. Hanya JPG, PNG, dan GIF.`);
                continue;
            }
            if (mediaType === 'video' && !allowedVideoTypes.includes(file.type)) {
                toast.error(`File ${file.name} tidak didukung. Hanya MP4/MOV.`);
                continue;
            }

            const maxSize = mediaType === 'image' ? 10 : 30; // 10MB image, 30MB video
            if (file.size > maxSize * 1024 * 1024) {
                toast.error(`Ukuran file ${file.name} melebihi batas ${maxSize}MB.`);
                continue;
            }

            newMedia.push({
                id: Math.random().toString(36).substring(7),
                file,
                preview: URL.createObjectURL(file),
                type: mediaType
            });
        }

        if (newMedia.length > 0) {
            setSelectedMedia(prev => [...prev, ...newMedia]);
        }

        // Reset file input agar bisa pilih file yang sama lagi
        e.target.value = '';
    };

    const handleRemoveMedia = (idToRemove: string) => {
        setSelectedMedia(prev => {
            const filtered = prev.filter(media => media.id !== idToRemove);
            // Cleanup object URL
            const removed = prev.find(media => media.id === idToRemove);
            if (removed) {
                URL.revokeObjectURL(removed.preview);
            }
            return filtered;
        });
    };

    const handleSend = async () => {
        if (isSendingMessage) return;
        if (!inputMessage.trim() && selectedMedia.length === 0) return;

        if (!shopId) {
            toast.error('Pilih toko terlebih dahulu.');
            return;
        }

        const currentMessage = inputMessage;
        const currentMedia = [...selectedMedia];

        // Segera bersihkan input agar UI terasa cepat
        setInputMessage('');
        setSelectedMedia([]);

        try {
            await onSendMessage(currentMessage, 'text', undefined, currentMedia);
        } catch (err) {
            // Restore previous state if it purely failed at the sync layer
            if (currentMessage) setInputMessage(currentMessage);
            if (currentMedia.length > 0) setSelectedMedia(currentMedia);
            toast.error('Terjadi kesalahan saat mengirim pesan.');
        }
    };

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const autoResize = useCallback(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        const maxHeight = 120; // ~5 lines
        el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    }, []);

    useEffect(() => {
        autoResize();
    }, [inputMessage, autoResize]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const isBusy = isSendingMessage || isUploadingMedia;

    return (
        <div className="px-3 pb-3 pt-2 bg-background space-y-2">
            {/* Media preview list */}
            {selectedMedia.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pt-2 pb-2 pr-3 scrollbar-thin">
                    {selectedMedia.map((media) => (
                        <div key={media.id} className="relative inline-block shrink-0">
                            <div className="relative w-20 h-20 rounded-md overflow-hidden border border-border bg-black">
                                {media.type === 'video' ? (
                                    <video
                                        src={media.preview}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <Image
                                        src={media.preview}
                                        alt="Preview"
                                        fill
                                        className="object-cover"
                                    />
                                )}
                            </div>
                            <button
                                onClick={() => handleRemoveMedia(media.id)}
                                className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center shadow-sm hover:opacity-80 transition-opacity z-10"
                                type="button"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}

                    {/* Tombol tambah media jika belum maksimal */}
                    {selectedMedia.length < MAX_MEDIA && (
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isBusy}
                            className="w-20 h-20 shrink-0 border-2 border-dashed border-border rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Plus className="w-6 h-6" />
                        </button>
                    )}
                </div>
            )}

            {/* Template Quick Pick */}
            {quickTemplates.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none w-full mask-linear-right">
                    {quickTemplates.map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setInputMessage(prev => prev ? `${prev}\n${t.content}` : t.content)}
                            className="shrink-0 max-w-[150px] truncate text-[11px] font-medium px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20 shadow-sm"
                            title={t.content}
                        >
                            {t.title}
                        </button>
                    ))}
                </div>
            )}

            {/* Input row */}
            <div className="flex items-end gap-1.5">
                {/* Hidden file inputs */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif"
                    multiple
                    className="hidden"
                    onChange={(e) => handleMediaSelect(e, 'image')}
                />
                <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/mp4,video/quicktime,video/x-m4v"
                    className="hidden"
                    onChange={(e) => handleMediaSelect(e, 'video')}
                />

                {/* Attachment menu (+) */}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            disabled={isBusy || selectedMedia.length >= MAX_MEDIA}
                            title="Lampiran"
                            className="shrink-0 h-9 w-9 text-muted-foreground hover:text-foreground"
                        >
                            <Plus className="w-5 h-5" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent side="top" align="start" className="w-auto p-1.5">
                        <div className="flex flex-col gap-0.5">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isBusy || selectedMedia.length >= MAX_MEDIA}
                                className="flex items-center gap-2.5 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ImageIcon className="w-4 h-4 text-emerald-500" />
                                <span>Gambar</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => videoInputRef.current?.click()}
                                disabled={isBusy || selectedMedia.length >= MAX_MEDIA}
                                className="flex items-center gap-2.5 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Film className="w-4 h-4 text-blue-500" />
                                <span>Video</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowProductPicker(true)}
                                disabled={isBusy}
                                className="flex items-center gap-2.5 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ShoppingBag className="w-4 h-4 text-orange-500" />
                                <span>Produk</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowOrderPicker(true)}
                                disabled={isBusy}
                                className="flex items-center gap-2.5 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Package className="w-4 h-4 text-purple-500" />
                                <span>Pesanan</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowTemplatePicker(true)}
                                disabled={isBusy}
                                className="flex items-center gap-2.5 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <MessageSquareText className="w-4 h-4 text-teal-500" />
                                <span>Template</span>
                            </button>
                        </div>
                    </PopoverContent>
                </Popover>

                {/* Sticker picker */}
                <Popover open={showStickerPicker} onOpenChange={setShowStickerPicker}>
                    <PopoverTrigger asChild>
                        <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            title="Stiker"
                            className={`shrink-0 h-9 w-9 transition-colors ${showStickerPicker ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <Smile className="w-5 h-5" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent side="top" align="start" className="w-[280px] sm:w-[320px] p-2">
                        <StickerPickerContent
                            onSelectSticker={(pkgId, stkId) => {
                                handleSendSticker(pkgId, stkId);
                                setShowStickerPicker(false);
                            }}
                        />
                    </PopoverContent>
                </Popover>

                {/* Auto-expanding textarea */}
                <textarea
                    ref={textareaRef}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ketik pesan..."
                    disabled={isBusy}
                    rows={1}
                    className="flex-1 min-w-0 resize-none overflow-y-auto rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 scrollbar-thin"
                    style={{ maxHeight: '120px' }}
                />

                {/* Send button */}
                <Button
                    type="button"
                    size="icon"
                    onClick={handleSend}
                    disabled={isBusy || (!inputMessage.trim() && selectedMedia.length === 0)}
                    className="shrink-0 h-9 w-9"
                >
                    {isBusy ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Send className="w-4 h-4" />
                    )}
                </Button>
            </div>

            {/* Product Picker Dialog */}
            <ProductPicker
                open={showProductPicker}
                onClose={() => setShowProductPicker(false)}
                onSendProduct={handleSendProduct}
                shopId={shopId}
            />

            {/* Order Picker Dialog */}
            <OrderPicker
                open={showOrderPicker}
                onClose={() => setShowOrderPicker(false)}
                onSendOrder={handleSendOrder}
                orders={orders}
            />

            {/* Template Picker Dialog */}
            <TemplatePicker
                open={showTemplatePicker}
                onClose={() => setShowTemplatePicker(false)}
                onSelectTemplate={(content) => setInputMessage(prev => prev ? `${prev}\n${content}` : content)}
                onTemplatesChange={fetchQuickTemplates}
            />
        </div>
    );
};

export default MessageInput;
