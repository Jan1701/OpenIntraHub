// =====================================================
// Mail Inbox - Exchange Mail Client
// =====================================================

import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import MailCompose from './MailCompose';
import MailView from './MailView';

function MailInbox() {
    const [folders, setFolders] = useState([]);
    const [messages, setMessages] = useState([]);
    const [selectedFolder, setSelectedFolder] = useState(null);
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [showCompose, setShowCompose] = useState(false);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState('all'); // 'all', 'unread'

    useEffect(() => {
        loadFolders();
        loadMessages();
    }, []);

    useEffect(() => {
        if (selectedFolder) {
            loadMessages();
        }
    }, [selectedFolder, filter]);

    const loadFolders = async () => {
        try {
            const response = await api.get('/mail/folders');
            setFolders(response.data.data);
        } catch (error) {
            console.error('Error loading folders:', error);
        }
    };

    const loadMessages = async () => {
        try {
            setLoading(true);
            const params = {
                folder_id: selectedFolder?.id || undefined,
                unread: filter === 'unread' ? 'true' : undefined,
                search: searchQuery || undefined,
                limit: 100
            };

            const response = await api.get('/mail/messages', { params });
            setMessages(response.data.data);
        } catch (error) {
            console.error('Error loading messages:', error);
        } finally {
            setLoading(false);
        }
    };

    const syncFolders = async () => {
        try {
            setSyncing(true);
            await api.post('/mail/folders/sync');
            await loadFolders();
            alert('Ordner synchronisiert');
        } catch (error) {
            console.error('Error syncing folders:', error);
            alert('Fehler beim Synchronisieren der Ordner');
        } finally {
            setSyncing(false);
        }
    };

    const syncMessages = async () => {
        try {
            setSyncing(true);
            await api.post('/mail/messages/sync', {
                folder_id: selectedFolder?.id || null
            });
            await loadMessages();
            alert('Nachrichten synchronisiert');
        } catch (error) {
            console.error('Error syncing messages:', error);
            alert('Fehler beim Synchronisieren der Nachrichten');
        } finally {
            setSyncing(false);
        }
    };

    const handleMarkAsRead = async (messageId, isRead) => {
        try {
            await api.put(`/mail/messages/${messageId}/read`, { is_read: isRead });

            // Update local state
            setMessages(messages.map(msg =>
                msg.id === messageId ? { ...msg, is_read: isRead } : msg
            ));

            if (selectedMessage?.id === messageId) {
                setSelectedMessage({ ...selectedMessage, is_read: isRead });
            }
        } catch (error) {
            console.error('Error marking message:', error);
        }
    };

    const handleDelete = async (messageId) => {
        if (!window.confirm('Diese Nachricht wirklich löschen?')) return;

        try {
            await api.delete(`/mail/messages/${messageId}`);

            // Update local state
            setMessages(messages.filter(msg => msg.id !== messageId));
            if (selectedMessage?.id === messageId) {
                setSelectedMessage(null);
            }
        } catch (error) {
            console.error('Error deleting message:', error);
            alert('Fehler beim Löschen');
        }
    };

    const handleSelectMessage = async (message) => {
        try {
            const response = await api.get(`/mail/messages/${message.id}`);
            const fullMessage = response.data.data;
            setSelectedMessage(fullMessage);

            // Mark as read if unread
            if (!message.is_read) {
                handleMarkAsRead(message.id, true);
            }
        } catch (error) {
            console.error('Error loading message:', error);
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
        return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
    };

    const filteredMessages = searchQuery
        ? messages.filter(msg =>
            msg.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            msg.from_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            msg.from_email?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : messages;

    if (showCompose) {
        return (
            <MailCompose
                onClose={() => setShowCompose(false)}
                onSent={() => {
                    setShowCompose(false);
                    alert('E-Mail gesendet');
                }}
            />
        );
    }

    if (selectedMessage) {
        return (
            <MailView
                message={selectedMessage}
                onClose={() => setSelectedMessage(null)}
                onMarkAsRead={(isRead) => handleMarkAsRead(selectedMessage.id, isRead)}
                onDelete={() => handleDelete(selectedMessage.id)}
                onReply={() => {
                    // TODO: Implement reply
                    alert('Antworten wird noch implementiert');
                }}
            />
        );
    }

    return (
        <div className="h-screen flex bg-gray-100">
            {/* Sidebar - Folders */}
            <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-200">
                    <button
                        onClick={() => setShowCompose(true)}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Neue E-Mail
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <div className="p-2">
                        <button
                            onClick={() => setSelectedFolder(null)}
                            className={`w-full text-left px-3 py-2 rounded-lg transition ${
                                !selectedFolder ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'
                            }`}
                        >
                            <div className="flex items-center">
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                </svg>
                                Alle Nachrichten
                            </div>
                        </button>

                        {folders.map(folder => (
                            <button
                                key={folder.id}
                                onClick={() => setSelectedFolder(folder)}
                                className={`w-full text-left px-3 py-2 rounded-lg transition mt-1 ${
                                    selectedFolder?.id === folder.id ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-sm">{folder.folder_name}</span>
                                    {folder.unread_count > 0 && (
                                        <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                                            {folder.unread_count}
                                        </span>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-4 border-t border-gray-200">
                    <button
                        onClick={syncFolders}
                        disabled={syncing}
                        className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
                    >
                        {syncing ? 'Synchronisiere...' : 'Ordner synchronisieren'}
                    </button>
                </div>
            </div>

            {/* Main Content - Message List */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <div className="bg-white border-b border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-2xl font-bold text-gray-900">
                            {selectedFolder ? selectedFolder.folder_name : 'Alle Nachrichten'}
                        </h1>
                        <button
                            onClick={syncMessages}
                            disabled={syncing}
                            className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition disabled:opacity-50 flex items-center"
                        >
                            <svg className={`w-5 h-5 mr-2 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Aktualisieren
                        </button>
                    </div>

                    {/* Search and Filter */}
                    <div className="flex gap-3">
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                placeholder="E-Mails durchsuchen..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>

                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="all">Alle</option>
                            <option value="unread">Ungelesen</option>
                        </select>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto bg-white">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-gray-600">Lädt...</div>
                        </div>
                    ) : filteredMessages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64">
                            <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <p className="text-gray-600">Keine E-Mails gefunden</p>
                            <button
                                onClick={syncMessages}
                                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                Nachrichten synchronisieren
                            </button>
                        </div>
                    ) : (
                        filteredMessages.map(message => (
                            <div
                                key={message.id}
                                onClick={() => handleSelectMessage(message)}
                                className={`border-b border-gray-200 p-4 hover:bg-gray-50 cursor-pointer transition ${
                                    !message.is_read ? 'bg-blue-50' : ''
                                }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center mb-1">
                                            <span className={`font-semibold truncate ${
                                                !message.is_read ? 'text-gray-900' : 'text-gray-700'
                                            }`}>
                                                {message.from_name || message.from_email}
                                            </span>
                                            {message.has_attachments && (
                                                <svg className="w-4 h-4 ml-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                                </svg>
                                            )}
                                        </div>
                                        <p className={`text-sm truncate ${
                                            !message.is_read ? 'font-semibold text-gray-900' : 'text-gray-700'
                                        }`}>
                                            {message.subject || '(Kein Betreff)'}
                                        </p>
                                        <p className="text-sm text-gray-500 truncate mt-1">
                                            {message.body_preview}
                                        </p>
                                    </div>
                                    <div className="ml-4 text-xs text-gray-500 flex-shrink-0">
                                        {getTimeAgo(message.received_at)}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

export default MailInbox;
