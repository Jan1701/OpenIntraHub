/**
 * Enhanced Module Registry Service
 * Verwaltet Module mit Feature-Flags, Dependencies und Hooks
 * Author: Jan Günther <jg@linxpress.de>
 */

const database = require('./database');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('ModuleRegistry');

// ==============================================
// MODULE REGISTRY
// ==============================================

/**
 * Get all modules from registry
 */
async function getAllModules(options = {}) {
    const { enabled_only = false, category, order_by = 'install_order' } = options;

    let query = 'SELECT * FROM module_registry WHERE 1=1';
    const params = [];

    if (enabled_only) {
        query += ' AND enabled = true';
    }

    if (category) {
        params.push(category);
        query += ` AND category = $${params.length}`;
    }

    const validOrderColumns = ['install_order', 'name', 'created_at'];
    const orderColumn = validOrderColumns.includes(order_by) ? order_by : 'install_order';
    query += ` ORDER BY ${orderColumn} ASC, name ASC`;

    const result = await database.query(query, params);
    return result.rows;
}

/**
 * Get module by ID
 */
async function getModuleById(moduleId) {
    const result = await database.query(
        'SELECT * FROM module_registry WHERE id = $1',
        [moduleId]
    );

    if (result.rows.length === 0) {
        throw new Error('Module not found');
    }

    return result.rows[0];
}

/**
 * Get module by name
 */
async function getModuleByName(name) {
    const result = await database.query(
        'SELECT * FROM module_registry WHERE name = $1',
        [name]
    );

    if (result.rows.length === 0) {
        throw new Error('Module not found');
    }

    return result.rows[0];
}

/**
 * Check if module is enabled
 */
async function isModuleEnabled(moduleName) {
    const result = await database.query(
        'SELECT enabled FROM module_registry WHERE name = $1',
        [moduleName]
    );

    return result.rows.length > 0 && result.rows[0].enabled;
}

/**
 * Enable module
 */
async function enableModule(moduleId) {
    // Check dependencies first
    const canEnable = await checkModuleDependencies(moduleId);
    if (!canEnable) {
        throw new Error('Cannot enable module: dependencies not met');
    }

    await database.query(
        'UPDATE module_registry SET enabled = true WHERE id = $1',
        [moduleId]
    );

    const module = await getModuleById(moduleId);
    logger.info('Module enabled', { moduleId, name: module.name });

    return module;
}

/**
 * Disable module
 */
async function disableModule(moduleId) {
    // Trigger will prevent disable if other modules depend on it
    await database.query(
        'UPDATE module_registry SET enabled = false WHERE id = $1',
        [moduleId]
    );

    const module = await getModuleById(moduleId);
    logger.info('Module disabled', { moduleId, name: module.name });

    return module;
}

/**
 * Check module dependencies
 */
async function checkModuleDependencies(moduleId) {
    const result = await database.query(
        'SELECT check_module_dependencies($1) as can_enable',
        [moduleId]
    );

    return result.rows[0].can_enable;
}

/**
 * Get module dependencies
 */
async function getModuleDependencies(moduleId) {
    const module = await getModuleById(moduleId);
    const dependencies = module.dependencies || [];

    if (dependencies.length === 0) {
        return [];
    }

    const result = await database.query(
        'SELECT * FROM module_registry WHERE id = ANY($1::int[])',
        [dependencies]
    );

    return result.rows;
}

/**
 * Get dependent modules (modules that depend on this one)
 */
async function getDependentModules(moduleId) {
    const result = await database.query(
        `SELECT * FROM module_registry
         WHERE enabled = true
         AND dependencies @> $1::jsonb`,
        [JSON.stringify([moduleId])]
    );

    return result.rows;
}

// ==============================================
// MODULE SETTINGS
// ==============================================

/**
 * Get module setting
 */
