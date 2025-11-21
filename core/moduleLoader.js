const fs = require('fs');
const path = require('path');
const { createModuleLogger } = require('./logger');
const database = require('./database');
const middleware = require('./middleware');
const permissions = require('./permissions');
const { createModuleI18n } = require('./i18n');

const logger = createModuleLogger('ModuleLoader');

class ModuleLoader {
    constructor(app, eventBus) {
        this.app = app;
        this.eventBus = eventBus;
        this.modules = new Map();
    }

    loadModules() {
        const modulesPath = path.join(__dirname, '../modules');

        // Falls Ordner nicht existiert, erstellen
        if (!fs.existsSync(modulesPath)) return;

        const folders = fs.readdirSync(modulesPath);

        logger.info('Scanne Module...');

        folders.forEach(folder => {
            const modulePath = path.join(modulesPath, folder);
            const manifestPath = path.join(modulePath, 'manifest.json');

            if (fs.existsSync(manifestPath)) {
                const manifest = require(manifestPath);
                const entryPoint = require(path.join(modulePath, manifest.entry));

                // Modul initialisieren
                try {
                    // Module Context mit allen wichtigen Core-Funktionen
                    const moduleContext = {
                        // Express App für Routes
                        router: this.app,

                        // Event-Bus für Kommunikation
                        events: this.eventBus,

                        // Modul-Konfiguration
                        config: manifest.config || {},

                        // Core Services
                        services: {
                            database,
                            logger: createModuleLogger(manifest.name)
                        },

                        // Middleware-Funktionen
                        middleware: {
                            authenticateToken: middleware.authenticateToken,
                            optionalAuth: middleware.optionalAuth,
                            requireRole: middleware.requireRole,
                            requireAdmin: middleware.requireAdmin,
                            requireModerator: middleware.requireModerator,
                            rateLimit: middleware.rateLimit
                        },

                        // Permissions-System
                        permissions: {
                            requirePermission: permissions.requirePermission,
                            requireAllPermissions: permissions.requireAllPermissions,
                            hasPermission: permissions.hasPermission,
                            ROLES: permissions.ROLES,
                            PERMISSIONS: permissions.PERMISSIONS
                        },

                        // Internationalization (i18n)
                        i18n: createModuleI18n(manifest.name)
                    };

                    entryPoint.init(moduleContext);

                    this.modules.set(manifest.name, manifest);
                    logger.info('Modul geladen', { name: manifest.name, version: manifest.version });
                } catch (error) {
                    logger.error('Fehler beim Laden eines Moduls', { name: manifest.name, error: error.message });
                }
            }
        });
        logger.info('Alle Module verarbeitet', { count: this.modules.size });
    }
}

module.exports = ModuleLoader;
