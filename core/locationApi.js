/**
 * Location REST API
 * RESTful endpoints for location management
 * Author: Jan Günther <jg@linxpress.de>
 */

const express = require('express');
const router = express.Router();
const locationService = require('./locationService');
const { authenticateToken, requirePermission } = require('./middleware');
const i18n = require('./i18n');

// ==============================================
// LOCATIONS
// ==============================================

/**
 * GET /api/locations
 * List all locations
 */
router.get('/locations', authenticateToken, async (req, res) => {
    try {
        const { is_active, type, country, parent_id, search, include_user_count } = req.query;

        const options = {
            is_active: is_active !== undefined ? is_active === 'true' : undefined,
            type,
            country,
            parent_id: parent_id !== undefined ? (parent_id === 'null' ? null : parseInt(parent_id)) : undefined,
            search,
            include_user_count: include_user_count === 'true'
        };

        const locations = await locationService.listLocations(options);

        res.json({
            success: true,
            data: locations
        });
    } catch (error) {
        console.error('Error listing locations:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * GET /api/locations/hierarchy
 * Get location hierarchy tree
 */
router.get('/locations/hierarchy', authenticateToken, async (req, res) => {
    try {
        const { root_id } = req.query;
        const hierarchy = await locationService.getLocationHierarchy(
            root_id ? parseInt(root_id) : null
        );

        res.json({
            success: true,
            data: hierarchy
        });
    } catch (error) {
        console.error('Error fetching hierarchy:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * GET /api/locations/:id
 * Get location by ID
 */
router.get('/locations/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { include_users } = req.query;

        const location = await locationService.findLocationById(
            parseInt(id),
            include_users === 'true'
        );

        res.json({
            success: true,
            data: location
        });
    } catch (error) {
        if (error.message === 'Location not found') {
            return res.status(404).json({
                success: false,
                message: i18n.t('errors.notFound', { lng: req.language })
            });
        }

        console.error('Error finding location:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * GET /api/locations/code/:code
 * Get location by code
 */
router.get('/locations/code/:code', authenticateToken, async (req, res) => {
    try {
        const { code } = req.params;
        const location = await locationService.findLocationByCode(code);

        res.json({
            success: true,
            data: location
        });
    } catch (error) {
        if (error.message === 'Location not found') {
            return res.status(404).json({
                success: false,
                message: i18n.t('errors.notFound', { lng: req.language })
            });
        }

        console.error('Error finding location:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * POST /api/locations
 * Create new location
 */
router.post('/locations', authenticateToken, requirePermission('admin.locations'), async (req, res) => {
    try {
        const location = await locationService.createLocation(req.body, req.user.id);

        res.status(201).json({
            success: true,
            data: location
        });
    } catch (error) {
        console.error('Error creating location:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language }),
            error: error.message
        });
    }
});

/**
 * PUT /api/locations/:id
 * Update location
 */
router.put('/locations/:id', authenticateToken, requirePermission('admin.locations'), async (req, res) => {
    try {
        const { id } = req.params;
        const location = await locationService.updateLocation(parseInt(id), req.body, req.user.id);

        res.json({
            success: true,
            data: location
        });
    } catch (error) {
        if (error.message === 'Location not found') {
            return res.status(404).json({
                success: false,
                message: i18n.t('errors.notFound', { lng: req.language })
            });
        }

        console.error('Error updating location:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language }),
            error: error.message
        });
    }
});

/**
 * DELETE /api/locations/:id
 * Delete location
 */
router.delete('/locations/:id', authenticateToken, requirePermission('admin.locations'), async (req, res) => {
    try {
        const { id } = req.params;
        await locationService.deleteLocation(parseInt(id));

        res.json({
            success: true,
            message: 'Location deleted successfully'
        });
    } catch (error) {
        if (error.message.includes('Cannot delete')) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        console.error('Error deleting location:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * GET /api/locations/:id/statistics
 * Get location statistics
 */
router.get('/locations/:id/statistics', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const stats = await locationService.getLocationStatistics(parseInt(id));

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

// ==============================================
// USER LOCATION ASSIGNMENTS
// ==============================================

/**
 * GET /api/locations/:id/users
 * Get users assigned to location
 */
router.get('/locations/:id/users', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { include_inactive } = req.query;

        const users = await locationService.getLocationUsers(
            parseInt(id),
            { include_inactive: include_inactive === 'true' }
        );

        res.json({
            success: true,
            data: users
        });
    } catch (error) {
        console.error('Error fetching location users:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * POST /api/locations/:id/users/:userId
 * Assign user to location
 */
router.post('/locations/:id/users/:userId', authenticateToken, requirePermission('admin.users'), async (req, res) => {
    try {
        const { id, userId } = req.params;
        const assignment = await locationService.assignUserToLocation(
            parseInt(userId),
            parseInt(id),
            req.body,
            req.user.id
        );

        res.status(201).json({
            success: true,
            data: assignment
        });
    } catch (error) {
        console.error('Error assigning user to location:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language }),
            error: error.message
        });
    }
});

/**
 * DELETE /api/locations/:id/users/:userId
 * Remove user from location
 */
router.delete('/locations/:id/users/:userId', authenticateToken, requirePermission('admin.users'), async (req, res) => {
    try {
        const { id, userId } = req.params;
        await locationService.removeUserFromLocation(parseInt(userId), parseInt(id));

        res.json({
            success: true,
            message: 'User removed from location'
        });
    } catch (error) {
        console.error('Error removing user from location:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * GET /api/users/:userId/locations
 * Get user's assigned locations
 */
router.get('/users/:userId/locations', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;

        // Users can only view their own locations unless they have admin permission
        if (parseInt(userId) !== req.user.id && !req.user.permissions?.includes('admin.users')) {
            return res.status(403).json({
                success: false,
                message: 'Forbidden'
            });
        }

        const locations = await locationService.getUserLocations(parseInt(userId));

        res.json({
            success: true,
            data: locations
        });
    } catch (error) {
        console.error('Error fetching user locations:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * GET /api/users/:userId/locations/primary
 * Get user's primary location
 */
router.get('/users/:userId/locations/primary', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;

        // Users can only view their own locations unless they have admin permission
        if (parseInt(userId) !== req.user.id && !req.user.permissions?.includes('admin.users')) {
            return res.status(403).json({
                success: false,
                message: 'Forbidden'
            });
        }

        const location = await locationService.getUserPrimaryLocation(parseInt(userId));

        res.json({
            success: true,
            data: location
        });
    } catch (error) {
        console.error('Error fetching primary location:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * PUT /api/users/:userId/locations/:locationId/primary
 * Set primary location for user
 */
router.put('/users/:userId/locations/:locationId/primary', authenticateToken, async (req, res) => {
    try {
        const { userId, locationId } = req.params;

        // Users can set their own primary location, admins can set for others
        if (parseInt(userId) !== req.user.id && !req.user.permissions?.includes('admin.users')) {
            return res.status(403).json({
                success: false,
                message: 'Forbidden'
            });
        }

        await locationService.setPrimaryLocation(parseInt(userId), parseInt(locationId));

        res.json({
            success: true,
            message: 'Primary location updated'
        });
    } catch (error) {
        if (error.message === 'User is not assigned to this location') {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        console.error('Error setting primary location:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

// ==============================================
// LOCATION SETTINGS
// ==============================================

/**
 * GET /api/locations/:id/settings
 * Get all settings for location
 */
router.get('/locations/:id/settings', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const settings = await locationService.getLocationSettings(parseInt(id));

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
 * GET /api/locations/:id/settings/:key
 * Get specific setting
 */
router.get('/locations/:id/settings/:key', authenticateToken, async (req, res) => {
    try {
        const { id, key } = req.params;
        const value = await locationService.getLocationSetting(parseInt(id), key);

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
 * PUT /api/locations/:id/settings/:key
 * Set location setting
 */
router.put('/locations/:id/settings/:key', authenticateToken, requirePermission('admin.locations'), async (req, res) => {
    try {
        const { id, key } = req.params;
        const { value, type = 'string' } = req.body;

        await locationService.setLocationSetting(parseInt(id), key, value, type, req.user.id);

        res.json({
            success: true,
            message: 'Setting updated'
        });
    } catch (error) {
        console.error('Error setting location setting:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

// ==============================================
// LOCATION RESOURCES
// ==============================================

/**
 * GET /api/locations/:id/resources
 * List location resources
 */
router.get('/locations/:id/resources', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.query;

        const resources = await locationService.listLocationResources(parseInt(id), type);

        res.json({
            success: true,
            data: resources
        });
    } catch (error) {
        console.error('Error listing resources:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * POST /api/locations/:id/resources
 * Create location resource
 */
router.post('/locations/:id/resources', authenticateToken, requirePermission('admin.locations'), async (req, res) => {
    try {
        const { id } = req.params;
        const resource = await locationService.createLocationResource(parseInt(id), req.body, req.user.id);

        res.status(201).json({
            success: true,
            data: resource
        });
    } catch (error) {
        console.error('Error creating resource:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * PUT /api/locations/resources/:resourceId
 * Update location resource
 */
router.put('/locations/resources/:resourceId', authenticateToken, requirePermission('admin.locations'), async (req, res) => {
    try {
        const { resourceId } = req.params;
        const resource = await locationService.updateLocationResource(parseInt(resourceId), req.body);

        res.json({
            success: true,
            data: resource
        });
    } catch (error) {
        if (error.message === 'Resource not found') {
            return res.status(404).json({
                success: false,
                message: i18n.t('errors.notFound', { lng: req.language })
            });
        }

        console.error('Error updating resource:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * DELETE /api/locations/resources/:resourceId
 * Delete location resource
 */
router.delete('/locations/resources/:resourceId', authenticateToken, requirePermission('admin.locations'), async (req, res) => {
    try {
        const { resourceId } = req.params;
        await locationService.deleteLocationResource(parseInt(resourceId));

        res.json({
            success: true,
            message: 'Resource deleted'
        });
    } catch (error) {
        console.error('Error deleting resource:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

// ==============================================
// AD INTEGRATION
// ==============================================

/**
 * POST /api/locations/:id/sync-ad
 * Trigger AD sync for location
 */
router.post('/locations/:id/sync-ad', authenticateToken, requirePermission('admin.locations'), async (req, res) => {
    try {
        const { id } = req.params;
        await locationService.syncLocationFromAD(parseInt(id));

        res.json({
            success: true,
            message: 'AD sync completed'
        });
    } catch (error) {
        console.error('Error syncing from AD:', error);
        res.status(500).json({
            success: false,
            message: error.message || i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

module.exports = router;
