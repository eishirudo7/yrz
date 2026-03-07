'use client'
import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageIcon, Send, X, Loader2 } from "lucide-react";
import { MessageInputProps } from '../_types';
import { toast } from 'sonner';
import Image from 'next/image';

const MessageInput = ({ onSendMessage, isSendingMessage, shopId }: MessageInputProps & { shopId: number | null }) => {
    const [inputMessage, setInputMessage] = useState('');
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            toast.error('Hanya JPG, PNG, dan GIF yang didukung.');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            toast.error('Ukuran gambar maks 10MB.');
            return;
        }

        setSelectedImage(file);
        setImagePreview(URL.createObjectURL(file));
        // Reset file input agar bisa pilih file yang sama lagi
        e.target.value = '';
    };

    const handleRemoveImage = () => {
        setSelectedImage(null);
        if (imagePreview) {
            URL.revokeObjectURL(imagePreview);
            setImagePreview(null);
        }
    };

    const handleSend = async () => {
        if (isSendingMessage || isUploadingImage) return;

        // Kirim gambar
        if (selectedImage) {
            if (!shopId) {
                toast.error('Pilih toko terlebih dahulu.');
                return;
            }

            setIsUploadingImage(true);
            try {
                const formData = new FormData();
                formData.append('file', selectedImage);
                formData.append('shopId', shopId.toString());

                const res = await fetch('/api/msg/upload_image', {
                    method: 'POST',
                    body: formData,
                });
                const data = await res.json();

                if (!data.success) {
                    toast.error(data.error || 'Gagal mengupload gambar.');
                    return;
                }

                // Kirim sebagai pesan tipe 'image' dengan url dari Shopee CDN
                await onSendMessage('', 'image', { image_url: data.url });
                handleRemoveImage();
            } catch (err) {
                toast.error('Gagal mengupload gambar, coba lagi.');
            } finally {
                setIsUploadingImage(false);
            }
            return;
        }

        // Kirim teks biasa
        if (!inputMessage.trim()) return;
        await onSendMessage(inputMessage);
        setInputMessage('');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const isBusy = isSendingMessage || isUploadingImage;

    return (
        <div className="p-3 border-t bg-background space-y-2">
            {/* Image preview */}
            {imagePreview && (
                <div className="relative inline-block">
                    <div className="relative w-24 h-24 rounded-md overflow-hidden border border-border">
                        <Image
                            src={imagePreview}
                            alt="Preview"
                            fill
                            className="object-cover"
                        />
                    </div>
                    <button
                        onClick={handleRemoveImage}
                        className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center shadow-sm hover:opacity-80 transition-opacity"
                    >
                        <X className="w-3 h-3" />
                    </button>
                </div>
            )}

            {/* Input row */}
            <div className="flex items-center gap-2">
                {/* Tombol pilih gambar */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif"
                    className="hidden"
                    onChange={handleImageSelect}
                />
                <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isBusy}
                    title="Kirim gambar"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                    <ImageIcon className="w-5 h-5" />
                </Button>

                <Input
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={selectedImage ? 'Gambar siap dikirim...' : 'Ketik pesan...'}
                    disabled={isBusy || !!selectedImage}
                    className="flex-1"
                />

                <Button
                    type="button"
                    size="icon"
                    onClick={handleSend}
                    disabled={isBusy || (!inputMessage.trim() && !selectedImage)}
                    className="shrink-0"
                >
                    {isBusy ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Send className="w-4 h-4" />
                    )}
                </Button>
            </div>
        </div>
    );
};

export default MessageInput;