async function getModuleSetting(moduleId, key) {
    const result = await database.query(
        'SELECT setting_value FROM module_settings WHERE module_id = $1 AND setting_key = $2',
        [moduleId, key]
    );

    return result.rows.length > 0 ? result.rows[0].setting_value : null;
}

/**
 * Set module setting
 */
async function setModuleSetting(moduleId, key, value, type = 'string', userId = null) {
    await database.query(
        `INSERT INTO module_settings (module_id, setting_key, setting_value, setting_type, updated_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (module_id, setting_key)
         DO UPDATE SET
            setting_value = EXCLUDED.setting_value,
            setting_type = EXCLUDED.setting_type,
            updated_by = EXCLUDED.updated_by,
            updated_at = CURRENT_TIMESTAMP`,
        [moduleId, key, JSON.stringify(value), type, userId]
    );

    logger.info('Module setting updated', { moduleId, key });
}

/**
 * Get all module settings
 */
async function getAllModuleSettings(moduleId) {
    const result = await database.query(
        'SELECT setting_key, setting_value, setting_type FROM module_settings WHERE module_id = $1',
        [moduleId]
    );

    const settings = {};
    result.rows.forEach(row => {
        settings[row.setting_key] = row.setting_value;
    });

    return settings;
}

// ==============================================
// MODULE HOOKS
// ==============================================

/**
 * Register module hook
 */
async function registerHook(moduleId, hookName, handlerFunction, priority = 10) {
    const result = await database.query(
        `INSERT INTO module_hooks (module_id, hook_name, handler_function, priority)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (module_id, hook_name, handler_function)
         DO UPDATE SET priority = EXCLUDED.priority
         RETURNING *`,
        [moduleId, hookName, handlerFunction, priority]
    );

    logger.info('Hook registered', { moduleId, hookName, handler: handlerFunction });
    return result.rows[0];
}

/**
 * Get hooks for event
 */
async function getHooksForEvent(hookName) {
    const result = await database.query(
        `SELECT h.*, m.name as module_name, m.component
         FROM module_hooks h
         JOIN module_registry m ON m.id = h.module_id
         WHERE h.hook_name = $1
         AND h.enabled = true
         AND m.enabled = true
         ORDER BY h.priority ASC`,
        [hookName]
    );

    return result.rows;
}

/**
 * Trigger hook (call all registered handlers)
 */
async function triggerHook(hookName, data = {}) {
    const hooks = await getHooksForEvent(hookName);

    logger.debug('Triggering hook', { hookName, handlerCount: hooks.length });

    const results = [];
    for (const hook of hooks) {
        try {
            // Here we would actually call the handler function
            // This requires loading the module's handler
            logger.debug('Executing hook handler', {
                module: hook.module_name,
                handler: hook.handler_function
            });

            // Placeholder for actual handler execution
            results.push({
                module: hook.module_name,
                handler: hook.handler_function,
                success: true
            });
        } catch (error) {
            logger.error('Hook handler failed', {
                module: hook.module_name,
                handler: hook.handler_function,
                error: error.message
            });

            results.push({
                module: hook.module_name,
                handler: hook.handler_function,
                success: false,
                error: error.message
            });
        }
    }

    return results;
}

/**
 * Disable hook
 */
async function disableHook(hookId) {
    await database.query(
        'UPDATE module_hooks SET enabled = false WHERE id = $1',
        [hookId]
    );
}

/**
 * Enable hook
 */
async function enableHook(hookId) {
    await database.query(
        'UPDATE module_hooks SET enabled = true WHERE id = $1',
        [hookId]
    );
}

// ==============================================
// MODULE ROUTES
// ==============================================

/**
 * Register module route
 */
