// =====================================================
// Mail Service - Exchange Mail Integration
// =====================================================
// Purpose: Sync mail from Exchange, send mail, manage folders
// =====================================================

const pool = require('./database');
const exchangeService = require('./exchangeService');
const { createModuleLogger } = require('./logger');
const path = require('path');
const fs = require('fs').promises;

const logger = createModuleLogger('Mail');

/**
 * Sync mail folders from Exchange
 */
async function syncFolders(userId) {
    try {
        const connection = await exchangeService.getConnection(userId);
        if (!connection) {
            throw new Error('No Exchange connection found');
        }

        // Get folders from Exchange
        const result = await connection.run('FindFolder', {
            ParentFolderIds: {
                DistinguishedFolderId: [
                    { Id: 'msgfolderroot' }
                ]
            },
            Traversal: 'Deep',
            FolderShape: {
                BaseShape: 'AllProperties'
            }
        });

        const folders = result.ResponseMessages.FindFolderResponseMessage[0].RootFolder.Folders;
        if (!folders || !folders.Folder) {
            return { synced: 0 };
        }

        const folderList = Array.isArray(folders.Folder) ? folders.Folder : [folders.Folder];
        let syncedCount = 0;

        for (const folder of folderList) {
            await pool.query(`
                INSERT INTO mail_folders (
                    user_id, exchange_folder_id, exchange_change_key,
                    parent_folder_id, folder_name, folder_class,
                    total_count, unread_count, last_synced_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id, exchange_folder_id)
                DO UPDATE SET
                    exchange_change_key = EXCLUDED.exchange_change_key,
                    folder_name = EXCLUDED.folder_name,
                    total_count = EXCLUDED.total_count,
                    unread_count = EXCLUDED.unread_count,
                    last_synced_at = CURRENT_TIMESTAMP
            `, [
                userId,
                folder.FolderId.Id,
                folder.FolderId.ChangeKey,
                folder.ParentFolderId?.Id || null,
                folder.DisplayName,
                folder.FolderClass || 'IPF.Note',
                folder.TotalCount || 0,
                folder.UnreadCount || 0
            ]);
            syncedCount++;
        }

        logger.info('Folders synced from Exchange', { userId, count: syncedCount });
        return { synced: syncedCount };
    } catch (error) {
        logger.error('Failed to sync folders', { error: error.message, userId });
        throw error;
    }
}

/**
 * Sync messages from a specific folder
 */
async function syncMessages(userId, folderId = null, limit = 50) {
    try {
        const connection = await exchangeService.getConnection(userId);
        if (!connection) {
            throw new Error('No Exchange connection found');
        }

        // Get folder info
        let exchangeFolderId = 'inbox';
        if (folderId) {
            const folderResult = await pool.query(
                'SELECT exchange_folder_id FROM mail_folders WHERE id = $1 AND user_id = $2',
                [folderId, userId]
            );
            if (folderResult.rows.length > 0) {
                exchangeFolderId = folderResult.rows[0].exchange_folder_id;
            }
        }

        // Find items in folder
        const result = await connection.run('FindItem', {
            ItemShape: {
                BaseShape: 'IdOnly',
                AdditionalProperties: {
                    FieldURI: [
                        { FieldURI: 'item:Subject' },
                        { FieldURI: 'item:DateTimeReceived' },
                        { FieldURI: 'message:IsRead' },
                        { FieldURI: 'item:HasAttachments' }
                    ]
                }
            },
            ParentFolderIds: {
                FolderId: [{ Id: exchangeFolderId }]
            },
            Traversal: 'Shallow',
            MaxEntriesReturned: limit
        });

        const items = result.ResponseMessages.FindItemResponseMessage[0].RootFolder?.Items;
        if (!items || !items.Message) {
            return { synced: 0 };
        }

        const messages = Array.isArray(items.Message) ? items.Message : [items.Message];
        let syncedCount = 0;

        // Get full details for each message
        for (const item of messages) {
            try {
                const messageDetails = await connection.run('GetItem', {
                    ItemShape: {
                        BaseShape: 'AllProperties',
                        IncludeMimeContent: false
                    },
                    ItemIds: {
                        ItemId: [{ Id: item.ItemId.Id }]
                    }
                });

                const message = messageDetails.ResponseMessages.GetItemResponseMessage[0].Items.Message[0];

                // Extract recipients
                const toRecipients = extractRecipients(message.ToRecipients);
                const ccRecipients = extractRecipients(message.CcRecipients);

                // Store message in database
                await pool.query(`
                    INSERT INTO mail_messages (
                        user_id, folder_id, exchange_message_id, exchange_change_key,
                        conversation_id, subject, from_email, from_name,
                        to_recipients, cc_recipients, body_preview, body_text,
                        is_read, is_flagged, has_attachments, importance,
                        sent_at, received_at, last_synced_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, CURRENT_TIMESTAMP)
                    ON CONFLICT (user_id, exchange_message_id)
                    DO UPDATE SET
                        is_read = EXCLUDED.is_read,
                        is_flagged = EXCLUDED.is_flagged,
                        last_synced_at = CURRENT_TIMESTAMP
                `, [
                    userId,
                    folderId,
                    message.ItemId.Id,
                    message.ItemId.ChangeKey,
                    message.ConversationId?.Id || null,
                    message.Subject || '(Kein Betreff)',
                    message.From?.Mailbox?.EmailAddress || '',
                    message.From?.Mailbox?.Name || '',
                    JSON.stringify(toRecipients),
                    JSON.stringify(ccRecipients),
                    message.Body?._ ? message.Body._.substring(0, 255) : '',
                    message.Body?._ || '',
                    message.IsRead || false,
                    message.Flag?.FlagStatus === 'Flagged',
                    message.HasAttachments || false,
                    message.Importance || 'Normal',
                    message.DateTimeSent || null,
                    message.DateTimeReceived || null
                ]);

                // Sync attachments if any
                if (message.HasAttachments && message.Attachments) {
                    await syncAttachments(userId, message);
                }

                syncedCount++;
            } catch (err) {
                logger.warn('Failed to sync message', { error: err.message, messageId: item.ItemId.Id });
            }
        }

        logger.info('Messages synced from Exchange', { userId, folder: exchangeFolderId, count: syncedCount });
        return { synced: syncedCount };
    } catch (error) {
        logger.error('Failed to sync messages', { error: error.message, userId });
        throw error;
    }
}

