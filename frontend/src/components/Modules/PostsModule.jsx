import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, User, Eye, ChevronRight, Tag } from 'lucide-react';
import api from '../../services/api';

/**
 * PostsModule Component
 * Displays blog posts in various layouts
 * Used in Page Builder
 */
function PostsModule({ config = {} }) {
    const {
        layout = 'grid',
        columns = 3,
        postsPerPage = 12,
        showExcerpt = true,
        showAuthor = true,
        showDate = true,
        showThumbnail = true,
        category = null,
        tag = null,
        status = 'published',
        orderBy = 'published_at',
        orderDir = 'DESC'
    } = config;

    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ total: 0, offset: 0 });
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        loadPosts();
    }, [category, tag, currentPage]);

    const loadPosts = async () => {
        try {
            setLoading(true);
            const params = {
                status,
                limit: postsPerPage,
                offset: (currentPage - 1) * postsPerPage,
                order_by: orderBy,
                order_dir: orderDir,
                visibility: 'public'
            };

            if (category) {
                params.category_id = category;
            }

            if (tag) {
                params.tag_id = tag;
            }

            const response = await api.get('/posts', { params });
            setPosts(response.data.data);
            setPagination(response.data.pagination);
        } catch (error) {
            console.error('Error loading posts:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).format(date);
    };

    const truncateText = (text, maxLength = 150) => {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength).trim() + '...';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-gray-500">Loading posts...</div>
            </div>
        );
    }

    if (posts.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-500">No posts found.</p>
            </div>
        );
    }

    // Grid Layout
    if (layout === 'grid') {
        return (
            <div className="posts-module-grid">
                <div className={`grid grid-cols-1 md:grid-cols-${Math.min(columns, 3)} gap-6`}>
                    {posts.map((post) => (
                        <article key={post.id} className="card hover:shadow-lg transition-shadow">
                            {showThumbnail && post.featured_image && (
                                <Link to={`/posts/${post.slug}`}>
                                    <img
                                        src={post.featured_image}
                                        alt={post.featured_image_alt || post.title}
                                        className="w-full h-48 object-cover rounded-t-lg"
                                    />
                                </Link>
                            )}
                            <div className="p-6">
                                {post.category_name && (
                                    <div className="mb-2">
                                        <span className="inline-block px-2 py-1 text-xs font-medium text-primary-700 bg-primary-100 rounded">
                                            {post.category_name}
                                        </span>
                                    </div>
                                )}
                                <h3 className="text-xl font-bold mb-2">
                                    <Link
                                        to={`/posts/${post.slug}`}
                                        className="hover:text-primary-600 transition-colors"
                                    >
                                        {post.title}
                                    </Link>
                                </h3>

                                {showExcerpt && post.excerpt && (
                                    <p className="text-gray-600 mb-4">
                                        {truncateText(post.excerpt)}
                                    </p>
                                )}

                                <div className="flex items-center justify-between text-sm text-gray-500">
                                    <div className="flex items-center gap-4">
                                        {showAuthor && post.author_name && (
                                            <div className="flex items-center">
                                                <User className="w-4 h-4 mr-1" />
                                                {post.author_name}
                                            </div>
                                        )}
                                        {showDate && post.published_at && (
                                            <div className="flex items-center">
                                                <Calendar className="w-4 h-4 mr-1" />
                                                {formatDate(post.published_at)}
                                            </div>
                                        )}
                                    </div>
                                    <Link
                                        to={`/posts/${post.slug}`}
                                        className="text-primary-600 hover:text-primary-700 font-medium"
                                    >
                                        Read more
                                        <ChevronRight className="w-4 h-4 inline ml-1" />
                                    </Link>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>

                {/* Pagination */}
                {pagination.total > postsPerPage && (
                    <div className="flex justify-center gap-2 mt-8">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <span className="px-4 py-2">
                            Page {currentPage} of {Math.ceil(pagination.total / postsPerPage)}
                        </span>
                        <button
                            onClick={() => setCurrentPage(p => p + 1)}
                            disabled={currentPage >= Math.ceil(pagination.total / postsPerPage)}
                            className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // List Layout
    if (layout === 'list') {
        return (
            <div className="posts-module-list space-y-6">
                {posts.map((post) => (
                    <article key={post.id} className="card flex gap-6">
                        {showThumbnail && post.featured_image && (
                            <Link to={`/posts/${post.slug}`} className="flex-shrink-0">
                                <img
                                    src={post.featured_image}
                                    alt={post.featured_image_alt || post.title}
                                    className="w-48 h-48 object-cover rounded-lg"
                                />
                            </Link>
                        )}
                        <div className="flex-1">
                            {post.category_name && (
                                <div className="mb-2">
                                    <span className="inline-block px-2 py-1 text-xs font-medium text-primary-700 bg-primary-100 rounded">
                                        {post.category_name}
                                    </span>
                                </div>
                            )}
                            <h3 className="text-2xl font-bold mb-3">
                                <Link
                                    to={`/posts/${post.slug}`}
                                    className="hover:text-primary-600 transition-colors"
                                >
                                    {post.title}
                                </Link>
                            </h3>

                            {showExcerpt && post.excerpt && (
                                <p className="text-gray-600 mb-4 line-clamp-3">
                                    {post.excerpt}
                                </p>
                            )}

                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4 text-sm text-gray-500">
                                    {showAuthor && post.author_name && (
                                        <div className="flex items-center">
                                            <User className="w-4 h-4 mr-1" />
                                            {post.author_name}
                                        </div>
                                    )}
                                    {showDate && post.published_at && (
                                        <div className="flex items-center">
                                            <Calendar className="w-4 h-4 mr-1" />
                                            {formatDate(post.published_at)}
                                        </div>
                                    )}
                                    <div className="flex items-center">
                                        <Eye className="w-4 h-4 mr-1" />
                                        {post.views_count} views
                                    </div>
                                </div>
                                <Link
                                    to={`/posts/${post.slug}`}
                                    className="btn btn-primary"
                                >
                                    Read more
                                    <ChevronRight className="w-4 h-4 ml-1" />
                                </Link>
                            </div>
                        </div>
                    </article>
                ))}

                {/* Pagination */}
                {pagination.total > postsPerPage && (
                    <div className="flex justify-center gap-2 mt-8">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <span className="px-4 py-2">
                            Page {currentPage} of {Math.ceil(pagination.total / postsPerPage)}
                        </span>
                        <button
                            onClick={() => setCurrentPage(p => p + 1)}
                            disabled={currentPage >= Math.ceil(pagination.total / postsPerPage)}
                            className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // Masonry Layout (simplified grid with different heights)
    if (layout === 'masonry') {
        return (
            <div className="posts-module-masonry">
                <div className="columns-1 md:columns-2 lg:columns-3 gap-6">
                    {posts.map((post) => (
                        <article key={post.id} className="card mb-6 break-inside-avoid">
                            {showThumbnail && post.featured_image && (
                                <Link to={`/posts/${post.slug}`}>
                                    <img
                                        src={post.featured_image}
                                        alt={post.featured_image_alt || post.title}
                                        className="w-full object-cover rounded-t-lg"
                                    />
                                </Link>
                            )}
                            <div className="p-4">
                                <h3 className="text-lg font-bold mb-2">
                                    <Link to={`/posts/${post.slug}`}>
                                        {post.title}
                                    </Link>
                                </h3>
                                {showExcerpt && post.excerpt && (
                                    <p className="text-gray-600 text-sm mb-3">
                                        {truncateText(post.excerpt, 100)}
                                    </p>
                                )}
                                {showDate && post.published_at && (
                                    <div className="text-xs text-gray-500">
                                        {formatDate(post.published_at)}
                                    </div>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
            </div>
        );
    }

    // Carousel Layout (horizontal scroll)
    if (layout === 'carousel') {
        return (
            <div className="posts-module-carousel">
                <div className="flex overflow-x-auto gap-6 pb-4 scrollbar-hide">
                    {posts.map((post) => (
                        <article key={post.id} className="card flex-shrink-0 w-80">
                            {showThumbnail && post.featured_image && (
                                <Link to={`/posts/${post.slug}`}>
                                    <img
                                        src={post.featured_image}
                                        alt={post.featured_image_alt || post.title}
                                        className="w-full h-48 object-cover rounded-t-lg"
                                    />
                                </Link>
                            )}
                            <div className="p-4">
                                <h3 className="text-lg font-bold mb-2">
                                    <Link to={`/posts/${post.slug}`}>
                                        {post.title}
                                    </Link>
                                </h3>
                                {showExcerpt && post.excerpt && (
                                    <p className="text-gray-600 text-sm mb-3">
                                        {truncateText(post.excerpt, 100)}
                                    </p>
                                )}
                                <Link
                                    to={`/posts/${post.slug}`}
                                    className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                                >
                                    Read more →
                                </Link>
                            </div>
                        </article>
                    ))}
                </div>
            </div>
        );
    }

    return null;
}

export default PostsModule;
