// =====================================================
// Drive Service - Core File Management Logic
// =====================================================

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const pool = require('./db');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('DriveService');

// Configuration
const UPLOAD_BASE_DIR = process.env.DRIVE_UPLOAD_DIR || path.join(__dirname, '..', 'uploads', 'drive');
const MAX_FILE_SIZE = parseInt(process.env.DRIVE_MAX_FILE_SIZE) || 100 * 1024 * 1024; // 100MB
const DEFAULT_QUOTA_BYTES = parseInt(process.env.DRIVE_USER_QUOTA) || 5 * 1024 * 1024 * 1024; // 5GB

class DriveService {
    constructor() {
        this.uploadDir = UPLOAD_BASE_DIR;
        this.maxFileSize = MAX_FILE_SIZE;
        this.defaultQuota = DEFAULT_QUOTA_BYTES;

        // Ensure upload directory exists
        this._ensureUploadDir();
    }

    /**
     * Ensure upload directory exists
     * @private
     */
    async _ensureUploadDir() {
        try {
            await fs.mkdir(this.uploadDir, { recursive: true });
            logger.info('Upload directory ensured', { path: this.uploadDir });
        } catch (error) {
            logger.error('Failed to create upload directory', { error: error.message });
        }
    }

    /**
     * Calculate SHA256 hash of file
     * @private
     */
    async _calculateFileHash(filePath) {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha256');
            const stream = fsSync.createReadStream(filePath);

            stream.on('data', data => hash.update(data));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', reject);
        });
    }

    /**
     * Generate storage path for file
     * @private
     */
    _generateStoragePath(fileHash, extension) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');

        const fileName = `${fileHash}${extension}`;
        const relativePath = path.join('drive', String(year), month, fileName);
        const absolutePath = path.join(this.uploadDir, '..', relativePath);

        return {
            relativePath,
            absolutePath
        };
    }

    /**
     * Upload file to drive
     */
    async uploadFile(fileBuffer, fileName, options = {}) {
        const client = await pool.connect();
        try {
            const {
                userId,
                folderId = null,
                description = null,
                tags = [],
                visibility = 'private',
                mimeType = 'application/octet-stream'
            } = options;

            // Validate file size
            if (fileBuffer.length > this.maxFileSize) {
                throw new Error(`File size exceeds maximum allowed size of ${this.maxFileSize} bytes`);
            }

            // Check user quota
            const usage = await this.getUserStorageUsage(userId);
            if (usage + fileBuffer.length > this.defaultQuota) {
                throw new Error('Storage quota exceeded');
            }

            // Calculate file hash
            const tempPath = path.join(this.uploadDir, `temp_${Date.now()}_${fileName}`);
            await fs.writeFile(tempPath, fileBuffer);

            const fileHash = await this._calculateFileHash(tempPath);
            const fileExtension = path.extname(fileName);

            await client.query('BEGIN');

            // Check if file with same hash already exists (deduplication)
            const existingFile = await client.query(
                'SELECT id, file_path FROM drive_files WHERE file_hash = $1 AND is_current_version = true LIMIT 1',
                [fileHash]
            );

            let storagePath;
            let absolutePath;

            if (existingFile.rows.length > 0) {
                // File already exists, reuse storage
                logger.info('File hash exists, reusing storage', { fileHash, fileName });
                storagePath = existingFile.rows[0].file_path;
                absolutePath = path.join(this.uploadDir, '..', storagePath);

                // Delete temp file
                await fs.unlink(tempPath);
            } else {
                // New file, move to permanent storage
                const paths = this._generateStoragePath(fileHash, fileExtension);
                storagePath = paths.relativePath;
                absolutePath = paths.absolutePath;

                // Ensure directory exists
                await fs.mkdir(path.dirname(absolutePath), { recursive: true });

                // Move file to permanent location
                await fs.rename(tempPath, absolutePath);
                logger.info('File stored', { fileName, storagePath });
            }

            // Generate slug
            const slug = fileName.toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
                .substring(0, 200);

            // Insert file metadata
            const result = await client.query(`
                INSERT INTO drive_files (
                    name, slug, description, file_path, file_hash,
                    mime_type, file_size_bytes, file_extension,
                    folder_id, uploaded_by, visibility, tags
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING *
            `, [
                fileName,
                slug,
                description,
                storagePath,
                fileHash,
                mimeType,
                fileBuffer.length,
                fileExtension,
                folderId,
                userId,
                visibility,
                tags
            ]);

            // Update folder stats if file is in a folder
            if (folderId) {
                await client.query(`
                    UPDATE drive_folders
                    SET file_count = file_count + 1,
                        total_size_bytes = total_size_bytes + $1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $2
                `, [fileBuffer.length, folderId]);
            }

            await client.query('COMMIT');

            logger.info('File uploaded', {
                fileId: result.rows[0].id,
                fileName,
                size: fileBuffer.length,
                userId
            });

            return result.rows[0];

        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('File upload failed', { error: error.message });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get file metadata by ID
     */
    async getFile(fileId, userId) {
        const result = await pool.query(`
            SELECT
                f.*,
                u.name as uploaded_by_name,
                u.email as uploaded_by_email,
                folder.name as folder_name
            FROM drive_files f
            LEFT JOIN users u ON f.uploaded_by = u.id
            LEFT JOIN drive_folders folder ON f.folder_id = folder.id
            WHERE f.id = $1 AND f.deleted_at IS NULL
        `, [fileId]);

        if (result.rows.length === 0) {
            throw new Error('File not found');
        }

        const file = result.rows[0];

        // Check permissions
        const hasAccess = await this.checkFileAccess(fileId, userId, 'read');
        if (!hasAccess) {
            throw new Error('Access denied');
        }

        return file;
    }

    /**
     * Get file stream for download
     */
    async getFileStream(fileId, userId) {
        const file = await this.getFile(fileId, userId);
        const filePath = path.join(this.uploadDir, '..', file.file_path);

        // Check if file exists
        try {
            await fs.access(filePath);
        } catch (error) {
            throw new Error('File not found on disk');
        }

        // Update download stats
        await pool.query(`
            UPDATE drive_files
            SET download_count = download_count + 1,
                last_accessed_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [fileId]);

        return {
            stream: fsSync.createReadStream(filePath),
            file
        };
    }

    /**
     * Delete file (soft delete)
     */
    async deleteFile(fileId, userId) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Check ownership
            const fileResult = await client.query(
                'SELECT * FROM drive_files WHERE id = $1 AND deleted_at IS NULL',
                [fileId]
            );

            if (fileResult.rows.length === 0) {
                throw new Error('File not found');
            }

            const file = fileResult.rows[0];

            if (file.uploaded_by !== userId) {
                throw new Error('Access denied');
            }

            // Soft delete
            await client.query(
                'UPDATE drive_files SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1',
                [fileId]
            );

            // Update folder stats
            if (file.folder_id) {
                await client.query(`
                    UPDATE drive_folders
                    SET file_count = file_count - 1,
                        total_size_bytes = total_size_bytes - $1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $2
                `, [file.file_size_bytes, file.folder_id]);
            }

            await client.query('COMMIT');

            logger.info('File deleted', { fileId, userId });

            return { success: true };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Create folder
     */
    async createFolder(name, options = {}) {
        const { userId, parentId = null, description = null, visibility = 'private' } = options;

        const slug = name.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Calculate depth and path
            let depth = 0;
            let parentPath = '';

            if (parentId) {
                const parentResult = await client.query(
                    'SELECT depth, path FROM drive_folders WHERE id = $1',
                    [parentId]
                );

                if (parentResult.rows.length === 0) {
                    throw new Error('Parent folder not found');
                }

                depth = parentResult.rows[0].depth + 1;
                parentPath = parentResult.rows[0].path;
            }

            const folderPath = parentPath ? `${parentPath}/${name}` : `/${name}`;

            // Insert folder
            const result = await client.query(`
                INSERT INTO drive_folders (
                    name, slug, description, parent_id, path, depth, owner_id, visibility
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `, [name, slug, description, parentId, folderPath, depth, userId, visibility]);

            await client.query('COMMIT');

            logger.info('Folder created', { folderId: result.rows[0].id, name, userId });

            return result.rows[0];

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * List files in folder
     */
    async listFiles(options = {}) {
        const {
            folderId = null,
            userId,
            limit = 50,
            offset = 0,
            sortBy = 'created_at',
            sortOrder = 'DESC',
            search = null
        } = options;

        let query = `
            SELECT
                f.*,
                u.name as uploaded_by_name,
                folder.name as folder_name
            FROM drive_files f
            LEFT JOIN users u ON f.uploaded_by = u.id
            LEFT JOIN drive_folders folder ON f.folder_id = folder.id
            WHERE f.deleted_at IS NULL
        `;

        const params = [];
        let paramIndex = 1;

        // Folder filter
        if (folderId === null) {
            query += ` AND f.folder_id IS NULL`;
        } else {
            query += ` AND f.folder_id = $${paramIndex}`;
            params.push(folderId);
            paramIndex++;
        }

        // Access filter: own files OR public files OR shared files
        query += ` AND (
            f.uploaded_by = $${paramIndex} OR
            f.visibility = 'public' OR
            EXISTS (
                SELECT 1 FROM drive_shares s
                WHERE s.file_id = f.id
                  AND (s.shared_with_user_id = $${paramIndex} OR s.public_token IS NOT NULL)
                  AND (s.expires_at IS NULL OR s.expires_at > CURRENT_TIMESTAMP)
            )
        )`;
        params.push(userId);
        paramIndex++;

        // Search filter
        if (search) {
            query += ` AND (
                f.name ILIKE $${paramIndex} OR
                f.search_vector @@ plainto_tsquery('german', $${paramIndex})
            )`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        // Sorting
        const allowedSortFields = ['name', 'file_size_bytes', 'created_at', 'updated_at', 'download_count'];
        const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
        const sortDir = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        query += ` ORDER BY f.${sortField} ${sortDir}`;

        // Pagination
        query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        // Get total count
        let countQuery = `
            SELECT COUNT(*) as total
            FROM drive_files f
            WHERE f.deleted_at IS NULL
        `;
        const countParams = [];
        let countParamIndex = 1;

        if (folderId === null) {
            countQuery += ` AND f.folder_id IS NULL`;
        } else {
            countQuery += ` AND f.folder_id = $${countParamIndex}`;
            countParams.push(folderId);
            countParamIndex++;
        }

        countQuery += ` AND (
            f.uploaded_by = $${countParamIndex} OR
            f.visibility = 'public' OR
            EXISTS (
                SELECT 1 FROM drive_shares s
                WHERE s.file_id = f.id
                  AND (s.shared_with_user_id = $${countParamIndex} OR s.public_token IS NOT NULL)
                  AND (s.expires_at IS NULL OR s.expires_at > CURRENT_TIMESTAMP)
            )
        )`;
        countParams.push(userId);

        const countResult = await pool.query(countQuery, countParams);

        return {
            files: result.rows,
            total: parseInt(countResult.rows[0].total),
            limit,
            offset
        };
    }

    /**
     * List folders
     */
    async listFolders(options = {}) {
        const { parentId = null, userId, limit = 50, offset = 0 } = options;

        let query = `
            SELECT f.*, u.name as owner_name
            FROM drive_folders f
            LEFT JOIN users u ON f.owner_id = u.id
            WHERE f.deleted_at IS NULL
        `;

        const params = [];
        let paramIndex = 1;

        if (parentId === null) {
            query += ` AND f.parent_id IS NULL`;
        } else {
            query += ` AND f.parent_id = $${paramIndex}`;
            params.push(parentId);
            paramIndex++;
        }

        // Access filter
        query += ` AND (
            f.owner_id = $${paramIndex} OR
            f.visibility = 'public' OR
            EXISTS (
                SELECT 1 FROM drive_shares s
                WHERE s.folder_id = f.id
                  AND (s.shared_with_user_id = $${paramIndex} OR s.public_token IS NOT NULL)
                  AND (s.expires_at IS NULL OR s.expires_at > CURRENT_TIMESTAMP)
            )
        )`;
        params.push(userId);
        paramIndex++;

        query += ` ORDER BY f.name ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        return result.rows;
    }

    /**
     * Check if user has access to file
     */
    async checkFileAccess(fileId, userId, permission = 'read') {
        const result = await pool.query(
            'SELECT user_has_drive_file_access($1, $2, $3) as has_access',
            [userId, fileId, permission]
        );

        return result.rows[0].has_access;
    }

    /**
     * Get user storage usage
     */
    async getUserStorageUsage(userId) {
        const result = await pool.query(
            'SELECT get_user_storage_usage($1) as usage',
            [userId]
        );

        return parseInt(result.rows[0].usage) || 0;
    }

    /**
     * Share file with user
     */
    async shareFile(fileId, options = {}) {
        const { sharedBy, sharedWithUserId = null, permission = 'read', expiresAt = null } = options;

        // Check if sharedBy is owner
        const fileResult = await pool.query(
            'SELECT uploaded_by FROM drive_files WHERE id = $1',
            [fileId]
        );

        if (fileResult.rows.length === 0) {
            throw new Error('File not found');
        }

        if (fileResult.rows[0].uploaded_by !== sharedBy) {
            throw new Error('Only file owner can share');
        }

        const result = await pool.query(`
            INSERT INTO drive_shares (
                file_id, shared_with_user_id, permission, shared_by, expires_at
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [fileId, sharedWithUserId, permission, sharedBy, expiresAt]);

        logger.info('File shared', { fileId, sharedWithUserId, permission });

        return result.rows[0];
    }

    /**
     * Create public share link
     */
    async createPublicLink(fileId, userId, expiresAt = null) {
        // Check ownership
        const fileResult = await pool.query(
            'SELECT uploaded_by FROM drive_files WHERE id = $1',
            [fileId]
        );

        if (fileResult.rows.length === 0) {
            throw new Error('File not found');
        }

        if (fileResult.rows[0].uploaded_by !== userId) {
            throw new Error('Only file owner can create public links');
        }

        // Generate token
        const token = crypto.randomBytes(32).toString('hex');

        const result = await pool.query(`
            INSERT INTO drive_shares (
                file_id, public_token, shared_by, expires_at, permission
            ) VALUES ($1, $2, $3, $4, 'read')
            RETURNING *
        `, [fileId, token, userId, expiresAt]);

        return {
            token,
            url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/drive/public/${token}`,
            expiresAt
        };
    }
}

module.exports = new DriveService();
