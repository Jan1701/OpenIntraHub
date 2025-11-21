import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Plus,
    Edit,
    Trash,
    Eye,
    Calendar,
    Tag,
    FolderOpen,
    Search,
    Filter
} from 'lucide-react';
import api from '../../services/api';

function PostsList() {
    const { t } = useTranslation();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ total: 0, limit: 20, offset: 0, pages: 0 });
    const [filters, setFilters] = useState({
        status: '',
        category_id: '',
        search: '',
        order_by: 'created_at',
        order_dir: 'DESC'
    });
    const [categories, setCategories] = useState([]);

    useEffect(() => {
        loadCategories();
        loadPosts();
    }, []);

    useEffect(() => {
        loadPosts();
    }, [filters, pagination.offset]);

    const loadCategories = async () => {
        try {
            const response = await api.get('/posts/categories');
            setCategories(response.data.data);
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    };

    const loadPosts = async () => {
        try {
            setLoading(true);
            const params = {
                ...filters,
                limit: pagination.limit,
                offset: pagination.offset
            };

            // Remove empty filters
            Object.keys(params).forEach(key => {
                if (params[key] === '') delete params[key];
            });

            const response = await api.get('/posts', { params });
            setPosts(response.data.data);
            setPagination(response.data.pagination);
        } catch (error) {
            console.error('Error loading posts:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this post?')) return;

        try {
            await api.delete(`/posts/${id}`);
            loadPosts();
        } catch (error) {
            console.error('Error deleting post:', error);
        }
    };

    const handleFilterChange = (key, value) => {
        setFilters({ ...filters, [key]: value });
        setPagination({ ...pagination, offset: 0 }); // Reset to first page
    };

    const handlePageChange = (newPage) => {
        setPagination({ ...pagination, offset: newPage * pagination.limit });
    };

    const getStatusBadgeClass = (status) => {
        const classes = {
            published: 'bg-green-100 text-green-700',
            draft: 'bg-gray-100 text-gray-700',
            scheduled: 'bg-blue-100 text-blue-700',
            archived: 'bg-yellow-100 text-yellow-700'
        };
        return classes[status] || 'bg-gray-100 text-gray-700';
    };

    if (loading && posts.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading posts...</div>
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold">Posts</h1>
                    <p className="text-gray-600 mt-1">Manage your blog posts and articles</p>
                </div>
                <Link to="/posts/new" className="btn btn-primary">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Post
                </Link>
            </div>

            {/* Filters */}
            <div className="card mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Search */}
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search posts..."
                            className="input pl-10"
                            value={filters.search}
                            onChange={(e) => handleFilterChange('search', e.target.value)}
                        />
                    </div>

                    {/* Status Filter */}
                    <div>
                        <select
                            className="input"
                            value={filters.status}
                            onChange={(e) => handleFilterChange('status', e.target.value)}
                        >
                            <option value="">All Statuses</option>
                            <option value="published">Published</option>
                            <option value="draft">Draft</option>
                            <option value="scheduled">Scheduled</option>
                            <option value="archived">Archived</option>
                        </select>
                    </div>

                    {/* Category Filter */}
                    <div>
                        <select
                            className="input"
                            value={filters.category_id}
                            onChange={(e) => handleFilterChange('category_id', e.target.value)}
                        >
                            <option value="">All Categories</option>
                            {categories.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                    {cat.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Sort Order */}
                    <div>
                        <select
                            className="input"
                            value={filters.order_by}
                            onChange={(e) => handleFilterChange('order_by', e.target.value)}
                        >
                            <option value="created_at">Newest First</option>
                            <option value="published_at">Recently Published</option>
                            <option value="title">Title (A-Z)</option>
                            <option value="views_count">Most Viewed</option>
                            <option value="likes_count">Most Liked</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Posts Table */}
            <div className="card overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Post
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Category
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Stats
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Date
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {posts.map((post) => (
                            <tr key={post.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4">
                                    <div className="flex items-start">
                                        {post.featured_image && (
                                            <img
                                                src={post.featured_image}
                                                alt={post.title}
                                                className="w-16 h-16 object-cover rounded mr-4"
                                            />
                                        )}
                                        <div>
                                            <div className="font-semibold text-gray-900">
                                                {post.title}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                /{post.slug}
                                            </div>
                                            <div className="text-xs text-gray-400 mt-1">
                                                by {post.author_name}
                                            </div>
                                            {post.is_featured && (
                                                <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded">
                                                    Featured
                                                </span>
                                            )}
                                            {post.is_sticky && (
                                                <span className="inline-block mt-1 ml-1 px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
                                                    Sticky
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {post.category_name && (
                                        <div className="flex items-center text-sm text-gray-600">
                                            <FolderOpen className="w-4 h-4 mr-1" />
                                            {post.category_name}
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 text-xs rounded ${getStatusBadgeClass(post.status)}`}>
                                        {post.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="space-y-1 text-xs text-gray-500">
                                        <div className="flex items-center">
                                            <Eye className="w-3 h-3 mr-1" />
                                            {post.views_count} views
                                        </div>
                                        <div>
                                            {post.comments_count} comments
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                    <div className="flex items-center">
                                        <Calendar className="w-4 h-4 mr-1" />
                                        {new Date(post.created_at).toLocaleDateString()}
                                    </div>
                                    {post.published_at && (
                                        <div className="text-xs text-gray-400 mt-1">
                                            Published: {new Date(post.published_at).toLocaleDateString()}
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <Link
                                            to={`/posts/${post.id}/edit`}
                                            className="btn btn-secondary btn-sm"
                                            title="Edit"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </Link>
                                        <button
                                            onClick={() => handleDelete(post.id)}
                                            className="btn btn-danger btn-sm"
                                            title="Delete"
                                        >
                                            <Trash className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {posts.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        No posts found. Create your first post!
                    </div>
                )}
            </div>

            {/* Pagination */}
            {pagination.total > pagination.limit && (
                <div className="mt-6 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                        Showing {pagination.offset + 1} to {Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total} posts
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handlePageChange(Math.floor(pagination.offset / pagination.limit) - 1)}
                            disabled={pagination.offset === 0}
                            className="btn btn-secondary btn-sm"
                        >
                            Previous
                        </button>
                        {Array.from({ length: pagination.pages }, (_, i) => (
                            <button
                                key={i}
                                onClick={() => handlePageChange(i)}
                                className={`btn btn-sm ${
                                    Math.floor(pagination.offset / pagination.limit) === i
                                        ? 'btn-primary'
                                        : 'btn-secondary'
                                }`}
                            >
                                {i + 1}
                            </button>
                        ))}
                        <button
                            onClick={() => handlePageChange(Math.floor(pagination.offset / pagination.limit) + 1)}
                            disabled={pagination.offset + pagination.limit >= pagination.total}
                            className="btn btn-secondary btn-sm"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {/* Quick Links */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link to="/posts/categories" className="card hover:shadow-lg transition-shadow">
                    <div className="flex items-center">
                        <FolderOpen className="w-8 h-8 text-primary-600 mr-4" />
                        <div>
                            <div className="font-semibold">Categories</div>
                            <div className="text-sm text-gray-500">Manage post categories</div>
                        </div>
                    </div>
                </Link>

                <Link to="/posts/tags" className="card hover:shadow-lg transition-shadow">
                    <div className="flex items-center">
                        <Tag className="w-8 h-8 text-primary-600 mr-4" />
                        <div>
                            <div className="font-semibold">Tags</div>
                            <div className="text-sm text-gray-500">Manage post tags</div>
                        </div>
                    </div>
                </Link>

                <Link to="/posts/comments" className="card hover:shadow-lg transition-shadow">
                    <div className="flex items-center">
                        <Filter className="w-8 h-8 text-primary-600 mr-4" />
                        <div>
                            <div className="font-semibold">Comments</div>
                            <div className="text-sm text-gray-500">Moderate comments</div>
                        </div>
                    </div>
                </Link>
            </div>
        </div>
    );
}

export default PostsList;
