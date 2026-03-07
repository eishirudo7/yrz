import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
// FIX #9: convertToUIMessage diimport sebagai fungsi biasa (pure function, tidak pernah berubah)
// Tidak perlu masuk ke dependency array useCallback
import useStoreChat, { convertToUIMessage, ShopeeMessage } from '@/stores/useStoreChat';
import { UIMessage } from '@/types/shopeeMessage';
import { Conversation, Order } from '../_types';

export function useChatState() {
    const {
        conversations,
        isLoading: isStoreLoading,
        sendMessage: sendMessageStore,
        markAsRead: markAsReadStore,
        fetchMessages: fetchMessagesStore,
        initializeConversation,
        updateConversation,
        lastMessage,
    } = useStoreChat();

    const [selectedShop, setSelectedShop] = useState<number | null>(null);
    const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isMobileView, setIsMobileView] = useState(false);
    const [showConversationList, setShowConversationList] = useState(true);
    const [isFullScreenChat, setIsFullScreenChat] = useState(false);
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoadingOrders, setIsLoadingOrders] = useState(false);
    const [isSendingMessage, setIsSendingMessage] = useState(false);
    const [activeTab, setActiveTab] = useState<'chat' | 'orders'>('chat');
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const [urlProcessed, setUrlProcessed] = useState(false);
    const [isLoadingConversation, setIsLoadingConversation] = useState(false);
    const [messages, setMessages] = useState<UIMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [shouldFetchOrders, setShouldFetchOrders] = useState(false);
    // FIX #5: Hapus processedSSEMessages lokal — store sudah punya satu-satunya processedMessages

    const selectedConversationData = useMemo(() =>
        conversations.find(conv => conv.conversation_id === selectedConversation),
        [conversations, selectedConversation]
    );

    const handleMarkAsRead = useCallback(async (conversationId: string) => {
        const conversation = conversations.find(conv => conv.conversation_id === conversationId);
        if (!conversation || conversation.unread_count === 0) return;
        try {
            await markAsReadStore(conversationId);
        } catch (error) {
            console.error('Gagal menandai pesan sebagai dibaca:', error);
        }
    }, [conversations, markAsReadStore]);

    useEffect(() => {
        if (selectedConversation && selectedConversationData) {
            if (selectedConversationData.unread_count > 0 && messages.length > 0 && !isLoading) {
                const timeoutId = setTimeout(() => {
                    handleMarkAsRead(selectedConversation);
                }, 1500);
                return () => clearTimeout(timeoutId);
            }
        }
    }, [selectedConversationData, selectedConversation, isLoading, messages.length, handleMarkAsRead]);

    const handleSendMessage = async (
        message: string,
        type: string = 'text',
        content?: Record<string, any>
    ) => {
        if (!selectedConversationData || !selectedConversation || !selectedShop) return;
        if (type === 'text' && !message.trim()) return;

        try {
            setIsSendingMessage(true);

            const params = {
                conversationId: selectedConversation,
                content: type === 'text' ? message : content,
                toId: selectedConversationData.to_id,
                shopId: selectedShop,
                messageType: type,
            };

            const messageId = await sendMessageStore(params as any);

            // Aggiungi il messaggio all'UI locale
            const newMessage: UIMessage = {
                id: messageId || Date.now().toString(),
                sender: 'seller',
                content: type === 'text' ? message : content?.image_url || '',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                type: type as any,
                ...(type === 'image' && { image_url: content?.image_url }),
            };
            setMessages(prev => [...prev, newMessage]);

            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100);

        } catch (error) {
            console.error('[handleSendMessage] Error:', error);
            toast.error('Gagal mengirim pesan. Silakan coba lagi.');
        } finally {
            setIsSendingMessage(false);
        }
    };


    const handleConversationSelect = useCallback(async (conversation: Conversation) => {
        if (conversation.conversation_id === selectedConversation) {
            if (isMobileView) {
                setShowConversationList(false);
                setIsFullScreenChat(true);
            }
            return;
        }

        setIsLoadingConversation(true);
        setError(null);
        const newConversationId = conversation.conversation_id;
        const newShopId = conversation.shop_id;

        setMessages([]);
        setSelectedShop(newShopId);
        setSelectedConversation(newConversationId);
        setShouldFetchOrders(true);

        if (isMobileView) {
            setShowConversationList(false);
            setIsFullScreenChat(true);
        }

        try {
            const fetchedMessages = await fetchMessagesStore(newConversationId);
            // FIX #9: convertToUIMessage adalah pure function — aman dipakai di sini
            // tanpa perlu ada di dependency array
            const uiMessages = fetchedMessages?.map(msg =>
                convertToUIMessage(msg as ShopeeMessage, newShopId)
            ) || [];

            setMessages(uiMessages);
            setHasMoreMessages(fetchedMessages?.length === 25);
        } catch (error) {
            console.error('[handleConversationSelect] Error:', error);
            toast.error('Gagal memuat percakapan');
            setSelectedShop(null);
            setSelectedConversation(null);
            setMessages([]);
            setError('Gagal memuat percakapan');
        } finally {
            setIsLoadingConversation(false);
        }
    }, [
        isMobileView,
        selectedConversation,
        fetchMessagesStore,
        // FIX #9: convertToUIMessage DIHAPUS dari deps — ini pure function,
        // referensinya tidak pernah berubah, tidak perlu di-track
    ]);

    const loadMessages = useCallback(async () => {
        if (!selectedConversation || !selectedShop) return;
        const conversationId = selectedConversation;
        const shopId = selectedShop;

        try {
            setIsLoading(true);
            const fetchedMessages = await fetchMessagesStore(conversationId);
            if (selectedConversation !== conversationId) return;

            const uiMessages = fetchedMessages?.map(msg =>
                convertToUIMessage(msg as ShopeeMessage, shopId)
            ) || [];

            if (selectedConversation === conversationId) {
                setMessages(uiMessages);
                setHasMoreMessages(fetchedMessages?.length === 25);
            }
        } catch (err) {
            if (selectedConversation === conversationId) {
                setError(err instanceof Error ? err.message : 'Gagal memuat pesan');
            }
        } finally {
            if (selectedConversation === conversationId) {
                setIsLoading(false);
            }
        }
        // FIX #9: convertToUIMessage dihapus dari deps
    }, [selectedConversation, selectedShop, fetchMessagesStore]);

    useEffect(() => {
        if (selectedConversation && ((messages.length > 0 && !isLoading) || error)) {
            setIsLoadingConversation(false);
        }
    }, [messages.length, isLoading, error, selectedConversation]);

    // FIX #10: Hapus salah satu dari dua scroll effect yang duplikat
    // Pertahankan hanya yang lebih efisien (compare length, bukan array reference)
    useEffect(() => {
        if (messages.length > 0 && !isLoading) {
            const timer = setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [messages.length, isLoading]);

    const fetchOrders = useCallback(async (userId: string) => {
        setIsLoadingOrders(true);
        try {
            const response = await fetch(`/api/order_details?user_id=${userId}`);
            const data = await response.json();
            setOrders(data.data);
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setIsLoadingOrders(false);
        }
    }, []);

    useEffect(() => {
        if (selectedConversationData?.to_id && shouldFetchOrders) {
            fetchOrders(selectedConversationData.to_id.toString());
            setShouldFetchOrders(false);
        }
    }, [selectedConversationData?.to_id, shouldFetchOrders, fetchOrders]);

    useEffect(() => {
        const handleUrlParams = async () => {
            if (urlProcessed) return;
            const urlParams = new URLSearchParams(window.location.search);
            const userId = urlParams.get('user_id');
            const orderSn = urlParams.get('order_sn');
            const shopId = urlParams.get('shop_id');
            if (!userId) return;

            const targetConversation = conversations.find(
                conv => conv.to_id.toString() === userId &&
                    (!shopId || conv.shop_id.toString() === shopId)
            );

            if (targetConversation) {
                handleConversationSelect(targetConversation);
                setUrlProcessed(true);
            } else if (orderSn && shopId) {
                try {
                    await initializeConversation({ userId, shopId, orderSn });
                    setTimeout(() => {
                        const newConversation = conversations.find(
                            conv => conv.to_id.toString() === userId && conv.shop_id.toString() === shopId
                        );
                        if (newConversation) handleConversationSelect(newConversation);
                        setUrlProcessed(true);
                    }, 500);
                } catch (error) {
                    console.error('Error memulai percakapan:', error);
                    toast.error('Gagal memulai percakapan');
                    setUrlProcessed(true);
                }
            }
        };

        if (conversations.length > 0 && !urlProcessed) {
            handleUrlParams();
        }
    }, [conversations, urlProcessed, handleConversationSelect, initializeConversation]);

    useEffect(() => {
        const handleResize = () => {
            const isMobile = window.innerWidth < 768;
            setIsMobileView(isMobile);
            setIsFullScreenChat(isMobile && !showConversationList);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [showConversationList]);

    // FIX #5: SSE handler disederhanakan — store sudah handle processedMessages
    // Hook hanya perlu tambahkan pesan ke UI jika conversation cocok
    useEffect(() => {
        if (!lastMessage?.message_id || !selectedConversation) return;
        if (lastMessage.conversation_id !== selectedConversation) return;
        if (!selectedShop) return;

        // Cek apakah pesan sudah ada di UI (bisa terjadi kalau kita sendiri yang kirim)
        const messageExists = messages.some(msg => msg.id === lastMessage.message_id);
        if (messageExists) return;

        // Konversi SSE data ke ShopeeMessage format lalu ke UIMessage
        const shopeeMsg: ShopeeMessage = {
            message_id: lastMessage.message_id,
            conversation_id: lastMessage.conversation_id,
            from_id: lastMessage.sender,
            to_id: lastMessage.receiver || (selectedConversationData?.to_id || 0),
            from_shop_id: lastMessage.sender === selectedShop ? selectedShop : 0,
            to_shop_id: lastMessage.sender !== selectedShop ? selectedShop : 0,
            message_type: lastMessage.message_type as any,
            content: lastMessage.content || {},
            created_timestamp: lastMessage.timestamp || Math.floor(Date.now() / 1000),
            region: "",
            status: "received",
            message_option: 0,
            source: "sse",
            source_content: {},
            quoted_msg: null
        };

        const newUIMessage = convertToUIMessage(shopeeMsg, selectedShop);
        setMessages(prev => [...prev, newUIMessage]);

        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);

    }, [lastMessage, selectedConversation, selectedShop, messages, selectedConversationData?.to_id]);
    // FIX #5: updateConversation DIHAPUS dari deps — store sudah update via handleSSEMessage
    // Hook tidak perlu lagi double-update conversation list

    return {
        conversations,
        isStoreLoading,
        selectedShop,
        selectedConversation,
        selectedConversationData,
        messagesEndRef,
        scrollAreaRef,
        isMobileView,
        showConversationList,
        setShowConversationList,
        isFullScreenChat,
        setIsFullScreenChat,
        orders,
        isLoadingOrders,
        isSendingMessage,
        activeTab,
        setActiveTab,
        isLoadingConversation,
        messages,
        isLoading,
        error,
        hasMoreMessages,
        handleConversationSelect,
        handleSendMessage,
        handleMarkAsRead,
        loadMessages,
    };
}
