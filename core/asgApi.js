/**
 * ASG API - Arbeitssicherheits- & Gesundheitskontrolle
 * REST API fuer Sicherheitskontrollen, Maengel und Massnahmen
 * Author: Jan Guenther <jg@linxpress.de>
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const asgService = require('./asgService');
const { authenticateToken, requirePermission } = require('./middleware');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('ASG-API');

// ==============================================
// FILE UPLOAD CONFIG
// ==============================================

const UPLOAD_DIR = path.join(__dirname, '../uploads/asg');

// Ensure upload directory exists
(async () => {
    try {
        await fs.mkdir(UPLOAD_DIR, { recursive: true });
    } catch (error) {
        logger.error('Failed to create ASG upload directory:', error);
    }
})();

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Ungueltiger Dateityp'));
        }
    }
});

// ==============================================
// CHECKLISTS
// ==============================================

/**
 * GET /api/asg/checklists
 * List all checklists
 */
router.get('/asg/checklists', authenticateToken, requirePermission('asg.view'), async (req, res) => {
    try {
        const { category, is_active } = req.query;
        const checklists = await asgService.checklists.getAll({
            category,
            is_active: is_active !== undefined ? is_active === 'true' : undefined
        });

        res.json({ success: true, data: checklists });
    } catch (error) {
        logger.error('Error fetching checklists:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Laden der Prueflisten' });
    }
});

/**
 * GET /api/asg/checklists/:id
 * Get single checklist
 */
router.get('/asg/checklists/:id', authenticateToken, requirePermission('asg.view'), async (req, res) => {
    try {
        const checklist = await asgService.checklists.getById(req.params.id);
        if (!checklist) {
            return res.status(404).json({ success: false, message: 'Pruefliste nicht gefunden' });
        }
        res.json({ success: true, data: checklist });
    } catch (error) {
        logger.error('Error fetching checklist:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Laden der Pruefliste' });
    }
});

/**
 * POST /api/asg/checklists
 * Create new checklist
 */
router.post('/asg/checklists', authenticateToken, requirePermission('asg.manage_checklists'), async (req, res) => {
    try {
        const checklist = await asgService.checklists.create(req.body, req.user.id);
        res.status(201).json({ success: true, data: checklist });
    } catch (error) {
        logger.error('Error creating checklist:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Erstellen der Pruefliste' });
    }
});

/**
 * PUT /api/asg/checklists/:id
 * Update checklist
 */
router.put('/asg/checklists/:id', authenticateToken, requirePermission('asg.manage_checklists'), async (req, res) => {
    try {
        const checklist = await asgService.checklists.update(req.params.id, req.body);
        res.json({ success: true, data: checklist });
    } catch (error) {
        logger.error('Error updating checklist:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Aktualisieren der Pruefliste' });
    }
});

/**
 * DELETE /api/asg/checklists/:id
 * Delete checklist
 */
router.delete('/asg/checklists/:id', authenticateToken, requirePermission('asg.manage_checklists'), async (req, res) => {
    try {
        await asgService.checklists.delete(req.params.id);
        res.json({ success: true, message: 'Pruefliste geloescht' });
    } catch (error) {
        logger.error('Error deleting checklist:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Loeschen der Pruefliste' });
    }
});

// ==============================================
// INSPECTIONS
// ==============================================

/**
 * GET /api/asg/inspections
 * List inspections with filters
 */
router.get('/asg/inspections', authenticateToken, requirePermission('asg.view'), async (req, res) => {
    try {
        const { location_id, inspector_id, status, from_date, to_date, limit } = req.query;
        const inspections = await asgService.inspections.getAll({
            location_id,
            inspector_id,
            status,
            from_date,
            to_date,
            limit: limit ? parseInt(limit) : undefined
        });

        res.json({ success: true, data: inspections });
    } catch (error) {
        logger.error('Error fetching inspections:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Laden der Kontrollen' });
    }
});

/**
 * GET /api/asg/inspections/:id
 * Get single inspection with details
 */
