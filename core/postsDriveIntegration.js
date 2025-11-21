// =====================================================
// Posts-Drive Integration - Helper functions
// =====================================================

const driveService = require('./driveService');
const pool = require('./db');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('PostsDrive');

/**
 * Upload post featured image to Drive
 */
async function uploadPostFeaturedImage(fileBuffer, fileName, postId, userId, mimeType) {
    try {
        const file = await driveService.uploadFile(fileBuffer, fileName, {
            userId,
            folderId: null, // Could create "Post Images" folder
            description: `Featured image for post ID ${postId}`,
            tags: ['post', 'featured-image', 'media'],
            visibility: 'public', // Post images are usually public
            mimeType
        });

        // Update post with drive file ID
        await pool.query(`
            UPDATE posts
            SET featured_image_drive_id = $1,
                featured_image = $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
        `, [file.id, `/api/drive/files/${file.id}/download`, postId]);

        logger.info('Post featured image uploaded to Drive', {
            fileId: file.id,
            postId,
            fileName,
            userId
        });

        return {
            driveFileId: file.id,
            url: `/api/drive/files/${file.id}/download`,
            name: file.name,
            size: file.file_size_bytes
        };

    } catch (error) {
        logger.error('Failed to upload post featured image', {
            error: error.message,
            postId,
            userId
        });
        throw error;
    }
}

/**
 * Get post featured image info
 */
async function getPostFeaturedImage(postId, userId) {
    try {
        const result = await pool.query(
            'SELECT featured_image_drive_id, featured_image FROM posts WHERE id = $1',
            [postId]
        );

        if (result.rows.length === 0) {
            throw new Error('Post not found');
        }

        const post = result.rows[0];

        if (!post.featured_image_drive_id) {
            // Fallback to old featured_image URL
            return {
                url: post.featured_image,
                isDriveFile: false
            };
        }

        // Get from Drive
        const file = await driveService.getFile(post.featured_image_drive_id, userId);

        return {
            id: file.id,
            url: `/api/drive/files/${file.id}/download`,
            name: file.name,
            mimeType: file.mime_type,
            size: file.file_size_bytes,
            isDriveFile: true
        };

    } catch (error) {
        logger.error('Failed to get post featured image', {
            error: error.message,
            postId
        });
        return null;
    }
}

/**
 * Upload event image to Drive
 */
async function uploadEventImage(fileBuffer, fileName, eventId, userId, mimeType) {
    try {
        const file = await driveService.uploadFile(fileBuffer, fileName, {
            userId,
            folderId: null, // Could create "Event Images" folder
            description: `Image for event ID ${eventId}`,
            tags: ['event', 'image', 'media'],
            visibility: 'public', // Event images are usually public
            mimeType
        });

        // Update event with drive file ID
        await pool.query(`
            UPDATE events
            SET image_drive_id = $1,
                image = $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
        `, [file.id, `/api/drive/files/${file.id}/download`, eventId]);

        logger.info('Event image uploaded to Drive', {
            fileId: file.id,
            eventId,
            fileName,
            userId
        });

        return {
            driveFileId: file.id,
            url: `/api/drive/files/${file.id}/download`,
            name: file.name,
            size: file.file_size_bytes
        };

    } catch (error) {
        logger.error('Failed to upload event image', {
            error: error.message,
            eventId,
            userId
        });
        throw error;
    }
}

/**
 * Delete post featured image from Drive
 */
async function deletePostFeaturedImage(postId, userId) {
    try {
        const result = await pool.query(
            'SELECT featured_image_drive_id FROM posts WHERE id = $1 AND author_id = $2',
            [postId, userId]
        );

        if (result.rows.length === 0) {
            throw new Error('Post not found or access denied');
        }

        const driveFileId = result.rows[0].featured_image_drive_id;

        if (driveFileId) {
            await driveService.deleteFile(driveFileId, userId);

            await pool.query(`
                UPDATE posts
                SET featured_image_drive_id = NULL,
                    featured_image = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [postId]);

            logger.info('Post featured image deleted from Drive', {
                driveFileId,
                postId,
                userId
            });
        }

        return { success: true };

    } catch (error) {
        logger.error('Failed to delete post featured image', {
            error: error.message,
            postId,
            userId
        });
        throw error;
    }
}

module.exports = {
    uploadPostFeaturedImage,
    getPostFeaturedImage,
    uploadEventImage,
    deletePostFeaturedImage
};
