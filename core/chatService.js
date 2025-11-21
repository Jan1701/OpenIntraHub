/**
 * Chat Service
 * Real-time Messaging Business Logic
 * Author: Jan Günther <jg@linxpress.de>
 */

const database = require('./database');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('ChatService');

// ==============================================
// CONVERSATIONS
// ==============================================

/**
 * Get or create direct conversation between two users
 */
async function getOrCreateDirectConversation(user1Id, user2Id) {
    try {
        const result = await database.query(
            'SELECT get_or_create_direct_conversation($1, $2) as conversation_id',
            [user1Id, user2Id]
        );

        return result.rows[0].conversation_id;
    } catch (error) {
        logger.error('Error getting/creating direct conversation', {
            user1Id,
            user2Id,
            error: error.message
        });
        throw error;
    }
}

/**
 * Create group conversation
 */
async function createGroupConversation(creatorId, groupData) {
    const { name, description, member_ids = [] } = groupData;

    try {
        // Create conversation
        const convResult = await database.query(
            `INSERT INTO chat_conversations (type, name, description, created_by)
             VALUES ('group', $1, $2, $3)
             RETURNING *`,
            [name, description, creatorId]
        );

        const conversation = convResult.rows[0];

        // Add creator as admin
        await database.query(
            `INSERT INTO chat_participants (conversation_id, user_id, role)
             VALUES ($1, $2, 'admin')`,
            [conversation.id, creatorId]
        );

        // Add other members
        if (member_ids.length > 0) {
            const uniqueMemberIds = [...new Set(member_ids)].filter(id => id !== creatorId);

            for (const memberId of uniqueMemberIds) {
                await database.query(
                    `INSERT INTO chat_participants (conversation_id, user_id)
                     VALUES ($1, $2)`,
                    [conversation.id, memberId]
                );
            }
        }

        logger.info('Group conversation created', {
            conversationId: conversation.id,
            creatorId,
            memberCount: member_ids.length + 1
        });

        return conversation;
    } catch (error) {
        logger.error('Error creating group conversation', { creatorId, error: error.message });
        throw error;
    }
}

/**
 * Get conversation by ID
 */
async function getConversationById(conversationId, userId) {
    try {
        const result = await database.query(
            `SELECT c.*,
                    -- Participant count
                    (SELECT COUNT(*) FROM chat_participants cp
                     WHERE cp.conversation_id = c.id AND cp.is_active = true) as participant_count,

                    -- Last message
                    (SELECT row_to_json(msg)
                     FROM (
                         SELECT cm.id, cm.message_text, cm.message_type, cm.created_at,
                                u.name as sender_name, u.avatar_url as sender_avatar
                         FROM chat_messages cm
                         LEFT JOIN users u ON u.id = cm.user_id
                         WHERE cm.conversation_id = c.id
                           AND cm.is_deleted = false
                         ORDER BY cm.created_at DESC
                         LIMIT 1
                     ) msg) as last_message,

                    -- My participant record
                    (SELECT row_to_json(part)
                     FROM (
                         SELECT cp.role, cp.last_read_message_id, cp.last_read_at,
                                cp.muted_until, cp.notifications_enabled
                         FROM chat_participants cp
                         WHERE cp.conversation_id = c.id AND cp.user_id = $2
                     ) part) as my_participation,

                    -- Unread count for me
                    (SELECT COUNT(*)
                     FROM chat_messages cm
                     LEFT JOIN chat_participants cp ON cp.conversation_id = cm.conversation_id AND cp.user_id = $2
                     WHERE cm.conversation_id = c.id
                       AND cm.is_deleted = false
                       AND (cp.last_read_message_id IS NULL OR cm.id > cp.last_read_message_id)
                       AND cm.user_id != $2
                    ) as unread_count

             FROM chat_conversations c
             WHERE c.id = $1
               AND c.is_active = true
               AND EXISTS (
                   SELECT 1 FROM chat_participants cp
                   WHERE cp.conversation_id = c.id AND cp.user_id = $2 AND cp.is_active = true
               )`,
            [conversationId, userId]
        );

        return result.rows[0] || null;
    } catch (error) {
        logger.error('Error getting conversation', { conversationId, userId, error: error.message });
        throw error;
    }
}

/**
 * Get user's conversations
 */
