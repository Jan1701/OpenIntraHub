require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server: SocketIO } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const EnhancedModuleLoader = require('./enhancedModuleLoader');
const eventBus = require('./eventBus');
const auth = require('./auth');
const database = require('./database');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('Core');
const {
    authenticateToken,
    optionalAuth,
    requireAdmin,
    requireModerator,
    requestLogger
} = require('./middleware');
const {
    requirePermission,
    requireAllPermissions
} = require('./permissions');
const { swaggerUi, swaggerSpec } = require('./swagger');
const { middleware: i18nMiddleware, i18nRequestMiddleware, SUPPORTED_LANGUAGES, validateLanguage } = require('./i18n');
const userService = require('./userService');
const setupApi = require('./setupApi');
const pageBuilderApi = require('./pageBuilderApi');
const postsApi = require('./postsApi');
const locationApi = require('./locationApi');
const moduleManagementApi = require('./moduleManagementApi');
const userManagementApi = require('./userManagementApi');
const eventsApi = require('./eventsApi');
const socialApi = require('./socialApi');
const chatApi = require('./chatApi');
const exchangeApi = require('./exchangeApi');
const userStatusApi = require('./userStatusApi');
const mailApi = require('./mailApi');
const ldapApi = require('./ldapApi');
const scheduledSyncWorker = require('./scheduledSyncWorker');
const ldapSyncWorker = require('./ldapSyncWorker');

const app = express();
const httpServer = http.createServer(app);
const io = new SocketIO(httpServer, {
    cors: {
        origin: process.env.FRONTEND_URL || '*',
        methods: ['GET', 'POST'],
        credentials: true
    }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(i18nMiddleware);
app.use(i18nRequestMiddleware);
app.use(requestLogger);

// API-Dokumentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }'
}));

// Core Routes - Öffentlich

/**
 * @swagger
 * /:
 *   get:
 *     summary: Status-Check
 *     tags: [Core]
 *     responses:
 *       200:
 *         description: Server läuft
 */
app.get('/', (req, res) => res.send('OpenIntraHub Core is running'));

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User Login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Erfolgreicher Login
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       401:
 *         description: Ungültige Anmeldedaten
 */
app.post('/api/auth/login', auth.login);
app.get('/api/core/status', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

// Setup API - MUST be before other routes (works without database)
app.use('/api', setupApi);

// Protected Routes - Authentifizierung erforderlich
app.get('/api/user/profile', authenticateToken, (req, res) => {
    res.json({
        message: 'Ihr Profil',
        user: req.user
    });
});

// Language API - Sprachpräferenzen
app.get('/api/user/language', authenticateToken, async (req, res) => {
    try {
        const user = await userService.findUserById(req.user.id);
        res.json({
            success: true,
            language: user.language || 'de',
            supported: SUPPORTED_LANGUAGES
        });
    } catch (error) {
        logger.error('Fehler beim Abrufen der Sprachpräferenz', { error: error.message });
        res.status(500).json({
            success: false,
            message: req.t('errors:general.serverError')
        });
    }
});

app.put('/api/user/language', authenticateToken, async (req, res) => {
    try {
        const { language } = req.body;

        // Validierung
        const validLang = validateLanguage(language);
        if (!validLang) {
            return res.status(400).json({
                success: false,
                message: req.t('errors:validation.invalid', { field: req.t('validation:fields.language') }),
                supported: SUPPORTED_LANGUAGES
            });
        }

        // Sprache in Datenbank speichern
        if (database.pool) {
            await database.query(
                'UPDATE users SET language = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [validLang, req.user.id]
            );
        }

        // Cookie setzen für zukünftige Requests
        res.cookie('i18next', validLang, {
            maxAge: 365 * 24 * 60 * 60 * 1000, // 1 Jahr
            httpOnly: false,
            sameSite: 'lax'
        });

        res.json({
            success: true,
            message: req.t('auth:profile.updated'),
            language: validLang
        });

        logger.info('Sprachpräferenz aktualisiert', { userId: req.user.id, language: validLang });
    } catch (error) {
        logger.error('Fehler beim Aktualisieren der Sprachpräferenz', { error: error.message });
        res.status(500).json({
            success: false,
            message: req.t('errors:general.serverError')
        });
    }
});

// Öffentlicher Endpunkt für unterstützte Sprachen
app.get('/api/languages', (req, res) => {
    const languageNames = {
        de: { name: 'German', nativeName: 'Deutsch' },
        en: { name: 'English', nativeName: 'English' },
        fr: { name: 'French', nativeName: 'Français' },
        es: { name: 'Spanish', nativeName: 'Español' },
        it: { name: 'Italian', nativeName: 'Italiano' },
        pl: { name: 'Polish', nativeName: 'Polski' },
        nl: { name: 'Dutch', nativeName: 'Nederlands' }
    };

    res.json({
        success: true,
        languages: SUPPORTED_LANGUAGES.map(lang => ({
            code: lang,
            name: languageNames[lang].name,
            nativeName: languageNames[lang].nativeName
        })),
        default: 'de'
    });
});

// Page Builder API
app.use('/api', pageBuilderApi);

// Posts API
app.use('/api', postsApi);

// Location API
app.use('/api', locationApi);

// Module Management API
app.use('/api', moduleManagementApi);

// User Management API
app.use('/api', userManagementApi);

// Events API
app.use('/api', eventsApi);

// Social API (Reactions, Activity Feed, Notifications)
app.use('/api', socialApi);

// Chat API (Real-time Messaging)
app.use('/api', chatApi);

// Exchange API (Calendar Synchronization)
app.use('/api', exchangeApi);

// User Status API (Global Presence)
app.use('/api', userStatusApi);

// Mail API (Exchange Mail Integration)
app.use('/api/mail', mailApi);

// LDAP Admin API (User Sync & Management)
app.use('/api', ldapApi);

// Admin Routes - Nur für Admins
app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
    res.json({
        message: 'Admin-Bereich: Benutzerliste',
        requestedBy: req.user
    });
});

