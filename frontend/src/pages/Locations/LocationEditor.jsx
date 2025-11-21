import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Save, ArrowLeft, MapPin } from 'lucide-react';
import api from '../../services/api';

function LocationEditor() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdit = Boolean(id);

    const [location, setLocation] = useState({
        name: '',
        code: '',
        type: 'office',
        parent_id: null,
        street: '',
        street2: '',
        postal_code: '',
        city: '',
        state: '',
        country: 'DE',
        phone: '',
        fax: '',
        email: '',
        website: '',
        latitude: null,
        longitude: null,
        timezone: 'Europe/Berlin',
        capacity: null,
        is_headquarters: false,
        is_active: true,
        image_url: '',
        logo_url: ''
    });

    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('basic');

    useEffect(() => {
        loadLocations();
        if (isEdit) {
            loadLocation();
        }
    }, [id]);

    const loadLocations = async () => {
        try {
            const response = await api.get('/locations', { params: { is_active: true } });
            setLocations(response.data.data);
        } catch (error) {
            console.error('Error loading locations:', error);
        }
    };

    const loadLocation = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/locations/${id}`);
            setLocation(response.data.data);
        } catch (error) {
            console.error('Error loading location:', error);
            alert('Failed to load location');
            navigate('/locations');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field, value) => {
        setLocation({ ...location, [field]: value });

        // Auto-generate code from name if creating new
        if (field === 'name' && !isEdit && !location.code) {
            const code = value
                .toUpperCase()
                .replace(/[^A-Z0-9\s]/g, '')
                .replace(/\s+/g, '_')
                .substring(0, 50);
            setLocation(prev => ({ ...prev, code }));
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);

            let response;
            if (isEdit) {
                response = await api.put(`/locations/${id}`, location);
            } else {
                response = await api.post('/locations', location);
            }

            alert(`Location ${isEdit ? 'updated' : 'created'} successfully!`);
            navigate('/locations');
        } catch (error) {
            console.error('Error saving location:', error);
            alert('Failed to save location: ' + (error.response?.data?.message || error.message));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading location...</div>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/locations')}
                        className="btn btn-secondary"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold">
                            {isEdit ? 'Edit Location' : 'New Location'}
                        </h1>
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn btn-primary"
                >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Saving...' : 'Save'}
                </button>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
                <div className="flex gap-4">
                    <button
                        onClick={() => setActiveTab('basic')}
                        className={`pb-3 px-4 border-b-2 transition-colors ${
                            activeTab === 'basic'
                                ? 'border-primary-600 text-primary-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Basic Info
                    </button>
                    <button
                        onClick={() => setActiveTab('address')}
                        className={`pb-3 px-4 border-b-2 transition-colors ${
                            activeTab === 'address'
                                ? 'border-primary-600 text-primary-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Address & Contact
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
                </div>
            </div>

            {/* Basic Info Tab */}
            {activeTab === 'basic' && (
                <div className="card max-w-2xl space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Name *</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="Main Office"
                                value={location.name}
                                onChange={(e) => handleChange('name', e.target.value)}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Code *</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="HQ"
                                value={location.code}
                                onChange={(e) => handleChange('code', e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Type</label>
                            <select
                                className="input"
                                value={location.type}
                                onChange={(e) => handleChange('type', e.target.value)}
                            >
                                <option value="office">Office</option>
                                <option value="branch">Branch</option>
                                <option value="warehouse">Warehouse</option>
                                <option value="remote">Remote</option>
                                <option value="hybrid">Hybrid</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Parent Location</label>
                            <select
                                className="input"
                                value={location.parent_id || ''}
                                onChange={(e) => handleChange('parent_id', e.target.value ? parseInt(e.target.value) : null)}
                            >
                                <option value="">None (Root Location)</option>
                                {locations.filter(l => l.id !== parseInt(id)).map(loc => (
                                    <option key={loc.id} value={loc.id}>
                                        {loc.name} ({loc.code})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Capacity</label>
                        <input
                            type="number"
                            className="input"
                            placeholder="Maximum number of employees"
                            value={location.capacity || ''}
                            onChange={(e) => handleChange('capacity', e.target.value ? parseInt(e.target.value) : null)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Image URL</label>
                        <input
                            type="url"
                            className="input"
                            placeholder="https://example.com/image.jpg"
                            value={location.image_url}
                            onChange={(e) => handleChange('image_url', e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Logo URL</label>
                        <input
                            type="url"
                            className="input"
                            placeholder="https://example.com/logo.png"
                            value={location.logo_url}
                            onChange={(e) => handleChange('logo_url', e.target.value)}
                        />
                    </div>
                </div>
            )}

            {/* Address & Contact Tab */}
            {activeTab === 'address' && (
                <div className="card max-w-2xl space-y-6">
                    <div>
                        <label className="block text-sm font-medium mb-2">Street</label>
                        <input
                            type="text"
                            className="input"
                            placeholder="123 Main Street"
                            value={location.street}
                            onChange={(e) => handleChange('street', e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Street 2</label>
                        <input
                            type="text"
                            className="input"
                            placeholder="Building A, Floor 3"
                            value={location.street2}
                            onChange={(e) => handleChange('street2', e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Postal Code</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="10115"
                                value={location.postal_code}
                                onChange={(e) => handleChange('postal_code', e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">City</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="Berlin"
                                value={location.city}
                                onChange={(e) => handleChange('city', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">State/Province</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="Berlin"
                                value={location.state}
                                onChange={(e) => handleChange('state', e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Country</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="DE"
                                value={location.country}
                                onChange={(e) => handleChange('country', e.target.value.toUpperCase())}
                                maxLength={2}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Latitude</label>
                            <input
                                type="number"
                                step="0.000001"
                                className="input"
                                placeholder="52.520008"
                                value={location.latitude || ''}
                                onChange={(e) => handleChange('latitude', e.target.value ? parseFloat(e.target.value) : null)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Longitude</label>
                            <input
                                type="number"
                                step="0.000001"
                                className="input"
                                placeholder="13.404954"
                                value={location.longitude || ''}
                                onChange={(e) => handleChange('longitude', e.target.value ? parseFloat(e.target.value) : null)}
                            />
                        </div>
                    </div>

                    <hr />

                    <div>
                        <label className="block text-sm font-medium mb-2">Phone</label>
                        <input
                            type="tel"
                            className="input"
                            placeholder="+49 30 12345678"
                            value={location.phone}
                            onChange={(e) => handleChange('phone', e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Fax</label>
                        <input
                            type="tel"
                            className="input"
                            placeholder="+49 30 12345679"
                            value={location.fax}
                            onChange={(e) => handleChange('fax', e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Email</label>
                        <input
                            type="email"
                            className="input"
                            placeholder="office@example.com"
                            value={location.email}
                            onChange={(e) => handleChange('email', e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Website</label>
                        <input
                            type="url"
                            className="input"
                            placeholder="https://example.com"
                            value={location.website}
                            onChange={(e) => handleChange('website', e.target.value)}
                        />
                    </div>
                </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
                <div className="card max-w-2xl space-y-6">
                    <div>
                        <label className="block text-sm font-medium mb-2">Timezone</label>
                        <select
                            className="input"
                            value={location.timezone}
                            onChange={(e) => handleChange('timezone', e.target.value)}
                        >
                            <option value="Europe/Berlin">Europe/Berlin (CET/CEST)</option>
                            <option value="Europe/London">Europe/London (GMT/BST)</option>
                            <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                            <option value="America/New_York">America/New_York (EST/EDT)</option>
                            <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                            <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                            <option value="Asia/Shanghai">Asia/Shanghai (CST)</option>
                        </select>
                    </div>

                    <div className="space-y-3">
                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                className="mr-2"
                                checked={location.is_headquarters}
                                onChange={(e) => handleChange('is_headquarters', e.target.checked)}
                            />
                            <span className="text-sm font-medium">This is the headquarters</span>
                        </label>

                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                className="mr-2"
                                checked={location.is_active}
                                onChange={(e) => handleChange('is_active', e.target.checked)}
                            />
                            <span className="text-sm font-medium">Location is active</span>
                        </label>
                    </div>
                </div>
            )}
        </div>
    );
}

export default LocationEditor;
