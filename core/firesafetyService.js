/**
 * Fire Safety Service - Brandschutz- & Sicherheitsmanagement
 * Business Logic fuer alle 5 Brandschutz-Checklisten
 * Author: Jan Guenther <jg@linxpress.de>
 */

const database = require('./database');
const { createModuleLogger } = require('./logger');
const eventBus = require('./eventBus');

const logger = createModuleLogger('FireSafetyService');

// Helper
async function auditLog(entityType, entityId, action, oldValues, newValues, userId) {
    try {
        await database.query(`INSERT INTO bsm_audit_log (entity_type, entity_id, action, old_values, new_values, user_id)
            VALUES ($1, $2, $3, $4, $5, $6)`,
            [entityType, entityId, action, oldValues ? JSON.stringify(oldValues) : null, newValues ? JSON.stringify(newValues) : null, userId]);
    } catch (e) { logger.error('Audit log error:', e); }
}

// ==============================================
// OBJECTS
// ==============================================
const objects = {
    async getAll(locationId = null) {
        let query = `SELECT o.*, l.name as location_name, fso.name as fire_safety_officer_name, fm.name as facility_manager_name
            FROM bsm_objects o
            LEFT JOIN locations l ON o.location_id = l.id
            LEFT JOIN users fso ON o.fire_safety_officer_id = fso.id
            LEFT JOIN users fm ON o.facility_manager_id = fm.id
            WHERE o.is_active = true`;
        const params = [];
        if (locationId) { params.push(locationId); query += ` AND o.location_id = $${params.length}`; }
        query += ' ORDER BY o.name ASC';
        return (await database.query(query, params)).rows;
    },

    async getById(id) {
        const result = await database.query(`SELECT o.*, l.name as location_name, l.address as location_address,
            fso.name as fire_safety_officer_name, fso.email as fire_safety_officer_email,
            fm.name as facility_manager_name, fm.email as facility_manager_email
            FROM bsm_objects o
            LEFT JOIN locations l ON o.location_id = l.id
            LEFT JOIN users fso ON o.fire_safety_officer_id = fso.id
            LEFT JOIN users fm ON o.facility_manager_id = fm.id
            WHERE o.id = $1`, [id]);
        return result.rows[0];
    },

    async create(data, userId) {
        const result = await database.query(`INSERT INTO bsm_objects (location_id, building_id, name, code, object_type, address, floors, total_area_sqm,
            fire_class, building_class, fire_safety_officer_id, facility_manager_id, inspection_interval_months, fire_protection_plan_url, escape_plan_url)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
            [data.location_id, data.building_id, data.name, data.code, data.object_type, data.address, data.floors || 1, data.total_area_sqm,
             data.fire_class, data.building_class, data.fire_safety_officer_id, data.facility_manager_id, data.inspection_interval_months || 12,
             data.fire_protection_plan_url, data.escape_plan_url]);
        await auditLog('object', result.rows[0].id, 'created', null, result.rows[0], userId);
        return result.rows[0];
    },

    async update(id, data, userId) {
        const old = await this.getById(id);
        const result = await database.query(`UPDATE bsm_objects SET name = COALESCE($1, name), code = COALESCE($2, code),
            object_type = COALESCE($3, object_type), address = COALESCE($4, address), floors = COALESCE($5, floors),
            total_area_sqm = COALESCE($6, total_area_sqm), fire_class = COALESCE($7, fire_class), building_class = COALESCE($8, building_class),
            fire_safety_officer_id = COALESCE($9, fire_safety_officer_id), facility_manager_id = COALESCE($10, facility_manager_id),
            overall_status = COALESCE($11, overall_status), updated_at = NOW() WHERE id = $12 RETURNING *`,
            [data.name, data.code, data.object_type, data.address, data.floors, data.total_area_sqm, data.fire_class, data.building_class,
             data.fire_safety_officer_id, data.facility_manager_id, data.overall_status, id]);
        await auditLog('object', id, 'updated', old, result.rows[0], userId);
        return result.rows[0];
    },

    async delete(id, userId) {
        await auditLog('object', id, 'deleted', null, null, userId);
        await database.query('UPDATE bsm_objects SET is_active = false WHERE id = $1', [id]);
    }
};

// ==============================================
// GENERIC CHECKLIST FUNCTIONS
// ==============================================
const createChecklistService = (tableName, checklistType) => ({
    async getByObject(objectId) {
        return (await database.query(`SELECT c.*, u.name as inspector_name FROM ${tableName} c
            LEFT JOIN users u ON c.inspector_id = u.id WHERE c.object_id = $1 ORDER BY c.inspection_date DESC`, [objectId])).rows;
    },

    async getById(id) {
        return (await database.query(`SELECT c.*, u.name as inspector_name, o.name as object_name FROM ${tableName} c
            LEFT JOIN users u ON c.inspector_id = u.id LEFT JOIN bsm_objects o ON c.object_id = o.id WHERE c.id = $1`, [id])).rows[0];
    },

    async create(data, userId) {
        const cols = Object.keys(data).filter(k => k !== 'object_id');
        const vals = cols.map(k => data[k]);
        const placeholders = cols.map((_, i) => `$${i + 3}`).join(', ');
        const result = await database.query(
            `INSERT INTO ${tableName} (object_id, inspector_id, ${cols.join(', ')}) VALUES ($1, $2, ${placeholders}) RETURNING *`,
            [data.object_id, userId, ...vals]
        );
        await auditLog(checklistType, result.rows[0].id, 'created', null, result.rows[0], userId);
        eventBus.emit(`bsm:${checklistType}:created`, { check: result.rows[0], userId });
        return result.rows[0];
    },

    async sign(id, signature, userId) {
        const result = await database.query(`UPDATE ${tableName} SET inspector_signature = $1, inspector_signed_at = NOW(), updated_at = NOW()
            WHERE id = $2 RETURNING *`, [signature, id]);
        await auditLog(checklistType, id, 'signed', null, { signed: true }, userId);
        return result.rows[0];
    }
});

const ordnung = createChecklistService('bsm_ordnung_checks', 'ordnung');
const infrastruktur = createChecklistService('bsm_infrastruktur_checks', 'infrastruktur');
const fluchtwege = createChecklistService('bsm_fluchtwege_checks', 'fluchtwege');
const baulich = createChecklistService('bsm_baulich_checks', 'baulich');
const betrieblich = createChecklistService('bsm_betrieblich_checks', 'betrieblich');

// ==============================================
// DEFECTS
// ==============================================
const defects = {
    async getAll(filters = {}) {
        let query = `SELECT d.*, o.name as object_name, u.name as responsible_name FROM bsm_defects d
            LEFT JOIN bsm_objects o ON d.object_id = o.id LEFT JOIN users u ON d.responsible_user_id = u.id WHERE 1=1`;
        const params = [];
        if (filters.object_id) { params.push(filters.object_id); query += ` AND d.object_id = $${params.length}`; }
        if (filters.status) { params.push(filters.status); query += ` AND d.status = $${params.length}`; }
        if (filters.priority) { params.push(filters.priority); query += ` AND d.priority = $${params.length}`; }
        if (filters.checklist_type) { params.push(filters.checklist_type); query += ` AND d.checklist_type = $${params.length}`; }
        query += ' ORDER BY d.priority DESC, d.due_date ASC';
        return (await database.query(query, params)).rows;
    },

    async getById(id) {
        return (await database.query(`SELECT d.*, o.name as object_name, u.name as responsible_name FROM bsm_defects d
            LEFT JOIN bsm_objects o ON d.object_id = o.id LEFT JOIN users u ON d.responsible_user_id = u.id WHERE d.id = $1`, [id])).rows[0];
    },

    async create(data, userId) {
        const result = await database.query(`INSERT INTO bsm_defects (object_id, checklist_type, checklist_id, title, description, location_detail,
            category, priority, fire_risk_level, photos, responsible_user_id, assigned_by_id, assigned_at, due_date, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'open') RETURNING *`,
            [data.object_id, data.checklist_type, data.checklist_id, data.title, data.description, data.location_detail, data.category,
             data.priority || 'medium', data.fire_risk_level, JSON.stringify(data.photos || []), data.responsible_user_id,
             data.responsible_user_id ? userId : null, data.responsible_user_id ? new Date() : null, data.due_date]);
        // Create calendar event if due date set
        if (data.due_date) {
            try {
                const eventsService = require('./eventsService');
                const event = await eventsService.createEvent({
                    title: `[BSM] Frist: ${data.title}`,
                    description: `Brandschutzmangel: ${data.description}`,
                    start_time: data.due_date, end_time: data.due_date, all_day: true,
                    category: 'deadline', organizer_id: userId, visibility: 'internal',
                    color: data.priority === 'critical' ? '#ef4444' : data.priority === 'high' ? '#f97316' : '#eab308'
                }, userId);
                await database.query('UPDATE bsm_defects SET calendar_event_id = $1 WHERE id = $2', [event.id, result.rows[0].id]);
            } catch (e) { logger.warn('Calendar event creation failed:', e.message); }
        }
        await auditLog('defect', result.rows[0].id, 'created', null, result.rows[0], userId);
        eventBus.emit('bsm:defect:created', { defect: result.rows[0], userId });
        return result.rows[0];
    },

    async assign(id, responsibleUserId, dueDate, userId) {
        const result = await database.query(`UPDATE bsm_defects SET responsible_user_id = $1, assigned_by_id = $2, assigned_at = NOW(),
            due_date = $3, status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END, updated_at = NOW()
            WHERE id = $4 RETURNING *`, [responsibleUserId, userId, dueDate, id]);
        await auditLog('defect', id, 'assigned', null, result.rows[0], userId);
        return result.rows[0];
    },

    async escalate(id, escalateToId, userId) {
        const current = await this.getById(id);
        const newLevel = (current.escalation_level || 0) + 1;
        const result = await database.query(`UPDATE bsm_defects SET escalation_level = $1, escalated_to_id = $2, escalated_at = NOW(),
            status = 'escalated', updated_at = NOW() WHERE id = $3 RETURNING *`, [newLevel, escalateToId, id]);
        await auditLog('defect', id, 'escalated', null, { level: newLevel }, userId);
        eventBus.emit('bsm:defect:escalated', { defect: result.rows[0], userId });
        return result.rows[0];
    },

    async resolve(id, data, userId) {
        const result = await database.query(`UPDATE bsm_defects SET status = 'pending_verification', resolution_notes = $1,
            resolution_photos = $2, resolved_at = NOW(), resolved_by_id = $3, resolution_signature = $4, updated_at = NOW()
            WHERE id = $5 RETURNING *`, [data.notes, JSON.stringify(data.photos || []), userId, data.signature, id]);
        await auditLog('defect', id, 'resolved', null, result.rows[0], userId);
        return result.rows[0];
    },

    async verify(id, signature, userId) {
        const result = await database.query(`UPDATE bsm_defects SET status = 'resolved', verified_at = NOW(), verified_by_id = $1,
            verification_signature = $2, updated_at = NOW() WHERE id = $3 RETURNING *`, [userId, signature, id]);
        await auditLog('defect', id, 'verified', null, result.rows[0], userId);
        return result.rows[0];
    }
};

// ==============================================
// TRAININGS
// ==============================================
const trainings = {
    async getAll(objectId = null) {
        let query = `SELECT t.*, o.name as object_name FROM bsm_trainings t LEFT JOIN bsm_objects o ON t.object_id = o.id WHERE 1=1`;
        const params = [];
        if (objectId) { params.push(objectId); query += ` AND t.object_id = $${params.length}`; }
        query += ' ORDER BY t.planned_date DESC';
        return (await database.query(query, params)).rows;
    },

    async create(data, userId) {
        const result = await database.query(`INSERT INTO bsm_trainings (object_id, training_type, title, description, planned_date,
            duration_minutes, trainer_name, trainer_external, location, repeat_interval_months, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'planned') RETURNING *`,
            [data.object_id, data.training_type, data.title, data.description, data.planned_date, data.duration_minutes,
             data.trainer_name, data.trainer_external || false, data.location, data.repeat_interval_months]);
        // Create calendar event
        try {
            const eventsService = require('./eventsService');
            const event = await eventsService.createEvent({
                title: `[BSM] Schulung: ${data.title}`,
                description: data.description,
                start_time: data.planned_date,
                end_time: new Date(new Date(data.planned_date).getTime() + (data.duration_minutes || 60) * 60000),
                category: 'training', organizer_id: userId, visibility: 'internal', color: '#3b82f6'
            }, userId);
            await database.query('UPDATE bsm_trainings SET calendar_event_id = $1 WHERE id = $2', [event.id, result.rows[0].id]);
        } catch (e) { logger.warn('Calendar event creation failed:', e.message); }
        return result.rows[0];
    },

    async complete(id, data, userId) {
        const nextDue = data.repeat_interval_months ?
            new Date(new Date().setMonth(new Date().getMonth() + data.repeat_interval_months)) : null;
        const result = await database.query(`UPDATE bsm_trainings SET status = 'completed', actual_date = NOW(),
            participants = $1, participant_count = $2, photos = $3, next_training_due = $4, updated_at = NOW()
            WHERE id = $5 RETURNING *`, [JSON.stringify(data.participants || []), data.participant_count || 0,
             JSON.stringify(data.photos || []), nextDue, id]);
        return result.rows[0];
    }
};

// ==============================================
// MAINTENANCE
// ==============================================
const maintenance = {
    async getAll(objectId = null) {
        let query = `SELECT m.*, o.name as object_name FROM bsm_maintenance m LEFT JOIN bsm_objects o ON m.object_id = o.id WHERE 1=1`;
        const params = [];
        if (objectId) { params.push(objectId); query += ` AND m.object_id = $${params.length}`; }
        query += ' ORDER BY m.next_inspection_due ASC';
        return (await database.query(query, params)).rows;
    },

    async create(data, userId) {
        const nextDue = data.last_inspection_date && data.inspection_interval_months ?
            new Date(new Date(data.last_inspection_date).setMonth(new Date(data.last_inspection_date).getMonth() + data.inspection_interval_months)) : null;
        const result = await database.query(`INSERT INTO bsm_maintenance (object_id, system_type, system_name, manufacturer, installation_date,
            has_contract, contractor_name, contractor_contact, contract_number, contract_expires, inspection_interval_months, last_inspection_date,
            next_inspection_due, last_inspector, status, documents)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
            [data.object_id, data.system_type, data.system_name, data.manufacturer, data.installation_date, data.has_contract || false,
             data.contractor_name, data.contractor_contact, data.contract_number, data.contract_expires, data.inspection_interval_months || 12,
             data.last_inspection_date, nextDue, data.last_inspector, data.status || 'ok', JSON.stringify(data.documents || [])]);
        return result.rows[0];
    },

    async recordInspection(id, data, userId) {
        const current = await database.query('SELECT * FROM bsm_maintenance WHERE id = $1', [id]);
        const interval = current.rows[0].inspection_interval_months || 12;
        const nextDue = new Date(new Date().setMonth(new Date().getMonth() + interval));
        const result = await database.query(`UPDATE bsm_maintenance SET last_inspection_date = $1, next_inspection_due = $2,
            last_inspector = $3, status = $4, documents = $5, updated_at = NOW() WHERE id = $6 RETURNING *`,
            [data.inspection_date || new Date(), nextDue, data.inspector, data.status || 'ok',
             JSON.stringify(data.documents || []), id]);
        return result.rows[0];
    }
};

