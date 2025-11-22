// =====================================================
// User Status Service - Global User Presence Management
// =====================================================
// Purpose: Manage user availability status globally across
// all modules (Chat, Mail, Calendar, etc.)
// =====================================================

const pool = require('./database');
const exchangeService = require('./exchangeService');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('UserStatus');

/**
 * Get user's current status
 */
async function getUserStatus(userId) {
    try {
        const result = await pool.query(`
            SELECT
                us.*,
                u.username,
                u.name,
                u.email
            FROM user_status us
            JOIN users u ON us.user_id = u.id
            WHERE us.user_id = $1
        `, [userId]);

        if (result.rows.length === 0) {
            // Create default status if not exists
            await pool.query(`
                INSERT INTO user_status (user_id, status)
                VALUES ($1, 'available')
                ON CONFLICT (user_id) DO NOTHING
            `, [userId]);

            return {
                user_id: userId,
                status: 'available',
                status_message: null,
                oof_enabled: false
            };
        }

        return result.rows[0];
    } catch (error) {
        logger.error('Failed to get user status', { error: error.message, userId });
        throw error;
    }
}

/**
 * Get multiple users' statuses
 */
async function getMultipleUserStatuses(userIds) {
    try {
        const result = await pool.query(`
            SELECT
                us.user_id,
                us.status,
                us.status_message,
                us.oof_enabled,
                us.oof_start_time,
                us.oof_end_time,
                us.last_active_at,
                u.username,
                u.name
            FROM user_status us
            JOIN users u ON us.user_id = u.id
            WHERE us.user_id = ANY($1)
        `, [userIds]);

        // Create map for easy lookup
        const statusMap = {};
        result.rows.forEach(row => {
            statusMap[row.user_id] = row;
        });

        // Fill in defaults for missing users
        userIds.forEach(userId => {
            if (!statusMap[userId]) {
                statusMap[userId] = {
                    user_id: userId,
                    status: 'offline',
                    status_message: null,
                    oof_enabled: false
                };
            }
        });

        return statusMap;
    } catch (error) {
        logger.error('Failed to get multiple user statuses', { error: error.message });
        throw error;
    }
}

/**
 * Update user's status
 */
async function updateUserStatus(userId, statusData) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const updates = [];
        const values = [userId];
        let paramCount = 1;

        if (statusData.status) {
            paramCount++;
            updates.push(`status = $${paramCount}`);
            values.push(statusData.status);
        }

        if (statusData.status_message !== undefined) {
            paramCount++;
            updates.push(`status_message = $${paramCount}`);
            values.push(statusData.status_message);
        }

        if (updates.length === 0) {
            await client.query('ROLLBACK');
            return await getUserStatus(userId);
        }

        updates.push('last_active_at = CURRENT_TIMESTAMP');

        const result = await client.query(`
            UPDATE user_status
            SET ${updates.join(', ')}
            WHERE user_id = $1
            RETURNING *
        `, values);

        await client.query('COMMIT');

        logger.info('User status updated', { userId, status: statusData.status });

        return result.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Failed to update user status', { error: error.message, userId });
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Set Out of Office status
 */
async function setOutOfOffice(userId, oofData) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Update local status
        await client.query(`
            UPDATE user_status SET
                oof_enabled = $1,
                oof_start_time = $2,
                oof_end_time = $3,
                oof_internal_message = $4,
                oof_external_message = $5,
                status = CASE WHEN $1 = true THEN 'oof' ELSE status END,
                synced_to_exchange = false
            WHERE user_id = $6
        `, [
            oofData.enabled,
            oofData.startTime || null,
            oofData.endTime || null,
            oofData.internalMessage || null,
            oofData.externalMessage || null,
            userId
        ]);

        // Sync to Exchange if connected
        try {
            const exchangeConnection = await exchangeService.getConnection(userId);

            if (exchangeConnection) {
                const exchangeState = oofData.enabled ?
                    (oofData.startTime && oofData.endTime ? 'Scheduled' : 'Enabled') :
                    'Disabled';

                await exchangeService.setOutOfOfficeSettings(userId, {
                    state: exchangeState,
                    externalAudience: 'All',
                    startTime: oofData.startTime,
                    endTime: oofData.endTime,
                    internalReply: oofData.internalMessage || '',
                    externalReply: oofData.externalMessage || ''
                });

                // Mark as synced
                await client.query(`
                    UPDATE user_status SET
                        synced_to_exchange = true,
                        last_exchange_sync = CURRENT_TIMESTAMP
                    WHERE user_id = $1
                `, [userId]);

                logger.info('OOF synced to Exchange', { userId });
            }
        } catch (syncError) {
            logger.warn('Failed to sync OOF to Exchange', {
                error: syncError.message,
                userId
            });
            // Don't fail the whole operation if Exchange sync fails
        }

        await client.query('COMMIT');

        logger.info('Out of Office set', { userId, enabled: oofData.enabled });

        return await getUserStatus(userId);
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Failed to set Out of Office', { error: error.message, userId });
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Update last active timestamp
 */
async function updateLastActive(userId) {
    try {
        await pool.query(`
            UPDATE user_status SET
                last_active_at = CURRENT_TIMESTAMP,
                status = CASE
                    WHEN status = 'offline' THEN 'available'
                    ELSE status
                END
            WHERE user_id = $1
        `, [userId]);
    } catch (error) {
        logger.error('Failed to update last active', { error: error.message, userId });
        // Don't throw, this is not critical
    }
}

/**
 * Get status statistics for analytics
 */
async function getStatusStatistics(timeframe = '24 hours') {
    try {
        const interval = timeframe.includes('hour') ? timeframe :
                        timeframe.includes('day') ? `${timeframe.split(' ')[0]} days` :
                        '24 hours';

        const result = await pool.query(`
            SELECT
                new_status as status,
                COUNT(*) as count,
                AVG(duration_seconds) as avg_duration_seconds
            FROM user_status_history
            WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '${interval}'
            GROUP BY new_status
            ORDER BY count DESC
        `);

        return result.rows;
    } catch (error) {
        logger.error('Failed to get status statistics', { error: error.message });
        throw error;
    }
}

/**
 * Get all online users (active in last 5 minutes)
 */
async function getOnlineUsers() {
    try {
        const result = await pool.query(`
            SELECT
                us.user_id,
                us.status,
                us.status_message,
                us.oof_enabled,
                us.last_active_at,
                u.username,
                u.name
            FROM user_status us
            JOIN users u ON us.user_id = u.id
            WHERE us.last_active_at >= CURRENT_TIMESTAMP - INTERVAL '5 minutes'
            AND us.status != 'offline'
            ORDER BY us.last_active_at DESC
        `);

        return result.rows;
    } catch (error) {
        logger.error('Failed to get online users', { error: error.message });
        throw error;
    }
}

module.exports = {
    getUserStatus,
    getMultipleUserStatuses,
    updateUserStatus,
    setOutOfOffice,
    updateLastActive,
    getStatusStatistics,
    getOnlineUsers
};
