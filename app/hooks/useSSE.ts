import { useState, useEffect, useCallback } from 'react';

interface SSEData {
  type: 'new_message' | 'connection_established' | 'heartbeat' | 'mark_as_read';
  timestamp: number;
  message?: string;
  conversation_id?: string;
  sender?: number;
  content?: string;
  message_id?: string;
  [key: string]: any;
}

export function useSSE(url: string) {
  const [data, setData] = useState<SSEData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    console.log('Mencoba membuat koneksi SSE ke:', url);
    
    const eventSource = new EventSource(url, {
      withCredentials: false
    });

    eventSource.onopen = () => {
      console.log('SSE Connection opened');
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      console.log('Raw SSE message received:', event);
      try {
        const parsedData = JSON.parse(event.data) as SSEData;
        console.log('Parsed SSE data:', parsedData);
        
        // Validasi tipe data yang diterima
        if (!parsedData.type || !parsedData.timestamp) {
          throw new Error('Invalid SSE data format');
        }

        setData(parsedData);
      } catch (err) {
        console.error('Error parsing SSE data:', err);
        setError('Gagal memparse data');
      }
    };

    eventSource.onerror = (event: Event) => {
      console.error('SSE connection error detail:', {
        event,
        readyState: eventSource.readyState,
        url: eventSource.url
      });
      
      setIsConnected(false);
      setError('Koneksi SSE terputus');
      
      eventSource.close();
      
      const reconnectTimeout = setTimeout(() => {
        console.log('Mencoba reconnect...');
        new EventSource(url, { withCredentials: false });
      }, 5000);

      return () => clearTimeout(reconnectTimeout);
    };

    return () => {
      console.log('Cleaning up SSE connection');
      eventSource.close();
      setIsConnected(false);
    };
  }, [url]);

  const reconnect = useCallback(() => {
    console.log('Manual reconnect triggered');
    setError(null);
    new EventSource(url, { withCredentials: false });
  }, [url]);

  return { 
    data, 
    error, 
    isConnected,
    reconnect
  };
}
