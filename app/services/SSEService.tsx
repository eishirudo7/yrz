// app/services/SSEService.tsx
'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react';

interface SSEContextType {
  connectionId: string | null;
  isConnected: boolean;
  lastMessage: any | null;
}

const SSEContext = createContext<SSEContextType | null>(null);

// FIX #4: Pisahkan EventSource management dari Singleton agar reconnect bersih
// tanpa risiko double EventSource berjalan bersamaan
function createEventSource(url: string): EventSource {
  return new EventSource(url);
}

export function SSEProvider({ children }: { children: React.ReactNode }) {
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    function cleanup() {
      // FIX #4: Tutup koneksi lama dengan benar sebelum membuat yang baru
      if (eventSourceRef.current) {
        // Hanya close jika belum closed, hindari double-close
        if (eventSourceRef.current.readyState !== EventSource.CLOSED) {
          eventSourceRef.current.close();
        }
        eventSourceRef.current = null;
      }
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    }

    function setupConnection() {
      if (!isMounted.current) return;

      cleanup(); // Bersihkan koneksi lama dulu

      try {
        const url = new URL('/api/notifications/sse', window.location.origin);
        const es = createEventSource(url.toString());
        eventSourceRef.current = es;

        es.onopen = () => {
          if (!isMounted.current) return;
          setIsConnected(true);
        };

        es.onmessage = (event) => {
          if (!isMounted.current) return;
          try {
            const data = JSON.parse(event.data);

            // Skip heartbeat — tidak perlu diproses lebih lanjut
            if (data.type === 'heartbeat') return;

            setLastMessage(data);

            if (data.type === 'connection_established') {
              setConnectionId(data.connectionId || data.user_id || null);
            }

            window.dispatchEvent(
              new CustomEvent('sse-message', { detail: data })
            );
          } catch (err) {
            console.warn('[SSE] Error parsing message:', err);
          }
        };

        es.onerror = () => {
          if (!isMounted.current) return;
          console.warn('[SSE] Koneksi terputus, reconnect dalam 5 detik...');
          setIsConnected(false);

          // FIX #4: cleanup dulu sebelum set timer,
          // hindari timer lama bersaing dengan timer baru
          cleanup();

          reconnectTimer.current = setTimeout(() => {
            if (isMounted.current) {
              setupConnection();
            }
          }, 5000);
        };
      } catch (err) {
        console.warn('[SSE] Error membuat EventSource:', err);
        reconnectTimer.current = setTimeout(() => {
          if (isMounted.current) setupConnection();
        }, 5000);
      }
    }

    setupConnection();

    return () => {
      isMounted.current = false;
      cleanup();
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