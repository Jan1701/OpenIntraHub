/**
 * Theme API
 * Admin-Interface für White-Label Theme-Konfiguration
 * Author: Jan Günther <jg@linxpress.de>
 */

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const { authenticateToken, requirePermission } = require('./middleware');
const database = require('./database');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('ThemeApi');

// ==============================================
// FILE UPLOAD CONFIGURATION
// ==============================================

const UPLOAD_DIR = path.join(__dirname, '../uploads/theme');
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Ensure upload directory exists
async function ensureUploadDir() {
    try {
        await fs.mkdir(UPLOAD_DIR, { recursive: true });
    } catch (error) {
        logger.error('Failed to create upload directory:', error);
    }
}
ensureUploadDir();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        const type = req.body.type || 'logo';
        cb(null, `${type}-${timestamp}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Allowed: PNG, JPG, SVG, ICO'));
        }
    }
});

// ==============================================
// DEFAULT THEME CONFIGURATION
// ==============================================

const defaultTheme = {
    brand: {
        name: 'OpenIntraHub',
        tagline: 'Enterprise Social Intranet',
        logo: '/logo/transparent.png',
        logoLight: '/logo/light.png',
        logoDark: '/logo/dark.png',
        favicon: '/favicon.ico'
    },
    colors: {
        primary: '#0284c7',
        secondary: '#7c3aed',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        background: '#f9fafb',
        surface: '#ffffff'
    },
    layout: {
        sidebarWidth: 256,
        headerHeight: 64,
        borderRadius: 8
    },
    features: {
        darkMode: true,
        compactMode: false,
        animations: true
    }
};

// ==============================================
// THEME API ENDPOINTS
// ==============================================

/**
 * GET /api/admin/theme
 * Get current theme configuration
 */
router.get('/admin/theme', authenticateToken, requirePermission('admin.settings'), async (req, res) => {
    try {
        // Try to load from database
        const result = await database.query(
            'SELECT value FROM system_settings WHERE key = $1',
            ['theme_config']
        );

        if (result.rows.length > 0) {
            const theme = JSON.parse(result.rows[0].value);
            return res.json({
                success: true,
                data: theme
            });
        }

        // Return default theme if not configured
        res.json({
            success: true,
            data: defaultTheme
        });
    } catch (error) {
        logger.error('Error getting theme:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load theme configuration'
        });
    }
});

/**
 * GET /api/theme
 * Get public theme configuration (for frontend)
 */
router.get('/theme', async (req, res) => {
    try {
        const result = await database.query(
            'SELECT value FROM system_settings WHERE key = $1',
            ['theme_config']
        );

        if (result.rows.length > 0) {
            const theme = JSON.parse(result.rows[0].value);
            return res.json({
                success: true,
                data: theme
            });
        }

        res.json({
            success: true,
            data: defaultTheme
        });
    } catch (error) {
        logger.error('Error getting public theme:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load theme'
        });
    }
});

/**
 * PUT /api/admin/theme
 * Update theme configuration
 */
router.put('/admin/theme', authenticateToken, requirePermission('admin.settings'), async (req, res) => {
    try {
        const themeConfig = req.body;

        // Validate required fields
        if (!themeConfig.brand || !themeConfig.colors) {
            return res.status(400).json({
                success: false,
                message: 'Invalid theme configuration'
            });
        }

        // Merge with defaults to ensure all fields exist
        const mergedTheme = {
            ...defaultTheme,
            ...themeConfig,
            brand: { ...defaultTheme.brand, ...themeConfig.brand },
            colors: { ...defaultTheme.colors, ...themeConfig.colors },
            layout: { ...defaultTheme.layout, ...themeConfig.layout },
            features: { ...defaultTheme.features, ...themeConfig.features }
        };

        // Upsert theme configuration
        await database.query(`
            INSERT INTO system_settings (key, value, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (key) DO UPDATE SET
                value = EXCLUDED.value,
                updated_at = NOW()
        `, ['theme_config', JSON.stringify(mergedTheme)]);

        logger.info(`Theme updated by user ${req.user.id}`);

        res.json({
            success: true,
            message: 'Theme configuration saved',
            data: mergedTheme
        });
    } catch (error) {
        logger.error('Error saving theme:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save theme configuration'
        });
    }
});

/**
 * POST /api/admin/theme/upload
 * Upload theme asset (logo, favicon)
 */
router.post('/admin/theme/upload', authenticateToken, requirePermission('admin.settings'), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const type = req.body.type || 'logo';
        const validTypes = ['logo', 'logoLight', 'logoDark', 'favicon'];

        if (!validTypes.includes(type)) {
            // Delete uploaded file
            await fs.unlink(req.file.path);
            return res.status(400).json({
                success: false,
                message: 'Invalid asset type'
            });
        }

        // Generate public URL
        const publicUrl = `/uploads/theme/${req.file.filename}`;

        // Update theme configuration with new asset URL
        const result = await database.query(
            'SELECT value FROM system_settings WHERE key = $1',
            ['theme_config']
        );

        let currentTheme = defaultTheme;
        if (result.rows.length > 0) {
            currentTheme = JSON.parse(result.rows[0].value);
        }

        // Delete old file if exists and is a custom upload
        const oldPath = currentTheme.brand[type];
        if (oldPath && oldPath.startsWith('/uploads/theme/')) {
            try {
                const oldFilePath = path.join(__dirname, '..', oldPath);
                await fs.unlink(oldFilePath);
            } catch (e) {
                // Ignore if file doesn't exist
            }
        }

        // Update brand asset
        currentTheme.brand[type] = publicUrl;

        await database.query(`
            INSERT INTO system_settings (key, value, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (key) DO UPDATE SET
                value = EXCLUDED.value,
                updated_at = NOW()
        `, ['theme_config', JSON.stringify(currentTheme)]);

        logger.info(`Theme asset ${type} uploaded by user ${req.user.id}`);

        res.json({
            success: true,
            message: 'Asset uploaded successfully',
            data: {
                type,
                url: publicUrl,
                filename: req.file.filename
            }
        });
    } catch (error) {
        logger.error('Error uploading theme asset:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload asset'
        });
    }
});

/**
 * DELETE /api/admin/theme/asset/:type
 * Delete a theme asset
 */
router.delete('/admin/theme/asset/:type', authenticateToken, requirePermission('admin.settings'), async (req, res) => {
    try {
        const { type } = req.params;
        const validTypes = ['logo', 'logoLight', 'logoDark', 'favicon'];

        if (!validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid asset type'
            });
        }

        const result = await database.query(
            'SELECT value FROM system_settings WHERE key = $1',
            ['theme_config']
        );

        if (result.rows.length === 0) {
            return res.json({
                success: true,
                message: 'No custom theme configured'
            });
        }

        const currentTheme = JSON.parse(result.rows[0].value);
        const assetPath = currentTheme.brand[type];

        // Only delete if it's a custom uploaded file
        if (assetPath && assetPath.startsWith('/uploads/theme/')) {
            try {
                const filePath = path.join(__dirname, '..', assetPath);
                await fs.unlink(filePath);
            } catch (e) {
                // Ignore if file doesn't exist
            }
        }

        // Reset to default
        currentTheme.brand[type] = defaultTheme.brand[type];

        await database.query(`
            UPDATE system_settings SET value = $1, updated_at = NOW()
            WHERE key = $2
        `, [JSON.stringify(currentTheme), 'theme_config']);

        logger.info(`Theme asset ${type} deleted by user ${req.user.id}`);

        res.json({
            success: true,
            message: 'Asset deleted',
            data: {
                type,
                url: defaultTheme.brand[type]
            }
        });
    } catch (error) {
        logger.error('Error deleting theme asset:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete asset'
        });
    }
});

/**
 * POST /api/admin/theme/reset
 * Reset theme to defaults
 */
router.post('/admin/theme/reset', authenticateToken, requirePermission('admin.settings'), async (req, res) => {
    try {
        // Get current theme to delete uploaded files
        const result = await database.query(
            'SELECT value FROM system_settings WHERE key = $1',
            ['theme_config']
        );

        if (result.rows.length > 0) {
            const currentTheme = JSON.parse(result.rows[0].value);

            // Delete all custom uploaded files
            for (const key of ['logo', 'logoLight', 'logoDark', 'favicon']) {
                const assetPath = currentTheme.brand[key];
                if (assetPath && assetPath.startsWith('/uploads/theme/')) {
                    try {
                        const filePath = path.join(__dirname, '..', assetPath);
                        await fs.unlink(filePath);
                    } catch (e) {
                        // Ignore
                    }
                }
            }
        }

        // Delete theme configuration
        await database.query(
            'DELETE FROM system_settings WHERE key = $1',
            ['theme_config']
        );

        logger.info(`Theme reset to defaults by user ${req.user.id}`);

        res.json({
            success: true,
            message: 'Theme reset to defaults',
            data: defaultTheme
        });
    } catch (error) {
        logger.error('Error resetting theme:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset theme'
        });
    }
});

/**
 * GET /api/admin/theme/presets
 * Get available color presets
 */
router.get('/admin/theme/presets', authenticateToken, requirePermission('admin.settings'), async (req, res) => {
    const presets = {
        default: {
            name: 'OpenIntraHub Default',
            primary: '#0284c7',
            secondary: '#7c3aed'
        },
        corporate: {
            name: 'Corporate Blue',
            primary: '#1e40af',
            secondary: '#6366f1'
        },
        modern: {
            name: 'Modern Teal',
            primary: '#0d9488',
            secondary: '#06b6d4'
        },
        professional: {
            name: 'Professional Gray',
            primary: '#374151',
            secondary: '#6b7280'
        },
        vibrant: {
            name: 'Vibrant Purple',
            primary: '#7c3aed',
            secondary: '#ec4899'
        },
        nature: {
            name: 'Nature Green',
            primary: '#059669',
            secondary: '#84cc16'
        },
        warm: {
            name: 'Warm Orange',
            primary: '#ea580c',
            secondary: '#f59e0b'
        },
        enterprise: {
            name: 'Enterprise Navy',
            primary: '#1e3a8a',
            secondary: '#3b82f6'
        }
    };

    res.json({
        success: true,
        data: presets
    });
});

module.exports = router;
