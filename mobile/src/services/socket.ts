import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:3000';
const TOKEN_KEY = 'auth_token';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();

  async connect(): Promise<void> {
    if (this.socket?.connected) {
      return;
    }

    const token = await SecureStore.getItemAsync(TOKEN_KEY);

    if (!token) {
      console.warn('No auth token available for socket connection');
      return;
    }

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.emit('user:online');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    // Re-register listeners
    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach((callback) => {
        this.socket?.on(event, callback);
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.emit('user:offline');
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit(event: string, ...args: unknown[]): void {
    if (this.socket?.connected) {
      this.socket.emit(event, ...args);
    }
  }

  on(event: string, callback: (...args: unknown[]) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    if (this.socket) {
      this.socket.on(event, callback);
    }

    // Return unsubscribe function
    return () => {
      this.off(event, callback);
    };
  }

  off(event: string, callback: (...args: unknown[]) => void): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    }

    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  // Chat-specific methods
  joinConversation(conversationId: string): void {
    this.emit('chat:join', conversationId);
  }

  leaveConversation(conversationId: string): void {
    this.emit('chat:leave', conversationId);
  }

  sendMessage(conversationId: string, content: string, attachments?: string[]): void {
    this.emit('chat:message', { conversationId, content, attachments });
  }

  startTyping(conversationId: string): void {
    this.emit('chat:typing:start', conversationId);
  }

  stopTyping(conversationId: string): void {
    this.emit('chat:typing:stop', conversationId);
  }

  // User status methods
  updateStatus(status: string): void {
    this.emit('user:status', status);
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();
export default socketService;
