/**
 * Module Management API
 * Admin-Interface für Module Feature-Toggles und Einstellungen
 * Author: Jan Günther <jg@linxpress.de>
 */

const express = require('express');
const router = express.Router();
const moduleRegistry = require('./enhancedModuleRegistry');
const { authenticateToken, requirePermission } = require('./middleware');
const i18n = require('./i18n');

// ==============================================
// MODULE REGISTRY
// ==============================================

/**
 * GET /api/admin/modules
 * List all modules
 */
router.get('/admin/modules', authenticateToken, requirePermission('admin.modules'), async (req, res) => {
    try {
        const { enabled_only, category } = req.query;

        const modules = await moduleRegistry.getAllModules({
            enabled_only: enabled_only === 'true',
            category
        });

        res.json({
            success: true,
            data: modules
        });
    } catch (error) {
        console.error('Error listing modules:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * GET /api/admin/modules/statistics
 * Get module statistics
 */
router.get('/admin/modules/statistics', authenticateToken, requirePermission('admin.modules'), async (req, res) => {
    try {
        const stats = await moduleRegistry.getModuleStatistics();

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * GET /api/admin/modules/:id
 * Get module details
 */
router.get('/admin/modules/:id', authenticateToken, requirePermission('admin.modules'), async (req, res) => {
    try {
        const { id } = req.params;
        const module = await moduleRegistry.getModuleById(parseInt(id));

        // Get dependencies
        const dependencies = await moduleRegistry.getModuleDependencies(parseInt(id));
        const dependents = await moduleRegistry.getDependentModules(parseInt(id));

        res.json({
            success: true,
            data: {
                ...module,
                dependencies,
                dependents
            }
        });
    } catch (error) {
        if (error.message === 'Module not found') {
            return res.status(404).json({
                success: false,
                message: i18n.t('errors.notFound', { lng: req.language })
            });
        }

        console.error('Error finding module:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * POST /api/admin/modules/:id/enable
 * Enable module
 */
router.post('/admin/modules/:id/enable', authenticateToken, requirePermission('admin.modules'), async (req, res) => {
    try {
        const { id } = req.params;
        const module = await moduleRegistry.enableModule(parseInt(id));

        res.json({
            success: true,
            data: module,
            message: `Module ${module.name} enabled`
        });
    } catch (error) {
        if (error.message.includes('dependencies not met')) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        console.error('Error enabling module:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * POST /api/admin/modules/:id/disable
 * Disable module
 */
router.post('/admin/modules/:id/disable', authenticateToken, requirePermission('admin.modules'), async (req, res) => {
    try {
        const { id } = req.params;
        const module = await moduleRegistry.disableModule(parseInt(id));

        res.json({
            success: true,
            data: module,
            message: `Module ${module.name} disabled`
        });
    } catch (error) {
        if (error.message.includes('other module')) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        console.error('Error disabling module:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * PUT /api/admin/modules/:id/config
 * Update module configuration
 */
router.put('/admin/modules/:id/config', authenticateToken, requirePermission('admin.modules'), async (req, res) => {
    try {
        const { id } = req.params;
        const { config } = req.body;

        await moduleRegistry.updateModuleConfig(parseInt(id), config);

        res.json({
            success: true,
            message: 'Module configuration updated'
        });
    } catch (error) {
        console.error('Error updating module config:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

// ==============================================
// MODULE SETTINGS
// ==============================================

/**
 * GET /api/admin/modules/:id/settings
 * Get all module settings
 */
router.get('/admin/modules/:id/settings', authenticateToken, requirePermission('admin.modules'), async (req, res) => {
    try {
        const { id } = req.params;
        const settings = await moduleRegistry.getAllModuleSettings(parseInt(id));

        res.json({
            success: true,
            data: settings
        });
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * GET /api/admin/modules/:id/settings/:key
 * Get specific module setting
 */
router.get('/admin/modules/:id/settings/:key', authenticateToken, requirePermission('admin.modules'), async (req, res) => {
    try {
        const { id, key } = req.params;
        const value = await moduleRegistry.getModuleSetting(parseInt(id), key);

        res.json({
            success: true,
            data: { key, value }
        });
    } catch (error) {
        console.error('Error fetching setting:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * PUT /api/admin/modules/:id/settings/:key
 * Update module setting
 */
router.put('/admin/modules/:id/settings/:key', authenticateToken, requirePermission('admin.modules'), async (req, res) => {
    try {
        const { id, key } = req.params;
        const { value, type = 'string' } = req.body;

        await moduleRegistry.setModuleSetting(parseInt(id), key, value, type, req.user.id);

        res.json({
            success: true,
            message: 'Setting updated'
        });
    } catch (error) {
        console.error('Error updating setting:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

// ==============================================
// MODULE HOOKS
// ==============================================

/**
 * GET /api/admin/modules/hooks
 * List all registered hooks
 */
router.get('/admin/modules/hooks', authenticateToken, requirePermission('admin.modules'), async (req, res) => {
    try {
        const { hook_name } = req.query;

        if (hook_name) {
            const hooks = await moduleRegistry.getHooksForEvent(hook_name);
            return res.json({
                success: true,
                data: hooks
            });
        }

        // Get all hooks (would need a separate query)
        res.json({
            success: true,
            data: [],
            message: 'Specify hook_name parameter to get hooks for specific event'
        });
    } catch (error) {
        console.error('Error fetching hooks:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * POST /api/admin/modules/hooks/:hookId/disable
 * Disable a hook
 */
router.post('/admin/modules/hooks/:hookId/disable', authenticateToken, requirePermission('admin.modules'), async (req, res) => {
    try {
        const { hookId } = req.params;
        await moduleRegistry.disableHook(parseInt(hookId));

        res.json({
            success: true,
            message: 'Hook disabled'
        });
    } catch (error) {
        console.error('Error disabling hook:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * POST /api/admin/modules/hooks/:hookId/enable
 * Enable a hook
 */
router.post('/admin/modules/hooks/:hookId/enable', authenticateToken, requirePermission('admin.modules'), async (req, res) => {
    try {
        const { hookId } = req.params;
        await moduleRegistry.enableHook(parseInt(hookId));

        res.json({
            success: true,
            message: 'Hook enabled'
        });
    } catch (error) {
        console.error('Error enabling hook:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

// ==============================================
// MODULE ROUTES
// ==============================================

/**
 * GET /api/admin/modules/:id/routes
 * Get all routes for a module
 */
router.get('/admin/modules/:id/routes', authenticateToken, requirePermission('admin.modules'), async (req, res) => {
    try {
        const { id } = req.params;
        const routes = await moduleRegistry.getModuleRoutes(parseInt(id));

        res.json({
            success: true,
            data: routes
        });
    } catch (error) {
        console.error('Error fetching routes:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * GET /api/admin/modules/routes
 * Get all routes from all enabled modules
 */
router.get('/admin/modules/routes', authenticateToken, requirePermission('admin.modules'), async (req, res) => {
    try {
        const routes = await moduleRegistry.getAllEnabledRoutes();

        res.json({
            success: true,
            data: routes
        });
    } catch (error) {
        console.error('Error fetching all routes:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

module.exports = router;
