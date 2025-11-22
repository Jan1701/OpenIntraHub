/**
 * Fire Safety API - Brandschutz- & Sicherheitsmanagement
 * REST API fuer alle 5 Brandschutz-Checklisten
 * Author: Jan Guenther <jg@linxpress.de>
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const firesafetyService = require('./firesafetyService');
const { authenticateToken, requirePermission } = require('./middleware');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('BSM-API');

// Upload config
const UPLOAD_DIR = path.join(__dirname, '../uploads/bsm');
(async () => { try { await fs.mkdir(UPLOAD_DIR, { recursive: true }); } catch (e) {} })();

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ==============================================
// OBJECTS
// ==============================================

router.get('/bsm/objects', authenticateToken, requirePermission('bsm.view'), async (req, res) => {
    try {
        const objects = await firesafetyService.objects.getAll(req.query.location_id);
        res.json({ success: true, data: objects });
    } catch (error) {
        logger.error('Error fetching objects:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Laden der Objekte' });
    }
});

router.get('/bsm/objects/:id', authenticateToken, requirePermission('bsm.view'), async (req, res) => {
    try {
        const object = await firesafetyService.objects.getById(req.params.id);
        if (!object) return res.status(404).json({ success: false, message: 'Objekt nicht gefunden' });
        res.json({ success: true, data: object });
    } catch (error) {
        logger.error('Error fetching object:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Laden' });
    }
});

router.post('/bsm/objects', authenticateToken, requirePermission('bsm.manage_objects'), async (req, res) => {
    try {
        const object = await firesafetyService.objects.create(req.body, req.user.id);
        res.status(201).json({ success: true, data: object });
    } catch (error) {
        logger.error('Error creating object:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Erstellen' });
    }
});

router.put('/bsm/objects/:id', authenticateToken, requirePermission('bsm.manage_objects'), async (req, res) => {
    try {
        const object = await firesafetyService.objects.update(req.params.id, req.body, req.user.id);
        res.json({ success: true, data: object });
    } catch (error) {
        logger.error('Error updating object:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Aktualisieren' });
    }
});

router.delete('/bsm/objects/:id', authenticateToken, requirePermission('bsm.manage_objects'), async (req, res) => {
    try {
        await firesafetyService.objects.delete(req.params.id, req.user.id);
        res.json({ success: true, message: 'Objekt deaktiviert' });
    } catch (error) {
        logger.error('Error deleting object:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Loeschen' });
    }
});

// ==============================================
// CHECKLISTS - GENERIC HANDLER
// ==============================================

const checklistTypes = {
    ordnung: firesafetyService.ordnung,
    infrastruktur: firesafetyService.infrastruktur,
    fluchtwege: firesafetyService.fluchtwege,
    baulich: firesafetyService.baulich,
    betrieblich: firesafetyService.betrieblich
};

// Get all checks for an object by type
router.get('/bsm/objects/:objectId/checks/:type', authenticateToken, requirePermission('bsm.view'), async (req, res) => {
    try {
        const service = checklistTypes[req.params.type];
        if (!service) return res.status(400).json({ success: false, message: 'Ungueltiger Checklistentyp' });
        const checks = await service.getByObject(req.params.objectId);
        res.json({ success: true, data: checks });
    } catch (error) {
        logger.error('Error fetching checks:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Laden' });
    }
});

// Get single check by type
router.get('/bsm/checks/:type/:id', authenticateToken, requirePermission('bsm.view'), async (req, res) => {
    try {
        const service = checklistTypes[req.params.type];
        if (!service) return res.status(400).json({ success: false, message: 'Ungueltiger Checklistentyp' });
        const check = await service.getById(req.params.id);
        if (!check) return res.status(404).json({ success: false, message: 'Nicht gefunden' });
        res.json({ success: true, data: check });
    } catch (error) {
        logger.error('Error fetching check:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Laden' });
    }
});

// Create check
router.post('/bsm/objects/:objectId/checks/:type', authenticateToken, requirePermission('bsm.create'), async (req, res) => {
    try {
        const service = checklistTypes[req.params.type];
        if (!service) return res.status(400).json({ success: false, message: 'Ungueltiger Checklistentyp' });
        const check = await service.create({ ...req.body, object_id: parseInt(req.params.objectId) }, req.user.id);
        res.status(201).json({ success: true, data: check });
    } catch (error) {
        logger.error('Error creating check:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Erstellen' });
    }
});

// Sign check
router.post('/bsm/checks/:type/:id/sign', authenticateToken, requirePermission('bsm.sign'), async (req, res) => {
    try {
        const service = checklistTypes[req.params.type];
        if (!service) return res.status(400).json({ success: false, message: 'Ungueltiger Checklistentyp' });
        const check = await service.sign(req.params.id, req.body.signature, req.user.id);
        res.json({ success: true, data: check });
    } catch (error) {
        logger.error('Error signing check:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Unterschreiben' });
    }
});

// ==============================================
// DEFECTS
// ==============================================

router.get('/bsm/defects', authenticateToken, requirePermission('bsm.view'), async (req, res) => {
    try {
        const { object_id, status, priority, checklist_type } = req.query;
        const defects = await firesafetyService.defects.getAll({ object_id, status, priority, checklist_type });
        res.json({ success: true, data: defects });
    } catch (error) {
        logger.error('Error fetching defects:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Laden der Maengel' });
    }
});

router.get('/bsm/defects/:id', authenticateToken, requirePermission('bsm.view'), async (req, res) => {
    try {
        const defect = await firesafetyService.defects.getById(req.params.id);
        if (!defect) return res.status(404).json({ success: false, message: 'Mangel nicht gefunden' });
        res.json({ success: true, data: defect });
    } catch (error) {
        logger.error('Error fetching defect:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Laden' });
    }
});

router.post('/bsm/defects', authenticateToken, requirePermission('bsm.create'), upload.array('photos', 5), async (req, res) => {
    try {
        const photos = req.files ? req.files.map(f => `/uploads/bsm/${f.filename}`) : [];
        const defect = await firesafetyService.defects.create({ ...req.body, photos }, req.user.id);
        res.status(201).json({ success: true, data: defect });
    } catch (error) {
        logger.error('Error creating defect:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Erstellen' });
    }
});

router.post('/bsm/defects/:id/assign', authenticateToken, requirePermission('bsm.edit'), async (req, res) => {
    try {
        const defect = await firesafetyService.defects.assign(req.params.id, req.body.responsible_user_id, req.body.due_date, req.user.id);
        res.json({ success: true, data: defect });
    } catch (error) {
        logger.error('Error assigning defect:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Zuweisen' });
    }
});

router.post('/bsm/defects/:id/escalate', authenticateToken, requirePermission('bsm.escalate'), async (req, res) => {
    try {
        const defect = await firesafetyService.defects.escalate(req.params.id, req.body.escalate_to_id, req.user.id);
        res.json({ success: true, data: defect });
    } catch (error) {
        logger.error('Error escalating defect:', error);
        res.status(500).json({ success: false, message: 'Fehler bei der Eskalation' });
    }
});

router.post('/bsm/defects/:id/resolve', authenticateToken, requirePermission('bsm.edit'), upload.array('photos', 5), async (req, res) => {
    try {
        const photos = req.files ? req.files.map(f => `/uploads/bsm/${f.filename}`) : [];
        const defect = await firesafetyService.defects.resolve(req.params.id, { ...req.body, photos }, req.user.id);
        res.json({ success: true, data: defect });
    } catch (error) {
        logger.error('Error resolving defect:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Beheben' });
    }
});

router.post('/bsm/defects/:id/verify', authenticateToken, requirePermission('bsm.sign'), async (req, res) => {
    try {
        const defect = await firesafetyService.defects.verify(req.params.id, req.body.signature, req.user.id);
        res.json({ success: true, data: defect });
    } catch (error) {
        logger.error('Error verifying defect:', error);
        res.status(500).json({ success: false, message: 'Fehler bei der Verifizierung' });
    }
});

// ==============================================
// TRAININGS
// ==============================================

router.get('/bsm/trainings', authenticateToken, requirePermission('bsm.view'), async (req, res) => {
    try {
        const trainings = await firesafetyService.trainings.getAll(req.query.object_id);
        res.json({ success: true, data: trainings });
    } catch (error) {
        logger.error('Error fetching trainings:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Laden der Schulungen' });
    }
});

router.post('/bsm/trainings', authenticateToken, requirePermission('bsm.manage_trainings'), async (req, res) => {
    try {
        const training = await firesafetyService.trainings.create(req.body, req.user.id);
        res.status(201).json({ success: true, data: training });
    } catch (error) {
        logger.error('Error creating training:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Erstellen' });
    }
});

router.post('/bsm/trainings/:id/complete', authenticateToken, requirePermission('bsm.manage_trainings'), upload.array('photos', 5), async (req, res) => {
    try {
        const photos = req.files ? req.files.map(f => `/uploads/bsm/${f.filename}`) : [];
        const training = await firesafetyService.trainings.complete(req.params.id, { ...req.body, photos }, req.user.id);
        res.json({ success: true, data: training });
    } catch (error) {
        logger.error('Error completing training:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Abschliessen' });
    }
});

// ==============================================
// MAINTENANCE
// ==============================================

router.get('/bsm/maintenance', authenticateToken, requirePermission('bsm.view'), async (req, res) => {
    try {
        const maintenance = await firesafetyService.maintenance.getAll(req.query.object_id);
        res.json({ success: true, data: maintenance });
    } catch (error) {
        logger.error('Error fetching maintenance:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Laden der Wartungen' });
    }
});

router.post('/bsm/maintenance', authenticateToken, requirePermission('bsm.manage_maintenance'), async (req, res) => {
    try {
        const item = await firesafetyService.maintenance.create(req.body, req.user.id);
        res.status(201).json({ success: true, data: item });
    } catch (error) {
        logger.error('Error creating maintenance:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Erstellen' });
    }
});

router.post('/bsm/maintenance/:id/inspection', authenticateToken, requirePermission('bsm.edit'), async (req, res) => {
    try {
        const item = await firesafetyService.maintenance.recordInspection(req.params.id, req.body, req.user.id);
        res.json({ success: true, data: item });
    } catch (error) {
        logger.error('Error recording inspection:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Erfassen' });
    }
});

// ==============================================
// STATISTICS
// ==============================================

router.get('/bsm/statistics', authenticateToken, requirePermission('bsm.view'), async (req, res) => {
    try {
        const stats = await firesafetyService.statistics.getDashboard(req.query.object_id);
        res.json({ success: true, data: stats });
    } catch (error) {
        logger.error('Error fetching statistics:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Laden der Statistiken' });
    }
});

router.get('/bsm/objects/:id/status', authenticateToken, requirePermission('bsm.view'), async (req, res) => {
    try {
        const status = await firesafetyService.statistics.getObjectStatus(req.params.id);
        res.json({ success: true, data: status });
    } catch (error) {
        logger.error('Error fetching object status:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Laden' });
    }
});

module.exports = router;
