import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';

const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

interface WebSocketMessage {
  type: string;
  data?: unknown;
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setWsConnected = useStore((state) => state.setWsConnected);
  const setAgentStatus = useStore((state) => state.setAgentStatus);

  const connect = useCallback(() => {
    // Get WebSocket URL from server
    fetch('/api/gateway/ws-url')
      .then((res) => res.json())
      .then(({ url }) => {
        if (!url) {
          console.log('No gateway WebSocket URL configured');
          return;
        }

        try {
          wsRef.current = new WebSocket(url);

          wsRef.current.onopen = () => {
            console.log('WebSocket connected to gateway');
            setWsConnected(true);
            reconnectAttemptsRef.current = 0;
          };

          wsRef.current.onmessage = (event) => {
            try {
              const message: WebSocketMessage = JSON.parse(event.data);
              handleMessage(message);
            } catch {
              console.error('Failed to parse WebSocket message');
            }
          };

          wsRef.current.onclose = () => {
            console.log('WebSocket disconnected');
            setWsConnected(false);
            attemptReconnect();
          };

          wsRef.current.onerror = (error) => {
            console.error('WebSocket error:', error);
          };
        } catch (err) {
          console.error('Failed to create WebSocket:', err);
        }
      })
      .catch((err) => {
        console.log('Could not get gateway WebSocket URL:', err);
      });
  }, [setWsConnected]);

  const handleMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'agent_status':
        if (message.data && typeof message.data === 'object' && 'agentId' in message.data) {
          setAgentStatus(
            (message.data as { agentId: string }).agentId,
            message.data as Parameters<typeof setAgentStatus>[1]
          );
        }
        break;
      case 'task_update':
        // Handled by file watcher / polling
        break;
      default:
        console.log('Unknown WebSocket message type:', message.type);
    }
  }, [setAgentStatus]);

  const attemptReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.log('Max reconnection attempts reached');
      return;
    }

    reconnectAttemptsRef.current++;
    console.log(`Attempting reconnect (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, RECONNECT_DELAY);
  }, [connect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { sendMessage, disconnect };
}
