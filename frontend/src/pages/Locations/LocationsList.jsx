import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Plus,
    Edit,
    Trash,
    MapPin,
    Users,
    Building,
    Search,
    Globe
} from 'lucide-react';
import api from '../../services/api';

function LocationsList() {
    const { t } = useTranslation();
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        is_active: 'true',
        type: '',
        country: '',
        search: ''
    });

    useEffect(() => {
        loadLocations();
    }, [filters]);

    const loadLocations = async () => {
        try {
            setLoading(true);
            const params = {
                ...filters,
                include_user_count: true
            };

            // Remove empty filters
            Object.keys(params).forEach(key => {
                if (params[key] === '') delete params[key];
            });

            const response = await api.get('/locations', { params });
            setLocations(response.data.data);
        } catch (error) {
            console.error('Error loading locations:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this location?')) return;

        try {
            await api.delete(`/locations/${id}`);
            loadLocations();
        } catch (error) {
            console.error('Error deleting location:', error);
            alert(error.response?.data?.message || 'Failed to delete location');
        }
    };

    const handleFilterChange = (key, value) => {
        setFilters({ ...filters, [key]: value });
    };

    const getTypeIcon = (type) => {
        const icons = {
            office: Building,
            branch: MapPin,
            warehouse: Building,
            remote: Globe,
            hybrid: Globe
        };
        const Icon = icons[type] || Building;
        return <Icon className="w-4 h-4" />;
    };

    const getTypeBadgeClass = (type) => {
        const classes = {
            office: 'bg-blue-100 text-blue-700',
            branch: 'bg-green-100 text-green-700',
            warehouse: 'bg-orange-100 text-orange-700',
            remote: 'bg-purple-100 text-purple-700',
            hybrid: 'bg-pink-100 text-pink-700'
        };
        return classes[type] || 'bg-gray-100 text-gray-700';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading locations...</div>
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold">Locations</h1>
                    <p className="text-gray-600 mt-1">Manage company locations and sites</p>
                </div>
                <Link to="/locations/new" className="btn btn-primary">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Location
                </Link>
            </div>

            {/* Filters */}
            <div className="card mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search locations..."
                            className="input pl-10"
                            value={filters.search}
                            onChange={(e) => handleFilterChange('search', e.target.value)}
                        />
                    </div>

                    <div>
                        <select
                            className="input"
                            value={filters.is_active}
                            onChange={(e) => handleFilterChange('is_active', e.target.value)}
                        >
                            <option value="">All Statuses</option>
                            <option value="true">Active</option>
                            <option value="false">Inactive</option>
                        </select>
                    </div>

                    <div>
                        <select
                            className="input"
                            value={filters.type}
                            onChange={(e) => handleFilterChange('type', e.target.value)}
                        >
                            <option value="">All Types</option>
                            <option value="office">Office</option>
                            <option value="branch">Branch</option>
                            <option value="warehouse">Warehouse</option>
                            <option value="remote">Remote</option>
                            <option value="hybrid">Hybrid</option>
                        </select>
                    </div>

                    <div>
                        <input
                            type="text"
                            placeholder="Country Code (DE, US...)"
                            className="input"
                            value={filters.country}
                            onChange={(e) => handleFilterChange('country', e.target.value.toUpperCase())}
                            maxLength={2}
                        />
                    </div>
                </div>
            </div>

            {/* Locations Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {locations.map((location) => (
                    <div key={location.id} className="card hover:shadow-lg transition-shadow">
                        {location.image_url && (
                            <img
                                src={location.image_url}
                                alt={location.name}
                                className="w-full h-40 object-cover rounded-t-lg"
                            />
                        )}

                        <div className="p-6">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        {location.is_headquarters && (
                                            <span className="inline-block px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded font-medium">
                                                HQ
                                            </span>
                                        )}
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded ${getTypeBadgeClass(location.type)}`}>
                                            {getTypeIcon(location.type)}
                                            {location.type}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-bold">{location.name}</h3>
                                    <p className="text-sm text-gray-500">{location.code}</p>
                                </div>
                            </div>

                            {/* Address */}
                            <div className="mb-4 text-sm text-gray-600">
                                {location.street && <div>{location.street}</div>}
                                {(location.postal_code || location.city) && (
                                    <div>
                                        {location.postal_code} {location.city}
                                    </div>
                                )}
                                {location.country && (
                                    <div className="font-medium">{location.country}</div>
                                )}
                            </div>

                            {/* Stats */}
                            <div className="flex items-center gap-4 mb-4 text-sm text-gray-600">
                                <div className="flex items-center">
                                    <Users className="w-4 h-4 mr-1" />
                                    {location.user_count || 0} employees
                                </div>
                                {location.manager_name && (
                                    <div className="text-xs">
                                        Manager: {location.manager_name}
                                    </div>
                                )}
                            </div>

                            {/* Contact */}
                            {(location.phone || location.email) && (
                                <div className="mb-4 text-xs text-gray-500 space-y-1">
                                    {location.phone && <div>📞 {location.phone}</div>}
                                    {location.email && <div>✉️ {location.email}</div>}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center justify-between pt-4 border-t">
                                <Link
                                    to={`/locations/${location.id}`}
                                    className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                                >
                                    View Details
                                </Link>
                                <div className="flex gap-2">
                                    <Link
                                        to={`/locations/${location.id}/edit`}
                                        className="btn btn-secondary btn-sm"
                                        title="Edit"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </Link>
                                    <button
                                        onClick={() => handleDelete(location.id)}
                                        className="btn btn-danger btn-sm"
                                        title="Delete"
                                    >
                                        <Trash className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {locations.length === 0 && (
                <div className="card text-center py-12">
                    <MapPin className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-500">No locations found. Add your first location!</p>
                </div>
            )}
        </div>
    );
}

export default LocationsList;
