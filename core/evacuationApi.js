/**
 * Evacuation API - Evakuierungs- & Fluchtweg-Management
 * REST API fuer Evakuierungen, Fluchtwege und Uebungen
 * Author: Jan Guenther <jg@linxpress.de>
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const evacuationService = require('./evacuationService');
const { authenticateToken, requirePermission } = require('./middleware');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('EVA-API');

// Upload config
const UPLOAD_DIR = path.join(__dirname, '../uploads/eva');
(async () => { try { await fs.mkdir(UPLOAD_DIR, { recursive: true }); } catch (e) {} })();

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ==============================================
// BUILDINGS
// ==============================================

router.get('/eva/buildings', authenticateToken, requirePermission('eva.view'), async (req, res) => {
    try {
        const buildings = await evacuationService.buildings.getAll(req.query.location_id);
        res.json({ success: true, data: buildings });
    } catch (error) {
        logger.error('Error fetching buildings:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Laden der Gebaeude' });
    }
});

router.get('/eva/buildings/:id', authenticateToken, requirePermission('eva.view'), async (req, res) => {
    try {
        const building = await evacuationService.buildings.getById(req.params.id);
        if (!building) return res.status(404).json({ success: false, message: 'Gebaeude nicht gefunden' });
        res.json({ success: true, data: building });
    } catch (error) {
        logger.error('Error fetching building:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Laden' });
    }
});

router.post('/eva/buildings', authenticateToken, requirePermission('eva.manage_buildings'), async (req, res) => {
    try {
        const building = await evacuationService.buildings.create(req.body, req.user.id);
        res.status(201).json({ success: true, data: building });
    } catch (error) {
        logger.error('Error creating building:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Erstellen' });
    }
});

router.put('/eva/buildings/:id', authenticateToken, requirePermission('eva.manage_buildings'), async (req, res) => {
    try {
        const building = await evacuationService.buildings.update(req.params.id, req.body, req.user.id);
        res.json({ success: true, data: building });
    } catch (error) {
        logger.error('Error updating building:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Aktualisieren' });
    }
});

router.delete('/eva/buildings/:id', authenticateToken, requirePermission('eva.manage_buildings'), async (req, res) => {
    try {
        await evacuationService.buildings.delete(req.params.id, req.user.id);
        res.json({ success: true, message: 'Gebaeude deaktiviert' });
    } catch (error) {
        logger.error('Error deleting building:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Loeschen' });
    }
});

// ==============================================
// ORGANIZATIONAL MEASURES
// ==============================================

router.get('/eva/buildings/:buildingId/organizational', authenticateToken, requirePermission('eva.view'), async (req, res) => {
    try {
        const measures = await evacuationService.organizational.getByBuilding(req.params.buildingId);
        res.json({ success: true, data: measures });
    } catch (error) {
        logger.error('Error:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Laden' });
    }
});

router.get('/eva/organizational/:id', authenticateToken, requirePermission('eva.view'), async (req, res) => {
    try {
        const measure = await evacuationService.organizational.getById(req.params.id);
        if (!measure) return res.status(404).json({ success: false, message: 'Nicht gefunden' });
        res.json({ success: true, data: measure });
    } catch (error) {
        logger.error('Error:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Laden' });
    }
});

router.post('/eva/buildings/:buildingId/organizational', authenticateToken, requirePermission('eva.create'), async (req, res) => {
    try {
        const measure = await evacuationService.organizational.create(
            { ...req.body, building_id: parseInt(req.params.buildingId) },
            req.user.id
        );
        res.status(201).json({ success: true, data: measure });
    } catch (error) {
        logger.error('Error:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Erstellen' });
    }
});

router.put('/eva/organizational/:id', authenticateToken, requirePermission('eva.edit'), async (req, res) => {
    try {
        const measure = await evacuationService.organizational.update(req.params.id, req.body, req.user.id);
        res.json({ success: true, data: measure });
    } catch (error) {
        logger.error('Error:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Aktualisieren' });
    }
});

router.post('/eva/organizational/:id/sign', authenticateToken, requirePermission('eva.sign'), async (req, res) => {
    try {
        const measure = await evacuationService.organizational.sign(req.params.id, req.body.signature, req.user.id);
        res.json({ success: true, data: measure });
    } catch (error) {
        logger.error('Error:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Unterschreiben' });
    }
});

// ==============================================
// STRUCTURAL MEASURES
// ==============================================

router.get('/eva/buildings/:buildingId/structural', authenticateToken, requirePermission('eva.view'), async (req, res) => {
    try {
        const measures = await evacuationService.structural.getByBuilding(req.params.buildingId);
        res.json({ success: true, data: measures });
    } catch (error) {
        logger.error('Error:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Laden' });
    }
});

router.post('/eva/buildings/:buildingId/structural', authenticateToken, requirePermission('eva.create'), async (req, res) => {
    try {
        const measure = await evacuationService.structural.create(
            { ...req.body, building_id: parseInt(req.params.buildingId) },
            req.user.id
        );
        res.status(201).json({ success: true, data: measure });
    } catch (error) {
        logger.error('Error:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Erstellen' });
    }
});

router.post('/eva/structural/:id/photos', authenticateToken, requirePermission('eva.edit'), upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'Keine Datei' });
        const photoUrl = `/uploads/eva/${req.file.filename}`;
        const measure = await evacuationService.structural.addPhoto(req.params.id, { url: photoUrl, caption: req.body.caption || '' }, req.user.id);
        res.json({ success: true, data: measure, photo: { url: photoUrl } });
    } catch (error) {
        logger.error('Error:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Upload' });
    }
});

// ==============================================
// TECHNICAL MEASURES
// ==============================================

router.get('/eva/buildings/:buildingId/technical', authenticateToken, requirePermission('eva.view'), async (req, res) => {
    try {
        const measures = await evacuationService.technical.getByBuilding(req.params.buildingId);
        res.json({ success: true, data: measures });
    } catch (error) {
        logger.error('Error:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Laden' });
    }
});

router.post('/eva/buildings/:buildingId/technical', authenticateToken, requirePermission('eva.create'), async (req, res) => {
    try {
        const measure = await evacuationService.technical.create(
            { ...req.body, building_id: parseInt(req.params.buildingId) },
            req.user.id
        );
        res.status(201).json({ success: true, data: measure });
    } catch (error) {
        logger.error('Error:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Erstellen' });
    }
});

// ==============================================
// EXERCISES
// ==============================================

router.get('/eva/exercises', authenticateToken, requirePermission('eva.view'), async (req, res) => {
    try {
        const exercises = await evacuationService.exercises.getAll(req.query.building_id);
        res.json({ success: true, data: exercises });
    } catch (error) {
        logger.error('Error:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Laden der Uebungen' });
    }
});

router.get('/eva/exercises/:id', authenticateToken, requirePermission('eva.view'), async (req, res) => {
    try {
        const exercise = await evacuationService.exercises.getById(req.params.id);
        if (!exercise) return res.status(404).json({ success: false, message: 'Uebung nicht gefunden' });

        // Get phases
        const [preparation, execution, evaluation] = await Promise.all([
            evacuationService.exercisePreparation.getByExercise(req.params.id),
            evacuationService.exerciseExecution.getByExercise(req.params.id),
            evacuationService.exerciseEvaluation.getByExercise(req.params.id)
        ]);

        res.json({ success: true, data: { ...exercise, preparation, execution, evaluation } });
    } catch (error) {
        logger.error('Error:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Laden' });
    }
});

router.post('/eva/exercises', authenticateToken, requirePermission('eva.manage_exercises'), async (req, res) => {
    try {
        const exercise = await evacuationService.exercises.create(req.body, req.user.id);
        res.status(201).json({ success: true, data: exercise });
    } catch (error) {
        logger.error('Error:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Erstellen der Uebung' });
    }
});

router.put('/eva/exercises/:id/status', authenticateToken, requirePermission('eva.manage_exercises'), async (req, res) => {
    try {
        const exercise = await evacuationService.exercises.updateStatus(req.params.id, req.body.status, req.user.id);
        res.json({ success: true, data: exercise });
    } catch (error) {
        logger.error('Error:', error);
        res.status(500).json({ success: false, message: 'Fehler' });
    }
});

// Exercise Preparation
router.post('/eva/exercises/:id/preparation', authenticateToken, requirePermission('eva.manage_exercises'), async (req, res) => {
    try {
        const prep = await evacuationService.exercisePreparation.create(parseInt(req.params.id), req.body, req.user.id);
        res.status(201).json({ success: true, data: prep });
    } catch (error) {
        logger.error('Error:', error);
        res.status(500).json({ success: false, message: 'Fehler' });
    }
});

router.post('/eva/exercises/:id/preparation/complete', authenticateToken, requirePermission('eva.manage_exercises'), async (req, res) => {
    try {
        const existing = await evacuationService.exercisePreparation.getByExercise(req.params.id);
        if (!existing) return res.status(404).json({ success: false, message: 'Vorbereitung nicht gefunden' });
        const prep = await evacuationService.exercisePreparation.complete(existing.id, req.user.id);
        await evacuationService.exercises.updateStatus(req.params.id, 'preparation', req.user.id);
        res.json({ success: true, data: prep });
    } catch (error) {
        logger.error('Error:', error);
        res.status(500).json({ success: false, message: 'Fehler' });
    }
});

// Exercise Execution
router.post('/eva/exercises/:id/execution', authenticateToken, requirePermission('eva.manage_exercises'), async (req, res) => {
    try {
        const exec = await evacuationService.exerciseExecution.create(parseInt(req.params.id), req.body, req.user.id);
        await evacuationService.exercises.setActualDate(req.params.id, req.body.alarm_triggered_at || new Date(), req.user.id);
        res.status(201).json({ success: true, data: exec });
    } catch (error) {
        logger.error('Error:', error);
        res.status(500).json({ success: false, message: 'Fehler' });
    }
});

// Exercise Evaluation
router.post('/eva/exercises/:id/evaluation', authenticateToken, requirePermission('eva.manage_exercises'), async (req, res) => {
    try {
        const evaluation = await evacuationService.exerciseEvaluation.create(parseInt(req.params.id), req.body, req.user.id);
        res.status(201).json({ success: true, data: evaluation });
    } catch (error) {
        logger.error('Error:', error);
        res.status(500).json({ success: false, message: 'Fehler' });
    }
});

// ==============================================
// FINDINGS
// ==============================================

router.get('/eva/findings', authenticateToken, requirePermission('eva.view'), async (req, res) => {
    try {
        const { source_type, status, severity } = req.query;
        const findings = await evacuationService.findings.getAll({ source_type, status, severity });
        res.json({ success: true, data: findings });
    } catch (error) {
        logger.error('Error:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Laden' });
    }
});

router.post('/eva/findings', authenticateToken, requirePermission('eva.create'), async (req, res) => {
    try {
        const finding = await evacuationService.findings.create(req.body, req.user.id);
        res.status(201).json({ success: true, data: finding });
    } catch (error) {
        logger.error('Error:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Erstellen' });
    }
});

router.post('/eva/findings/:id/resolve', authenticateToken, requirePermission('eva.edit'), async (req, res) => {
    try {
        const finding = await evacuationService.findings.resolve(req.params.id, req.body, req.user.id);
        res.json({ success: true, data: finding });
    } catch (error) {
        logger.error('Error:', error);
        res.status(500).json({ success: false, message: 'Fehler' });
    }
});

router.post('/eva/findings/:id/verify', authenticateToken, requirePermission('eva.sign'), async (req, res) => {
    try {
        const finding = await evacuationService.findings.verify(req.params.id, req.user.id);
        res.json({ success: true, data: finding });
    } catch (error) {
        logger.error('Error:', error);
        res.status(500).json({ success: false, message: 'Fehler' });
    }
});

// ==============================================
// STATISTICS
// ==============================================

router.get('/eva/statistics', authenticateToken, requirePermission('eva.view'), async (req, res) => {
    try {
        const stats = await evacuationService.statistics.getDashboard(req.query.building_id);
        res.json({ success: true, data: stats });
    } catch (error) {
        logger.error('Error:', error);
        res.status(500).json({ success: false, message: 'Fehler beim Laden der Statistiken' });
    }
});

module.exports = router;
