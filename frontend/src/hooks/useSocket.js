// =====================================================
// React Hook für Socket.io Integration
// =====================================================

import { useEffect, useState, useCallback, useRef } from 'react';
import socketService from '../services/socket';

/**
 * React Hook für Socket.io Chat
 */
export function useSocket() {
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Get token from localStorage
        const token = localStorage.getItem('token');

        if (token && !socketService.isConnected()) {
            socketService.connect(token);
        }

        // Subscribe to connection events
        const unsubscribeConnected = socketService.on('socket:connected', () => {
            setConnected(true);
            setError(null);
        });

        const unsubscribeDisconnected = socketService.on('socket:disconnected', () => {
            setConnected(false);
        });

        const unsubscribeError = socketService.on('socket:error', (data) => {
            setError(data.error);
            setConnected(false);
        });

        // Initial state
        setConnected(socketService.isConnected());

        return () => {
            unsubscribeConnected();
            unsubscribeDisconnected();
            unsubscribeError();
        };
    }, []);

    return {
        connected,
        error,
        socket: socketService
    };
}

/**
 * Hook für Conversation Messages mit Real-time Updates
 */
export function useConversationMessages(conversationId) {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const { connected } = useSocket();

    const addMessage = useCallback((newMessage) => {
        setMessages(prev => {
            // Avoid duplicates
            if (prev.some(m => m.id === newMessage.id)) {
                return prev;
            }
            return [...prev, newMessage].sort((a, b) =>
                new Date(a.created_at) - new Date(b.created_at)
            );
        });
    }, []);

    const updateMessage = useCallback((messageId, updates) => {
        setMessages(prev => prev.map(m =>
            m.id === messageId ? { ...m, ...updates } : m
        ));
    }, []);

    const removeMessage = useCallback((messageId) => {
        setMessages(prev => prev.filter(m => m.id !== messageId));
    }, []);

    useEffect(() => {
        if (!conversationId) return;

        // Join conversation room
        if (connected) {
            socketService.joinConversation(conversationId);
        }

        // Subscribe to message events
        const unsubscribeNew = socketService.on('message:new', (data) => {
            if (data.conversation_id === conversationId) {
                addMessage(data.message);
            }
        });

        const unsubscribeEdited = socketService.on('message:edited', (data) => {
            if (data.conversation_id === conversationId) {
                updateMessage(data.message_id, {
                    message_text: data.message_text,
                    is_edited: true,
                    edited_at: data.edited_at
                });
            }
        });

        const unsubscribeDeleted = socketService.on('message:deleted', (data) => {
            if (data.conversation_id === conversationId) {
                updateMessage(data.message_id, {
                    is_deleted: true,
                    deleted_at: data.deleted_at
                });
            }
        });

        const unsubscribeReaction = socketService.on('message:reaction', (data) => {
            if (data.conversation_id === conversationId) {
                updateMessage(data.message_id, {
                    reaction_count: data.reaction_count
                });
            }
        });

        return () => {
            unsubscribeNew();
            unsubscribeEdited();
            unsubscribeDeleted();
            unsubscribeReaction();

            // Leave conversation room
            if (connected) {
                socketService.leaveConversation(conversationId);
            }
        };
    }, [conversationId, connected, addMessage, updateMessage, removeMessage]);

    return {
        messages,
        setMessages,
        loading,
        setLoading,
        addMessage,
        updateMessage,
        removeMessage
    };
}

/**
 * Hook für Typing Indicators
 */
export function useTypingIndicator(conversationId) {
    const [typingUsers, setTypingUsers] = useState([]);
    const typingTimeouts = useRef(new Map());

    useEffect(() => {
        if (!conversationId) return;

        const unsubscribe = socketService.on('typing:user', (data) => {
            if (data.conversation_id !== conversationId) return;

            const userId = data.user_id;

            if (data.is_typing) {
                // Add user to typing list
                setTypingUsers(prev => {
                    if (prev.some(u => u.user_id === userId)) {
                        return prev;
                    }
                    return [...prev, { user_id: userId, username: data.username }];
                });

                // Clear existing timeout
                if (typingTimeouts.current.has(userId)) {
                    clearTimeout(typingTimeouts.current.get(userId));
                }

                // Remove after 3 seconds
                const timeout = setTimeout(() => {
                    setTypingUsers(prev => prev.filter(u => u.user_id !== userId));
                    typingTimeouts.current.delete(userId);
                }, 3000);

                typingTimeouts.current.set(userId, timeout);
            } else {
                // Remove user from typing list
                setTypingUsers(prev => prev.filter(u => u.user_id !== userId));
                if (typingTimeouts.current.has(userId)) {
                    clearTimeout(typingTimeouts.current.get(userId));
                    typingTimeouts.current.delete(userId);
                }
            }
        });

        return () => {
            unsubscribe();
            // Clear all timeouts
            typingTimeouts.current.forEach(timeout => clearTimeout(timeout));
            typingTimeouts.current.clear();
        };
    }, [conversationId]);

    return typingUsers;
}

/**
 * Hook für Online Status
 */
export function useOnlineStatus() {
    const [onlineUsers, setOnlineUsers] = useState(new Set());

    useEffect(() => {
        const unsubscribeOnline = socketService.on('user:online', (data) => {
            setOnlineUsers(prev => new Set([...prev, data.user_id]));
        });

        const unsubscribeOffline = socketService.on('user:offline', (data) => {
            setOnlineUsers(prev => {
                const newSet = new Set(prev);
                newSet.delete(data.user_id);
                return newSet;
            });
        });

        return () => {
            unsubscribeOnline();
            unsubscribeOffline();
        };
    }, []);

    const isUserOnline = useCallback((userId) => {
        return onlineUsers.has(userId);
    }, [onlineUsers]);

    return {
        onlineUsers: Array.from(onlineUsers),
        isUserOnline
    };
}
