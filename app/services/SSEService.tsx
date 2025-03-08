// app/services/SSEService.tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react';

interface SSEContextType {
  connectionId: string | null;
  isConnected: boolean;
  lastMessage: any | null;
}

const SSEContext = createContext<SSEContextType | null>(null);

class SSEService {
  private static instance: SSEService;
  private eventSource: EventSource | null = null;
  
  private constructor() {}

  static getInstance() {
    if (!SSEService.instance) {
      SSEService.instance = new SSEService();
    }
    return SSEService.instance;
  }

  connect() {
    if (this.eventSource) return;

    try {
      const url = new URL('/api/webhook', window.location.origin);
      this.eventSource = new EventSource(url.toString());
      
      return this.eventSource;
    } catch (err) {
      console.error('Error initializing SSE:', err);
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

  useEffect(() => {
    const sseService = SSEService.getInstance();
    const eventSource = sseService.connect();

    if (eventSource) {
      eventSource.onopen = () => {
        console.log('SSE terhubung');
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
          console.error('Error parsing SSE message:', err);
        }
      };

      eventSource.onerror = () => {
        console.error('SSE connection error');
        setIsConnected(false);
        sseService.disconnect();
        
        // Reconnect setelah 5 detik
        setTimeout(() => {
          sseService.connect();
        }, 5000);
      };
    }

    return () => {
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