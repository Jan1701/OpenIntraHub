/**
 * ASG Inspection Detail - Kontrolle Details & Maengel
 */
import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const dangerColors = {
  low: 'bg-green-100 text-green-800 border-green-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  critical: 'bg-red-100 text-red-800 border-red-200'
};

const dangerLabels = {
  low: 'Gering',
  medium: 'Mittel',
  high: 'Hoch',
  critical: 'Kritisch'
};

const statusLabels = {
  open: 'Offen',
  in_progress: 'In Bearbeitung',
  pending_verification: 'Pruefung ausstehend',
  resolved: 'Behoben',
  escalated: 'Eskaliert',
  wont_fix: 'Wird nicht behoben'
};

export default function InspectionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [inspection, setInspection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDefectModal, setShowDefectModal] = useState(false);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetchInspection();
    fetchUsers();
  }, [id]);

  const fetchInspection = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/asg/inspections/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setInspection(data.data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setUsers(data.data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const completeInspection = async () => {
    if (!confirm('Kontrolle wirklich abschliessen?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/asg/inspections/${id}/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        fetchInspection();
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Kontrolle nicht gefunden</p>
        <Link to="/asg/inspections" className="text-sky-600 hover:underline mt-2 inline-block">
          Zurueck zur Uebersicht
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link to="/asg" className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">{inspection.inspection_number}</h1>
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${
              inspection.status === 'completed' ? 'bg-green-100 text-green-800' :
              inspection.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {inspection.status === 'completed' ? 'Abgeschlossen' :
               inspection.status === 'in_progress' ? 'In Bearbeitung' : 'Entwurf'}
            </span>
          </div>
          <p className="text-gray-600">
            {inspection.location_name || 'Kein Standort'} | {inspection.department || 'Keine Abteilung'}
          </p>
        </div>
        <div className="flex gap-2">
          {inspection.status !== 'completed' && (
            <>
              <button
                onClick={() => setShowDefectModal(true)}
                className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Mangel erfassen
              </button>
              <button
                onClick={completeInspection}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Abschliessen
              </button>
            </>
          )}
          <Link
            to={`/asg/inspections/${id}/edit`}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Bearbeiten
          </Link>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Kontrollinformationen</h3>
          <dl className="space-y-2">
            <div className="flex justify-between">
              <dt className="text-gray-500">Datum:</dt>
              <dd className="font-medium">{new Date(inspection.inspection_date).toLocaleDateString('de-DE')}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Pruefer:</dt>
              <dd className="font-medium">{inspection.inspector_full_name || inspection.inspector_name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Pruefliste:</dt>
              <dd className="font-medium">{inspection.checklist_name || '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Kontrollart:</dt>
              <dd className="font-medium capitalize">{inspection.inspection_type}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Verantwortliche</h3>
          <dl className="space-y-2">
            <div className="flex justify-between">
              <dt className="text-gray-500">Vorgesetzter:</dt>
              <dd className="font-medium">{inspection.supervisor_full_name || '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Sicherheitsbeauftragter:</dt>
              <dd className="font-medium">{inspection.safety_officer_full_name || '-'}</dd>
            </div>
          </dl>
          {inspection.inspector_signed_at && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-green-600 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Pruefer unterschrieben am {new Date(inspection.inspector_signed_at).toLocaleDateString('de-DE')}
              </p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Maengel-Uebersicht</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold">{inspection.total_defects || 0}</p>
              <p className="text-xs text-gray-500">Gesamt</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{inspection.critical_defects || 0}</p>
              <p className="text-xs text-gray-500">Kritisch</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{inspection.resolved_defects || 0}</p>
              <p className="text-xs text-gray-500">Behoben</p>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <p className="text-2xl font-bold text-yellow-600">
                {(inspection.total_defects || 0) - (inspection.resolved_defects || 0)}
              </p>
              <p className="text-xs text-gray-500">Offen</p>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {inspection.general_notes && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Allgemeine Anmerkungen</h3>
          <p className="text-gray-700 whitespace-pre-wrap">{inspection.general_notes}</p>
        </div>
      )}

      {/* Defects List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold">Erfasste Maengel</h2>
          {inspection.status !== 'completed' && (
            <button
              onClick={() => setShowDefectModal(true)}
              className="text-sky-600 hover:text-sky-700 text-sm flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Mangel hinzufuegen
            </button>
          )}
        </div>

        {(!inspection.defects || inspection.defects.length === 0) ? (
          <div className="p-8 text-center text-gray-500">
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>Keine Maengel erfasst</p>
            <p className="text-sm">Das ist ein gutes Zeichen!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {inspection.defects.map((defect) => (
              <div key={defect.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-medium text-gray-400">#{defect.defect_number}</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${dangerColors[defect.danger_level]}`}>
                        {dangerLabels[defect.danger_level]}
                      </span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        defect.status === 'resolved' ? 'bg-green-100 text-green-800' :
                        defect.status === 'escalated' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {statusLabels[defect.status]}
                      </span>
                    </div>
                    <h4 className="font-medium text-gray-900">{defect.title}</h4>
                    <p className="text-sm text-gray-600 mt-1">{defect.description}</p>
                    <p className="text-sm text-gray-500 mt-2">
                      <span className="font-medium">Ort:</span> {defect.location_detail}
                    </p>
                    {defect.responsible_name && (
                      <p className="text-sm text-gray-500 mt-1">
                        <span className="font-medium">Verantwortlich:</span> {defect.responsible_name}
                        {defect.deadline && (
                          <span className={`ml-2 ${new Date(defect.deadline) < new Date() ? 'text-red-600' : ''}`}>
                            | Frist: {new Date(defect.deadline).toLocaleDateString('de-DE')}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="ml-4">
                    {defect.photos && defect.photos.length > 0 && (
                      <div className="flex -space-x-2">
                        {defect.photos.slice(0, 3).map((photo, idx) => (
                          <img
                            key={idx}
                            src={`${API_URL}${photo.url}`}
                            alt=""
                            className="w-10 h-10 rounded-lg border-2 border-white object-cover"
                          />
                        ))}
                        {defect.photos.length > 3 && (
                          <span className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center text-xs font-medium">
                            +{defect.photos.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                    <Link
                      to={`/asg/defects/${defect.id}`}
                      className="mt-2 text-sky-600 hover:text-sky-700 text-sm block text-right"
                    >
                      Details
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Defect Modal */}
      {showDefectModal && (
        <DefectModal
          inspectionId={id}
          users={users}
          onClose={() => setShowDefectModal(false)}
          onSave={() => {
            setShowDefectModal(false);
            fetchInspection();
          }}
        />
      )}
    </div>
  );
}

// Defect Modal Component
function DefectModal({ inspectionId, users, onClose, onSave }) {
  const fileInputRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location_detail: '',
    danger_level: 'medium',
    category: '',
    responsible_user_id: '',
    deadline: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = async (e) => {
    const files = Array.from(e.target.files);
    // Preview locally
    const newPhotos = files.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));
    setPhotos(prev => [...prev, ...newPhotos]);
  };

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.description || !formData.location_detail) {
      alert('Bitte alle Pflichtfelder ausfuellen');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');

      // First create the defect
      const res = await fetch(`${API_URL}/api/asg/inspections/${inspectionId}/defects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      // Upload photos if any
      for (const photo of photos) {
        const photoForm = new FormData();
        photoForm.append('photo', photo.file);
        photoForm.append('caption', '');

        await fetch(`${API_URL}/api/asg/defects/${data.data.id}/photos`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: photoForm
        });
      }

      onSave();
    } catch (error) {
      console.error('Error:', error);
      alert('Fehler beim Speichern: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold">Neuen Mangel erfassen</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bezeichnung des Mangels *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Kurze Beschreibung des Mangels"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Detaillierte Beschreibung *
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                placeholder="Genaue Beschreibung des Mangels und moeglicher Gefahren"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Genaue Ortsangabe *
              </label>
              <input
                type="text"
                name="location_detail"
                value={formData.location_detail}
                onChange={handleChange}
                placeholder="z.B. Halle 2, Regal 5, oberstes Fach"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gefahrenstufe
                </label>
                <select
                  name="danger_level"
                  value={formData.danger_level}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="low">Gering</option>
                  <option value="medium">Mittel</option>
                  <option value="high">Hoch</option>
                  <option value="critical">Kritisch</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kategorie
                </label>
                <input
                  type="text"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  placeholder="z.B. Brandschutz, Elektrik"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Verantwortlicher
                </label>
                <select
                  name="responsible_user_id"
                  value={formData.responsible_user_id}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="">Nicht zugewiesen</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>{user.name || user.username}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Frist (zu erledigen bis)
                </label>
                <input
                  type="date"
                  name="deadline"
                  value={formData.deadline}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
            </div>

            {/* Photos */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fotos
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {photos.map((photo, idx) => (
                  <div key={idx} className="relative">
                    <img
                      src={photo.preview}
                      alt=""
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-sky-500 hover:text-sky-500"
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoChange}
                className="hidden"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                Mangel erfassen
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
