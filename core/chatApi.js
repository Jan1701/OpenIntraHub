/**
 * Chat API
 * REST API + Socket.io für Real-time Chat
 * Author: Jan Günther <jg@linxpress.de>
 */

const express = require('express');
const router = express.Router();
const chatService = require('./chatService');
const { authenticateToken, requirePermission } = require('./middleware');
const i18n = require('./i18n');

// ==============================================
// REST API ENDPOINTS
// ==============================================

/**
 * GET /api/chat/conversations
 * Get user's conversations
 */
router.get('/chat/conversations', authenticateToken, requirePermission('chat.view'), async (req, res) => {
    try {
        const { type, limit = 50, offset = 0 } = req.query;

        const conversations = await chatService.getUserConversations(req.user.id, {
            type,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            data: conversations,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                count: conversations.length
            }
        });
    } catch (error) {
        console.error('Error getting conversations:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting conversations'
        });
    }
});

/**
 * GET /api/chat/conversations/:id
 * Get conversation details
 */
router.get('/chat/conversations/:id', authenticateToken, requirePermission('chat.view'), async (req, res) => {
    try {
        const { id } = req.params;

        const conversation = await chatService.getConversationById(
            parseInt(id),
            req.user.id
        );

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversation not found'
            });
        }

        res.json({
            success: true,
            data: conversation
        });
    } catch (error) {
        console.error('Error getting conversation:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting conversation'
        });
    }
});

/**
 * POST /api/chat/conversations/direct
 * Get or create direct conversation
 */
router.post('/chat/conversations/direct', authenticateToken, requirePermission('chat.send'), async (req, res) => {
    try {
        const { user_id } = req.body;

        if (!user_id) {
            return res.status(400).json({
                success: false,
                message: 'user_id is required'
            });
        }

        const conversationId = await chatService.getOrCreateDirectConversation(
            req.user.id,
            parseInt(user_id)
        );

        const conversation = await chatService.getConversationById(
            conversationId,
            req.user.id
        );

        res.json({
            success: true,
            data: conversation
        });
    } catch (error) {
        console.error('Error getting/creating direct conversation:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting/creating conversation'
        });
    }
});

/**
 * POST /api/chat/conversations/group
 * Create group conversation
 */
router.post('/chat/conversations/group', authenticateToken, requirePermission('chat.create_group'), async (req, res) => {
    try {
        const { name, description, member_ids } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'name is required'
            });
        }

        const conversation = await chatService.createGroupConversation(req.user.id, {
            name,
            description,
            member_ids
        });

        res.status(201).json({
            success: true,
            data: conversation,
            message: 'Group conversation created'
        });
    } catch (error) {
        console.error('Error creating group conversation:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating group conversation'
        });
    }
});

/**
 * PUT /api/chat/conversations/:id
 * Update conversation
 */
router.put('/chat/conversations/:id', authenticateToken, requirePermission('chat.create_group'), async (req, res) => {
    try {
        const { id } = req.params;

        const conversation = await chatService.updateConversation(
            parseInt(id),
            req.body,
            req.user.id
        );

        res.json({
            success: true,
            data: conversation,
            message: 'Conversation updated'
        });
    } catch (error) {
        console.error('Error updating conversation:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Error updating conversation'
        });
    }
});

/**
 * GET /api/chat/conversations/:id/participants
 * Get conversation participants
 */
router.get('/chat/conversations/:id/participants', authenticateToken, requirePermission('chat.view'), async (req, res) => {
    try {
        const { id } = req.params;

        const participants = await chatService.getConversationParticipants(parseInt(id));

        res.json({
            success: true,
            data: participants
        });
    } catch (error) {
        console.error('Error getting participants:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting participants'
        });
    }
});

/**
 * POST /api/chat/conversations/:id/participants
 * Add participant to conversation
 */
router.post('/chat/conversations/:id/participants', authenticateToken, requirePermission('chat.create_group'), async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id } = req.body;

        if (!user_id) {
            return res.status(400).json({
                success: false,
                message: 'user_id is required'
            });
        }

        const participant = await chatService.addParticipant(
            parseInt(id),
            parseInt(user_id),
            req.user.id
        );

        res.status(201).json({
            success: true,
            data: participant,
            message: 'Participant added'
        });
    } catch (error) {
        console.error('Error adding participant:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding participant'
        });
    }
});

