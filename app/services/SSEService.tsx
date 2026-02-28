// app/services/SSEService.tsx
'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react';

interface SSEContextType {
  connectionId: string | null;
  isConnected: boolean;
  lastMessage: any | null;
}

const SSEContext = createContext<SSEContextType | null>(null);

class SSEService {
  private static instance: SSEService;
  private eventSource: EventSource | null = null;

  private constructor() { }

  static getInstance() {
    if (!SSEService.instance) {
      SSEService.instance = new SSEService();
    }
    return SSEService.instance;
  }

  connect() {
    if (this.eventSource) return this.eventSource;

    try {
      const url = new URL('/api/notifications/sse', window.location.origin);
      this.eventSource = new EventSource(url.toString());

      return this.eventSource;
    } catch (err) {
      console.warn('Error initializing SSE:', err);
      return null;
    }
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}

export function SSEProvider({ children }: { children: React.ReactNode }) {
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const sseService = SSEService.getInstance();

    function setupConnection() {
      // Bersihkan koneksi lama dulu
      sseService.disconnect();

      const eventSource = sseService.connect();
      if (!eventSource) return;

      eventSource.onopen = () => {
        setIsConnected(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);

          if (data.type === 'connection_established') {
            setConnectionId(data.connectionId);
          }

          window.dispatchEvent(
            new CustomEvent('sse-message', { detail: data })
          );
        } catch (err) {
          console.warn('Error parsing SSE message:', err);
        }
      };

      eventSource.onerror = () => {
        console.warn('SSE connection lost, reconnecting in 5s...');
        setIsConnected(false);
        sseService.disconnect();

        // Reconnect dengan listeners baru
        reconnectTimer.current = setTimeout(() => {
          setupConnection();
        }, 5000);
      };
    }

    setupConnection();

    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      sseService.disconnect();
      setIsConnected(false);
    };
  }, []);

  return (
    <SSEContext.Provider value={{ connectionId, isConnected, lastMessage }}>
      {children}
    </SSEContext.Provider>
  );
}

export const useSSE = () => {
  const context = useContext(SSEContext);
  if (!context) {
    throw new Error('useSSE harus digunakan dalam SSEProvider');
  }
  return context;
};