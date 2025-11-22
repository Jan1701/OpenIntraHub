// =====================================================
// Mail-Drive Integration - Helper functions
// =====================================================

const driveService = require('./driveService');
const pool = require('./database');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('MailDrive');

/**
 * Store mail attachment in Drive
 */
async function storeMailAttachment(messageId, attachmentData, userId) {
    try {
        const {
            name,
            contentType,
            sizeBytes,
            content, // Buffer
            isInline = false,
            contentId = null,
            exchangeAttachmentId = null
        } = attachmentData;

        // Upload to Drive
        const file = await driveService.uploadFile(content, name, {
            userId,
            folderId: null, // Could create "Mail Attachments" folder
            description: `Mail attachment from message ID ${messageId}`,
            tags: ['mail', 'attachment', isInline ? 'inline' : 'attachment'],
            visibility: 'private', // Mail attachments are private
            mimeType: contentType
        });

        // Update mail_attachments table with drive_file_id
        await pool.query(`
            UPDATE mail_attachments
            SET drive_file_id = $1,
                stored_locally = true
            WHERE message_id = $2 AND name = $3
        `, [file.id, messageId, name]);

        logger.info('Mail attachment stored in Drive', {
            fileId: file.id,
            messageId,
            fileName: name,
            userId
        });

        return file.id;

    } catch (error) {
        logger.error('Failed to store mail attachment', {
            error: error.message,
            messageId,
            userId
        });
        throw error;
    }
}

/**
 * Get mail attachment from Drive
 */
async function getMailAttachment(attachmentId, userId) {
    try {
        // Get attachment record
        const result = await pool.query(`
            SELECT ma.*, m.user_id as owner_id
            FROM mail_attachments ma
            JOIN mail_messages m ON ma.message_id = m.id
            WHERE ma.id = $1
        `, [attachmentId]);

        if (result.rows.length === 0) {
            throw new Error('Attachment not found');
        }

        const attachment = result.rows[0];

        // Check if user has access to the mail message
        if (attachment.owner_id !== userId) {
            throw new Error('Access denied');
        }

        // Get file from Drive if stored there
        if (attachment.drive_file_id) {
            const file = await driveService.getFile(attachment.drive_file_id, userId);
            return {
                id: attachment.id,
                name: attachment.name,
                contentType: attachment.content_type,
                size: attachment.size_bytes,
                driveFileId: file.id,
                downloadUrl: `/api/drive/files/${file.id}/download`,
                isInline: attachment.is_inline,
                contentId: attachment.content_id
            };
        }

        // Fallback: attachment not in Drive yet
        return {
            id: attachment.id,
            name: attachment.name,
            contentType: attachment.content_type,
            size: attachment.size_bytes,
            isInline: attachment.is_inline,
            contentId: attachment.content_id,
            exchangeAttachmentId: attachment.exchange_attachment_id
        };

    } catch (error) {
        logger.error('Failed to get mail attachment', {
            error: error.message,
            attachmentId,
            userId
        });
        throw error;
    }
}

/**
 * Link existing mail_attachments to Drive (migration helper)
 */
async function linkMailAttachmentsToDrive(messageId, userId) {
    try {
        const result = await pool.query(
            'SELECT * FROM mail_attachments WHERE message_id = $1 AND drive_file_id IS NULL',
            [messageId]
        );

        const linkedCount = 0;

        for (const attachment of result.rows) {
            // If we have local content, upload to Drive
            if (attachment.local_path && attachment.stored_locally) {
                // This would require reading the file from local_path
                // Skipping for now, as it requires filesystem access
                logger.warn('Mail attachment has local_path but migration not implemented', {
                    attachmentId: attachment.id
                });
            }
        }

        return linkedCount;

    } catch (error) {
        logger.error('Failed to link mail attachments to Drive', {
            error: error.message,
            messageId
        });
        return 0;
    }
}

module.exports = {
    storeMailAttachment,
    getMailAttachment,
    linkMailAttachmentsToDrive
};
