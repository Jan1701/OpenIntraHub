import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../services/api';

function EventDetails() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [myParticipation, setMyParticipation] = useState(null);

    useEffect(() => {
        loadEvent();
    }, [id]);

    const loadEvent = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await api.get(`/events/${id}`);
            const eventData = response.data.data;

            setEvent(eventData);

            // Find my participation status
            const currentUser = JSON.parse(localStorage.getItem('user'));
            const myPart = eventData.participants?.find(p => p.user_id === currentUser?.id);
            setMyParticipation(myPart);

        } catch (err) {
            console.error('Error loading event:', err);
            setError('Fehler beim Laden des Events');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (newStatus) => {
        try {
            const currentUser = JSON.parse(localStorage.getItem('user'));
            await api.put(`/events/${id}/participants/${currentUser.id}/status`, {
                status: newStatus
            });

            await loadEvent();
        } catch (err) {
            console.error('Error updating status:', err);
            alert('Fehler beim Aktualisieren des Status');
        }
    };

    const handleCancelEvent = async () => {
        if (!window.confirm('Event wirklich absagen?')) return;

        try {
            const reason = prompt('Grund für die Absage (optional):');
            await api.post(`/events/${id}/cancel`, { reason });
            await loadEvent();
        } catch (err) {
            console.error('Error cancelling event:', err);
            alert('Fehler beim Absagen des Events');
        }
    };

    const handleDeleteEvent = async () => {
        if (!window.confirm('Event wirklich löschen?')) return;

        try {
            await api.delete(`/events/${id}`);
            navigate('/events');
        } catch (err) {
            console.error('Error deleting event:', err);
            alert('Fehler beim Löschen des Events');
        }
    };

    const formatDateTime = (dateString, showTime = true) => {
        const date = new Date(dateString);
        const dateStr = date.toLocaleDateString('de-DE', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });

        if (!showTime || event?.all_day) {
            return dateStr;
        }

        const timeStr = date.toLocaleTimeString('de-DE', {
            hour: '2-digit',
            minute: '2-digit'
        });

        return `${dateStr}, ${timeStr} Uhr`;
    };

    const getDuration = () => {
        if (!event) return '';
        const start = new Date(event.start_time);
        const end = new Date(event.end_time);
        const diff = Math.abs(end - start);
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0 && minutes > 0) {
            return `${hours} Std ${minutes} Min`;
        } else if (hours > 0) {
            return `${hours} Stunde${hours > 1 ? 'n' : ''}`;
        } else {
            return `${minutes} Minuten`;
        }
    };

    const getStatusBadge = (status) => {
        const badges = {
            confirmed: { label: 'Bestätigt', color: 'bg-green-100 text-green-800' },
            cancelled: { label: 'Abgesagt', color: 'bg-red-100 text-red-800' },
            tentative: { label: 'Vorläufig', color: 'bg-yellow-100 text-yellow-800' }
        };
        return badges[status] || badges.confirmed;
    };

    const currentUser = JSON.parse(localStorage.getItem('user'));
    const isOrganizer = event?.organizer_id === currentUser?.id;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-600">Lade Event...</div>
            </div>
        );
    }

    if (error || !event) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    {error || 'Event nicht gefunden'}
                </div>
                <Link to="/events" className="text-blue-600 hover:underline mt-4 inline-block">
                    ← Zurück zur Übersicht
                </Link>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            {/* Header */}
            <div className="mb-6">
                <Link to="/events" className="text-blue-600 hover:underline mb-2 inline-block">
                    ← Zurück zur Übersicht
                </Link>
                <div className="flex justify-between items-start">
                    <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                            <h1 className="text-3xl font-bold text-gray-900">{event.title}</h1>
                            <span className={`text-sm px-3 py-1 rounded ${getStatusBadge(event.status).color}`}>
                                {getStatusBadge(event.status).label}
                            </span>
                            {event.is_online && (
                                <span className="bg-purple-100 text-purple-800 text-sm px-3 py-1 rounded">
                                    Online
                                </span>
                            )}
                        </div>
                        <p className="text-gray-600">Organisiert von {event.organizer_name}</p>
                    </div>

                    {/* Actions */}
                    {isOrganizer && (
                        <div className="flex space-x-2">
                            <Link
                                to={`/events/${id}/edit`}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                            >
                                Bearbeiten
                            </Link>
                            {event.status !== 'cancelled' && (
                                <button
                                    onClick={handleCancelEvent}
                                    className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700"
                                >
                                    Absagen
                                </button>
                            )}
                            <button
                                onClick={handleDeleteEvent}
                                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                            >
                                Löschen
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Date & Time */}
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Termin</h2>
                        <div className="space-y-3">
                            <div className="flex items-start">
                                <svg className="w-5 h-5 text-gray-400 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <div>
                                    <div className="font-medium text-gray-900">
                                        {formatDateTime(event.start_time, !event.all_day)}
                                    </div>
                                    {!event.all_day && (
                                        <div className="text-gray-600 text-sm">
                                            bis {formatDateTime(event.end_time, true)}
                                        </div>
                                    )}
                                    <div className="text-gray-500 text-sm mt-1">
                                        Dauer: {getDuration()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Location */}
                    {(event.location_name || event.location_details) && (
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">Ort</h2>
                            <div className="flex items-start">
                                <svg className="w-5 h-5 text-gray-400 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <div>
                                    {event.location_name && (
                                        <div className="font-medium text-gray-900">{event.location_name}</div>
                                    )}
                                    {event.location_details && (
                                        <div className="text-gray-600">{event.location_details}</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Online Meeting */}
                    {event.is_online && event.meeting_url && (
                        <div className="bg-purple-50 rounded-lg border border-purple-200 p-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">Online-Meeting</h2>
                            <a
                                href={event.meeting_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-purple-700 hover:text-purple-900 font-medium"
                            >
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Zum Meeting beitreten
                                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </a>
                        </div>
                    )}

                    {/* Description */}
                    {event.description && (
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">Beschreibung</h2>
                            <p className="text-gray-700 whitespace-pre-wrap">{event.description}</p>
                        </div>
                    )}

                    {/* Participants */}
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">
                            Teilnehmer ({event.participants?.length || 0})
                        </h2>
                        <div className="space-y-2">
                            {event.participants?.map(participant => (
                                <div
                                    key={participant.id}
                                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                                >
                                    <div className="flex items-center space-x-3">
                                        {participant.avatar_url ? (
                                            <img
                                                src={participant.avatar_url}
                                                alt={participant.user_name}
                                                className="w-10 h-10 rounded-full"
                                            />
                                        ) : (
                                            <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                                                <span className="text-gray-600 font-medium">
                                                    {participant.user_name?.charAt(0)}
                                                </span>
                                            </div>
                                        )}
                                        <div>
                                            <div className="font-medium text-gray-900">
                                                {participant.user_name}
                                                {participant.is_organizer && (
                                                    <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                                        Organisator
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-sm text-gray-600">{participant.user_email}</div>
                                        </div>
                                    </div>
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
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* My Participation */}
                    {myParticipation && event.status !== 'cancelled' && (
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h3 className="font-semibold text-gray-900 mb-4">Meine Teilnahme</h3>
                            <div className="space-y-2">
                                <button
                                    onClick={() => handleUpdateStatus('accepted')}
                                    className={`w-full px-4 py-2 rounded-lg ${
                                        myParticipation.status === 'accepted'
                                            ? 'bg-green-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    ✓ Zusagen
                                </button>
                                <button
                                    onClick={() => handleUpdateStatus('tentative')}
                                    className={`w-full px-4 py-2 rounded-lg ${
                                        myParticipation.status === 'tentative'
                                            ? 'bg-yellow-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    ? Vielleicht
                                </button>
                                <button
                                    onClick={() => handleUpdateStatus('declined')}
                                    className={`w-full px-4 py-2 rounded-lg ${
                                        myParticipation.status === 'declined'
                                            ? 'bg-red-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    ✗ Absagen
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Event Info */}
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <h3 className="font-semibold text-gray-900 mb-4">Event-Details</h3>
                        <dl className="space-y-3 text-sm">
                            <div>
                                <dt className="text-gray-500">Kategorie</dt>
                                <dd className="text-gray-900 font-medium">{event.category}</dd>
                            </div>
                            <div>
                                <dt className="text-gray-500">Sichtbarkeit</dt>
                                <dd className="text-gray-900 font-medium">
                                    {event.visibility === 'public' ? 'Öffentlich' :
                                     event.visibility === 'internal' ? 'Intern' :
                                     'Privat'}
                                </dd>
                            </div>
                            {event.max_participants && (
                                <div>
                                    <dt className="text-gray-500">Max. Teilnehmer</dt>
                                    <dd className="text-gray-900 font-medium">
                                        {event.accepted_count} / {event.max_participants}
                                    </dd>
                                </div>
                            )}
                            <div>
                                <dt className="text-gray-500">Erstellt am</dt>
                                <dd className="text-gray-900">
                                    {new Date(event.created_at).toLocaleDateString('de-DE')}
                                </dd>
                            </div>
                        </dl>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default EventDetails;
