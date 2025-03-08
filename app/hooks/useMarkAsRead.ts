import { useState } from 'react';

interface MarkAsReadParams {
  shopId: number;
  conversationId: string;
  lastReadMessageId: string;
}

export function useMarkAsRead() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const markAsRead = async ({ shopId, conversationId, lastReadMessageId }: MarkAsReadParams) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/msg/mark_as_read?shopId=${shopId}&conversationId=${conversationId}&lastReadMessageId=${lastReadMessageId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Gagal menandai pesan sebagai dibaca');
      }

      const data = await response.json();
      setIsLoading(false);
      return data;
    } catch (err) {
      setIsLoading(false);
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat menandai pesan sebagai dibaca');
      throw err;
    }
  };

  return { markAsRead, isLoading, error };
}
