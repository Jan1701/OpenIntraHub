/**
 * Social API
 * Reactions, Activity Feed, Notifications, Mentions
 * Author: Jan Günther <jg@linxpress.de>
 */

const express = require('express');
const router = express.Router();
const socialService = require('./socialService');
const { authenticateToken } = require('./middleware');
const i18n = require('./i18n');

// ==============================================
// POST REACTIONS
// ==============================================

/**
 * POST /api/posts/:id/react
 * Add or update reaction to post
 */
router.post('/posts/:id/react', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { reaction_type } = req.body;

        if (!reaction_type) {
            return res.status(400).json({
                success: false,
                message: 'reaction_type is required'
            });
        }

        const reaction = await socialService.addPostReaction(
            parseInt(id),
            req.user.id,
            reaction_type
        );

        res.json({
            success: true,
            data: reaction
        });
    } catch (error) {
        console.error('Error adding post reaction:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Error adding reaction'
        });
    }
});

/**
 * DELETE /api/posts/:id/react
 * Remove reaction from post
 */
router.delete('/posts/:id/react', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        await socialService.removePostReaction(parseInt(id), req.user.id);

        res.json({
            success: true,
            message: 'Reaction removed'
        });
    } catch (error) {
        console.error('Error removing post reaction:', error);
        res.status(500).json({
            success: false,
            message: 'Error removing reaction'
        });
    }
});

/**
 * GET /api/posts/:id/reactions
 * Get reactions for post
 */
router.get('/posts/:id/reactions', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { summary } = req.query;

        if (summary === 'true') {
            const reactionSummary = await socialService.getPostReactionSummary(parseInt(id));
            res.json({
                success: true,
                data: reactionSummary
            });
        } else {
            const reactions = await socialService.getPostReactions(parseInt(id));
            res.json({
                success: true,
                data: reactions
            });
        }
    } catch (error) {
        console.error('Error getting post reactions:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting reactions'
        });
    }
});

/**
 * GET /api/posts/:id/reactions/me
 * Get current user's reaction to post
 */
router.get('/posts/:id/reactions/me', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const reaction = await socialService.getUserPostReaction(
            parseInt(id),
            req.user.id
        );

        res.json({
            success: true,
            data: reaction
        });
    } catch (error) {
        console.error('Error getting user post reaction:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting reaction'
        });
    }
});

// ==============================================
// COMMENT REACTIONS
// ==============================================

/**
 * POST /api/comments/:id/react
 * Add or update reaction to comment
 */
router.post('/comments/:id/react', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { reaction_type } = req.body;

        if (!reaction_type) {
            return res.status(400).json({
                success: false,
                message: 'reaction_type is required'
            });
        }

        const reaction = await socialService.addCommentReaction(
            parseInt(id),
            req.user.id,
            reaction_type
        );

        res.json({
            success: true,
            data: reaction
        });
    } catch (error) {
        console.error('Error adding comment reaction:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Error adding reaction'
        });
    }
});

/**
 * DELETE /api/comments/:id/react
 * Remove reaction from comment
 */
router.delete('/comments/:id/react', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        await socialService.removeCommentReaction(parseInt(id), req.user.id);

        res.json({
            success: true,
            message: 'Reaction removed'
        });
    } catch (error) {
        console.error('Error removing comment reaction:', error);
        res.status(500).json({
            success: false,
            message: 'Error removing reaction'
        });
    }
});

// ==============================================
// POST SHARES
// ==============================================

/**
 * POST /api/posts/:id/share
 * Share a post
 */
router.post('/posts/:id/share', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { share_comment } = req.body;

        const share = await socialService.sharePost(
            parseInt(id),
            req.user.id,
            share_comment
        );

        res.status(201).json({
            success: true,
            data: share,
            message: 'Post shared successfully'
        });
    } catch (error) {
        console.error('Error sharing post:', error);
        res.status(500).json({
            success: false,
            message: 'Error sharing post'
        });
    }
});

