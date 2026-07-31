import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { ClientMessage, ServerMessage } from '@gif-game/shared';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface WebSocketContextValue {
  /** Current connection status */
  status: ConnectionStatus;
  /** Send a message to the server */
  send: (message: ClientMessage) => void;
  /** Subscribe to messages of a specific type */
  subscribe: <T extends ServerMessage['type']>(
    type: T,
    handler: (message: Extract<ServerMessage, { type: T }>) => void
  ) => () => void;
  /** Last error message, if any */
  error: string | null;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

interface WebSocketProviderProps {
  children: ReactNode;
  /** Access token for authentication */
  accessToken: string;
  /** Discord instance ID */
  instanceId: string;
  /** WebSocket URL (defaults to ws://host/ws) */
  url?: string;
}

// Reconnection backoff config
const MIN_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const BACKOFF_MULTIPLIER = 2;

// Global WebSocket state - survives React StrictMode remounts
let globalWs: WebSocket | null = null;
let globalWsUrl: string | null = null;
let globalHandlers = new Map<string, Set<(msg: ServerMessage) => void>>();
let globalStatusListeners = new Set<(status: ConnectionStatus, error: string | null) => void>();
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = MIN_RECONNECT_DELAY;

function notifyStatusListeners(status: ConnectionStatus, error: string | null = null) {
  globalStatusListeners.forEach(listener => listener(status, error));
}

function clearReconnectTimeout() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
}

function connectWebSocket(wsUrl: string, accessToken: string, instanceId: string) {
  // If already connected to the same URL, don't reconnect
  if (globalWs && globalWs.readyState === WebSocket.OPEN && globalWsUrl === wsUrl) {
    console.log('[WebSocket] Already connected');
    return;
  }

  // Close existing connection if URL changed or not open
  if (globalWs) {
    globalWs.close();
    globalWs = null;
  }

  globalWsUrl = wsUrl;
  notifyStatusListeners('connecting');

  console.log(`[WebSocket] Connecting to ${wsUrl}`);
  const ws = new WebSocket(wsUrl);
  globalWs = ws;

  ws.onopen = () => {
    if (globalWs !== ws) return; // Stale connection

    console.log('[WebSocket] Connected, sending join message');

    const joinMessage: ClientMessage = {
      type: 'join',
      token: accessToken,
      instanceId,
    };
    ws.send(JSON.stringify(joinMessage));

    reconnectDelay = MIN_RECONNECT_DELAY;
    notifyStatusListeners('connected');
  };

  ws.onmessage = (event) => {
    if (globalWs !== ws) return;

    try {
      const message = JSON.parse(event.data) as ServerMessage;
      console.log('[WebSocket] Received:', message.type);

      if (message.type === 'error') {
        console.error('[WebSocket] Server error:', message.code, message.message);
        notifyStatusListeners('connected', `${message.code}: ${message.message}`);
      }

      const handlers = globalHandlers.get(message.type);
      if (handlers) {
        handlers.forEach((handler) => {
          try {
            handler(message);
          } catch (err) {
            console.error('[WebSocket] Handler error:', err);
          }
        });
      }
    } catch (err) {
      console.error('[WebSocket] Failed to parse message:', err);
    }
  };

  ws.onerror = (event) => {
    console.error('[WebSocket] Error:', event);
  };

  ws.onclose = (event) => {
    console.log(`[WebSocket] Closed: code=${event.code}, reason=${event.reason}`);
    
    if (globalWs !== ws) return; // Stale connection
    globalWs = null;

    // Don't reconnect on auth failure
    if (event.code === 4002) {
      notifyStatusListeners('disconnected', 'Authentication failed');
      return;
    }

    // Schedule reconnect
    notifyStatusListeners('reconnecting');
    clearReconnectTimeout();
    
    console.log(`[WebSocket] Scheduling reconnect in ${reconnectDelay}ms`);
    reconnectTimeout = setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * BACKOFF_MULTIPLIER, MAX_RECONNECT_DELAY);
      connectWebSocket(wsUrl, accessToken, instanceId);
    }, reconnectDelay);
  };
}

function sendMessage(message: ClientMessage) {
  console.log('[WebSocket] send() called, ws exists:', !!globalWs, 'readyState:', globalWs?.readyState);
  if (!globalWs || globalWs.readyState !== WebSocket.OPEN) {
    console.warn('[WebSocket] Cannot send, not connected');
    return;
  }
  console.log('[WebSocket] Sending:', message.type);
  globalWs.send(JSON.stringify(message));
}

function subscribeToMessage<T extends ServerMessage['type']>(
  type: T,
  handler: (message: Extract<ServerMessage, { type: T }>) => void
): () => void {
  if (!globalHandlers.has(type)) {
    globalHandlers.set(type, new Set());
  }
  const handlers = globalHandlers.get(type)!;
  const wrappedHandler = handler as (msg: ServerMessage) => void;
  handlers.add(wrappedHandler);

  return () => {
    handlers.delete(wrappedHandler);
    if (handlers.size === 0) {
      globalHandlers.delete(type);
    }
  };
}

export function WebSocketProvider({
  children,
  accessToken,
  instanceId,
  url,
}: WebSocketProviderProps) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);

  // Build WebSocket URL
  const wsUrl = url ?? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

  useEffect(() => {
    console.log('[WebSocket] Provider mounted, URL:', wsUrl);

    // Register status listener
    const statusListener = (newStatus: ConnectionStatus, newError: string | null) => {
      setStatus(newStatus);
      setError(newError);
    };
    globalStatusListeners.add(statusListener);

    // Connect (will be a no-op if already connected)
    connectWebSocket(wsUrl, accessToken, instanceId);

    return () => {
      console.log('[WebSocket] Provider unmounting');
      globalStatusListeners.delete(statusListener);
      
      // Only cleanup if no more listeners (all providers unmounted)
      if (globalStatusListeners.size === 0) {
        console.log('[WebSocket] Last provider unmounted, cleaning up');
        clearReconnectTimeout();
        if (globalWs) {
          globalWs.close(1000, 'All providers unmounted');
          globalWs = null;
        }
      }
    };
  }, [wsUrl, accessToken, instanceId]);

  // Stable send function
  const send = useCallback((message: ClientMessage) => {
    sendMessage(message);
  }, []);

  // Stable subscribe function
  const subscribe = useCallback(<T extends ServerMessage['type']>(
    type: T,
    handler: (message: Extract<ServerMessage, { type: T }>) => void
  ): (() => void) => {
    return subscribeToMessage(type, handler);
  }, []);

  const contextValue: WebSocketContextValue = {
    status,
    send,
    subscribe,
    error,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}

/**
 * Hook to access WebSocket context.
 */
export function useWebSocket(): WebSocketContextValue {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}

/**
 * Hook to send messages via WebSocket.
 */
export function useSend(): (message: ClientMessage) => void {
  const { send } = useWebSocket();
  return send;
}

/**
 * Hook to subscribe to a specific message type.
 */
export function useSubscription<T extends ServerMessage['type']>(
  type: T,
  handler: (message: Extract<ServerMessage, { type: T }>) => void
): void {
  const { subscribe } = useWebSocket();

  useEffect(() => {
    return subscribe(type, handler);
  }, [subscribe, type, handler]);
}
