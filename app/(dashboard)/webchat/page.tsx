'use client'
import React from 'react';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, MessageSquare, ShoppingBag, User } from "lucide-react";

// Hooks
import { useChatState } from './hooks/useChatState';
import { useConversationFilter } from './hooks/useConversationFilter';

// Components
import ChatSidebar from './components/ChatSidebar';
import ChatContent from './components/ChatContent';
import MessageInput from './components/MessageInput';
import OrderPanel from './components/OrderPanel';

const WebChatPage: React.FC = () => {
  const chat = useChatState();
  const filter = useConversationFilter(chat.conversations);

  return (
    <div className={`flex h-full w-full overflow-hidden ${chat.isFullScreenChat ? 'fixed inset-0 z-50 bg-background' : ''}`}>

      {/* ── Sidebar Kiri: Daftar Percakapan ── */}
      {(!chat.isMobileView || (chat.isMobileView && chat.showConversationList)) && (
        <ChatSidebar
          filteredConversations={filter.filteredConversations}
          selectedConversation={chat.selectedConversation}
          isMobileView={chat.isMobileView}
          searchInput={filter.searchInput}
          setSearchInput={filter.setSearchInput}
          statusFilter={filter.statusFilter}
          setStatusFilter={filter.setStatusFilter}
          selectedShops={filter.selectedShops}
          toggleShop={filter.toggleShop}
          formattedUniqueShops={filter.formattedUniqueShops}
          onSelect={chat.handleConversationSelect}
        />
      )}

      {/* ── Area Utama: Chat + Orders ── */}
      {(!chat.isMobileView || (chat.isMobileView && !chat.showConversationList)) && (
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">

          {/* Jika belum ada percakapan dipilih */}
          {!chat.selectedConversation ? (
            <div className="flex-1 flex flex-col items-center justify-center min-w-0 h-full overflow-hidden">
              <div className="text-center space-y-4 max-w-md p-4">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground opacity-20" />
                <h3 className="text-lg font-medium">Pilih percakapan untuk memulai chat</h3>
                <p className="text-sm text-muted-foreground">
                  Pilih salah satu percakapan dari daftar di sebelah kiri untuk mulai berkomunikasi dengan pelanggan Anda.
                </p>
              </div>
            </div>
          ) : chat.isMobileView ? (
            /* ── Mobile Layout ── */
            chat.activeTab === 'chat' ? (
              <div className="flex flex-col w-full h-full overflow-hidden">
                {/* Header mobile */}
                <div className="border-b bg-background z-10 p-3 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => { chat.setShowConversationList(true); chat.setIsFullScreenChat(false); }}>
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={chat.selectedConversationData?.to_avatar} />
                      <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                    </Avatar>
                    <div className="overflow-hidden">
                      <p className="font-medium truncate text-sm">{chat.selectedConversationData?.shop_name}</p>
                      <p className="font-bold truncate text-xs">{chat.selectedConversationData?.to_name}</p>
                    </div>
                  </div>
                  <Tabs value={chat.activeTab} onValueChange={(v) => chat.setActiveTab(v as 'chat' | 'orders')}>
                    <TabsList className="flex gap-1">
                      <TabsTrigger value="chat" className="px-2"><MessageSquare className="h-4 w-4" /></TabsTrigger>
                      <TabsTrigger value="orders" className="px-2"><ShoppingBag className="h-4 w-4" /></TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <div className="flex-1 overflow-hidden min-h-0">
                  <ChatContent messages={chat.messages} orders={chat.orders} isLoading={chat.isLoading} error={chat.error} hasMoreMessages={chat.hasMoreMessages} isLoadingConversation={chat.isLoadingConversation} messagesEndRef={chat.messagesEndRef} setActiveTab={chat.setActiveTab} selectedConversation={chat.selectedConversation} isMobileView={chat.isMobileView} />
                </div>
                <div className="p-4 py-3 border-t shrink-0">
                  <MessageInput onSendMessage={chat.handleSendMessage} isSendingMessage={chat.isSendingMessage} />
                </div>
              </div>
            ) : (
              <>
                {/* Header orders mobile */}
                <div className="border-b bg-background z-10 p-3 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => { chat.setShowConversationList(true); chat.setIsFullScreenChat(false); }}>
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={chat.selectedConversationData?.to_avatar} />
                      <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                    </Avatar>
                    <div className="overflow-hidden">
                      <p className="font-medium truncate text-sm">{chat.selectedConversationData?.shop_name}</p>
                      <p className="font-bold truncate text-xs">{chat.selectedConversationData?.to_name}</p>
                    </div>
                  </div>
                  <Tabs value={chat.activeTab} onValueChange={(v) => chat.setActiveTab(v as 'chat' | 'orders')}>
                    <TabsList className="flex gap-1">
                      <TabsTrigger value="chat" className="px-2"><MessageSquare className="h-4 w-4" /></TabsTrigger>
                      <TabsTrigger value="orders" className="px-2"><ShoppingBag className="h-4 w-4" /></TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <OrderPanel orders={chat.orders} isLoading={chat.isLoadingOrders} showHeader={false} />
              </>
            )
          ) : (
            /* ── Desktop Layout ── */
            <div className="flex flex-col w-full h-full overflow-hidden">
              {/* Header desktop */}
              <div className="border-b bg-background z-10 flex justify-between items-center shrink-0 h-[66px] px-3">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={chat.selectedConversationData?.to_avatar} />
                    <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                  </Avatar>
                  <div className="overflow-hidden">
                    <p className="font-medium truncate text-sm">{chat.selectedConversationData?.shop_name}</p>
                    <p className="font-bold truncate text-xs">{chat.selectedConversationData?.to_name}</p>
                  </div>
                </div>
              </div>

              {/* Chat area */}
              <div className="flex-1 overflow-hidden min-h-0">
                <ChatContent messages={chat.messages} orders={chat.orders} isLoading={chat.isLoading} error={chat.error} hasMoreMessages={chat.hasMoreMessages} isLoadingConversation={chat.isLoadingConversation} messagesEndRef={chat.messagesEndRef} setActiveTab={chat.setActiveTab} selectedConversation={chat.selectedConversation} isMobileView={chat.isMobileView} />
              </div>
              <div className="p-4 py-3 border-t shrink-0">
                <MessageInput onSendMessage={chat.handleSendMessage} isSendingMessage={chat.isSendingMessage} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Kolom Kanan: Order Details (Desktop only) ── */}
      {chat.selectedConversation && !chat.isMobileView && (
        <div className="w-1/4 border-l bg-muted/20 overflow-hidden flex flex-col">
          <OrderPanel orders={chat.orders} isLoading={chat.isLoadingOrders} showHeader={true} />
        </div>
      )}
    </div>
  );
};

export default WebChatPage;
