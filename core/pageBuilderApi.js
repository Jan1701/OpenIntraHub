/**
 * OpenIntraHub - Page Builder API Routes
 *
 * REST API für Page Builder System
 *
 * @author Jan Günther <jg@linxpress.de>
 * @license Apache-2.0
 */

const express = require('express');
const router = express.Router();

const pageService = require('./pageService');
const moduleRegistryService = require('./moduleRegistryService');
const { authenticateToken, requireAdmin, requirePermission } = require('./middleware');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('PageBuilderAPI');

// ==============================================
// PAGES ENDPOINTS
// ==============================================

/**
 * GET /api/pages
 * Liste alle Pages
 */
router.get('/pages', authenticateToken, async (req, res) => {
    try {
        const { status, is_public, search, limit, offset } = req.query;

        const filters = {
            status,
            is_public: is_public === 'true' ? true : is_public === 'false' ? false : undefined,
            search,
            limit: parseInt(limit) || 50,
            offset: parseInt(offset) || 0
        };

        const result = await pageService.listPages(filters);

        res.json({
            success: true,
            data: result.pages,
            pagination: {
                total: result.total,
                limit: result.limit,
                offset: result.offset,
                pages: Math.ceil(result.total / result.limit)
            }
        });
    } catch (error) {
        logger.error('Error listing pages', { error: error.message });
        res.status(500).json({
            success: false,
            message: req.t('errors:general.serverError'),
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/pages/:id
 * Einzelne Page mit Details
 */
router.get('/pages/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const includeDetails = req.query.details !== 'false';

        const page = await pageService.findPageById(parseInt(id), includeDetails);

        if (!page) {
            return res.status(404).json({
                success: false,
                message: req.t('errors:general.notFound')
            });
        }

        res.json({
            success: true,
            data: page
        });
    } catch (error) {
        logger.error('Error getting page', { error: error.message, pageId: req.params.id });
        res.status(500).json({
            success: false,
            message: req.t('errors:general.serverError')
        });
    }
});

/**
 * GET /api/pages/slug/:slug
 * Page nach Slug
 */
router.get('/pages/slug/:slug', async (req, res) => {
    try {
        const { slug } = req.params;

        const page = await pageService.findPageBySlug(slug, true);

        if (!page) {
            return res.status(404).json({
                success: false,
                message: req.t('errors:general.notFound')
            });
        }

        // Prüfe Sichtbarkeit
        if (!page.is_public && !req.user) {
            return res.status(401).json({
                success: false,
                message: req.t('auth:token.required')
            });
        }

        res.json({
            success: true,
            data: page
        });
    } catch (error) {
        logger.error('Error getting page by slug', { error: error.message, slug: req.params.slug });
        res.status(500).json({
            success: false,
            message: req.t('errors:general.serverError')
        });
    }
});

/**
 * GET /api/pages/homepage
 * Homepage abrufen
 */
router.get('/pages/homepage', async (req, res) => {
    try {
        const page = await pageService.getHomepage();

        if (!page) {
            return res.status(404).json({
                success: false,
                message: 'No homepage configured'
            });
        }

        res.json({
            success: true,
            data: page
        });
    } catch (error) {
        logger.error('Error getting homepage', { error: error.message });
        res.status(500).json({
            success: false,
            message: req.t('errors:general.serverError')
        });
    }
});

/**
 * POST /api/pages
 * Neue Page erstellen
 */
router.post('/pages', authenticateToken, requirePermission('content.create'), async (req, res) => {
    try {
        const page = await pageService.createPage(req.body, req.user.id);

        res.status(201).json({
            success: true,
            message: req.t('common:general.success'),
            data: page
        });
    } catch (error) {
        logger.error('Error creating page', { error: error.message, userId: req.user.id });

        if (error.code === '23505') { // Unique violation
            return res.status(409).json({
                success: false,
                message: 'Slug already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: req.t('errors:general.serverError')
        });
    }
});

/**
 * PUT /api/pages/:id
 * Page aktualisieren
 */
router.put('/pages/:id', authenticateToken, requirePermission('content.edit'), async (req, res) => {
    try {
        const { id } = req.params;

        const page = await pageService.updatePage(parseInt(id), req.body, req.user.id);

        if (!page) {
            return res.status(404).json({
                success: false,
                message: req.t('errors:general.notFound')
            });
        }

        res.json({
            success: true,
            message: req.t('common:general.success'),
            data: page
        });
    } catch (error) {
        logger.error('Error updating page', { error: error.message, pageId: req.params.id });
        res.status(500).json({
            success: false,
            message: req.t('errors:general.serverError')
        });
    }
});

/**
 * DELETE /api/pages/:id
 * Page löschen
 */
router.delete('/pages/:id', authenticateToken, requirePermission('content.delete'), async (req, res) => {
    try {
        const { id } = req.params;

        const deleted = await pageService.deletePage(parseInt(id), req.user.id);

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: req.t('errors:general.notFound')
            });
        }

        res.json({
            success: true,
            message: req.t('common:general.success')
        });
    } catch (error) {
        logger.error('Error deleting page', { error: error.message, pageId: req.params.id });
        res.status(500).json({
            success: false,
            message: req.t('errors:general.serverError')
        });
    }
});

// ==============================================
// PAGE SECTIONS ENDPOINTS
// ==============================================

/**
 * POST /api/pages/:id/sections
 * Neue Section erstellen
 */
router.post('/pages/:pageId/sections', authenticateToken, requirePermission('content.edit'), async (req, res) => {
    try {
        const { pageId } = req.params;

        const sectionData = {
            ...req.body,
            page_id: parseInt(pageId)
        };

        const section = await pageService.createSection(sectionData);

        res.status(201).json({
            success: true,
            message: req.t('common:general.success'),
            data: section
        });
    } catch (error) {
        logger.error('Error creating section', { error: error.message, pageId: req.params.pageId });
        res.status(500).json({
            success: false,
            message: req.t('errors:general.serverError')
        });
    }
});

/**
 * PUT /api/sections/:id
 * Section aktualisieren
 */
router.put('/sections/:id', authenticateToken, requirePermission('content.edit'), async (req, res) => {
    try {
        const { id } = req.params;

        const section = await pageService.updateSection(parseInt(id), req.body);

        if (!section) {
            return res.status(404).json({
                success: false,
                message: req.t('errors:general.notFound')
            });
        }

        res.json({
            success: true,
            message: req.t('common:general.success'),
            data: section
        });
    } catch (error) {
        logger.error('Error updating section', { error: error.message, sectionId: req.params.id });
        res.status(500).json({
            success: false,
            message: req.t('errors:general.serverError')
        });
    }
});

/**
 * DELETE /api/sections/:id
 * Section löschen
 */
router.delete('/sections/:id', authenticateToken, requirePermission('content.delete'), async (req, res) => {
    try {
        const { id } = req.params;

        const deleted = await pageService.deleteSection(parseInt(id));

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: req.t('errors:general.notFound')
            });
        }

        res.json({
            success: true,
            message: req.t('common:general.success')
        });
    } catch (error) {
        logger.error('Error deleting section', { error: error.message, sectionId: req.params.id });
        res.status(500).json({
            success: false,
            message: req.t('errors:general.serverError')
        });
    }
});

