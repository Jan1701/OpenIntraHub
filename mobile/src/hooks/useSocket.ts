import { useEffect, useRef, useCallback } from 'react';
import { socketService } from '@/services/socket';
import { useAuthStore } from '@/stores/authStore';

interface UseSocketOptions {
  autoConnect?: boolean;
}

export function useSocket(options: UseSocketOptions = {}) {
  const { autoConnect = true } = options;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const connectedRef = useRef(false);

  useEffect(() => {
    if (autoConnect && isAuthenticated && !connectedRef.current) {
      socketService.connect();
      connectedRef.current = true;
    }

    return () => {
      if (connectedRef.current) {
        socketService.disconnect();
        connectedRef.current = false;
      }
    };
  }, [autoConnect, isAuthenticated]);

  const on = useCallback((event: string, callback: (...args: unknown[]) => void) => {
    return socketService.on(event, callback);
  }, []);

  const emit = useCallback((event: string, ...args: unknown[]) => {
    socketService.emit(event, ...args);
  }, []);

  const connect = useCallback(() => {
    socketService.connect();
    connectedRef.current = true;
  }, []);

  const disconnect = useCallback(() => {
    socketService.disconnect();
    connectedRef.current = false;
  }, []);

  return {
    on,
    emit,
    connect,
    disconnect,
    isConnected: socketService.isConnected,
  };
}

export default useSocket;
