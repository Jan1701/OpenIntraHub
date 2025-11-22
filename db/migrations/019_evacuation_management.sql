-- =====================================================
-- Migration 019: Evakuierungs- & Fluchtweg-Management (EVA)
-- Digitale Erfassung von Evakuierungen, Fluchtwegen und Uebungen
-- Author: Jan Guenther <jg@linxpress.de>
-- =====================================================

-- =====================================================
-- 1. MODULE REGISTRATION
-- =====================================================

INSERT INTO module_registry (
    name,
    display_name,
    description,
    version,
    author,
    component,
    enabled,
    install_order,
    dependencies,
    module_config
) VALUES (
    'Evacuation',
    'Evakuierung & Fluchtwege',
    'Digitale Erfassung von Evakuierungen, Fluchtwegen, technischen Anlagen und Evakuierungsuebungen (TUEV-konform)',
    '1.0.0',
    'Jan Guenther <jg@linxpress.de>',
    'evacuation',
    true,
    410,
    '["Events", "ASG"]'::jsonb,
    '{
        "features": {
            "exercise_wizard": true,
            "route_maps": true,
            "pdf_export": true,
            "calendar_sync": true,
            "photo_documentation": true,
            "audit_trail": true
        },
        "defaults": {
            "exercise_interval_months": 12,
            "reminder_days_before": 30,
            "checklist_categories": ["organizational", "structural", "technical"]
        },
        "compliance": {
            "standards": ["ArbStaettV", "ASR A2.3", "TUEV SUD"],
            "review_interval_months": 12
        }
    }'::jsonb
) ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    version = EXCLUDED.version,
    module_config = EXCLUDED.module_config;

-- =====================================================
-- 2. GEBAEUDE / OBJEKTE
-- =====================================================

CREATE TABLE IF NOT EXISTS eva_buildings (
    id SERIAL PRIMARY KEY,

    -- Basis
    location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50), -- Gebaeudekuerzel
    address TEXT,

    -- Details
    floors INTEGER DEFAULT 1,
    total_area_sqm DECIMAL(10,2),
    max_occupancy INTEGER, -- Max. Personenzahl
    building_type VARCHAR(100), -- Buero, Produktion, Lager, etc.

    -- Fluchtwegplan
    escape_plan_url TEXT, -- URL zum digitalen Fluchtplan
    escape_plan_updated_at TIMESTAMP,
    assembly_points JSONB DEFAULT '[]', -- Sammelplaetze [{name, gps_lat, gps_lng, capacity}]

    -- Verantwortliche
    evacuation_manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    fire_safety_officer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

    -- Status
    is_active BOOLEAN DEFAULT true,
    last_inspection_at TIMESTAMP,
    next_inspection_due TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 3. ORGANISATORISCHE MASSNAHMEN
-- =====================================================

