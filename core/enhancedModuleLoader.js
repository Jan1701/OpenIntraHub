/**
 * Enhanced Module Loader
 * Lädt Module mit Feature-Toggles, Dependencies und Hooks
 * Author: Jan Günther <jg@linxpress.de>
 */

const fs = require('fs');
const path = require('path');
const { createModuleLogger } = require('./logger');
const database = require('./database');
const middleware = require('./middleware');
const permissions = require('./permissions');
const { createModuleI18n } = require('./i18n');
const moduleRegistry = require('./enhancedModuleRegistry');

const logger = createModuleLogger('EnhancedModuleLoader');

class EnhancedModuleLoader {
    constructor(app, eventBus) {
        this.app = app;
        this.eventBus = eventBus;
        this.loadedModules = new Map();
        this.moduleInstances = new Map();
    }

    /**
     * Load all enabled modules from database
     */
    async loadModules() {
        try {
            logger.info('Starting enhanced module loading...');

            // Get all enabled modules from database
            const modules = await moduleRegistry.getAllModules({
                enabled_only: true,
                order_by: 'install_order'
            });

            logger.info(`Found ${modules.length} enabled modules`);

            // Load modules in order
            for (const moduleData of modules) {
                await this.loadModule(moduleData);
            }

            // Load file-based modules (for backwards compatibility)
            await this.loadFileBasedModules();

            logger.info(`Module loading complete. ${this.loadedModules.size} modules loaded.`);

            // Trigger post-load hook
            await moduleRegistry.triggerHook('modules.loaded', {
                count: this.loadedModules.size,
                modules: Array.from(this.loadedModules.keys())
            });

        } catch (error) {
            logger.error('Error loading modules', { error: error.message, stack: error.stack });
        }
    }

    /**
     * Load a single module
     */
    async loadModule(moduleData) {
        try {
            const { id, name, component, enabled, dependencies, module_config } = moduleData;

            // Skip if not enabled
            if (!enabled) {
                logger.debug(`Module ${name} is disabled, skipping`);
                return;
            }

            // Check dependencies
            const depsOk = await moduleRegistry.checkModuleDependencies(id);
            if (!depsOk) {
                logger.warn(`Module ${name} dependencies not met, skipping`);
                return;
            }

            // Check if module has file-based implementation
            const modulePath = path.join(__dirname, '../modules', name.toLowerCase());
            if (fs.existsSync(modulePath)) {
                await this.loadFileBasedModule(modulePath, moduleData);
            } else {
                // Module is database-only (e.g., just a registry entry)
                this.loadedModules.set(name, moduleData);
                logger.info(`Module registered (database-only): ${name}`);
            }

            // Load module routes
            await this.loadModuleRoutes(id, name);

        } catch (error) {
            logger.error(`Error loading module ${moduleData.name}`, {
                error: error.message,
                stack: error.stack
            });
        }
    }

    /**
     * Load file-based module
     */
    async loadFileBasedModule(modulePath, moduleData) {
        const manifestPath = path.join(modulePath, 'manifest.json');

        if (!fs.existsSync(manifestPath)) {
            logger.debug(`No manifest found for ${moduleData.name}, using database config`);
            return;
        }

        try {
            const manifest = require(manifestPath);
            const entryPoint = require(path.join(modulePath, manifest.entry || 'index.js'));

            // Create module context
            const moduleContext = this.createModuleContext(moduleData, manifest);

            // Initialize module
            if (typeof entryPoint.init === 'function') {
                await entryPoint.init(moduleContext);
            }

            // Store module instance
            this.moduleInstances.set(moduleData.name, entryPoint);
            this.loadedModules.set(moduleData.name, {
                ...moduleData,
                manifest,
                instance: entryPoint
            });

            logger.info(`Module loaded: ${moduleData.name} v${manifest.version || moduleData.version}`);

        } catch (error) {
            logger.error(`Failed to load file-based module ${moduleData.name}`, {
                error: error.message
            });
        }
    }