/**
 * GET /api/posts/:id/shares
 * Get shares for post
 */
router.get('/posts/:id/shares', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const shares = await socialService.getPostShares(parseInt(id));

        res.json({
            success: true,
            data: shares
        });
    } catch (error) {
        console.error('Error getting post shares:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting shares'
        });
    }
});

// ==============================================
// ACTIVITY FEED
// ==============================================

/**
 * GET /api/feed
 * Get activity feed
 */
router.get('/feed', authenticateToken, async (req, res) => {
    try {
        const {
            limit = 20,
            offset = 0,
            activity_types,
            space_id
        } = req.query;

        const filters = {
            limit: parseInt(limit),
            offset: parseInt(offset),
            activity_types: activity_types ? activity_types.split(',') : undefined,
            space_id: space_id ? parseInt(space_id) : undefined
        };

        const activities = await socialService.getActivityFeed(
            req.user.id,
            filters
        );

        res.json({
            success: true,
            data: activities,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                count: activities.length
            }
        });
    } catch (error) {
        console.error('Error getting activity feed:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting activity feed'
        });
    }
});

// ==============================================
// NOTIFICATIONS
// ==============================================

/**
 * GET /api/notifications
 * Get notifications for current user
 */
router.get('/notifications', authenticateToken, async (req, res) => {
    try {
        const {
            unread_only = 'false',
            limit = 20,
            offset = 0
        } = req.query;

        const filters = {
            unread_only: unread_only === 'true',
            limit: parseInt(limit),
            offset: parseInt(offset)
        };

        const notifications = await socialService.getUserNotifications(
            req.user.id,
            filters
        );

        res.json({
            success: true,
            data: notifications,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                count: notifications.length
            }
        });
    } catch (error) {
        console.error('Error getting notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting notifications'
        });
    }
});

/**
 * GET /api/notifications/unread-count
 * Get unread notification count
 */
router.get('/notifications/unread-count', authenticateToken, async (req, res) => {
    try {
        const count = await socialService.getUnreadNotificationCount(req.user.id);

        res.json({
            success: true,
            data: { count }
        });
    } catch (error) {
        console.error('Error getting unread count:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting unread count'
        });
    }
});

/**
 * PUT /api/notifications/:id/read
 * Mark notification as read
 */
router.put('/notifications/:id/read', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        await socialService.markNotificationRead(parseInt(id), req.user.id);

        res.json({
            success: true,
            message: 'Notification marked as read'
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({
            success: false,
            message: 'Error marking notification as read'
        });
    }
});

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
router.put('/notifications/read-all', authenticateToken, async (req, res) => {
    try {
        await socialService.markAllNotificationsRead(req.user.id);

        res.json({
            success: true,
            message: 'All notifications marked as read'
        });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({
            success: false,
            message: 'Error marking all notifications as read'
        });
    }
});

// ==============================================
// MENTIONS
// ==============================================

/**
 * POST /api/mentions/parse
 * Parse mentions from text
 */
router.post('/mentions/parse', authenticateToken, async (req, res) => {
    try {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({
                success: false,
                message: 'text is required'
            });
        }

        const mentions = await socialService.parseMentions(text);

        res.json({
            success: true,
            data: mentions
        });
    } catch (error) {
        console.error('Error parsing mentions:', error);
        res.status(500).json({
            success: false,
            message: 'Error parsing mentions'
        });
    }
});

// ==============================================
// STATISTICS
// ==============================================

/**
 * GET /api/users/:id/social-stats
 * Get social stats for user
 */
router.get('/users/:id/social-stats', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const stats = await socialService.getUserSocialStats(parseInt(id));

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error getting user social stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting social stats'
        });
    }
});

/**
 * GET /api/social/reaction-types
 * Get available reaction types
 */
router.get('/social/reaction-types', authenticateToken, async (req, res) => {
    res.json({
        success: true,
        data: socialService.REACTION_TYPES
    });
});

module.exports = router;
