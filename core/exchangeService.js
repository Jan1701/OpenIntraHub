// =====================================================
// Exchange Service - EWS Integration for Calendar Sync
// =====================================================
// Purpose: Bidirectional calendar synchronization with Exchange 2016/2019
// using Exchange Web Services (EWS)
// =====================================================

const crypto = require('crypto');
const EWS = require('node-ews');
const pool = require('./database');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('Exchange');

// Encryption configuration
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.EXCHANGE_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

if (!process.env.EXCHANGE_ENCRYPTION_KEY) {
    logger.warn('EXCHANGE_ENCRYPTION_KEY not set in .env, using random key (credentials will be lost on restart)');
}

/**
 * Encrypt Exchange password
 */
function encryptPassword(password) {
    const key = Buffer.from(ENCRYPTION_KEY.substring(0, 64), 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
        encrypted: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
    };
}

/**
 * Decrypt Exchange password
 */
function decryptPassword(encryptedData, ivHex, authTagHex) {
    try {
        const key = Buffer.from(ENCRYPTION_KEY.substring(0, 64), 'hex');
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        logger.error('Password decryption failed', { error: error.message });
        throw new Error('Failed to decrypt Exchange credentials');
    }
}

/**
 * Create EWS client instance
 */
function createEWSClient(config) {
    const ewsConfig = {
        username: config.username,
        password: config.password,
        host: extractHostFromUrl(config.server_url)
    };

    // Add authentication type
    if (config.auth_type === 'ntlm') {
        ewsConfig.auth = 'ntlm';
    } else if (config.auth_type === 'basic') {
        ewsConfig.auth = 'basic';
    }

    return new EWS(ewsConfig);
}

/**
 * Extract host from Exchange URL
 */
function extractHostFromUrl(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch (error) {
        // If URL parsing fails, try to extract manually
        const match = url.match(/https?:\/\/([^\/]+)/);
        return match ? match[1] : url;
    }
}

/**
 * Test Exchange connection
 */
async function testConnection(config) {
    try {
        const ews = createEWSClient(config);

        // Simple test: Get inbox folder
        const ewsFunction = 'GetFolder';
        const ewsArgs = {
            FolderShape: {
                BaseShape: 'Default'
            },
            FolderIds: {
                DistinguishedFolderId: {
                    attributes: {
                        Id: 'inbox'
                    }
                }
            }
        };

        const result = await ews.run(ewsFunction, ewsArgs);

        return {
            success: true,
            message: 'Exchange connection successful',
            version: result.ResponseMessages?.GetFolderResponseMessage?.[0]?.Folders?.Folder?.[0]?.FolderClass || 'Unknown'
        };
    } catch (error) {
        logger.error('Exchange connection test failed', {
            error: error.message,
            server: config.server_url
        });

        return {
            success: false,
            message: error.message,
            code: error.code || 'CONNECTION_ERROR'
        };
    }
}

/**
 * Save Exchange connection for user
 */