    /**
     * Create module context
     */
    createModuleContext(moduleData, manifest = {}) {
        const self = this;

        return {
            // Module info
            module: {
                id: moduleData.id,
                name: moduleData.name,
                version: moduleData.version || manifest.version,
                config: moduleData.module_config || manifest.config || {}
            },

            // Express App für Routes
            router: this.app,

            // Event-Bus
            events: this.eventBus,

            // Core Services
            services: {
                database,
                logger: createModuleLogger(moduleData.name),
                registry: moduleRegistry
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

            // Internationalization
            i18n: createModuleI18n(moduleData.name),

            // Module Registry API
            registry: {
                getSetting: (key) => moduleRegistry.getModuleSetting(moduleData.id, key),
                setSetting: (key, value, type) => moduleRegistry.setModuleSetting(moduleData.id, key, value, type),
                getSettings: () => moduleRegistry.getAllModuleSettings(moduleData.id),

                registerHook: (hookName, handler, priority) =>
                    moduleRegistry.registerHook(moduleData.id, hookName, handler, priority),

                triggerHook: (hookName, data) =>
                    moduleRegistry.triggerHook(hookName, data),

                registerRoute: (routeData) =>
                    moduleRegistry.registerRoute(moduleData.id, routeData),

                getModule: (name) => self.loadedModules.get(name),
                getAllModules: () => Array.from(self.loadedModules.values())
            }
        };
    }

    /**
     * Load module routes dynamically
     */
    async loadModuleRoutes(moduleId, moduleName) {
        try {
            const routes = await moduleRegistry.getModuleRoutes(moduleId);

            for (const route of routes) {
                const { route_path, route_method, handler_file, handler_function, middleware: mw, required_permission, is_public } = route;

                // Build middleware stack
                const middlewareStack = [];

                // Authentication middleware (unless public)
                if (!is_public) {
                    middlewareStack.push(middleware.authenticateToken);
                }

                // Permission middleware
                if (required_permission) {
                    middlewareStack.push(permissions.requirePermission(required_permission));
                }

                // Custom middleware
                if (mw && Array.isArray(mw)) {
                    mw.forEach(mwName => {
                        if (middleware[mwName]) {
                            middlewareStack.push(middleware[mwName]);
                        }
                    });
                }

                // Load handler
                const handlerPath = path.join(__dirname, '../modules', moduleName.toLowerCase(), handler_file);
                if (fs.existsSync(handlerPath)) {
                    const handlerModule = require(handlerPath);
                    const handler = handlerModule[handler_function];

                    if (typeof handler === 'function') {
                        // Register route
                        const method = route_method.toLowerCase();
                        this.app[method](route_path, ...middlewareStack, handler);

                        logger.debug(`Route registered: ${route_method} ${route_path}`);
                    }
                }
            }

        } catch (error) {
            logger.error(`Error loading routes for module ${moduleName}`, {
                error: error.message
            });
        }
    }

    /**
     * Load traditional file-based modules (backwards compatibility)
     */
    async loadFileBasedModules() {
        const modulesPath = path.join(__dirname, '../modules');

        if (!fs.existsSync(modulesPath)) {
            logger.debug('Modules directory does not exist');
            return;
        }

        const folders = fs.readdirSync(modulesPath);

        for (const folder of folders) {
            const modulePath = path.join(modulesPath, folder);
            const manifestPath = path.join(modulePath, 'manifest.json');

            if (fs.existsSync(manifestPath)) {
                const manifest = require(manifestPath);

                // Check if already loaded from database
                if (this.loadedModules.has(manifest.name)) {
                    continue;
                }

                // Check if module is in database
                try {
                    const moduleData = await moduleRegistry.getModuleByName(manifest.name);

                    if (!moduleData.enabled) {
                        logger.debug(`File-based module ${manifest.name} is disabled in database`);
                        continue;
                    }

                    await this.loadFileBasedModule(modulePath, moduleData);

                } catch (error) {
                    // Module not in database - load it anyway (backwards compatibility)
                    logger.warn(`Module ${manifest.name} not found in registry, loading anyway`);

                    const fakeModuleData = {
                        id: null,
                        name: manifest.name,
                        version: manifest.version,
                        enabled: true,
                        module_config: manifest.config || {}
                    };

                    await this.loadFileBasedModule(modulePath, fakeModuleData);
                }
            }
        }
    }

    /**
     * Reload a specific module
     */
    async reloadModule(moduleName) {
        try {
            logger.info(`Reloading module: ${moduleName}`);

            // Get module from database
            const moduleData = await moduleRegistry.getModuleByName(moduleName);

            // Unload if already loaded
            if (this.loadedModules.has(moduleName)) {
                this.loadedModules.delete(moduleName);
                this.moduleInstances.delete(moduleName);
            }

            // Clear require cache
            const modulePath = path.join(__dirname, '../modules', moduleName.toLowerCase());
            Object.keys(require.cache).forEach(key => {
                if (key.startsWith(modulePath)) {
                    delete require.cache[key];
                }
            });

            // Load module
            await this.loadModule(moduleData);

            logger.info(`Module reloaded: ${moduleName}`);

            return true;
        } catch (error) {
            logger.error(`Error reloading module ${moduleName}`, { error: error.message });
            return false;
        }
    }

    /**
     * Get loaded module
     */
    getModule(moduleName) {
        return this.loadedModules.get(moduleName);
    }

    /**
     * Get all loaded modules
     */
    getAllModules() {
        return Array.from(this.loadedModules.values());
    }

    /**
     * Check if module is loaded
     */
    isModuleLoaded(moduleName) {
        return this.loadedModules.has(moduleName);
    }
}

module.exports = EnhancedModuleLoader;
