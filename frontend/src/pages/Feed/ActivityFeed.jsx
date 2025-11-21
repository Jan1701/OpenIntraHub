import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import ReactionPicker from '../../components/ReactionPicker';

function ActivityFeed() {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(0);
    const feedRef = useRef(null);

    // New Post Composer
    const [composerOpen, setComposerOpen] = useState(false);
    const [newPostContent, setNewPostContent] = useState('');
    const [posting, setPosting] = useState(false);

    useEffect(() => {
        loadFeed();
    }, []);

    const loadFeed = async (offset = 0) => {
        try {
            setLoading(true);
            const response = await api.get('/feed', {
                params: {
                    limit: 20,
                    offset: offset
                }
            });

            if (offset === 0) {
                setActivities(response.data.data);
            } else {
                setActivities(prev => [...prev, ...response.data.data]);
            }

            setHasMore(response.data.data.length === 20);
        } catch (error) {
            console.error('Error loading feed:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLoadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        loadFeed(nextPage * 20);
    };

    const handleCreatePost = async () => {
        if (!newPostContent.trim()) return;

        try {
            setPosting(true);
            await api.post('/posts', {
                title: newPostContent.substring(0, 100),
                content: newPostContent,
                status: 'published'
            });

            setNewPostContent('');
            setComposerOpen(false);

            // Reload feed
            setPage(0);
            loadFeed(0);
        } catch (error) {
            console.error('Error creating post:', error);
            alert('Fehler beim Erstellen des Posts');
        } finally {
            setPosting(false);
        }
    };

    const handleReaction = async (postId, reactionType) => {
        try {
            const response = await api.post(`/posts/${postId}/react`, {
                reaction_type: reactionType
            });

            // Update activity in list
            setActivities(prev => prev.map(activity => {
                if (activity.target_type === 'post' && activity.target_id === postId) {
                    return {
                        ...activity,
                        post_data: {
                            ...activity.post_data,
                            reaction_count: (activity.post_data.reaction_count || 0) + 1
                        }
                    };
                }
                return activity;
            }));
        } catch (error) {
            console.error('Error adding reaction:', error);
        }
    };

    const renderActivity = (activity) => {
        const { activity_type, post_data, event_data, user_name, user_avatar, created_at } = activity;

        // Post Activity
        if (activity_type === 'post_created' && post_data) {
            return (
                <div key={activity.id} className="bg-white rounded-lg shadow-sm p-6 mb-4">
                    {/* Author Header */}
                    <div className="flex items-center mb-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                            {user_name?.charAt(0) || '?'}
                        </div>
                        <div className="ml-3">
                            <div className="font-semibold text-gray-900">{user_name}</div>
                            <div className="text-sm text-gray-500">
                                {new Date(created_at).toLocaleDateString('de-DE', {
                                    day: '2-digit',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Featured Image */}
                    {post_data.featured_image && (
                        <img
                            src={post_data.featured_image}
                            alt={post_data.title}
                            className="w-full h-64 object-cover rounded-lg mb-4"
                        />
                    )}

                    {/* Post Content */}
                    <Link to={`/posts/${post_data.id}`} className="block mb-4">
                        <h3 className="text-xl font-bold text-gray-900 mb-2 hover:text-blue-600">
                            {post_data.title}
                        </h3>
                        <p className="text-gray-700 line-clamp-3">
                            {post_data.content}
                        </p>
                    </Link>

                    {/* Engagement Bar */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                        <div className="flex items-center space-x-6">
                            {/* Reactions */}
                            <ReactionPicker
                                onReact={(type) => handleReaction(post_data.id, type)}
                                count={post_data.reaction_count || 0}
                            />

                            {/* Comments */}
                            <Link
                                to={`/posts/${post_data.id}#comments`}
                                className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                                <span className="text-sm font-medium">
                                    {post_data.comment_count || 0}
                                </span>
                            </Link>

                            {/* Shares */}
                            <button
                                onClick={() => handleShare(post_data.id)}
                                className="flex items-center space-x-2 text-gray-600 hover:text-green-600 transition"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                </svg>
                                <span className="text-sm font-medium">
                                    {post_data.share_count || 0}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        // Event Activity
        if (activity_type === 'event_created' && event_data) {
            return (
                <div key={activity.id} className="bg-white rounded-lg shadow-sm p-6 mb-4">
                    <div className="flex items-start">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <div className="ml-4 flex-1">
                            <div className="text-sm text-gray-600 mb-2">
                                <span className="font-semibold text-gray-900">{user_name}</span> hat ein Event erstellt
                            </div>
                            <Link
                                to={`/events/${event_data.id}`}
                                className="block bg-green-50 rounded-lg p-4 hover:bg-green-100 transition"
                            >
                                <h4 className="font-semibold text-gray-900 mb-1">
                                    {event_data.title}
                                </h4>
                                <div className="text-sm text-gray-600">
                                    {new Date(event_data.start_time).toLocaleDateString('de-DE', {
                                        weekday: 'long',
                                        day: '2-digit',
                                        month: 'long',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                    {event_data.location_name && ` · ${event_data.location_name}`}
                                </div>
                            </Link>
                        </div>
                    </div>
                </div>
            );
        }

        // Default fallback
        return null;
    };

    const handleShare = async (postId) => {
        const comment = prompt('Kommentar zum Teilen (optional):');
        if (comment === null) return; // Cancelled

        try {
            await api.post(`/posts/${postId}/share`, {
                share_comment: comment || undefined
            });
            alert('Post geteilt!');
        } catch (error) {
            console.error('Error sharing post:', error);
            alert('Fehler beim Teilen');
        }
    };

    return (
        <div className="max-w-2xl mx-auto py-8 px-4">
            {/* Post Composer */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                        {JSON.parse(localStorage.getItem('user'))?.name?.charAt(0) || 'U'}
                    </div>

                    {!composerOpen ? (
                        <button
                            onClick={() => setComposerOpen(true)}
                            className="flex-1 text-left px-4 py-3 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 transition"
                        >
                            Was gibt's Neues?
                        </button>
                    ) : (
                        <div className="flex-1">
                            <textarea
                                value={newPostContent}
                                onChange={(e) => setNewPostContent(e.target.value)}
                                placeholder="Teile deine Gedanken..."
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                rows={4}
                                autoFocus
                            />
                            <div className="flex items-center justify-between mt-3">
                                <div className="flex items-center space-x-2">
                                    <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-full">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </button>
                                    <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-full">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </button>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={() => {
                                            setComposerOpen(false);
                                            setNewPostContent('');
                                        }}
                                        className="px-4 py-2 text-gray-600 hover:text-gray-900"
                                    >
                                        Abbrechen
                                    </button>
                                    <button
                                        onClick={handleCreatePost}
                                        disabled={!newPostContent.trim() || posting}
                                        className="px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                                    >
                                        {posting ? 'Poste...' : 'Posten'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Feed */}
            {loading && activities.length === 0 ? (
                <div className="flex items-center justify-center h-64">
                    <div className="text-gray-600">Lade Feed...</div>
                </div>
            ) : (
                <>
                    <div ref={feedRef}>
                        {activities.map(activity => renderActivity(activity))}
                    </div>

                    {hasMore && (
                        <div className="flex justify-center mt-6">
                            <button
                                onClick={handleLoadMore}
                                disabled={loading}
                                className="px-6 py-3 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                                {loading ? 'Lädt...' : 'Mehr laden'}
                            </button>
                        </div>
                    )}
                </>
            )}

            {activities.length === 0 && !loading && (
                <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                    <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                    </svg>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        Noch keine Aktivitäten
                    </h3>
                    <p className="text-gray-600 mb-4">
                        Sei der Erste und teile etwas!
                    </p>
                    <button
                        onClick={() => setComposerOpen(true)}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Ersten Post erstellen
                    </button>
                </div>
            )}
        </div>
    );
}

export default ActivityFeed;
