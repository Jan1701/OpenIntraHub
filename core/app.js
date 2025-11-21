require('dotenv').config();
const express = require('express');
const cors = require('cors');
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

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
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
    res.status(404).json({ error: 'Endpoint nicht gefunden' });
});

// Global Error Handler
app.use((err, req, res, next) => {
    logger.error('Unbehandelter Fehler', { error: err.message, stack: err.stack });
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Interner Serverfehler'
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
