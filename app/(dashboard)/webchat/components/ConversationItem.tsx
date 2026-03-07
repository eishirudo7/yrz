'use client'
import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowRight, CheckCircle2, User } from "lucide-react";
import { Conversation, ConversationItemProps } from '../_types';

const ConversationItem = React.memo(({ conversation, isSelected, isMobileView, onSelect }: ConversationItemProps) => {
    return (
        <>
            <div
                className={`grid grid-cols-[auto_1fr] gap-x-2 gap-y-0 p-2 ${isSelected
                    ? 'bg-primary/10 border-l-4 border-primary shadow-sm dark:bg-primary/20 relative'
                    : 'hover:bg-muted/50 cursor-pointer border-l-4 border-transparent'
                    } ${isMobileView ? 'text-sm' : ''} transition-all duration-200 ease-in-out mb-1 rounded-sm`}
                onClick={() => {
                    onSelect(conversation);
                }}
            >
                {isSelected && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 text-primary">
                        <ArrowRight className="h-4 w-4" />
                    </div>
                )}

                <Avatar className={`${isMobileView ? 'h-8 w-8' : 'h-9 w-9'} row-span-3 self-center ${isSelected ? 'ring-2 ring-primary ring-offset-1' : ''}`}>
                    <AvatarImage src={conversation.to_avatar} />
                    <AvatarFallback><User className={isMobileView ? 'h-4 w-4' : ''} /></AvatarFallback>
                </Avatar>

                <div className="flex justify-between items-center w-full pr-6">
                    <div className="flex items-center max-w-[65%]">
                        <p className={`font-medium truncate text-xs leading-tight ${isSelected ? 'text-primary font-semibold' : ''}`}>{conversation.shop_name}</p>
                        {conversation.unread_count > 0 && (
                            <div className="w-2 h-2 bg-red-500 rounded-full ml-1 flex-shrink-0"></div>
                        )}
                    </div>
                    <p className={`text-muted-foreground text-[10px] flex-shrink-0`}>
                        {new Date(conversation.last_message_timestamp / 1000000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>

                <div className="flex justify-between items-center w-full pr-6">
                    <p className={`font-bold truncate max-w-[75%] text-xs leading-tight ${isSelected ? 'text-primary' : ''}`}>{conversation.to_name}</p>
                    {conversation.to_id != conversation.latest_message_from_id && conversation.unread_count === 0 && (
                        <CheckCircle2 className={`text-primary flex-shrink-0 h-2 w-2`} />
                    )}
                </div>

                <p className={`text-muted-foreground truncate pr-6 text-xs leading-tight ${isSelected ? 'opacity-80' : 'opacity-60'}`}>
                    {conversation.latest_message_content?.text}
                </p>
            </div>
        </>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.isSelected === nextProps.isSelected &&
        prevProps.conversation.unread_count === nextProps.conversation.unread_count &&
        prevProps.conversation.last_message_timestamp === nextProps.conversation.last_message_timestamp &&
        prevProps.conversation.latest_message_content?.text === nextProps.conversation.latest_message_content?.text
    );
});

ConversationItem.displayName = 'ConversationItem';

export default ConversationItem;
