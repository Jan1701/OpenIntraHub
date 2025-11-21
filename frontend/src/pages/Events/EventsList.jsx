import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';

function EventsList() {
    const navigate = useNavigate();
    const [events, setEvents] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filters
    const [filters, setFilters] = useState({
        start_date: new Date().toISOString().split('T')[0], // Today
        end_date: '',
        category: '',
        my_events: 'false',
        visibility: '',
        status: 'confirmed',
        view_mode: 'upcoming' // upcoming, all, past
    });

    // View mode
    const [viewMode, setViewMode] = useState('list'); // list, calendar

    useEffect(() => {
        loadEvents();
        loadCategories();
    }, [filters]);

    const loadEvents = async () => {
        try {
            setLoading(true);
            setError(null);

            let queryFilters = { ...filters };

            // Adjust date filters based on view mode
            if (filters.view_mode === 'upcoming') {
                queryFilters.start_date = new Date().toISOString().split('T')[0];
                queryFilters.end_date = '';
            } else if (filters.view_mode === 'past') {
                queryFilters.end_date = new Date().toISOString().split('T')[0];
                queryFilters.start_date = '';
            }

            const response = await api.get('/events', { params: queryFilters });
            setEvents(response.data.data);
        } catch (err) {
            console.error('Error loading events:', err);
            setError('Fehler beim Laden der Events');
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

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleViewModeChange = (mode) => {
        setFilters(prev => ({ ...prev, view_mode: mode }));
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('de-DE', {
            weekday: 'short',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('de-DE', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getCategoryColor = (categorySlug) => {
        const category = categories.find(c => c.slug === categorySlug);
        return category?.color || '#3B82F6';
    };

    const getStatusBadge = (status) => {
        const badges = {
            confirmed: { label: 'Bestätigt', color: 'bg-green-100 text-green-800' },
            cancelled: { label: 'Abgesagt', color: 'bg-red-100 text-red-800' },
            tentative: { label: 'Vorläufig', color: 'bg-yellow-100 text-yellow-800' }
        };
        return badges[status] || badges.confirmed;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-600">Lade Events...</div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Kalender & Events</h1>
                    <p className="text-gray-600 mt-1">Verwalte Termine, Meetings und Veranstaltungen</p>
                </div>
                <Link
                    to="/events/new"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                    + Neues Event
                </Link>
            </div>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    {error}
                </div>
            )}

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* View Mode Tabs */}
                    <div className="md:col-span-4 flex space-x-2 border-b pb-4">
                        <button
                            onClick={() => handleViewModeChange('upcoming')}
                            className={`px-4 py-2 rounded-lg ${
                                filters.view_mode === 'upcoming'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            Kommende Events
                        </button>
                        <button
                            onClick={() => handleViewModeChange('all')}
                            className={`px-4 py-2 rounded-lg ${
                                filters.view_mode === 'all'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            Alle Events
                        </button>
                        <button
                            onClick={() => handleViewModeChange('past')}
                            className={`px-4 py-2 rounded-lg ${
                                filters.view_mode === 'past'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            Vergangene Events
                        </button>
                    </div>

                    {/* Category Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Kategorie
                        </label>
                        <select
                            value={filters.category}
                            onChange={(e) => handleFilterChange('category', e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        >
                            <option value="">Alle Kategorien</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.slug}>
                                    {cat.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* My Events */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Meine Events
                        </label>
                        <select
                            value={filters.my_events}
                            onChange={(e) => handleFilterChange('my_events', e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        >
                            <option value="false">Alle Events</option>
                            <option value="true">Nur meine Events</option>
                        </select>
                    </div>

                    {/* Visibility Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Sichtbarkeit
                        </label>
                        <select
                            value={filters.visibility}
                            onChange={(e) => handleFilterChange('visibility', e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        >
                            <option value="">Alle</option>
                            <option value="public">Öffentlich</option>
                            <option value="internal">Intern</option>
                            <option value="private">Privat</option>
                        </select>
                    </div>

                    {/* Status Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Status
                        </label>
                        <select
                            value={filters.status}
                            onChange={(e) => handleFilterChange('status', e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        >
                            <option value="">Alle</option>
                            <option value="confirmed">Bestätigt</option>
                            <option value="cancelled">Abgesagt</option>
                            <option value="tentative">Vorläufig</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Events List */}
            {events.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                    <p className="text-gray-600">Keine Events gefunden</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {events.map(event => (
                        <div
                            key={event.id}
                            className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => navigate(`/events/${event.id}`)}
                        >
                            <div className="p-6">
                                <div className="flex items-start justify-between">
                                    {/* Event Info */}
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-3 mb-2">
                                            {/* Category Color Indicator */}
                                            <div
                                                className="w-1 h-12 rounded"
                                                style={{ backgroundColor: event.color || getCategoryColor(event.category) }}
                                            />
                                            <div className="flex-1">
                                                <div className="flex items-center space-x-2">
                                                    <h3 className="text-lg font-semibold text-gray-900">
                                                        {event.title}
                                                    </h3>
                                                    {event.is_online && (
                                                        <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">
                                                            Online
                                                        </span>
                                                    )}
                                                    <span className={`text-xs px-2 py-1 rounded ${getStatusBadge(event.status).color}`}>
                                                        {getStatusBadge(event.status).label}
                                                    </span>
                                                </div>

                                                {/* Date & Time */}
                                                <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                                                    <span>
                                                        {formatDate(event.start_time)}
                                                        {!event.all_day && ` • ${formatTime(event.start_time)} - ${formatTime(event.end_time)}`}
                                                    </span>
                                                    {event.location_name && (
                                                        <span className="flex items-center">
                                                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            </svg>
                                                            {event.location_name}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Description */}
                                        {event.description && (
                                            <p className="text-gray-600 text-sm mt-2 line-clamp-2 ml-4">
                                                {event.description}
                                            </p>
                                        )}

                                        {/* Footer */}
                                        <div className="flex items-center space-x-4 mt-3 ml-4 text-sm text-gray-500">
                                            <span>Organisiert von {event.organizer_name}</span>
                                            {event.accepted_count > 0 && (
                                                <span className="flex items-center">
                                                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                                    </svg>
                                                    {event.accepted_count} Teilnehmer
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex space-x-2 ml-4">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/events/${event.id}/edit`);
                                            }}
                                            className="text-blue-600 hover:text-blue-800 p-2"
                                            title="Bearbeiten"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default EventsList;