/**
 * DELETE /api/chat/conversations/:id/participants/:userId
 * Remove participant from conversation
 */
router.delete('/chat/conversations/:id/participants/:userId', authenticateToken, requirePermission('chat.create_group'), async (req, res) => {
    try {
        const { id, userId } = req.params;

        await chatService.removeParticipant(parseInt(id), parseInt(userId));

        res.json({
            success: true,
            message: 'Participant removed'
        });
    } catch (error) {
        console.error('Error removing participant:', error);
        res.status(500).json({
            success: false,
            message: 'Error removing participant'
        });
    }
});

/**
 * GET /api/chat/conversations/:id/messages
 * Get messages for conversation
 */
router.get('/chat/conversations/:id/messages', authenticateToken, requirePermission('chat.view'), async (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 50, offset = 0, before_message_id, after_message_id } = req.query;

        const messages = await chatService.getConversationMessages(
            parseInt(id),
            req.user.id,
            {
                limit: parseInt(limit),
                offset: parseInt(offset),
                before_message_id: before_message_id ? parseInt(before_message_id) : undefined,
                after_message_id: after_message_id ? parseInt(after_message_id) : undefined
            }
        );

        res.json({
            success: true,
            data: messages,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                count: messages.length
            }
        });
    } catch (error) {
        console.error('Error getting messages:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting messages'
        });
    }
});

/**
 * POST /api/chat/conversations/:id/messages
 * Send message (REST fallback - prefer Socket.io)
 */
router.post('/chat/conversations/:id/messages', authenticateToken, requirePermission('chat.send'), async (req, res) => {
    try {
        const { id } = req.params;
        const { message_text, message_type, attachments, reply_to_message_id } = req.body;

        if (!message_text && (!attachments || attachments.length === 0)) {
            return res.status(400).json({
                success: false,
                message: 'message_text or attachments required'
            });
        }

        const message = await chatService.sendMessage(
            parseInt(id),
            req.user.id,
            {
                message_text,
                message_type,
                attachments,
                reply_to_message_id
            }
        );

        res.status(201).json({
            success: true,
            data: message,
            message: 'Message sent'
        });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending message'
        });
    }
});

/**
 * PUT /api/chat/messages/:id
 * Edit message
 */
router.put('/chat/messages/:id', authenticateToken, requirePermission('chat.send'), async (req, res) => {
    try {
        const { id } = req.params;
        const { message_text } = req.body;

        if (!message_text) {
            return res.status(400).json({
                success: false,
                message: 'message_text is required'
            });
        }

        const message = await chatService.editMessage(
            parseInt(id),
            req.user.id,
            message_text
        );

        res.json({
            success: true,
            data: message,
            message: 'Message updated'
        });
    } catch (error) {
        console.error('Error editing message:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Error editing message'
        });
    }
});

/**
 * DELETE /api/chat/messages/:id
 * Delete message
 */
router.delete('/chat/messages/:id', authenticateToken, requirePermission('chat.delete_own_messages'), async (req, res) => {
    try {
        const { id } = req.params;

        const hasAdminPermission = req.user.permissions?.includes('chat.delete_any_messages');

        const message = await chatService.deleteMessage(
            parseInt(id),
            req.user.id,
            hasAdminPermission
        );

        res.json({
            success: true,
            data: message,
            message: 'Message deleted'
        });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Error deleting message'
        });
    }
});

/**
 * POST /api/chat/messages/:id/react
 * Add reaction to message
 */
router.post('/chat/messages/:id/react', authenticateToken, requirePermission('chat.send'), async (req, res) => {
    try {
        const { id } = req.params;
        const { reaction_type } = req.body;

        if (!reaction_type) {
            return res.status(400).json({
                success: false,
                message: 'reaction_type is required'
            });
        }

        const reaction = await chatService.addMessageReaction(
            parseInt(id),
            req.user.id,
            reaction_type
        );

        res.json({
            success: true,
            data: reaction
        });
    } catch (error) {
        console.error('Error adding message reaction:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding reaction'
        });
    }
});

/**
 * DELETE /api/chat/messages/:id/react
 * Remove reaction from message
 */
