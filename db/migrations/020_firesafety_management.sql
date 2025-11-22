-- =====================================================
-- Migration 020: Brandschutz- & Sicherheitsmanagement (BSM)
-- Zentrale Verwaltung aller Brandschutzpruefungen
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
    'FireSafety',
    'Brandschutz-Management',
    'Zentrale digitale Verwaltung aller Brandschutzpruefungen, Kontrollen und Dokumentation (TUEV/FeuerTrutz-konform)',
    '1.0.0',
    'Jan Guenther <jg@linxpress.de>',
    'firesafety',
    true,
    420,
    '["Events", "ASG", "Evacuation"]'::jsonb,
    '{
        "features": {
            "checklist_engine": true,
            "escalation": true,
            "pdf_reports": true,
            "photo_documentation": true,
            "digital_signature": true,
            "calendar_sync": true
        },
        "checklists": ["ordnung", "infrastruktur", "fluchtwege", "baulich", "betrieblich"],
        "escalation_levels": ["hausmeister", "sicherheitsbeauftragter", "geschaeftsfuehrung"],
        "defaults": {
            "review_interval_months": 12,
            "reminder_days_before": 14,
            "escalation_days": [7, 3, 1]
        }
    }'::jsonb
) ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    version = EXCLUDED.version,
    module_config = EXCLUDED.module_config;

-- =====================================================
-- 2. BRANDSCHUTZ-OBJEKTE (Gebaeude/Bereiche)
-- =====================================================