/**
 * Sync attachments for a message
 */
async function syncAttachments(userId, message) {
    try {
        // Get message ID from database
        const msgResult = await pool.query(
            'SELECT id FROM mail_messages WHERE user_id = $1 AND exchange_message_id = $2',
            [userId, message.ItemId.Id]
        );

        if (msgResult.rows.length === 0) return;

        const messageId = msgResult.rows[0].id;
        const attachments = Array.isArray(message.Attachments.FileAttachment)
            ? message.Attachments.FileAttachment
            : [message.Attachments.FileAttachment];

        for (const attachment of attachments) {
            await pool.query(`
                INSERT INTO mail_attachments (
                    message_id, exchange_attachment_id, name,
                    content_type, size_bytes, is_inline, content_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT DO NOTHING
            `, [
                messageId,
                attachment.AttachmentId?.Id || null,
                attachment.Name,
                attachment.ContentType || 'application/octet-stream',
                attachment.Size || 0,
                attachment.IsInline || false,
                attachment.ContentId || null
            ]);
        }
    } catch (error) {
        logger.warn('Failed to sync attachments', { error: error.message });
    }
}

/**
 * Send a new email via Exchange
 */
async function sendMail(userId, mailData) {
    try {
        const connection = await exchangeService.getConnection(userId);
        if (!connection) {
            throw new Error('No Exchange connection found');
        }

        // Build recipients
        const toRecipients = mailData.to.map(email => ({
            Mailbox: { EmailAddress: email }
        }));

        const ccRecipients = mailData.cc ? mailData.cc.map(email => ({
            Mailbox: { EmailAddress: email }
        })) : [];

        // Send message
        const result = await connection.run('CreateItem', {
            MessageDisposition: 'SendAndSaveCopy',
            Items: {
                Message: [{
                    ItemClass: 'IPM.Note',
                    Subject: mailData.subject,
                    Body: {
                        BodyType: mailData.isHtml ? 'HTML' : 'Text',
                        _: mailData.body
                    },
                    ToRecipients: toRecipients,
                    CcRecipients: ccRecipients.length > 0 ? ccRecipients : undefined,
                    Importance: mailData.importance || 'Normal'
                }]
            }
        });

        logger.info('Mail sent via Exchange', { userId, subject: mailData.subject });
        return { success: true };
    } catch (error) {
        logger.error('Failed to send mail', { error: error.message, userId });
        throw error;
    }
}

/**
 * Mark message as read/unread
 */
