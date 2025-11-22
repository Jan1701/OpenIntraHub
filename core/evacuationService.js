/**
 * Evacuation Service - Evakuierungs- & Fluchtweg-Management
 * Business Logic fuer Evakuierungen, Fluchtwege und Uebungen
 * Author: Jan Guenther <jg@linxpress.de>
 */

const database = require('./database');
const { createModuleLogger } = require('./logger');
const eventBus = require('./eventBus');

const logger = createModuleLogger('EvacuationService');

// ==============================================
// HELPER FUNCTIONS
// ==============================================

async function generateExerciseNumber() {
    const year = new Date().getFullYear();
    const result = await database.query(`
        SELECT COUNT(*) as count FROM eva_exercises
        WHERE exercise_number LIKE $1
    `, [`EVA-${year}-%`]);
    const count = parseInt(result.rows[0].count) + 1;
    return `EVA-${year}-${String(count).padStart(3, '0')}`;
}

async function auditLog(entityType, entityId, action, oldValues, newValues, userId) {
    try {
        await database.query(`
            INSERT INTO eva_audit_log (entity_type, entity_id, action, old_values, new_values, user_id)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [entityType, entityId, action,
            oldValues ? JSON.stringify(oldValues) : null,
            newValues ? JSON.stringify(newValues) : null,
            userId]);
    } catch (error) {
        logger.error('Audit log error:', error);
    }
}

// ==============================================
// BUILDINGS
// ==============================================

const buildings = {
    async getAll(locationId = null) {
        let query = `
            SELECT b.*, l.name as location_name, l.code as location_code,
                   em.name as evacuation_manager_name,
                   fso.name as fire_safety_officer_name
            FROM eva_buildings b
            LEFT JOIN locations l ON b.location_id = l.id
            LEFT JOIN users em ON b.evacuation_manager_id = em.id
            LEFT JOIN users fso ON b.fire_safety_officer_id = fso.id
            WHERE b.is_active = true
        `;
        const params = [];
        if (locationId) {
            params.push(locationId);
            query += ` AND b.location_id = $${params.length}`;
        }
        query += ' ORDER BY b.name ASC';
        const result = await database.query(query, params);
        return result.rows;
    },

    async getById(id) {
        const result = await database.query(`
            SELECT b.*, l.name as location_name, l.code as location_code,
                   l.address as location_address,
                   em.name as evacuation_manager_name, em.email as evacuation_manager_email,
                   fso.name as fire_safety_officer_name, fso.email as fire_safety_officer_email
            FROM eva_buildings b
            LEFT JOIN locations l ON b.location_id = l.id
            LEFT JOIN users em ON b.evacuation_manager_id = em.id
            LEFT JOIN users fso ON b.fire_safety_officer_id = fso.id
            WHERE b.id = $1
        `, [id]);
        return result.rows[0];
    },

    async create(data, userId) {
        const result = await database.query(`
            INSERT INTO eva_buildings (
                location_id, name, code, address, floors, total_area_sqm,
                max_occupancy, building_type, escape_plan_url, assembly_points,
                evacuation_manager_id, fire_safety_officer_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
        `, [
            data.location_id, data.name, data.code, data.address,
            data.floors || 1, data.total_area_sqm, data.max_occupancy,
            data.building_type, data.escape_plan_url,
            JSON.stringify(data.assembly_points || []),
            data.evacuation_manager_id, data.fire_safety_officer_id
        ]);
        await auditLog('building', result.rows[0].id, 'created', null, result.rows[0], userId);
        return result.rows[0];
    },

    async update(id, data, userId) {
        const old = await this.getById(id);
        const result = await database.query(`
            UPDATE eva_buildings SET
                location_id = COALESCE($1, location_id),
                name = COALESCE($2, name),
                code = COALESCE($3, code),
                address = COALESCE($4, address),
                floors = COALESCE($5, floors),
                total_area_sqm = COALESCE($6, total_area_sqm),
                max_occupancy = COALESCE($7, max_occupancy),
                building_type = COALESCE($8, building_type),
                escape_plan_url = COALESCE($9, escape_plan_url),
                assembly_points = COALESCE($10, assembly_points),
                evacuation_manager_id = COALESCE($11, evacuation_manager_id),
                fire_safety_officer_id = COALESCE($12, fire_safety_officer_id),
                updated_at = NOW()
            WHERE id = $13 RETURNING *
        `, [
            data.location_id, data.name, data.code, data.address,
            data.floors, data.total_area_sqm, data.max_occupancy,
            data.building_type, data.escape_plan_url,
            data.assembly_points ? JSON.stringify(data.assembly_points) : null,
            data.evacuation_manager_id, data.fire_safety_officer_id, id
        ]);
        await auditLog('building', id, 'updated', old, result.rows[0], userId);
        return result.rows[0];
    },

    async delete(id, userId) {
        await auditLog('building', id, 'deleted', null, null, userId);
        await database.query('UPDATE eva_buildings SET is_active = false WHERE id = $1', [id]);
    }
};

// ==============================================
// ORGANIZATIONAL MEASURES
// ==============================================

const organizational = {
    async getByBuilding(buildingId) {
        const result = await database.query(`
            SELECT o.*, u.name as inspector_name
            FROM eva_organizational_measures o
            LEFT JOIN users u ON o.inspector_id = u.id
            WHERE o.building_id = $1
            ORDER BY o.inspection_date DESC
        `, [buildingId]);
        return result.rows;
    },

    async getById(id) {
        const result = await database.query(`
            SELECT o.*, u.name as inspector_name, b.name as building_name
            FROM eva_organizational_measures o
            LEFT JOIN users u ON o.inspector_id = u.id
            LEFT JOIN eva_buildings b ON o.building_id = b.id
            WHERE o.id = $1
        `, [id]);
        return result.rows[0];
    },

    async create(data, userId) {
        const result = await database.query(`
            INSERT INTO eva_organizational_measures (
                building_id, inspector_id, inspection_date,
                evacuation_concept_exists, evacuation_concept_current, evacuation_concept_date, evacuation_concept_notes,
                internal_coordination_done, external_coordination_done, coordination_notes,
                trained_personnel_count, floor_wardens_assigned, floor_wardens_trained,
                special_needs_assistants_assigned, personnel_notes,
                escape_plans_current, escape_plans_posted, fire_protection_regulation_valid,
                fire_protection_regulation_date, documents_notes,
                instructions_conducted, last_instruction_date, instruction_documentation_exists, instruction_notes,
                mobility_aids_available, mobility_aids_notes,
                assembly_points_defined, assembly_points_marked, assembly_points_notes,
                alarm_texts_stored, alarm_system_tested, alarm_notes,
                first_aid_equipment_available, aed_available, first_aid_notes,
                overall_status, overall_notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37)
            RETURNING *
        `, [
            data.building_id, userId, data.inspection_date || new Date(),
            data.evacuation_concept_exists, data.evacuation_concept_current, data.evacuation_concept_date, data.evacuation_concept_notes,
            data.internal_coordination_done, data.external_coordination_done, data.coordination_notes,
            data.trained_personnel_count, data.floor_wardens_assigned, data.floor_wardens_trained,
            data.special_needs_assistants_assigned, data.personnel_notes,
            data.escape_plans_current, data.escape_plans_posted, data.fire_protection_regulation_valid,
            data.fire_protection_regulation_date, data.documents_notes,
            data.instructions_conducted, data.last_instruction_date, data.instruction_documentation_exists, data.instruction_notes,
            data.mobility_aids_available, data.mobility_aids_notes,
            data.assembly_points_defined, data.assembly_points_marked, data.assembly_points_notes,
            data.alarm_texts_stored, data.alarm_system_tested, data.alarm_notes,
            data.first_aid_equipment_available, data.aed_available, data.first_aid_notes,
            data.overall_status || 'pending', data.overall_notes
        ]);
        await auditLog('organizational', result.rows[0].id, 'created', null, result.rows[0], userId);
        return result.rows[0];
    },

    async update(id, data, userId) {
        const old = await this.getById(id);
        // Update specific fields
        const updateFields = [];
        const values = [];
        let paramCount = 0;

        const fields = [
            'evacuation_concept_exists', 'evacuation_concept_current', 'evacuation_concept_date', 'evacuation_concept_notes',
            'internal_coordination_done', 'external_coordination_done', 'coordination_notes',
            'trained_personnel_count', 'floor_wardens_assigned', 'floor_wardens_trained',
            'special_needs_assistants_assigned', 'personnel_notes',
            'escape_plans_current', 'escape_plans_posted', 'fire_protection_regulation_valid',
            'fire_protection_regulation_date', 'documents_notes',
            'instructions_conducted', 'last_instruction_date', 'instruction_documentation_exists', 'instruction_notes',
            'mobility_aids_available', 'mobility_aids_notes',
            'assembly_points_defined', 'assembly_points_marked', 'assembly_points_notes',
            'alarm_texts_stored', 'alarm_system_tested', 'alarm_notes',
            'first_aid_equipment_available', 'aed_available', 'first_aid_notes',
            'overall_status', 'overall_notes'
        ];

        for (const field of fields) {
            if (data[field] !== undefined) {
                paramCount++;
                updateFields.push(`${field} = $${paramCount}`);
                values.push(data[field]);
            }
        }

        if (updateFields.length === 0) return old;

        paramCount++;
        values.push(id);

        const result = await database.query(`
            UPDATE eva_organizational_measures SET
                ${updateFields.join(', ')},
                updated_at = NOW()
            WHERE id = $${paramCount}
            RETURNING *
        `, values);

        await auditLog('organizational', id, 'updated', old, result.rows[0], userId);
        return result.rows[0];
    },

    async sign(id, signature, userId) {
        const result = await database.query(`
            UPDATE eva_organizational_measures SET
                inspector_signature = $1,
                inspector_signed_at = NOW(),
                updated_at = NOW()
            WHERE id = $2 RETURNING *
        `, [signature, id]);
        await auditLog('organizational', id, 'signed', null, { signed: true }, userId);
        return result.rows[0];
    }
};

// ==============================================
// STRUCTURAL MEASURES
// ==============================================

const structural = {
    async getByBuilding(buildingId) {
        const result = await database.query(`
            SELECT s.*, u.name as inspector_name
            FROM eva_structural_measures s
            LEFT JOIN users u ON s.inspector_id = u.id
            WHERE s.building_id = $1
            ORDER BY s.inspection_date DESC
        `, [buildingId]);
        return result.rows;
    },

    async getById(id) {
        const result = await database.query(`
            SELECT s.*, u.name as inspector_name, b.name as building_name
            FROM eva_structural_measures s
            LEFT JOIN users u ON s.inspector_id = u.id
            LEFT JOIN eva_buildings b ON s.building_id = b.id
            WHERE s.id = $1
        `, [id]);
        return result.rows[0];
    },

    async create(data, userId) {
        const result = await database.query(`
            INSERT INTO eva_structural_measures (
                building_id, floor, area, inspector_id, inspection_date,
                escape_routes_compliant, escape_route_width_ok, escape_route_length_ok, escape_routes_notes,
                rescue_windows_exist, rescue_windows_dimensions_ok, rescue_windows_accessible, rescue_windows_notes,
                traffic_routes_clear, no_storage_in_routes, traffic_routes_notes,
                escape_signs_complete, escape_signs_visible, escape_signs_illuminated, signs_notes,
                doors_easy_to_open, doors_open_direction_ok, panic_locks_installed, panic_locks_functional, doors_notes,
                electric_locks_have_emergency_button, emergency_buttons_functional, emergency_buttons_marked, electric_locks_notes,
                stairs_compliant, handrails_installed, stairs_notes,
                photos, gps_latitude, gps_longitude,
                overall_status, overall_notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37)
            RETURNING *
        `, [
            data.building_id, data.floor, data.area, userId, data.inspection_date || new Date(),
            data.escape_routes_compliant, data.escape_route_width_ok, data.escape_route_length_ok, data.escape_routes_notes,
            data.rescue_windows_exist, data.rescue_windows_dimensions_ok, data.rescue_windows_accessible, data.rescue_windows_notes,
            data.traffic_routes_clear, data.no_storage_in_routes, data.traffic_routes_notes,
            data.escape_signs_complete, data.escape_signs_visible, data.escape_signs_illuminated, data.signs_notes,
            data.doors_easy_to_open, data.doors_open_direction_ok, data.panic_locks_installed, data.panic_locks_functional, data.doors_notes,
            data.electric_locks_have_emergency_button, data.emergency_buttons_functional, data.emergency_buttons_marked, data.electric_locks_notes,
            data.stairs_compliant, data.handrails_installed, data.stairs_notes,
            JSON.stringify(data.photos || []), data.gps_latitude, data.gps_longitude,
            data.overall_status || 'pending', data.overall_notes
        ]);
        await auditLog('structural', result.rows[0].id, 'created', null, result.rows[0], userId);
        return result.rows[0];
    },

    async addPhoto(id, photoData, userId) {
        const current = await this.getById(id);
        const photos = current.photos || [];
        photos.push({ ...photoData, uploaded_at: new Date().toISOString(), uploaded_by: userId });
        const result = await database.query(
            'UPDATE eva_structural_measures SET photos = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [JSON.stringify(photos), id]
        );
        return result.rows[0];
    }
};

// ==============================================
// TECHNICAL MEASURES
// ==============================================

const technical = {
    async getByBuilding(buildingId) {
        const result = await database.query(`
            SELECT t.*, u.name as inspector_name
            FROM eva_technical_measures t
            LEFT JOIN users u ON t.inspector_id = u.id
            WHERE t.building_id = $1
            ORDER BY t.inspection_date DESC
        `, [buildingId]);
        return result.rows;
    },

    async getById(id) {
        const result = await database.query(`
            SELECT t.*, u.name as inspector_name, b.name as building_name
            FROM eva_technical_measures t
            LEFT JOIN users u ON t.inspector_id = u.id
            LEFT JOIN eva_buildings b ON t.building_id = b.id
            WHERE t.id = $1
        `, [id]);
        return result.rows[0];
    },

    async create(data, userId) {
        const result = await database.query(`
            INSERT INTO eva_technical_measures (
                building_id, inspector_id, inspection_date,
                emergency_lighting_functional, emergency_lighting_tested, emergency_lighting_test_date, emergency_lighting_notes,
                smoke_extraction_exists, smoke_extraction_tested, smoke_extraction_test_date, smoke_extraction_notes,
                smoke_spread_prevention_functional, smoke_doors_functional, smoke_prevention_notes,
                fire_alarm_system_functional, fire_alarm_tested, fire_alarm_test_date, fire_alarm_notes,
                alarm_system_functional, alarm_audible, alarm_visible, voice_alarm_texts_stored, alarm_notes,
                emergency_power_functional, emergency_power_tested, emergency_power_test_date, emergency_power_duration_minutes, emergency_power_notes,
                fire_control_matrix_exists, fire_control_matrix_tested, fire_control_matrix_date, fire_control_matrix_notes,
                elevator_fire_control_exists, elevator_fire_control_tested, elevators_notes,
                visual_alarm_exists, visual_alarm_functional, visual_alarm_notes,
                maintenance_records, photos, documents,
                overall_status, overall_notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42)
            RETURNING *
        `, [
            data.building_id, userId, data.inspection_date || new Date(),
            data.emergency_lighting_functional, data.emergency_lighting_tested, data.emergency_lighting_test_date, data.emergency_lighting_notes,
            data.smoke_extraction_exists, data.smoke_extraction_tested, data.smoke_extraction_test_date, data.smoke_extraction_notes,
            data.smoke_spread_prevention_functional, data.smoke_doors_functional, data.smoke_prevention_notes,
            data.fire_alarm_system_functional, data.fire_alarm_tested, data.fire_alarm_test_date, data.fire_alarm_notes,
            data.alarm_system_functional, data.alarm_audible, data.alarm_visible, data.voice_alarm_texts_stored, data.alarm_notes,
            data.emergency_power_functional, data.emergency_power_tested, data.emergency_power_test_date, data.emergency_power_duration_minutes, data.emergency_power_notes,
            data.fire_control_matrix_exists, data.fire_control_matrix_tested, data.fire_control_matrix_date, data.fire_control_matrix_notes,
            data.elevator_fire_control_exists, data.elevator_fire_control_tested, data.elevators_notes,
            data.visual_alarm_exists, data.visual_alarm_functional, data.visual_alarm_notes,
            JSON.stringify(data.maintenance_records || []), JSON.stringify(data.photos || []), JSON.stringify(data.documents || []),
            data.overall_status || 'pending', data.overall_notes
        ]);
        await auditLog('technical', result.rows[0].id, 'created', null, result.rows[0], userId);
        return result.rows[0];
    }
};

// ==============================================
// EXERCISES
// ==============================================

const exercises = {
    async getAll(buildingId = null) {
        let query = `
            SELECT e.*, b.name as building_name, u.name as coordinator_name
            FROM eva_exercises e
            LEFT JOIN eva_buildings b ON e.building_id = b.id
            LEFT JOIN users u ON e.coordinator_id = u.id
            WHERE 1=1
        `;
        const params = [];
        if (buildingId) {
            params.push(buildingId);
            query += ` AND e.building_id = $${params.length}`;
        }
        query += ' ORDER BY e.planned_date DESC';
        const result = await database.query(query, params);
        return result.rows;
    },

    async getById(id) {
        const result = await database.query(`
            SELECT e.*, b.name as building_name, u.name as coordinator_name,
                   prep.id as preparation_id, exec.id as execution_id, eval.id as evaluation_id
            FROM eva_exercises e
            LEFT JOIN eva_buildings b ON e.building_id = b.id
            LEFT JOIN users u ON e.coordinator_id = u.id
            LEFT JOIN eva_exercise_preparation prep ON prep.exercise_id = e.id
            LEFT JOIN eva_exercise_execution exec ON exec.exercise_id = e.id
            LEFT JOIN eva_exercise_evaluation eval ON eval.exercise_id = e.id
            WHERE e.id = $1
        `, [id]);
        return result.rows[0];
    },

    async create(data, userId) {
        const exerciseNumber = await generateExerciseNumber();
        const result = await database.query(`
            INSERT INTO eva_exercises (
                building_id, exercise_number, planned_date, is_announced,
                exercise_type, coordinator_id, observers, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [
            data.building_id, exerciseNumber, data.planned_date,
            data.is_announced !== false, data.exercise_type || 'full',
            userId, JSON.stringify(data.observers || []), 'planned'
        ]);

        const exercise = result.rows[0];

        // Create calendar event
        try {
            const eventsService = require('./eventsService');
            const event = await eventsService.createEvent({
                title: `[EVA] Evakuierungsuebung ${exerciseNumber}`,
                description: `Evakuierungsuebung fuer Gebaeude`,
                start_time: data.planned_date,
                end_time: new Date(new Date(data.planned_date).getTime() + 2 * 60 * 60 * 1000), // +2h
                category: 'exercise',
                organizer_id: userId,
                visibility: 'internal',
                color: '#ef4444'
            }, userId);

            await database.query(
                'UPDATE eva_exercises SET calendar_event_id = $1 WHERE id = $2',
                [event.id, exercise.id]
            );
        } catch (error) {
            logger.warn('Could not create calendar event:', error.message);
        }

        await auditLog('exercise', exercise.id, 'created', null, exercise, userId);
        eventBus.emit('eva:exercise:created', { exercise, userId });
        return exercise;
    },

    async updateStatus(id, status, userId) {
        const result = await database.query(`
            UPDATE eva_exercises SET status = $1, updated_at = NOW()
            WHERE id = $2 RETURNING *
        `, [status, id]);
        await auditLog('exercise', id, 'status_changed', null, { status }, userId);
        return result.rows[0];
    },

    async setActualDate(id, actualDate, userId) {
        const result = await database.query(`
            UPDATE eva_exercises SET actual_date = $1, status = 'in_progress', updated_at = NOW()
            WHERE id = $2 RETURNING *
        `, [actualDate, id]);
        return result.rows[0];
    }
};

// ==============================================
// EXERCISE PHASES
// ==============================================

const exercisePreparation = {
    async getByExercise(exerciseId) {
        const result = await database.query(
            'SELECT * FROM eva_exercise_preparation WHERE exercise_id = $1',
            [exerciseId]
        );
        return result.rows[0];
    },

    async create(exerciseId, data, userId) {
        const result = await database.query(`
            INSERT INTO eva_exercise_preparation (
                exercise_id, internal_coordination_done, external_coordination_done, coordination_notes,
                announcement_method, announcement_date, announcement_notes,
                observers_briefed, observer_briefing_date, observer_positions_defined, observer_notes,
                neighbors_informed, public_informed, authorities_informed, information_notes,
                documentation_prepared, cameras_ready, checklists_distributed, documentation_notes,
                special_preparations
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
            RETURNING *
        `, [
            exerciseId, data.internal_coordination_done, data.external_coordination_done, data.coordination_notes,
            data.announcement_method, data.announcement_date, data.announcement_notes,
            data.observers_briefed, data.observer_briefing_date, data.observer_positions_defined, data.observer_notes,
            data.neighbors_informed, data.public_informed, data.authorities_informed, data.information_notes,
            data.documentation_prepared, data.cameras_ready, data.checklists_distributed, data.documentation_notes,
            data.special_preparations
        ]);
        return result.rows[0];
    },

    async complete(id, userId) {
        const result = await database.query(`
            UPDATE eva_exercise_preparation SET
                preparation_complete = true, completed_at = NOW(), completed_by = $1
            WHERE id = $2 RETURNING *
        `, [userId, id]);
        return result.rows[0];
    }
};

const exerciseExecution = {
    async getByExercise(exerciseId) {
        const result = await database.query(
            'SELECT * FROM eva_exercise_execution WHERE exercise_id = $1',
            [exerciseId]
        );
        return result.rows[0];
    },

    async create(exerciseId, data, userId) {
        const result = await database.query(`
            INSERT INTO eva_exercise_execution (
                exercise_id, alarm_triggered_at, building_cleared_at, all_clear_at, total_evacuation_time_seconds,
                observers_in_position, observer_notes,
                alarm_audible, alarm_visible, alarm_understood, alarm_notes,
                escape_routes_used_correctly, alternative_routes_needed, route_notes,
                congestion_occurred, congestion_location, panic_behavior_observed, behavior_notes,
                assembly_point_reached, headcount_conducted, headcount_complete, missing_persons, assembly_notes,
                injuries_occurred, injuries_notes, special_incidents,
                photos, videos, weather_conditions, participants_count, mobility_impaired_count
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31)
            RETURNING *
        `, [
            exerciseId, data.alarm_triggered_at, data.building_cleared_at, data.all_clear_at, data.total_evacuation_time_seconds,
            data.observers_in_position, data.observer_notes,
            data.alarm_audible, data.alarm_visible, data.alarm_understood, data.alarm_notes,
            data.escape_routes_used_correctly, data.alternative_routes_needed, data.route_notes,
            data.congestion_occurred, data.congestion_location, data.panic_behavior_observed, data.behavior_notes,
            data.assembly_point_reached, data.headcount_conducted, data.headcount_complete, data.missing_persons || 0, data.assembly_notes,
            data.injuries_occurred, data.injuries_notes, data.special_incidents,
            JSON.stringify(data.photos || []), JSON.stringify(data.videos || []),
            data.weather_conditions, data.participants_count, data.mobility_impaired_count
        ]);
        return result.rows[0];
    }
};

const exerciseEvaluation = {
    async getByExercise(exerciseId) {
        const result = await database.query(
            'SELECT * FROM eva_exercise_evaluation WHERE exercise_id = $1',
            [exerciseId]
        );
        return result.rows[0];
    },

    async create(exerciseId, data, userId) {
        const result = await database.query(`
            INSERT INTO eva_exercise_evaluation (
                exercise_id, evaluation_date, evaluator_id,
                overall_rating, evacuation_time_rating, organization_rating, communication_rating, behavior_rating,
                positive_findings, negative_findings, improvement_suggestions,
                action_items, next_exercise_recommended_date, next_exercise_notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING *
        `, [
            exerciseId, data.evaluation_date || new Date(), userId,
            data.overall_rating, data.evacuation_time_rating, data.organization_rating, data.communication_rating, data.behavior_rating,
            data.positive_findings, data.negative_findings, data.improvement_suggestions,
            JSON.stringify(data.action_items || []), data.next_exercise_recommended_date, data.next_exercise_notes
        ]);

        // Mark exercise as completed
        await exercises.updateStatus(exerciseId, 'completed', userId);

        return result.rows[0];
    }
};

// ==============================================
// FINDINGS
// ==============================================

const findings = {
    async getAll(filters = {}) {
        let query = `
            SELECT f.*, u.name as responsible_name
            FROM eva_findings f
            LEFT JOIN users u ON f.responsible_user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (filters.source_type) {
            params.push(filters.source_type);
            query += ` AND f.source_type = $${params.length}`;
        }
        if (filters.status) {
            params.push(filters.status);
            query += ` AND f.status = $${params.length}`;
        }
        if (filters.severity) {
            params.push(filters.severity);
            query += ` AND f.severity = $${params.length}`;
        }

        query += ' ORDER BY f.severity DESC, f.due_date ASC';
        const result = await database.query(query, params);
        return result.rows;
    },

    async create(data, userId) {
        const result = await database.query(`
            INSERT INTO eva_findings (
                source_type, source_id, title, description, location_detail,
                category, severity, photos, responsible_user_id, assigned_by_id,
                assigned_at, due_date, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *
        `, [
            data.source_type, data.source_id, data.title, data.description,
            data.location_detail, data.category, data.severity || 'medium',
            JSON.stringify(data.photos || []),
            data.responsible_user_id, data.responsible_user_id ? userId : null,
            data.responsible_user_id ? new Date() : null, data.due_date, 'open'
        ]);
        return result.rows[0];
    },

    async resolve(id, data, userId) {
        const result = await database.query(`
            UPDATE eva_findings SET
                status = 'pending_verification',
                resolution_notes = $1,
                resolution_photos = $2,
                resolved_at = NOW(),
                resolved_by_id = $3,
                updated_at = NOW()
            WHERE id = $4 RETURNING *
        `, [data.notes, JSON.stringify(data.photos || []), userId, id]);
        return result.rows[0];
    },

    async verify(id, userId) {
        const result = await database.query(`
            UPDATE eva_findings SET
                status = 'resolved',
                verified_at = NOW(),
                verified_by_id = $1,
                updated_at = NOW()
            WHERE id = $2 RETURNING *
        `, [userId, id]);
        return result.rows[0];
    }
};

// ==============================================
// STATISTICS
// ==============================================

const statistics = {
    async getDashboard(buildingId = null) {
        const buildingFilter = buildingId ? 'WHERE building_id = $1' : '';
        const params = buildingId ? [buildingId] : [];

        const [buildingsCount, exercisesStats, findingsStats] = await Promise.all([
            database.query('SELECT COUNT(*) as count FROM eva_buildings WHERE is_active = true'),
            database.query(`
                SELECT
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status = 'completed') as completed,
                    COUNT(*) FILTER (WHERE status = 'planned') as planned
                FROM eva_exercises ${buildingFilter}
            `, params),
            database.query(`
                SELECT
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status = 'open') as open,
                    COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
                    COUNT(*) FILTER (WHERE severity IN ('high', 'critical')) as critical
                FROM eva_findings
            `)
        ]);

        return {
            buildings: parseInt(buildingsCount.rows[0].count),
            exercises: exercisesStats.rows[0],
            findings: findingsStats.rows[0]
        };
    }
};

// ==============================================
// EXPORTS
// ==============================================

module.exports = {
    buildings,
    organizational,
    structural,
    technical,
    exercises,
    exercisePreparation,
    exerciseExecution,
    exerciseEvaluation,
    findings,
    statistics
};
