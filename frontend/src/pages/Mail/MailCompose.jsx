// =====================================================
// Mail Compose - Write New Email
// =====================================================

import React, { useState } from 'react';
import api from '../../services/api';

function MailCompose({ onClose, onSent, replyTo = null }) {
    const [to, setTo] = useState(replyTo?.from_email ? [replyTo.from_email] : []);
    const [cc, setCc] = useState([]);
    const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject}` : '');
    const [body, setBody] = useState('');
    const [importance, setImportance] = useState('Normal');
    const [sending, setSending] = useState(false);
    const [showCc, setShowCc] = useState(false);
    const [toInput, setToInput] = useState('');
    const [ccInput, setCcInput] = useState('');

    const handleAddRecipient = (email, type) => {
        if (!email.trim()) return;

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            alert('Ungültige E-Mail-Adresse');
            return;
        }

        if (type === 'to') {
            if (!to.includes(email.trim())) {
                setTo([...to, email.trim()]);
            }
            setToInput('');
        } else {
            if (!cc.includes(email.trim())) {
                setCc([...cc, email.trim()]);
            }
            setCcInput('');
        }
    };

    const handleRemoveRecipient = (email, type) => {
        if (type === 'to') {
            setTo(to.filter(e => e !== email));
        } else {
            setCc(cc.filter(e => e !== email));
        }
    };

    const handleKeyDown = (e, type) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const input = type === 'to' ? toInput : ccInput;
            handleAddRecipient(input, type);
        } else if (e.key === 'Backspace' && !e.target.value) {
            if (type === 'to' && to.length > 0) {
                setTo(to.slice(0, -1));
            } else if (type === 'cc' && cc.length > 0) {
                setCc(cc.slice(0, -1));
            }
        }
    };

    const handleSend = async () => {
        // Validation
        if (to.length === 0) {
            alert('Bitte mindestens einen Empfänger angeben');
            return;
        }

        if (!subject.trim()) {
            if (!window.confirm('E-Mail ohne Betreff senden?')) {
                return;
            }
        }

        try {
            setSending(true);

            await api.post('/mail/send', {
                to,
                cc: cc.length > 0 ? cc : undefined,
                subject: subject.trim() || '(Kein Betreff)',
                body,
                isHtml: false,
                importance
            });

            onSent();
        } catch (error) {
            console.error('Error sending mail:', error);
            alert('Fehler beim Senden der E-Mail: ' + (error.response?.data?.error || error.message));
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="h-screen flex flex-col bg-white">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Neue Nachricht</h2>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 transition"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto">
                <div className="p-6 space-y-4">
                    {/* To Field */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">An</label>
                        <div className="flex flex-wrap gap-2 p-2 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
                            {to.map(email => (
                                <span key={email} className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                                    {email}
                                    <button
                                        onClick={() => handleRemoveRecipient(email, 'to')}
                                        className="ml-2 text-blue-600 hover:text-blue-800"
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                            <input
                                type="email"
                                value={toInput}
                                onChange={(e) => setToInput(e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, 'to')}
                                onBlur={() => handleAddRecipient(toInput, 'to')}
                                placeholder={to.length === 0 ? 'E-Mail-Adresse eingeben und Enter drücken' : ''}
                                className="flex-1 min-w-[200px] border-0 outline-none p-1"
                            />
                        </div>
                    </div>

                    {/* CC Toggle */}
                    {!showCc && (
                        <button
                            onClick={() => setShowCc(true)}
                            className="text-sm text-blue-600 hover:text-blue-800"
                        >
                            + Cc hinzufügen
                        </button>
                    )}

                    {/* CC Field */}
                    {showCc && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Cc</label>
                            <div className="flex flex-wrap gap-2 p-2 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
                                {cc.map(email => (
                                    <span key={email} className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">
                                        {email}
                                        <button
                                            onClick={() => handleRemoveRecipient(email, 'cc')}
                                            className="ml-2 text-gray-600 hover:text-gray-800"
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                                <input
                                    type="email"
                                    value={ccInput}
                                    onChange={(e) => setCcInput(e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(e, 'cc')}
                                    onBlur={() => handleAddRecipient(ccInput, 'cc')}
                                    placeholder={cc.length === 0 ? 'E-Mail-Adresse eingeben' : ''}
                                    className="flex-1 min-w-[200px] border-0 outline-none p-1"
                                />
                            </div>
                        </div>
                    )}

                    {/* Subject */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Betreff</label>
                        <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Betreff"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Importance */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Wichtigkeit</label>
                        <select
                            value={importance}
                            onChange={(e) => setImportance(e.target.value)}
                            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="Low">Niedrig</option>
                            <option value="Normal">Normal</option>
                            <option value="High">Hoch</option>
                        </select>
                    </div>

                    {/* Body */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nachricht</label>
                        <textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            placeholder="Ihre Nachricht..."
                            rows={15}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        />
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition"
                    disabled={sending}
                >
                    Abbrechen
                </button>

                <button
                    onClick={handleSend}
                    disabled={sending || to.length === 0}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                    {sending ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Wird gesendet...
                        </>
                    ) : (
                        <>
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                            Senden
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

export default MailCompose;
