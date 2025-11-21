import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit, Trash, Tag as TagIcon, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

function TagManager() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [tags, setTags] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingTag, setEditingTag] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        description: ''
    });

    useEffect(() => {
        loadTags();
    }, []);

    const loadTags = async () => {
        try {
            setLoading(true);
            const response = await api.get('/posts/tags', {
                params: { include_post_count: true }
            });
            setTags(response.data.data);
        } catch (error) {
            console.error('Error loading tags:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (tag = null) => {
        if (tag) {
            setEditingTag(tag);
            setFormData({
                name: tag.name,
                slug: tag.slug,
                description: tag.description || ''
            });
        } else {
            setEditingTag(null);
            setFormData({
                name: '',
                slug: '',
                description: ''
            });
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingTag(null);
        setFormData({ name: '', slug: '', description: '' });
    };

    const handleChange = (field, value) => {
        setFormData({ ...formData, [field]: value });

        // Auto-generate slug from name
        if (field === 'name' && !editingTag) {
            const slug = value
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-');
            setFormData(prev => ({ ...prev, slug }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            if (editingTag) {
                await api.put(`/posts/tags/${editingTag.id}`, formData);
            } else {
                await api.post('/posts/tags', formData);
            }
            loadTags();
            handleCloseModal();
        } catch (error) {
            console.error('Error saving tag:', error);
            alert('Failed to save tag: ' + (error.response?.data?.message || error.message));
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure? This tag will be removed from all posts.')) return;

        try {
            await api.delete(`/posts/tags/${id}`);
            loadTags();
        } catch (error) {
            console.error('Error deleting tag:', error);
            alert('Failed to delete tag');
        }
    };

    if (loading) {
        return <div className="text-center py-12">Loading tags...</div>;
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/posts')}
                        className="btn btn-secondary"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold">Tags</h1>
                        <p className="text-gray-600 mt-1">Manage your post tags</p>
                    </div>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="btn btn-primary"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    New Tag
                </button>
            </div>

            <div className="card overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Tag
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Slug
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Posts
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {tags.map((tag) => (
                            <tr key={tag.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4">
                                    <div className="flex items-center">
                                        <TagIcon className="w-4 h-4 text-primary-600 mr-2" />
                                        <div>
                                            <div className="font-semibold">{tag.name}</div>
                                            {tag.description && (
                                                <div className="text-sm text-gray-500">
                                                    {tag.description}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                    {tag.slug}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                    {tag.post_count || 0} posts
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => handleOpenModal(tag)}
                                            className="btn btn-secondary btn-sm"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(tag.id)}
                                            className="btn btn-danger btn-sm"
                                        >
                                            <Trash className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {tags.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        No tags yet. Create your first tag!
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full">
                        <h2 className="text-xl font-bold mb-4">
                            {editingTag ? 'Edit Tag' : 'New Tag'}
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Name *</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={formData.name}
                                    onChange={(e) => handleChange('name', e.target.value)}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Slug *</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={formData.slug}
                                    onChange={(e) => handleChange('slug', e.target.value)}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Description</label>
                                <textarea
                                    className="input"
                                    rows="3"
                                    value={formData.description}
                                    onChange={(e) => handleChange('description', e.target.value)}
                                />
                            </div>

                            <div className="flex gap-2 justify-end mt-6">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="btn btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {editingTag ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TagManager;