// ==============================================
// PAGE MODULES ENDPOINTS
// ==============================================

/**
 * POST /api/sections/:sectionId/modules
 * Modul zu Section hinzufügen
 */
router.post('/sections/:sectionId/modules', authenticateToken, requirePermission('content.edit'), async (req, res) => {
    try {
        const { sectionId } = req.params;

        const moduleData = {
            ...req.body,
            section_id: parseInt(sectionId)
        };

        const module = await pageService.addModuleToSection(moduleData);

        res.status(201).json({
            success: true,
            message: req.t('common:general.success'),
            data: module
        });
    } catch (error) {
        logger.error('Error adding module to section', { error: error.message, sectionId: req.params.sectionId });
        res.status(500).json({
            success: false,
            message: req.t('errors:general.serverError')
        });
    }
});

/**
 * PUT /api/page-modules/:id
 * Page Module aktualisieren
 */
router.put('/page-modules/:id', authenticateToken, requirePermission('content.edit'), async (req, res) => {
    try {
        const { id } = req.params;

        const module = await pageService.updatePageModule(parseInt(id), req.body);

        if (!module) {
            return res.status(404).json({
                success: false,
                message: req.t('errors:general.notFound')
            });
        }

        res.json({
            success: true,
            message: req.t('common:general.success'),
            data: module
        });
    } catch (error) {
        logger.error('Error updating page module', { error: error.message, moduleId: req.params.id });
        res.status(500).json({
            success: false,
            message: req.t('errors:general.serverError')
        });
    }
});

/**
 * DELETE /api/page-modules/:id
 * Page Module löschen
 */
