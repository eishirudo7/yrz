'use client'
import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Filter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Virtuoso } from 'react-virtuoso';
import ConversationItem from './ConversationItem';
import { Conversation } from '../_types';
import { StatusFilter } from '../hooks/useConversationFilter';

interface ChatSidebarProps {
    filteredConversations: Conversation[];
    selectedConversation: string | null;
    isMobileView: boolean;
    searchInput: string;
    setSearchInput: (val: string) => void;
    statusFilter: StatusFilter;
    setStatusFilter: (val: StatusFilter) => void;
    selectedShops: number[];
    toggleShop: (shopId: number) => void;
    formattedUniqueShops: { id: number; name: string }[];
    onSelect: (conversation: Conversation) => void;
}

const ChatSidebar = ({
    filteredConversations,
    selectedConversation,
    isMobileView,
    searchInput,
    setSearchInput,
    statusFilter,
    setStatusFilter,
    selectedShops,
    toggleShop,
    formattedUniqueShops,
    onSelect,
}: ChatSidebarProps) => {
    return (
        <div className={`${isMobileView ? 'w-full' : 'w-1/3 md:w-1/4 lg:w-1/5'} border-r bg-muted/20 flex flex-col h-full`}>
            {/* Kolom Pencarian dan Filter */}
            <div className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                    <Input
                        type="text"
                        placeholder="Cari percakapan..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="flex-grow"
                    />
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="icon">
                                <Filter className="h-4 w-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80">
                            <div>
                                <h4 className="font-medium mb-2">Filter Toko:</h4>
                                {formattedUniqueShops.map(shop => (
                                    <label key={shop.id} className="flex items-center mb-1">
                                        <input
                                            type="checkbox"
                                            checked={selectedShops.includes(shop.id)}
                                            onChange={() => toggleShop(shop.id)}
                                            className="mr-2"
                                        />
                                        {shop.name}
                                    </label>
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>

                <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="SEMUA" className="text-xs">Semua</TabsTrigger>
                        <TabsTrigger value="BELUM DIBACA" className="text-xs">Belum Dibaca</TabsTrigger>
                        <TabsTrigger value="BELUM DIBALAS" className="text-xs">Belum Dibalas</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <Virtuoso
                className="flex-grow"
                data={filteredConversations}
                itemContent={(index, conversation) => (
                    <div className="px-3 py-1">
                        <ConversationItem
                            key={conversation.conversation_id}
                            conversation={conversation}
                            isSelected={selectedConversation === conversation.conversation_id}
                            isMobileView={isMobileView}
                            onSelect={onSelect}
                        />
                    </div>
                )}
                overscan={200}
                style={{ height: '100%' }}
                totalCount={filteredConversations.length}
                defaultItemHeight={72}
                initialTopMostItemIndex={
                    filteredConversations.findIndex(conv => conv.conversation_id === selectedConversation) !== -1
                        ? filteredConversations.findIndex(conv => conv.conversation_id === selectedConversation)
                        : 0
                }
                followOutput={selectedConversation ? 'smooth' : false}
            />
        </div>
    );
};

export default ChatSidebar;
