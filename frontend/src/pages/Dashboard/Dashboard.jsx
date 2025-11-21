// =====================================================
// Dashboard - Home Page mit Activity Feed
// =====================================================

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ActivityFeed from '../Feed/ActivityFeed';
import api from '../../services/api';

function Dashboard() {
    const [stats, setStats] = useState({
        unreadNotifications: 0,
        unreadMessages: 0,
        upcomingEvents: 0
    });
    const [upcomingEvents, setUpcomingEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            setLoading(true);

            // Load stats
            const [notificationsRes, eventsRes] = await Promise.all([
                api.get('/notifications/unread-count'),
                api.get('/events/upcoming', { params: { limit: 3 } })
            ]);

            setStats({
                unreadNotifications: notificationsRes.data.data.count,
                upcomingEvents: eventsRes.data.data.length
            });

            setUpcomingEvents(eventsRes.data.data);
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatEventDate = (dateString) => {
        const date = new Date(dateString);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (date.toDateString() === today.toDateString()) {
            return `Heute, ${date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`;
        } else if (date.toDateString() === tomorrow.toDateString()) {
            return `Morgen, ${date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`;
        } else {
            return date.toLocaleDateString('de-DE', {
                day: '2-digit',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit'
            }) + ' Uhr';
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content - Activity Feed */}
                    <div className="lg:col-span-2">
                        <ActivityFeed />
                    </div>

                    {/* Sidebar - Widgets */}
                    <div className="space-y-6">
                        {/* Stats Cards */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* Notifications Card */}
                            <Link
                                to="/notifications"
                                className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition cursor-pointer"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                    </svg>
                                    {stats.unreadNotifications > 0 && (
                                        <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded-full">
                                            {stats.unreadNotifications > 9 ? '9+' : stats.unreadNotifications}
                                        </span>
                                    )}
                                </div>
                                <div className="text-2xl font-bold text-gray-900">
                                    {stats.unreadNotifications}
                                </div>
                                <div className="text-sm text-gray-600">
                                    Benachrichtigungen
                                </div>
                            </Link>

                            {/* Events Card */}
                            <Link
                                to="/events"
                                className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition cursor-pointer"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div className="text-2xl font-bold text-gray-900">
                                    {stats.upcomingEvents}
                                </div>
                                <div className="text-sm text-gray-600">
                                    Anstehende Events
                                </div>
                            </Link>
                        </div>

                        {/* Upcoming Events Widget */}
                        <div className="bg-white rounded-lg shadow-sm">
                            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    Anstehende Events
                                </h3>
                                <Link
                                    to="/events"
                                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                >
                                    Alle anzeigen
                                </Link>
                            </div>
                            <div className="p-4">
                                {loading ? (
                                    <div className="text-center text-gray-600 py-4">
                                        Lädt...
                                    </div>
                                ) : upcomingEvents.length === 0 ? (
                                    <div className="text-center text-gray-600 py-4">
                                        <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <p className="text-sm">Keine anstehenden Events</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {upcomingEvents.map(event => (
                                            <Link
                                                key={event.id}
                                                to={`/events/${event.id}`}
                                                className="block p-3 hover:bg-gray-50 rounded-lg transition"
                                            >
                                                <div className="flex items-start">
                                                    <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-lg flex flex-col items-center justify-center">
                                                        <div className="text-lg font-bold text-purple-600">
                                                            {new Date(event.start_date).getDate()}
                                                        </div>
                                                        <div className="text-xs text-purple-600">
                                                            {new Date(event.start_date).toLocaleDateString('de-DE', { month: 'short' })}
                                                        </div>
                                                    </div>
                                                    <div className="ml-3 flex-1 min-w-0">
                                                        <h4 className="text-sm font-semibold text-gray-900 truncate">
                                                            {event.title}
                                                        </h4>
                                                        <p className="text-xs text-gray-600 mt-1">
                                                            {formatEventDate(event.start_date)}
                                                        </p>
                                                        {event.location && (
                                                            <div className="flex items-center text-xs text-gray-500 mt-1">
                                                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                </svg>
                                                                {event.location}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="bg-white rounded-lg shadow-sm p-4">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                Schnellzugriff
                            </h3>
                            <div className="space-y-2">
                                <Link
                                    to="/posts/new"
                                    className="flex items-center px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                                >
                                    <svg className="w-5 h-5 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    <span className="text-sm font-medium text-gray-900">
                                        Neuer Beitrag
                                    </span>
                                </Link>

                                <Link
                                    to="/events/new"
                                    className="flex items-center px-4 py-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition"
                                >
                                    <svg className="w-5 h-5 text-purple-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <span className="text-sm font-medium text-gray-900">
                                        Neues Event
                                    </span>
                                </Link>

                                <Link
                                    to="/chat"
                                    className="flex items-center px-4 py-3 bg-green-50 hover:bg-green-100 rounded-lg transition"
                                >
                                    <svg className="w-5 h-5 text-green-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                    <span className="text-sm font-medium text-gray-900">
                                        Chat öffnen
                                    </span>
                                </Link>
                            </div>
                        </div>

                        {/* Tips Card */}
                        <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg shadow-sm p-6 text-white">
                            <div className="flex items-start">
                                <svg className="w-8 h-8 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                <div>
                                    <h3 className="text-lg font-semibold mb-2">
                                        Tipp des Tages
                                    </h3>
                                    <p className="text-sm opacity-90">
                                        Nutze @-Mentions in Beiträgen, um Kollegen direkt zu benachrichtigen!
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
