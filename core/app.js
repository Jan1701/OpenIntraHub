require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const ModuleLoader = require('./moduleLoader');
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
const pageBuilderApi = require('./pageBuilderApi');

const app = express();
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

// Module System starten
const loader = new ModuleLoader(app, eventBus);
loader.loadModules();

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

        // Server starten
        app.listen(PORT, () => {
            logger.info(`OpenIntraHub Core gestartet auf Port ${PORT}`);
            logger.info(`Umgebung: ${process.env.NODE_ENV || 'development'}`);
            logger.info(`Log-Level: ${process.env.LOG_LEVEL || 'debug'}`);
            logger.info(`Mehrsprachigkeit: DE, EN, FR, ES, IT, PL, NL (Standard: DE)`);
            logger.info(`API-Dokumentation verfügbar: http://localhost:${PORT}/api-docs`);
        });

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
