import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
// FIX #9: convertToUIMessage diimport sebagai fungsi biasa (pure function, tidak pernah berubah)
// Tidak perlu masuk ke dependency array useCallback
import useStoreChat from '@/stores/useStoreChat';
import { UIMessage, convertToUIMessage, ShopeeMessage } from '@/types/shopeeMessage';
import { Conversation, Order, SelectedMedia } from '../_types';

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

    const uploadSingleMedia = async (media: SelectedMedia, shopId: number, conversationId: string, toId: number) => {
        try {
            const formData = new FormData();
            formData.append('file', media.file);
            formData.append('shopId', shopId.toString());

            const endpoint = media.type === 'video' ? '/api/msg/upload_video' : '/api/msg/upload_image';

            const res = await fetch(endpoint, {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();

            if (!data.success) {
                throw new Error(`Upload gagal: ${data.error}`);
            }

            let finalContent: any = {};
            if (media.type === 'video') {
                let isVideoReady = false;
                let videoData = null;
                let attempts = 0;
                const maxAttempts = 60; // 60 * 2s = 120s max timeout

                while (!isVideoReady && attempts < maxAttempts) {
                    try {
                        const pollRes = await fetch(`/api/msg/video_upload_result?vid=${data.vid}&shopId=${shopId}`);
                        const pollData = await pollRes.json();

                        if (pollData.success && pollData.data) {
                            if (pollData.data.status === 'successful') {
                                isVideoReady = true;
                                videoData = pollData.data;
                            } else if (pollData.data.status === 'failed' || pollData.data.error) {
                                throw new Error(pollData.data.message || pollData.data.error || 'Video upload failed processing');
                            }
                        }
                    } catch (pollErr) {
                        console.error('Polling error:', pollErr);
                    }

                    if (!isVideoReady) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        attempts++;
                    }
                }

                if (!isVideoReady || !videoData) {
                    throw new Error('Waktu pemrosesan video habis atau gagal.');
                }

                finalContent = {
                    vid: data.vid,
                    video_url: videoData.video,
                    thumb_url: videoData.thumbnail,
                    thumb_width: videoData.width,
                    thumb_height: videoData.height,
                    duration_seconds: videoData.duration ? Math.floor(videoData.duration / 1000) : 0
                };
            } else {
                finalContent = { image_url: data.url };
            }

            // Send actual message to Shopee
            const params = {
                conversationId,
                content: finalContent,
                toId,
                shopId,
                messageType: media.type,
            };

            const realMessageId = await sendMessageStore(params as any);

            // Perbarui pesan optimistic di UI local
            setMessages(prev => prev.map(msg => {
                if (msg.id === media.id) {
                    return {
                        ...msg,
                        id: realMessageId || msg.id,
                        status: 'success',
                        ...(media.type === 'video' && {
                            videoUrl: finalContent.video_url.startsWith('http') ? finalContent.video_url : `https://down-tx-sg.vod.susercontent.com/${finalContent.video_url}`,
                            imageThumb: {
                                url: finalContent.thumb_url.startsWith('http') ? finalContent.thumb_url : `https://down-tx-sg.vod.susercontent.com/${finalContent.thumb_url}`,
                                width: finalContent.thumb_width,
                                height: finalContent.thumb_height
                            },
                            videoDuration: finalContent.duration_seconds
                        }),
                        ...(media.type === 'image' && {
                            imageUrl: finalContent.image_url
                        })
                    } as UIMessage;
                }
                return msg;
            }));

        } catch (error) {
            console.error('[uploadSingleMedia] Error:', error);
            // Update UI ke error state
            setMessages(prev => prev.map(msg => msg.id === media.id ? { ...msg, status: 'error' } : msg));
            toast.error(`Gagal mengirim media ${media.file.name}`);
        }
    };

    const handleSendMessage = async (
        message: string,
        type: string = 'text',
        content?: Record<string, any>,
        mediaFiles?: SelectedMedia[]
    ) => {
        if (!selectedConversationData || !selectedConversation || !selectedShop) return;
        if (type === 'text' && !message.trim() && (!mediaFiles || mediaFiles.length === 0)) return;

        // Background media upload processing without blocking input UI
        if (mediaFiles && mediaFiles.length > 0) {
            const tempMessages = mediaFiles.map(m => ({
                id: m.id,
                sender: 'seller',
                content: '',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                type: m.type,
                status: 'sending',
                file: m.file,
                localFileUrl: m.preview,
                imageUrl: m.type === 'image' ? m.preview : undefined,
                videoUrl: m.type === 'video' ? m.preview : undefined,
                imageThumb: m.type === 'video' ? { url: m.preview, width: 480, height: 848 } : undefined
            } as UIMessage));

            setMessages(prev => [...prev, ...tempMessages]);
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100);

            // Execute asynchronous uploads
            for (const media of mediaFiles) {
                uploadSingleMedia(media, selectedShop, selectedConversation, selectedConversationData.to_id);
            }
        }

        // Send Text Message if present
        if (type === 'text' && message.trim()) {
            try {
                setIsSendingMessage(true);
                const params = {
                    conversationId: selectedConversation,
                    content: message,
                    toId: selectedConversationData.to_id,
                    shopId: selectedShop,
                    messageType: 'text',
                };

                const messageId = await sendMessageStore(params as any);

                // Tambahkan pesan ke UI lokal (optimistic update)
                const newMessage: UIMessage = {
                    id: messageId || Date.now().toString(),
                    sender: 'seller',
                    content: message,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    type: 'text',
                    status: 'success'
                };
                setMessages(prev => [...prev, newMessage]);

                setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                }, 100);

            } catch (error) {
                console.error('[handleSendMessage Text] Error:', error);
                toast.error('Gagal mengirim teks.');
            } finally {
                setIsSendingMessage(false);
            }
        }

        // Send Sticker Message
        if (type === 'sticker' && content?.sticker_id && content?.sticker_package_id) {
            try {
                setIsSendingMessage(true);
                const params = {
                    conversationId: selectedConversation,
                    content: {
                        sticker_id: content.sticker_id,
                        sticker_package_id: content.sticker_package_id,
                    },
                    toId: selectedConversationData.to_id,
                    shopId: selectedShop,
                    messageType: 'sticker',
                };

                const messageId = await sendMessageStore(params as any);

                const newMessage: UIMessage = {
                    id: messageId || Date.now().toString(),
                    sender: 'seller',
                    content: 'Stiker',
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    type: 'sticker',
                    stickerData: {
                        stickerId: content.sticker_id,
                        packageId: content.sticker_package_id,
                    },
                    status: 'success'
                };
                setMessages(prev => [...prev, newMessage]);

                setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                }, 100);

            } catch (error) {
                console.error('[handleSendMessage Sticker] Error:', error);
                toast.error('Gagal mengirim stiker.');
            } finally {
                setIsSendingMessage(false);
            }
        }

        // Send Item (Product) Message
        if (type === 'item' && content?.item_id) {
            try {
                setIsSendingMessage(true);
                const params = {
                    conversationId: selectedConversation,
                    content: { item_id: content.item_id },
                    toId: selectedConversationData.to_id,
                    shopId: selectedShop,
                    messageType: 'item',
                };

                const messageId = await sendMessageStore(params as any);

                const newMessage: UIMessage = {
                    id: messageId || Date.now().toString(),
                    sender: 'seller',
                    content: 'Produk',
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    type: 'item',
                    itemData: { itemId: content.item_id, shopId: selectedShop },
                    status: 'success'
                };
                setMessages(prev => [...prev, newMessage]);

                setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                }, 100);

            } catch (error) {
                console.error('[handleSendMessage Item] Error:', error);
                toast.error('Gagal mengirim produk.');
            } finally {
                setIsSendingMessage(false);
            }
        }

        // Send Order Message
        if (type === 'order' && content?.order_sn) {
            try {
                setIsSendingMessage(true);
                const params = {
                    conversationId: selectedConversation,
                    content: { order_sn: content.order_sn },
                    toId: selectedConversationData.to_id,
                    shopId: selectedShop,
                    messageType: 'order',
                };

                const messageId = await sendMessageStore(params as any);

                const newMessage: UIMessage = {
                    id: messageId || Date.now().toString(),
                    sender: 'seller',
                    content: 'Pesanan',
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    type: 'order',
                    orderData: { orderSn: content.order_sn, shopId: selectedShop },
                    status: 'success'
                };
                setMessages(prev => [...prev, newMessage]);

                setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                }, 100);

            } catch (error) {
                console.error('[handleSendMessage Order] Error:', error);
                toast.error('Gagal mengirim pesanan.');
            } finally {
                setIsSendingMessage(false);
            }
        }
    };

    const handleRetryMedia = useCallback((messageId: string) => {
        const targetMsg = messages.find(m => m.id === messageId);
        if (!targetMsg || !targetMsg.file || !targetMsg.localFileUrl || !selectedShop || !selectedConversation || !selectedConversationData) return;

        setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, status: 'sending' } : msg));

        const mediaToRetry: SelectedMedia = {
            id: targetMsg.id,
            file: targetMsg.file,
            preview: targetMsg.localFileUrl,
            type: targetMsg.type as 'image' | 'video'
        };

        uploadSingleMedia(mediaToRetry, selectedShop, selectedConversation, selectedConversationData.to_id);
    }, [messages, selectedShop, selectedConversation, selectedConversationData]);

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
        handleRetryMedia,
    };
}