// ==============================================
// STATISTICS
// ==============================================
const statistics = {
    async getDashboard(objectId = null) {
        const objectFilter = objectId ? 'WHERE object_id = $1' : '';
        const params = objectId ? [objectId] : [];
        const [objectsCount, defectsStats, trainingsStats, maintenanceStats] = await Promise.all([
            database.query('SELECT COUNT(*) as count FROM bsm_objects WHERE is_active = true'),
            database.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'open') as open,
                COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
                COUNT(*) FILTER (WHERE priority IN ('high', 'critical')) as critical,
                COUNT(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('resolved')) as overdue
                FROM bsm_defects ${objectFilter}`, params),
            database.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'completed') as completed,
                COUNT(*) FILTER (WHERE next_training_due < NOW()) as overdue FROM bsm_trainings ${objectFilter}`, params),
            database.query(`SELECT COUNT(*) as total,
                COUNT(*) FILTER (WHERE next_inspection_due < NOW()) as overdue,
                COUNT(*) FILTER (WHERE status = 'defect') as defect FROM bsm_maintenance ${objectFilter}`, params)
        ]);
        return {
            objects: parseInt(objectsCount.rows[0].count),
            defects: defectsStats.rows[0],
            trainings: trainingsStats.rows[0],
            maintenance: maintenanceStats.rows[0]
        };
    },

    async getObjectStatus(objectId) {
        const [ordnungCount, infrastrukturCount, fluchtwegeCount, baulichCount, betrieblichCount] = await Promise.all([
            database.query('SELECT COUNT(*) as count, MAX(inspection_date) as last FROM bsm_ordnung_checks WHERE object_id = $1', [objectId]),
            database.query('SELECT COUNT(*) as count, MAX(inspection_date) as last FROM bsm_infrastruktur_checks WHERE object_id = $1', [objectId]),
            database.query('SELECT COUNT(*) as count, MAX(inspection_date) as last FROM bsm_fluchtwege_checks WHERE object_id = $1', [objectId]),
            database.query('SELECT COUNT(*) as count, MAX(inspection_date) as last FROM bsm_baulich_checks WHERE object_id = $1', [objectId]),
            database.query('SELECT COUNT(*) as count, MAX(inspection_date) as last FROM bsm_betrieblich_checks WHERE object_id = $1', [objectId])
        ]);
        return {
            ordnung: ordnungCount.rows[0],
            infrastruktur: infrastrukturCount.rows[0],
            fluchtwege: fluchtwegeCount.rows[0],
            baulich: baulichCount.rows[0],
            betrieblich: betrieblichCount.rows[0]
        };
    }
};

module.exports = { objects, ordnung, infrastruktur, fluchtwege, baulich, betrieblich, defects, trainings, maintenance, statistics };
