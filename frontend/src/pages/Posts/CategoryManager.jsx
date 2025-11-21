import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit, Trash, FolderOpen, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

function CategoryManager() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        description: '',
        color: '#3b82f6',
        parent_id: null
    });

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        try {
            setLoading(true);
            const response = await api.get('/posts/categories', {
                params: { include_post_count: true }
            });
            setCategories(response.data.data);
        } catch (error) {
            console.error('Error loading categories:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (category = null) => {
        if (category) {
            setEditingCategory(category);
            setFormData({
                name: category.name,
                slug: category.slug,
                description: category.description || '',
                color: category.color || '#3b82f6',
                parent_id: category.parent_id
            });
        } else {
            setEditingCategory(null);
            setFormData({
                name: '',
                slug: '',
                description: '',
                color: '#3b82f6',
                parent_id: null
            });
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingCategory(null);
        setFormData({
            name: '',
            slug: '',
            description: '',
            color: '#3b82f6',
            parent_id: null
        });
    };

    const handleChange = (field, value) => {
        setFormData({ ...formData, [field]: value });

        // Auto-generate slug from name
        if (field === 'name' && !editingCategory) {
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
            if (editingCategory) {
                await api.put(`/posts/categories/${editingCategory.id}`, formData);
            } else {
                await api.post('/posts/categories', formData);
            }
            loadCategories();
            handleCloseModal();
        } catch (error) {
            console.error('Error saving category:', error);
            alert('Failed to save category: ' + (error.response?.data?.message || error.message));
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure? Posts in this category will be uncategorized.')) return;

        try {
            await api.delete(`/posts/categories/${id}`);
            loadCategories();
        } catch (error) {
            console.error('Error deleting category:', error);
            alert('Failed to delete category');
        }
    };

    if (loading) {
        return <div className="text-center py-12">Loading categories...</div>;
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
                        <h1 className="text-3xl font-bold">Categories</h1>
                        <p className="text-gray-600 mt-1">Organize your posts</p>
                    </div>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="btn btn-primary"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    New Category
                </button>
            </div>

            <div className="card overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Category
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
                        {categories.map((category) => (
                            <tr key={category.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4">
                                    <div className="flex items-center">
                                        <div
                                            className="w-4 h-4 rounded mr-3"
                                            style={{ backgroundColor: category.color || '#3b82f6' }}
                                        />
                                        <div>
                                            <div className="font-semibold">{category.name}</div>
                                            {category.description && (
                                                <div className="text-sm text-gray-500">
                                                    {category.description}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                    {category.slug}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                    {category.post_count || 0} posts
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => handleOpenModal(category)}
                                            className="btn btn-secondary btn-sm"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(category.id)}
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

                {categories.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        No categories yet. Create your first category!
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full">
                        <h2 className="text-xl font-bold mb-4">
                            {editingCategory ? 'Edit Category' : 'New Category'}
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

                            <div>
                                <label className="block text-sm font-medium mb-1">Color</label>
                                <div className="flex gap-2">
                                    <input
                                        type="color"
                                        className="h-10 w-20 rounded border border-gray-300"
                                        value={formData.color}
                                        onChange={(e) => handleChange('color', e.target.value)}
                                    />
                                    <input
                                        type="text"
                                        className="input flex-1"
                                        value={formData.color}
                                        onChange={(e) => handleChange('color', e.target.value)}
                                    />
                                </div>
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
                                    {editingCategory ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CategoryManager;
