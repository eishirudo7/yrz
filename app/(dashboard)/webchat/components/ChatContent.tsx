'use client'
import React, { useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquare } from "lucide-react";
import { UIMessage } from '@/types/shopeeMessage';
import { ChatContentProps, Order } from '../_types';
import MessageBubble from './MessageBubble';

const ChatContent = React.memo(({
    messages,
    orders,
    isLoading,
    error,
    hasMoreMessages,
    isLoadingConversation,
    messagesEndRef,
    selectedConversation,
    isMobileView
}: ChatContentProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Scroll ke bawah ketika pesan baru ditambahkan atau percakapan dibuka
    useEffect(() => {
        if (messages.length > 0 && scrollContainerRef.current && !isLoading) {
            const timeoutId = setTimeout(() => {
                if (scrollContainerRef.current) {
                    scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
                }
            }, 150);

            return () => clearTimeout(timeoutId);
        }
    }, [messages.length, isLoading]);

    if (isLoadingConversation) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-4">
                <div className="flex flex-col items-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground font-medium">Memuat percakapan...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-4">
                <div className="flex flex-col items-center space-y-4 text-destructive">
                    <div className="h-12 w-12 rounded-full border-2 border-destructive flex items-center justify-center">
                        <span className="text-2xl font-bold">!</span>
                    </div>
                    <p className="font-medium text-center">Terjadi kesalahan saat memuat pesan</p>
                    <Button variant="outline" className="mt-2" onClick={() => window.location.reload()}>
                        Coba lagi
                    </Button>
                </div>
            </div>
        );
    }

    if (messages.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-4">
                <div className="flex flex-col items-center space-y-4 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 opacity-20" />
                    <p className="font-medium text-center">Belum ada pesan</p>
                    <p className="text-sm text-center">Mulai percakapan dengan mengirimkan pesan pertama</p>
                </div>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="h-full w-full overflow-hidden">
            {/* Loading indicator untuk pesan lama */}
            {hasMoreMessages && isLoading && (
                <div className="flex justify-center p-2 sticky top-0 bg-background/80 backdrop-blur-sm z-10">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Memuat pesan lama</span>
                    </div>
                </div>
            )}

            <div
                ref={scrollContainerRef}
                className="h-full w-full overflow-auto scrollbar-thin p-4"
            >
                {messages.map((message) => (
                    <MessageBubble
                        key={message.id}
                        message={message}
                        orders={orders}
                        isMobileView={isMobileView}
                    />
                ))}
                <div ref={messagesEndRef} />
            </div>
        </div>
    );
});

ChatContent.displayName = 'ChatContent';

export default ChatContent;