router.delete('/chat/messages/:id/react', authenticateToken, requirePermission('chat.send'), async (req, res) => {
    try {
        const { id } = req.params;

        await chatService.removeMessageReaction(parseInt(id), req.user.id);

        res.json({
            success: true,
            message: 'Reaction removed'
        });
    } catch (error) {
        console.error('Error removing message reaction:', error);
        res.status(500).json({
            success: false,
            message: 'Error removing reaction'
        });
    }
});

/**
 * POST /api/chat/conversations/:id/read
 * Mark conversation as read
 */
router.post('/chat/conversations/:id/read', authenticateToken, requirePermission('chat.view'), async (req, res) => {
    try {
        const { id } = req.params;
        const { last_read_message_id } = req.body;

        if (!last_read_message_id) {
            return res.status(400).json({
                success: false,
                message: 'last_read_message_id is required'
            });
        }

        await chatService.markConversationRead(
            parseInt(id),
            req.user.id,
            parseInt(last_read_message_id)
        );

        res.json({
            success: true,
            message: 'Conversation marked as read'
        });
    } catch (error) {
        console.error('Error marking conversation as read:', error);
        res.status(500).json({
            success: false,
            message: 'Error marking conversation as read'
        });
    }
});

/**
 * GET /api/chat/search
 * Search messages
 */
router.get('/chat/search', authenticateToken, requirePermission('chat.view'), async (req, res) => {
    try {
        const { q, conversation_id, limit = 20, offset = 0 } = req.query;

        if (!q) {
            return res.status(400).json({
                success: false,
                message: 'q (search query) is required'
            });
        }

        const messages = await chatService.searchMessages(req.user.id, q, {
            conversation_id: conversation_id ? parseInt(conversation_id) : undefined,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            data: messages,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                count: messages.length
            }
        });
    } catch (error) {
        console.error('Error searching messages:', error);
        res.status(500).json({
            success: false,
            message: 'Error searching messages'
        });
    }
});

// ==============================================
// SOCKET.IO SETUP (exported function)
// ==============================================

/**
 * Setup Socket.io for real-time chat
 * This function should be called from app.js after creating HTTP server
 */
