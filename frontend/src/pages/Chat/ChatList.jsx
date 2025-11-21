// =====================================================
// ChatList - Conversation List
// =====================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useSocket, useOnlineStatus } from '../../hooks/useSocket';
import { useUserStatus } from '../../hooks/useUserStatus';
import UserStatusBadge from '../../components/UserStatusBadge';

function ChatList({ selectedConversationId, onSelectConversation }) {
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [users, setUsers] = useState([]);
    const navigate = useNavigate();

    const { connected, socket } = useSocket();
    const { isUserOnline } = useOnlineStatus();

    // Get all participant IDs for status tracking
    const participantIds = useMemo(() => {
        return conversations
            .filter(c => c.type === 'direct' && c.participant_id)
            .map(c => c.participant_id);
    }, [conversations]);

    const { statuses, getUserStatus } = useUserStatus(participantIds);

    // Load conversations
    useEffect(() => {
        loadConversations();
    }, []);

    // Listen for new messages to update conversation list
    useEffect(() => {
        if (!socket) return;

        const unsubscribe = socket.on('message:new', (data) => {
            // Update conversation's last message
            setConversations(prev => prev.map(conv => {
                if (conv.id === data.conversation_id) {
                    return {
                        ...conv,
                        last_message: data.message.message_text,
                        last_message_at: data.message.created_at,
                        unread_count: conv.id === selectedConversationId ? 0 : (conv.unread_count || 0) + 1
                    };
                }
                return conv;
            }));

            // Move conversation to top
            setConversations(prev => {
                const updated = [...prev];
                const index = updated.findIndex(c => c.id === data.conversation_id);
                if (index > 0) {
                    const [conv] = updated.splice(index, 1);
                    updated.unshift(conv);
                }
                return updated;
            });
        });

        return unsubscribe;
    }, [socket, selectedConversationId]);

    const loadConversations = async () => {
        try {
            setLoading(true);
            const response = await api.get('/chat/conversations');
            setConversations(response.data.data);
        } catch (error) {
            console.error('Error loading conversations:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadUsers = async () => {
        try {
            const response = await api.get('/users');
            setUsers(response.data.data);
        } catch (error) {
            console.error('Error loading users:', error);
        }
    };

    const handleStartDirectChat = async (userId) => {
        try {
            const response = await api.post('/chat/conversations/direct', {
                participant_id: userId
            });
            const conversation = response.data.data;

            setShowNewChatModal(false);
            onSelectConversation(conversation.id);

            // Add to list if not exists
            if (!conversations.some(c => c.id === conversation.id)) {
                setConversations([conversation, ...conversations]);
            }
        } catch (error) {
            console.error('Error starting chat:', error);
        }
    };

    const getTimeAgo = (dateString) => {
        if (!dateString) return '';

        const now = new Date();
        const date = new Date(dateString);
        const seconds = Math.floor((now - date) / 1000);

        if (seconds < 60) return 'Gerade eben';
        if (seconds < 3600) return `Vor ${Math.floor(seconds / 60)} Min`;
        if (seconds < 86400) return `Vor ${Math.floor(seconds / 3600)} Std`;
        if (seconds < 604800) return `Vor ${Math.floor(seconds / 86400)} Tagen`;
        return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    };

    const getConversationName = (conversation) => {
        if (conversation.type === 'group') {
            return conversation.name || 'Gruppe';
        }
        return conversation.participant_name || 'Unbekannt';
    };

    const getConversationAvatar = (conversation) => {
        if (conversation.type === 'group') {
            return conversation.avatar_url || null;
        }
        return conversation.participant_avatar || null;
    };

    const filteredConversations = conversations.filter(conv =>
        getConversationName(conv).toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="h-full flex flex-col bg-white border-r border-gray-200">
            {/* Header */}
            <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900">Chat</h2>
                    <button
                        onClick={() => {
                            setShowNewChatModal(true);
                            loadUsers();
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Neuer Chat"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    </button>
                </div>

                {/* Search */}
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Chats durchsuchen..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                    />
                    <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>

                {/* Connection Status */}
                {!connected && (
                    <div className="mt-2 px-3 py-2 bg-yellow-50 text-yellow-800 text-xs rounded-lg flex items-center">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Verbindung wird hergestellt...
                    </div>
                )}
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex items-center justify-center h-32">
                        <div className="text-gray-600">Lädt...</div>
                    </div>
                ) : filteredConversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 px-4 text-center">
                        <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <p className="text-gray-600 text-sm">
                            {searchQuery ? 'Keine Chats gefunden' : 'Noch keine Chats'}
                        </p>
                        {!searchQuery && (
                            <button
                                onClick={() => {
                                    setShowNewChatModal(true);
                                    loadUsers();
                                }}
                                className="mt-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                                Neuen Chat starten
                            </button>
                        )}
                    </div>
                ) : (
                    filteredConversations.map(conversation => {
                        const isSelected = conversation.id === selectedConversationId;
                        const avatarUrl = getConversationAvatar(conversation);
                        const isOnline = conversation.type === 'direct' && isUserOnline(conversation.participant_id);

                        return (
                            <div
                                key={conversation.id}
                                onClick={() => onSelectConversation(conversation.id)}
                                className={`flex items-start p-4 cursor-pointer hover:bg-gray-50 transition border-b border-gray-100 ${
                                    isSelected ? 'bg-blue-50' : ''
                                }`}
                            >
                                {/* Avatar */}
                                <div className="relative flex-shrink-0">
                                    {avatarUrl ? (
                                        <img
                                            src={avatarUrl}
                                            alt={getConversationName(conversation)}
                                            className="w-12 h-12 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center">
                                            <span className="text-gray-600 font-semibold text-lg">
                                                {getConversationName(conversation).charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                    )}
                                    {/* Status indicator */}
                                    {conversation.type === 'direct' && conversation.participant_id && (
                                        <UserStatusBadge
                                            status={getUserStatus(conversation.participant_id)?.status || 'offline'}
                                            size="sm"
                                            className="absolute bottom-0 right-0"
                                        />
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 ml-3 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <h3 className={`text-sm font-semibold truncate ${
                                            conversation.unread_count > 0 ? 'text-gray-900' : 'text-gray-700'
                                        }`}>
                                            {getConversationName(conversation)}
                                        </h3>
                                        <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                                            {getTimeAgo(conversation.last_message_at)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className={`text-sm truncate ${
                                            conversation.unread_count > 0 ? 'font-medium text-gray-900' : 'text-gray-500'
                                        }`}>
                                            {conversation.last_message || 'Keine Nachrichten'}
                                        </p>
                                        {conversation.unread_count > 0 && (
                                            <span className="ml-2 px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded-full flex-shrink-0">
                                                {conversation.unread_count > 9 ? '9+' : conversation.unread_count}
                                            </span>
                                        )}
                                    </div>
                                    {/* Show status message or OOF message */}
                                    {conversation.type === 'direct' && conversation.participant_id && (() => {
                                        const status = getUserStatus(conversation.participant_id);
                                        if (status?.status === 'oof' && status.oof_enabled) {
                                            return (
                                                <div className="mt-1 flex items-center text-xs text-purple-600">
                                                    <span className="mr-1">🏖️</span>
                                                    <span className="truncate">Abwesend bis {status.oof_end_time ? new Date(status.oof_end_time).toLocaleDateString('de-DE') : 'auf Weiteres'}</span>
                                                </div>
                                            );
                                        } else if (status?.status_message) {
                                            return (
                                                <div className="mt-1 text-xs text-gray-500 truncate">
                                                    {status.status_message}
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* New Chat Modal */}
            {showNewChatModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
                        <div className="flex items-center justify-between p-4 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900">Neuer Chat</h3>
                            <button
                                onClick={() => setShowNewChatModal(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="max-h-96 overflow-y-auto p-4">
                            {users.length === 0 ? (
                                <div className="text-center text-gray-600 py-8">
                                    Lädt Benutzer...
                                </div>
                            ) : (
                                users.map(user => {
                                    const userStatus = getUserStatus(user.id);
                                    return (
                                        <div
                                            key={user.id}
                                            onClick={() => handleStartDirectChat(user.id)}
                                            className="flex items-center p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition"
                                        >
                                            <div className="relative flex-shrink-0">
                                                {user.avatar_url ? (
                                                    <img
                                                        src={user.avatar_url}
                                                        alt={user.display_name || user.username}
                                                        className="w-10 h-10 rounded-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                                                        <span className="text-gray-600 font-semibold">
                                                            {(user.display_name || user.username).charAt(0).toUpperCase()}
                                                        </span>
                                                    </div>
                                                )}
                                                <UserStatusBadge
                                                    status={userStatus?.status || 'offline'}
                                                    size="sm"
                                                    className="absolute bottom-0 right-0"
                                                />
                                            </div>
                                            <div className="ml-3 flex-1 min-w-0">
                                                <div className="text-sm font-semibold text-gray-900 flex items-center">
                                                    {user.display_name || user.username}
                                                    {userStatus?.status && (
                                                        <span className="ml-2 text-xs text-gray-500">
                                                            {userStatus.status === 'available' && '(Verfügbar)'}
                                                            {userStatus.status === 'away' && '(Abwesend)'}
                                                            {userStatus.status === 'busy' && '(Beschäftigt)'}
                                                            {userStatus.status === 'dnd' && '(Nicht stören)'}
                                                            {userStatus.status === 'oof' && '(Abwesend)'}
                                                        </span>
                                                    )}
                                                </div>
                                                {userStatus?.status_message ? (
                                                    <div className="text-xs text-gray-600 truncate">{userStatus.status_message}</div>
                                                ) : user.email ? (
                                                    <div className="text-xs text-gray-500 truncate">{user.email}</div>
                                                ) : null}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ChatList;
