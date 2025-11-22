/**
 * ASG Dashboard - Arbeitssicherheit & Gesundheit Uebersicht
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Danger level colors
const dangerColors = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800'
};

const dangerLabels = {
  low: 'Gering',
  medium: 'Mittel',
  high: 'Hoch',
  critical: 'Kritisch'
};

export default function ASGDashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [recentInspections, setRecentInspections] = useState([]);
  const [openDefects, setOpenDefects] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [statsRes, inspectionsRes, defectsRes, tasksRes] = await Promise.all([
        fetch(`${API_URL}/api/asg/statistics`, { headers }),
        fetch(`${API_URL}/api/asg/inspections?limit=5`, { headers }),
        fetch(`${API_URL}/api/asg/defects?overdue=true`, { headers }),
        fetch(`${API_URL}/api/asg/my-tasks`, { headers })
      ]);

      const [statsData, inspectionsData, defectsData, tasksData] = await Promise.all([
        statsRes.json(),
        inspectionsRes.json(),
        defectsRes.json(),
        tasksRes.json()
      ]);

      if (statsData.success) setStats(statsData.data);
      if (inspectionsData.success) setRecentInspections(inspectionsData.data);
      if (defectsData.success) setOpenDefects(defectsData.data);
      if (tasksData.success) setMyTasks(tasksData.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Arbeitssicherheit & Gesundheit</h1>
          <p className="text-gray-600">Kontrollblatt-System nach BGHW</p>
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

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-sky-100 rounded-lg">
                <svg className="w-6 h-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Kontrollen</p>
                <p className="text-2xl font-bold">{stats.inspections?.total || 0}</p>
              </div>
            </div>
            <div className="mt-4 text-sm text-gray-500">
              {stats.inspections?.completed || 0} abgeschlossen
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Offene Maengel</p>
                <p className="text-2xl font-bold">{stats.defects?.open || 0}</p>
              </div>
            </div>
            <div className="mt-4 text-sm text-gray-500">
              {stats.defects?.critical || 0} kritisch
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-red-100 rounded-lg">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Ueberfaellig</p>
                <p className="text-2xl font-bold text-red-600">{stats.overdue || 0}</p>
              </div>
            </div>
            <div className="mt-4 text-sm text-red-500">
              Sofortige Bearbeitung erforderlich
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Behoben</p>
                <p className="text-2xl font-bold text-green-600">{stats.defects?.resolved || 0}</p>
              </div>
            </div>
            <div className="mt-4 text-sm text-gray-500">
              Von {stats.defects?.total || 0} gesamt
            </div>
          </div>
        </div>
      )}

      {/* My Tasks */}
      {myTasks.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Meine Aufgaben</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {myTasks.slice(0, 5).map((task) => (
              <Link
                key={task.id}
                to={`/asg/defects/${task.id}`}
                className="block px-6 py-4 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{task.title}</p>
                    <p className="text-sm text-gray-500">{task.location_name} - {task.location_detail}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${dangerColors[task.danger_level]}`}>
                      {dangerLabels[task.danger_level]}
                    </span>
                    {task.deadline && (
                      <span className={`text-sm ${new Date(task.deadline) < new Date() ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                        Frist: {new Date(task.deadline).toLocaleDateString('de-DE')}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Inspections */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold">Letzte Kontrollen</h2>
            <Link to="/asg/inspections" className="text-sky-600 hover:text-sky-700 text-sm">
              Alle anzeigen
            </Link>
          </div>
          <div className="divide-y divide-gray-200">
            {recentInspections.length === 0 ? (
              <p className="px-6 py-8 text-center text-gray-500">Keine Kontrollen vorhanden</p>
            ) : (
              recentInspections.map((inspection) => (
                <Link
                  key={inspection.id}
                  to={`/asg/inspections/${inspection.id}`}
                  className="block px-6 py-4 hover:bg-gray-50"
                >
                  <div className="flex justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{inspection.inspection_number}</p>
                      <p className="text-sm text-gray-500">
                        {inspection.location_name || 'Kein Standort'} - {inspection.department || 'Keine Abteilung'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                        inspection.status === 'completed' ? 'bg-green-100 text-green-800' :
                        inspection.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {inspection.status === 'completed' ? 'Abgeschlossen' :
                         inspection.status === 'in_progress' ? 'In Bearbeitung' : 'Entwurf'}
                      </span>
                      <p className="text-sm text-gray-500 mt-1">
                        {new Date(inspection.inspection_date).toLocaleDateString('de-DE')}
                      </p>
                    </div>
                  </div>
                  {inspection.total_defects > 0 && (
                    <div className="mt-2 flex gap-2 text-sm">
                      <span className="text-gray-500">{inspection.total_defects} Maengel</span>
                      {inspection.critical_defects > 0 && (
                        <span className="text-red-600">{inspection.critical_defects} kritisch</span>
                      )}
                      <span className="text-green-600">{inspection.resolved_defects} behoben</span>
                    </div>
                  )}
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Overdue Defects */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-red-600">Ueberfaellige Maengel</h2>
            <Link to="/asg/defects?overdue=true" className="text-sky-600 hover:text-sky-700 text-sm">
              Alle anzeigen
            </Link>
          </div>
          <div className="divide-y divide-gray-200">
            {openDefects.length === 0 ? (
              <p className="px-6 py-8 text-center text-green-600">Keine ueberfaelligen Maengel</p>
            ) : (
              openDefects.slice(0, 5).map((defect) => (
                <Link
                  key={defect.id}
                  to={`/asg/defects/${defect.id}`}
                  className="block px-6 py-4 hover:bg-gray-50"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900">{defect.title}</p>
                      <p className="text-sm text-gray-500">{defect.location_name}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${dangerColors[defect.danger_level]}`}>
                      {dangerLabels[defect.danger_level]}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <span className="text-red-600 font-medium">
                      Frist: {new Date(defect.deadline).toLocaleDateString('de-DE')}
                    </span>
                    {defect.responsible_name && (
                      <span className="text-gray-500">| {defect.responsible_name}</span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          to="/asg/checklists"
          className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow text-center"
        >
          <svg className="w-8 h-8 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="mt-2 text-sm font-medium text-gray-900">Prueflisten</p>
        </Link>
        <Link
          to="/asg/inspections"
          className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow text-center"
        >
          <svg className="w-8 h-8 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="mt-2 text-sm font-medium text-gray-900">Alle Kontrollen</p>
        </Link>
        <Link
          to="/asg/defects"
          className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow text-center"
        >
          <svg className="w-8 h-8 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="mt-2 text-sm font-medium text-gray-900">Maengel</p>
        </Link>
        <Link
          to="/asg/reports"
          className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow text-center"
        >
          <svg className="w-8 h-8 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-2 text-sm font-medium text-gray-900">Berichte</p>
        </Link>
      </div>
    </div>
  );
}