CREATE TABLE IF NOT EXISTS eva_organizational_measures (
    id SERIAL PRIMARY KEY,

    -- Referenz
    building_id INTEGER NOT NULL REFERENCES eva_buildings(id) ON DELETE CASCADE,
    inspection_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    inspector_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Evakuierungskonzept
    evacuation_concept_exists BOOLEAN,
    evacuation_concept_current BOOLEAN,
    evacuation_concept_date DATE,
    evacuation_concept_notes TEXT,

    -- Abstimmungen
    internal_coordination_done BOOLEAN,
    external_coordination_done BOOLEAN, -- Feuerwehr, etc.
    coordination_notes TEXT,

    -- Personal
    trained_personnel_count INTEGER,
    floor_wardens_assigned BOOLEAN,
    floor_wardens_trained BOOLEAN,
    special_needs_assistants_assigned BOOLEAN,
    personnel_notes TEXT,

    -- Plaene & Dokumente
    escape_plans_current BOOLEAN,
    escape_plans_posted BOOLEAN,
    fire_protection_regulation_valid BOOLEAN,
    fire_protection_regulation_date DATE,
    documents_notes TEXT,

    -- Unterweisungen
    instructions_conducted BOOLEAN,
    last_instruction_date DATE,
    instruction_documentation_exists BOOLEAN,
    instruction_notes TEXT,

    -- Hilfsmittel
    mobility_aids_available BOOLEAN, -- Evakuierungsstuehle etc.
    mobility_aids_notes TEXT,

    -- Sammelplaetze
    assembly_points_defined BOOLEAN,
    assembly_points_marked BOOLEAN,
    assembly_points_notes TEXT,

    -- Alarmierung
    alarm_texts_stored BOOLEAN,
    alarm_system_tested BOOLEAN,
    alarm_notes TEXT,

    -- Erste Hilfe
    first_aid_equipment_available BOOLEAN,
    aed_available BOOLEAN,
    first_aid_notes TEXT,

    -- Gesamtbewertung
    overall_status VARCHAR(20) DEFAULT 'pending',
    -- compliant, partially_compliant, non_compliant, pending
    overall_notes TEXT,

    -- Unterschriften
    inspector_signature TEXT,
    inspector_signed_at TIMESTAMP,
    manager_signature TEXT,
    manager_signed_at TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 4. BAULICHE MASSNAHMEN (Fluchtwege)
-- =====================================================

CREATE TABLE IF NOT EXISTS eva_structural_measures (
    id SERIAL PRIMARY KEY,

    -- Referenz
    building_id INTEGER NOT NULL REFERENCES eva_buildings(id) ON DELETE CASCADE,
    floor VARCHAR(50), -- Etage
    area VARCHAR(255), -- Bereich
    inspection_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    inspector_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Rettungswege
    escape_routes_compliant BOOLEAN,
    escape_route_width_ok BOOLEAN, -- Mind. 0,875m bzw. 1,20m
    escape_route_length_ok BOOLEAN, -- Max. 35m
    escape_routes_notes TEXT,

    -- Rettungsfenster
    rescue_windows_exist BOOLEAN,
    rescue_windows_dimensions_ok BOOLEAN, -- Mind. 0,90m x 1,20m
    rescue_windows_accessible BOOLEAN,
    rescue_windows_notes TEXT,

    -- Verkehrswege
    traffic_routes_clear BOOLEAN,
    no_storage_in_routes BOOLEAN,
    traffic_routes_notes TEXT,

    -- Kennzeichnung
    escape_signs_complete BOOLEAN,
    escape_signs_visible BOOLEAN,
    escape_signs_illuminated BOOLEAN,
    signs_notes TEXT,

    -- Tueren
    doors_easy_to_open BOOLEAN,
    doors_open_direction_ok BOOLEAN, -- In Fluchtrichtung
    panic_locks_installed BOOLEAN,
    panic_locks_functional BOOLEAN,
    doors_notes TEXT,

    -- Elektrische Verriegelungen
    electric_locks_have_emergency_button BOOLEAN,
    emergency_buttons_functional BOOLEAN,
    emergency_buttons_marked BOOLEAN,
    electric_locks_notes TEXT,

    -- Treppen
    stairs_compliant BOOLEAN,
    handrails_installed BOOLEAN,
    stairs_notes TEXT,

    -- Fotos
    photos JSONB DEFAULT '[]',

    -- GPS Position (fuer Mapping)
    gps_latitude DECIMAL(10, 8),
    gps_longitude DECIMAL(11, 8),

    -- Bewertung
    overall_status VARCHAR(20) DEFAULT 'pending',
    overall_notes TEXT,

    -- Unterschrift
    inspector_signature TEXT,
    inspector_signed_at TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 5. TECHNISCHE MASSNAHMEN
-- =====================================================

CREATE TABLE IF NOT EXISTS eva_technical_measures (
    id SERIAL PRIMARY KEY,

    -- Referenz
    building_id INTEGER NOT NULL REFERENCES eva_buildings(id) ON DELETE CASCADE,
    inspection_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    inspector_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Sicherheitsbeleuchtung
    emergency_lighting_functional BOOLEAN,
    emergency_lighting_tested BOOLEAN,
    emergency_lighting_test_date DATE,
    emergency_lighting_notes TEXT,

    -- Rauchabzug
    smoke_extraction_exists BOOLEAN,
    smoke_extraction_tested BOOLEAN,
    smoke_extraction_test_date DATE,
    smoke_extraction_notes TEXT,

    -- Rauchausbreitung
    smoke_spread_prevention_functional BOOLEAN,
    smoke_doors_functional BOOLEAN,
    smoke_prevention_notes TEXT,

    -- Brandmeldeanlage
    fire_alarm_system_functional BOOLEAN,
    fire_alarm_tested BOOLEAN,
    fire_alarm_test_date DATE,
    fire_alarm_notes TEXT,

    -- Alarmierung
    alarm_system_functional BOOLEAN,
    alarm_audible BOOLEAN,
    alarm_visible BOOLEAN, -- Optische Signale
    voice_alarm_texts_stored BOOLEAN,
    alarm_notes TEXT,

    -- Sicherheitsstromversorgung
    emergency_power_functional BOOLEAN,
    emergency_power_tested BOOLEAN,
    emergency_power_test_date DATE,
    emergency_power_duration_minutes INTEGER,
    emergency_power_notes TEXT,

    -- Brandfallsteuermatrix
    fire_control_matrix_exists BOOLEAN,
    fire_control_matrix_tested BOOLEAN,
    fire_control_matrix_date DATE,
    fire_control_matrix_notes TEXT,

    -- Aufzuege
    elevator_fire_control_exists BOOLEAN,
    elevator_fire_control_tested BOOLEAN,
    elevators_notes TEXT,

    -- Optische Alarmierung
    visual_alarm_exists BOOLEAN,
    visual_alarm_functional BOOLEAN,
    visual_alarm_notes TEXT,

    -- Anlagen-Wartungsprotokolle
    maintenance_records JSONB DEFAULT '[]',
    -- [{system, last_maintenance, next_maintenance, provider, notes}]

    -- Fotos & Dokumente
    photos JSONB DEFAULT '[]',
    documents JSONB DEFAULT '[]',

    -- Bewertung
    overall_status VARCHAR(20) DEFAULT 'pending',
    overall_notes TEXT,

    -- Unterschrift
    inspector_signature TEXT,
    inspector_signed_at TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 6. EVAKUIERUNGSUEBUNGEN
-- =====================================================

CREATE TABLE IF NOT EXISTS eva_exercises (
    id SERIAL PRIMARY KEY,

    -- Referenz
    building_id INTEGER NOT NULL REFERENCES eva_buildings(id) ON DELETE CASCADE,
    exercise_number VARCHAR(50) UNIQUE NOT NULL, -- z.B. EVA-2024-001

    -- Planung
    planned_date TIMESTAMP NOT NULL,
    actual_date TIMESTAMP,
    is_announced BOOLEAN DEFAULT true, -- Angekuendigt oder unangekuendigt
    exercise_type VARCHAR(50) DEFAULT 'full', -- full, partial, tabletop

    -- Verantwortliche
    coordinator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    observers JSONB DEFAULT '[]', -- [{user_id, name, area}]

    -- Status
    status VARCHAR(30) DEFAULT 'planned',
    -- planned, preparation, in_progress, completed, cancelled

    -- Kalenderintegration
    calendar_event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 7. UEBUNG - VOR DER UEBUNG
-- =====================================================

CREATE TABLE IF NOT EXISTS eva_exercise_preparation (
    id SERIAL PRIMARY KEY,

    exercise_id INTEGER NOT NULL REFERENCES eva_exercises(id) ON DELETE CASCADE,

    -- Terminabstimmung
    internal_coordination_done BOOLEAN,
    external_coordination_done BOOLEAN, -- Feuerwehr etc.
    coordination_notes TEXT,

    -- Ankuendigung
    announcement_method VARCHAR(100), -- E-Mail, Aushang, etc.
    announcement_date DATE,
    announcement_notes TEXT,

    -- Beobachter
    observers_briefed BOOLEAN,
    observer_briefing_date DATE,
    observer_positions_defined BOOLEAN,
    observer_notes TEXT,

    -- Information Dritter
    neighbors_informed BOOLEAN,
    public_informed BOOLEAN, -- Bei groesseren Uebungen
    authorities_informed BOOLEAN,
    information_notes TEXT,

    -- Dokumentation
    documentation_prepared BOOLEAN,
    cameras_ready BOOLEAN,
    checklists_distributed BOOLEAN,
    documentation_notes TEXT,

    -- Sonstiges
    special_preparations TEXT,

    -- Abschluss
    preparation_complete BOOLEAN DEFAULT false,
    completed_at TIMESTAMP,
    completed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 8. UEBUNG - WAEHREND DER UEBUNG
-- =====================================================

CREATE TABLE IF NOT EXISTS eva_exercise_execution (
    id SERIAL PRIMARY KEY,

    exercise_id INTEGER NOT NULL REFERENCES eva_exercises(id) ON DELETE CASCADE,

    -- Zeiterfassung
    alarm_triggered_at TIMESTAMP,
    building_cleared_at TIMESTAMP,
    all_clear_at TIMESTAMP,
    total_evacuation_time_seconds INTEGER,

    -- Beobachter
    observers_in_position BOOLEAN,
    observer_notes TEXT,

    -- Alarmierung
    alarm_audible BOOLEAN,
    alarm_visible BOOLEAN,
    alarm_understood BOOLEAN,
    alarm_notes TEXT,

    -- Fluchtwege
    escape_routes_used_correctly BOOLEAN,
    alternative_routes_needed BOOLEAN,
    route_notes TEXT,

    -- Probleme
    congestion_occurred BOOLEAN,
    congestion_location TEXT,
    panic_behavior_observed BOOLEAN,
    behavior_notes TEXT,

    -- Sammelplatz
    assembly_point_reached BOOLEAN,
    headcount_conducted BOOLEAN,
    headcount_complete BOOLEAN,
    missing_persons INTEGER DEFAULT 0,
    assembly_notes TEXT,

    -- Besondere Vorkommnisse
    injuries_occurred BOOLEAN,
    injuries_notes TEXT,
    special_incidents TEXT,

    -- Dokumentation
    photos JSONB DEFAULT '[]',
    videos JSONB DEFAULT '[]',

    -- Wetter (kann relevant sein)
    weather_conditions VARCHAR(100),

    -- Teilnehmer
    participants_count INTEGER,
    mobility_impaired_count INTEGER,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 9. UEBUNG - NACH DER UEBUNG
-- =====================================================

CREATE TABLE IF NOT EXISTS eva_exercise_evaluation (
    id SERIAL PRIMARY KEY,

    exercise_id INTEGER NOT NULL REFERENCES eva_exercises(id) ON DELETE CASCADE,

    -- Auswertung
    evaluation_date DATE,
    evaluator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

    -- Bewertung
    overall_rating VARCHAR(20), -- excellent, good, satisfactory, needs_improvement, failed
    evacuation_time_rating VARCHAR(20),
    organization_rating VARCHAR(20),
    communication_rating VARCHAR(20),
    behavior_rating VARCHAR(20),

    -- Erkenntnisse
    positive_findings TEXT,
    negative_findings TEXT,
    improvement_suggestions TEXT,

    -- Massnahmen
    action_items JSONB DEFAULT '[]',
    -- [{title, description, responsible_user_id, due_date, status, priority}]

    -- Naechste Uebung
    next_exercise_recommended_date DATE,
    next_exercise_notes TEXT,

    -- Bericht
    report_generated BOOLEAN DEFAULT false,
    report_url TEXT,
    report_generated_at TIMESTAMP,

    -- Unterschriften
    evaluator_signature TEXT,
    evaluator_signed_at TIMESTAMP,
    manager_signature TEXT,
    manager_signed_at TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 10. MAENGEL & MASSNAHMEN
-- =====================================================

CREATE TABLE IF NOT EXISTS eva_findings (
    id SERIAL PRIMARY KEY,

    -- Polymorphe Referenz
    source_type VARCHAR(30) NOT NULL, -- organizational, structural, technical, exercise
    source_id INTEGER NOT NULL,

    -- Details
    finding_number VARCHAR(50),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    location_detail TEXT,
    category VARCHAR(100),

    -- Schweregrad
    severity VARCHAR(20) NOT NULL DEFAULT 'medium',
    -- low, medium, high, critical

    -- Fotos
    photos JSONB DEFAULT '[]',

    -- Zuweisung
    responsible_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP,

    -- Fristen
    due_date TIMESTAMP,
    reminder_sent BOOLEAN DEFAULT false,

    -- Status
    status VARCHAR(30) DEFAULT 'open',
    -- open, in_progress, pending_verification, resolved, escalated

    -- Loesung
    resolution_notes TEXT,
    resolution_photos JSONB DEFAULT '[]',
    resolved_at TIMESTAMP,
    resolved_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

    -- Verifizierung
    verified_at TIMESTAMP,
    verified_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 11. AUDIT LOG
-- =====================================================

CREATE TABLE IF NOT EXISTS eva_audit_log (
    id SERIAL PRIMARY KEY,

    entity_type VARCHAR(30) NOT NULL,
    entity_id INTEGER NOT NULL,
    action VARCHAR(50) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    ip_address INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 12. INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_eva_buildings_location ON eva_buildings(location_id);
CREATE INDEX IF NOT EXISTS idx_eva_organizational_building ON eva_organizational_measures(building_id);
CREATE INDEX IF NOT EXISTS idx_eva_structural_building ON eva_structural_measures(building_id);
CREATE INDEX IF NOT EXISTS idx_eva_technical_building ON eva_technical_measures(building_id);
CREATE INDEX IF NOT EXISTS idx_eva_exercises_building ON eva_exercises(building_id);
CREATE INDEX IF NOT EXISTS idx_eva_exercises_status ON eva_exercises(status);
CREATE INDEX IF NOT EXISTS idx_eva_exercises_date ON eva_exercises(planned_date);
CREATE INDEX IF NOT EXISTS idx_eva_findings_source ON eva_findings(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_eva_findings_status ON eva_findings(status);
CREATE INDEX IF NOT EXISTS idx_eva_findings_due ON eva_findings(due_date);
CREATE INDEX IF NOT EXISTS idx_eva_audit_entity ON eva_audit_log(entity_type, entity_id);

-- =====================================================
-- 13. DEFAULT CHECKLISTEN-VORLAGEN
-- =====================================================

-- Diese werden als JSON in der Anwendung verwendet
-- Hier nur zur Dokumentation

-- =====================================================
-- 14. PERMISSIONS
-- =====================================================

INSERT INTO permissions (name, description, category) VALUES
    ('eva.view', 'Evakuierungsdaten einsehen', 'evacuation'),
    ('eva.create', 'Evakuierungsdaten erstellen', 'evacuation'),
    ('eva.edit', 'Evakuierungsdaten bearbeiten', 'evacuation'),
    ('eva.delete', 'Evakuierungsdaten loeschen', 'evacuation'),
    ('eva.sign', 'Evakuierungsdokumente unterschreiben', 'evacuation'),
    ('eva.manage_buildings', 'Gebaeude verwalten', 'evacuation'),
    ('eva.manage_exercises', 'Uebungen verwalten', 'evacuation'),
    ('eva.view_all', 'Alle Standorte einsehen', 'evacuation'),
    ('eva.export', 'Berichte exportieren', 'evacuation'),
    ('eva.admin', 'Evakuierungsmodul administrieren', 'evacuation')
ON CONFLICT (name) DO NOTHING;

-- Admin-Rolle alle Berechtigungen geben
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions WHERE category = 'evacuation'
ON CONFLICT DO NOTHING;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE eva_buildings IS 'Gebaeude/Objekte fuer Evakuierungsmanagement';
COMMENT ON TABLE eva_organizational_measures IS 'Organisatorische Massnahmen (Checkliste)';
COMMENT ON TABLE eva_structural_measures IS 'Bauliche Massnahmen - Fluchtwege';
COMMENT ON TABLE eva_technical_measures IS 'Technische Massnahmen - Anlagen';
COMMENT ON TABLE eva_exercises IS 'Evakuierungsuebungen';
COMMENT ON TABLE eva_exercise_preparation IS 'Uebungsvorbereitung';
COMMENT ON TABLE eva_exercise_execution IS 'Uebungsdurchfuehrung';
COMMENT ON TABLE eva_exercise_evaluation IS 'Uebungsauswertung';
COMMENT ON TABLE eva_findings IS 'Feststellungen und Massnahmen';
