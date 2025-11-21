// =====================================================
// Mail View - Read Individual Message
// =====================================================

import React from 'react';

function MailView({ message, onClose, onMarkAsRead, onDelete, onReply }) {
    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleString('de-DE', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const parseRecipients = (recipients) => {
        try {
            if (typeof recipients === 'string') {
                return JSON.parse(recipients);
            }
            return recipients || [];
        } catch {
            return [];
        }
    };

    const toRecipients = parseRecipients(message.to_recipients);
    const ccRecipients = parseRecipients(message.cc_recipients);

    return (
        <div className="h-screen flex flex-col bg-white">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between mb-4">
                    <button
                        onClick={onClose}
                        className="flex items-center text-blue-600 hover:text-blue-800 transition"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Zurück
                    </button>

                    <div className="flex items-center space-x-2">
                        {/* Mark as Unread */}
                        {message.is_read && (
                            <button
                                onClick={() => onMarkAsRead(false)}
                                className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                                title="Als ungelesen markieren"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </button>
                        )}

                        {/* Reply */}
                        <button
                            onClick={onReply}
                            className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                            title="Antworten"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                        </button>

                        {/* Delete */}
                        <button
                            onClick={() => {
                                if (window.confirm('Diese Nachricht wirklich löschen?')) {
                                    onDelete();
                                }
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Löschen"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Subject */}
                <h1 className="text-2xl font-bold text-gray-900 mb-4">
                    {message.subject || '(Kein Betreff)'}
                </h1>

                {/* From */}
                <div className="flex items-start space-x-3 mb-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                        {(message.from_name || message.from_email).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="font-semibold text-gray-900">
                                    {message.from_name || message.from_email}
                                </div>
                                <div className="text-sm text-gray-600">
                                    {message.from_email}
                                </div>
                            </div>
                            <div className="text-sm text-gray-500">
                                {formatDate(message.received_at)}
                            </div>
                        </div>

                        {/* To/Cc Recipients */}
                        <div className="mt-2 text-sm text-gray-600">
                            <div>
                                <span className="font-medium">An: </span>
                                {toRecipients.length > 0 ? (
                                    toRecipients.map((r, i) => (
                                        <span key={i}>
                                            {r.name || r.email}
                                            {i < toRecipients.length - 1 && ', '}
                                        </span>
                                    ))
                                ) : (
                                    <span>(Keine Empfänger)</span>
                                )}
                            </div>
                            {ccRecipients.length > 0 && (
                                <div className="mt-1">
                                    <span className="font-medium">Cc: </span>
                                    {ccRecipients.map((r, i) => (
                                        <span key={i}>
                                            {r.name || r.email}
                                            {i < ccRecipients.length - 1 && ', '}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Importance Indicator */}
                {message.importance === 'High' && (
                    <div className="inline-flex items-center px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Wichtig
                    </div>
                )}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl">
                    {/* Attachments */}
                    {message.has_attachments && message.attachments && message.attachments.length > 0 && (
                        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                </svg>
                                {message.attachments.length} Anhang{message.attachments.length !== 1 ? 'e' : ''}
                            </h3>
                            <div className="space-y-2">
                                {message.attachments.map((attachment, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-white rounded border border-gray-200">
                                        <div className="flex items-center">
                                            <svg className="w-8 h-8 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                            </svg>
                                            <div>
                                                <div className="font-medium text-gray-900">{attachment.name}</div>
                                                <div className="text-sm text-gray-500">
                                                    {attachment.size_bytes ? `${Math.round(attachment.size_bytes / 1024)} KB` : 'Größe unbekannt'}
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            disabled
                                            className="px-3 py-1 text-sm text-gray-500 bg-gray-100 rounded hover:bg-gray-200 transition disabled:opacity-50"
                                        >
                                            Download
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Message Body */}
                    <div className="prose max-w-none">
                        {message.body_html ? (
                            <div dangerouslySetInnerHTML={{ __html: message.body_html }} />
                        ) : (
                            <div className="whitespace-pre-wrap text-gray-800">
                                {message.body_text || message.body_preview || '(Keine Nachricht)'}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default MailView;
