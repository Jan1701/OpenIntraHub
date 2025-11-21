// =====================================================
// Socket.io Client Service für Real-time Chat
// =====================================================

import { io } from 'socket.io-client';

class SocketService {
    constructor() {
        this.socket = null;
        this.listeners = new Map();
        this.connected = false;
    }

    /**
     * Connect to Socket.io Server
     */
    connect(token) {
        if (this.socket && this.connected) {
            console.log('Socket already connected');
            return;
        }

        const SOCKET_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

        this.socket = io(`${SOCKET_URL}/chat`, {
            auth: {
                token: token
            },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        // Connection events
        this.socket.on('connect', () => {
            console.log('✅ Socket.io connected:', this.socket.id);
            this.connected = true;
            this.emit('socket:connected', { socketId: this.socket.id });
        });

        this.socket.on('disconnect', (reason) => {
            console.log('❌ Socket.io disconnected:', reason);
            this.connected = false;
            this.emit('socket:disconnected', { reason });
        });

        this.socket.on('connect_error', (error) => {
            console.error('Socket.io connection error:', error);
            this.emit('socket:error', { error: error.message });
        });

        // Chat events
        this.socket.on('message:new', (data) => {
            console.log('📨 New message:', data);
            this.emit('message:new', data);
        });

        this.socket.on('message:edited', (data) => {
            console.log('✏️ Message edited:', data);
            this.emit('message:edited', data);
        });

        this.socket.on('message:deleted', (data) => {
            console.log('🗑️ Message deleted:', data);
            this.emit('message:deleted', data);
        });

        this.socket.on('message:reaction', (data) => {
            console.log('👍 Message reaction:', data);
            this.emit('message:reaction', data);
        });

        // Typing indicators
        this.socket.on('typing:user', (data) => {
            this.emit('typing:user', data);
        });

        // Read receipts
        this.socket.on('conversation:read', (data) => {
            console.log('✅ Conversation read:', data);
            this.emit('conversation:read', data);
        });

        // Online status
        this.socket.on('user:online', (data) => {
            console.log('🟢 User online:', data);
            this.emit('user:online', data);
        });

        this.socket.on('user:offline', (data) => {
            console.log('⚪ User offline:', data);
            this.emit('user:offline', data);
        });

        // Conversation events
        this.socket.on('conversation:created', (data) => {
            console.log('📁 Conversation created:', data);
            this.emit('conversation:created', data);
        });

        this.socket.on('conversation:updated', (data) => {
            console.log('📝 Conversation updated:', data);
            this.emit('conversation:updated', data);
        });
    }

    /**
     * Disconnect from Socket.io Server
     */
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.connected = false;
            this.listeners.clear();
        }
    }

    /**
     * Check if connected
     */
    isConnected() {
        return this.connected && this.socket?.connected;
    }

    /**
     * Send message
     */
    sendMessage(conversationId, messageData) {
        if (!this.isConnected()) {
            console.error('Socket not connected');
            return;
        }

        this.socket.emit('message:send', {
            conversation_id: conversationId,
            ...messageData
        });
    }

    /**
     * Edit message
     */
    editMessage(messageId, newText) {
        if (!this.isConnected()) {
            console.error('Socket not connected');
            return;
        }

        this.socket.emit('message:edit', {
            message_id: messageId,
            message_text: newText
        });
    }

    /**
     * Delete message
     */
    deleteMessage(messageId) {
        if (!this.isConnected()) {
            console.error('Socket not connected');
            return;
        }

        this.socket.emit('message:delete', {
            message_id: messageId
        });
    }

    /**
     * Send typing indicator
     */
    startTyping(conversationId) {
        if (!this.isConnected()) return;

        this.socket.emit('typing:start', {
            conversation_id: conversationId
        });
    }

    /**
     * Stop typing indicator
     */
    stopTyping(conversationId) {
        if (!this.isConnected()) return;

        this.socket.emit('typing:stop', {
            conversation_id: conversationId
        });
    }

    /**
     * Mark conversation as read
     */
    markConversationRead(conversationId, lastMessageId) {
        if (!this.isConnected()) return;

        this.socket.emit('conversation:read', {
            conversation_id: conversationId,
            last_message_id: lastMessageId
        });
    }

    /**
     * Join conversation room
     */
    joinConversation(conversationId) {
        if (!this.isConnected()) return;

        this.socket.emit('conversation:join', {
            conversation_id: conversationId
        });
    }

    /**
     * Leave conversation room
     */
    leaveConversation(conversationId) {
        if (!this.isConnected()) return;

        this.socket.emit('conversation:leave', {
            conversation_id: conversationId
        });
    }

    /**
     * Subscribe to events (internal event emitter)
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);

        // Return unsubscribe function
        return () => {
            const callbacks = this.listeners.get(event);
            if (callbacks) {
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
            }
        };
    }

    /**
     * Emit internal event to listeners
     */
    emit(event, data) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in socket event listener (${event}):`, error);
                }
            });
        }
    }
}

// Singleton instance
const socketService = new SocketService();

export default socketService;
