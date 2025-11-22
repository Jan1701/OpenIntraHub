// =====================================================
// Setup Wizard - Web Installer
// Inspiriert von Nextcloud, eXo Platform
// =====================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
    Check,
    X,
    Loader2,
    Database,
    Server,
    User,
    Rocket,
    AlertCircle,
    CheckCircle,
    ArrowRight,
    ArrowLeft,
    Mail
} from 'lucide-react';

const STEPS = [
    { id: 1, name: 'Willkommen', icon: Rocket },
    { id: 2, name: 'Datenbank', icon: Database },
    { id: 3, name: 'Redis', icon: Server },
    { id: 4, name: 'Exchange', icon: Mail },
    { id: 5, name: 'Module', icon: CheckCircle },
    { id: 6, name: 'Admin User', icon: User },
    { id: 7, name: 'Installation', icon: Rocket }
];

function Setup() {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // System checks
    const [systemChecks, setSystemChecks] = useState(null);

    // Form data
    const [config, setConfig] = useState({
        database: {
            host: 'localhost',
            port: '5432',
            database: 'openintrahub',
            user: 'postgres',
            password: ''
        },
        redis: {
            enabled: true,
            host: 'localhost',
            port: '6379',
            password: ''
        },
        exchange: {
            enabled: false,
            server_url: '',
            username: '',
            password: '',
            auth_type: 'basic'
        },
        modules: {
            // Kommunikation
            posts: true,
            events: true,
            chat: true,
            mail: false,
            // Produktivitaet
            drive: true,
            projects: true,
            pageBuilder: true,
            // Standorte
            locations: true,
            // Sicherheit & Compliance (Haus-Service)
            asg: false,
            eva: false,
            bsm: false
        },
        admin: {
            username: 'admin',
            email: '',
            name: 'Administrator',
            password: '',
            passwordConfirm: ''
        },
        jwtSecret: '',
        frontendUrl: window.location.origin,
        nodeEnv: 'production'
    });

    // Test results
    const [dbTestResult, setDbTestResult] = useState(null);
    const [redisTestResult, setRedisTestResult] = useState(null);
    const [exchangeTestResult, setExchangeTestResult] = useState(null);

    // Installation progress
    const [installProgress, setInstallProgress] = useState({
        step: 0,
        message: '',
        completed: false,
        error: null
    });

    // Check if setup is already completed
    useEffect(() => {
        checkSetupStatus();
        loadSystemRequirements();
        generateJwtSecret();
    }, []);

    const checkSetupStatus = async () => {
        try {
            const response = await api.get('/setup/status');
            if (response.data.setupCompleted) {
                // Setup already completed, redirect to login
                navigate('/login');
            }
        } catch (error) {
            console.error('Error checking setup status:', error);
        }
    };

    const loadSystemRequirements = async () => {
        try {
            const response = await api.get('/setup/requirements');
            setSystemChecks(response.data.checks);
        } catch (error) {
            console.error('Error loading system requirements:', error);
        }
    };

    const generateJwtSecret = async () => {
        try {
            const response = await api.post('/setup/generate-secret');
            setConfig(prev => ({
                ...prev,
                jwtSecret: response.data.secret
            }));
        } catch (error) {
            console.error('Error generating JWT secret:', error);
        }
    };

    const testDatabaseConnection = async () => {
        setLoading(true);
        setDbTestResult(null);
        try {
            const response = await api.post('/setup/test-database', config.database);
            setDbTestResult(response.data);
        } catch (error) {
            setDbTestResult({
                success: false,
                message: error.response?.data?.message || error.message
            });
        } finally {
            setLoading(false);
        }
    };

    const testRedisConnection = async () => {
        setLoading(true);
        setRedisTestResult(null);
        try {
            const response = await api.post('/setup/test-redis', config.redis);
            setRedisTestResult(response.data);
        } catch (error) {
            setRedisTestResult({
                success: false,
                message: error.response?.data?.message || error.message
            });
        } finally {
            setLoading(false);
        }
    };

    const testExchangeConnection = async () => {
        setLoading(true);
        setExchangeTestResult(null);
        try {
            const response = await api.post('/setup/test-exchange', config.exchange);
            setExchangeTestResult(response.data);
        } catch (error) {
            setExchangeTestResult({
                success: false,
                message: error.response?.data?.message || error.message
            });
        } finally {
            setLoading(false);
        }
    };

    const handleInstall = async () => {
        setLoading(true);
        setInstallProgress({ step: 0, message: 'Installation wird vorbereitet...', completed: false, error: null });

        try {
            // Validate admin password
            if (config.admin.password !== config.admin.passwordConfirm) {
                throw new Error('Passwörter stimmen nicht überein');
            }

            if (config.admin.password.length < 8) {
                throw new Error('Passwort muss mindestens 8 Zeichen lang sein');
            }

            setInstallProgress({ step: 1, message: 'Konfigurationsdatei wird erstellt...', completed: false, error: null });

            const response = await api.post('/setup/install', config);

            setInstallProgress({
                step: 4,
                message: 'Installation erfolgreich abgeschlossen!',
                completed: true,
                error: null
            });

            // Redirect to login after 2 seconds
            setTimeout(() => {
                navigate('/login');
            }, 2000);

        } catch (error) {
            setInstallProgress({
                step: 0,
                message: '',
                completed: false,
                error: error.response?.data?.message || error.message
            });
        } finally {
            setLoading(false);
        }
    };

    const canProceed = () => {
        switch (currentStep) {
            case 1:
                return systemChecks && Object.values(systemChecks).every(check => check.status === 'ok');
            case 2:
                return dbTestResult?.success;
            case 3:
                return !config.redis.enabled || redisTestResult?.success;
            case 4:
                return !config.exchange.enabled || exchangeTestResult?.success;
            case 5:
                return config.admin.username && config.admin.email && config.admin.password &&
                       config.admin.password === config.admin.passwordConfirm;
            default:
                return true;
        }
    };

    const renderStep = () => {
        switch (currentStep) {
            case 1:
                return renderWelcomeStep();
            case 2:
                return renderDatabaseStep();
            case 3:
                return renderRedisStep();
            case 4:
                return renderExchangeStep();
            case 5:
                return renderModulesStep();
            case 6:
                return renderAdminStep();
            case 7:
                return renderInstallStep();
            default:
                return null;
        }
    };

    const renderWelcomeStep = () => (
        <div className="space-y-6">
            <div className="text-center">
                <Rocket className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                    Willkommen bei OpenIntraHub!
                </h2>
                <p className="text-gray-600">
                    Dieser Assistent hilft dir, OpenIntraHub in wenigen Schritten zu installieren.
                </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-4">System-Voraussetzungen</h3>
                {systemChecks ? (
                    <div className="space-y-3">
                        {Object.entries(systemChecks).map(([key, check]) => (
                            <div key={key} className="flex items-center justify-between">
                                <div>
                                    <div className="font-medium text-gray-900">{check.name}</div>
                                    {check.current && (
                                        <div className="text-sm text-gray-600">
                                            {check.current}
                                            {check.recommended && ` (empfohlen: ${check.recommended})`}
                                        </div>
                                    )}
                                    {check.message && (
                                        <div className="text-sm text-gray-600">{check.message}</div>
                                    )}
                                </div>
                                {check.status === 'ok' ? (
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                ) : check.status === 'error' ? (
                                    <X className="w-5 h-5 text-red-600" />
                                ) : (
                                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-4">
                        <Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto" />
                    </div>
                )}
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mr-3 mt-0.5" />
                    <div>
                        <p className="text-sm text-yellow-800">
                            <strong>Wichtig:</strong> Stelle sicher, dass PostgreSQL und optional Redis auf deinem Server installiert und gestartet sind.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderDatabaseStep = () => (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Datenbank-Konfiguration</h2>
                <p className="text-gray-600">
                    OpenIntraHub benötigt eine PostgreSQL-Datenbank. Bitte gib die Verbindungsdaten ein.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Host
                    </label>
                    <input
                        type="text"
                        value={config.database.host}
                        onChange={(e) => setConfig(prev => ({
                            ...prev,
                            database: { ...prev.database, host: e.target.value }
                        }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="localhost"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Port
                    </label>
                    <input
                        type="text"
                        value={config.database.port}
                        onChange={(e) => setConfig(prev => ({
                            ...prev,
                            database: { ...prev.database, port: e.target.value }
                        }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="5432"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Datenbankname
                    </label>
                    <input
                        type="text"
                        value={config.database.database}
                        onChange={(e) => setConfig(prev => ({
                            ...prev,
                            database: { ...prev.database, database: e.target.value }
                        }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="openintrahub"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Benutzername
                    </label>
                    <input
                        type="text"
                        value={config.database.user}
                        onChange={(e) => setConfig(prev => ({
                            ...prev,
                            database: { ...prev.database, user: e.target.value }
                        }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="postgres"
                    />
                </div>

                <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Passwort
                    </label>
                    <input
                        type="password"
                        value={config.database.password}
                        onChange={(e) => setConfig(prev => ({
                            ...prev,
                            database: { ...prev.database, password: e.target.value }
                        }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="********"
                    />
                </div>
            </div>

            <div>
                <button
                    onClick={testDatabaseConnection}
                    disabled={loading || !config.database.host || !config.database.database}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Teste Verbindung...
                        </>
                    ) : (
                        <>
                            <Database className="w-4 h-4 mr-2" />
                            Verbindung testen
                        </>
                    )}
                </button>
            </div>

            {dbTestResult && (
                <div className={`p-4 rounded-lg border ${
                    dbTestResult.success
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                }`}>
                    <div className="flex items-start">
                        {dbTestResult.success ? (
                            <CheckCircle className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
                        ) : (
                            <X className="w-5 h-5 text-red-600 mr-3 mt-0.5" />
                        )}
                        <div className="flex-1">
                            <div className={`font-medium ${
                                dbTestResult.success ? 'text-green-900' : 'text-red-900'
                            }`}>
                                {dbTestResult.message}
                            </div>
                            {dbTestResult.version && (
                                <div className="text-sm text-green-700 mt-1">
                                    {dbTestResult.version}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const renderRedisStep = () => (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Redis-Konfiguration (Optional)</h2>
                <p className="text-gray-600">
                    Redis wird für Caching und Session-Management verwendet. Du kannst diesen Schritt überspringen.
                </p>
            </div>

            <div className="flex items-center mb-4">
                <input
                    type="checkbox"
                    id="redis-enabled"
                    checked={config.redis.enabled}
                    onChange={(e) => setConfig(prev => ({
                        ...prev,
                        redis: { ...prev.redis, enabled: e.target.checked }
                    }))}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="redis-enabled" className="ml-2 text-sm font-medium text-gray-700">
                    Redis verwenden
                </label>
            </div>

            {config.redis.enabled && (
                <>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Host
                            </label>
                            <input
                                type="text"
                                value={config.redis.host}
                                onChange={(e) => setConfig(prev => ({
                                    ...prev,
                                    redis: { ...prev.redis, host: e.target.value }
                                }))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="localhost"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Port
                            </label>
                            <input
                                type="text"
                                value={config.redis.port}
                                onChange={(e) => setConfig(prev => ({
                                    ...prev,
                                    redis: { ...prev.redis, port: e.target.value }
                                }))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="6379"
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Passwort (optional)
                            </label>
                            <input
                                type="password"
                                value={config.redis.password}
                                onChange={(e) => setConfig(prev => ({
                                    ...prev,
                                    redis: { ...prev.redis, password: e.target.value }
                                }))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="********"
                            />
                        </div>
                    </div>

                    <div>
                        <button
                            onClick={testRedisConnection}
                            disabled={loading}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Teste Verbindung...
                                </>
                            ) : (
                                <>
                                    <Server className="w-4 h-4 mr-2" />
                                    Verbindung testen
                                </>
                            )}
                        </button>
                    </div>

                    {redisTestResult && (
                        <div className={`p-4 rounded-lg border ${
                            redisTestResult.success
                                ? 'bg-green-50 border-green-200'
                                : 'bg-red-50 border-red-200'
                        }`}>
                            <div className="flex items-start">
                                {redisTestResult.success ? (
                                    <CheckCircle className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
                                ) : (
                                    <X className="w-5 h-5 text-red-600 mr-3 mt-0.5" />
                                )}
                                <div className={`font-medium ${
                                    redisTestResult.success ? 'text-green-900' : 'text-red-900'
                                }`}>
                                    {redisTestResult.message}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );

    const renderExchangeStep = () => (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Exchange Kalender-Sync (Optional)</h2>
                <p className="text-gray-600">
                    Synchronisiere Kalender mit Exchange Server 2016/2019. Dies ist optional und kann später konfiguriert werden.
                </p>
            </div>

            <div className="flex items-center mb-4">
                <input
                    type="checkbox"
                    id="exchange-enabled"
                    checked={config.exchange.enabled}
                    onChange={(e) => setConfig(prev => ({
                        ...prev,
                        exchange: { ...prev.exchange, enabled: e.target.checked }
                    }))}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="exchange-enabled" className="ml-2 text-sm font-medium text-gray-700">
                    Exchange-Integration aktivieren
                </label>
            </div>

            {config.exchange.enabled && (
                <>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Exchange Server URL
                            </label>
                            <input
                                type="text"
                                value={config.exchange.server_url}
                                onChange={(e) => setConfig(prev => ({
                                    ...prev,
                                    exchange: { ...prev.exchange, server_url: e.target.value }
                                }))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="https://mail.company.com/EWS/Exchange.asmx"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Beispiel: https://mail.company.com/EWS/Exchange.asmx
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Benutzername
                            </label>
                            <input
                                type="text"
                                value={config.exchange.username}
                                onChange={(e) => setConfig(prev => ({
                                    ...prev,
                                    exchange: { ...prev.exchange, username: e.target.value }
                                }))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="DOMAIN\benutzer oder email@company.com"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Format: DOMAIN\benutzer oder email@company.com
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Passwort
                            </label>
                            <input
                                type="password"
                                value={config.exchange.password}
                                onChange={(e) => setConfig(prev => ({
                                    ...prev,
                                    exchange: { ...prev.exchange, password: e.target.value }
                                }))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="********"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Authentifizierungstyp
                            </label>
                            <select
                                value={config.exchange.auth_type}
                                onChange={(e) => setConfig(prev => ({
                                    ...prev,
                                    exchange: { ...prev.exchange, auth_type: e.target.value }
                                }))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="basic">Basic (Standard)</option>
                                <option value="ntlm">NTLM (Windows)</option>
                            </select>
                            <p className="text-xs text-gray-500 mt-1">
                                Für Exchange 2016/2019 wird meist NTLM verwendet
                            </p>
                        </div>
                    </div>

                    <div>
                        <button
                            onClick={testExchangeConnection}
                            disabled={loading || !config.exchange.server_url || !config.exchange.username || !config.exchange.password}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Teste Verbindung...
                                </>
                            ) : (
                                <>
                                    <Mail className="w-4 h-4 mr-2" />
                                    Verbindung testen
                                </>
                            )}
                        </button>
                    </div>

                    {exchangeTestResult && (
                        <div className={`p-4 rounded-lg border ${
                            exchangeTestResult.success
                                ? 'bg-green-50 border-green-200'
                                : 'bg-red-50 border-red-200'
                        }`}>
                            <div className="flex items-start">
                                {exchangeTestResult.success ? (
                                    <CheckCircle className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
                                ) : (
                                    <X className="w-5 h-5 text-red-600 mr-3 mt-0.5" />
                                )}
                                <div className="flex-1">
                                    <div className={`font-medium ${
                                        exchangeTestResult.success ? 'text-green-900' : 'text-red-900'
                                    }`}>
                                        {exchangeTestResult.message}
                                    </div>
                                    {exchangeTestResult.version && (
                                        <div className="text-sm text-green-700 mt-1">
                                            {exchangeTestResult.version}
                                        </div>
                                    )}
                                    {exchangeTestResult.note && (
                                        <div className="text-sm text-gray-600 mt-1">
                                            {exchangeTestResult.note}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {!config.exchange.enabled && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start">
                        <AlertCircle className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
                        <div>
                            <p className="text-sm text-blue-800">
                                <strong>Hinweis:</strong> Du kannst die Exchange-Integration jederzeit später in den Einstellungen aktivieren.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const renderModulesStep = () => (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Modul-Auswahl</h2>
                <p className="text-gray-600">
                    Waehle die Module aus, die du aktivieren moechtest. Du kannst diese spaeter in den Einstellungen aendern.
                </p>
            </div>

            {/* Kommunikation */}
            <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                    <span className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-2 text-lg">💬</span>
                    Kommunikation
                </h3>
                <div className="space-y-3">
                    {/* Posts Module */}
                    <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition">
                        <label className="flex items-start cursor-pointer">
                            <input
                                type="checkbox"
                                checked={config.modules.posts}
                                onChange={(e) => setConfig(prev => ({
                                    ...prev,
                                    modules: { ...prev.modules, posts: e.target.checked }
                                }))}
                                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"
                            />
                            <div className="ml-4 flex-1">
                                <div className="flex items-center">
                                    <h3 className="font-semibold text-gray-900">Posts & Blog</h3>
                                    <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">Empfohlen</span>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">
                                    Veroeffentliche Ankuendigungen, News und Blog-Artikel. Unterstuetzt Rich-Text, Kategorien und Kommentare.
                                </p>
                            </div>
                        </label>
                    </div>

                    {/* Events Module */}
                    <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition">
                        <label className="flex items-start cursor-pointer">
                            <input
                                type="checkbox"
                                checked={config.modules.events}
                                onChange={(e) => setConfig(prev => ({
                                    ...prev,
                                    modules: { ...prev.modules, events: e.target.checked }
                                }))}
                                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"
                            />
                            <div className="ml-4 flex-1">
                                <div className="flex items-center">
                                    <h3 className="font-semibold text-gray-900">Events & Kalender</h3>
                                    <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">Empfohlen</span>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">
                                    Verwalte Events, Meetings und Termine. {config.exchange.enabled && 'Synchronisiert mit Exchange Calendar.'}
                                </p>
                            </div>
                        </label>
                    </div>

                    {/* Chat Module */}
                    <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition">
                        <label className="flex items-start cursor-pointer">
                            <input
                                type="checkbox"
                                checked={config.modules.chat}
                                onChange={(e) => setConfig(prev => ({
                                    ...prev,
                                    modules: { ...prev.modules, chat: e.target.checked }
                                }))}
                                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"
                            />
                            <div className="ml-4 flex-1">
                                <div className="flex items-center">
                                    <h3 className="font-semibold text-gray-900">Chat & Messaging</h3>
                                    <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">Empfohlen</span>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">
                                    Echtzeit-Chat mit Direktnachrichten, Gruppenchats und Dateifreigabe. WebSocket-basiert.
                                </p>
                            </div>
                        </label>
                    </div>

                    {/* Mail Module */}
                    <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition">
                        <label className="flex items-start cursor-pointer">
                            <input
                                type="checkbox"
                                checked={config.modules.mail}
                                onChange={(e) => setConfig(prev => ({
                                    ...prev,
                                    modules: { ...prev.modules, mail: e.target.checked }
                                }))}
                                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"
                            />
                            <div className="ml-4 flex-1">
                                <div className="flex items-center">
                                    <h3 className="font-semibold text-gray-900">Mail Integration</h3>
                                    {config.exchange.enabled && <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">Exchange</span>}
                                </div>
                                <p className="text-sm text-gray-600 mt-1">
                                    E-Mail-Integration mit Exchange Server. Posteingang und Kalender direkt im Intranet.
                                </p>
                            </div>
                        </label>
                    </div>
                </div>
            </div>

            {/* Produktivitaet */}
            <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                    <span className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-2 text-lg">📊</span>
                    Produktivitaet
                </h3>
                <div className="space-y-3">
                    {/* Drive Module */}
                    <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition">
                        <label className="flex items-start cursor-pointer">
                            <input
                                type="checkbox"
                                checked={config.modules.drive}
                                onChange={(e) => setConfig(prev => ({
                                    ...prev,
                                    modules: { ...prev.modules, drive: e.target.checked }
                                }))}
                                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"
                            />
                            <div className="ml-4 flex-1">
                                <div className="flex items-center">
                                    <h3 className="font-semibold text-gray-900">Drive & Dateien</h3>
                                    <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">Empfohlen</span>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">
                                    Dateiverwaltung mit Ordnerstruktur, Versionierung und Freigabe. Cloud-Speicher fuer Teams.
                                </p>
                            </div>
                        </label>
                    </div>

                    {/* Projects Module */}
                    <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition">
                        <label className="flex items-start cursor-pointer">
                            <input
                                type="checkbox"
                                checked={config.modules.projects}
                                onChange={(e) => setConfig(prev => ({
                                    ...prev,
                                    modules: { ...prev.modules, projects: e.target.checked }
                                }))}
                                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"
                            />
                            <div className="ml-4 flex-1">
                                <div className="flex items-center">
                                    <h3 className="font-semibold text-gray-900">Projekte & Kanban</h3>
                                    <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded-full">Kanban</span>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">
                                    Projektmanagement mit Kanban-Boards, Tasks und Team-Zusammenarbeit.
                                </p>
                            </div>
                        </label>
                    </div>

                    {/* Page Builder Module */}
                    <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition">
                        <label className="flex items-start cursor-pointer">
                            <input
                                type="checkbox"
                                checked={config.modules.pageBuilder}
                                onChange={(e) => setConfig(prev => ({
                                    ...prev,
                                    modules: { ...prev.modules, pageBuilder: e.target.checked }
                                }))}
                                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"
                            />
                            <div className="ml-4 flex-1">
                                <div className="flex items-center">
                                    <h3 className="font-semibold text-gray-900">Page Builder</h3>
                                    <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">Drag & Drop</span>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">
                                    Erstelle benutzerdefinierte Seiten mit Drag & Drop. Widgets fuer Inhalte, Formulare und mehr.
                                </p>
                            </div>
                        </label>
                    </div>

                    {/* Locations Module */}
                    <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition">
                        <label className="flex items-start cursor-pointer">
                            <input
                                type="checkbox"
                                checked={config.modules.locations}
                                onChange={(e) => setConfig(prev => ({
                                    ...prev,
                                    modules: { ...prev.modules, locations: e.target.checked }
                                }))}
                                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"
                            />
                            <div className="ml-4 flex-1">
                                <h3 className="font-semibold text-gray-900">Standorte & Raeume</h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    Verwalte Bueros, Standorte, Raeume und Ressourcen. Ideal fuer Raumbuchungen.
                                </p>
                            </div>
                        </label>
                    </div>
                </div>
            </div>

            {/* Sicherheit & Compliance */}
            <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                    <span className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center mr-2 text-lg">🛡️</span>
                    Sicherheit & Compliance (Haus-Service)
                </h3>
                <div className="space-y-3">
                    {/* ASG Module */}
                    <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition">
                        <label className="flex items-start cursor-pointer">
                            <input
                                type="checkbox"
                                checked={config.modules.asg}
                                onChange={(e) => setConfig(prev => ({
                                    ...prev,
                                    modules: { ...prev.modules, asg: e.target.checked }
                                }))}
                                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"
                            />
                            <div className="ml-4 flex-1">
                                <div className="flex items-center">
                                    <h3 className="font-semibold text-gray-900">Arbeitssicherheit (ASG)</h3>
                                    <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-800 text-xs rounded-full">BGHW</span>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">
                                    BGHW-konforme Arbeitssicherheitskontrollen mit digitalen Checklisten und Maengelverfolgung.
                                </p>
                            </div>
                        </label>
                    </div>

                    {/* EVA Module */}
                    <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition">
                        <label className="flex items-start cursor-pointer">
                            <input
                                type="checkbox"
                                checked={config.modules.eva}
                                onChange={(e) => setConfig(prev => ({
                                    ...prev,
                                    modules: { ...prev.modules, eva: e.target.checked }
                                }))}
                                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"
                            />
                            <div className="ml-4 flex-1">
                                <div className="flex items-center">
                                    <h3 className="font-semibold text-gray-900">Evakuierung (EVA)</h3>
                                    <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full">TUeV SUeD</span>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">
                                    TUeV-konforme Evakuierungs- und Fluchtweg-Verwaltung mit Uebungsplanung.
                                </p>
                            </div>
                        </label>
                    </div>

                    {/* BSM Module */}
                    <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition">
                        <label className="flex items-start cursor-pointer">
                            <input
                                type="checkbox"
                                checked={config.modules.bsm}
                                onChange={(e) => setConfig(prev => ({
                                    ...prev,
                                    modules: { ...prev.modules, bsm: e.target.checked }
                                }))}
                                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"
                            />
                            <div className="ml-4 flex-1">
                                <div className="flex items-center">
                                    <h3 className="font-semibold text-gray-900">Brandschutz (BSM)</h3>
                                    <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full">FeuerTrutz</span>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">
                                    5 Brandschutz-Checklisten, Maengelverwaltung, Schulungen und Wartungsplanung.
                                </p>
                            </div>
                        </label>
                    </div>
                </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                    <div className="text-sm text-blue-800">
                        <p className="font-medium mb-1">Flexible Modulverwaltung</p>
                        <p>
                            Alle Module koennen spaeter in den Systemeinstellungen aktiviert oder deaktiviert werden.
                            Die Auswahl beeinflusst die initiale Konfiguration.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderAdminStep = () => (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Administrator-Account</h2>
                <p className="text-gray-600">
                    Erstelle einen Administrator-Account für den ersten Login.
                </p>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Benutzername
                    </label>
                    <input
                        type="text"
                        value={config.admin.username}
                        onChange={(e) => setConfig(prev => ({
                            ...prev,
                            admin: { ...prev.admin, username: e.target.value }
                        }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="admin"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        E-Mail-Adresse
                    </label>
                    <input
                        type="email"
                        value={config.admin.email}
                        onChange={(e) => setConfig(prev => ({
                            ...prev,
                            admin: { ...prev.admin, email: e.target.value }
                        }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="admin@example.com"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Anzeigename
                    </label>
                    <input
                        type="text"
                        value={config.admin.name}
                        onChange={(e) => setConfig(prev => ({
                            ...prev,
                            admin: { ...prev.admin, name: e.target.value }
                        }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Administrator"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Passwort
                    </label>
                    <input
                        type="password"
                        value={config.admin.password}
                        onChange={(e) => setConfig(prev => ({
                            ...prev,
                            admin: { ...prev.admin, password: e.target.value }
                        }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="********"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Mindestens 8 Zeichen
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Passwort bestätigen
                    </label>
                    <input
                        type="password"
                        value={config.admin.passwordConfirm}
                        onChange={(e) => setConfig(prev => ({
                            ...prev,
                            admin: { ...prev.admin, passwordConfirm: e.target.value }
                        }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="********"
                    />
                </div>

                {config.admin.password && config.admin.passwordConfirm &&
                 config.admin.password !== config.admin.passwordConfirm && (
                    <div className="text-sm text-red-600">
                        Passwörter stimmen nicht überein
                    </div>
                )}
            </div>
        </div>
    );

    const renderInstallStep = () => (
        <div className="space-y-6">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Bereit zur Installation!</h2>
                <p className="text-gray-600">
                    OpenIntraHub ist jetzt bereit für die Installation. Dies kann einige Minuten dauern.
                </p>
            </div>

            {!installProgress.completed && !installProgress.error && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h3 className="font-semibold text-blue-900 mb-4">Zusammenfassung:</h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-600">Datenbank:</span>
                            <span className="font-medium">{config.database.database} @ {config.database.host}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">Redis:</span>
                            <span className="font-medium">{config.redis.enabled ? 'Aktiviert' : 'Deaktiviert'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">Exchange:</span>
                            <span className="font-medium">{config.exchange.enabled ? 'Aktiviert' : 'Deaktiviert'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">Admin User:</span>
                            <span className="font-medium">{config.admin.username}</span>
                        </div>
                    </div>
                </div>
            )}

            {installProgress.message && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center">
                        {installProgress.completed ? (
                            <CheckCircle className="w-8 h-8 text-green-600 mr-4" />
                        ) : (
                            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mr-4" />
                        )}
                        <div className="flex-1">
                            <div className="font-medium text-gray-900">{installProgress.message}</div>
                            {installProgress.step > 0 && !installProgress.completed && (
                                <div className="text-sm text-gray-600 mt-1">
                                    Schritt {installProgress.step} von 4
                                </div>
                            )}
                        </div>
                    </div>

                    {installProgress.completed && (
                        <div className="mt-4 text-sm text-gray-600">
                            Du wirst in Kürze zur Login-Seite weitergeleitet...
                        </div>
                    )}
                </div>
            )}

            {installProgress.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start">
                        <X className="w-5 h-5 text-red-600 mr-3 mt-0.5" />
                        <div>
                            <div className="font-medium text-red-900">Installation fehlgeschlagen</div>
                            <div className="text-sm text-red-700 mt-1">{installProgress.error}</div>
                        </div>
                    </div>
                </div>
            )}

            {!loading && !installProgress.completed && !installProgress.error && (
                <div className="flex justify-center">
                    <button
                        onClick={handleInstall}
                        disabled={loading}
                        className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-lg font-semibold"
                    >
                        <Rocket className="w-5 h-5 mr-2" />
                        Jetzt installieren!
                    </button>
                </div>
            )}
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
            <div className="max-w-4xl w-full">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
                        <Rocket className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">
                        OpenIntraHub Setup
                    </h1>
                    <p className="text-gray-600">
                        Version 0.1.3-alpha | Open Source Intranet
                    </p>
                </div>

                {/* Main Card */}
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                    {/* Progress Steps */}
                    <div className="bg-gray-50 border-b border-gray-200 px-8 py-6">
                        <div className="flex justify-between">
                            {STEPS.map((step, index) => {
                                const Icon = step.icon;
                                const isActive = step.id === currentStep;
                                const isCompleted = step.id < currentStep;

                                return (
                                    <div key={step.id} className="flex items-center">
                                        <div className={`flex flex-col items-center ${
                                            index < STEPS.length - 1 ? 'mr-4' : ''
                                        }`}>
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-colors ${
                                                isCompleted
                                                    ? 'bg-green-600 border-green-600'
                                                    : isActive
                                                        ? 'bg-blue-600 border-blue-600'
                                                        : 'bg-white border-gray-300'
                                            }`}>
                                                {isCompleted ? (
                                                    <Check className="w-6 h-6 text-white" />
                                                ) : (
                                                    <Icon className={`w-6 h-6 ${
                                                        isActive ? 'text-white' : 'text-gray-400'
                                                    }`} />
                                                )}
                                            </div>
                                            <div className={`text-xs mt-2 font-medium ${
                                                isActive ? 'text-blue-600' : 'text-gray-500'
                                            }`}>
                                                {step.name}
                                            </div>
                                        </div>
                                        {index < STEPS.length - 1 && (
                                            <div className={`h-0.5 w-16 mx-2 ${
                                                isCompleted ? 'bg-green-600' : 'bg-gray-300'
                                            }`} />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Step Content */}
                    <div className="p-8">
                        {renderStep()}
                    </div>

                    {/* Navigation */}
                    <div className="bg-gray-50 border-t border-gray-200 px-8 py-6 flex justify-between">
                        <button
                            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                            disabled={currentStep === 1 || loading}
                            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Zurück
                        </button>

                        {currentStep < 7 && (
                            <button
                                onClick={() => setCurrentStep(currentStep + 1)}
                                disabled={!canProceed() || loading}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                            >
                                Weiter
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center mt-6 text-sm text-gray-600">
                    <p>Made with ❤️ in Europe | Apache 2.0 License</p>
                    <p className="mt-1">Jan Günther &lt;jg@linxpress.de&gt;</p>
                </div>
            </div>
        </div>
    );
}

export default Setup;
