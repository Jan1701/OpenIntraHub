import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import api from '../../services/api';

export default function FireSafetyDashboard() {
    const { t } = useTranslation();
    const [stats, setStats] = useState(null);
    const [objects, setObjects] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [statsRes, objectsRes] = await Promise.all([
                api.get('/bsm/statistics'),
                api.get('/bsm/objects')
            ]);
            setStats(statsRes.data.data);
            setObjects(objectsRes.data.data);
        } catch (error) {
            console.error('Error loading BSM data:', error);
        } finally {
            setLoading(false);
        }
    };

    const checklistTypes = [
        { key: 'ordnung', label: 'Ordnung & Sauberkeit', icon: '🧹', desc: 'Brandlasten, Lagerung, Sauberkeit' },
        { key: 'infrastruktur', label: 'Brandschutz-Infrastruktur', icon: '🧯', desc: 'Feuerloescher, Melder, Beschilderung' },
        { key: 'fluchtwege', label: 'Fluchtwege', icon: '🚪', desc: 'Ausgaenge, Treppen, Beleuchtung' },
        { key: 'baulich', label: 'Baulicher Brandschutz', icon: '🏗️', desc: 'Brandabschnitte, Tueren, Verkleidungen' },
        { key: 'betrieblich', label: 'Betrieblicher Brandschutz', icon: '📋', desc: 'Organisation, Schulungen, Alarme' }
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Brandschutz-Management</h1>
                    <p className="text-gray-600">TUeV-konformes Brandschutz- und Sicherheitsmanagement</p>
                </div>
                <Link
                    to="/bsm/objects/new"
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                >
                    <span>+</span>
                    <span>Neues Objekt</span>
                </Link>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="text-3xl font-bold text-gray-900">{stats.objects}</div>
                        <div className="text-gray-600">Objekte</div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="text-3xl font-bold text-red-600">{stats.defects?.open || 0}</div>
                        <div className="text-gray-600">Offene Maengel</div>
                        {stats.defects?.critical > 0 && (
                            <div className="text-sm text-red-500 mt-1">
                                {stats.defects.critical} kritisch
                            </div>
                        )}
                    </div>
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="text-3xl font-bold text-orange-600">{stats.defects?.overdue || 0}</div>
                        <div className="text-gray-600">Ueberfaellig</div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="text-3xl font-bold text-blue-600">{stats.trainings?.completed || 0}</div>
                        <div className="text-gray-600">Schulungen</div>
                        {stats.trainings?.overdue > 0 && (
                            <div className="text-sm text-orange-500 mt-1">
                                {stats.trainings.overdue} faellig
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Checklist Types */}
            <div className="bg-white rounded-lg shadow">
                <div className="p-4 border-b">
                    <h2 className="text-lg font-semibold">5 Brandschutz-Checklisten</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 divide-x">
                    {checklistTypes.map(type => (
                        <div key={type.key} className="p-4 text-center hover:bg-gray-50">
                            <div className="text-3xl mb-2">{type.icon}</div>
                            <div className="font-medium text-sm">{type.label}</div>
                            <div className="text-xs text-gray-500 mt-1">{type.desc}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Objects List */}
            <div className="bg-white rounded-lg shadow">
                <div className="p-4 border-b flex justify-between items-center">
                    <h2 className="text-lg font-semibold">Objekte</h2>
                </div>
                <div className="divide-y">
                    {objects.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            Noch keine Objekte angelegt.
                            <Link to="/bsm/objects/new" className="text-red-600 hover:underline ml-2">
                                Erstes Objekt erstellen
                            </Link>
                        </div>
                    ) : (
                        objects.map(obj => (
                            <Link
                                key={obj.id}
                                to={`/bsm/objects/${obj.id}`}
                                className="flex items-center justify-between p-4 hover:bg-gray-50"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-3 h-3 rounded-full ${
                                        obj.overall_status === 'green' ? 'bg-green-500' :
                                        obj.overall_status === 'yellow' ? 'bg-yellow-500' :
                                        obj.overall_status === 'red' ? 'bg-red-500' : 'bg-gray-300'
                                    }`} />
                                    <div>
                                        <div className="font-medium">{obj.name}</div>
                                        <div className="text-sm text-gray-500">
                                            {obj.code} - {obj.object_type || 'Gebaeude'}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6 text-sm">
                                    <div className="text-center">
                                        <div className="text-gray-500">Brandklasse</div>
                                        <div className="font-medium">{obj.fire_class || '-'}</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-gray-500">Gebaeudetyp</div>
                                        <div className="font-medium">{obj.building_class || '-'}</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-gray-500">BSB</div>
                                        <div className="font-medium">{obj.fire_safety_officer_name || '-'}</div>
                                    </div>
                                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            </div>

            {/* Quick Links */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link
                    to="/bsm/defects"
                    className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                            <span className="text-2xl">⚠️</span>
                        </div>
                        <div>
                            <div className="font-semibold">Maengel-Management</div>
                            <div className="text-sm text-gray-500">Erfassung, Zuweisung, Behebung</div>
                        </div>
                    </div>
                </Link>
                <Link
                    to="/bsm/trainings"
                    className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                            <span className="text-2xl">📚</span>
                        </div>
                        <div>
                            <div className="font-semibold">Schulungen</div>
                            <div className="text-sm text-gray-500">Brandschutzhelfer, Evakuierung</div>
                        </div>
                    </div>
                </Link>
                <Link
                    to="/bsm/maintenance"
                    className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                            <span className="text-2xl">🔧</span>
                        </div>
                        <div>
                            <div className="font-semibold">Wartung & Pruefungen</div>
                            <div className="text-sm text-gray-500">BMA, RWA, Loeschanlagen</div>
                        </div>
                    </div>
                </Link>
            </div>

            {/* Compliance Info */}
            <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-lg p-6 border border-red-200">
                <div className="flex items-start gap-4">
                    <div className="text-3xl">🔥</div>
                    <div>
                        <h3 className="font-semibold text-red-800">Konformitaet</h3>
                        <p className="text-sm text-red-700 mt-1">
                            Dieses Modul entspricht den Anforderungen der ASR A2.2 (Massnahmen gegen Braende),
                            Landesbauordnungen sowie TUeV/FeuerTrutz-Standards fuer den betrieblichen Brandschutz.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
