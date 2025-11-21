// =====================================================
// Scheduled Sync Worker - Background Exchange Sync
// =====================================================
// Purpose: Automatically sync Exchange calendars and mail
// for all users with enabled connections
// =====================================================

const pool = require('./db');
const exchangeService = require('./exchangeService');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('ScheduledSync');

// Sync interval in milliseconds (15 minutes)
const SYNC_INTERVAL = parseInt(process.env.EXCHANGE_SYNC_INTERVAL_MINUTES || 15) * 60 * 1000;

// Track running syncs to avoid overlaps
const runningSyncs = new Set();

/**
 * Sync all users who are due for sync
 */
async function syncAllDueUsers() {
    try {
        // Find all connections that are due for sync
        const result = await pool.query(`
            SELECT
                ec.id as connection_id,
                ec.user_id,
                u.username,
                ec.sync_direction
            FROM exchange_connections ec
            JOIN users u ON ec.user_id = u.id
            WHERE ec.sync_enabled = true
            AND ec.connection_status = 'active'
            AND (
                ec.next_sync_at IS NULL
                OR ec.next_sync_at <= CURRENT_TIMESTAMP
            )
            ORDER BY ec.last_sync_at ASC NULLS FIRST
            LIMIT 50  -- Process max 50 users per run to avoid overload
        `);

        if (result.rows.length === 0) {
            logger.debug('No users due for sync');
            return;
        }

        logger.info(`Starting sync for ${result.rows.length} users`);

        const syncPromises = result.rows.map(async (connection) => {
            // Skip if already syncing
            if (runningSyncs.has(connection.user_id)) {
                logger.debug(`Sync already running for user ${connection.user_id}`);
                return;
            }

            runningSyncs.add(connection.user_id);

            try {
                const startTime = Date.now();

                // Sync based on configured direction
                let result;
                if (connection.sync_direction === 'bidirectional') {
                    result = await exchangeService.syncBidirectional(connection.user_id);
                } else if (connection.sync_direction === 'exchange_to_openintrahub') {
                    result = await exchangeService.syncFromExchange(connection.user_id);
                } else if (connection.sync_direction === 'openintrahub_to_exchange') {
                    result = await exchangeService.syncToExchange(connection.user_id);
                }

                const duration = Date.now() - startTime;

                logger.info(`Sync completed for user ${connection.username}`, {
                    userId: connection.user_id,
                    duration: `${duration}ms`,
                    stats: result?.stats
                });
            } catch (error) {
                logger.error(`Sync failed for user ${connection.username}`, {
                    userId: connection.user_id,
                    error: error.message
                });

                // Update connection with error
                await pool.query(`
                    UPDATE exchange_connections
                    SET
                        last_error = $1,
                        last_error_at = CURRENT_TIMESTAMP,
                        connection_status = 'error'
                    WHERE user_id = $2
                `, [error.message, connection.user_id]);
            } finally {
                runningSyncs.delete(connection.user_id);
            }
        });

        // Wait for all syncs to complete
        await Promise.allSettled(syncPromises);

        logger.info(`Sync batch completed for ${result.rows.length} users`);
    } catch (error) {
        logger.error('Error in syncAllDueUsers', { error: error.message });
    }
}

/**
 * Check and disable expired Out of Office settings
 */
async function checkExpiredOOF() {
    try {
        const result = await pool.query(`
            UPDATE user_status
            SET
                oof_enabled = false,
                status = 'available',
                status_message = NULL
            WHERE
                oof_enabled = true
                AND oof_end_time IS NOT NULL
                AND oof_end_time < CURRENT_TIMESTAMP
            RETURNING user_id
        `);

        if (result.rows.length > 0) {
            logger.info(`Disabled expired OOF for ${result.rows.length} users`);
        }
    } catch (error) {
        logger.error('Error checking expired OOF', { error: error.message });
    }
}

/**
 * Cleanup old status history (keep last 90 days)
 */
async function cleanupOldStatusHistory() {
    try {
        const result = await pool.query(`
            DELETE FROM user_status_history
            WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days'
        `);

        if (result.rowCount > 0) {
            logger.info(`Cleaned up ${result.rowCount} old status history entries`);
        }
    } catch (error) {
        logger.error('Error cleaning up status history', { error: error.message });
    }
}

/**
 * Cleanup old sync logs (keep last 30 days)
 */
async function cleanupOldSyncLogs() {
    try {
        const result = await pool.query(`
            DELETE FROM exchange_sync_log
            WHERE sync_started_at < CURRENT_TIMESTAMP - INTERVAL '30 days'
        `);

        if (result.rowCount > 0) {
            logger.info(`Cleaned up ${result.rowCount} old sync log entries`);
        }
    } catch (error) {
        logger.error('Error cleaning up sync logs', { error: error.message });
    }
}

/**
 * Start the scheduled sync worker
 */
function startWorker() {
    logger.info(`Starting scheduled sync worker (interval: ${SYNC_INTERVAL / 1000 / 60} minutes)`);

    // Run initial sync after 30 seconds
    setTimeout(() => {
        syncAllDueUsers();
    }, 30000);

    // Run sync at regular intervals
    setInterval(() => {
        syncAllDueUsers();
    }, SYNC_INTERVAL);

    // Check expired OOF every 5 minutes
    setInterval(() => {
        checkExpiredOOF();
    }, 5 * 60 * 1000);

    // Cleanup old data once per day (at 3 AM)
    const now = new Date();
    const nextThreeAM = new Date(now);
    nextThreeAM.setHours(3, 0, 0, 0);
    if (nextThreeAM <= now) {
        nextThreeAM.setDate(nextThreeAM.getDate() + 1);
    }
    const timeUntilThreeAM = nextThreeAM - now;

    setTimeout(() => {
        cleanupOldStatusHistory();
        cleanupOldSyncLogs();

        // Then run daily
        setInterval(() => {
            cleanupOldStatusHistory();
            cleanupOldSyncLogs();
        }, 24 * 60 * 60 * 1000);
    }, timeUntilThreeAM);

    logger.info('Scheduled sync worker started successfully');
}

/**
 * Stop the worker gracefully
 */
function stopWorker() {
    logger.info('Stopping scheduled sync worker...');
    // Wait for running syncs to complete
    const checkInterval = setInterval(() => {
        if (runningSyncs.size === 0) {
            clearInterval(checkInterval);
            logger.info('Scheduled sync worker stopped');
        } else {
            logger.info(`Waiting for ${runningSyncs.size} syncs to complete...`);
        }
    }, 1000);
}

module.exports = {
    startWorker,
    stopWorker,
    syncAllDueUsers,
    checkExpiredOOF,
    cleanupOldStatusHistory,
    cleanupOldSyncLogs
};
