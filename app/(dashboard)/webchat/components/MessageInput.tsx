'use client'
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { MessageInputProps } from '../_types';

const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage, isSendingMessage }) => {
    const [newMessage, setNewMessage] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || isSendingMessage) return;
        onSendMessage(newMessage);
        setNewMessage('');
    };

    return (
        <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
                type="text"
                placeholder="Ketik pesan..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-grow"
                disabled={isSendingMessage}
            />
            <Button
                type="submit"
                disabled={!newMessage.trim() || isSendingMessage}
                className={!newMessage.trim() || isSendingMessage ? "opacity-70" : ""}
            >
                {isSendingMessage ? (
                    <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                ) : (
                    <Send className="h-4 w-4" />
                )}
            </Button>
        </form>
    );
};

export default MessageInput;
