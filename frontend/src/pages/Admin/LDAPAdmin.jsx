// =====================================================
// LDAP Admin Panel - Testing & Management
// =====================================================

import React, { useState, useEffect } from 'react';
import api from '../../services/api';

function LDAPAdmin() {
    const [activeTab, setActiveTab] = useState('test');
    const [loading, setLoading] = useState(false);

    // Connection Test State
    const [connectionResult, setConnectionResult] = useState(null);
    const [config, setConfig] = useState(null);

    // Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);

    // Sync State
    const [syncStatus, setSyncStatus] = useState(null);
    const [syncLogs, setSyncLogs] = useState([]);

    // Users State
    const [ldapUsers, setLdapUsers] = useState([]);
    const [stats, setStats] = useState(null);

    // Group Mappings State
    const [groupMappings, setGroupMappings] = useState([]);

    useEffect(() => {
        loadConfig();
        loadSyncStatus();
        loadStats();
    }, []);

    useEffect(() => {
        if (activeTab === 'users') {
            loadLDAPUsers();
        } else if (activeTab === 'sync') {
            loadSyncLogs();
        } else if (activeTab === 'groups') {
            loadGroupMappings();
        }
    }, [activeTab]);

    const loadConfig = async () => {
        try {
            const response = await api.get('/ldap/config');
            setConfig(response.data.data);
        } catch (error) {
            console.error('Error loading config:', error);
        }
    };

    const loadSyncStatus = async () => {
        try {
            const response = await api.get('/ldap/sync/status');
            setSyncStatus(response.data.data);
        } catch (error) {
            console.error('Error loading sync status:', error);
        }
    };

    const loadSyncLogs = async () => {
        try {
            const response = await api.get('/ldap/sync/logs?limit=20');
            setSyncLogs(response.data.data);
        } catch (error) {
            console.error('Error loading sync logs:', error);
        }
    };

    const loadStats = async () => {
        try {
            const response = await api.get('/ldap/stats');
            setStats(response.data.data);
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    };

    const loadLDAPUsers = async () => {
        try {
            setLoading(true);
            const response = await api.get('/ldap/users?limit=100');
            setLdapUsers(response.data.data);
        } catch (error) {
            console.error('Error loading LDAP users:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadGroupMappings = async () => {
        try {
            setLoading(true);
            const response = await api.get('/ldap/group-mappings');
            setGroupMappings(response.data.data);
        } catch (error) {
            console.error('Error loading group mappings:', error);
        } finally {
            setLoading(false);
        }
    };

    const testConnection = async () => {
        try {
            setLoading(true);
            setConnectionResult(null);
            const response = await api.post('/ldap/test-connection');
            setConnectionResult(response.data.data);
        } catch (error) {
            setConnectionResult({
                success: false,
                message: error.response?.data?.error || error.message
            });
        } finally {
            setLoading(false);
        }
    };

    const searchUsers = async () => {
        if (!searchTerm.trim()) {
            alert('Bitte Suchbegriff eingeben');
            return;
        }

        try {
            setLoading(true);
            setSearchResults([]);
            const response = await api.post('/ldap/search-users', {
                searchTerm,
                limit: 50
            });
            setSearchResults(response.data.data);
        } catch (error) {
            alert('Fehler beim Suchen: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    const triggerSync = async () => {
        if (!window.confirm('LDAP-Synchronisation starten? Dies kann einige Minuten dauern.')) {
            return;
        }

        try {
            setLoading(true);
            await api.post('/ldap/sync/trigger');
            alert('Synchronisation gestartet. Überprüfen Sie die Logs.');
            loadSyncStatus();
            loadSyncLogs();
        } catch (error) {
            alert('Fehler: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    if (!config) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-600">Lädt...</div>
            </div>
        );
    }

    if (!config.enabled) {
        return (
            <div className="max-w-4xl mx-auto p-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                    <h2 className="text-xl font-bold text-yellow-900 mb-2">
                        LDAP nicht konfiguriert
                    </h2>
                    <p className="text-yellow-800 mb-4">
                        LDAP ist nicht aktiviert. Bitte konfigurieren Sie LDAP in den Umgebungsvariablen:
                    </p>
                    <pre className="bg-yellow-100 p-4 rounded text-sm">
{`LDAP_URL=ldap://dc.example.com:389
LDAP_BIND_DN=cn=admin,dc=example,dc=com
LDAP_BIND_PASSWORD=password
LDAP_SEARCH_BASE=ou=users,dc=example,dc=com
LDAP_SYNC_ENABLED=true
LDAP_SYNC_SCHEDULE=0 */6 * * *`}
                    </pre>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900">LDAP Administration</h1>
                <p className="text-gray-600 mt-1">
                    Verwalten Sie LDAP-Benutzer und Synchronisation
                </p>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-lg shadow p-4">
                        <div className="text-sm text-gray-600">LDAP Benutzer</div>
                        <div className="text-2xl font-bold text-gray-900">{stats.total_users}</div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                        <div className="text-sm text-gray-600">Aktiv</div>
                        <div className="text-2xl font-bold text-green-600">{stats.active_users}</div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                        <div className="text-sm text-gray-600">Inaktiv</div>
                        <div className="text-2xl font-bold text-red-600">{stats.inactive_users}</div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                        <div className="text-sm text-gray-600">Letzte 30 Tage</div>
                        <div className="text-2xl font-bold text-blue-600">{stats.active_last_30_days}</div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="bg-white rounded-lg shadow">
                <div className="border-b border-gray-200">
                    <nav className="flex -mb-px">
                        {['test', 'search', 'sync', 'users', 'groups'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                                    activeTab === tab
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                {tab === 'test' && 'Connection Test'}
                                {tab === 'search' && 'Benutzer Suchen'}
                                {tab === 'sync' && 'Synchronisation'}
                                {tab === 'users' && 'LDAP Benutzer'}
                                {tab === 'groups' && 'Gruppen-Mapping'}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="p-6">
                    {/* Connection Test Tab */}
                    {activeTab === 'test' && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-lg font-semibold mb-4">LDAP Konfiguration</h3>
                                <div className="bg-gray-50 p-4 rounded space-y-2 text-sm">
                                    <div><span className="font-medium">Server:</span> {config.url}</div>
                                    <div><span className="font-medium">Search Base:</span> {config.searchBase}</div>
                                    <div><span className="font-medium">Active Directory:</span> {config.isActiveDirectory ? 'Ja' : 'Nein'}</div>
                                    {config.domain && <div><span className="font-medium">Domain:</span> {config.domain}</div>}
                                </div>
                            </div>

                            <button
                                onClick={testConnection}
                                disabled={loading}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                {loading ? 'Teste...' : 'Verbindung testen'}
                            </button>

                            {connectionResult && (
                                <div className={`p-4 rounded-lg ${
                                    connectionResult.success
                                        ? 'bg-green-50 border border-green-200'
                                        : 'bg-red-50 border border-red-200'
                                }`}>
                                    <div className={`font-semibold ${
                                        connectionResult.success ? 'text-green-900' : 'text-red-900'
                                    }`}>
                                        {connectionResult.success ? '✅ Verbindung erfolgreich' : '❌ Verbindung fehlgeschlagen'}
                                    </div>
                                    <div className={`text-sm mt-1 ${
                                        connectionResult.success ? 'text-green-700' : 'text-red-700'
                                    }`}>
                                        {connectionResult.message}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Search Tab */}
                    {activeTab === 'search' && (
                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
                                    placeholder="Suche nach Benutzern... (* für alle)"
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                                />
                                <button
                                    onClick={searchUsers}
                                    disabled={loading}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {loading ? 'Suche...' : 'Suchen'}
                                </button>
                            </div>

                            {searchResults.length > 0 && (
                                <div>
                                    <div className="text-sm text-gray-600 mb-2">{searchResults.length} Benutzer gefunden</div>
                                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Username</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Name</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Email</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Gruppen</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {searchResults.map((user, index) => (
                                                    <tr key={index}>
                                                        <td className="px-4 py-2 text-sm">{user.username}</td>
                                                        <td className="px-4 py-2 text-sm">{user.name}</td>
                                                        <td className="px-4 py-2 text-sm">{user.email}</td>
                                                        <td className="px-4 py-2 text-sm">{user.groups?.length || 0}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Sync Tab */}
                    {activeTab === 'sync' && (
                        <div className="space-y-4">
                            {syncStatus && (
                                <div className="bg-gray-50 p-4 rounded space-y-2">
                                    <div><span className="font-medium">Status:</span> {syncStatus.isRunning ? '🔄 Läuft...' : '✅ Bereit'}</div>
                                    <div><span className="font-medium">Aktiviert:</span> {syncStatus.enabled ? 'Ja' : 'Nein'}</div>
                                    <div><span className="font-medium">Schedule:</span> {syncStatus.schedule}</div>
                                    {syncStatus.stats?.last_sync_at && (
                                        <div><span className="font-medium">Letzte Sync:</span> {new Date(syncStatus.stats.last_sync_at).toLocaleString('de-DE')}</div>
                                    )}
                                </div>
                            )}

                            <button
                                onClick={triggerSync}
                                disabled={loading || syncStatus?.isRunning}
                                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                            >
                                {loading ? 'Starte...' : 'Manuelle Synchronisation'}
                            </button>

                            {syncLogs.length > 0 && (
                                <div>
                                    <h4 className="font-semibold mb-2">Letzte Synchronisationen</h4>
                                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Zeitpunkt</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Verarbeitet</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Erstellt</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Aktualisiert</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Dauer</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {syncLogs.map((log) => (
                                                    <tr key={log.id}>
                                                        <td className="px-4 py-2 text-sm">{new Date(log.started_at).toLocaleString('de-DE')}</td>
                                                        <td className="px-4 py-2 text-sm">
                                                            <span className={`px-2 py-1 rounded text-xs ${
                                                                log.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                                log.status === 'failed' ? 'bg-red-100 text-red-800' :
                                                                'bg-yellow-100 text-yellow-800'
                                                            }`}>
                                                                {log.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2 text-sm">{log.users_processed}</td>
                                                        <td className="px-4 py-2 text-sm">{log.users_created}</td>
                                                        <td className="px-4 py-2 text-sm">{log.users_updated}</td>
                                                        <td className="px-4 py-2 text-sm">{log.duration_seconds}s</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Users Tab */}
                    {activeTab === 'users' && (
                        <div>
                            {loading ? (
                                <div className="text-center py-8">Lädt...</div>
                            ) : ldapUsers.length === 0 ? (
                                <div className="text-center py-8 text-gray-600">
                                    Keine LDAP-Benutzer gefunden
                                </div>
                            ) : (
                                <div className="border border-gray-200 rounded-lg overflow-hidden">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Username</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Name</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Email</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Rolle</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Letzte Sync</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {ldapUsers.map((user) => (
                                                <tr key={user.id}>
                                                    <td className="px-4 py-2 text-sm">{user.username}</td>
                                                    <td className="px-4 py-2 text-sm">{user.name}</td>
                                                    <td className="px-4 py-2 text-sm">{user.email}</td>
                                                    <td className="px-4 py-2 text-sm">{user.role}</td>
                                                    <td className="px-4 py-2 text-sm">
                                                        <span className={`px-2 py-1 rounded text-xs ${
                                                            user.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                                        }`}>
                                                            {user.is_active ? 'Aktiv' : 'Inaktiv'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2 text-sm">
                                                        {user.ldap_last_sync_at ? new Date(user.ldap_last_sync_at).toLocaleDateString('de-DE') : '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Groups Tab */}
                    {activeTab === 'groups' && (
                        <div>
                            {loading ? (
                                <div className="text-center py-8">Lädt...</div>
                            ) : groupMappings.length === 0 ? (
                                <div className="text-center py-8 text-gray-600">
                                    Keine Gruppen-Mappings konfiguriert
                                </div>
                            ) : (
                                <div className="border border-gray-200 rounded-lg overflow-hidden">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">LDAP Gruppe</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">App Rolle</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Priorität</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {groupMappings.map((mapping) => (
                                                <tr key={mapping.id}>
                                                    <td className="px-4 py-2 text-sm">{mapping.ldap_group_name}</td>
                                                    <td className="px-4 py-2 text-sm">
                                                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                                                            {mapping.app_role}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2 text-sm">{mapping.priority}</td>
                                                    <td className="px-4 py-2 text-sm">
                                                        <span className={`px-2 py-1 rounded text-xs ${
                                                            mapping.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                                        }`}>
                                                            {mapping.is_active ? 'Aktiv' : 'Inaktiv'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default LDAPAdmin;
