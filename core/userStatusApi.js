// =====================================================
// User Status API - Global Presence Management
// =====================================================

const express = require('express');
const router = express.Router();
const userStatusService = require('./userStatusService');
const { authenticateToken } = require('./auth');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('UserStatusAPI');

/**
 * GET /api/status/me
 * Get current user's status
 */
router.get('/status/me', authenticateToken, async (req, res) => {
    try {
        const status = await userStatusService.getUserStatus(req.user.id);

        res.json({
            success: true,
            status
        });
    } catch (error) {
        logger.error('Failed to get user status', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * PUT /api/status/me
 * Update current user's status
 */
router.put('/status/me', authenticateToken, async (req, res) => {
    try {
        const { status, status_message } = req.body;

        const validStatuses = ['available', 'away', 'busy', 'dnd', 'offline'];

        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            });
        }

        const updatedStatus = await userStatusService.updateUserStatus(req.user.id, {
            status,
            status_message
        });

        logger.info('User status updated', {
            userId: req.user.id,
            status
        });

        res.json({
            success: true,
            status: updatedStatus
        });
    } catch (error) {
        logger.error('Failed to update user status', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * POST /api/status/me/oof
 * Set Out of Office
 */
router.post('/status/me/oof', authenticateToken, async (req, res) => {
    try {
        const {
            enabled,
            startTime,
            endTime,
            internalMessage,
            externalMessage
        } = req.body;

        if (typeof enabled !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'enabled field must be a boolean'
            });
        }

        if (enabled && (!internalMessage && !externalMessage)) {
            return res.status(400).json({
                success: false,
                message: 'At least one message (internal or external) is required when enabling OOF'
            });
        }

        const status = await userStatusService.setOutOfOffice(req.user.id, {
            enabled,
            startTime,
            endTime,
            internalMessage,
            externalMessage
        });

        logger.info('Out of Office set', {
            userId: req.user.id,
            enabled
        });

        res.json({
            success: true,
            message: enabled ? 'Out of Office enabled' : 'Out of Office disabled',
            status
        });
    } catch (error) {
        logger.error('Failed to set Out of Office', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * GET /api/status/:userId
 * Get specific user's status (public)
 */
router.get('/status/:userId', authenticateToken, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);

        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID'
            });
        }

        const status = await userStatusService.getUserStatus(userId);

        // Don't expose sensitive OOF messages to other users
        const publicStatus = {
            user_id: status.user_id,
            username: status.username,
            name: status.name,
            status: status.status,
            status_message: status.status_message,
            oof_enabled: status.oof_enabled,
            oof_start_time: status.oof_start_time,
            oof_end_time: status.oof_end_time,
            last_active_at: status.last_active_at
        };

        res.json({
            success: true,
            status: publicStatus
        });
    } catch (error) {
        logger.error('Failed to get user status', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * POST /api/status/bulk
 * Get multiple users' statuses
 */
router.post('/status/bulk', authenticateToken, async (req, res) => {
    try {
        const { userIds } = req.body;

        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'userIds must be a non-empty array'
            });
        }

        if (userIds.length > 100) {
            return res.status(400).json({
                success: false,
                message: 'Cannot request more than 100 users at once'
            });
        }

        const statuses = await userStatusService.getMultipleUserStatuses(userIds);

        res.json({
            success: true,
            statuses
        });
    } catch (error) {
        logger.error('Failed to get bulk user statuses', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * GET /api/status/online
 * Get all currently online users
 */
router.get('/status/online', authenticateToken, async (req, res) => {
    try {
        const onlineUsers = await userStatusService.getOnlineUsers();

        res.json({
            success: true,
            count: onlineUsers.length,
            users: onlineUsers
        });
    } catch (error) {
        logger.error('Failed to get online users', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * GET /api/status/statistics
 * Get status statistics (admin only)
 */
router.get('/status/statistics', authenticateToken, async (req, res) => {
    try {
        // Only allow admins
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }

        const timeframe = req.query.timeframe || '24 hours';
        const stats = await userStatusService.getStatusStatistics(timeframe);

        res.json({
            success: true,
            timeframe,
            statistics: stats
        });
    } catch (error) {
        logger.error('Failed to get status statistics', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * POST /api/status/heartbeat
 * Update last active timestamp (called periodically by frontend)
 */
router.post('/status/heartbeat', authenticateToken, async (req, res) => {
    try {
        await userStatusService.updateLastActive(req.user.id);

        res.json({
            success: true
        });
    } catch (error) {
        // Don't log errors for heartbeat, it's not critical
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;
