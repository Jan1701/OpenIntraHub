// =====================================================
// ChatWindow - Message Thread mit Composer
// =====================================================

import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { useConversationMessages, useTypingIndicator, useSocket } from '../../hooks/useSocket';

function ChatWindow({ conversationId }) {
    const [conversation, setConversation] = useState(null);
    const [messageText, setMessageText] = useState('');
    const [sending, setSending] = useState(false);
    const [replyTo, setReplyTo] = useState(null);
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

    const { messages, setMessages, loading, setLoading } = useConversationMessages(conversationId);
    const typingUsers = useTypingIndicator(conversationId);
    const { socket } = useSocket();

    // Load conversation details
    useEffect(() => {
        if (!conversationId) return;
        loadConversation();
        loadMessages();
    }, [conversationId]);

    // Scroll to bottom on new messages
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Mark as read when conversation opens or new messages arrive
    useEffect(() => {
        if (!conversationId || messages.length === 0) return;

        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.user_id !== currentUser.id) {
            markAsRead(lastMessage.id);
        }
    }, [conversationId, messages]);

    const loadConversation = async () => {
        try {
            const response = await api.get(`/chat/conversations/${conversationId}`);
            setConversation(response.data.data);
        } catch (error) {
            console.error('Error loading conversation:', error);
        }
    };

    const loadMessages = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/chat/conversations/${conversationId}/messages`, {
                params: { limit: 100 }
            });
            setMessages(response.data.data);
        } catch (error) {
            console.error('Error loading messages:', error);
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (lastMessageId) => {
        try {
            await api.put(`/chat/conversations/${conversationId}/read`, {
                last_message_id: lastMessageId
            });

            // Also send via Socket.io for real-time updates
            if (socket?.isConnected()) {
                socket.markConversationRead(conversationId, lastMessageId);
            }
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();

        if (!messageText.trim() || sending) return;

        const tempMessage = {
            id: Date.now(), // Temporary ID
            conversation_id: conversationId,
            user_id: currentUser.id,
            message_text: messageText,
            message_type: 'text',
            created_at: new Date().toISOString(),
            user: currentUser,
            is_temp: true
        };

        // Optimistic update
        setMessages(prev => [...prev, tempMessage]);
        setMessageText('');
        setReplyTo(null);
        setSending(true);

        // Stop typing indicator
        if (socket?.isConnected()) {
            socket.stopTyping(conversationId);
        }

        try {
            if (socket?.isConnected()) {
                // Send via Socket.io for instant delivery
                socket.sendMessage(conversationId, {
                    message_text: messageText,
                    message_type: 'text',
                    reply_to_message_id: replyTo?.id || null
                });
            } else {
                // Fallback to REST API
                const response = await api.post(`/chat/conversations/${conversationId}/messages`, {
                    message_text: messageText,
                    message_type: 'text',
                    reply_to_message_id: replyTo?.id || null
                });

                // Replace temp message with real one
                setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
            }
        } catch (error) {
            console.error('Error sending message:', error);
            // Remove temp message on error
            setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
            alert('Fehler beim Senden der Nachricht');
        } finally {
            setSending(false);
        }
    };

    const handleTyping = () => {
        if (!socket?.isConnected()) return;

        // Send typing indicator
        socket.startTyping(conversationId);

        // Clear existing timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Stop typing after 2 seconds of inactivity
        typingTimeoutRef.current = setTimeout(() => {
            socket.stopTyping(conversationId);
        }, 2000);
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const getTimeString = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    };

    const getDateString = (dateString) => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Heute';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Gestern';
        } else {
            return date.toLocaleDateString('de-DE', { day: '2-digit', month: 'long' });
        }
    };

    const shouldShowDateDivider = (currentMsg, previousMsg) => {
        if (!previousMsg) return true;

        const currentDate = new Date(currentMsg.created_at).toDateString();
        const previousDate = new Date(previousMsg.created_at).toDateString();

        return currentDate !== previousDate;
    };

    const getConversationName = () => {
        if (!conversation) return '';
        if (conversation.type === 'group') {
            return conversation.name || 'Gruppe';
        }
        return conversation.participant_name || 'Unbekannt';
    };

    if (!conversationId) {
        return (
            <div className="h-full flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Wähle einen Chat aus
                    </h3>
                    <p className="text-gray-600">
                        Wähle eine Konversation aus der Liste oder starte einen neuen Chat
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-white">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        {conversation?.participant_avatar ? (
                            <img
                                src={conversation.participant_avatar}
                                alt={getConversationName()}
                                className="w-10 h-10 rounded-full object-cover"
                            />
                        ) : (
                            <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                                <span className="text-gray-600 font-semibold">
                                    {getConversationName().charAt(0).toUpperCase()}
                                </span>
                            </div>
                        )}
                        <div className="ml-3">
                            <h2 className="text-lg font-semibold text-gray-900">
                                {getConversationName()}
                            </h2>
                            {conversation?.type === 'direct' && conversation.participant_online && (
                                <p className="text-xs text-green-600">Online</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 bg-gray-50">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-gray-600">Lädt Nachrichten...</div>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center text-gray-600">
                            <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            <p>Noch keine Nachrichten</p>
                            <p className="text-sm mt-1">Schreibe die erste Nachricht!</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {messages.map((message, index) => {
                            const isCurrentUser = message.user_id === currentUser.id;
                            const showDate = shouldShowDateDivider(message, messages[index - 1]);

                            return (
                                <React.Fragment key={message.id}>
                                    {/* Date Divider */}
                                    {showDate && (
                                        <div className="flex items-center justify-center my-4">
                                            <div className="px-4 py-1 bg-gray-300 text-gray-700 text-xs font-medium rounded-full">
                                                {getDateString(message.created_at)}
                                            </div>
                                        </div>
                                    )}

                                    {/* Message */}
                                    <div className={`flex mb-4 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`flex max-w-xs lg:max-w-md ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'}`}>
                                            {/* Avatar */}
                                            {!isCurrentUser && (
                                                <div className="flex-shrink-0 mr-2">
                                                    {message.user?.avatar_url ? (
                                                        <img
                                                            src={message.user.avatar_url}
                                                            alt={message.user.display_name || message.user.username}
                                                            className="w-8 h-8 rounded-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                                                            <span className="text-gray-600 text-xs font-semibold">
                                                                {(message.user?.display_name || message.user?.username || '?').charAt(0).toUpperCase()}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Message Bubble */}
                                            <div>
                                                {!isCurrentUser && (
                                                    <div className="text-xs text-gray-600 mb-1 ml-1">
                                                        {message.user?.display_name || message.user?.username}
                                                    </div>
                                                )}
                                                <div
                                                    className={`px-4 py-2 rounded-2xl ${
                                                        isCurrentUser
                                                            ? 'bg-blue-600 text-white'
                                                            : 'bg-white text-gray-900 border border-gray-200'
                                                    } ${message.is_temp ? 'opacity-60' : ''}`}
                                                >
                                                    {message.is_deleted ? (
                                                        <p className="text-sm italic opacity-60">Nachricht gelöscht</p>
                                                    ) : (
                                                        <p className="text-sm whitespace-pre-wrap break-words">
                                                            {message.message_text}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className={`text-xs text-gray-500 mt-1 ${isCurrentUser ? 'text-right mr-1' : 'ml-1'}`}>
                                                    {getTimeString(message.created_at)}
                                                    {message.is_edited && ' (bearbeitet)'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </React.Fragment>
                            );
                        })}

                        {/* Typing Indicator */}
                        {typingUsers.length > 0 && (
                            <div className="flex items-center mb-4">
                                <div className="flex space-x-1 px-4 py-2 bg-gray-300 rounded-full">
                                    <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce"></div>
                                    <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                    <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                </div>
                                <span className="ml-2 text-xs text-gray-600">
                                    {typingUsers[0].username} {typingUsers.length > 1 ? `und ${typingUsers.length - 1} weitere` : ''} schreibt...
                                </span>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Composer */}
            <div className="px-6 py-4 bg-white border-t border-gray-200">
                {replyTo && (
                    <div className="mb-2 px-4 py-2 bg-gray-100 rounded-lg flex items-center justify-between">
                        <div className="flex-1">
                            <div className="text-xs text-gray-600 mb-1">Antwort auf:</div>
                            <div className="text-sm text-gray-900 truncate">{replyTo.message_text}</div>
                        </div>
                        <button
                            onClick={() => setReplyTo(null)}
                            className="ml-2 text-gray-400 hover:text-gray-600"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                )}

                <form onSubmit={handleSendMessage} className="flex items-end space-x-2">
                    <div className="flex-1">
                        <textarea
                            value={messageText}
                            onChange={(e) => {
                                setMessageText(e.target.value);
                                handleTyping();
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage(e);
                                }
                            }}
                            placeholder="Nachricht schreiben..."
                            rows={1}
                            className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                            style={{ minHeight: '48px', maxHeight: '120px' }}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={!messageText.trim() || sending}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    </button>
                </form>
            </div>
        </div>
    );
}

export default ChatWindow;