router.get('/asg/inspections/:id', authenticateToken, requirePermission('asg.view'), async (req, res) => {
    try {
        const inspection = await asgService.inspections.getById(req.params.id);
        if (!inspection) {
            return res.status(404).json({ success: false, message: 'Kontrolle nicht gefunden' });
        }

        // Also get defects
        const defects = await asgService.defects.getByInspection(req.params.id);

        res.json({
            success: true,
            data: { ...inspection, defects }
        });
    } catch (error) {
        logger.error('Error fetching inspection:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Laden der Kontrolle' });
    }
});

/**
 * POST /api/asg/inspections
 * Create new inspection
 */
router.post('/asg/inspections', authenticateToken, requirePermission('asg.create'), async (req, res) => {
    try {
        const inspection = await asgService.inspections.create(req.body, req.user.id);
        res.status(201).json({ success: true, data: inspection });
    } catch (error) {
        logger.error('Error creating inspection:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Erstellen der Kontrolle' });
    }
});

/**
 * PUT /api/asg/inspections/:id
 * Update inspection
 */
router.put('/asg/inspections/:id', authenticateToken, requirePermission('asg.edit'), async (req, res) => {
    try {
        const inspection = await asgService.inspections.update(req.params.id, req.body, req.user.id);
        res.json({ success: true, data: inspection });
    } catch (error) {
        logger.error('Error updating inspection:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Aktualisieren der Kontrolle' });
    }
});

/**
 * POST /api/asg/inspections/:id/sign
 * Sign inspection (inspector or supervisor)
 */
router.post('/asg/inspections/:id/sign', authenticateToken, requirePermission('asg.sign'), async (req, res) => {
    try {
        const { type, signature } = req.body; // type: 'inspector' or 'supervisor'

        if (!['inspector', 'supervisor'].includes(type)) {
            return res.status(400).json({ success: false, message: 'Ungueltiger Signaturtyp' });
        }

        const inspection = await asgService.inspections.sign(req.params.id, type, signature, req.user.id);
        res.json({ success: true, data: inspection });
    } catch (error) {
        logger.error('Error signing inspection:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Unterschreiben' });
    }
});

/**
 * POST /api/asg/inspections/:id/complete
 * Complete inspection
 */
router.post('/asg/inspections/:id/complete', authenticateToken, requirePermission('asg.edit'), async (req, res) => {
    try {
        const inspection = await asgService.inspections.complete(req.params.id, req.user.id);
        res.json({ success: true, data: inspection });
    } catch (error) {
        logger.error('Error completing inspection:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Abschliessen' });
    }
});

/**
 * DELETE /api/asg/inspections/:id
 * Delete inspection
 */
router.delete('/asg/inspections/:id', authenticateToken, requirePermission('asg.delete'), async (req, res) => {
    try {
        await asgService.inspections.delete(req.params.id, req.user.id);
        res.json({ success: true, message: 'Kontrolle geloescht' });
    } catch (error) {
        logger.error('Error deleting inspection:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Loeschen' });
    }
});

// ==============================================
// DEFECTS
// ==============================================

/**
 * GET /api/asg/defects
 * List open defects (across all inspections)
 */
router.get('/asg/defects', authenticateToken, requirePermission('asg.view'), async (req, res) => {
    try {
        const { responsible_user_id, location_id, danger_level, overdue } = req.query;
        const defects = await asgService.defects.getOpenDefects({
            responsible_user_id,
            location_id,
            danger_level,
            overdue: overdue === 'true'
        });

        res.json({ success: true, data: defects });
    } catch (error) {
        logger.error('Error fetching defects:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Laden der Maengel' });
    }
});

/**
 * GET /api/asg/defects/:id
 * Get single defect with details
 */
router.get('/asg/defects/:id', authenticateToken, requirePermission('asg.view'), async (req, res) => {
    try {
        const defect = await asgService.defects.getById(req.params.id);
        if (!defect) {
            return res.status(404).json({ success: false, message: 'Mangel nicht gefunden' });
        }

        // Also get actions and comments
        const [actions, comments] = await Promise.all([
            asgService.actions.getByDefect(req.params.id),
            asgService.comments.getByEntity('defect', req.params.id)
        ]);

        res.json({
            success: true,
            data: { ...defect, actions, comments }
        });
    } catch (error) {
        logger.error('Error fetching defect:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Laden des Mangels' });
    }
});