router.delete('/page-modules/:id', authenticateToken, requirePermission('content.delete'), async (req, res) => {
    try {
        const { id } = req.params;

        const deleted = await pageService.deletePageModule(parseInt(id));

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: req.t('errors:general.notFound')
            });
        }

        res.json({
            success: true,
            message: req.t('common:general.success')
        });
    } catch (error) {
        logger.error('Error deleting page module', { error: error.message, moduleId: req.params.id });
        res.status(500).json({
            success: false,
            message: req.t('errors:general.serverError')
        });
    }
});

// ==============================================
// MODULE REGISTRY ENDPOINTS
// ==============================================

/**
 * GET /api/modules
 * Liste aller verfügbaren Module
 */
router.get('/modules', authenticateToken, async (req, res) => {
    try {
        const { type, category, search } = req.query;

        const filters = {
            type,
            category,
            search,
            is_active: true
        };

        const modules = await moduleRegistryService.listModules(filters);

        res.json({
            success: true,
            data: modules
        });
    } catch (error) {
        logger.error('Error listing modules', { error: error.message });
        res.status(500).json({
            success: false,
            message: req.t('errors:general.serverError')
        });
    }
});

/**
 * GET /api/modules/by-category
 * Module gruppiert nach Kategorie
 */
router.get('/modules/by-category', authenticateToken, async (req, res) => {
    try {
        const grouped = await moduleRegistryService.getModulesByCategory(true);

        res.json({
            success: true,
            data: grouped
        });
    } catch (error) {
        logger.error('Error getting modules by category', { error: error.message });
        res.status(500).json({
            success: false,
            message: req.t('errors:general.serverError')
        });
    }
});

/**
 * GET /api/modules/:id
 * Modul Details
 */
router.get('/modules/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const module = await moduleRegistryService.findModuleById(parseInt(id));

        if (!module) {
            return res.status(404).json({
                success: false,
                message: req.t('errors:general.notFound')
            });
        }

        // Usage count hinzufügen
        const usageCount = await moduleRegistryService.countModuleUsage(parseInt(id));
        module.usage_count = usageCount;

        res.json({
            success: true,
            data: module
        });
    } catch (error) {
        logger.error('Error getting module', { error: error.message, moduleId: req.params.id });
        res.status(500).json({
            success: false,
            message: req.t('errors:general.serverError')
        });
    }
});

/**
 * POST /api/modules
 * Neues Modul registrieren (Admin only)
 */
router.post('/modules', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const module = await moduleRegistryService.registerModule(req.body);

        res.status(201).json({
            success: true,
            message: 'Module registered successfully',
            data: module
        });
    } catch (error) {
        logger.error('Error registering module', { error: error.message });

        if (error.code === '23505') { // Unique violation
            return res.status(409).json({
                success: false,
                message: 'Module name already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: req.t('errors:general.serverError')
        });
    }
});

/**
 * PUT /api/modules/:id
 * Modul aktualisieren (Admin only)
 */
router.put('/modules/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const module = await moduleRegistryService.updateModule(parseInt(id), req.body);

        if (!module) {
            return res.status(404).json({
                success: false,
                message: req.t('errors:general.notFound')
            });
        }

        res.json({
            success: true,
            message: 'Module updated successfully',
            data: module
        });
    } catch (error) {
        logger.error('Error updating module', { error: error.message, moduleId: req.params.id });
        res.status(500).json({
            success: false,
            message: req.t('errors:general.serverError')
        });
    }
});

/**
 * DELETE /api/modules/:id
 * Modul löschen (Admin only, keine System-Module)
 */
router.delete('/modules/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const deleted = await moduleRegistryService.deleteModule(parseInt(id));

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'Module not found or is a system module'
            });
        }

        res.json({
            success: true,
            message: 'Module deleted successfully'
        });
    } catch (error) {
        logger.error('Error deleting module', { error: error.message, moduleId: req.params.id });

        if (error.message === 'System modules cannot be deleted') {
            return res.status(403).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: req.t('errors:general.serverError')
        });
    }
});

/**
 * PATCH /api/modules/:id/toggle
 * Modul aktivieren/deaktivieren (Admin only)
 */
router.patch('/modules/:id/toggle', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;

        if (typeof is_active !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'is_active must be a boolean'
            });
        }

        const module = await moduleRegistryService.toggleModuleActive(parseInt(id), is_active);

        if (!module) {
            return res.status(404).json({
                success: false,
                message: req.t('errors:general.notFound')
            });
        }

        res.json({
            success: true,
            message: `Module ${is_active ? 'activated' : 'deactivated'} successfully`,
            data: module
        });
    } catch (error) {
        logger.error('Error toggling module', { error: error.message, moduleId: req.params.id });
        res.status(500).json({
            success: false,
            message: req.t('errors:general.serverError')
        });
    }
});

module.exports = router;
