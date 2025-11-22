/**
 * Evacuation Dashboard - Evakuierungs- & Fluchtweg-Management
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const severityColors = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800'
};

const statusLabels = {
  planned: 'Geplant',
  preparation: 'Vorbereitung',
  in_progress: 'Laufend',
  completed: 'Abgeschlossen',
  cancelled: 'Abgesagt'
};

export default function EvacuationDashboard() {
  const [stats, setStats] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [findings, setFindings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [statsRes, buildingsRes, exercisesRes, findingsRes] = await Promise.all([
        fetch(`${API_URL}/api/eva/statistics`, { headers }),
        fetch(`${API_URL}/api/eva/buildings`, { headers }),
        fetch(`${API_URL}/api/eva/exercises`, { headers }),
        fetch(`${API_URL}/api/eva/findings?status=open`, { headers })
      ]);

      const [statsData, buildingsData, exercisesData, findingsData] = await Promise.all([
        statsRes.json(), buildingsRes.json(), exercisesRes.json(), findingsRes.json()
      ]);

      if (statsData.success) setStats(statsData.data);
      if (buildingsData.success) setBuildings(buildingsData.data);
      if (exercisesData.success) setExercises(exercisesData.data);
      if (findingsData.success) setFindings(findingsData.data);
    } catch (error) {
      console.error('Error:', error);
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

  const upcomingExercises = exercises.filter(e => e.status === 'planned' || e.status === 'preparation');
  const openFindings = findings.filter(f => f.status === 'open');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Evakuierung & Fluchtwege</h1>
          <p className="text-gray-600">Management nach TUEV SUD Checklisten</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/eva/exercises/new"
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Neue Uebung planen
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Gebaeude</p>
                <p className="text-2xl font-bold">{stats.buildings}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-red-100 rounded-lg">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Uebungen</p>
                <p className="text-2xl font-bold">{stats.exercises?.total || 0}</p>
              </div>
            </div>
            <div className="mt-4 text-sm text-gray-500">
              {stats.exercises?.completed || 0} abgeschlossen
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
                <p className="text-sm text-gray-500">Offene Feststellungen</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.findings?.open || 0}</p>
              </div>
            </div>
            <div className="mt-4 text-sm text-gray-500">
              {stats.findings?.critical || 0} kritisch
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
                <p className="text-2xl font-bold text-green-600">{stats.findings?.resolved || 0}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Buildings */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold">Gebaeude</h2>
            <Link to="/eva/buildings" className="text-sky-600 hover:text-sky-700 text-sm">
              Alle anzeigen
            </Link>
          </div>
          <div className="divide-y divide-gray-200">
            {buildings.length === 0 ? (
              <p className="px-6 py-8 text-center text-gray-500">Keine Gebaeude erfasst</p>
            ) : (
              buildings.slice(0, 5).map((building) => (
                <Link
                  key={building.id}
                  to={`/eva/buildings/${building.id}`}
                  className="block px-6 py-4 hover:bg-gray-50"
                >
                  <div className="flex justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{building.name}</p>
                      <p className="text-sm text-gray-500">
                        {building.location_name || 'Kein Standort'} | {building.floors} Etage(n)
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">{building.max_occupancy || '-'} Personen</p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Upcoming Exercises */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold">Geplante Uebungen</h2>
            <Link to="/eva/exercises" className="text-sky-600 hover:text-sky-700 text-sm">
              Alle anzeigen
            </Link>
          </div>
          <div className="divide-y divide-gray-200">
            {upcomingExercises.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <p className="text-gray-500">Keine Uebungen geplant</p>
                <Link
                  to="/eva/exercises/new"
                  className="mt-2 inline-flex items-center text-sky-600 hover:text-sky-700"
                >
                  Uebung planen
                </Link>
              </div>
            ) : (
              upcomingExercises.slice(0, 5).map((exercise) => (
                <Link
                  key={exercise.id}
                  to={`/eva/exercises/${exercise.id}`}
                  className="block px-6 py-4 hover:bg-gray-50"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-900">{exercise.exercise_number}</p>
                      <p className="text-sm text-gray-500">{exercise.building_name}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                        exercise.status === 'planned' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {statusLabels[exercise.status]}
                      </span>
                      <p className="text-sm text-gray-500 mt-1">
                        {new Date(exercise.planned_date).toLocaleDateString('de-DE')}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Open Findings */}
      {openFindings.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-yellow-600">Offene Feststellungen</h2>
            <Link to="/eva/findings" className="text-sky-600 hover:text-sky-700 text-sm">
              Alle anzeigen
            </Link>
          </div>
          <div className="divide-y divide-gray-200">
            {openFindings.slice(0, 5).map((finding) => (
              <div key={finding.id} className="px-6 py-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900">{finding.title}</p>
                    <p className="text-sm text-gray-500">{finding.location_detail}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${severityColors[finding.severity]}`}>
                    {finding.severity === 'critical' ? 'Kritisch' :
                     finding.severity === 'high' ? 'Hoch' :
                     finding.severity === 'medium' ? 'Mittel' : 'Gering'}
                  </span>
                </div>
                {finding.due_date && (
                  <p className={`text-sm mt-2 ${new Date(finding.due_date) < new Date() ? 'text-red-600' : 'text-gray-500'}`}>
                    Frist: {new Date(finding.due_date).toLocaleDateString('de-DE')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link to="/eva/buildings" className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow text-center">
          <svg className="w-8 h-8 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <p className="mt-2 text-sm font-medium text-gray-900">Gebaeude</p>
        </Link>
        <Link to="/eva/exercises" className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow text-center">
          <svg className="w-8 h-8 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <p className="mt-2 text-sm font-medium text-gray-900">Uebungen</p>
        </Link>
        <Link to="/eva/checklists" className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow text-center">
          <svg className="w-8 h-8 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <p className="mt-2 text-sm font-medium text-gray-900">Checklisten</p>
        </Link>
        <Link to="/eva/findings" className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow text-center">
          <svg className="w-8 h-8 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="mt-2 text-sm font-medium text-gray-900">Feststellungen</p>
        </Link>
      </div>
    </div>
  );
}
