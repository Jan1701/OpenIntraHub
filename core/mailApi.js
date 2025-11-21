// =====================================================
// Mail API - REST Endpoints for Mail Operations
// =====================================================

const express = require('express');
const router = express.Router();
const mailService = require('./mailService');
const { authenticateToken } = require('./auth');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('MailAPI');

/**
 * GET /api/mail/folders
 * Get mail folders for current user
 */
router.get('/folders', authenticateToken, async (req, res) => {
    try {
        const folders = await mailService.getFolders(req.user.id);

        res.json({
            success: true,
            data: folders
        });
    } catch (error) {
        logger.error('GET /folders failed', { error: error.message, userId: req.user.id });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/mail/folders/sync
 * Sync folders from Exchange
 */
router.post('/folders/sync', authenticateToken, async (req, res) => {
    try {
        const result = await mailService.syncFolders(req.user.id);

        res.json({
            success: true,
            message: `${result.synced} folders synced`,
            data: result
        });
    } catch (error) {
        logger.error('POST /folders/sync failed', { error: error.message, userId: req.user.id });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/mail/messages
 * Get mail messages with filters
 */
router.get('/messages', authenticateToken, async (req, res) => {
    try {
        const options = {
            folderId: req.query.folder_id ? parseInt(req.query.folder_id) : null,
            limit: parseInt(req.query.limit) || 50,
            offset: parseInt(req.query.offset) || 0,
            unreadOnly: req.query.unread === 'true',
            search: req.query.search || null
        };

        const messages = await mailService.getMessages(req.user.id, options);

        res.json({
            success: true,
            data: messages,
            pagination: {
                limit: options.limit,
                offset: options.offset,
                count: messages.length
            }
        });
    } catch (error) {
        logger.error('GET /messages failed', { error: error.message, userId: req.user.id });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/mail/messages/:id
 * Get single message with full details
 */
router.get('/messages/:id', authenticateToken, async (req, res) => {
    try {
        const messageId = parseInt(req.params.id);
        const message = await mailService.getMessage(req.user.id, messageId);

        res.json({
            success: true,
            data: message
        });
    } catch (error) {
        logger.error('GET /messages/:id failed', { error: error.message, userId: req.user.id });
        res.status(error.message === 'Message not found' ? 404 : 500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/mail/messages/sync
 * Sync messages from Exchange
 */
router.post('/messages/sync', authenticateToken, async (req, res) => {
    try {
        const { folder_id, limit } = req.body;

        const result = await mailService.syncMessages(
            req.user.id,
            folder_id || null,
            limit || 50
        );

        res.json({
            success: true,
            message: `${result.synced} messages synced`,
            data: result
        });
    } catch (error) {
        logger.error('POST /messages/sync failed', { error: error.message, userId: req.user.id });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/mail/send
 * Send a new email
 */
router.post('/send', authenticateToken, async (req, res) => {
    try {
        const { to, cc, subject, body, isHtml, importance } = req.body;

        // Validation
        if (!to || to.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'At least one recipient is required'
            });
        }

        if (!subject) {
            return res.status(400).json({
                success: false,
                error: 'Subject is required'
            });
        }

        const result = await mailService.sendMail(req.user.id, {
            to,
            cc: cc || [],
            subject,
            body,
            isHtml: isHtml || false,
            importance: importance || 'Normal'
        });

        res.json({
            success: true,
            message: 'Email sent successfully'
        });
    } catch (error) {
        logger.error('POST /send failed', { error: error.message, userId: req.user.id });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * PUT /api/mail/messages/:id/read
 * Mark message as read/unread
 */
router.put('/messages/:id/read', authenticateToken, async (req, res) => {
    try {
        const messageId = parseInt(req.params.id);
        const { is_read } = req.body;

        await mailService.markAsRead(req.user.id, messageId, is_read !== false);

        res.json({
            success: true,
            message: 'Message updated'
        });
    } catch (error) {
        logger.error('PUT /messages/:id/read failed', { error: error.message, userId: req.user.id });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/mail/messages/:id
 * Delete a message
 */
router.delete('/messages/:id', authenticateToken, async (req, res) => {
    try {
        const messageId = parseInt(req.params.id);

        await mailService.deleteMessage(req.user.id, messageId);

        res.json({
            success: true,
            message: 'Message deleted'
        });
    } catch (error) {
        logger.error('DELETE /messages/:id failed', { error: error.message, userId: req.user.id });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/mail/unread-count
 * Get total unread message count
 */
router.get('/unread-count', authenticateToken, async (req, res) => {
    try {
        const messages = await mailService.getMessages(req.user.id, { unreadOnly: true, limit: 1000 });

        res.json({
            success: true,
            count: messages.length
        });
    } catch (error) {
        logger.error('GET /unread-count failed', { error: error.message, userId: req.user.id });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