async function markAsRead(userId, messageId, isRead = true) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Get message details
        const result = await client.query(
            'SELECT exchange_message_id FROM mail_messages WHERE id = $1 AND user_id = $2',
            [messageId, userId]
        );

        if (result.rows.length === 0) {
            throw new Error('Message not found');
        }

        const exchangeMessageId = result.rows[0].exchange_message_id;

        // Update local database
        await client.query(
            'UPDATE mail_messages SET is_read = $1 WHERE id = $2',
            [isRead, messageId]
        );

        // Queue for Exchange sync
        await client.query(`
            INSERT INTO mail_sync_queue (user_id, operation, message_id, operation_data)
            VALUES ($1, $2, $3, $4)
        `, [userId, isRead ? 'mark_read' : 'mark_unread', messageId, JSON.stringify({ exchangeMessageId })]);

        await client.query('COMMIT');

        logger.info('Message marked as read', { userId, messageId, isRead });
        return { success: true };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Failed to mark message as read', { error: error.message, userId });
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Delete message
 */
async function deleteMessage(userId, messageId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Get message details
        const result = await client.query(
            'SELECT exchange_message_id FROM mail_messages WHERE id = $1 AND user_id = $2',
            [messageId, userId]
        );

        if (result.rows.length === 0) {
            throw new Error('Message not found');
        }

        const exchangeMessageId = result.rows[0].exchange_message_id;

        // Queue for Exchange sync
        await client.query(`
            INSERT INTO mail_sync_queue (user_id, operation, message_id, operation_data)
            VALUES ($1, $2, $3, $4)
        `, [userId, 'delete', messageId, JSON.stringify({ exchangeMessageId })]);

        // Delete locally
        await client.query('DELETE FROM mail_messages WHERE id = $1', [messageId]);

        await client.query('COMMIT');

        logger.info('Message deleted', { userId, messageId });
        return { success: true };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Failed to delete message', { error: error.message, userId });
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Get folders for user
 */
async function getFolders(userId) {
    try {
        const result = await pool.query(`
            SELECT
                id, folder_name, folder_class, folder_type,
                total_count, unread_count, last_synced_at
            FROM mail_folders
            WHERE user_id = $1
            ORDER BY folder_name ASC
        `, [userId]);

        return result.rows;
    } catch (error) {
        logger.error('Failed to get folders', { error: error.message, userId });
        throw error;
    }
}

/**
 * Get messages for user/folder
 */
async function getMessages(userId, options = {}) {
    try {
        const {
            folderId = null,
            limit = 50,
            offset = 0,
            unreadOnly = false,
            search = null
        } = options;

        let query = `
            SELECT
                m.*,
                f.folder_name
            FROM mail_messages m
            LEFT JOIN mail_folders f ON m.folder_id = f.id
            WHERE m.user_id = $1
        `;

        const params = [userId];
        let paramCount = 1;

        if (folderId) {
            paramCount++;
            query += ` AND m.folder_id = $${paramCount}`;
            params.push(folderId);
        }

        if (unreadOnly) {
            query += ` AND m.is_read = false`;
        }

        if (search) {
            paramCount++;
            query += ` AND (m.subject ILIKE $${paramCount} OR m.from_name ILIKE $${paramCount} OR m.from_email ILIKE $${paramCount})`;
            params.push(`%${search}%`);
        }

        query += ` ORDER BY m.received_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);
        return result.rows;
    } catch (error) {
        logger.error('Failed to get messages', { error: error.message, userId });
        throw error;
    }
}

/**
 * Get single message with attachments
 */
async function getMessage(userId, messageId) {
    try {
        const msgResult = await pool.query(`
            SELECT
                m.*,
                f.folder_name
            FROM mail_messages m
            LEFT JOIN mail_folders f ON m.folder_id = f.id
            WHERE m.id = $1 AND m.user_id = $2
        `, [messageId, userId]);

        if (msgResult.rows.length === 0) {
            throw new Error('Message not found');
        }

        const message = msgResult.rows[0];

        // Get attachments
        const attachResult = await pool.query(`
            SELECT * FROM mail_attachments WHERE message_id = $1
        `, [messageId]);

        message.attachments = attachResult.rows;

        return message;
    } catch (error) {
        logger.error('Failed to get message', { error: error.message, userId, messageId });
        throw error;
    }
}

/**
 * Helper: Extract recipients from Exchange format
 */
function extractRecipients(recipientsObj) {
    if (!recipientsObj || !recipientsObj.Mailbox) return [];

    const mailboxes = Array.isArray(recipientsObj.Mailbox)
        ? recipientsObj.Mailbox
        : [recipientsObj.Mailbox];

    return mailboxes.map(mb => ({
        email: mb.EmailAddress,
        name: mb.Name || mb.EmailAddress
    }));
}

module.exports = {
    syncFolders,
    syncMessages,
    sendMail,
    markAsRead,
    deleteMessage,
    getFolders,
    getMessages,
    getMessage
};