async function getUserConversations(userId, filters = {}) {
    const { limit = 50, offset = 0, type } = filters;

    try {
        let query = `
            SELECT c.*,
                   -- Participant count
                   (SELECT COUNT(*) FROM chat_participants cp
                    WHERE cp.conversation_id = c.id AND cp.is_active = true) as participant_count,

                   -- Last message
                   (SELECT row_to_json(msg)
                    FROM (
                        SELECT cm.id, cm.message_text, cm.message_type, cm.created_at,
                               u.name as sender_name, u.avatar_url as sender_avatar
                        FROM chat_messages cm
                        LEFT JOIN users u ON u.id = cm.user_id
                        WHERE cm.conversation_id = c.id
                          AND cm.is_deleted = false
                        ORDER BY cm.created_at DESC
                        LIMIT 1
                    ) msg) as last_message,

                   -- My participation info
                   cp.role as my_role,
                   cp.last_read_message_id,
                   cp.last_read_at,
                   cp.muted_until,
                   cp.notifications_enabled,

                   -- Unread count
                   (SELECT COUNT(*)
                    FROM chat_messages cm2
                    WHERE cm2.conversation_id = c.id
                      AND cm2.is_deleted = false
                      AND (cp.last_read_message_id IS NULL OR cm2.id > cp.last_read_message_id)
                      AND cm2.user_id != $1
                   ) as unread_count,

                   -- Other participant (for direct chats)
                   CASE WHEN c.type = 'direct' THEN
                       (SELECT row_to_json(other_user)
                        FROM (
                            SELECT u.id, u.name, u.avatar_url, u.email
                            FROM chat_participants cp2
                            JOIN users u ON u.id = cp2.user_id
                            WHERE cp2.conversation_id = c.id
                              AND cp2.user_id != $1
                              AND cp2.is_active = true
                            LIMIT 1
                        ) other_user)
                   END as other_participant

            FROM chat_conversations c
            INNER JOIN chat_participants cp ON cp.conversation_id = c.id
            WHERE cp.user_id = $1
              AND cp.is_active = true
              AND c.is_active = true
        `;

        const params = [userId];
        let paramIndex = 2;

        if (type) {
            query += ` AND c.type = $${paramIndex++}`;
            params.push(type);
        }

        query += `
            ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `;

        params.push(limit, offset);

        const result = await database.query(query, params);

        return result.rows;
    } catch (error) {
        logger.error('Error getting user conversations', { userId, error: error.message });
        throw error;
    }
}

/**
 * Update conversation (group name, etc.)
 */
async function updateConversation(conversationId, updates, userId) {
    try {
        const allowedFields = ['name', 'description', 'avatar_url'];
        const fields = [];
        const values = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                fields.push(`${key} = $${paramIndex++}`);
                values.push(value);
            }
        }

        if (fields.length === 0) {
            throw new Error('No valid update fields provided');
        }

        values.push(conversationId);

        const query = `
            UPDATE chat_conversations
            SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $${paramIndex}
            RETURNING *
        `;

        const result = await database.query(query, values);

        return result.rows[0];
    } catch (error) {
        logger.error('Error updating conversation', { conversationId, error: error.message });
        throw error;
    }
}

// ==============================================
// PARTICIPANTS
// ==============================================

/**
 * Get conversation participants
 */
async function getConversationParticipants(conversationId) {
    try {
        const result = await database.query(
            `SELECT cp.*,
                    u.name as user_name,
                    u.email as user_email,
                    u.avatar_url,
                    uos.is_online,
                    uos.last_seen_at
             FROM chat_participants cp
             LEFT JOIN users u ON u.id = cp.user_id
             LEFT JOIN user_online_status uos ON uos.user_id = u.id
             WHERE cp.conversation_id = $1
               AND cp.is_active = true
             ORDER BY cp.role DESC, u.name ASC`,
            [conversationId]
        );

        return result.rows;
    } catch (error) {
        logger.error('Error getting conversation participants', {
            conversationId,
            error: error.message
        });
        throw error;
    }
}

/**
 * Add participant to conversation
 */
