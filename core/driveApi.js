// =====================================================
// Drive API - REST Endpoints for File Management
// =====================================================

const express = require('express');
const multer = require('multer');
const router = express.Router();
const driveService = require('./driveService');
const { authenticateToken } = require('./middleware');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('DriveAPI');

// Multer configuration for file uploads (memory storage)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: parseInt(process.env.DRIVE_MAX_FILE_SIZE) || 100 * 1024 * 1024 // 100MB
    },
    fileFilter: (req, file, cb) => {
        // Optional: Block dangerous file types
        const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.ps1'];
        const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));

        if (dangerousExtensions.includes(ext)) {
            return cb(new Error('File type not allowed'), false);
        }

        cb(null, true);
    }
});

// =====================================================
// FILE ENDPOINTS
// =====================================================

/**
 * POST /api/drive/files/upload
 * Upload file(s) to drive
 */
router.post('/drive/files/upload', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: req.t('errors:validation.required', { field: 'file' })
            });
        }

        const {
            folderId,
            description,
            tags,
            visibility = 'private'
        } = req.body;

        const file = await driveService.uploadFile(req.file.buffer, req.file.originalname, {
            userId: req.user.id,
            folderId: folderId ? parseInt(folderId) : null,
            description,
            tags: tags ? (Array.isArray(tags) ? tags : JSON.parse(tags)) : [],
            visibility,
            mimeType: req.file.mimetype
        });

        res.json({
            success: true,
            data: file,
            message: req.t('drive:upload.success')
        });

        logger.info('File uploaded via API', {
            fileId: file.id,
            fileName: file.name,
            userId: req.user.id
        });

    } catch (error) {
        logger.error('File upload failed', { error: error.message });

        if (error.message === 'Storage quota exceeded') {
            return res.status(413).json({
                success: false,
                error: req.t('drive:errors.quotaExceeded')
            });
        }

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/drive/files
 * List files in folder (or root)
 */
router.get('/drive/files', authenticateToken, async (req, res) => {
    try {
        const {
            folderId,
            limit = 50,
            offset = 0,
            sortBy = 'created_at',
            sortOrder = 'DESC',
            search
        } = req.query;

        const result = await driveService.listFiles({
            folderId: folderId ? parseInt(folderId) : null,
            userId: req.user.id,
            limit: parseInt(limit),
            offset: parseInt(offset),
            sortBy,
            sortOrder,
            search
        });

        res.json({
            success: true,
            data: result.files,
            pagination: {
                total: result.total,
                limit: result.limit,
                offset: result.offset,
                hasMore: (result.offset + result.files.length) < result.total
            }
        });

    } catch (error) {
        logger.error('List files failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/drive/files/:id
 * Get file metadata
 */
router.get('/drive/files/:id', authenticateToken, async (req, res) => {
    try {
        const fileId = parseInt(req.params.id);
        const file = await driveService.getFile(fileId, req.user.id);

        res.json({
            success: true,
            data: file
        });

    } catch (error) {
        logger.error('Get file failed', { error: error.message, fileId: req.params.id });

        if (error.message === 'File not found') {
            return res.status(404).json({
                success: false,
                error: req.t('drive:errors.fileNotFound')
            });
        }

        if (error.message === 'Access denied') {
            return res.status(403).json({
                success: false,
                error: req.t('errors:general.accessDenied')
            });
        }

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/drive/files/:id/download
 * Download file
 */
router.get('/drive/files/:id/download', authenticateToken, async (req, res) => {
    try {
        const fileId = parseInt(req.params.id);
        const { stream, file } = await driveService.getFileStream(fileId, req.user.id);

        // Set headers
        res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
        res.setHeader('Content-Length', file.file_size_bytes);

        // Pipe stream
        stream.pipe(res);

        logger.info('File downloaded', { fileId, userId: req.user.id });

    } catch (error) {
        logger.error('File download failed', { error: error.message, fileId: req.params.id });

        if (error.message === 'File not found' || error.message === 'File not found on disk') {
            return res.status(404).json({
                success: false,
                error: req.t('drive:errors.fileNotFound')
            });
        }

        if (error.message === 'Access denied') {
            return res.status(403).json({
                success: false,
                error: req.t('errors:general.accessDenied')
            });
        }

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/drive/files/:id
 * Delete file (soft delete)
 */
router.delete('/drive/files/:id', authenticateToken, async (req, res) => {
    try {
        const fileId = parseInt(req.params.id);
        await driveService.deleteFile(fileId, req.user.id);

        res.json({
            success: true,
            message: req.t('drive:delete.success')
        });

        logger.info('File deleted', { fileId, userId: req.user.id });

    } catch (error) {
        logger.error('File delete failed', { error: error.message, fileId: req.params.id });

        if (error.message === 'File not found') {
            return res.status(404).json({
                success: false,
                error: req.t('drive:errors.fileNotFound')
            });
        }

        if (error.message === 'Access denied') {
            return res.status(403).json({
                success: false,
                error: req.t('errors:general.accessDenied')
            });
        }

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * PUT /api/drive/files/:id
 * Update file metadata
 */
router.put('/drive/files/:id', authenticateToken, async (req, res) => {
    try {
        const fileId = parseInt(req.params.id);
        const { name, description, tags, visibility } = req.body;

        // Check access
        const file = await driveService.getFile(fileId, req.user.id);

        if (file.uploaded_by !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: req.t('errors:general.accessDenied')
            });
        }

        // Update metadata
        const pool = require('./db');
        const result = await pool.query(`
            UPDATE drive_files
            SET name = COALESCE($1, name),
                description = COALESCE($2, description),
                tags = COALESCE($3, tags),
                visibility = COALESCE($4, visibility),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $5
            RETURNING *
        `, [name, description, tags, visibility, fileId]);

        res.json({
            success: true,
            data: result.rows[0],
            message: req.t('drive:update.success')
        });

        logger.info('File metadata updated', { fileId, userId: req.user.id });

    } catch (error) {
        logger.error('File update failed', { error: error.message, fileId: req.params.id });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =====================================================
// FOLDER ENDPOINTS
// =====================================================

/**
 * POST /api/drive/folders
 * Create new folder
 */
router.post('/drive/folders', authenticateToken, async (req, res) => {
    try {
        const { name, parentId, description, visibility = 'private' } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                error: req.t('errors:validation.required', { field: 'name' })
            });
        }

        const folder = await driveService.createFolder(name, {
            userId: req.user.id,
            parentId: parentId ? parseInt(parentId) : null,
            description,
            visibility
        });

        res.json({
            success: true,
            data: folder,
            message: req.t('drive:folder.created')
        });

        logger.info('Folder created', { folderId: folder.id, name, userId: req.user.id });

    } catch (error) {
        logger.error('Folder creation failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/drive/folders
 * List folders
 */
router.get('/drive/folders', authenticateToken, async (req, res) => {
    try {
        const { parentId, limit = 50, offset = 0 } = req.query;

        const folders = await driveService.listFolders({
            parentId: parentId ? parseInt(parentId) : null,
            userId: req.user.id,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            data: folders
        });

    } catch (error) {
        logger.error('List folders failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/drive/folders/:id
 * Get folder details
 */
router.get('/drive/folders/:id', authenticateToken, async (req, res) => {
    try {
        const folderId = parseInt(req.params.id);

        const pool = require('./db');
        const result = await pool.query(`
            SELECT f.*, u.name as owner_name
            FROM drive_folders f
            LEFT JOIN users u ON f.owner_id = u.id
            WHERE f.id = $1 AND f.deleted_at IS NULL
        `, [folderId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: req.t('drive:errors.folderNotFound')
            });
        }

        const folder = result.rows[0];

        // Check access
        if (folder.owner_id !== req.user.id && folder.visibility !== 'public') {
            return res.status(403).json({
                success: false,
                error: req.t('errors:general.accessDenied')
            });
        }

        res.json({
            success: true,
            data: folder
        });

    } catch (error) {
        logger.error('Get folder failed', { error: error.message, folderId: req.params.id });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =====================================================
// SHARING ENDPOINTS
// =====================================================

/**
 * POST /api/drive/files/:id/share
 * Share file with user
 */
router.post('/drive/files/:id/share', authenticateToken, async (req, res) => {
    try {
        const fileId = parseInt(req.params.id);
        const { sharedWithUserId, permission = 'read', expiresAt } = req.body;

        if (!sharedWithUserId) {
            return res.status(400).json({
                success: false,
                error: req.t('errors:validation.required', { field: 'sharedWithUserId' })
            });
        }

        const share = await driveService.shareFile(fileId, {
            sharedBy: req.user.id,
            sharedWithUserId: parseInt(sharedWithUserId),
            permission,
            expiresAt: expiresAt ? new Date(expiresAt) : null
        });

        res.json({
            success: true,
            data: share,
            message: req.t('drive:share.success')
        });

        logger.info('File shared', { fileId, sharedWithUserId, userId: req.user.id });

    } catch (error) {
        logger.error('File sharing failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/drive/files/:id/public-link
 * Create public share link
 */
router.post('/drive/files/:id/public-link', authenticateToken, async (req, res) => {
    try {
        const fileId = parseInt(req.params.id);
        const { expiresAt } = req.body;

        const link = await driveService.createPublicLink(
            fileId,
            req.user.id,
            expiresAt ? new Date(expiresAt) : null
        );

        res.json({
            success: true,
            data: link,
            message: req.t('drive:share.linkCreated')
        });

        logger.info('Public link created', { fileId, userId: req.user.id });

    } catch (error) {
        logger.error('Public link creation failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/drive/public/:token
 * Download file via public link (NO AUTH)
 */
router.get('/drive/public/:token', async (req, res) => {
    try {
        const { token } = req.params;

        const pool = require('./db');

        // Get share by token
        const shareResult = await pool.query(`
            SELECT s.*, f.*
            FROM drive_shares s
            JOIN drive_files f ON s.file_id = f.id
            WHERE s.public_token = $1
              AND (s.expires_at IS NULL OR s.expires_at > CURRENT_TIMESTAMP)
              AND f.deleted_at IS NULL
        `, [token]);

        if (shareResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Link not found or expired'
            });
        }

        const file = shareResult.rows[0];
        const filePath = require('path').join(driveService.uploadDir, '..', file.file_path);

        // Update access stats
        await pool.query(`
            UPDATE drive_shares
            SET access_count = access_count + 1,
                last_accessed_at = CURRENT_TIMESTAMP
            WHERE public_token = $1
        `, [token]);

        // Set headers and stream file
        res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
        res.setHeader('Content-Length', file.file_size_bytes);

        const fsSync = require('fs');
        const stream = fsSync.createReadStream(filePath);
        stream.pipe(res);

        logger.info('File downloaded via public link', { fileId: file.id, token });

    } catch (error) {
        logger.error('Public link download failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =====================================================
// STATS ENDPOINTS
// =====================================================

/**
 * GET /api/drive/stats
 * Get user storage statistics
 */
router.get('/drive/stats', authenticateToken, async (req, res) => {
    try {
        const usage = await driveService.getUserStorageUsage(req.user.id);
        const quota = driveService.defaultQuota;

        const pool = require('./db');

        // Get file counts
        const statsResult = await pool.query(`
            SELECT
                COUNT(*) as total_files,
                COUNT(*) FILTER (WHERE visibility = 'private') as private_files,
                COUNT(*) FILTER (WHERE visibility = 'shared') as shared_files,
                COUNT(*) FILTER (WHERE visibility = 'public') as public_files,
                COUNT(DISTINCT mime_type) as file_types
            FROM drive_files
            WHERE uploaded_by = $1
              AND deleted_at IS NULL
              AND is_current_version = true
        `, [req.user.id]);

        const folderCountResult = await pool.query(
            'SELECT COUNT(*) as total FROM drive_folders WHERE owner_id = $1 AND deleted_at IS NULL',
            [req.user.id]
        );

        res.json({
            success: true,
            data: {
                storage: {
                    used: usage,
                    quota: quota,
                    percentage: Math.round((usage / quota) * 100),
                    available: quota - usage
                },
                files: statsResult.rows[0],
                folders: {
                    total: parseInt(folderCountResult.rows[0].total)
                }
            }
        });

    } catch (error) {
        logger.error('Get stats failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =====================================================
// FOLDER MANAGEMENT ENDPOINTS
// =====================================================

/**
 * PUT /api/drive/folders/:id
 * Update folder (rename, move)
 */
router.put('/drive/folders/:id', authenticateToken, async (req, res) => {
    try {
        const folderId = parseInt(req.params.id);
        const { name, description, parentId } = req.body;

        const pool = require('./db');

        // Check ownership
        const folderResult = await pool.query(
            'SELECT owner_id FROM drive_folders WHERE id = $1 AND deleted_at IS NULL',
            [folderId]
        );

        if (folderResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: req.t('drive:errors.folderNotFound')
            });
        }

        if (folderResult.rows[0].owner_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: req.t('errors:general.accessDenied')
            });
        }

        // Update folder
        const result = await pool.query(`
            UPDATE drive_folders
            SET name = COALESCE($1, name),
                description = COALESCE($2, description),
                parent_id = COALESCE($3, parent_id),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
            RETURNING *
        `, [name, description, parentId !== undefined ? parentId : null, folderId]);

        res.json({
            success: true,
            data: result.rows[0],
            message: req.t('drive:folders.updated')
        });

        logger.info('Folder updated', { folderId, userId: req.user.id });

    } catch (error) {
        logger.error('Folder update failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/drive/folders/:id
 * Delete folder (soft delete)
 */
router.delete('/drive/folders/:id', authenticateToken, async (req, res) => {
    try {
        const folderId = parseInt(req.params.id);

        const pool = require('./db');

        // Check ownership
        const folderResult = await pool.query(
            'SELECT owner_id FROM drive_folders WHERE id = $1 AND deleted_at IS NULL',
            [folderId]
        );

        if (folderResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: req.t('drive:errors.folderNotFound')
            });
        }

        if (folderResult.rows[0].owner_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: req.t('errors:general.accessDenied')
            });
        }

        // Soft delete
        await pool.query(
            'UPDATE drive_folders SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1',
            [folderId]
        );

        res.json({
            success: true,
            message: req.t('drive:folders.deleted')
        });

        logger.info('Folder deleted', { folderId, userId: req.user.id });

    } catch (error) {
        logger.error('Folder delete failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =====================================================
// FILE VERSIONING ENDPOINTS
// =====================================================

/**
 * GET /api/drive/files/:id/versions
 * Get file version history
 */
router.get('/drive/files/:id/versions', authenticateToken, async (req, res) => {
    try {
        const fileId = parseInt(req.params.id);

        // Check access to file
        const file = await driveService.getFile(fileId, req.user.id);

        const pool = require('./db');

        // Get versions
        const result = await pool.query(`
            SELECT v.*, u.name as uploaded_by_name
            FROM drive_file_versions v
            LEFT JOIN users u ON v.uploaded_by = u.id
            WHERE v.file_id = $1
            ORDER BY v.version DESC
        `, [fileId]);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        logger.error('Get versions failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/drive/files/:id/restore-version
 * Restore a previous version
 */
router.post('/drive/files/:id/restore-version', authenticateToken, async (req, res) => {
    try {
        const fileId = parseInt(req.params.id);
        const { versionId } = req.body;

        if (!versionId) {
            return res.status(400).json({
                success: false,
                error: 'versionId required'
            });
        }

        // Check ownership
        const file = await driveService.getFile(fileId, req.user.id);

        if (file.uploaded_by !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: req.t('errors:general.accessDenied')
            });
        }

        const pool = require('./db');

        // Get version data
        const versionResult = await pool.query(
            'SELECT * FROM drive_file_versions WHERE id = $1 AND file_id = $2',
            [versionId, fileId]
        );

        if (versionResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Version not found'
            });
        }

        const version = versionResult.rows[0];

        // Create new version from current file
        await pool.query(`
            INSERT INTO drive_file_versions (
                file_id, version, file_path, file_hash, file_size_bytes,
                change_description, uploaded_by
            )
            SELECT id, version, file_path, file_hash, file_size_bytes,
                   'Auto-backup before restore', uploaded_by
            FROM drive_files
            WHERE id = $1
        `, [fileId]);

        // Restore version to main file
        await pool.query(`
            UPDATE drive_files
            SET file_path = $1,
                file_hash = $2,
                file_size_bytes = $3,
                version = version + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
        `, [version.file_path, version.file_hash, version.file_size_bytes, fileId]);

        res.json({
            success: true,
            message: 'Version restored successfully'
        });

        logger.info('Version restored', { fileId, versionId, userId: req.user.id });

    } catch (error) {
        logger.error('Version restore failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =====================================================
// USER LIST ENDPOINT (for sharing)
// =====================================================

/**
 * GET /api/users
 * Get list of users (for sharing interface)
 */
router.get('/users', authenticateToken, async (req, res) => {
    try {
        const pool = require('./db');

        const result = await pool.query(`
            SELECT id, username, name, email, avatar_url
            FROM users
            WHERE is_active = true
              AND id != $1
            ORDER BY name, username
            LIMIT 100
        `, [req.user.id]);

        res.json({
            success: true,
            users: result.rows
        });

    } catch (error) {
        logger.error('Get users failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
