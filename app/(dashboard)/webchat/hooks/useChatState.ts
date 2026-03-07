import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import useStoreChat, { convertToUIMessage, SendMessageParams, ShopeeMessage, SSEMessageData } from '@/stores/useStoreChat';
import { UIMessage } from '@/types/shopeeMessage';
import { Conversation, Order } from '../_types';

export function useChatState() {
    // State dari useStoreChat
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

    // State lokal untuk UI
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
    const [processedSSEMessages] = useState<Set<string>>(new Set());

    // Gunakan allConversations untuk mendapatkan data percakapan yang dipilih
    const selectedConversationData = useMemo(() =>
        conversations.find(conv => conv.conversation_id === selectedConversation),
        [conversations, selectedConversation]
    );

    // Fungsi untuk menandai pesan sebagai dibaca
    const handleMarkAsRead = useCallback(async (conversationId: string) => {
        const conversation = conversations.find(conv => conv.conversation_id === conversationId);
        if (!conversation || conversation.unread_count === 0) return;

        try {
            await markAsReadStore(conversationId);
        } catch (error) {
            console.error('Gagal menandai pesan sebagai dibaca:', error);
        }
    }, [conversations, markAsReadStore]);

    // Effect untuk auto mark as read
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

    // Fungsi untuk mengirim pesan
    const handleSendMessage = async (message: string) => {
        if (!selectedConversationData || !message.trim() || !selectedConversation || !selectedShop) return;

        try {
            setIsSendingMessage(true);

            const params = {
                conversationId: selectedConversation,
                content: message,
                toId: selectedConversationData.to_id,
                shopId: selectedShop
            };

            console.log('[handleSendMessage] Sending with params:', params);
            const messageId = await sendMessageStore(params);

            console.log('[handleSendMessage] Message sent, updating UI');

            // Update conversation untuk menandai sudah dibalas
            updateConversation(selectedConversation, {
                unread_count: 0,
                latest_message_content: { text: message },
                latest_message_from_id: selectedShop,
                last_message_timestamp: Date.now()
            });

            // Tambahkan pesan baru ke state lokal
            const newMessage: UIMessage = {
                id: messageId || Date.now().toString(),
                sender: 'seller',
                content: message,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                type: 'text',
            };

            setMessages(prev => [...prev, newMessage]);

            // Scroll ke pesan terbaru
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

    // Fungsi untuk memilih percakapan
    const handleConversationSelect = useCallback(async (conversation: Conversation) => {
        console.log('[handleConversationSelect] Starting:', {
            newConversation: conversation,
            currentSelectedConversation: selectedConversation
        });

        // Jika percakapan yang dipilih sama dengan yang sebelumnya, hanya ubah tampilan
        if (conversation.conversation_id === selectedConversation) {
            console.log('[handleConversationSelect] Same conversation selected');
            if (isMobileView) {
                setShowConversationList(false);
                setIsFullScreenChat(true);
            }
            return;
        }

        // Tampilkan loading terlebih dahulu
        setIsLoadingConversation(true);
        setError(null);

        // Reset state dan set new conversation atomically
        const newConversationId = conversation.conversation_id;
        const newShopId = conversation.shop_id;

        console.log('[handleConversationSelect] Setting new conversation:', {
            newConversationId,
            newShopId
        });

        // Reset state sebelum fetch
        setMessages([]);
        setSelectedShop(newShopId);
        setSelectedConversation(newConversationId);
        setShouldFetchOrders(true);

        // Update mobile view
        if (isMobileView) {
            setShowConversationList(false);
            setIsFullScreenChat(true);
        }

        try {
            console.log('[handleConversationSelect] Fetching messages directly');

            // Langsung panggil fetchMessagesStore dan capture hasil
            const fetchedMessages = await fetchMessagesStore(newConversationId);

            console.log('[handleConversationSelect] Messages fetched:', {
                messageCount: fetchedMessages?.length || 0
            });

            // Konversi pesan ke format UIMessage menggunakan convertToUIMessage dari store
            const uiMessages = fetchedMessages?.map(msg =>
                convertToUIMessage(msg as ShopeeMessage, newShopId)
            ) || [];

            setMessages(uiMessages);
            setHasMoreMessages(fetchedMessages?.length === 25);
            console.log('[handleConversationSelect] UI updated with messages:', {
                uiMessagesCount: uiMessages.length
            });
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
        convertToUIMessage
    ]);

    // Fungsi untuk memuat pesan - gunakan untuk refresh saja, bukan initial load
    const loadMessages = useCallback(async () => {
        if (!selectedConversation || !selectedShop) return;

        const conversationId = selectedConversation;
        const shopId = selectedShop;

        console.log('[loadMessages] Starting refresh messages:', {
            conversationId,
            shopId
        });

        try {
            setIsLoading(true);
            const fetchedMessages = await fetchMessagesStore(conversationId);

            // Pastikan conversation masih sama setelah fetch
            if (selectedConversation !== conversationId) {
                console.log('[loadMessages] Conversation changed during fetch, aborting');
                return;
            }

            console.log('[loadMessages] Processing messages:', {
                messageCount: fetchedMessages?.length || 0
            });

            // Konversi pesan ke format UIMessage menggunakan convertToUIMessage dari store
            const uiMessages = fetchedMessages?.map(msg =>
                convertToUIMessage(msg as ShopeeMessage, shopId)
            ) || [];

            // Pastikan conversation masih sama sebelum update UI
            if (selectedConversation === conversationId) {
                setMessages(uiMessages);
                setHasMoreMessages(fetchedMessages?.length === 25);
                console.log('[loadMessages] UI refreshed with messages:', {
                    uiMessagesCount: uiMessages.length
                });
            }
        } catch (err) {
            console.error('[loadMessages] Error:', err);
            if (selectedConversation === conversationId) {
                setError(err instanceof Error ? err.message : 'Gagal memuat pesan');
            }
        } finally {
            if (selectedConversation === conversationId) {
                setIsLoading(false);
            }
        }
    }, [selectedConversation, selectedShop, fetchMessagesStore, convertToUIMessage]);

    // Effect untuk loading state
    useEffect(() => {
        if (selectedConversation && ((messages.length > 0 && !isLoading) || error)) {
            setIsLoadingConversation(false);
        }
    }, [messages.length, isLoading, error, selectedConversation]);

    // Effect untuk scroll ke pesan baru
    useEffect(() => {
        if (messages.length > 0 && !isLoading && messagesEndRef.current) {
            const timer = setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100);

            return () => clearTimeout(timer);
        }
    }, [messages.length, isLoading]);

    // Tambahkan fungsi untuk mengambil data pesanan
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

    // Pisahkan effect untuk initial fetch dan mark as read
    useEffect(() => {
        if (selectedConversationData?.to_id && shouldFetchOrders) {
            fetchOrders(selectedConversationData.to_id.toString());
            setShouldFetchOrders(false);
        }
    }, [selectedConversationData?.to_id, shouldFetchOrders, fetchOrders]);

    // Effect untuk menangani URL params
    useEffect(() => {
        const handleUrlParams = async () => {
            if (urlProcessed) return;

            const urlParams = new URLSearchParams(window.location.search);
            const userId = urlParams.get('user_id');
            const orderSn = urlParams.get('order_sn');
            const shopId = urlParams.get('shop_id');

            if (!userId) return;

            // Cari conversation yang sesuai
            const targetConversation = conversations.find(
                conv => conv.to_id.toString() === userId &&
                    (!shopId || conv.shop_id.toString() === shopId)
            );

            if (targetConversation) {
                handleConversationSelect(targetConversation);
                setUrlProcessed(true);
            } else if (orderSn && shopId) {
                try {
                    await initializeConversation({
                        userId,
                        shopId,
                        orderSn
                    });

                    setTimeout(() => {
                        const newConversation = conversations.find(
                            conv => conv.to_id.toString() === userId &&
                                conv.shop_id.toString() === shopId
                        );

                        if (newConversation) {
                            handleConversationSelect(newConversation);
                        }
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

    // Effect untuk resize handler
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

    // Effect untuk scroll ke pesan baru (ketika messages berubah)
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    // Pantau lastMessage dari SSE untuk update realtime
    useEffect(() => {
        if (!lastMessage?.message_id || !selectedConversation) return;
        if (lastMessage.conversation_id !== selectedConversation) return;
        if (processedSSEMessages.has(lastMessage.message_id)) return;

        console.log('[WebChat] Menerima pesan baru dari SSE:', {
            id: lastMessage.message_id,
            type: lastMessage.message_type,
            sender: lastMessage.sender,
            conversation: lastMessage.conversation_id
        });

        processedSSEMessages.add(lastMessage.message_id);

        if (!selectedShop) return;

        const newShopeeMessage: ShopeeMessage = {
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

        const newUIMessage = convertToUIMessage(newShopeeMessage, selectedShop);
        const messageExists = messages.some(msg => msg.id === lastMessage.message_id);

        if (!messageExists) {
            setMessages(prev => [...prev, newUIMessage]);

            if (newShopeeMessage.from_id === selectedConversationData?.to_id) {
                if (selectedConversationData) {
                    updateConversation(selectedConversation, {
                        unread_count: selectedConversationData.unread_count + 1
                    });
                }
            }

            setTimeout(() => {
                if (messagesEndRef.current) {
                    messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
                }
            }, 100);

            console.log('[WebChat] Pesan baru berhasil ditambahkan ke state lokal');
        }
    }, [lastMessage, selectedConversation, processedSSEMessages, selectedShop, messages, selectedConversationData, updateConversation]);

    return {
        // From store
        conversations,
        isStoreLoading,
        // Local state
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
        // Handlers
        handleConversationSelect,
        handleSendMessage,
        handleMarkAsRead,
        loadMessages,
    };
}