CREATE TABLE IF NOT EXISTS bsm_objects (
    id SERIAL PRIMARY KEY,

    -- Referenz
    location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
    building_id INTEGER REFERENCES eva_buildings(id) ON DELETE SET NULL, -- Optional Link zu EVA

    -- Basis
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    object_type VARCHAR(100), -- Buero, Produktion, Lager, Werkstatt, etc.
    address TEXT,

    -- Details
    floors INTEGER DEFAULT 1,
    total_area_sqm DECIMAL(10,2),
    fire_class VARCHAR(50), -- Brandschutzklasse
    building_class VARCHAR(50), -- Gebaeudelasse nach LBO

    -- Verantwortliche
    fire_safety_officer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    facility_manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

    -- Pruefintervalle
    last_inspection_date DATE,
    next_inspection_due DATE,
    inspection_interval_months INTEGER DEFAULT 12,

    -- Status
    overall_status VARCHAR(20) DEFAULT 'pending',
    -- compliant, partially_compliant, non_compliant, pending
    is_active BOOLEAN DEFAULT true,

    -- Dokumente
    fire_protection_plan_url TEXT,
    escape_plan_url TEXT,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 3. CHECKLISTE 1: ORDNUNG & SAUBERKEIT
-- =====================================================

CREATE TABLE IF NOT EXISTS bsm_ordnung_checks (
    id SERIAL PRIMARY KEY,

    -- Referenz
    object_id INTEGER NOT NULL REFERENCES bsm_objects(id) ON DELETE CASCADE,
    inspection_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    inspector_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    area VARCHAR(255), -- Bereich im Gebaeude

    -- Rauchen
    smoking_ban_enforced BOOLEAN,
    smoking_areas_designated BOOLEAN,
    smoking_notes TEXT,

    -- Abfaelle
    flammable_waste_removed BOOLEAN,
    cleaning_rags_stored_safely BOOLEAN,
    waste_containers_compliant BOOLEAN,
    waste_notes TEXT,

    -- Keller & Lagerraeume
    basement_orderly BOOLEAN,
    storage_rooms_clear BOOLEAN,
    no_flammable_storage_in_corridors BOOLEAN,
    storage_notes TEXT,

    -- Brennbare Fluessigkeiten
    flammable_liquids_stored_correctly BOOLEAN,
    safety_cabinets_used BOOLEAN,
    max_quantities_observed BOOLEAN,
    liquids_notes TEXT,

    -- Druckgasbehaelter
    gas_cylinders_secured BOOLEAN,
    gas_cylinders_stored_correctly BOOLEAN,
    gas_notes TEXT,

    -- Brandstiftungsschutz
    arson_protection_measures BOOLEAN,
    exterior_secured BOOLEAN,
    containers_locked BOOLEAN,
    arson_notes TEXT,

    -- Sicherheitsabstaende
    safety_distances_observed BOOLEAN,
    distance_to_ignition_sources BOOLEAN,
    fire_bridges_prevented BOOLEAN,
    distances_notes TEXT,

    -- Fotos
    photos JSONB DEFAULT '[]',

    -- Bewertung
    overall_status VARCHAR(20) DEFAULT 'pending',
    priority VARCHAR(20) DEFAULT 'medium',
    notes TEXT,

    -- Unterschrift
    inspector_signature TEXT,
    inspector_signed_at TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 4. CHECKLISTE 2: BRANDSCHUTZINFRASTRUKTUR
-- =====================================================

CREATE TABLE IF NOT EXISTS bsm_infrastruktur_checks (
    id SERIAL PRIMARY KEY,

    -- Referenz
    object_id INTEGER NOT NULL REFERENCES bsm_objects(id) ON DELETE CASCADE,
    inspection_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    inspector_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Feuerloescher
    extinguishers_accessible BOOLEAN,
    extinguishers_marked BOOLEAN,
    extinguishers_inspected BOOLEAN,
    extinguisher_inspection_date DATE,
    extinguisher_count INTEGER,
    extinguisher_notes TEXT,

    -- Unterweisungen
    employee_training_conducted BOOLEAN,
    last_training_date DATE,
    training_documentation_exists BOOLEAN,
    training_notes TEXT,

    -- Loeschwasserversorgung
    fire_water_supply_functional BOOLEAN,
    hydrants_accessible BOOLEAN,
    hydrants_marked BOOLEAN,
    water_pressure_ok BOOLEAN,
    water_notes TEXT,

    -- Handmelder / Druckknoepfe
    manual_call_points_functional BOOLEAN,
    call_points_accessible BOOLEAN,
    call_points_marked BOOLEAN,
    call_points_tested BOOLEAN,
    call_points_test_date DATE,
    call_points_notes TEXT,

    -- Alarmsysteme
    sirens_functional BOOLEAN,
    optical_alarms_functional BOOLEAN,
    voice_alarm_functional BOOLEAN,
    alarm_audible_everywhere BOOLEAN,
    alarm_test_date DATE,
    alarm_notes TEXT,

    -- Wartungsvertraege
    sprinkler_maintenance_contract BOOLEAN,
    sprinkler_last_maintenance DATE,
    rwa_maintenance_contract BOOLEAN,
    rwa_last_maintenance DATE,
    bma_maintenance_contract BOOLEAN,
    bma_last_maintenance DATE,
    maintenance_notes TEXT,

    -- Fotos & Dokumente
    photos JSONB DEFAULT '[]',
    documents JSONB DEFAULT '[]',

    -- Bewertung
    overall_status VARCHAR(20) DEFAULT 'pending',
    priority VARCHAR(20) DEFAULT 'medium',
    notes TEXT,

    -- Unterschrift
    inspector_signature TEXT,
    inspector_signed_at TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 5. CHECKLISTE 3: FLUCHT- & RETTUNGSWEGE
-- =====================================================

CREATE TABLE IF NOT EXISTS bsm_fluchtwege_checks (
    id SERIAL PRIMARY KEY,

    -- Referenz
    object_id INTEGER NOT NULL REFERENCES bsm_objects(id) ON DELETE CASCADE,
    inspection_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    inspector_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    floor VARCHAR(50),
    area VARCHAR(255),

    -- Gesetzliche Rettungswege
    escape_routes_legal_compliant BOOLEAN,
    two_independent_routes BOOLEAN,
    max_distance_observed BOOLEAN, -- Max 35m
    routes_notes TEXT,

    -- Rettungsfenster
    rescue_windows_exist BOOLEAN,
    window_dimensions_ok BOOLEAN, -- Mind. 0,90m x 1,20m
    windows_accessible BOOLEAN,
    windows_notes TEXT,

    -- Verkehrswege
    traffic_routes_clear BOOLEAN,
    min_width_observed BOOLEAN, -- Mind. 0,875m / 1,20m
    no_obstacles BOOLEAN,
    traffic_notes TEXT,

    -- Kennzeichnung
    escape_signs_complete BOOLEAN,
    signs_illuminated BOOLEAN,
    signs_visible BOOLEAN,
    emergency_lighting_functional BOOLEAN,
    signs_notes TEXT,

    -- Tueren
    doors_open_easily BOOLEAN,
    doors_direction_correct BOOLEAN, -- In Fluchtrichtung
    panic_hardware_installed BOOLEAN,
    panic_hardware_functional BOOLEAN,
    doors_notes TEXT,

    -- Elektrische Verriegelungen
    electric_locks_have_emergency BOOLEAN,
    emergency_buttons_functional BOOLEAN,
    emergency_buttons_marked BOOLEAN,
    power_fail_opens_doors BOOLEAN,
    electric_notes TEXT,

    -- Fotos & GPS
    photos JSONB DEFAULT '[]',
    gps_latitude DECIMAL(10, 8),
    gps_longitude DECIMAL(11, 8),

    -- Bewertung
    overall_status VARCHAR(20) DEFAULT 'pending',
    priority VARCHAR(20) DEFAULT 'medium',
    notes TEXT,

    -- Unterschrift
    inspector_signature TEXT,
    inspector_signed_at TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 6. CHECKLISTE 4: BAULICHER BRANDSCHUTZ
-- =====================================================

CREATE TABLE IF NOT EXISTS bsm_baulich_checks (
    id SERIAL PRIMARY KEY,

    -- Referenz
    object_id INTEGER NOT NULL REFERENCES bsm_objects(id) ON DELETE CASCADE,
    inspection_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    inspector_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    floor VARCHAR(50),
    area VARCHAR(255),

    -- Bauliche Massnahmen
    construction_changes_documented BOOLEAN,
    room_usage_changes_documented BOOLEAN,
    changes_approved BOOLEAN,
    construction_notes TEXT,

    -- Feuerschutzabschluesse
    fire_doors_functional BOOLEAN,
    fire_doors_close_properly BOOLEAN,
    self_closers_functional BOOLEAN,
    door_sequence_controllers_ok BOOLEAN,
    fire_doors_not_blocked BOOLEAN,
    fire_doors_notes TEXT,

    -- Brandwaende
    fire_walls_intact BOOLEAN,
    no_unauthorized_openings BOOLEAN,
    penetrations_sealed BOOLEAN,
    fire_walls_notes TEXT,

    -- Decken
    ceiling_openings_sealed BOOLEAN,
    suspended_ceilings_compliant BOOLEAN,
    ceiling_notes TEXT,

    -- Abschottungen
    cable_penetrations_sealed BOOLEAN,
    pipe_penetrations_sealed BOOLEAN,
    sealing_certified BOOLEAN,
    sealing_documentation_exists BOOLEAN,
    sealing_notes TEXT,

    -- Fotos
    photos JSONB DEFAULT '[]',

    -- Bewertung
    overall_status VARCHAR(20) DEFAULT 'pending',
    priority VARCHAR(20) DEFAULT 'medium',
    notes TEXT,

    -- Unterschrift
    inspector_signature TEXT,
    inspector_signed_at TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 7. CHECKLISTE 5: BETRIEBLICHER BRANDSCHUTZ
-- =====================================================

CREATE TABLE IF NOT EXISTS bsm_betrieblich_checks (
    id SERIAL PRIMARY KEY,

    -- Referenz
    object_id INTEGER NOT NULL REFERENCES bsm_objects(id) ON DELETE CASCADE,
    inspection_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    inspector_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Brandschutzordnung
    fire_protection_regulation_exists BOOLEAN,
    regulation_current BOOLEAN,
    regulation_date DATE,
    regulation_known_to_employees BOOLEAN,
    regulation_posted BOOLEAN,
    regulation_notes TEXT,

    -- Schulungen
    regular_training_conducted BOOLEAN,
    last_training_date DATE,
    next_training_due DATE,
    training_documentation_exists BOOLEAN,
    new_employee_training BOOLEAN,
    training_notes TEXT,

    -- Personal
    fire_safety_officer_appointed BOOLEAN,
    fire_safety_officer_trained BOOLEAN,
    floor_wardens_appointed BOOLEAN,
    floor_wardens_per_floor INTEGER,
    first_aiders_available BOOLEAN,
    personnel_notes TEXT,

    -- Raeumungshelfer
    evacuation_helpers_appointed BOOLEAN,
    helpers_trained BOOLEAN,
    helpers_per_floor INTEGER,
    evacuation_notes TEXT,

    -- Feuerwehrplaene
    fire_brigade_plans_exist BOOLEAN,
    plans_current BOOLEAN,
    plans_visible BOOLEAN,
    fire_brigade_access_clear BOOLEAN,
    hydrants_accessible_for_fb BOOLEAN,
    fire_brigade_notes TEXT,

    -- Elektrische Anlagen
    electrical_inspection_current BOOLEAN,
    last_e_check_date DATE,
    next_e_check_due DATE,
    e_check_sticker_visible BOOLEAN,
    no_overloaded_outlets BOOLEAN,
    no_damaged_cables BOOLEAN,
    electrical_notes TEXT,

    -- Fotos & Dokumente
    photos JSONB DEFAULT '[]',
    documents JSONB DEFAULT '[]',

    -- Bewertung
    overall_status VARCHAR(20) DEFAULT 'pending',
    priority VARCHAR(20) DEFAULT 'medium',
    notes TEXT,

    -- Unterschrift
    inspector_signature TEXT,
    inspector_signed_at TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 8. MAENGEL & MASSNAHMEN
-- =====================================================

CREATE TABLE IF NOT EXISTS bsm_defects (
    id SERIAL PRIMARY KEY,

    -- Referenz
    object_id INTEGER NOT NULL REFERENCES bsm_objects(id) ON DELETE CASCADE,
    checklist_type VARCHAR(30) NOT NULL, -- ordnung, infrastruktur, fluchtwege, baulich, betrieblich
    checklist_id INTEGER NOT NULL,

    -- Details
    defect_number VARCHAR(50),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    location_detail TEXT,
    category VARCHAR(100),

    -- Klassifizierung
    priority VARCHAR(20) NOT NULL DEFAULT 'medium', -- low, medium, high, critical
    fire_risk_level VARCHAR(20), -- Brandrisiko-Einschaetzung

    -- Fotos
    photos JSONB DEFAULT '[]',

    -- Zuweisung
    responsible_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP,

    -- Eskalation
    escalation_level INTEGER DEFAULT 0, -- 0=keine, 1=Hausmeister, 2=Sicherheit, 3=GF
    escalated_to_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    escalated_at TIMESTAMP,

    -- Fristen
    due_date TIMESTAMP,
    reminder_sent BOOLEAN DEFAULT false,
    escalation_reminder_sent BOOLEAN DEFAULT false,

    -- Status
    status VARCHAR(30) DEFAULT 'open',
    -- open, in_progress, pending_verification, resolved, escalated, deferred

    -- Loesung
    resolution_notes TEXT,
    resolution_photos JSONB DEFAULT '[]',
    resolved_at TIMESTAMP,
    resolved_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    resolution_signature TEXT,

    -- Verifizierung
    verified_at TIMESTAMP,
    verified_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    verification_signature TEXT,

    -- Kalender
    calendar_event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 9. SCHULUNGEN & UNTERWEISUNGEN
-- =====================================================

CREATE TABLE IF NOT EXISTS bsm_trainings (
    id SERIAL PRIMARY KEY,

    -- Referenz
    object_id INTEGER REFERENCES bsm_objects(id) ON DELETE SET NULL,

    -- Details
    training_type VARCHAR(100) NOT NULL, -- Brandschutz, Evakuierung, Ersthelfer, etc.
    title VARCHAR(255) NOT NULL,
    description TEXT,

    -- Zeitplanung
    planned_date TIMESTAMP,
    actual_date TIMESTAMP,
    duration_minutes INTEGER,

    -- Durchfuehrung
    trainer_name VARCHAR(255),
    trainer_external BOOLEAN DEFAULT false,
    location VARCHAR(255),

    -- Teilnehmer
    participants JSONB DEFAULT '[]', -- [{user_id, name, signed, signed_at}]
    participant_count INTEGER DEFAULT 0,

    -- Dokumentation
    agenda TEXT,
    materials JSONB DEFAULT '[]',
    photos JSONB DEFAULT '[]',

    -- Naechste Schulung
    repeat_interval_months INTEGER,
    next_training_due DATE,

    -- Status
    status VARCHAR(30) DEFAULT 'planned', -- planned, completed, cancelled

    -- Kalender
    calendar_event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 10. WARTUNGSVERTRAEGE & PRUEFUNGEN
-- =====================================================

CREATE TABLE IF NOT EXISTS bsm_maintenance (
    id SERIAL PRIMARY KEY,

    -- Referenz
    object_id INTEGER NOT NULL REFERENCES bsm_objects(id) ON DELETE CASCADE,

    -- System/Anlage
    system_type VARCHAR(100) NOT NULL, -- BMA, RWA, Sprinkler, Feuerloescher, E-Check, etc.
    system_name VARCHAR(255),
    manufacturer VARCHAR(255),
    installation_date DATE,

    -- Wartungsvertrag
    has_contract BOOLEAN DEFAULT false,
    contractor_name VARCHAR(255),
    contractor_contact TEXT,
    contract_number VARCHAR(100),
    contract_expires DATE,

    -- Pruefungen
    inspection_interval_months INTEGER DEFAULT 12,
    last_inspection_date DATE,
    next_inspection_due DATE,
    last_inspector VARCHAR(255),

    -- Status
    status VARCHAR(20) DEFAULT 'ok', -- ok, warning, overdue, defect

    -- Dokumente
    documents JSONB DEFAULT '[]',

    -- Kalender
    calendar_event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 11. AUDIT LOG
-- =====================================================

CREATE TABLE IF NOT EXISTS bsm_audit_log (
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

CREATE INDEX IF NOT EXISTS idx_bsm_objects_location ON bsm_objects(location_id);
CREATE INDEX IF NOT EXISTS idx_bsm_objects_status ON bsm_objects(overall_status);
CREATE INDEX IF NOT EXISTS idx_bsm_ordnung_object ON bsm_ordnung_checks(object_id);
CREATE INDEX IF NOT EXISTS idx_bsm_infrastruktur_object ON bsm_infrastruktur_checks(object_id);
CREATE INDEX IF NOT EXISTS idx_bsm_fluchtwege_object ON bsm_fluchtwege_checks(object_id);
CREATE INDEX IF NOT EXISTS idx_bsm_baulich_object ON bsm_baulich_checks(object_id);
CREATE INDEX IF NOT EXISTS idx_bsm_betrieblich_object ON bsm_betrieblich_checks(object_id);
CREATE INDEX IF NOT EXISTS idx_bsm_defects_object ON bsm_defects(object_id);
CREATE INDEX IF NOT EXISTS idx_bsm_defects_status ON bsm_defects(status);
CREATE INDEX IF NOT EXISTS idx_bsm_defects_due ON bsm_defects(due_date);
CREATE INDEX IF NOT EXISTS idx_bsm_defects_priority ON bsm_defects(priority);
CREATE INDEX IF NOT EXISTS idx_bsm_trainings_object ON bsm_trainings(object_id);
CREATE INDEX IF NOT EXISTS idx_bsm_trainings_due ON bsm_trainings(next_training_due);
CREATE INDEX IF NOT EXISTS idx_bsm_maintenance_object ON bsm_maintenance(object_id);
CREATE INDEX IF NOT EXISTS idx_bsm_maintenance_due ON bsm_maintenance(next_inspection_due);
CREATE INDEX IF NOT EXISTS idx_bsm_audit_entity ON bsm_audit_log(entity_type, entity_id);

-- =====================================================
-- 13. PERMISSIONS
-- =====================================================

INSERT INTO permissions (name, description, category) VALUES
    ('bsm.view', 'Brandschutzdaten einsehen', 'firesafety'),
    ('bsm.create', 'Brandschutzpruefungen erstellen', 'firesafety'),
    ('bsm.edit', 'Brandschutzdaten bearbeiten', 'firesafety'),
    ('bsm.delete', 'Brandschutzdaten loeschen', 'firesafety'),
    ('bsm.sign', 'Brandschutzprotokolle unterschreiben', 'firesafety'),
    ('bsm.manage_objects', 'Brandschutzobjekte verwalten', 'firesafety'),
    ('bsm.manage_trainings', 'Schulungen verwalten', 'firesafety'),
    ('bsm.manage_maintenance', 'Wartungen verwalten', 'firesafety'),
    ('bsm.escalate', 'Maengel eskalieren', 'firesafety'),
    ('bsm.view_all', 'Alle Standorte einsehen', 'firesafety'),
    ('bsm.export', 'Berichte exportieren', 'firesafety'),
    ('bsm.admin', 'Brandschutzmodul administrieren', 'firesafety')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions WHERE category = 'firesafety'
ON CONFLICT DO NOTHING;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE bsm_objects IS 'Brandschutzobjekte (Gebaeude/Bereiche)';
COMMENT ON TABLE bsm_ordnung_checks IS 'Checkliste 1: Ordnung & Sauberkeit';
COMMENT ON TABLE bsm_infrastruktur_checks IS 'Checkliste 2: Brandschutzinfrastruktur';
COMMENT ON TABLE bsm_fluchtwege_checks IS 'Checkliste 3: Flucht- & Rettungswege';
COMMENT ON TABLE bsm_baulich_checks IS 'Checkliste 4: Baulicher Brandschutz';
COMMENT ON TABLE bsm_betrieblich_checks IS 'Checkliste 5: Betrieblicher Brandschutz';
COMMENT ON TABLE bsm_defects IS 'Maengel aus allen Checklisten';
COMMENT ON TABLE bsm_trainings IS 'Brandschutz-Schulungen';
COMMENT ON TABLE bsm_maintenance IS 'Wartungsvertraege & Pruefungen';
