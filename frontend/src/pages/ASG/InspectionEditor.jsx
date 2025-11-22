/**
 * ASG Inspection Editor - Kontrolle erstellen/bearbeiten
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function InspectionEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [locations, setLocations] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [users, setUsers] = useState([]);

  const [formData, setFormData] = useState({
    location_id: '',
    department: '',
    work_area: '',
    checklist_id: '',
    inspection_type: 'regular',
    supervisor_id: '',
    safety_officer_id: '',
    inspection_date: new Date().toISOString().split('T')[0],
    general_notes: ''
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchInitialData();
  }, [id]);

  const fetchInitialData = async () => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      // Fetch locations, checklists, users in parallel
      const [locRes, checkRes, usersRes] = await Promise.all([
        fetch(`${API_URL}/api/locations`, { headers }),
        fetch(`${API_URL}/api/asg/checklists?is_active=true`, { headers }),
        fetch(`${API_URL}/api/admin/users`, { headers })
      ]);

      const [locData, checkData, usersData] = await Promise.all([
        locRes.json(),
        checkRes.json(),
        usersRes.json()
      ]);

      if (locData.success) setLocations(locData.data || []);
      if (checkData.success) setChecklists(checkData.data || []);
      if (usersData.success) setUsers(usersData.data || []);

      // If editing, fetch inspection
      if (!isNew) {
        const res = await fetch(`${API_URL}/api/asg/inspections/${id}`, { headers });
        const data = await res.json();
        if (data.success) {
          setFormData({
            location_id: data.data.location_id || '',
            department: data.data.department || '',
            work_area: data.data.work_area || '',
            checklist_id: data.data.checklist_id || '',
            inspection_type: data.data.inspection_type || 'regular',
            supervisor_id: data.data.supervisor_id || '',
            safety_officer_id: data.data.safety_officer_id || '',
            inspection_date: data.data.inspection_date?.split('T')[0] || '',
            general_notes: data.data.general_notes || ''
          });
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.inspection_date) newErrors.inspection_date = 'Datum ist erforderlich';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const url = isNew
        ? `${API_URL}/api/asg/inspections`
        : `${API_URL}/api/asg/inspections/${id}`;

      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (data.success) {
        navigate(`/asg/inspections/${data.data.id}`);
      } else {
        setErrors({ submit: data.message || 'Fehler beim Speichern' });
      }
    } catch (error) {
      console.error('Error saving:', error);
      setErrors({ submit: 'Netzwerkfehler' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isNew ? 'Neue Sicherheitskontrolle' : 'Kontrolle bearbeiten'}
        </h1>
        <p className="text-gray-600">Erfassen Sie die Kontrolldaten</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {errors.submit && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {errors.submit}
          </div>
        )}

        {/* Standort & Bereich */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Standort & Bereich</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Standort / Filiale
              </label>
              <select
                name="location_id"
                value={formData.location_id}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="">Standort waehlen...</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name} ({loc.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Abteilung
              </label>
              <input
                type="text"
                name="department"
                value={formData.department}
                onChange={handleChange}
                placeholder="z.B. Produktion, Lager, Buero"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Arbeitsbereich (Details)
              </label>
              <input
                type="text"
                name="work_area"
                value={formData.work_area}
                onChange={handleChange}
                placeholder="z.B. Halle 3, Etage 2, Raum 201"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>
        </div>

        {/* Kontrolle */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Kontrolldetails</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pruefliste
              </label>
              <select
                name="checklist_id"
                value={formData.checklist_id}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="">Pruefliste waehlen...</option>
                {checklists.map(cl => (
                  <option key={cl.id} value={cl.id}>{cl.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kontrollart
              </label>
              <select
                name="inspection_type"
                value={formData.inspection_type}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="regular">Regelmässige Kontrolle</option>
                <option value="incident">Nach Vorfall</option>
                <option value="follow_up">Nachkontrolle</option>
                <option value="audit">Audit</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Datum der Kontrolle *
              </label>
              <input
                type="date"
                name="inspection_date"
                value={formData.inspection_date}
                onChange={handleChange}
                className={`w-full border rounded-lg px-3 py-2 ${errors.inspection_date ? 'border-red-500' : 'border-gray-300'}`}
              />
              {errors.inspection_date && (
                <p className="text-red-500 text-sm mt-1">{errors.inspection_date}</p>
              )}
            </div>
          </div>
        </div>

        {/* Verantwortliche */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Verantwortliche</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vorgesetzter
              </label>
              <select
                name="supervisor_id"
                value={formData.supervisor_id}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="">Waehlen...</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.name || user.username}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sicherheitsbeauftragter
              </label>
              <select
                name="safety_officer_id"
                value={formData.safety_officer_id}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="">Waehlen...</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.name || user.username}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Notizen */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Allgemeine Anmerkungen</h2>
          <textarea
            name="general_notes"
            value={formData.general_notes}
            onChange={handleChange}
            rows={4}
            placeholder="Zusaetzliche Hinweise zur Kontrolle..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            )}
            {isNew ? 'Kontrolle erstellen' : 'Speichern'}
          </button>
        </div>
      </form>
    </div>
  );
}
