import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';

function EventEditor() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEdit = id && id !== 'new';

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('basic');

    const [categories, setCategories] = useState([]);
    const [locations, setLocations] = useState([]);
    const [users, setUsers] = useState([]);

    const [event, setEvent] = useState({
        title: '',
        description: '',
        start_time: '',
        end_time: '',
        all_day: false,
        timezone: 'Europe/Berlin',
        category: 'general',
        location_id: '',
        location_details: '',
        is_online: false,
        meeting_url: '',
        visibility: 'private',
        requires_approval: false,
        max_participants: '',
        allow_guests: false,
        status: 'confirmed',
        color: '',
        tags: []
    });

    const [participants, setParticipants] = useState([]);
    const [newParticipant, setNewParticipant] = useState('');

    useEffect(() => {
        loadCategories();
        loadLocations();
        loadUsers();

        if (isEdit) {
            loadEvent();
        } else {
            // Set default times (now + 1 hour for 1 hour)
            const now = new Date();
            const start = new Date(now.getTime() + 60 * 60 * 1000); // +1 hour
            const end = new Date(start.getTime() + 60 * 60 * 1000); // +1 hour

            setEvent(prev => ({
                ...prev,
                start_time: start.toISOString().slice(0, 16),
                end_time: end.toISOString().slice(0, 16)
            }));
        }
    }, [id]);

    const loadEvent = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/events/${id}`);
            const eventData = response.data.data;

            // Convert timestamps to local datetime format
            eventData.start_time = new Date(eventData.start_time).toISOString().slice(0, 16);
            eventData.end_time = new Date(eventData.end_time).toISOString().slice(0, 16);

            setEvent(eventData);
            setParticipants(eventData.participants || []);
        } catch (err) {
            console.error('Error loading event:', err);
            setError('Fehler beim Laden des Events');
        } finally {
            setLoading(false);
        }
    };

    const loadCategories = async () => {
        try {
            const response = await api.get('/events/categories');
            setCategories(response.data.data);
        } catch (err) {
            console.error('Error loading categories:', err);
        }
    };

    const loadLocations = async () => {
        try {
            const response = await api.get('/locations', { params: { is_active: true } });
            setLocations(response.data.data);
        } catch (err) {
            console.error('Error loading locations:', err);
        }
    };

    const loadUsers = async () => {
        try {
            const response = await api.get('/admin/users', { params: { is_active: true } });
            setUsers(response.data.data);
        } catch (err) {
            console.error('Error loading users:', err);
        }
    };

    const handleChange = (field, value) => {
        setEvent(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setError(null);

            // Validate
            if (!event.title || !event.start_time || !event.end_time) {
                setError('Bitte fülle alle Pflichtfelder aus');
                return;
            }

            if (new Date(event.end_time) <= new Date(event.start_time)) {
                setError('Endzeit muss nach Startzeit liegen');
                return;
            }

            // Prepare data
            const eventData = {
                ...event,
                max_participants: event.max_participants ? parseInt(event.max_participants) : null,
                location_id: event.location_id ? parseInt(event.location_id) : null
            };

            if (isEdit) {
                await api.put(`/events/${id}`, eventData);
            } else {
                await api.post('/events', eventData);
            }

            navigate('/events');
        } catch (err) {
            console.error('Error saving event:', err);
            setError(err.response?.data?.message || 'Fehler beim Speichern');
        } finally {
            setSaving(false);
        }
    };

    const handleAddParticipant = async () => {
        if (!newParticipant) return;

        try {
            await api.post(`/events/${id}/participants`, {
                user_id: parseInt(newParticipant),
                status: 'invited',
                is_required: false
            });

            await loadEvent();
            setNewParticipant('');
        } catch (err) {
            console.error('Error adding participant:', err);
            setError(err.response?.data?.message || 'Fehler beim Hinzufügen des Teilnehmers');
        }
    };

    const handleRemoveParticipant = async (userId) => {
        if (!window.confirm('Teilnehmer wirklich entfernen?')) return;

        try {
            await api.delete(`/events/${id}/participants/${userId}`);
            await loadEvent();
        } catch (err) {
            console.error('Error removing participant:', err);
            setError('Fehler beim Entfernen des Teilnehmers');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-600">Lade Event...</div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900">
                    {isEdit ? 'Event bearbeiten' : 'Neues Event'}
                </h1>
                <p className="text-gray-600 mt-1">
                    {isEdit ? 'Bearbeite die Event-Details' : 'Erstelle ein neues Event'}
                </p>
            </div>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    {error}
                </div>
            )}

            {/* Tabs */}
            <div className="bg-white rounded-lg shadow-sm">
                <div className="border-b border-gray-200">
                    <nav className="flex space-x-8 px-6" aria-label="Tabs">
                        <button
                            onClick={() => setActiveTab('basic')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${
                                activeTab === 'basic'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            Grunddaten
                        </button>
                        <button
                            onClick={() => setActiveTab('location')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${
                                activeTab === 'location'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            Ort & Online
                        </button>
                        {isEdit && (
                            <button
                                onClick={() => setActiveTab('participants')}
                                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                                    activeTab === 'participants'
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                Teilnehmer ({participants.length})
                            </button>
                        )}
                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${
                                activeTab === 'settings'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            Einstellungen
                        </button>
                    </nav>
                </div>

                <div className="p-6">
                    {/* Basic Tab */}
                    {activeTab === 'basic' && (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Titel *
                                </label>
                                <input
                                    type="text"
                                    value={event.title}
                                    onChange={(e) => handleChange('title', e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                    placeholder="z.B. Team-Meeting"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Beschreibung
                                </label>
                                <textarea
                                    value={event.description}
                                    onChange={(e) => handleChange('description', e.target.value)}
                                    rows={4}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                    placeholder="Beschreibe das Event..."
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Startzeit *
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={event.start_time}
                                        onChange={(e) => handleChange('start_time', e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Endzeit *
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={event.end_time}
                                        onChange={(e) => handleChange('end_time', e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="all_day"
                                    checked={event.all_day}
                                    onChange={(e) => handleChange('all_day', e.target.checked)}
                                    className="mr-2"
                                />
                                <label htmlFor="all_day" className="text-sm text-gray-700">
                                    Ganztägiges Event
                                </label>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Kategorie
                                    </label>
                                    <select
                                        value={event.category}
                                        onChange={(e) => handleChange('category', e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                    >
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.slug}>
                                                {cat.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Farbe (optional)
                                    </label>
                                    <input
                                        type="color"
                                        value={event.color || '#3B82F6'}
                                        onChange={(e) => handleChange('color', e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 h-10"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Location Tab */}
                    {activeTab === 'location' && (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Standort
                                </label>
                                <select
                                    value={event.location_id}
                                    onChange={(e) => handleChange('location_id', e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                >
                                    <option value="">Kein Standort</option>
                                    {locations.map(loc => (
                                        <option key={loc.id} value={loc.id}>
                                            {loc.name} ({loc.code})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Raum / Details
                                </label>
                                <input
                                    type="text"
                                    value={event.location_details}
                                    onChange={(e) => handleChange('location_details', e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                    placeholder="z.B. Raum 3.14, Konferenzraum"
                                />
                            </div>

                            <div className="border-t pt-4">
                                <div className="flex items-center mb-4">
                                    <input
                                        type="checkbox"
                                        id="is_online"
                                        checked={event.is_online}
                                        onChange={(e) => handleChange('is_online', e.target.checked)}
                                        className="mr-2"
                                    />
                                    <label htmlFor="is_online" className="text-sm font-medium text-gray-700">
                                        Online-Event
                                    </label>
                                </div>

                                {event.is_online && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Meeting-URL
                                        </label>
                                        <input
                                            type="url"
                                            value={event.meeting_url}
                                            onChange={(e) => handleChange('meeting_url', e.target.value)}
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                            placeholder="https://meet.example.com/..."
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Participants Tab */}
                    {activeTab === 'participants' && isEdit && (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Teilnehmer hinzufügen
                                </label>
                                <div className="flex space-x-2">
                                    <select
                                        value={newParticipant}
                                        onChange={(e) => setNewParticipant(e.target.value)}
                                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
                                    >
                                        <option value="">Benutzer auswählen...</option>
                                        {users
                                            .filter(u => !participants.find(p => p.user_id === u.id))
                                            .map(user => (
                                                <option key={user.id} value={user.id}>
                                                    {user.name} ({user.email})
                                                </option>
                                            ))}
                                    </select>
                                    <button
                                        onClick={handleAddParticipant}
                                        disabled={!newParticipant}
                                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
                                    >
                                        Hinzufügen
                                    </button>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-medium text-gray-700 mb-2">
                                    Teilnehmer ({participants.length})
                                </h3>
                                <div className="space-y-2">
                                    {participants.map(participant => (
                                        <div
                                            key={participant.id}
                                            className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                                        >
                                            <div className="flex items-center space-x-3">
                                                <div>
                                                    <div className="font-medium text-gray-900">
                                                        {participant.user_name}
                                                        {participant.is_organizer && (
                                                            <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                                                Organisator
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-sm text-gray-600">
                                                        {participant.user_email}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <span className={`text-xs px-2 py-1 rounded ${
                                                    participant.status === 'accepted' ? 'bg-green-100 text-green-800' :
                                                    participant.status === 'declined' ? 'bg-red-100 text-red-800' :
                                                    participant.status === 'tentative' ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-gray-100 text-gray-800'
                                                }`}>
                                                    {participant.status === 'accepted' ? 'Zugesagt' :
                                                     participant.status === 'declined' ? 'Abgesagt' :
                                                     participant.status === 'tentative' ? 'Vorläufig' :
                                                     'Eingeladen'}
                                                </span>
                                                {!participant.is_organizer && (
                                                    <button
                                                        onClick={() => handleRemoveParticipant(participant.user_id)}
                                                        className="text-red-600 hover:text-red-800 p-1"
                                                        title="Entfernen"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Settings Tab */}
                    {activeTab === 'settings' && (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Sichtbarkeit
                                </label>
                                <select
                                    value={event.visibility}
                                    onChange={(e) => handleChange('visibility', e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                >
                                    <option value="private">Privat - Nur Teilnehmer</option>
                                    <option value="internal">Intern - Alle Mitarbeiter</option>
                                    <option value="public">Öffentlich</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Status
                                </label>
                                <select
                                    value={event.status}
                                    onChange={(e) => handleChange('status', e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                >
                                    <option value="confirmed">Bestätigt</option>
                                    <option value="tentative">Vorläufig</option>
                                    <option value="cancelled">Abgesagt</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Max. Teilnehmer (optional)
                                </label>
                                <input
                                    type="number"
                                    value={event.max_participants}
                                    onChange={(e) => handleChange('max_participants', e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                    placeholder="Unbegrenzt"
                                    min="1"
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="requires_approval"
                                        checked={event.requires_approval}
                                        onChange={(e) => handleChange('requires_approval', e.target.checked)}
                                        className="mr-2"
                                    />
                                    <label htmlFor="requires_approval" className="text-sm text-gray-700">
                                        Teilnahme erfordert Genehmigung
                                    </label>
                                </div>

                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="allow_guests"
                                        checked={event.allow_guests}
                                        onChange={(e) => handleChange('allow_guests', e.target.checked)}
                                        className="mr-2"
                                    />
                                    <label htmlFor="allow_guests" className="text-sm text-gray-700">
                                        Gäste erlauben
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="border-t border-gray-200 px-6 py-4 flex justify-between">
                    <button
                        onClick={() => navigate('/events')}
                        className="px-4 py-2 text-gray-700 hover:text-gray-900"
                    >
                        Abbrechen
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
                    >
                        {saving ? 'Speichere...' : (isEdit ? 'Änderungen speichern' : 'Event erstellen')}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default EventEditor;