async function addParticipant(conversationId, userId, addedBy) {
    try {
        const result = await database.query(
            `INSERT INTO chat_participants (conversation_id, user_id)
             VALUES ($1, $2)
             ON CONFLICT (conversation_id, user_id)
             DO UPDATE SET is_active = true, joined_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [conversationId, userId]
        );

        logger.info('Participant added to conversation', { conversationId, userId, addedBy });

        return result.rows[0];
    } catch (error) {
        logger.error('Error adding participant', { conversationId, userId, error: error.message });
        throw error;
    }
}

/**
 * Remove participant from conversation
 */
async function removeParticipant(conversationId, userId) {
    try {
        await database.query(
            `UPDATE chat_participants
             SET is_active = false, left_at = CURRENT_TIMESTAMP
             WHERE conversation_id = $1 AND user_id = $2`,
            [conversationId, userId]
        );

        logger.info('Participant removed from conversation', { conversationId, userId });
    } catch (error) {
        logger.error('Error removing participant', { conversationId, userId, error: error.message });
        throw error;
    }
}

// ==============================================
// MESSAGES
// ==============================================

/**
 * Send message
 */
async function sendMessage(conversationId, userId, messageData) {
    const {
        message_text,
        message_type = 'text',
        attachments = [],
        reply_to_message_id
    } = messageData;

    try {
        const result = await database.query(
            `INSERT INTO chat_messages (
                conversation_id, user_id, message_type, message_text,
                attachments, reply_to_message_id
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *`,
            [
                conversationId,
                userId,
                message_type,
                message_text,
                JSON.stringify(attachments),
                reply_to_message_id
            ]
        );

        const message = result.rows[0];

        logger.debug('Message sent', {
            messageId: message.id,
            conversationId,
            userId
        });

        return message;
    } catch (error) {
        logger.error('Error sending message', { conversationId, userId, error: error.message });
        throw error;
    }
}

/**
 * Get messages for conversation
 */
async function getConversationMessages(conversationId, userId, filters = {}) {
    const { limit = 50, offset = 0, before_message_id, after_message_id } = filters;

    try {
        let query = `
            SELECT cm.*,
                   u.name as sender_name,
                   u.avatar_url as sender_avatar,

                   -- Reactions
                   (SELECT json_agg(json_build_object(
                       'id', cmr.id,
                       'reaction_type', cmr.reaction_type,
                       'user_id', cmr.user_id,
                       'user_name', ru.name
                   ))
                   FROM chat_message_reactions cmr
                   LEFT JOIN users ru ON ru.id = cmr.user_id
                   WHERE cmr.message_id = cm.id
                   ) as reactions,

                   -- Reply-to message (if any)
                   CASE WHEN cm.reply_to_message_id IS NOT NULL THEN
                       (SELECT json_build_object(
                           'id', rm.id,
                           'message_text', rm.message_text,
                           'sender_name', rmu.name
                       )
                       FROM chat_messages rm
                       LEFT JOIN users rmu ON rmu.id = rm.user_id
                       WHERE rm.id = cm.reply_to_message_id)
                   END as reply_to_message

            FROM chat_messages cm
            LEFT JOIN users u ON u.id = cm.user_id
            WHERE cm.conversation_id = $1
              AND cm.is_deleted = false
        `;

        const params = [conversationId];
        let paramIndex = 2;

        if (before_message_id) {
            query += ` AND cm.id < $${paramIndex++}`;
            params.push(before_message_id);
        }

        if (after_message_id) {
            query += ` AND cm.id > $${paramIndex++}`;
            params.push(after_message_id);
        }

        query += `
            ORDER BY cm.created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `;

        params.push(limit, offset);

        const result = await database.query(query, params);

        return result.rows.reverse(); // Return in chronological order
    } catch (error) {
        logger.error('Error getting conversation messages', {
            conversationId,
            error: error.message
        });
        throw error;
    }
}

/**
 * Edit message
 */
async function editMessage(messageId, userId, newText) {
    try {
        const result = await database.query(
            `UPDATE chat_messages
             SET message_text = $1, is_edited = true, edited_at = CURRENT_TIMESTAMP
             WHERE id = $2 AND user_id = $3 AND is_deleted = false
             RETURNING *`,
            [newText, messageId, userId]
        );

        if (result.rows.length === 0) {
            throw new Error('Message not found or cannot be edited');
        }

        logger.debug('Message edited', { messageId, userId });

        return result.rows[0];
    } catch (error) {
        logger.error('Error editing message', { messageId, userId, error: error.message });
        throw error;
    }
}

/**
 * Delete message
 */
async function deleteMessage(messageId, userId, isAdmin = false) {
    try {
        let query = `
            UPDATE chat_messages
            SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND is_deleted = false
        `;

        const params = [messageId];

        if (!isAdmin) {
            query += ` AND user_id = $2`;
            params.push(userId);
        }

        query += ` RETURNING *`;

        const result = await database.query(query, params);

        if (result.rows.length === 0) {
            throw new Error('Message not found or cannot be deleted');
        }

        logger.debug('Message deleted', { messageId, userId });

        return result.rows[0];
    } catch (error) {
        logger.error('Error deleting message', { messageId, userId, error: error.message });
        throw error;
    }
}

// ==============================================
// MESSAGE REACTIONS
// ==============================================

/**
 * Add reaction to message
 */
async function addMessageReaction(messageId, userId, reactionType) {
    try {
        const result = await database.query(
            `INSERT INTO chat_message_reactions (message_id, user_id, reaction_type)
             VALUES ($1, $2, $3)
             ON CONFLICT (message_id, user_id)
             DO UPDATE SET reaction_type = EXCLUDED.reaction_type, created_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [messageId, userId, reactionType]
        );

        return result.rows[0];
    } catch (error) {
        logger.error('Error adding message reaction', { messageId, userId, error: error.message });
        throw error;
    }
}

/**
 * Remove reaction from message
 */
async function removeMessageReaction(messageId, userId) {
    try {
        await database.query(
            'DELETE FROM chat_message_reactions WHERE message_id = $1 AND user_id = $2',
            [messageId, userId]
        );

        logger.debug('Message reaction removed', { messageId, userId });
    } catch (error) {
        logger.error('Error removing message reaction', {
            messageId,
            userId,
            error: error.message
        });
        throw error;
    }
}

// ==============================================
// READ RECEIPTS
// ==============================================

/**
 * Mark conversation as read (update last_read_message_id)
 */
async function markConversationRead(conversationId, userId, lastReadMessageId) {
    try {
        await database.query(
            `UPDATE chat_participants
             SET last_read_message_id = $1, last_read_at = CURRENT_TIMESTAMP
             WHERE conversation_id = $2 AND user_id = $3`,
            [lastReadMessageId, conversationId, userId]
        );

        logger.debug('Conversation marked as read', { conversationId, userId, lastReadMessageId });
    } catch (error) {
        logger.error('Error marking conversation as read', {
            conversationId,
            userId,
            error: error.message
        });
        throw error;
    }
}

// ==============================================
// SEARCH
// ==============================================

/**
 * Search messages
 */
async function searchMessages(userId, searchQuery, filters = {}) {
    const { limit = 20, offset = 0, conversation_id } = filters;

    try {
        let query = `
            SELECT cm.*,
                   c.name as conversation_name,
                   c.type as conversation_type,
                   u.name as sender_name,
                   u.avatar_url as sender_avatar
            FROM chat_messages cm
            JOIN chat_conversations c ON c.id = cm.conversation_id
            JOIN users u ON u.id = cm.user_id
            WHERE cm.is_deleted = false
              AND EXISTS (
                  SELECT 1 FROM chat_participants cp
                  WHERE cp.conversation_id = cm.conversation_id
                    AND cp.user_id = $1
                    AND cp.is_active = true
              )
              AND to_tsvector('german', cm.message_text) @@ plainto_tsquery('german', $2)
        `;

        const params = [userId, searchQuery];
        let paramIndex = 3;

        if (conversation_id) {
            query += ` AND cm.conversation_id = $${paramIndex++}`;
            params.push(conversation_id);
        }

        query += `
            ORDER BY cm.created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `;

        params.push(limit, offset);

        const result = await database.query(query, params);

        return result.rows;
    } catch (error) {
        logger.error('Error searching messages', { userId, searchQuery, error: error.message });
        throw error;
    }
}

// ==============================================
// ONLINE STATUS
// ==============================================

/**
 * Update user online status
 */
async function updateOnlineStatus(userId, isOnline, socketId = null) {
    try {
        await database.query(
            `INSERT INTO user_online_status (user_id, is_online, socket_id, last_seen_at, updated_at)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             ON CONFLICT (user_id)
             DO UPDATE SET
                 is_online = EXCLUDED.is_online,
                 socket_id = EXCLUDED.socket_id,
                 last_seen_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP`,
            [userId, isOnline, socketId]
        );

        logger.debug('Online status updated', { userId, isOnline });
    } catch (error) {
        logger.error('Error updating online status', { userId, error: error.message });
        throw error;
    }
}

/**
 * Get online status for users
 */
async function getOnlineStatus(userIds) {
    try {
        const result = await database.query(
            `SELECT user_id, is_online, last_seen_at
             FROM user_online_status
             WHERE user_id = ANY($1)`,
            [userIds]
        );

        return result.rows;
    } catch (error) {
        logger.error('Error getting online status', { error: error.message });
        throw error;
    }
}

// ==============================================
// EXPORTS
// ==============================================

module.exports = {
    // Conversations
    getOrCreateDirectConversation,
    createGroupConversation,
    getConversationById,
    getUserConversations,
    updateConversation,

    // Participants
    getConversationParticipants,
    addParticipant,
    removeParticipant,

    // Messages
    sendMessage,
    getConversationMessages,
    editMessage,
    deleteMessage,

    // Message Reactions
    addMessageReaction,
    removeMessageReaction,

    // Read Receipts
    markConversationRead,

    // Search
    searchMessages,

    // Online Status
    updateOnlineStatus,
    getOnlineStatus,

    // Export database for advanced queries
    database
};
