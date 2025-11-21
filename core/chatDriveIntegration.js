// =====================================================
// Chat-Drive Integration - Helper functions
// =====================================================

const driveService = require('./driveService');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('ChatDrive');

/**
 * Upload chat attachment to Drive and return file ID
 */
async function uploadChatAttachment(fileBuffer, fileName, userId, mimeType) {
    try {
        const file = await driveService.uploadFile(fileBuffer, fileName, {
            userId,
            folderId: null, // Store in root for now, could create "Chat Attachments" folder
            description: 'Chat attachment',
            tags: ['chat', 'attachment'],
            visibility: 'shared', // Shared so other chat participants can access
            mimeType
        });

        logger.info('Chat attachment uploaded to Drive', {
            fileId: file.id,
            fileName,
            userId
        });

        return file.id;

    } catch (error) {
        logger.error('Failed to upload chat attachment', {
            error: error.message,
            fileName,
            userId
        });
        throw error;
    }
}

/**
 * Get chat attachment file info by ID
 */
async function getChatAttachment(fileId, userId) {
    try {
        const file = await driveService.getFile(fileId, userId);
        return {
            id: file.id,
            name: file.name,
            url: `/api/drive/files/${file.id}/download`,
            mimeType: file.mime_type,
            size: file.file_size_bytes,
            createdAt: file.created_at
        };
    } catch (error) {
        logger.error('Failed to get chat attachment', {
            error: error.message,
            fileId,
            userId
        });
        return null; // Return null if file not accessible
    }
}

/**
 * Get multiple chat attachments
 */
async function getChatAttachments(fileIds, userId) {
    const attachments = [];

    for (const fileId of fileIds) {
        const attachment = await getChatAttachment(fileId, userId);
        if (attachment) {
            attachments.push(attachment);
        }
    }

    return attachments;
}

module.exports = {
    uploadChatAttachment,
    getChatAttachment,
    getChatAttachments
};