/**
 * POST /api/asg/inspections/:inspectionId/defects
 * Create defect for inspection
 */
router.post('/asg/inspections/:inspectionId/defects', authenticateToken, requirePermission('asg.create'), async (req, res) => {
    try {
        const defect = await asgService.defects.create({
            ...req.body,
            inspection_id: parseInt(req.params.inspectionId)
        }, req.user.id);

        res.status(201).json({ success: true, data: defect });
    } catch (error) {
        logger.error('Error creating defect:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Erstellen des Mangels' });
    }
});

/**
 * PUT /api/asg/defects/:id
 * Update defect
 */
router.put('/asg/defects/:id', authenticateToken, requirePermission('asg.edit'), async (req, res) => {
    try {
        const defect = await asgService.defects.update(req.params.id, req.body, req.user.id);
        res.json({ success: true, data: defect });
    } catch (error) {
        logger.error('Error updating defect:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Aktualisieren des Mangels' });
    }
});

/**
 * POST /api/asg/defects/:id/assign
 * Assign defect to user with deadline
 */
router.post('/asg/defects/:id/assign', authenticateToken, requirePermission('asg.edit'), async (req, res) => {
    try {
        const { responsible_user_id, deadline } = req.body;
        const defect = await asgService.defects.assign(
            req.params.id,
            responsible_user_id,
            deadline,
            req.user.id
        );
        res.json({ success: true, data: defect });
    } catch (error) {
        logger.error('Error assigning defect:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Zuweisen des Mangels' });
    }
});

/**
 * POST /api/asg/defects/:id/resolve
 * Mark defect as resolved
 */
router.post('/asg/defects/:id/resolve', authenticateToken, requirePermission('asg.edit'), async (req, res) => {
    try {
        const { signature, notes, photos } = req.body;
        const defect = await asgService.defects.resolve(req.params.id, {
            signature,
            notes,
            photos
        }, req.user.id);

        res.json({ success: true, data: defect });
    } catch (error) {
        logger.error('Error resolving defect:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Erledigen des Mangels' });
    }
});

/**
 * POST /api/asg/defects/:id/verify
 * Verify defect resolution
 */
router.post('/asg/defects/:id/verify', authenticateToken, requirePermission('asg.sign'), async (req, res) => {
    try {
        const { signature, notes } = req.body;
        const defect = await asgService.defects.verify(req.params.id, {
            signature,
            notes
        }, req.user.id);

        res.json({ success: true, data: defect });
    } catch (error) {
        logger.error('Error verifying defect:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Verifizieren' });
    }
});

/**
 * POST /api/asg/defects/:id/escalate
 * Escalate defect
 */
router.post('/asg/defects/:id/escalate', authenticateToken, requirePermission('asg.edit'), async (req, res) => {
    try {
        const defect = await asgService.defects.escalate(req.params.id, req.user.id);
        res.json({ success: true, data: defect });
    } catch (error) {
        logger.error('Error escalating defect:', error);
        res.status(500).json({ success: false, message: 'Fehler bei der Eskalation' });
    }
});

/**
 * POST /api/asg/defects/:id/photos
 * Upload photo for defect
 */
router.post('/asg/defects/:id/photos', authenticateToken, requirePermission('asg.edit'), upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Keine Datei hochgeladen' });
        }

        const photoUrl = `/uploads/asg/${req.file.filename}`;
        const defect = await asgService.defects.addPhoto(req.params.id, {
            url: photoUrl,
            caption: req.body.caption || ''
        }, req.user.id);

        res.json({
            success: true,
            data: defect,
            photo: { url: photoUrl, filename: req.file.filename }
        });
    } catch (error) {
        logger.error('Error uploading photo:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Hochladen des Fotos' });
    }
});

// ==============================================
// ACTIONS
// ==============================================

/**
 * POST /api/asg/defects/:defectId/actions
 * Create action for defect
 */