function setupSocketIO(io, authenticateSocketToken) {
    // Socket.io Namespace für Chat
    const chatNamespace = io.of('/chat');

    chatNamespace.use(async (socket, next) => {
        try {
            // Authenticate socket connection
            const user = await authenticateSocketToken(socket);
            socket.user = user;
            next();
        } catch (error) {
            next(new Error('Authentication error'));
        }
    });

    chatNamespace.on('connection', async (socket) => {
        const userId = socket.user.id;
        console.log(`[Chat] User ${userId} connected (Socket: ${socket.id})`);

        // Update online status
        await chatService.updateOnlineStatus(userId, true, socket.id);

        // Join user to their personal room (for direct notifications)
        socket.join(`user:${userId}`);

        // Get user's conversations and join rooms
        const conversations = await chatService.getUserConversations(userId);
        conversations.forEach(conv => {
            socket.join(`conversation:${conv.id}`);
        });

        // Broadcast online status to relevant users
        chatNamespace.emit('user:online', { user_id: userId });

        // ========================================
        // EVENT HANDLERS
        // ========================================

        /**
         * Send message
         */
        socket.on('message:send', async (data) => {
            try {
                const { conversation_id, message_text, message_type, attachments, reply_to_message_id } = data;

                const message = await chatService.sendMessage(
                    conversation_id,
                    userId,
                    { message_text, message_type, attachments, reply_to_message_id }
                );

                // Broadcast to conversation
                chatNamespace.to(`conversation:${conversation_id}`).emit('message:new', {
                    conversation_id,
                    message: {
                        ...message,
                        sender_name: socket.user.name,
                        sender_avatar: socket.user.avatar_url
                    }
                });

                // Acknowledge to sender
                socket.emit('message:sent', { message });

            } catch (error) {
                console.error('Error sending message:', error);
                socket.emit('message:error', { error: error.message });
            }
        });

        /**
         * Edit message
         */
        socket.on('message:edit', async (data) => {
            try {
                const { message_id, message_text } = data;

                const message = await chatService.editMessage(message_id, userId, message_text);

                // Get conversation_id
                const originalMessage = await chatService.database.query(
                    'SELECT conversation_id FROM chat_messages WHERE id = $1',
                    [message_id]
                );
                const conversationId = originalMessage.rows[0].conversation_id;

                // Broadcast edit to conversation
                chatNamespace.to(`conversation:${conversationId}`).emit('message:edited', {
                    conversation_id: conversationId,
                    message
                });

            } catch (error) {
                console.error('Error editing message:', error);
                socket.emit('message:error', { error: error.message });
            }
        });

        /**
         * Delete message
         */
        socket.on('message:delete', async (data) => {
            try {
                const { message_id } = data;

                const hasAdminPermission = socket.user.permissions?.includes('chat.delete_any_messages');
                const message = await chatService.deleteMessage(message_id, userId, hasAdminPermission);

                // Get conversation_id
                const conversationId = message.conversation_id;

                // Broadcast delete to conversation
                chatNamespace.to(`conversation:${conversationId}`).emit('message:deleted', {
                    conversation_id: conversationId,
                    message_id
                });

            } catch (error) {
                console.error('Error deleting message:', error);
                socket.emit('message:error', { error: error.message });
            }
        });

        /**
         * React to message
         */
        socket.on('message:react', async (data) => {
            try {
                const { message_id, reaction_type } = data;

                const reaction = await chatService.addMessageReaction(message_id, userId, reaction_type);

                // Get conversation_id
                const messageData = await chatService.database.query(
                    'SELECT conversation_id FROM chat_messages WHERE id = $1',
                    [message_id]
                );
                const conversationId = messageData.rows[0].conversation_id;

                // Broadcast reaction to conversation
                chatNamespace.to(`conversation:${conversationId}`).emit('message:reaction:added', {
                    conversation_id: conversationId,
                    message_id,
                    reaction: {
                        ...reaction,
                        user_name: socket.user.name
                    }
                });

            } catch (error) {
                console.error('Error adding reaction:', error);
                socket.emit('message:error', { error: error.message });
            }
        });

        /**
         * Typing indicator
         */
        socket.on('typing:start', async (data) => {
            const { conversation_id } = data;

            // Broadcast to others in conversation (not sender)
            socket.to(`conversation:${conversation_id}`).emit('typing:user', {
                conversation_id,
                user_id: userId,
                user_name: socket.user.name,
                is_typing: true
            });
        });

        socket.on('typing:stop', async (data) => {
            const { conversation_id } = data;

            socket.to(`conversation:${conversation_id}`).emit('typing:user', {
                conversation_id,
                user_id: userId,
                user_name: socket.user.name,
                is_typing: false
            });
        });

        /**
         * Mark as read
         */
        socket.on('conversation:read', async (data) => {
            try {
                const { conversation_id, last_read_message_id } = data;

                await chatService.markConversationRead(conversation_id, userId, last_read_message_id);

                // Broadcast read receipt to conversation
                socket.to(`conversation:${conversation_id}`).emit('conversation:read', {
                    conversation_id,
                    user_id: userId,
                    last_read_message_id
                });

            } catch (error) {
                console.error('Error marking as read:', error);
            }
        });

        /**
         * Join conversation (when opening a new chat)
         */
        socket.on('conversation:join', async (data) => {
            const { conversation_id } = data;
            socket.join(`conversation:${conversation_id}`);

            console.log(`[Chat] User ${userId} joined conversation ${conversation_id}`);
        });

        /**
         * Leave conversation
         */
        socket.on('conversation:leave', async (data) => {
            const { conversation_id } = data;
            socket.leave(`conversation:${conversation_id}`);

            console.log(`[Chat] User ${userId} left conversation ${conversation_id}`);
        });

        /**
         * Disconnect
         */
        socket.on('disconnect', async () => {
            console.log(`[Chat] User ${userId} disconnected (Socket: ${socket.id})`);

            // Update online status
            await chatService.updateOnlineStatus(userId, false, null);

            // Broadcast offline status
            chatNamespace.emit('user:offline', {
                user_id: userId,
                last_seen_at: new Date()
            });
        });
    });

    console.log('[Chat] Socket.io namespace /chat initialized');

    return chatNamespace;
}

module.exports = router;
module.exports.setupSocketIO = setupSocketIO;