// Moderator Routes - Für Admins und Moderatoren
app.get('/api/moderation/reports', authenticateToken, requireModerator, (req, res) => {
    res.json({
        message: 'Moderations-Bereich: Meldungen',
        requestedBy: req.user
    });
});

// Permission-based Routes
app.post('/api/content', authenticateToken, requirePermission('content.create'), (req, res) => {
    res.json({
        message: 'Inhalt erstellen',
        user: req.user
    });
});

app.delete('/api/content/:id', authenticateToken, requirePermission('content.delete'), (req, res) => {
    res.json({
        message: 'Inhalt löschen',
        contentId: req.params.id,
        user: req.user
    });
});

app.post('/api/files/upload', authenticateToken, requirePermission('files.upload'), (req, res) => {
    res.json({
        message: 'Datei hochladen',
        user: req.user
    });
});

// Module System initialisieren (wird in startServer() geladen)
const moduleLoader = new EnhancedModuleLoader(app, eventBus);

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        error: req.t('errors:general.notFound')
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    logger.error('Unbehandelter Fehler', { error: err.message, stack: err.stack });
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production'
            ? req.t('errors:general.serverError')
            : err.message
    });
});

// Server Start
async function startServer() {
    try {
        // Datenbankverbindung herstellen (optional)
        if (process.env.DB_HOST) {
            logger.info('Stelle Datenbankverbindung her...');
            const connected = await database.connect();
            if (connected) {
                logger.info('Datenbankverbindung erfolgreich');
            } else {
                logger.warn('Datenbankverbindung fehlgeschlagen - Auth läuft ohne DB');
            }
        } else {
            logger.info('Keine DB konfiguriert - Auth läuft ohne DB (nur LDAP/Mock)');
        }

        // Module laden (Enhanced Module System mit Feature-Toggles)
        if (database.pool) {
            logger.info('Lade Module mit Enhanced Module Loader...');
            await moduleLoader.loadModules();
            logger.info('Module erfolgreich geladen');
        }

        // Socket.io Setup für Chat
        const authenticateSocketToken = async (socket) => {
            const token = socket.handshake.auth.token || socket.handshake.query.token;

            if (!token) {
                throw new Error('No token provided');
            }

            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await userService.findUserById(decoded.id);

                if (!user) {
                    throw new Error('User not found');
                }

                return user;
            } catch (error) {
                throw new Error('Invalid token');
            }
        };

        // Initialize Socket.io Chat
        chatApi.setupSocketIO(io, authenticateSocketToken);
        logger.info('Socket.io Chat initialisiert');

        // Server starten
        httpServer.listen(PORT, () => {
            logger.info(`🚀 OpenIntraHub v${require('../package.json').version} gestartet auf Port ${PORT}`);
            logger.info(`Umgebung: ${process.env.NODE_ENV || 'development'}`);
            logger.info(`Log-Level: ${process.env.LOG_LEVEL || 'debug'}`);
            logger.info(`Mehrsprachigkeit: DE, EN, FR, ES, IT, PL, NL (Standard: DE)`);
            logger.info(`API-Dokumentation: http://localhost:${PORT}/api-docs`);
            logger.info(`Socket.io Chat: ws://localhost:${PORT}/chat`);

            // Start Exchange scheduled sync worker
            if (process.env.EXCHANGE_ENABLED === 'true') {
                scheduledSyncWorker.startWorker();
                logger.info('📧 Exchange scheduled sync worker aktiviert');
            }

            // Start LDAP sync worker
            if (process.env.LDAP_URL) {
                ldapSyncWorker.start();
                logger.info('👥 LDAP sync worker aktiviert');
            }
        });

        // Graceful shutdown
        const shutdown = async (signal) => {
            logger.info(`${signal} empfangen. Server wird heruntergefahren...`);

            // Stop accepting new connections
            httpServer.close(async () => {
                logger.info('HTTP Server geschlossen');

                // Stop scheduled sync worker
                if (process.env.EXCHANGE_ENABLED === 'true') {
                    scheduledSyncWorker.stopWorker();
                }

                // Stop LDAP sync worker
                if (process.env.LDAP_URL) {
                    ldapSyncWorker.stop();
                }

                // Close database connections
                try {
                    await database.pool.end();
                    logger.info('Datenbank-Verbindungen geschlossen');
                } catch (error) {
                    logger.error('Fehler beim Schließen der Datenbank', { error: error.message });
                }

                process.exit(0);
            });

            // Force exit after 10 seconds
            setTimeout(() => {
                logger.error('Erzwungenes Herunterfahren nach Timeout');
                process.exit(1);
            }, 10000);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

    } catch (error) {
        logger.error('Fehler beim Starten des Servers', { error: error.message, stack: error.stack });
        process.exit(1);
    }
}

// Graceful Shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM empfangen, fahre Server herunter...');
    await database.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('SIGINT empfangen, fahre Server herunter...');
    await database.close();
    process.exit(0);
});

startServer();
