// =====================================================
// LDAP Admin API - Management & Testing Endpoints
// =====================================================

const express = require('express');
const router = express.Router();
const ldapService = require('./ldapService');
const ldapSyncWorker = require('./ldapSyncWorker');
const pool = require('./db');
const { authenticateToken, requireAdmin } = require('./middleware');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('LDAPApi');

/**
 * GET /api/ldap/config
 * Get LDAP configuration (non-sensitive data)
 */
router.get('/ldap/config', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const config = ldapService.getConfig();

        res.json({
            success: true,
            data: config
        });
    } catch (error) {
        logger.error('GET /ldap/config failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/ldap/test-connection
 * Test LDAP connection
 */
router.post('/ldap/test-connection', authenticateToken, requireAdmin, async (req, res) => {
    try {
        if (!ldapService.enabled) {
            return res.status(400).json({
                success: false,
                error: 'LDAP is not configured. Set LDAP_URL in environment.'
            });
        }

        const result = await ldapService.testConnection();

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error('LDAP connection test failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/ldap/search-users
 * Search for users in LDAP
 */
router.post('/ldap/search-users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        if (!ldapService.enabled) {
            return res.status(400).json({
                success: false,
                error: 'LDAP is not configured'
            });
        }

        const { searchTerm, limit } = req.body;

        const users = await ldapService.searchUsers(
            searchTerm || '*',
            limit || 100
        );

        res.json({
            success: true,
            count: users.length,
            data: users
        });
    } catch (error) {
        logger.error('LDAP user search failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/ldap/sync/trigger
 * Manually trigger LDAP sync
 */
router.post('/ldap/sync/trigger', authenticateToken, requireAdmin, async (req, res) => {
    try {
        if (!ldapService.enabled) {
            return res.status(400).json({
                success: false,
                error: 'LDAP is not configured'
            });
        }

        // Trigger sync in background
        ldapSyncWorker.triggerSync()
            .then(result => {
                logger.info('Manual LDAP sync completed', result);
            })
            .catch(err => {
                logger.error('Manual LDAP sync failed', { error: err.message });
            });

        res.json({
            success: true,
            message: 'LDAP sync triggered. Check logs for progress.'
        });
    } catch (error) {
        logger.error('Failed to trigger LDAP sync', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/ldap/sync/status
 * Get current sync status
 */
router.get('/ldap/sync/status', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const isRunning = ldapSyncWorker.isRunning;
        const stats = await ldapSyncWorker.getSyncStats();

        res.json({
            success: true,
            data: {
                isRunning,
                enabled: ldapSyncWorker.config.enabled,
                schedule: ldapSyncWorker.config.schedule,
                stats
            }
        });
    } catch (error) {
        logger.error('GET /ldap/sync/status failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/ldap/sync/logs
 * Get recent sync logs
 */
router.get('/ldap/sync/logs', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const logs = await ldapSyncWorker.getRecentSyncLogs(limit);

        res.json({
            success: true,
            count: logs.length,
            data: logs
        });
    } catch (error) {
        logger.error('GET /ldap/sync/logs failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/ldap/users
 * Get all LDAP users from database
 */
router.get('/ldap/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { limit = 100, offset = 0, active_only } = req.query;

        let query = `
            SELECT
                id, username, name, email, role,
                is_active, ldap_dn, ldap_sam_account_name,
                ldap_user_principal_name, ldap_last_sync_at,
                created_at, last_login_at
            FROM users
            WHERE auth_method = 'ldap'
        `;

        if (active_only === 'true') {
            query += ' AND is_active = true';
        }

        query += ` ORDER BY name ASC LIMIT $1 OFFSET $2`;

        const result = await pool.query(query, [limit, offset]);

        // Get total count
        const countQuery = active_only === 'true'
            ? `SELECT COUNT(*) FROM users WHERE auth_method = 'ldap' AND is_active = true`
            : `SELECT COUNT(*) FROM users WHERE auth_method = 'ldap'`;

        const countResult = await pool.query(countQuery);
        const totalCount = parseInt(countResult.rows[0].count);

        res.json({
            success: true,
            count: result.rows.length,
            total: totalCount,
            data: result.rows,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: (parseInt(offset) + result.rows.length) < totalCount
            }
        });
    } catch (error) {
        logger.error('GET /ldap/users failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/ldap/group-mappings
 * Get LDAP group to role mappings
 */
router.get('/ldap/group-mappings', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id, ldap_group_dn, ldap_group_name,
                app_role, priority, is_active,
                created_at, updated_at
            FROM ldap_group_mappings
            ORDER BY priority DESC, ldap_group_name ASC
        `);

        res.json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        logger.error('GET /ldap/group-mappings failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/ldap/group-mappings
 * Create new group mapping
 */
router.post('/ldap/group-mappings', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { ldap_group_dn, ldap_group_name, app_role, priority } = req.body;

        if (!ldap_group_dn || !ldap_group_name || !app_role) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        const result = await pool.query(`
            INSERT INTO ldap_group_mappings (
                ldap_group_dn, ldap_group_name, app_role, priority
            ) VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [ldap_group_dn, ldap_group_name, app_role, priority || 0]);

        logger.info('LDAP group mapping created', {
            ldapGroup: ldap_group_name,
            appRole: app_role
        });

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        logger.error('POST /ldap/group-mappings failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * PUT /api/ldap/group-mappings/:id
 * Update group mapping
 */
router.put('/ldap/group-mappings/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { ldap_group_name, app_role, priority, is_active } = req.body;

        const result = await pool.query(`
            UPDATE ldap_group_mappings
            SET ldap_group_name = COALESCE($1, ldap_group_name),
                app_role = COALESCE($2, app_role),
                priority = COALESCE($3, priority),
                is_active = COALESCE($4, is_active),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $5
            RETURNING *
        `, [ldap_group_name, app_role, priority, is_active, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Group mapping not found'
            });
        }

        logger.info('LDAP group mapping updated', { id });

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        logger.error('PUT /ldap/group-mappings/:id failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/ldap/group-mappings/:id
 * Delete group mapping
 */
router.delete('/ldap/group-mappings/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'DELETE FROM ldap_group_mappings WHERE id = $1 RETURNING ldap_group_name',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Group mapping not found'
            });
        }

        logger.info('LDAP group mapping deleted', { id, name: result.rows[0].ldap_group_name });

        res.json({
            success: true,
            message: 'Group mapping deleted'
        });
    } catch (error) {
        logger.error('DELETE /ldap/group-mappings/:id failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/ldap/stats
 * Get LDAP user statistics
 */
router.get('/ldap/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                COUNT(*) as total_users,
                COUNT(*) FILTER (WHERE is_active = true) as active_users,
                COUNT(*) FILTER (WHERE is_active = false) as inactive_users,
                COUNT(DISTINCT role) as unique_roles,
                MAX(ldap_last_sync_at) as last_sync_at,
                COUNT(*) FILTER (WHERE last_login_at IS NOT NULL) as users_with_login,
                COUNT(*) FILTER (WHERE last_login_at > NOW() - INTERVAL '30 days') as active_last_30_days
            FROM users
            WHERE auth_method = 'ldap'
        `);

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        logger.error('GET /ldap/stats failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
