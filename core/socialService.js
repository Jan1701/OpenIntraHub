/**
 * Social Service
 * Reactions, Activity Feed, Notifications, Mentions
 * Author: Jan Günther <jg@linxpress.de>
 */

const database = require('./database');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('SocialService');

// Reaction Types (Meta Workplace-inspiriert)
const REACTION_TYPES = {
    LIKE: 'like',           // 👍
    LOVE: 'love',           // ❤️
    CELEBRATE: 'celebrate', // 🎉
    INSIGHTFUL: 'insightful', // 💡
    SUPPORT: 'support',     // 🤝
    FUNNY: 'funny'          // 😄
};

// ==============================================
// POST REACTIONS
// ==============================================

/**
 * Add or update reaction to post
 */
async function addPostReaction(postId, userId, reactionType) {
    try {
        // Validate reaction type
        if (!Object.values(REACTION_TYPES).includes(reactionType)) {
            throw new Error(`Invalid reaction type: ${reactionType}`);
        }

        const result = await database.query(
            `INSERT INTO post_reactions (post_id, user_id, reaction_type)
             VALUES ($1, $2, $3)
             ON CONFLICT (post_id, user_id)
             DO UPDATE SET reaction_type = EXCLUDED.reaction_type, created_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [postId, userId, reactionType]
        );

        logger.debug('Post reaction added', { postId, userId, reactionType });

        return result.rows[0];
    } catch (error) {
        logger.error('Error adding post reaction', { postId, userId, error: error.message });
        throw error;
    }
}

/**
 * Remove reaction from post
 */
async function removePostReaction(postId, userId) {
    try {
        await database.query(
            'DELETE FROM post_reactions WHERE post_id = $1 AND user_id = $2',
            [postId, userId]
        );

        logger.debug('Post reaction removed', { postId, userId });
    } catch (error) {
        logger.error('Error removing post reaction', { postId, userId, error: error.message });
        throw error;
    }
}

/**
 * Get reactions for post
 */
async function getPostReactions(postId) {
    try {
        const result = await database.query(
            `SELECT pr.*,
                    u.name as user_name,
                    u.avatar_url
             FROM post_reactions pr
             LEFT JOIN users u ON u.id = pr.user_id
             WHERE pr.post_id = $1
             ORDER BY pr.created_at DESC`,
            [postId]
        );

        return result.rows;
    } catch (error) {
        logger.error('Error getting post reactions', { postId, error: error.message });
        throw error;
    }
}

/**
 * Get reaction summary for post (aggregated)
 */
async function getPostReactionSummary(postId) {
    try {
        const result = await database.query(
            `SELECT reaction_type, COUNT(*) as count
             FROM post_reactions
             WHERE post_id = $1
             GROUP BY reaction_type
             ORDER BY count DESC`,
            [postId]
        );

        return result.rows;
    } catch (error) {
        logger.error('Error getting post reaction summary', { postId, error: error.message });
        throw error;
    }
}

/**
 * Get user's reaction to post
 */
async function getUserPostReaction(postId, userId) {
    try {
        const result = await database.query(
            'SELECT * FROM post_reactions WHERE post_id = $1 AND user_id = $2',
            [postId, userId]
        );

        return result.rows[0] || null;
    } catch (error) {
        logger.error('Error getting user post reaction', { postId, userId, error: error.message });
        throw error;
    }
}

// ==============================================
// COMMENT REACTIONS
// ==============================================

/**
 * Add or update reaction to comment
 */
async function addCommentReaction(commentId, userId, reactionType) {
    try {
        if (!Object.values(REACTION_TYPES).includes(reactionType)) {
            throw new Error(`Invalid reaction type: ${reactionType}`);
        }

        const result = await database.query(
            `INSERT INTO comment_reactions (comment_id, user_id, reaction_type)
             VALUES ($1, $2, $3)
             ON CONFLICT (comment_id, user_id)
             DO UPDATE SET reaction_type = EXCLUDED.reaction_type, created_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [commentId, userId, reactionType]
        );

        return result.rows[0];
    } catch (error) {
        logger.error('Error adding comment reaction', { commentId, userId, error: error.message });
        throw error;
    }
}

/**
 * Remove reaction from comment
 */
async function removeCommentReaction(commentId, userId) {
    try {
        await database.query(
            'DELETE FROM comment_reactions WHERE comment_id = $1 AND user_id = $2',
            [commentId, userId]
        );
    } catch (error) {
        logger.error('Error removing comment reaction', { commentId, userId, error: error.message });
        throw error;
    }
}

// ==============================================
// POST SHARES
// ==============================================

/**
 * Share a post
 */
