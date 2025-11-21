// =====================================================
// OOF Settings - Out of Office Management
// =====================================================

import React, { useState, useEffect } from 'react';
import api from '../../services/api';

function OOFSettings() {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form state
    const [enabled, setEnabled] = useState(false);
    const [isScheduled, setIsScheduled] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [startTime, setStartTime] = useState('09:00');
    const [endDate, setEndDate] = useState('');
    const [endTime, setEndTime] = useState('17:00');
    const [internalMessage, setInternalMessage] = useState('');
    const [externalMessage, setExternalMessage] = useState('');

    useEffect(() => {
        loadStatus();
    }, []);

    const loadStatus = async () => {
        try {
            setLoading(true);
            const response = await api.get('/status/me');
            const userStatus = response.data.status;

            setStatus(userStatus);
            setEnabled(userStatus.oof_enabled || false);

            if (userStatus.oof_start_time && userStatus.oof_end_time) {
                setIsScheduled(true);
                const startDT = new Date(userStatus.oof_start_time);
                const endDT = new Date(userStatus.oof_end_time);

                setStartDate(startDT.toISOString().split('T')[0]);
                setStartTime(startDT.toTimeString().substring(0, 5));
                setEndDate(endDT.toISOString().split('T')[0]);
                setEndTime(endDT.toTimeString().substring(0, 5));
            }

            setInternalMessage(userStatus.oof_internal_message || '');
            setExternalMessage(userStatus.oof_external_message || '');
        } catch (error) {
            console.error('Error loading status:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);

            let startDateTime = null;
            let endDateTime = null;

            if (enabled && isScheduled) {
                if (!startDate || !endDate) {
                    alert('Bitte Start- und Enddatum angeben');
                    return;
                }

                startDateTime = new Date(`${startDate}T${startTime}:00`).toISOString();
                endDateTime = new Date(`${endDate}T${endTime}:00`).toISOString();

                // Validation
                if (new Date(endDateTime) <= new Date(startDateTime)) {
                    alert('Endzeitpunkt muss nach Startzeitpunkt liegen');
                    return;
                }
            }

            const oofData = {
                enabled,
                startTime: startDateTime,
                endTime: endDateTime,
                internalMessage: internalMessage.trim(),
                externalMessage: externalMessage.trim()
            };

            await api.post('/status/me/oof', oofData);

            // Reload status to show updated values
            await loadStatus();

            alert('Abwesenheitseinstellungen gespeichert');
        } catch (error) {
            console.error('Error saving OOF settings:', error);
            alert('Fehler beim Speichern: ' + (error.response?.data?.error || error.message));
        } finally {
            setSaving(false);
        }
    };

    const handleDisable = async () => {
        try {
            setSaving(true);
            await api.post('/status/me/oof', { enabled: false });
            await loadStatus();
            setEnabled(false);
            alert('Abwesenheit deaktiviert');
        } catch (error) {
            console.error('Error disabling OOF:', error);
            alert('Fehler beim Deaktivieren');
        } finally {
            setSaving(false);
        }
    };

    const setQuickMessage = (type) => {
        const messages = {
            vacation: {
                internal: 'Ich bin derzeit nicht im Büro und habe keinen Zugriff auf meine E-Mails. Für dringende Angelegenheiten wenden Sie sich bitte an mein Team.',
                external: 'Vielen Dank für Ihre Nachricht. Ich bin derzeit im Urlaub und nicht erreichbar. Ich werde Ihre E-Mail nach meiner Rückkehr bearbeiten.'
            },
            sick: {
                internal: 'Ich bin derzeit krank und nicht im Büro. Für dringende Angelegenheiten kontaktieren Sie bitte mein Team.',
                external: 'Vielen Dank für Ihre Nachricht. Ich bin derzeit nicht im Büro und bearbeite Ihre E-Mail, sobald ich zurück bin.'
            },
            meeting: {
                internal: 'Ich befinde mich in einem Meeting und habe eingeschränkten E-Mail-Zugriff.',
                external: 'Vielen Dank für Ihre Nachricht. Ich befinde mich derzeit in Besprechungen und werde so schnell wie möglich antworten.'
            }
        };

        if (messages[type]) {
            setInternalMessage(messages[type].internal);
            setExternalMessage(messages[type].external);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-600">Lädt...</div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="bg-white rounded-lg shadow">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-2xl font-bold text-gray-900">Abwesenheitseinstellungen</h2>
                    <p className="text-sm text-gray-600 mt-1">
                        Konfigurieren Sie Ihre automatischen Abwesenheitsnachrichten
                    </p>
                </div>

                <div className="p-6 space-y-6">
                    {/* Current Status */}
                    {status && (
                        <div className={`p-4 rounded-lg border-2 ${
                            status.oof_enabled
                                ? 'bg-purple-50 border-purple-200'
                                : 'bg-gray-50 border-gray-200'
                        }`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <span className="text-2xl mr-3">
                                        {status.oof_enabled ? '🏖️' : '✅'}
                                    </span>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">
                                            {status.oof_enabled ? 'Abwesenheit aktiv' : 'Abwesenheit deaktiviert'}
                                        </h3>
                                        {status.oof_enabled && status.oof_start_time && status.oof_end_time && (
                                            <p className="text-sm text-gray-600">
                                                {new Date(status.oof_start_time).toLocaleDateString('de-DE')} bis {new Date(status.oof_end_time).toLocaleDateString('de-DE')}
                                            </p>
                                        )}
                                        {status.synced_to_exchange && (
                                            <p className="text-xs text-green-600 mt-1">
                                                ✓ Mit Exchange synchronisiert
                                            </p>
                                        )}
                                    </div>
                                </div>
                                {status.oof_enabled && (
                                    <button
                                        onClick={handleDisable}
                                        disabled={saving}
                                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                                    >
                                        Jetzt deaktivieren
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Enable/Disable Toggle */}
                    <div>
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={enabled}
                                onChange={(e) => setEnabled(e.target.checked)}
                                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="ml-3 text-gray-900 font-medium">
                                Abwesenheit aktivieren
                            </span>
                        </label>
                    </div>

                    {enabled && (
                        <>
                            {/* Scheduling Options */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-gray-900">Zeitraum</h3>

                                <div>
                                    <label className="flex items-center cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={!isScheduled}
                                            onChange={() => setIsScheduled(false)}
                                            className="w-4 h-4 text-blue-600"
                                        />
                                        <span className="ml-3 text-gray-700">
                                            Sofort bis manuelle Deaktivierung
                                        </span>
                                    </label>
                                </div>

                                <div>
                                    <label className="flex items-center cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={isScheduled}
                                            onChange={() => setIsScheduled(true)}
                                            className="w-4 h-4 text-blue-600"
                                        />
                                        <span className="ml-3 text-gray-700">
                                            Geplanter Zeitraum
                                        </span>
                                    </label>

                                    {isScheduled && (
                                        <div className="ml-7 mt-3 grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Startdatum
                                                </label>
                                                <input
                                                    type="date"
                                                    value={startDate}
                                                    onChange={(e) => setStartDate(e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Startzeit
                                                </label>
                                                <input
                                                    type="time"
                                                    value={startTime}
                                                    onChange={(e) => setStartTime(e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Enddatum
                                                </label>
                                                <input
                                                    type="date"
                                                    value={endDate}
                                                    onChange={(e) => setEndDate(e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Endzeit
                                                </label>
                                                <input
                                                    type="time"
                                                    value={endTime}
                                                    onChange={(e) => setEndTime(e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Quick Message Templates */}
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-3">Schnellvorlagen</h3>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => setQuickMessage('vacation')}
                                        className="px-4 py-2 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 transition text-sm"
                                    >
                                        🏖️ Urlaub
                                    </button>
                                    <button
                                        onClick={() => setQuickMessage('sick')}
                                        className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 transition text-sm"
                                    >
                                        🤒 Krank
                                    </button>
                                    <button
                                        onClick={() => setQuickMessage('meeting')}
                                        className="px-4 py-2 bg-green-100 text-green-800 rounded-lg hover:bg-green-200 transition text-sm"
                                    >
                                        📅 Meeting
                                    </button>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Nachricht für interne Kontakte
                                    </label>
                                    <textarea
                                        value={internalMessage}
                                        onChange={(e) => setInternalMessage(e.target.value)}
                                        rows={4}
                                        placeholder="Diese Nachricht sehen Kollegen und interne Kontakte..."
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Nachricht für externe Kontakte
                                    </label>
                                    <textarea
                                        value={externalMessage}
                                        onChange={(e) => setExternalMessage(e.target.value)}
                                        rows={4}
                                        placeholder="Diese Nachricht sehen externe Absender..."
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {/* Exchange Integration Info */}
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start">
                            <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="text-sm text-blue-800">
                                <p className="font-medium mb-1">Exchange-Integration</p>
                                <p>
                                    Ihre Abwesenheitseinstellungen werden automatisch mit Microsoft Exchange synchronisiert.
                                    Dies stellt sicher, dass Absender auch bei direkter E-Mail an Ihr Exchange-Postfach
                                    Ihre Abwesenheitsnachricht erhalten.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end space-x-3">
                    <button
                        onClick={loadStatus}
                        disabled={saving}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition disabled:opacity-50"
                    >
                        Zurücksetzen
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center"
                    >
                        {saving ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Speichert...
                            </>
                        ) : (
                            'Speichern'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default OOFSettings;
