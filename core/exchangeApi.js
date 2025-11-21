// =====================================================
// Exchange API - REST Endpoints for Exchange Integration
// =====================================================

const express = require('express');
const router = express.Router();
const exchangeService = require('./exchangeService');
const { authenticateToken, requireRole } = require('./auth');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('ExchangeAPI');

/**
 * POST /api/exchange/test-connection
 * Test Exchange connection without saving
 */
router.post('/exchange/test-connection', authenticateToken, async (req, res) => {
    try {
        const { server_url, username, password, auth_type } = req.body;

        if (!server_url || !username || !password) {
            return res.status(400).json({
                success: false,
                message: 'server_url, username, and password are required'
            });
        }

        const result = await exchangeService.testConnection({
            server_url,
            username,
            password,
            auth_type: auth_type || 'basic'
        });

        res.json(result);
    } catch (error) {
        logger.error('Exchange connection test failed', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * POST /api/exchange/connect
 * Save Exchange connection for current user
 */
router.post('/exchange/connect', authenticateToken, async (req, res) => {
    try {
        const {
            server_url,
            username,
            password,
            auth_type,
            sync_enabled,
            sync_frequency_minutes,
            conflict_strategy,
            sync_direction
        } = req.body;

        if (!server_url || !username || !password) {
            return res.status(400).json({
                success: false,
                message: 'server_url, username, and password are required'
            });
        }

        // First test the connection
        const testResult = await exchangeService.testConnection({
            server_url,
            username,
            password,
            auth_type: auth_type || 'basic'
        });

        if (!testResult.success) {
            return res.status(400).json({
                success: false,
                message: `Connection test failed: ${testResult.message}`
            });
        }

        // Save connection
        const result = await exchangeService.saveConnection(req.user.id, {
            server_url,
            username,
            password,
            auth_type: auth_type || 'basic',
            sync_enabled: sync_enabled !== false,
            sync_frequency_minutes: sync_frequency_minutes || 15,
            conflict_strategy: conflict_strategy || 'exchange_wins',
            sync_direction: sync_direction || 'bidirectional'
        });

        logger.info('Exchange connection saved', {
            userId: req.user.id,
            connectionId: result.connectionId
        });

        res.json({
            success: true,
            message: 'Exchange connection saved successfully',
            connectionId: result.connectionId
        });
    } catch (error) {
        logger.error('Failed to save Exchange connection', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * GET /api/exchange/connection
 * Get current user's Exchange connection (without password)
 */
router.get('/exchange/connection', authenticateToken, async (req, res) => {
    try {
        const connection = await exchangeService.getConnection(req.user.id);

        if (!connection) {
            return res.json({
                success: true,
                connected: false,
                connection: null
            });
        }

        // Remove sensitive data
        const { password, password_encrypted, encryption_iv, ...safeConnection } = connection;

        res.json({
            success: true,
            connected: true,
            connection: safeConnection
        });
    } catch (error) {
        logger.error('Failed to get Exchange connection', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * DELETE /api/exchange/connection
 * Delete current user's Exchange connection
 */
router.delete('/exchange/connection', authenticateToken, async (req, res) => {
    try {
        await exchangeService.deleteConnection(req.user.id);

        logger.info('Exchange connection deleted', { userId: req.user.id });

        res.json({
            success: true,
            message: 'Exchange connection deleted successfully'
        });
    } catch (error) {
        logger.error('Failed to delete Exchange connection', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * GET /api/exchange/calendars
 * Discover and list user's Exchange calendars
 */
router.get('/exchange/calendars', authenticateToken, async (req, res) => {
    try {
        const result = await exchangeService.discoverCalendars(req.user.id);

        res.json({
            success: true,
            calendars: result.calendars
        });
    } catch (error) {
        logger.error('Failed to discover calendars', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * PUT /api/exchange/calendars/:id/sync
 * Enable/disable sync for specific calendar
 */
router.put('/exchange/calendars/:id/sync', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { enabled } = req.body;

        if (typeof enabled !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'enabled field must be a boolean'
            });
        }

        await exchangeService.toggleCalendarSync(req.user.id, parseInt(id), enabled);

        logger.info('Calendar sync toggled', {
            userId: req.user.id,
            calendarId: id,
            enabled
        });

        res.json({
            success: true,
            message: `Calendar sync ${enabled ? 'enabled' : 'disabled'}`
        });
    } catch (error) {
        logger.error('Failed to toggle calendar sync', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * POST /api/exchange/sync
 * Manually trigger synchronization
 */
router.post('/exchange/sync', authenticateToken, async (req, res) => {
    try {
        const { direction } = req.body;

        let result;

        if (direction === 'from_exchange' || !direction) {
            // Sync from Exchange to OpenIntraHub
            result = await exchangeService.syncFromExchange(req.user.id);
        } else if (direction === 'to_exchange') {
            // Sync from OpenIntraHub to Exchange
            result = await exchangeService.syncToExchange(req.user.id);
        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid direction. Use "from_exchange" or "to_exchange"'
            });
        }

        logger.info('Manual sync triggered', {
            userId: req.user.id,
            direction
        });

        res.json({
            success: true,
            message: 'Synchronization completed',
            stats: result.stats
        });
    } catch (error) {
        logger.error('Sync failed', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * GET /api/exchange/sync-status
 * Get sync status and recent logs
 */
router.get('/exchange/sync-status', authenticateToken, async (req, res) => {
    try {
        const pool = require('./db');

        // Get connection info
        const connectionResult = await pool.query(`
            SELECT
                last_sync_at,
                next_sync_at,
                sync_enabled,
                sync_frequency_minutes,
                connection_status,
                last_error,
                last_error_at
            FROM exchange_connections
            WHERE user_id = $1
        `, [req.user.id]);

        if (connectionResult.rows.length === 0) {
            return res.json({
                success: true,
                connected: false
            });
        }

        const connection = connectionResult.rows[0];

        // Get recent sync logs
        const logsResult = await pool.query(`
            SELECT
                sync_started_at,
                sync_finished_at,
                sync_duration_ms,
                sync_direction,
                events_fetched_from_exchange,
                events_created_in_openintrahub,
                events_updated_in_openintrahub,
                events_deleted_in_openintrahub,
                events_created_in_exchange,
                events_updated_in_exchange,
                events_deleted_in_exchange,
                conflicts_detected,
                conflicts_resolved,
                sync_status,
                error_message
            FROM exchange_sync_log esl
            JOIN exchange_connections ec ON esl.connection_id = ec.id
            WHERE ec.user_id = $1
            ORDER BY sync_started_at DESC
            LIMIT 10
        `, [req.user.id]);

        res.json({
            success: true,
            connected: true,
            connection: {
                last_sync_at: connection.last_sync_at,
                next_sync_at: connection.next_sync_at,
                sync_enabled: connection.sync_enabled,
                sync_frequency_minutes: connection.sync_frequency_minutes,
                connection_status: connection.connection_status,
                last_error: connection.last_error,
                last_error_at: connection.last_error_at
            },
            recent_syncs: logsResult.rows
        });
    } catch (error) {
        logger.error('Failed to get sync status', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * GET /api/exchange/conflicts
 * Get unresolved sync conflicts
 */
router.get('/exchange/conflicts', authenticateToken, async (req, res) => {
    try {
        const pool = require('./db');

        const result = await pool.query(`
            SELECT
                esc.id,
                esc.event_id,
                esc.exchange_event_id,
                esc.conflict_type,
                esc.conflict_detected_at,
                esc.openintrahub_data,
                esc.exchange_data,
                e.title as event_title
            FROM exchange_sync_conflicts esc
            JOIN exchange_connections ec ON esc.connection_id = ec.id
            LEFT JOIN events e ON esc.event_id = e.id
            WHERE ec.user_id = $1 AND esc.resolved = false
            ORDER BY esc.conflict_detected_at DESC
        `, [req.user.id]);

        res.json({
            success: true,
            conflicts: result.rows
        });
    } catch (error) {
        logger.error('Failed to get conflicts', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * POST /api/exchange/conflicts/:id/resolve
 * Resolve a sync conflict
 */
router.post('/exchange/conflicts/:id/resolve', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { resolution_strategy } = req.body;

        const validStrategies = ['keep_openintrahub', 'keep_exchange', 'merge', 'skip'];

        if (!validStrategies.includes(resolution_strategy)) {
            return res.status(400).json({
                success: false,
                message: `Invalid resolution strategy. Must be one of: ${validStrategies.join(', ')}`
            });
        }

        const pool = require('./db');

        // Mark conflict as resolved
        await pool.query(`
            UPDATE exchange_sync_conflicts SET
                resolved = true,
                resolved_at = CURRENT_TIMESTAMP,
                resolution_strategy = $1,
                resolved_by = $2
            WHERE id = $3
        `, [resolution_strategy, req.user.id, id]);

        // TODO: Apply the resolution strategy to the actual event

        logger.info('Conflict resolved', {
            userId: req.user.id,
            conflictId: id,
            strategy: resolution_strategy
        });

        res.json({
            success: true,
            message: 'Conflict resolved'
        });
    } catch (error) {
        logger.error('Failed to resolve conflict', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;
