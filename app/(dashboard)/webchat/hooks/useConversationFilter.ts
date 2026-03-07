import { useState, useMemo, useCallback } from 'react';
import { Conversation } from '../_types';

export type StatusFilter = 'SEMUA' | 'BELUM DIBACA' | 'BELUM DIBALAS';

export function useConversationFilter(conversations: Conversation[]) {
    const [selectedShops, setSelectedShops] = useState<number[]>([]);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('SEMUA');
    const [searchInput, setSearchInput] = useState('');

    // Format uniqueShops untuk UI
    const formattedUniqueShops = useMemo(() => {
        const uniqueShopIds = Array.from(new Set(conversations.map(conv => conv.shop_id)));
        return uniqueShopIds.map(shopId => {
            const shopData = conversations.find(conv => conv.shop_id === shopId);
            return {
                id: shopId,
                name: shopData?.shop_name || `Toko ${shopId}`
            };
        });
    }, [conversations]);

    // Fungsi untuk memfilter percakapan
    const filteredConversations = useMemo(() => {
        const filtered = conversations.filter(conv => {
            // Filter berdasarkan toko yang dipilih
            if (selectedShops.length > 0 && !selectedShops.includes(conv.shop_id)) {
                return false;
            }

            // Filter berdasarkan status
            if (statusFilter === 'BELUM DIBACA' && conv.unread_count === 0) {
                return false;
            }

            // Filter Belum Dibalas: pesan terakhir dari pembeli
            if (statusFilter === 'BELUM DIBALAS') {
                if (conv.latest_message_from_id !== conv.to_id) {
                    return false;
                }
            }

            // Filter berdasarkan pencarian
            if (searchInput) {
                const searchTerm = searchInput.toLowerCase();
                return (
                    conv.to_name.toLowerCase().includes(searchTerm) ||
                    conv.shop_name.toLowerCase().includes(searchTerm) ||
                    (conv.latest_message_content?.text || '').toLowerCase().includes(searchTerm)
                );
            }

            return true;
        });

        return filtered;
    }, [conversations, selectedShops, statusFilter, searchInput]);

    const toggleShop = useCallback((shopId: number) => {
        setSelectedShops(prev =>
            prev.includes(shopId)
                ? prev.filter(id => id !== shopId)
                : [...prev, shopId]
        );
    }, []);

    return {
        selectedShops,
        statusFilter,
        searchInput,
        setSearchInput,
        setStatusFilter,
        toggleShop,
        formattedUniqueShops,
        filteredConversations,
    };
}