async function sharePost(postId, userId, shareComment = null) {
    try {
        const result = await database.query(
            `INSERT INTO post_shares (post_id, user_id, share_comment)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [postId, userId, shareComment]
        );

        // Create activity
        await database.query(
            `INSERT INTO activities (user_id, activity_type, target_type, target_id, content)
             VALUES ($1, 'post_shared', 'post', $2, $3)`,
            [userId, postId, JSON.stringify({ share_comment: shareComment })]
        );

        logger.info('Post shared', { postId, userId });

        return result.rows[0];
    } catch (error) {
        logger.error('Error sharing post', { postId, userId, error: error.message });
        throw error;
    }
}

/**
 * Get shares for post
 */
async function getPostShares(postId) {
    try {
        const result = await database.query(
            `SELECT ps.*,
                    u.name as user_name,
                    u.avatar_url
             FROM post_shares ps
             LEFT JOIN users u ON u.id = ps.user_id
             WHERE ps.post_id = $1
             ORDER BY ps.created_at DESC`,
            [postId]
        );

        return result.rows;
    } catch (error) {
        logger.error('Error getting post shares', { postId, error: error.message });
        throw error;
    }
}

// ==============================================
// ACTIVITY FEED
// ==============================================

/**
 * Get activity feed for user
 */
async function getActivityFeed(userId, filters = {}) {
    const {
        limit = 20,
        offset = 0,
        activity_types, // Array of types to filter
        space_id
    } = filters;

    try {
        let query = `
            SELECT DISTINCT a.*,
                   u.name as user_name,
                   u.avatar_url as user_avatar,

                   -- Post data if target is post
                   CASE WHEN a.target_type = 'post' THEN
                       (SELECT row_to_json(post_data)
                        FROM (
                            SELECT p.id, p.title, p.content, p.featured_image,
                                   p.author_id, p.comment_count, p.reaction_count, p.share_count,
                                   author.name as author_name
                            FROM posts p
                            LEFT JOIN users author ON author.id = p.author_id
                            WHERE p.id = a.target_id
                        ) post_data)
                   END as post_data,

                   -- Event data if target is event
                   CASE WHEN a.target_type = 'event' THEN
                       (SELECT row_to_json(event_data)
                        FROM (
                            SELECT e.id, e.title, e.start_time, e.end_time,
                                   e.location_id, l.name as location_name
                            FROM events e
                            LEFT JOIN locations l ON l.id = e.location_id
                            WHERE e.id = a.target_id
                        ) event_data)
                   END as event_data

            FROM activities a
            LEFT JOIN users u ON u.id = a.user_id
            WHERE 1=1
        `;

        const params = [];
        let paramIndex = 1;

        if (activity_types && activity_types.length > 0) {
            query += ` AND a.activity_type = ANY($${paramIndex++})`;
            params.push(activity_types);
        }

        if (space_id) {
            query += ` AND a.space_id = $${paramIndex++}`;
            params.push(space_id);
        }

        query += `
            ORDER BY a.created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `;

        params.push(limit, offset);

        const result = await database.query(query, params);

        return result.rows;
    } catch (error) {
        logger.error('Error getting activity feed', { userId, error: error.message });
        throw error;
    }
}

/**
 * Create activity
 */
async function createActivity(activityData) {
    const {
        user_id,
        activity_type,
        target_type,
        target_id,
        content = {},
        space_id = null
    } = activityData;

    try {
        const result = await database.query(
            `INSERT INTO activities (user_id, activity_type, target_type, target_id, content, space_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [user_id, activity_type, target_type, target_id, JSON.stringify(content), space_id]
        );

        return result.rows[0];
    } catch (error) {
        logger.error('Error creating activity', { activityData, error: error.message });
        throw error;
    }
}

// ==============================================
// NOTIFICATIONS
// ==============================================

/**
 * Get notifications for user
 */
async function getUserNotifications(userId, filters = {}) {
    const {
        unread_only = false,
        limit = 20,
        offset = 0
    } = filters;

    try {
        let query = `
            SELECT n.*,
                   actor.name as actor_name,
                   actor.avatar_url as actor_avatar
            FROM notifications n
            LEFT JOIN users actor ON actor.id = n.actor_id
            WHERE n.user_id = $1
        `;

        const params = [userId];
        let paramIndex = 2;

        if (unread_only) {
            query += ` AND n.is_read = false`;
        }

        query += `
            ORDER BY n.created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `;

        params.push(limit, offset);

        const result = await database.query(query, params);

        return result.rows;
    } catch (error) {
        logger.error('Error getting notifications', { userId, error: error.message });
        throw error;
    }
}

/**
 * Mark notification as read
 */
async function markNotificationRead(notificationId, userId) {
    try {
        await database.query(
            `UPDATE notifications
             SET is_read = true, read_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND user_id = $2`,
            [notificationId, userId]
        );

        logger.debug('Notification marked as read', { notificationId, userId });
    } catch (error) {
        logger.error('Error marking notification as read', { notificationId, error: error.message });
        throw error;
    }
}

/**
 * Mark all notifications as read
 */
async function markAllNotificationsRead(userId) {
    try {
        await database.query(
            `UPDATE notifications
             SET is_read = true, read_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 AND is_read = false`,
            [userId]
        );

        logger.info('All notifications marked as read', { userId });
    } catch (error) {
        logger.error('Error marking all notifications as read', { userId, error: error.message });
        throw error;
    }
}

/**
 * Get unread notification count
 */
async function getUnreadNotificationCount(userId) {
    try {
        const result = await database.query(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
            [userId]
        );

        return parseInt(result.rows[0].count);
    } catch (error) {
        logger.error('Error getting unread count', { userId, error: error.message });
        throw error;
    }
}

// ==============================================
// MENTIONS
// ==============================================

/**
 * Create mention
 */
async function createMention(mentionData) {
    const {
        mentionable_type,
        mentionable_id,
        mentioned_user_id,
        mentioned_by_user_id
    } = mentionData;

    try {
        const result = await database.query(
            `INSERT INTO mentions (mentionable_type, mentionable_id, mentioned_user_id, mentioned_by_user_id)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (mentionable_type, mentionable_id, mentioned_user_id) DO NOTHING
             RETURNING *`,
            [mentionable_type, mentionable_id, mentioned_user_id, mentioned_by_user_id]
        );

        if (result.rows.length > 0) {
            // Create notification
            const mentioner = await database.query('SELECT name FROM users WHERE id = $1', [mentioned_by_user_id]);
            const mentionerName = mentioner.rows[0]?.name || 'Jemand';

            await database.query(
                `INSERT INTO notifications (user_id, notification_type, source_type, source_id, actor_id, title, message, link)
                 VALUES ($1, 'mention', $2, $3, $4, 'Erwähnung', $5, $6)`,
                [
                    mentioned_user_id,
                    mentionable_type,
                    mentionable_id,
                    mentioned_by_user_id,
                    `${mentionerName} hat dich erwähnt`,
                    `/${mentionable_type}s/${mentionable_id}`
                ]
            );
        }

        return result.rows[0];
    } catch (error) {
        logger.error('Error creating mention', { mentionData, error: error.message });
        throw error;
    }
}

/**
 * Parse mentions from text (@username format)
 */
async function parseMentions(text) {
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
        const username = match[1];
        mentions.push(username);
    }

    // Get user IDs
    if (mentions.length > 0) {
        const result = await database.query(
            'SELECT id, username FROM users WHERE username = ANY($1)',
            [mentions]
        );
        return result.rows;
    }

    return [];
}

