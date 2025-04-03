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
  
  private constructor() {
    console.log('SSEService instance created');
  }

  static getInstance() {
    if (!SSEService.instance) {
      console.log('Creating new SSEService instance');
      SSEService.instance = new SSEService();
    }
    return SSEService.instance;
  }

  connect() {
    if (this.eventSource) {
      console.log('EventSource already exists, not creating a new one');
      return this.eventSource;
    }

    try {
      console.log('Attempting to create new EventSource');
      const url = new URL('/api/notifications/sse', window.location.origin);
      console.log('SSE URL:', url.toString());
      
      this.eventSource = new EventSource(url.toString());
      console.log('EventSource created:', this.eventSource);
      
      return this.eventSource;
    } catch (err) {
      console.error('Error initializing SSE:', err);
      return null;
    }
  }

  disconnect() {
    if (this.eventSource) {
      console.log('Disconnecting EventSource');
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
    console.log('SSEProvider mounted, setting up EventSource');
    const sseService = SSEService.getInstance();
    const eventSource = sseService.connect();

    if (eventSource) {
      eventSource.onopen = () => {
        console.log('SSE connection open event fired');
        setIsConnected(true);
      };

      eventSource.onmessage = (event) => {
        console.log('Received SSE message:', event.data);
        try {
          const data = JSON.parse(event.data);
          console.log('Parsed SSE data:', data);
          setLastMessage(data);
          
          if (data.type === 'connection_established') {
            console.log('Connection established with ID:', data.connectionId);
            setConnectionId(data.connectionId);
          }
          
          window.dispatchEvent(
            new CustomEvent('sse-message', { detail: data })
          );
        } catch (err) {
          console.error('Error parsing SSE message:', err);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        setIsConnected(false);
        sseService.disconnect();
        
        // Reconnect setelah 5 detik
        console.log('Scheduling reconnection attempt in 5 seconds');
        setTimeout(() => {
          console.log('Attempting to reconnect SSE');
          sseService.connect();
        }, 5000);
      };
    } else {
      console.error('Failed to create EventSource');
    }

    return () => {
      console.log('SSEProvider unmounting, disconnecting EventSource');
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