router.post('/asg/defects/:defectId/actions', authenticateToken, requirePermission('asg.create'), async (req, res) => {
    try {
        const action = await asgService.actions.create({
            ...req.body,
            defect_id: parseInt(req.params.defectId)
        }, req.user.id);

        res.status(201).json({ success: true, data: action });
    } catch (error) {
        logger.error('Error creating action:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Erstellen der Massnahme' });
    }
});

/**
 * PUT /api/asg/actions/:id
 * Update action
 */
router.put('/asg/actions/:id', authenticateToken, requirePermission('asg.edit'), async (req, res) => {
    try {
        const action = await asgService.actions.update(req.params.id, req.body, req.user.id);
        res.json({ success: true, data: action });
    } catch (error) {
        logger.error('Error updating action:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Aktualisieren der Massnahme' });
    }
});

/**
 * POST /api/asg/actions/:id/complete
 * Complete action
 */
router.post('/asg/actions/:id/complete', authenticateToken, requirePermission('asg.edit'), async (req, res) => {
    try {
        const action = await asgService.actions.complete(req.params.id, req.user.id);
        res.json({ success: true, data: action });
    } catch (error) {
        logger.error('Error completing action:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Abschliessen der Massnahme' });
    }
});

// ==============================================
// COMMENTS
// ==============================================

/**
 * GET /api/asg/:entityType/:entityId/comments
 * Get comments for entity
 */
router.get('/asg/:entityType/:entityId/comments', authenticateToken, requirePermission('asg.view'), async (req, res) => {
    try {
        const { entityType, entityId } = req.params;
        if (!['inspection', 'defect', 'action'].includes(entityType)) {
            return res.status(400).json({ success: false, message: 'Ungueltiger Entity-Typ' });
        }

        const comments = await asgService.comments.getByEntity(entityType, entityId);
        res.json({ success: true, data: comments });
    } catch (error) {
        logger.error('Error fetching comments:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Laden der Kommentare' });
    }
});

/**
 * POST /api/asg/:entityType/:entityId/comments
 * Add comment to entity
 */
router.post('/asg/:entityType/:entityId/comments', authenticateToken, requirePermission('asg.view'), async (req, res) => {
    try {
        const { entityType, entityId } = req.params;
        if (!['inspection', 'defect', 'action'].includes(entityType)) {
            return res.status(400).json({ success: false, message: 'Ungueltiger Entity-Typ' });
        }

        const comment = await asgService.comments.create({
            entity_type: entityType,
            entity_id: parseInt(entityId),
            ...req.body
        }, req.user.id);

        res.status(201).json({ success: true, data: comment });
    } catch (error) {
        logger.error('Error creating comment:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Erstellen des Kommentars' });
    }
});

// ==============================================
// STATISTICS & DASHBOARD
// ==============================================

/**
 * GET /api/asg/statistics
 * Get ASG dashboard statistics
 */
router.get('/asg/statistics', authenticateToken, requirePermission('asg.view'), async (req, res) => {
    try {
        const { location_id } = req.query;
        const stats = await asgService.statistics.getDashboard(location_id);
        res.json({ success: true, data: stats });
    } catch (error) {
        logger.error('Error fetching statistics:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Laden der Statistiken' });
    }
});

/**
 * GET /api/asg/statistics/categories
 * Get defects by category
 */
router.get('/asg/statistics/categories', authenticateToken, requirePermission('asg.view'), async (req, res) => {
    try {
        const { location_id } = req.query;
        const data = await asgService.statistics.getDefectsByCategory(location_id);
        res.json({ success: true, data });
    } catch (error) {
        logger.error('Error fetching category statistics:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Laden der Kategoriestatistiken' });
    }
});

/**
 * GET /api/asg/my-tasks
 * Get defects assigned to current user
 */
router.get('/asg/my-tasks', authenticateToken, async (req, res) => {
    try {
        const defects = await asgService.defects.getOpenDefects({
            responsible_user_id: req.user.id
        });
        res.json({ success: true, data: defects });
    } catch (error) {
        logger.error('Error fetching user tasks:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Laden der Aufgaben' });
    }
});

module.exports = router;
