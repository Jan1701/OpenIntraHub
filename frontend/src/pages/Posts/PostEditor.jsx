import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Save,
    Eye,
    ArrowLeft,
    Upload,
    X,
    Calendar,
    Tag,
    Settings
} from 'lucide-react';
import api from '../../services/api';

function PostEditor() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdit = Boolean(id);

    const [post, setPost] = useState({
        title: '',
        slug: '',
        excerpt: '',
        content: '',
        featured_image: '',
        featured_image_alt: '',
        featured_image_caption: '',
        category_id: '',
        status: 'draft',
        visibility: 'public',
        is_featured: false,
        is_sticky: false,
        allow_comments: true,
        format: 'standard',
        meta_title: '',
        meta_description: '',
        meta_keywords: '',
        tags: []
    });

    const [categories, setCategories] = useState([]);
    const [allTags, setAllTags] = useState([]);
    const [tagInput, setTagInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('content'); // content, settings, seo

    useEffect(() => {
        loadCategories();
        loadTags();

        if (isEdit) {
            loadPost();
        }
    }, [id]);

    const loadPost = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/posts/${id}`);
            const postData = response.data.data;

            setPost({
                ...postData,
                tags: postData.tags?.map(t => t.name) || []
            });
        } catch (error) {
            console.error('Error loading post:', error);
            alert('Failed to load post');
            navigate('/posts');
        } finally {
            setLoading(false);
        }
    };

    const loadCategories = async () => {
        try {
            const response = await api.get('/posts/categories');
            setCategories(response.data.data);
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    };

    const loadTags = async () => {
        try {
            const response = await api.get('/posts/tags');
            setAllTags(response.data.data);
        } catch (error) {
            console.error('Error loading tags:', error);
        }
    };

    const handleChange = (field, value) => {
        setPost({ ...post, [field]: value });

        // Auto-generate slug from title
        if (field === 'title' && !isEdit) {
            const slug = value
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-');
            setPost(prev => ({ ...prev, slug }));
        }
    };

    const handleAddTag = (tagName) => {
        if (tagName && !post.tags.includes(tagName)) {
            setPost({ ...post, tags: [...post.tags, tagName] });
        }
        setTagInput('');
    };

    const handleRemoveTag = (tagName) => {
        setPost({ ...post, tags: post.tags.filter(t => t !== tagName) });
    };

    const handleSave = async (newStatus = null) => {
        try {
            setSaving(true);

            const dataToSave = {
                ...post,
                status: newStatus || post.status,
                published_at: newStatus === 'published' && !post.published_at
                    ? new Date().toISOString()
                    : post.published_at
            };

            let response;
            if (isEdit) {
                response = await api.put(`/posts/${id}`, dataToSave);
            } else {
                response = await api.post('/posts', dataToSave);
            }

            alert(`Post ${isEdit ? 'updated' : 'created'} successfully!`);
            navigate('/posts');
        } catch (error) {
            console.error('Error saving post:', error);
            alert('Failed to save post: ' + (error.response?.data?.message || error.message));
        } finally {
            setSaving(false);
        }
    };

    const calculateReadingTime = (content) => {
        const wordsPerMinute = 200;
        const words = content.trim().split(/\s+/).length;
        return Math.ceil(words / wordsPerMinute);
    };

    useEffect(() => {
        if (post.content) {
            const readingTime = calculateReadingTime(post.content);
            if (readingTime !== post.reading_time) {
                setPost(prev => ({ ...prev, reading_time: readingTime }));
            }
        }
    }, [post.content]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading post...</div>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/posts')}
                        className="btn btn-secondary"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold">
                            {isEdit ? 'Edit Post' : 'Create New Post'}
                        </h1>
                        {post.reading_time && (
                            <p className="text-sm text-gray-500 mt-1">
                                {post.reading_time} min read
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleSave('draft')}
                        disabled={saving}
                        className="btn btn-secondary"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        Save Draft
                    </button>
                    <button
                        onClick={() => handleSave('published')}
                        disabled={saving}
                        className="btn btn-primary"
                    >
                        {post.status === 'published' ? 'Update' : 'Publish'}
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
                <div className="flex gap-4">
                    <button
                        onClick={() => setActiveTab('content')}
                        className={`pb-3 px-4 border-b-2 transition-colors ${
                            activeTab === 'content'
                                ? 'border-primary-600 text-primary-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Content
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`pb-3 px-4 border-b-2 transition-colors ${
                            activeTab === 'settings'
                                ? 'border-primary-600 text-primary-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Settings
                    </button>
                    <button
                        onClick={() => setActiveTab('seo')}
                        className={`pb-3 px-4 border-b-2 transition-colors ${
                            activeTab === 'seo'
                                ? 'border-primary-600 text-primary-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        SEO
                    </button>
                </div>
            </div>

            {/* Content Tab */}
            {activeTab === 'content' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        {/* Title */}
                        <div className="card">
                            <div>
                                <label className="block text-sm font-medium mb-2">Title *</label>
                                <input
                                    type="text"
                                    className="input text-2xl font-bold"
                                    placeholder="Enter post title..."
                                    value={post.title}
                                    onChange={(e) => handleChange('title', e.target.value)}
                                    required
                                />
                            </div>

                            <div className="mt-4">
                                <label className="block text-sm font-medium mb-2">Slug *</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="post-url-slug"
                                    value={post.slug}
                                    onChange={(e) => handleChange('slug', e.target.value)}
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    URL: /posts/{post.slug || 'your-slug-here'}
                                </p>
                            </div>
                        </div>

                        {/* Excerpt */}
                        <div className="card">
                            <label className="block text-sm font-medium mb-2">Excerpt</label>
                            <textarea
                                className="input"
                                rows="3"
                                placeholder="Brief summary of the post..."
                                value={post.excerpt}
                                onChange={(e) => handleChange('excerpt', e.target.value)}
                            />
                        </div>

                        {/* Content */}
                        <div className="card">
                            <label className="block text-sm font-medium mb-2">Content *</label>
                            <textarea
                                className="input font-mono"
                                rows="20"
                                placeholder="Write your post content here... (Markdown or HTML)"
                                value={post.content}
                                onChange={(e) => handleChange('content', e.target.value)}
                                required
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                Supports Markdown and HTML. Rich text editor will be added in a future update.
                            </p>
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Status */}
                        <div className="card">
                            <label className="block text-sm font-medium mb-2">Status</label>
                            <select
                                className="input"
                                value={post.status}
                                onChange={(e) => handleChange('status', e.target.value)}
                            >
                                <option value="draft">Draft</option>
                                <option value="published">Published</option>
                                <option value="scheduled">Scheduled</option>
                                <option value="archived">Archived</option>
                            </select>
                        </div>

                        {/* Featured Image */}
                        <div className="card">
                            <label className="block text-sm font-medium mb-2">Featured Image</label>
                            {post.featured_image && (
                                <div className="relative mb-2">
                                    <img
                                        src={post.featured_image}
                                        alt={post.featured_image_alt}
                                        className="w-full rounded"
                                    />
                                    <button
                                        onClick={() => handleChange('featured_image', '')}
                                        className="absolute top-2 right-2 btn btn-danger btn-sm"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                            <input
                                type="url"
                                className="input"
                                placeholder="Image URL"
                                value={post.featured_image}
                                onChange={(e) => handleChange('featured_image', e.target.value)}
                            />
                            <input
                                type="text"
                                className="input mt-2"
                                placeholder="Alt text"
                                value={post.featured_image_alt}
                                onChange={(e) => handleChange('featured_image_alt', e.target.value)}
                            />
                        </div>

                        {/* Category */}
                        <div className="card">
                            <label className="block text-sm font-medium mb-2">Category</label>
                            <select
                                className="input"
                                value={post.category_id}
                                onChange={(e) => handleChange('category_id', e.target.value)}
                            >
                                <option value="">Uncategorized</option>
                                {categories.map((cat) => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Tags */}
                        <div className="card">
                            <label className="block text-sm font-medium mb-2">
                                <Tag className="w-4 h-4 inline mr-1" />
                                Tags
                            </label>
                            <div className="flex gap-2 mb-2">
                                <input
                                    type="text"
                                    className="input flex-1"
                                    placeholder="Add tag..."
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddTag(tagInput);
                                        }
                                    }}
                                />
                                <button
                                    onClick={() => handleAddTag(tagInput)}
                                    className="btn btn-secondary"
                                >
                                    Add
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {post.tags.map((tag) => (
                                    <span
                                        key={tag}
                                        className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 text-primary-700 rounded text-sm"
                                    >
                                        {tag}
                                        <button
                                            onClick={() => handleRemoveTag(tag)}
                                            className="hover:text-primary-900"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
                <div className="card max-w-2xl space-y-6">
                    <div>
                        <label className="block text-sm font-medium mb-2">Visibility</label>
                        <select
                            className="input"
                            value={post.visibility}
                            onChange={(e) => handleChange('visibility', e.target.value)}
                        >
                            <option value="public">Public</option>
                            <option value="private">Private</option>
                            <option value="password">Password Protected</option>
                            <option value="members">Members Only</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Post Format</label>
                        <select
                            className="input"
                            value={post.format}
                            onChange={(e) => handleChange('format', e.target.value)}
                        >
                            <option value="standard">Standard</option>
                            <option value="video">Video</option>
                            <option value="audio">Audio</option>
                            <option value="gallery">Gallery</option>
                            <option value="quote">Quote</option>
                            <option value="link">Link</option>
                        </select>
                    </div>

                    <div className="space-y-3">
                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                className="mr-2"
                                checked={post.is_featured}
                                onChange={(e) => handleChange('is_featured', e.target.checked)}
                            />
                            <span className="text-sm font-medium">Featured Post</span>
                        </label>

                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                className="mr-2"
                                checked={post.is_sticky}
                                onChange={(e) => handleChange('is_sticky', e.target.checked)}
                            />
                            <span className="text-sm font-medium">Sticky Post (stays at top)</span>
                        </label>

                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                className="mr-2"
                                checked={post.allow_comments}
                                onChange={(e) => handleChange('allow_comments', e.target.checked)}
                            />
                            <span className="text-sm font-medium">Allow Comments</span>
                        </label>
                    </div>
                </div>
            )}

            {/* SEO Tab */}
            {activeTab === 'seo' && (
                <div className="card max-w-2xl space-y-6">
                    <div>
                        <label className="block text-sm font-medium mb-2">Meta Title</label>
                        <input
                            type="text"
                            className="input"
                            placeholder={post.title || "Post title will be used if empty"}
                            value={post.meta_title}
                            onChange={(e) => handleChange('meta_title', e.target.value)}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            {post.meta_title?.length || 0}/60 characters
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Meta Description</label>
                        <textarea
                            className="input"
                            rows="3"
                            placeholder={post.excerpt || "Post excerpt will be used if empty"}
                            value={post.meta_description}
                            onChange={(e) => handleChange('meta_description', e.target.value)}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            {post.meta_description?.length || 0}/160 characters
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Meta Keywords</label>
                        <input
                            type="text"
                            className="input"
                            placeholder="keyword1, keyword2, keyword3"
                            value={post.meta_keywords}
                            onChange={(e) => handleChange('meta_keywords', e.target.value)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default PostEditor;