async function saveConnection(userId, config) {
    const client = await pool.connect();

    try {
        // Encrypt password
        const encrypted = encryptPassword(config.password);

        // Check if connection already exists
        const existingResult = await client.query(
            'SELECT id FROM exchange_connections WHERE user_id = $1',
            [userId]
        );

        let connectionId;

        if (existingResult.rows.length > 0) {
            // Update existing connection
            const updateResult = await client.query(`
                UPDATE exchange_connections SET
                    server_url = $1,
                    username = $2,
                    password_encrypted = $3,
                    encryption_iv = $4,
                    auth_type = $5,
                    sync_enabled = $6,
                    sync_frequency_minutes = $7,
                    conflict_strategy = $8,
                    sync_direction = $9,
                    connection_status = 'active',
                    last_error = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = $10
                RETURNING id
            `, [
                config.server_url,
                config.username,
                encrypted.encrypted + ':' + encrypted.authTag,
                encrypted.iv,
                config.auth_type || 'basic',
                config.sync_enabled !== false,
                config.sync_frequency_minutes || 15,
                config.conflict_strategy || 'exchange_wins',
                config.sync_direction || 'bidirectional',
                userId
            ]);

            connectionId = updateResult.rows[0].id;
            logger.info('Exchange connection updated', { userId, connectionId });
        } else {
            // Insert new connection
            const insertResult = await client.query(`
                INSERT INTO exchange_connections (
                    user_id, server_url, username, password_encrypted, encryption_iv,
                    auth_type, sync_enabled, sync_frequency_minutes, conflict_strategy, sync_direction
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING id
            `, [
                userId,
                config.server_url,
                config.username,
                encrypted.encrypted + ':' + encrypted.authTag,
                encrypted.iv,
                config.auth_type || 'basic',
                config.sync_enabled !== false,
                config.sync_frequency_minutes || 15,
                config.conflict_strategy || 'exchange_wins',
                config.sync_direction || 'bidirectional'
            ]);

            connectionId = insertResult.rows[0].id;
            logger.info('Exchange connection created', { userId, connectionId });
        }

        return {
            success: true,
            connectionId
        };
    } catch (error) {
        logger.error('Failed to save Exchange connection', { error: error.message, userId });
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Get user's Exchange connection
 */
async function getConnection(userId) {
    try {
        const result = await pool.query(
            'SELECT * FROM exchange_connections WHERE user_id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            return null;
        }

        const connection = result.rows[0];

        // Decrypt password
        const [encrypted, authTag] = connection.password_encrypted.split(':');
        const password = decryptPassword(encrypted, connection.encryption_iv, authTag);

        return {
            ...connection,
            password // Return decrypted password for internal use
        };
    } catch (error) {
        logger.error('Failed to get Exchange connection', { error: error.message, userId });
        throw error;
    }
}

/**
 * Discover user's Exchange calendars
 */
async function discoverCalendars(userId) {
    const client = await pool.connect();

    try {
        const connection = await getConnection(userId);

        if (!connection) {
            throw new Error('No Exchange connection found for user');
        }

        const ews = createEWSClient(connection);

        // Find all calendar folders
        const ewsFunction = 'FindFolder';
        const ewsArgs = {
            attributes: {
                Traversal: 'Deep'
            },
            FolderShape: {
                BaseShape: 'Default'
            },
            ParentFolderIds: {
                DistinguishedFolderId: {
                    attributes: {
                        Id: 'calendar'
                    }
                }
            }
        };

        const result = await ews.run(ewsFunction, ewsArgs);
        const folders = result.ResponseMessages?.FindFolderResponseMessage?.[0]?.RootFolder?.Folders?.CalendarFolder || [];

        const calendars = Array.isArray(folders) ? folders : [folders];

        // Save discovered calendars
        for (const calendar of calendars) {
            if (!calendar.FolderId) continue;

            await client.query(`
                INSERT INTO exchange_calendars (
                    connection_id, exchange_calendar_id, calendar_name, calendar_type
                ) VALUES ($1, $2, $3, $4)
                ON CONFLICT (connection_id, exchange_calendar_id)
                DO UPDATE SET
                    calendar_name = EXCLUDED.calendar_name,
                    discovered_at = CURRENT_TIMESTAMP
            `, [
                connection.id,
                calendar.FolderId.attributes.Id,
                calendar.DisplayName || 'Calendar',
                'calendar'
            ]);
        }

        logger.info('Calendars discovered', { userId, count: calendars.length });

        // Return saved calendars
        const savedResult = await client.query(
            'SELECT * FROM exchange_calendars WHERE connection_id = $1 ORDER BY calendar_name',
            [connection.id]
        );

        return {
            success: true,
            calendars: savedResult.rows
        };
    } catch (error) {
        logger.error('Calendar discovery failed', { error: error.message, userId });
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Enable/disable calendar sync
 */
async function toggleCalendarSync(userId, calendarId, enabled) {
    try {
        await pool.query(`
            UPDATE exchange_calendars ec
            SET is_synced = $1, sync_enabled = $1
            FROM exchange_connections conn
            WHERE ec.connection_id = conn.id
            AND conn.user_id = $2
            AND ec.id = $3
        `, [enabled, userId, calendarId]);

        logger.info('Calendar sync toggled', { userId, calendarId, enabled });

        return { success: true };
    } catch (error) {
        logger.error('Failed to toggle calendar sync', { error: error.message, userId, calendarId });
        throw error;
    }
}

/**
 * Sync events from Exchange to OpenIntraHub
 */
async function syncFromExchange(userId) {
    const client = await pool.connect();
    const syncStarted = new Date();

    try {
        await client.query('BEGIN');

        const connection = await getConnection(userId);

        if (!connection || !connection.sync_enabled) {
            throw new Error('Exchange sync not enabled for user');
        }

        const ews = createEWSClient(connection);

        // Get calendars to sync
        const calendarsResult = await client.query(
            'SELECT * FROM exchange_calendars WHERE connection_id = $1 AND sync_enabled = true',
            [connection.id]
        );

        let stats = {
            fetched: 0,
            created: 0,
            updated: 0,
            deleted: 0
        };

        for (const calendar of calendarsResult.rows) {
            // Find calendar items from the last 30 days to 1 year in future
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);
            const endDate = new Date();
            endDate.setFullYear(endDate.getFullYear() + 1);

            const ewsFunction = 'FindItem';
            const ewsArgs = {
                attributes: {
                    Traversal: 'Shallow'
                },
                ItemShape: {
                    BaseShape: 'IdOnly'
                },
                CalendarView: {
                    attributes: {
                        StartDate: startDate.toISOString(),
                        EndDate: endDate.toISOString()
                    }
                },
                ParentFolderIds: {
                    FolderId: {
                        attributes: {
                            Id: calendar.exchange_calendar_id
                        }
                    }
                }
            };

            const findResult = await ews.run(ewsFunction, ewsArgs);
            const items = findResult.ResponseMessages?.FindItemResponseMessage?.[0]?.RootFolder?.Items?.CalendarItem || [];
            const calendarItems = Array.isArray(items) ? items : [items];

            stats.fetched += calendarItems.length;

            // Get full details for each item
            for (const item of calendarItems) {
                if (!item.ItemId) continue;

                try {
                    const getItemArgs = {
                        ItemShape: {
                            BaseShape: 'Default',
                            AdditionalProperties: {
                                FieldURI: [
                                    { attributes: { FieldURI: 'item:Subject' } },
                                    { attributes: { FieldURI: 'item:Body' } },
                                    { attributes: { FieldURI: 'calendar:Start' } },
                                    { attributes: { FieldURI: 'calendar:End' } },
                                    { attributes: { FieldURI: 'calendar:Location' } },
                                    { attributes: { FieldURI: 'calendar:IsAllDayEvent' } },
                                    { attributes: { FieldURI: 'calendar:Organizer' } }
                                ]
                            }
                        },
                        ItemIds: {
                            ItemId: {
                                attributes: {
                                    Id: item.ItemId.attributes.Id,
                                    ChangeKey: item.ItemId.attributes.ChangeKey
                                }
                            }
                        }
                    };

                    const itemResult = await ews.run('GetItem', getItemArgs);
                    const eventData = itemResult.ResponseMessages?.GetItemResponseMessage?.[0]?.Items?.CalendarItem?.[0];

                    if (!eventData) continue;

                    // Check if event already exists in OpenIntraHub
                    const existingResult = await client.query(
                        'SELECT id, title, description, start_date, end_date, location FROM events WHERE exchange_event_id = $1',
                        [item.ItemId.attributes.Id]
                    );

                    const eventPayload = {
                        title: eventData.Subject || 'Untitled Event',
                        description: eventData.Body?._ || '',
                        start_date: eventData.Start,
                        end_date: eventData.End,
                        location: eventData.Location || null,
                        all_day: eventData.IsAllDayEvent === 'true',
                        exchange_event_id: item.ItemId.attributes.Id,
                        exchange_calendar_id: calendar.exchange_calendar_id,
                        exchange_change_key: item.ItemId.attributes.ChangeKey,
                        last_synced_at: new Date(),
                        sync_source: 'exchange'
                    };

                    if (existingResult.rows.length === 0) {
                        // Create new event
                        await client.query(`
                            INSERT INTO events (
                                title, description, start_date, end_date, location, all_day,
                                created_by, exchange_event_id, exchange_calendar_id,
                                exchange_change_key, last_synced_at, sync_source
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                        `, [
                            eventPayload.title,
                            eventPayload.description,
                            eventPayload.start_date,
                            eventPayload.end_date,
                            eventPayload.location,
                            eventPayload.all_day,
                            userId,
                            eventPayload.exchange_event_id,
                            eventPayload.exchange_calendar_id,
                            eventPayload.exchange_change_key,
                            eventPayload.last_synced_at,
                            eventPayload.sync_source
                        ]);

                        stats.created++;
                    } else {
                        // Update existing event
                        await client.query(`
                            UPDATE events SET
                                title = $1,
                                description = $2,
                                start_date = $3,
                                end_date = $4,
                                location = $5,
                                all_day = $6,
                                exchange_change_key = $7,
                                last_synced_at = $8
                            WHERE exchange_event_id = $9
                        `, [
                            eventPayload.title,
                            eventPayload.description,
                            eventPayload.start_date,
                            eventPayload.end_date,
                            eventPayload.location,
                            eventPayload.all_day,
                            eventPayload.exchange_change_key,
                            eventPayload.last_synced_at,
                            eventPayload.exchange_event_id
                        ]);

                        stats.updated++;
                    }
                } catch (itemError) {
                    logger.error('Failed to sync individual event', {
                        error: itemError.message,
                        itemId: item.ItemId.attributes.Id
                    });
                }
            }
        }

        // Update last sync time
        await client.query(
            'UPDATE exchange_connections SET last_sync_at = CURRENT_TIMESTAMP WHERE id = $1',
            [connection.id]
        );

        // Log sync operation
        const syncFinished = new Date();
        await client.query(`
            INSERT INTO exchange_sync_log (
                connection_id, sync_started_at, sync_finished_at, sync_duration_ms,
                sync_direction, events_fetched_from_exchange, events_created_in_openintrahub,
                events_updated_in_openintrahub, sync_status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
            connection.id,
            syncStarted,
            syncFinished,
            syncFinished - syncStarted,
            'exchange_to_openintrahub',
            stats.fetched,
            stats.created,
            stats.updated,
            'success'
        ]);

        await client.query('COMMIT');

        logger.info('Exchange sync completed', { userId, stats });

        return {
            success: true,
            stats
        };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Exchange sync failed', { error: error.message, userId });

        // Log failed sync
        try {
            await client.query(`
                INSERT INTO exchange_sync_log (
                    connection_id, sync_started_at, sync_finished_at, sync_status, error_message
                )
                SELECT id, $1, CURRENT_TIMESTAMP, 'failed', $2
                FROM exchange_connections
                WHERE user_id = $3
            `, [syncStarted, error.message, userId]);
        } catch (logError) {
            logger.error('Failed to log sync error', { error: logError.message });
        }

        throw error;
    } finally {
        client.release();
    }
}

/**
 * Sync events from OpenIntraHub to Exchange
 */
async function syncToExchange(userId) {
    const client = await pool.connect();
    const syncStarted = new Date();

    try {
        await client.query('BEGIN');

        const connection = await getConnection(userId);

        if (!connection || !connection.sync_enabled) {
            throw new Error('Exchange sync not enabled for user');
        }

        const ews = createEWSClient(connection);

        let stats = {
            created: 0,
            updated: 0,
            deleted: 0,
            errors: 0
        };

        // Find events that need to be pushed to Exchange
        // 1. Events created in OpenIntraHub without exchange_event_id
        // 2. Events modified since last_synced_at
        const eventsToPush = await client.query(`
            SELECT * FROM events
            WHERE created_by = $1
            AND (
                (exchange_event_id IS NULL AND sync_source = 'openintrahub')
                OR (last_synced_at IS NULL OR updated_at > last_synced_at)
            )
            ORDER BY created_at ASC
        `, [userId]);

        for (const event of eventsToPush.rows) {
            try {
                if (!event.exchange_event_id) {
                    // Create new event in Exchange
                    const createArgs = {
                        SavedItemFolderId: {
                            DistinguishedFolderId: {
                                attributes: {
                                    Id: 'calendar'
                                }
                            }
                        },
                        Items: {
                            CalendarItem: {
                                Subject: event.title,
                                Body: {
                                    attributes: {
                                        BodyType: 'Text'
                                    },
                                    _: event.description || ''
                                },
                                Start: event.start_date,
                                End: event.end_date,
                                Location: event.location || '',
                                IsAllDayEvent: event.all_day || false,
                                ReminderIsSet: false
                            }
                        }
                    };

                    const result = await ews.run('CreateItem', createArgs);
                    const createdItem = result.ResponseMessages?.CreateItemResponseMessage?.[0]?.Items?.CalendarItem?.[0];

                    if (createdItem?.ItemId) {
                        // Update OpenIntraHub event with Exchange IDs
                        await client.query(`
                            UPDATE events SET
                                exchange_event_id = $1,
                                exchange_change_key = $2,
                                last_synced_at = CURRENT_TIMESTAMP
                            WHERE id = $3
                        `, [
                            createdItem.ItemId.attributes.Id,
                            createdItem.ItemId.attributes.ChangeKey,
                            event.id
                        ]);

                        stats.created++;
                    }
                } else {
                    // Update existing event in Exchange
                    const updateArgs = {
                        ItemChanges: {
                            ItemChange: {
                                ItemId: {
                                    attributes: {
                                        Id: event.exchange_event_id,
                                        ChangeKey: event.exchange_change_key
                                    }
                                },
                                Updates: {
                                    SetItemField: [
                                        {
                                            FieldURI: { attributes: { FieldURI: 'item:Subject' } },
                                            CalendarItem: { Subject: event.title }
                                        },
                                        {
                                            FieldURI: { attributes: { FieldURI: 'item:Body' } },
                                            CalendarItem: {
                                                Body: {
                                                    attributes: { BodyType: 'Text' },
                                                    _: event.description || ''
                                                }
                                            }
                                        },
                                        {
                                            FieldURI: { attributes: { FieldURI: 'calendar:Start' } },
                                            CalendarItem: { Start: event.start_date }
                                        },
                                        {
                                            FieldURI: { attributes: { FieldURI: 'calendar:End' } },
                                            CalendarItem: { End: event.end_date }
                                        },
                                        {
                                            FieldURI: { attributes: { FieldURI: 'calendar:Location' } },
                                            CalendarItem: { Location: event.location || '' }
                                        },
                                        {
                                            FieldURI: { attributes: { FieldURI: 'calendar:IsAllDayEvent' } },
                                            CalendarItem: { IsAllDayEvent: event.all_day || false }
                                        }
                                    ]
                                }
                            }
                        }
                    };

                    const result = await ews.run('UpdateItem', updateArgs);
                    const updatedItem = result.ResponseMessages?.UpdateItemResponseMessage?.[0]?.Items?.CalendarItem?.[0];

                    if (updatedItem?.ItemId) {
                        // Update change key
                        await client.query(`
                            UPDATE events SET
                                exchange_change_key = $1,
                                last_synced_at = CURRENT_TIMESTAMP
                            WHERE id = $2
                        `, [updatedItem.ItemId.attributes.ChangeKey, event.id]);

                        stats.updated++;
                    }
                }
            } catch (itemError) {
                logger.error('Failed to push event to Exchange', {
                    error: itemError.message,
                    eventId: event.id
                });
                stats.errors++;
            }
        }

        // Find deleted events in OpenIntraHub that still exist in Exchange
        // (Events with exchange_event_id but deleted from OpenIntraHub)
        // This would require tracking deletions - for now, skip

        // Update last sync time
        await client.query(
            'UPDATE exchange_connections SET last_sync_at = CURRENT_TIMESTAMP WHERE id = $1',
            [connection.id]
        );

        // Log sync operation
        const syncFinished = new Date();
        await client.query(`
            INSERT INTO exchange_sync_log (
                connection_id, sync_started_at, sync_finished_at, sync_duration_ms,
                sync_direction, events_created_in_exchange, events_updated_in_exchange,
                sync_status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
            connection.id,
            syncStarted,
            syncFinished,
            syncFinished - syncStarted,
            'openintrahub_to_exchange',
            stats.created,
            stats.updated,
            stats.errors > 0 ? 'partial_success' : 'success'
        ]);

        await client.query('COMMIT');

        logger.info('Push to Exchange completed', { userId, stats });

        return {
            success: true,
            stats
        };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Push to Exchange failed', { error: error.message, userId });

        // Log failed sync
        try {
            await client.query(`
                INSERT INTO exchange_sync_log (
                    connection_id, sync_started_at, sync_finished_at, sync_status, error_message
                )
                SELECT id, $1, CURRENT_TIMESTAMP, 'failed', $2
                FROM exchange_connections
                WHERE user_id = $3
            `, [syncStarted, error.message, userId]);
        } catch (logError) {
            logger.error('Failed to log sync error', { error: logError.message });
        }

        throw error;
    } finally {
        client.release();
    }
}

/**
 * Get user's Out of Office (OOF) settings from Exchange
 */
async function getOutOfOfficeSettings(userId) {
    try {
        const connection = await getConnection(userId);

        if (!connection) {
            throw new Error('No Exchange connection found for user');
        }

        const ews = createEWSClient(connection);

        const oofArgs = {
            Mailbox: {
                Address: connection.username
            }
        };

        const result = await ews.run('GetUserOofSettings', oofArgs);
        const oofSettings = result.OofSettings;

        return {
            success: true,
            settings: {
                state: oofSettings?.OofState || 'Disabled', // Disabled, Enabled, Scheduled
                externalAudience: oofSettings?.ExternalAudience || 'None',
                startTime: oofSettings?.Duration?.StartTime,
                endTime: oofSettings?.Duration?.EndTime,
                internalReply: oofSettings?.InternalReply?.Message || '',
                externalReply: oofSettings?.ExternalReply?.Message || ''
            }
        };
    } catch (error) {
        logger.error('Failed to get OOF settings', { error: error.message, userId });
        throw error;
    }
}

/**
 * Set user's Out of Office (OOF) settings in Exchange
 */
async function setOutOfOfficeSettings(userId, settings) {
    try {
        const connection = await getConnection(userId);

        if (!connection) {
            throw new Error('No Exchange connection found for user');
        }

        const ews = createEWSClient(connection);

        const oofArgs = {
            Mailbox: {
                Address: connection.username
            },
            UserOofSettings: {
                OofState: settings.state || 'Disabled', // Disabled, Enabled, Scheduled
                ExternalAudience: settings.externalAudience || 'None', // None, Known, All
                InternalReply: {
                    Message: settings.internalReply || ''
                },
                ExternalReply: {
                    Message: settings.externalReply || ''
                }
            }
        };

        // Add duration if scheduled
        if (settings.state === 'Scheduled' && settings.startTime && settings.endTime) {
            oofArgs.UserOofSettings.Duration = {
                StartTime: settings.startTime,
                EndTime: settings.endTime
            };
        }

        await ews.run('SetUserOofSettings', oofArgs);

        logger.info('OOF settings updated', { userId, state: settings.state });

        return {
            success: true,
            message: 'Out of Office settings updated successfully'
        };
    } catch (error) {
        logger.error('Failed to set OOF settings', { error: error.message, userId });
        throw error;
    }
}

/**
 * Bidirectional sync (both directions)
 */
async function syncBidirectional(userId) {
    try {
        // First pull from Exchange
        const pullResult = await syncFromExchange(userId);

        // Then push to Exchange
        const pushResult = await syncToExchange(userId);

        return {
            success: true,
            stats: {
                fromExchange: pullResult.stats,
                toExchange: pushResult.stats
            }
        };
    } catch (error) {
        logger.error('Bidirectional sync failed', { error: error.message, userId });
        throw error;
    }
}

/**
 * Delete Exchange connection
 */
async function deleteConnection(userId) {
    try {
        await pool.query(
            'DELETE FROM exchange_connections WHERE user_id = $1',
            [userId]
        );

        logger.info('Exchange connection deleted', { userId });

        return { success: true };
    } catch (error) {
        logger.error('Failed to delete Exchange connection', { error: error.message, userId });
        throw error;
    }
}

module.exports = {
    encryptPassword,
    decryptPassword,
    testConnection,
    saveConnection,
    getConnection,
    discoverCalendars,
    toggleCalendarSync,
    syncFromExchange,
    syncToExchange,
    syncBidirectional,
    getOutOfOfficeSettings,
    setOutOfOfficeSettings,
    deleteConnection
};