// ==============================================
// STATISTICS
// ==============================================

/**
 * Get social stats for user
 */
async function getUserSocialStats(userId) {
    try {
        const result = await database.query(
            `SELECT
                (SELECT COUNT(*) FROM post_reactions pr
                 JOIN posts p ON p.id = pr.post_id
                 WHERE p.author_id = $1) as reactions_received,

                (SELECT COUNT(*) FROM post_comments pc
                 JOIN posts p ON p.id = pc.post_id
                 WHERE p.author_id = $1) as comments_received,

                (SELECT COUNT(*) FROM post_shares ps
                 JOIN posts p ON p.id = ps.post_id
                 WHERE p.author_id = $1) as shares_received,

                (SELECT COUNT(*) FROM posts
                 WHERE author_id = $1 AND status = 'published') as posts_created,

                (SELECT COUNT(*) FROM post_comments
                 WHERE user_id = $1) as comments_made,

                (SELECT COUNT(*) FROM post_reactions
                 WHERE user_id = $1) as reactions_given
            `,
            [userId]
        );

        return result.rows[0];
    } catch (error) {
        logger.error('Error getting user social stats', { userId, error: error.message });
        throw error;
    }
}

// ==============================================
// EXPORTS
// ==============================================

module.exports = {
    // Reaction Types
    REACTION_TYPES,

    // Post Reactions
    addPostReaction,
    removePostReaction,
    getPostReactions,
    getPostReactionSummary,
    getUserPostReaction,

    // Comment Reactions
    addCommentReaction,
    removeCommentReaction,

    // Post Shares
    sharePost,
    getPostShares,

    // Activity Feed
    getActivityFeed,
    createActivity,

    // Notifications
    getUserNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    getUnreadNotificationCount,

    // Mentions
    createMention,
    parseMentions,

    // Statistics
    getUserSocialStats,

    // Export database for advanced queries
    database
};