async function registerRoute(moduleId, routeData) {
    const {
        route_path,
        route_method = 'GET',
        handler_file,
        handler_function,
        middleware = [],
        required_permission,
        is_public = false
    } = routeData;

    const result = await database.query(
        `INSERT INTO module_routes (
            module_id, route_path, route_method, handler_file, handler_function,
            middleware, required_permission, is_public
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (route_path, route_method)
        DO UPDATE SET
            handler_file = EXCLUDED.handler_file,
            handler_function = EXCLUDED.handler_function,
            middleware = EXCLUDED.middleware,
            required_permission = EXCLUDED.required_permission,
            is_public = EXCLUDED.is_public
        RETURNING *`,
        [
            moduleId, route_path, route_method, handler_file, handler_function,
            JSON.stringify(middleware), required_permission, is_public
        ]
    );

    logger.info('Route registered', { moduleId, method: route_method, path: route_path });
    return result.rows[0];
}

/**
 * Get all module routes
 */
async function getModuleRoutes(moduleId) {
    const result = await database.query(
        'SELECT * FROM module_routes WHERE module_id = $1 ORDER BY route_path ASC',
        [moduleId]
    );

    return result.rows;
}

/**
 * Get all routes for enabled modules
 */
async function getAllEnabledRoutes() {
    const result = await database.query(
        `SELECT r.*, m.name as module_name
         FROM module_routes r
         JOIN module_registry m ON m.id = r.module_id
         WHERE m.enabled = true
         ORDER BY r.route_path ASC`
    );

    return result.rows;
}

// ==============================================
// MODULE LIFECYCLE
// ==============================================

/**
 * Mark module setup as completed
 */
async function markSetupCompleted(moduleId) {
    await database.query(
        'UPDATE module_registry SET setup_completed = true WHERE id = $1',
        [moduleId]
    );

    logger.info('Module setup completed', { moduleId });
}

/**
 * Get modules requiring setup
 */
async function getModulesRequiringSetup() {
    const result = await database.query(
        `SELECT * FROM module_registry
         WHERE requires_setup = true
         AND setup_completed = false
         AND enabled = true
         ORDER BY install_order ASC`
    );

    return result.rows;
}

/**
 * Update module config
 */
async function updateModuleConfig(moduleId, config) {
    await database.query(
        'UPDATE module_registry SET module_config = $1 WHERE id = $2',
        [JSON.stringify(config), moduleId]
    );

    logger.info('Module config updated', { moduleId });
}

// ==============================================
// STATISTICS
// ==============================================

/**
 * Get module statistics
 */
async function getModuleStatistics() {
    const stats = {};

    // Total modules
    const totalResult = await database.query('SELECT COUNT(*) as count FROM module_registry');
    stats.total = parseInt(totalResult.rows[0].count);

    // Enabled modules
    const enabledResult = await database.query(
        'SELECT COUNT(*) as count FROM module_registry WHERE enabled = true'
    );
    stats.enabled = parseInt(enabledResult.rows[0].count);

    // System modules
    const systemResult = await database.query(
        'SELECT COUNT(*) as count FROM module_registry WHERE is_system = true'
    );
    stats.system = parseInt(systemResult.rows[0].count);

    // Modules by category
    const categoryResult = await database.query(
        `SELECT category, COUNT(*) as count
         FROM module_registry
         WHERE enabled = true
         GROUP BY category`
    );
    stats.by_category = categoryResult.rows;

    return stats;
}

// ==============================================
// EXPORTS
// ==============================================

module.exports = {
    // Registry
    getAllModules,
    getModuleById,
    getModuleByName,
    isModuleEnabled,
    enableModule,
    disableModule,
    checkModuleDependencies,
    getModuleDependencies,
    getDependentModules,

    // Settings
    getModuleSetting,
    setModuleSetting,
    getAllModuleSettings,

    // Hooks
    registerHook,
    getHooksForEvent,
    triggerHook,
    disableHook,
    enableHook,

    // Routes
    registerRoute,
    getModuleRoutes,
    getAllEnabledRoutes,

    // Lifecycle
    markSetupCompleted,
    getModulesRequiringSetup,
    updateModuleConfig,

    // Statistics
    getModuleStatistics
};
