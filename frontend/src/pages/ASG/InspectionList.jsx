/**
 * ASG Inspection List - Kontrollen-Uebersicht
 */
import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const statusLabels = {
  draft: 'Entwurf',
  in_progress: 'In Bearbeitung',
  pending_review: 'Pruefung ausstehend',
  completed: 'Abgeschlossen',
  archived: 'Archiviert'
};

const statusColors = {
  draft: 'bg-gray-100 text-gray-800',
  in_progress: 'bg-blue-100 text-blue-800',
  pending_review: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  archived: 'bg-purple-100 text-purple-800'
};

export default function InspectionList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [inspections, setInspections] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  const filters = {
    status: searchParams.get('status') || '',
    location_id: searchParams.get('location_id') || ''
  };

  useEffect(() => {
    fetchInspections();
    fetchLocations();
  }, [searchParams]);

  const fetchInspections = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.location_id) params.append('location_id', filters.location_id);

      const res = await fetch(`${API_URL}/api/asg/inspections?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setInspections(data.data);
    } catch (error) {
      console.error('Error fetching inspections:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLocations = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/locations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setLocations(data.data || []);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  const updateFilter = (key, value) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sicherheitskontrollen</h1>
          <p className="text-gray-600">{inspections.length} Kontrollen</p>
        </div>
        <Link
          to="/asg/inspections/new"
          className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neue Kontrolle
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => updateFilter('status', e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 min-w-[150px]"
            >
              <option value="">Alle Status</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Standort</label>
            <select
              value={filters.location_id}
              onChange={(e) => updateFilter('location_id', e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 min-w-[150px]"
            >
              <option value="">Alle Standorte</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
        </div>
      ) : inspections.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">Keine Kontrollen gefunden</h3>
          <p className="mt-2 text-gray-500">Erstellen Sie eine neue Sicherheitskontrolle.</p>
          <Link
            to="/asg/inspections/new"
            className="mt-4 inline-flex items-center px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700"
          >
            Neue Kontrolle erstellen
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kontrolle
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Standort / Bereich
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pruefer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Maengel
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Datum
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Aktionen</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {inspections.map((inspection) => (
                <tr key={inspection.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link to={`/asg/inspections/${inspection.id}`} className="text-sky-600 hover:text-sky-700 font-medium">
                      {inspection.inspection_number}
                    </Link>
                    {inspection.checklist_name && (
                      <p className="text-sm text-gray-500">{inspection.checklist_name}</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-gray-900">{inspection.location_name || '-'}</p>
                    <p className="text-sm text-gray-500">{inspection.department || '-'}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-gray-900">{inspection.inspector_full_name || inspection.inspector_name}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {inspection.total_defects > 0 ? (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-900">{inspection.total_defects}</span>
                        {inspection.critical_defects > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                            {inspection.critical_defects} kritisch
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[inspection.status]}`}>
                      {statusLabels[inspection.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {new Date(inspection.inspection_date).toLocaleDateString('de-DE')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link to={`/asg/inspections/${inspection.id}`} className="text-sky-600 hover:text-sky-700">
                      Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
