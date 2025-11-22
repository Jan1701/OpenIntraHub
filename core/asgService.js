/**
 * ASG Service - Arbeitssicherheits- & Gesundheitskontrolle
 * Business Logic fuer Sicherheitskontrollen, Maengel und Massnahmen
 * Author: Jan Guenther <jg@linxpress.de>
 */

const database = require('./database');
const { createModuleLogger } = require('./logger');
const eventBus = require('./eventBus');

const logger = createModuleLogger('ASGService');

// ==============================================
// INSPECTION NUMBER GENERATION
// ==============================================

async function generateInspectionNumber() {
    const year = new Date().getFullYear();
    const result = await database.query(`
        SELECT COUNT(*) as count FROM asg_inspections
        WHERE inspection_number LIKE $1
    `, [`ASG-${year}-%`]);

    const count = parseInt(result.rows[0].count) + 1;
    return `ASG-${year}-${String(count).padStart(4, '0')}`;
}

// ==============================================
// CHECKLISTS
// ==============================================

const checklists = {
    async getAll(filters = {}) {
        let query = `
            SELECT c.*, u.username as created_by_name
            FROM asg_checklists c
            LEFT JOIN users u ON c.created_by = u.id
            WHERE 1=1
        `;
        const params = [];

        if (filters.category) {
            params.push(filters.category);
            query += ` AND c.category = $${params.length}`;
        }

        if (filters.is_active !== undefined) {
            params.push(filters.is_active);
            query += ` AND c.is_active = $${params.length}`;
        }

        query += ' ORDER BY c.name ASC';

        const result = await database.query(query, params);
        return result.rows;
    },

    async getById(id) {
        const result = await database.query(`
            SELECT c.*, u.username as created_by_name
            FROM asg_checklists c
            LEFT JOIN users u ON c.created_by = u.id
            WHERE c.id = $1
        `, [id]);
        return result.rows[0];
    },

    async create(data, userId) {
        const result = await database.query(`
            INSERT INTO asg_checklists (
                name, description, category, check_items,
                version, legal_basis, review_interval_months, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [
            data.name,
            data.description,
            data.category,
            JSON.stringify(data.check_items || []),
            data.version || '1.0',
            data.legal_basis,
            data.review_interval_months || 12,
            userId
        ]);

        logger.info(`Checklist created: ${data.name}`);
        return result.rows[0];
    },

    async update(id, data) {
        const result = await database.query(`
            UPDATE asg_checklists SET
                name = COALESCE($1, name),
                description = COALESCE($2, description),
                category = COALESCE($3, category),
                check_items = COALESCE($4, check_items),
                version = COALESCE($5, version),
                legal_basis = COALESCE($6, legal_basis),
                review_interval_months = COALESCE($7, review_interval_months),
                is_active = COALESCE($8, is_active),
                updated_at = NOW()
            WHERE id = $9
            RETURNING *
        `, [
            data.name,
            data.description,
            data.category,
            data.check_items ? JSON.stringify(data.check_items) : null,
            data.version,
            data.legal_basis,
            data.review_interval_months,
            data.is_active,
            id
        ]);
        return result.rows[0];
    },

    async delete(id) {
        await database.query('DELETE FROM asg_checklists WHERE id = $1', [id]);
    }
};

// ==============================================
// INSPECTIONS
// ==============================================

const inspections = {
    async getAll(filters = {}) {
        let query = `
            SELECT i.*,
                   l.name as location_name,
                   l.code as location_code,
                   insp.username as inspector_name,
                   insp.name as inspector_full_name,
                   sup.username as supervisor_name,
                   c.name as checklist_name
            FROM asg_inspections i
            LEFT JOIN locations l ON i.location_id = l.id
            LEFT JOIN users insp ON i.inspector_id = insp.id
            LEFT JOIN users sup ON i.supervisor_id = sup.id
            LEFT JOIN asg_checklists c ON i.checklist_id = c.id
            WHERE 1=1
        `;
        const params = [];

        if (filters.location_id) {
            params.push(filters.location_id);
            query += ` AND i.location_id = $${params.length}`;
        }

        if (filters.inspector_id) {
            params.push(filters.inspector_id);
            query += ` AND i.inspector_id = $${params.length}`;
        }

        if (filters.status) {
            params.push(filters.status);
            query += ` AND i.status = $${params.length}`;
        }

        if (filters.from_date) {
            params.push(filters.from_date);
            query += ` AND i.inspection_date >= $${params.length}`;
        }

        if (filters.to_date) {
            params.push(filters.to_date);
            query += ` AND i.inspection_date <= $${params.length}`;
        }

        query += ' ORDER BY i.inspection_date DESC';

        if (filters.limit) {
            params.push(filters.limit);
            query += ` LIMIT $${params.length}`;
        }

        const result = await database.query(query, params);
        return result.rows;
    },

    async getById(id) {
        const result = await database.query(`
            SELECT i.*,
                   l.name as location_name,
                   l.code as location_code,
                   l.address as location_address,
                   insp.username as inspector_name,
                   insp.name as inspector_full_name,
                   insp.email as inspector_email,
                   sup.username as supervisor_name,
                   sup.name as supervisor_full_name,
                   so.username as safety_officer_name,
                   so.name as safety_officer_full_name,
                   c.name as checklist_name,
                   c.check_items as checklist_items
            FROM asg_inspections i
            LEFT JOIN locations l ON i.location_id = l.id
            LEFT JOIN users insp ON i.inspector_id = insp.id
            LEFT JOIN users sup ON i.supervisor_id = sup.id
            LEFT JOIN users so ON i.safety_officer_id = so.id
            LEFT JOIN asg_checklists c ON i.checklist_id = c.id
            WHERE i.id = $1
        `, [id]);
        return result.rows[0];
    },

    async create(data, userId) {
        const inspectionNumber = await generateInspectionNumber();

        const result = await database.query(`
            INSERT INTO asg_inspections (
                inspection_number, location_id, department, work_area,
                checklist_id, inspection_type, inspector_id, supervisor_id,
                safety_officer_id, inspection_date, scheduled_date, status,
                general_notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *
        `, [
            inspectionNumber,
            data.location_id,
            data.department,
            data.work_area,
            data.checklist_id,
            data.inspection_type || 'regular',
            userId,
            data.supervisor_id,
            data.safety_officer_id,
            data.inspection_date || new Date(),
            data.scheduled_date,
            data.status || 'draft',
            data.general_notes
        ]);

        const inspection = result.rows[0];

        // Audit log
        await auditLog('inspection', inspection.id, 'created', null, inspection, userId);

        // Emit event
        eventBus.emit('asg:inspection:created', { inspection, userId });

        logger.info(`Inspection created: ${inspectionNumber}`);
        return inspection;
    },

    async update(id, data, userId) {
        const old = await this.getById(id);

        const result = await database.query(`
            UPDATE asg_inspections SET
                location_id = COALESCE($1, location_id),
                department = COALESCE($2, department),
                work_area = COALESCE($3, work_area),
                checklist_id = COALESCE($4, checklist_id),
                inspection_type = COALESCE($5, inspection_type),
                supervisor_id = COALESCE($6, supervisor_id),
                safety_officer_id = COALESCE($7, safety_officer_id),
                inspection_date = COALESCE($8, inspection_date),
                status = COALESCE($9, status),
                checklist_results = COALESCE($10, checklist_results),
                general_notes = COALESCE($11, general_notes),
                recommendations = COALESCE($12, recommendations),
                updated_at = NOW()
            WHERE id = $13
            RETURNING *
        `, [
            data.location_id,
            data.department,
            data.work_area,
            data.checklist_id,
            data.inspection_type,
            data.supervisor_id,
            data.safety_officer_id,
            data.inspection_date,
            data.status,
            data.checklist_results ? JSON.stringify(data.checklist_results) : null,
            data.general_notes,
            data.recommendations,
            id
        ]);

        const inspection = result.rows[0];
        await auditLog('inspection', id, 'updated', old, inspection, userId);

        return inspection;
    },

    async sign(id, signatureType, signature, userId) {
        const field = signatureType === 'inspector' ? 'inspector' : 'supervisor';

        const result = await database.query(`
            UPDATE asg_inspections SET
                ${field}_signature = $1,
                ${field}_signed_at = NOW(),
                updated_at = NOW()
            WHERE id = $2
            RETURNING *
        `, [signature, id]);

        await auditLog('inspection', id, `signed_by_${field}`, null, { signature: '***' }, userId);

        return result.rows[0];
    },

    async complete(id, userId) {
        const result = await database.query(`
            UPDATE asg_inspections SET
                status = 'completed',
                completion_date = NOW(),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
        `, [id]);

        await auditLog('inspection', id, 'completed', null, null, userId);
        eventBus.emit('asg:inspection:completed', { inspectionId: id, userId });

        return result.rows[0];
    },

    async updateDefectCounts(id) {
        await database.query(`
            UPDATE asg_inspections SET
                total_defects = (SELECT COUNT(*) FROM asg_defects WHERE inspection_id = $1),
                critical_defects = (SELECT COUNT(*) FROM asg_defects WHERE inspection_id = $1 AND danger_level IN ('high', 'critical')),
                resolved_defects = (SELECT COUNT(*) FROM asg_defects WHERE inspection_id = $1 AND status = 'resolved'),
                updated_at = NOW()
            WHERE id = $1
        `, [id]);
    },

    async delete(id, userId) {
        await auditLog('inspection', id, 'deleted', null, null, userId);
        await database.query('DELETE FROM asg_inspections WHERE id = $1', [id]);
    }
};

// ==============================================
// DEFECTS
// ==============================================

const defects = {
    async getByInspection(inspectionId) {
        const result = await database.query(`
            SELECT d.*,
                   resp.username as responsible_username,
                   resp.name as responsible_name,
                   assigner.username as assigned_by_username,
                   resolver.username as resolved_by_username,
                   verifier.username as verified_by_username
            FROM asg_defects d
            LEFT JOIN users resp ON d.responsible_user_id = resp.id
            LEFT JOIN users assigner ON d.assigned_by_id = assigner.id
            LEFT JOIN users resolver ON d.resolved_by_id = resolver.id
            LEFT JOIN users verifier ON d.verified_by_id = verifier.id
            WHERE d.inspection_id = $1
            ORDER BY d.defect_number ASC
        `, [inspectionId]);
        return result.rows;
    },

    async getById(id) {
        const result = await database.query(`
            SELECT d.*,
                   i.inspection_number,
                   i.location_id,
                   l.name as location_name,
                   resp.username as responsible_username,
                   resp.name as responsible_name,
                   resp.email as responsible_email
            FROM asg_defects d
            JOIN asg_inspections i ON d.inspection_id = i.id
            LEFT JOIN locations l ON i.location_id = l.id
            LEFT JOIN users resp ON d.responsible_user_id = resp.id
            WHERE d.id = $1
        `, [id]);
        return result.rows[0];
    },

    async getOpenDefects(filters = {}) {
        let query = `
            SELECT d.*,
                   i.inspection_number,
                   i.location_id,
                   l.name as location_name,
                   resp.username as responsible_username,
                   resp.name as responsible_name
            FROM asg_defects d
            JOIN asg_inspections i ON d.inspection_id = i.id
            LEFT JOIN locations l ON i.location_id = l.id
            LEFT JOIN users resp ON d.responsible_user_id = resp.id
            WHERE d.status NOT IN ('resolved', 'wont_fix')
        `;
        const params = [];

        if (filters.responsible_user_id) {
            params.push(filters.responsible_user_id);
            query += ` AND d.responsible_user_id = $${params.length}`;
        }

        if (filters.location_id) {
            params.push(filters.location_id);
            query += ` AND i.location_id = $${params.length}`;
        }

        if (filters.danger_level) {
            params.push(filters.danger_level);
            query += ` AND d.danger_level = $${params.length}`;
        }

        if (filters.overdue) {
            query += ` AND d.deadline < NOW()`;
        }

        query += ' ORDER BY d.danger_level DESC, d.deadline ASC';

        const result = await database.query(query, params);
        return result.rows;
    },

    async create(data, userId) {
        // Get next defect number for this inspection
        const countResult = await database.query(
            'SELECT COALESCE(MAX(defect_number), 0) + 1 as next_num FROM asg_defects WHERE inspection_id = $1',
            [data.inspection_id]
        );
        const defectNumber = countResult.rows[0].next_num;

        const result = await database.query(`
            INSERT INTO asg_defects (
                inspection_id, defect_number, title, description, location_detail,
                danger_level, category, photos, responsible_user_id, assigned_by_id,
                assigned_at, deadline, deadline_set_by_id, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING *
        `, [
            data.inspection_id,
            defectNumber,
            data.title,
            data.description,
            data.location_detail,
            data.danger_level || 'medium',
            data.category,
            JSON.stringify(data.photos || []),
            data.responsible_user_id,
            data.responsible_user_id ? userId : null,
            data.responsible_user_id ? new Date() : null,
            data.deadline,
            data.deadline ? userId : null,
            'open'
        ]);

        const defect = result.rows[0];

        // Update inspection counts
        await inspections.updateDefectCounts(data.inspection_id);

        // Create calendar event for deadline if set
        if (data.deadline && data.responsible_user_id) {
            await createDeadlineEvent(defect, userId);
        }

        await auditLog('defect', defect.id, 'created', null, defect, userId);
        eventBus.emit('asg:defect:created', { defect, userId });

        logger.info(`Defect created: ${defect.id} in inspection ${data.inspection_id}`);
        return defect;
    },

    async update(id, data, userId) {
        const old = await this.getById(id);

        const result = await database.query(`
            UPDATE asg_defects SET
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                location_detail = COALESCE($3, location_detail),
                danger_level = COALESCE($4, danger_level),
                category = COALESCE($5, category),
                photos = COALESCE($6, photos),
                updated_at = NOW()
            WHERE id = $7
            RETURNING *
        `, [
            data.title,
            data.description,
            data.location_detail,
            data.danger_level,
            data.category,
            data.photos ? JSON.stringify(data.photos) : null,
            id
        ]);

        await auditLog('defect', id, 'updated', old, result.rows[0], userId);
        return result.rows[0];
    },

    async assign(id, responsibleUserId, deadline, userId) {
        const old = await this.getById(id);

        const result = await database.query(`
            UPDATE asg_defects SET
                responsible_user_id = $1,
                assigned_by_id = $2,
                assigned_at = NOW(),
                deadline = $3,
                deadline_set_by_id = $4,
                status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END,
                updated_at = NOW()
            WHERE id = $5
            RETURNING *
        `, [responsibleUserId, userId, deadline, userId, id]);

        const defect = result.rows[0];

        // Create/update calendar event
        if (deadline) {
            await createDeadlineEvent(defect, userId);
        }

        await auditLog('defect', id, 'assigned', old, defect, userId);
        eventBus.emit('asg:defect:assigned', { defect, userId });

        return defect;
    },

    async resolve(id, data, userId) {
        const old = await this.getById(id);

        const result = await database.query(`
            UPDATE asg_defects SET
                status = 'pending_verification',
                resolved_at = NOW(),
                resolved_by_id = $1,
                resolution_signature = $2,
                resolution_notes = $3,
                resolution_photos = $4,
                updated_at = NOW()
            WHERE id = $5
            RETURNING *
        `, [
            userId,
            data.signature,
            data.notes,
            JSON.stringify(data.photos || []),
            id
        ]);

        const defect = result.rows[0];
        await inspections.updateDefectCounts(old.inspection_id);
        await auditLog('defect', id, 'resolved', old, defect, userId);
        eventBus.emit('asg:defect:resolved', { defect, userId });

        return defect;
    },

    async verify(id, data, userId) {
        const old = await this.getById(id);

        const result = await database.query(`
            UPDATE asg_defects SET
                status = 'resolved',
                verified_at = NOW(),
                verified_by_id = $1,
                verification_signature = $2,
                verification_notes = $3,
                updated_at = NOW()
            WHERE id = $4
            RETURNING *
        `, [userId, data.signature, data.notes, id]);

        const defect = result.rows[0];
        await inspections.updateDefectCounts(old.inspection_id);
        await auditLog('defect', id, 'verified', old, defect, userId);

        return defect;
    },

    async escalate(id, userId) {
        const result = await database.query(`
            UPDATE asg_defects SET
                status = 'escalated',
                escalation_date = NOW(),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
        `, [id]);

        await auditLog('defect', id, 'escalated', null, null, userId);
        eventBus.emit('asg:defect:escalated', { defectId: id, userId });

        return result.rows[0];
    },

    async addPhoto(id, photoData, userId) {
        const defect = await this.getById(id);
        const photos = defect.photos || [];
        photos.push({
            url: photoData.url,
            caption: photoData.caption,
            taken_at: new Date().toISOString(),
            uploaded_by: userId
        });

        const result = await database.query(`
            UPDATE asg_defects SET photos = $1, updated_at = NOW()
            WHERE id = $2 RETURNING *
        `, [JSON.stringify(photos), id]);

        return result.rows[0];
    }
};

// ==============================================
// ACTIONS (MASSNAHMEN)
// ==============================================

const actions = {
    async getByDefect(defectId) {
        const result = await database.query(`
            SELECT a.*,
                   assignee.username as assigned_to_username,
                   assignee.name as assigned_to_name,
                   assigner.username as assigned_by_username
            FROM asg_actions a
            LEFT JOIN users assignee ON a.assigned_to_id = assignee.id
            LEFT JOIN users assigner ON a.assigned_by_id = assigner.id
            WHERE a.defect_id = $1
            ORDER BY a.priority ASC, a.created_at ASC
        `, [defectId]);
        return result.rows;
    },

    async create(data, userId) {
        const result = await database.query(`
            INSERT INTO asg_actions (
                defect_id, action_type, title, description,
                assigned_to_id, assigned_by_id, due_date, priority,
                estimated_cost
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `, [
            data.defect_id,
            data.action_type || 'short_term',
            data.title,
            data.description,
            data.assigned_to_id,
            userId,
            data.due_date,
            data.priority || 2,
            data.estimated_cost
        ]);

        eventBus.emit('asg:action:created', { action: result.rows[0], userId });
        return result.rows[0];
    },

    async update(id, data, userId) {
        const result = await database.query(`
            UPDATE asg_actions SET
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                assigned_to_id = COALESCE($3, assigned_to_id),
                due_date = COALESCE($4, due_date),
                status = COALESCE($5, status),
                progress_percent = COALESCE($6, progress_percent),
                priority = COALESCE($7, priority),
                actual_cost = COALESCE($8, actual_cost),
                updated_at = NOW()
            WHERE id = $9
            RETURNING *
        `, [
            data.title,
            data.description,
            data.assigned_to_id,
            data.due_date,
            data.status,
            data.progress_percent,
            data.priority,
            data.actual_cost,
            id
        ]);
        return result.rows[0];
    },

    async complete(id, userId) {
        const result = await database.query(`
            UPDATE asg_actions SET
                status = 'completed',
                completed_at = NOW(),
                progress_percent = 100,
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
        `, [id]);
        return result.rows[0];
    }
};

// ==============================================
// COMMENTS
// ==============================================

const comments = {
    async getByEntity(entityType, entityId) {
        const result = await database.query(`
            SELECT c.*, u.username, u.name as user_name, u.avatar
            FROM asg_comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.entity_type = $1 AND c.entity_id = $2
            ORDER BY c.created_at ASC
        `, [entityType, entityId]);
        return result.rows;
    },

    async create(data, userId) {
        const result = await database.query(`
            INSERT INTO asg_comments (entity_type, entity_id, comment, attachments, user_id, is_internal)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [
            data.entity_type,
            data.entity_id,
            data.comment,
            JSON.stringify(data.attachments || []),
            userId,
            data.is_internal || false
        ]);

        eventBus.emit('asg:comment:created', {
            entityType: data.entity_type,
            entityId: data.entity_id,
            comment: result.rows[0],
            userId
        });

        return result.rows[0];
    }
};

// ==============================================
// DISTRIBUTIONS
// ==============================================

const distributions = {
    async createForInspection(inspectionId, recipients, userId) {
        const results = [];

        for (const recipient of recipients) {
            const result = await database.query(`
                INSERT INTO asg_distributions (
                    inspection_id, distribution_type, recipient_user_id,
                    recipient_email, recipient_role
                ) VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `, [
                inspectionId,
                recipient.type, // white, red, yellow
                recipient.user_id,
                recipient.email,
                recipient.role
            ]);
            results.push(result.rows[0]);
        }

        return results;
    },

    async markSent(id, method) {
        const result = await database.query(`
            UPDATE asg_distributions SET
                sent_at = NOW(),
                sent_method = $1
            WHERE id = $2
            RETURNING *
        `, [method, id]);
        return result.rows[0];
    },

    async acknowledge(id, signature) {
        const result = await database.query(`
            UPDATE asg_distributions SET
                acknowledged_at = NOW(),
                acknowledged_signature = $1
            WHERE id = $2
            RETURNING *
        `, [signature, id]);
        return result.rows[0];
    }
};

// ==============================================
// HELPER FUNCTIONS
// ==============================================

async function auditLog(entityType, entityId, action, oldValues, newValues, userId) {
    try {
        await database.query(`
            INSERT INTO asg_audit_log (entity_type, entity_id, action, old_values, new_values, user_id)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            entityType,
            entityId,
            action,
            oldValues ? JSON.stringify(oldValues) : null,
            newValues ? JSON.stringify(newValues) : null,
            userId
        ]);
    } catch (error) {
        logger.error('Failed to write audit log:', error);
    }
}

async function createDeadlineEvent(defect, userId) {
    try {
        // Check if events module is available
        const eventsService = require('./eventsService');

        const eventData = {
            title: `[ASG] Frist: ${defect.title}`,
            description: `Mangel aus Kontrolle muss behoben werden.\n\nOrt: ${defect.location_detail}\nGefahrenstufe: ${defect.danger_level}`,
            start_time: defect.deadline,
            end_time: defect.deadline,
            all_day: true,
            category: 'deadline',
            organizer_id: userId,
            visibility: 'internal',
            color: defect.danger_level === 'critical' ? '#ef4444' :
                   defect.danger_level === 'high' ? '#f97316' :
                   defect.danger_level === 'medium' ? '#eab308' : '#22c55e'
        };

        const event = await eventsService.createEvent(eventData, userId);

        // Link event to defect
        await database.query(
            'UPDATE asg_defects SET deadline_event_id = $1 WHERE id = $2',
            [event.id, defect.id]
        );

        logger.info(`Calendar event created for defect ${defect.id}`);
        return event;
    } catch (error) {
        logger.warn('Could not create calendar event for deadline:', error.message);
        return null;
    }
}

// ==============================================
// STATISTICS
// ==============================================

const statistics = {
    async getDashboard(locationId = null) {
        const locationFilter = locationId ? 'AND i.location_id = $1' : '';
        const params = locationId ? [locationId] : [];

        const [inspectionsStats, defectsStats, overdueStats] = await Promise.all([
            database.query(`
                SELECT
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status = 'completed') as completed,
                    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
                    COUNT(*) FILTER (WHERE status = 'draft') as draft
                FROM asg_inspections i
                WHERE 1=1 ${locationFilter}
            `, params),

            database.query(`
                SELECT
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE d.status = 'resolved') as resolved,
                    COUNT(*) FILTER (WHERE d.status = 'open') as open,
                    COUNT(*) FILTER (WHERE d.danger_level IN ('high', 'critical')) as critical
                FROM asg_defects d
                JOIN asg_inspections i ON d.inspection_id = i.id
                WHERE 1=1 ${locationFilter}
            `, params),

            database.query(`
                SELECT COUNT(*) as overdue
                FROM asg_defects d
                JOIN asg_inspections i ON d.inspection_id = i.id
                WHERE d.status NOT IN ('resolved', 'wont_fix')
                AND d.deadline < NOW()
                ${locationFilter}
            `, params)
        ]);

        return {
            inspections: inspectionsStats.rows[0],
            defects: defectsStats.rows[0],
            overdue: parseInt(overdueStats.rows[0].overdue)
        };
    },

    async getDefectsByCategory(locationId = null) {
        const locationFilter = locationId ? 'AND i.location_id = $1' : '';
        const params = locationId ? [locationId] : [];

        const result = await database.query(`
            SELECT d.category, COUNT(*) as count,
                   COUNT(*) FILTER (WHERE d.status = 'resolved') as resolved
            FROM asg_defects d
            JOIN asg_inspections i ON d.inspection_id = i.id
            WHERE d.category IS NOT NULL ${locationFilter}
            GROUP BY d.category
            ORDER BY count DESC
        `, params);

        return result.rows;
    }
};

// ==============================================
// EXPORTS
// ==============================================

module.exports = {
    checklists,
    inspections,
    defects,
    actions,
    comments,
    distributions,
    statistics,
    generateInspectionNumber
};
