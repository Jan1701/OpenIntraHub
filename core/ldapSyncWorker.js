// =====================================================
// LDAP Sync Worker - Automatic User Synchronization
// =====================================================

const cron = require('node-cron');
const pool = require('./database');
const ldapService = require('./ldapService');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('LDAPSync');

class LDAPSyncWorker {
    constructor() {
        this.isRunning = false;
        this.syncJob = null;
        this.config = {
            enabled: process.env.LDAP_SYNC_ENABLED === 'true',
            schedule: process.env.LDAP_SYNC_SCHEDULE || '0 */6 * * *', // Every 6 hours
            fullSyncOnStart: process.env.LDAP_FULL_SYNC_ON_START === 'true',
            deactivateRemovedUsers: process.env.LDAP_DEACTIVATE_REMOVED === 'true'
        };
    }

    /**
     * Start the LDAP sync worker
     */
    start() {
        if (!ldapService.enabled) {
            logger.info('LDAP is not enabled, sync worker will not start');
            return;
        }

        if (!this.config.enabled) {
            logger.info('LDAP sync worker is disabled via LDAP_SYNC_ENABLED');
            return;
        }

        logger.info('Starting LDAP sync worker', {
            schedule: this.config.schedule,
            fullSyncOnStart: this.config.fullSyncOnStart
        });

        // Run full sync on startup if configured
        if (this.config.fullSyncOnStart) {
            setTimeout(() => {
                this.syncAllUsers().catch(err => {
                    logger.error('Initial full sync failed', { error: err.message });
                });
            }, 5000); // Wait 5s for system to be ready
        }

        // Schedule regular syncs
        this.syncJob = cron.schedule(this.config.schedule, () => {
            this.syncAllUsers().catch(err => {
                logger.error('Scheduled sync failed', { error: err.message });
            });
        });

        logger.info('LDAP sync worker started');
    }

    /**
     * Stop the sync worker
     */
    stop() {
        if (this.syncJob) {
            this.syncJob.stop();
            logger.info('LDAP sync worker stopped');
        }
    }

