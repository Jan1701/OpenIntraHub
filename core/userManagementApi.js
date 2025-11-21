/**
 * User Management API
 * Admin-Interface für User-Verwaltung mit Standort-Zuordnung
 * Author: Jan Günther <jg@linxpress.de>
 */

const express = require('express');
const router = express.Router();
const userService = require('./userService');
const locationService = require('./locationService');
const { authenticateToken, requirePermission } = require('./middleware');
const i18n = require('./i18n');

// ==============================================
// USER MANAGEMENT
// ==============================================

/**
 * GET /api/admin/users
 * List all users with locations
 */
router.get('/admin/users', authenticateToken, requirePermission('admin.users'), async (req, res) => {
    try {
        const { search, role, is_active, location_id } = req.query;

        // Build query
        let query = `
            SELECT u.*,
                   (SELECT json_agg(json_build_object(
                       'id', l.id,
                       'name', l.name,
                       'code', l.code,
                       'is_primary', ul.is_primary
                   ))
                   FROM user_locations ul
                   JOIN locations l ON l.id = ul.location_id
                   WHERE ul.user_id = u.id) as locations
            FROM users u
            WHERE 1=1
        `;

        const params = [];

        if (search) {
            params.push(`%${search}%`);
            query += ` AND (u.username ILIKE $${params.length} OR u.email ILIKE $${params.length} OR u.name ILIKE $${params.length})`;
        }

        if (role) {
            params.push(role);
            query += ` AND u.role = $${params.length}`;
        }

        if (is_active !== undefined) {
            params.push(is_active === 'true');
            query += ` AND u.is_active = $${params.length}`;
        }

        if (location_id) {
            params.push(parseInt(location_id));
            query += ` AND EXISTS (
                SELECT 1 FROM user_locations ul
                WHERE ul.user_id = u.id AND ul.location_id = $${params.length}
            )`;
        }

        query += ' ORDER BY u.username ASC';

        const result = await userService.database.query(query, params);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error listing users:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * GET /api/admin/users/:id
 * Get user details with locations
 */
router.get('/admin/users/:id', authenticateToken, requirePermission('admin.users'), async (req, res) => {
    try {
        const { id } = req.params;
        const user = await userService.findUserById(parseInt(id));

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get user locations
        const locations = await locationService.getUserLocations(parseInt(id));
        user.locations = locations;

        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Error finding user:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * POST /api/admin/users
 * Create new user
 */
router.post('/admin/users', authenticateToken, requirePermission('admin.users'), async (req, res) => {
    try {
        const { locations: locationIds, ...userData } = req.body;

        // Create user
        const user = await userService.createUser(userData);

        // Assign locations if provided
        if (locationIds && Array.isArray(locationIds) && locationIds.length > 0) {
            for (let i = 0; i < locationIds.length; i++) {
                const locationId = locationIds[i];
                await locationService.assignUserToLocation(
                    user.id,
                    locationId,
                    { is_primary: i === 0 }, // First location is primary
                    req.user.id
                );
            }
        }

        // Get user with locations
        const locations = await locationService.getUserLocations(user.id);
        user.locations = locations;

        res.status(201).json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({
            success: false,
            message: error.message || i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * PUT /api/admin/users/:id
 * Update user
 */
router.put('/admin/users/:id', authenticateToken, requirePermission('admin.users'), async (req, res) => {
    try {
        const { id } = req.params;
        const { locations: locationIds, ...updates } = req.body;

        // Update user basic data
        const user = await userService.updateUser(parseInt(id), updates);

        // Update locations if provided
        if (locationIds !== undefined && Array.isArray(locationIds)) {
            // Get current locations
            const currentLocations = await locationService.getUserLocations(parseInt(id));

            // Remove locations not in new list
            for (const loc of currentLocations) {
                if (!locationIds.includes(loc.location_id)) {
                    await locationService.removeUserFromLocation(parseInt(id), loc.location_id);
                }
            }

            // Add new locations
            for (let i = 0; i < locationIds.length; i++) {
                const locationId = locationIds[i];
                if (!currentLocations.find(l => l.location_id === locationId)) {
                    await locationService.assignUserToLocation(
                        parseInt(id),
                        locationId,
                        { is_primary: i === 0 },
                        req.user.id
                    );
                }
            }
        }

        // Get user with locations
        const locations = await locationService.getUserLocations(parseInt(id));
        user.locations = locations;

        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * DELETE /api/admin/users/:id
 * Delete user
 */
router.delete('/admin/users/:id', authenticateToken, requirePermission('admin.users'), async (req, res) => {
    try {
        const { id } = req.params;
        await userService.deleteUser(parseInt(id));

        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

module.exports = router;