    /**
     * Sync all users from LDAP
     */
    async syncAllUsers() {
        if (this.isRunning) {
            logger.warn('Sync already running, skipping');
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();

        logger.info('Starting full LDAP user sync');

        const client = await pool.connect();
        let syncLogId = null;

        try {
            // Create sync log entry
            const logResult = await client.query(`
                INSERT INTO ldap_sync_log (sync_type, started_at, status)
                VALUES ('full_sync', CURRENT_TIMESTAMP, 'running')
                RETURNING id
            `);
            syncLogId = logResult.rows[0].id;

            // Search for all users in LDAP
            const ldapUsers = await ldapService.searchUsers('*', 10000);
            logger.info(`Found ${ldapUsers.length} users in LDAP`);

            let created = 0;
            let updated = 0;
            let errors = 0;

            // Sync each user
            for (const ldapUser of ldapUsers) {
                try {
                    const result = await this._syncSingleUser(client, ldapUser);
                    if (result.created) created++;
                    if (result.updated) updated++;
                } catch (error) {
                    errors++;
                    logger.error('Failed to sync user', {
                        username: ldapUser.username,
                        error: error.message
                    });
                }
            }

            // Deactivate users not in LDAP anymore
            let deactivated = 0;
            if (this.config.deactivateRemovedUsers) {
                deactivated = await this._deactivateRemovedUsers(client, ldapUsers);
            }

            // Update sync log
            const duration = Math.floor((Date.now() - startTime) / 1000);
            await client.query(`
                UPDATE ldap_sync_log
                SET completed_at = CURRENT_TIMESTAMP,
                    duration_seconds = $1,
                    users_processed = $2,
                    users_created = $3,
                    users_updated = $4,
                    users_deactivated = $5,
                    users_errors = $6,
                    status = 'completed'
                WHERE id = $7
            `, [duration, ldapUsers.length, created, updated, deactivated, errors, syncLogId]);

            logger.info('LDAP sync completed', {
                duration: `${duration}s`,
                processed: ldapUsers.length,
                created,
                updated,
                deactivated,
                errors
            });

            return {
                success: true,
                processed: ldapUsers.length,
                created,
                updated,
                deactivated,
                errors
            };

        } catch (error) {
            logger.error('LDAP sync failed', { error: error.message });

            // Update sync log with error
            if (syncLogId) {
                const duration = Math.floor((Date.now() - startTime) / 1000);
                await client.query(`
                    UPDATE ldap_sync_log
                    SET completed_at = CURRENT_TIMESTAMP,
                        duration_seconds = $1,
                        status = 'failed',
                        error_message = $2
                    WHERE id = $3
                `, [duration, error.message, syncLogId]);
            }

            throw error;
        } finally {
            client.release();
            this.isRunning = false;
        }
    }

    /**
     * Sync a single user to database
     * @private
     */
    async _syncSingleUser(client, ldapUser) {
        // Determine role from groups
        const role = await this._getRoleFromGroups(client, ldapUser.groups);

        // Sanitize username
        const username = ldapUser.username.toLowerCase().replace(/[^a-z0-9_-]/g, '_');

        // Check if user exists
        const checkResult = await client.query(
            'SELECT id FROM users WHERE username = $1',
            [username]
        );

        const exists = checkResult.rows.length > 0;

        // Upsert user
        await client.query(`
            INSERT INTO users (
                username,
                name,
                email,
                role,
                auth_method,
                ldap_dn,
                ldap_guid,
                ldap_sam_account_name,
                ldap_user_principal_name,
                ldap_groups,
                ldap_last_sync_at,
                ldap_source_server,
                is_active
            ) VALUES ($1, $2, $3, $4, 'ldap', $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, $10, true)
            ON CONFLICT (username) DO UPDATE SET
                name = EXCLUDED.name,
                email = EXCLUDED.email,
                role = EXCLUDED.role,
                ldap_dn = EXCLUDED.ldap_dn,
                ldap_guid = EXCLUDED.ldap_guid,
                ldap_sam_account_name = EXCLUDED.ldap_sam_account_name,
                ldap_user_principal_name = EXCLUDED.ldap_user_principal_name,
                ldap_groups = EXCLUDED.ldap_groups,
                ldap_last_sync_at = CURRENT_TIMESTAMP,
                is_active = true,
                updated_at = CURRENT_TIMESTAMP
        `, [
            username,
            ldapUser.name,
            ldapUser.email || `${username}@${ldapService.config.adDomain || 'local'}`,
            role,
            ldapUser.dn,
            ldapUser.guid || null,
            ldapUser.samAccountName || null,
            ldapUser.userPrincipalName || null,
            JSON.stringify(ldapUser.groups),
            ldapService.config.url
        ]);

        return {
            created: !exists,
            updated: exists
        };
    }

    /**
     * Get role from LDAP groups
     * @private
     */
    async _getRoleFromGroups(client, groups) {
        if (!groups || groups.length === 0) {
            return 'user';
        }

        try {
            const result = await client.query(
                'SELECT get_role_from_ldap_groups($1) as role',
                [groups]
            );
            return result.rows[0]?.role || 'user';
        } catch (error) {
            logger.warn('Failed to get role from groups', { error: error.message });
            return 'user';
        }
    }

    /**
     * Deactivate users that were removed from LDAP
     * @private
     */
    async _deactivateRemovedUsers(client, ldapUsers) {
        // Get all LDAP usernames from sync
        const ldapUsernames = ldapUsers.map(u =>
            u.username.toLowerCase().replace(/[^a-z0-9_-]/g, '_')
        );

        // Deactivate users not in LDAP anymore
        const result = await client.query(`
            UPDATE users
            SET is_active = false,
                updated_at = CURRENT_TIMESTAMP
            WHERE auth_method = 'ldap'
              AND is_active = true
              AND username NOT IN (SELECT unnest($1::text[]))
            RETURNING username
        `, [ldapUsernames]);

        if (result.rows.length > 0) {
            logger.info('Deactivated removed LDAP users', {
                count: result.rows.length,
                usernames: result.rows.map(r => r.username)
            });
        }

        return result.rows.length;
    }

    /**
     * Manual sync trigger (for admin panel)
     */
    async triggerSync() {
        logger.info('Manual sync triggered');
        return await this.syncAllUsers();
    }

    /**
     * Get sync statistics
     */
    async getSyncStats() {
        const result = await pool.query(`
            SELECT
                COUNT(*) as total_syncs,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_syncs,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_syncs,
                MAX(started_at) as last_sync_at,
                AVG(duration_seconds) as avg_duration_seconds,
                SUM(users_created) as total_users_created,
                SUM(users_updated) as total_users_updated,
                SUM(users_deactivated) as total_users_deactivated
            FROM ldap_sync_log
            WHERE started_at > NOW() - INTERVAL '30 days'
        `);

        return result.rows[0];
    }

    /**
     * Get recent sync logs
     */
    async getRecentSyncLogs(limit = 10) {
        const result = await pool.query(`
            SELECT *
            FROM ldap_sync_log
            ORDER BY started_at DESC
            LIMIT $1
        `, [limit]);

        return result.rows;
    }

    /**
     * Cleanup old sync logs
     */
    async cleanupOldLogs(daysToKeep = 90) {
        const result = await pool.query(`
            DELETE FROM ldap_sync_log
            WHERE started_at < NOW() - INTERVAL '${daysToKeep} days'
            RETURNING id
        `);

        logger.info(`Cleaned up ${result.rows.length} old sync logs`);
        return result.rows.length;
    }
}

// Singleton instance
const ldapSyncWorker = new LDAPSyncWorker();

module.exports = ldapSyncWorker;
