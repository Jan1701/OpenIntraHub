-- =====================================================
-- Migration 018: Arbeitssicherheits- & Gesundheitskontrolle (ASG)
-- Digitale Erfassung von Sicherheitsmaengeln und Kontrollen
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
    'ASG',
    'Arbeitssicherheit & Gesundheit',
    'Digitale Erfassung, Verwaltung und Dokumentation von Sicherheitsmaengeln, Kontrollen und Massnahmen (BGHW-konform)',
    '1.0.0',
    'Jan Guenther <jg@linxpress.de>',
    'asg',
    true,
    400,
    '["Events"]'::jsonb,
    '{
        "features": {
            "photo_upload": true,
            "digital_signature": true,
            "pdf_export": true,
            "calendar_sync": true,
            "escalation": true,
            "audit_trail": true
        },
        "defaults": {
            "default_deadline_days": 14,
            "escalation_days_before": 3,
            "danger_levels": ["low", "medium", "high", "critical"],
            "max_photo_size_mb": 10
        },
        "distribution": {
            "white": "Unternehmer/Vorgesetzter",
            "red": "Betriebsrat/Sicherheitsbeauftragter",
            "yellow": "Pruefer"
        }
    }'::jsonb
) ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    version = EXCLUDED.version,
    module_config = EXCLUDED.module_config;

-- =====================================================
-- 2. PRUEFLISTEN (CHECKLISTEN-VORLAGEN)
-- =====================================================

CREATE TABLE IF NOT EXISTS asg_checklists (
    id SERIAL PRIMARY KEY,

    -- Basic Info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100), -- z.B. "Buero", "Werkstatt", "Lager", "Aussendienst"

    -- Template Content
    check_items JSONB DEFAULT '[]', -- Array of check items with categories
    -- Format: [{"category": "Brandschutz", "items": [{"id": 1, "text": "Feuerloescher vorhanden", "required": true}]}]

    -- Versioning
    version VARCHAR(20) DEFAULT '1.0',
    is_active BOOLEAN DEFAULT true,

    -- Compliance
    legal_basis TEXT, -- z.B. "BGHW", "ArbSchG", "BetrSichV"
    review_interval_months INTEGER DEFAULT 12,
    last_reviewed_at TIMESTAMP,

    -- Metadata
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 3. KONTROLLEN (INSPECTIONS)
-- =====================================================

CREATE TABLE IF NOT EXISTS asg_inspections (
    id SERIAL PRIMARY KEY,

    -- Reference Number
    inspection_number VARCHAR(50) UNIQUE NOT NULL, -- z.B. "ASG-2024-001"

    -- Location/Scope
    location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    department VARCHAR(255), -- Abteilung / Arbeitsbereich
    work_area TEXT, -- Detaillierte Ortsangabe

    -- Inspection Details
    checklist_id INTEGER REFERENCES asg_checklists(id) ON DELETE SET NULL,
    inspection_type VARCHAR(50) DEFAULT 'regular', -- regular, incident, follow_up, audit

    -- Personnel
    inspector_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    supervisor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    safety_officer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

    -- Timing
    inspection_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    scheduled_date TIMESTAMP, -- Geplantes Datum
    completion_date TIMESTAMP, -- Abschlussdatum

    -- Status
    status VARCHAR(30) DEFAULT 'draft',
    -- draft, in_progress, pending_review, completed, archived

    -- Results Summary
    total_defects INTEGER DEFAULT 0,
    critical_defects INTEGER DEFAULT 0,
    resolved_defects INTEGER DEFAULT 0,

    -- Checklist Results
    checklist_results JSONB DEFAULT '{}', -- Completed checklist with answers

    -- Signatures
    inspector_signature TEXT, -- Base64 encoded signature
    inspector_signed_at TIMESTAMP,
    supervisor_signature TEXT,
    supervisor_signed_at TIMESTAMP,

    -- Notes
    general_notes TEXT,
    recommendations TEXT,

    -- Calendar Integration
    calendar_event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 4. MAENGEL (DEFECTS)
-- =====================================================

CREATE TABLE IF NOT EXISTS asg_defects (
    id SERIAL PRIMARY KEY,

    -- Reference
    inspection_id INTEGER NOT NULL REFERENCES asg_inspections(id) ON DELETE CASCADE,
    defect_number INTEGER NOT NULL, -- Lfd. Nummer innerhalb der Kontrolle

    -- Description
    title VARCHAR(255) NOT NULL, -- Kurze Bezeichnung
    description TEXT NOT NULL, -- Detaillierte Beschreibung
    location_detail TEXT NOT NULL, -- Genaue Ortsangabe

    -- Classification
    danger_level VARCHAR(20) NOT NULL DEFAULT 'medium',
    -- low (gering), medium (mittel), high (hoch), critical (kritisch)
    category VARCHAR(100), -- z.B. "Brandschutz", "Stolpergefahr", "Elektrik"

    -- Evidence
    photos JSONB DEFAULT '[]', -- Array of photo URLs/paths
    -- Format: [{"url": "/uploads/asg/...", "caption": "...", "taken_at": "..."}]

    -- Responsibility
    responsible_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP,

    -- Deadlines
    deadline TIMESTAMP, -- Frist zur Erledigung
    deadline_set_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    escalation_date TIMESTAMP, -- Automatische Eskalation

    -- Resolution
    status VARCHAR(30) DEFAULT 'open',
    -- open, in_progress, pending_verification, resolved, escalated, wont_fix
    resolved_at TIMESTAMP,
    resolved_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    resolution_signature TEXT, -- Digitale Unterschrift bei Erledigung
    resolution_notes TEXT,
    resolution_photos JSONB DEFAULT '[]', -- Nachweisfotos

    -- Verification
    verified_at TIMESTAMP,
    verified_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    verification_signature TEXT,
    verification_notes TEXT,

    -- Calendar Integration (Frist als Kalendereintrag)
    deadline_event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(inspection_id, defect_number)
);

-- =====================================================
-- 5. MASSNAHMEN (CORRECTIVE ACTIONS)
-- =====================================================

CREATE TABLE IF NOT EXISTS asg_actions (
    id SERIAL PRIMARY KEY,

    -- Reference
    defect_id INTEGER NOT NULL REFERENCES asg_defects(id) ON DELETE CASCADE,

    -- Action Details
    action_type VARCHAR(50) NOT NULL, -- immediate, short_term, long_term, preventive
    title VARCHAR(255) NOT NULL,
    description TEXT,

    -- Assignment
    assigned_to_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

    -- Timeline
    due_date TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,

    -- Status
    status VARCHAR(30) DEFAULT 'pending',
    -- pending, in_progress, completed, cancelled
    priority INTEGER DEFAULT 2, -- 1=highest, 5=lowest

    -- Progress
    progress_percent INTEGER DEFAULT 0,

    -- Evidence
    attachments JSONB DEFAULT '[]', -- Nachweise, Dokumente

    -- Costs (optional)
    estimated_cost DECIMAL(10,2),
    actual_cost DECIMAL(10,2),

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 6. KOMMENTARE & KOMMUNIKATION
-- =====================================================

CREATE TABLE IF NOT EXISTS asg_comments (
    id SERIAL PRIMARY KEY,

    -- Polymorphic Reference
    entity_type VARCHAR(30) NOT NULL, -- inspection, defect, action
    entity_id INTEGER NOT NULL,

    -- Content
    comment TEXT NOT NULL,
    attachments JSONB DEFAULT '[]',

    -- Author
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Visibility
    is_internal BOOLEAN DEFAULT false, -- Nur fuer Admins/Sicherheitsbeauftragte

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 7. DOKUMENTEN-VERTEILER
-- =====================================================

CREATE TABLE IF NOT EXISTS asg_distributions (
    id SERIAL PRIMARY KEY,

    -- Reference
    inspection_id INTEGER NOT NULL REFERENCES asg_inspections(id) ON DELETE CASCADE,

    -- Distribution Type (Farbe des Blattes)
    distribution_type VARCHAR(20) NOT NULL, -- white, red, yellow
    -- white = Unternehmer/Vorgesetzter
    -- red = Betriebsrat/Sicherheitsbeauftragter
    -- yellow = Pruefer

    -- Recipient
    recipient_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    recipient_email VARCHAR(255),
    recipient_role VARCHAR(100), -- Rolle/Position

    -- Document
    pdf_path TEXT, -- Pfad zur generierten PDF
    generated_at TIMESTAMP,

    -- Delivery
    sent_at TIMESTAMP,
    sent_method VARCHAR(30), -- email, internal, download
    viewed_at TIMESTAMP,
    acknowledged_at TIMESTAMP,
    acknowledged_signature TEXT,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 8. AUDIT LOG (Nachvollziehbarkeit)
-- =====================================================

CREATE TABLE IF NOT EXISTS asg_audit_log (
    id SERIAL PRIMARY KEY,

    -- Reference
    entity_type VARCHAR(30) NOT NULL,
    entity_id INTEGER NOT NULL,

    -- Action
    action VARCHAR(50) NOT NULL, -- created, updated, status_changed, signed, etc.

    -- Changes
    old_values JSONB,
    new_values JSONB,

    -- Actor
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    ip_address INET,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 9. INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_asg_inspections_location ON asg_inspections(location_id);
CREATE INDEX IF NOT EXISTS idx_asg_inspections_inspector ON asg_inspections(inspector_id);
CREATE INDEX IF NOT EXISTS idx_asg_inspections_status ON asg_inspections(status);
CREATE INDEX IF NOT EXISTS idx_asg_inspections_date ON asg_inspections(inspection_date DESC);

CREATE INDEX IF NOT EXISTS idx_asg_defects_inspection ON asg_defects(inspection_id);
CREATE INDEX IF NOT EXISTS idx_asg_defects_responsible ON asg_defects(responsible_user_id);
CREATE INDEX IF NOT EXISTS idx_asg_defects_status ON asg_defects(status);
CREATE INDEX IF NOT EXISTS idx_asg_defects_deadline ON asg_defects(deadline);
CREATE INDEX IF NOT EXISTS idx_asg_defects_danger ON asg_defects(danger_level);

CREATE INDEX IF NOT EXISTS idx_asg_actions_defect ON asg_actions(defect_id);
CREATE INDEX IF NOT EXISTS idx_asg_actions_assigned ON asg_actions(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_asg_actions_status ON asg_actions(status);

CREATE INDEX IF NOT EXISTS idx_asg_comments_entity ON asg_comments(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_asg_audit_entity ON asg_audit_log(entity_type, entity_id);

-- =====================================================
-- 10. DEFAULT CHECKLISTS
-- =====================================================

INSERT INTO asg_checklists (name, description, category, legal_basis, check_items, created_by) VALUES
(
    'Allgemeine Arbeitsplatzkontrolle',
    'Standardpruefung fuer Buero- und Verwaltungsarbeitsplaetze',
    'Buero',
    'ArbSchG, ArbStaettV',
    '[
        {
            "category": "Verkehrswege",
            "items": [
                {"id": 1, "text": "Fluchtwege frei und gekennzeichnet", "required": true},
                {"id": 2, "text": "Keine Stolperstellen", "required": true},
                {"id": 3, "text": "Ausreichende Beleuchtung", "required": true}
            ]
        },
        {
            "category": "Brandschutz",
            "items": [
                {"id": 4, "text": "Feuerloescher vorhanden und geprueft", "required": true},
                {"id": 5, "text": "Brandmeldeanlage funktionsfaehig", "required": true},
                {"id": 6, "text": "Notausgaenge nicht verstellt", "required": true}
            ]
        },
        {
            "category": "Erste Hilfe",
            "items": [
                {"id": 7, "text": "Verbandkasten vollstaendig", "required": true},
                {"id": 8, "text": "Ersthelfer benannt und geschult", "required": true},
                {"id": 9, "text": "Notrufnummern ausgehaengt", "required": false}
            ]
        },
        {
            "category": "Elektrische Anlagen",
            "items": [
                {"id": 10, "text": "Keine defekten Kabel/Stecker", "required": true},
                {"id": 11, "text": "Steckdosen nicht ueberlastet", "required": true},
                {"id": 12, "text": "Elektrische Geraete geprueft", "required": false}
            ]
        },
        {
            "category": "Ergonomie",
            "items": [
                {"id": 13, "text": "Bildschirmarbeitsplatz korrekt eingerichtet", "required": false},
                {"id": 14, "text": "Buerostuhl funktionsfaehig", "required": false},
                {"id": 15, "text": "Ausreichend Tageslicht", "required": false}
            ]
        }
    ]'::jsonb,
    1
),
(
    'Werkstatt-Sicherheitskontrolle',
    'Pruefung fuer Werkstaetten und Produktionsbereiche',
    'Werkstatt',
    'ArbSchG, BetrSichV, DGUV',
    '[
        {
            "category": "Maschinen & Geraete",
            "items": [
                {"id": 1, "text": "Schutzeinrichtungen vorhanden und funktionsfaehig", "required": true},
                {"id": 2, "text": "Not-Aus-Schalter erreichbar und geprueft", "required": true},
                {"id": 3, "text": "Maschinen ordnungsgemaess gekennzeichnet", "required": true}
            ]
        },
        {
            "category": "Persoenliche Schutzausruestung",
            "items": [
                {"id": 4, "text": "PSA vorhanden und in gutem Zustand", "required": true},
                {"id": 5, "text": "PSA wird getragen", "required": true},
                {"id": 6, "text": "Unterweisung zur PSA erfolgt", "required": true}
            ]
        },
        {
            "category": "Gefahrstoffe",
            "items": [
                {"id": 7, "text": "Gefahrstoffe korrekt gelagert", "required": true},
                {"id": 8, "text": "Sicherheitsdatenblaetter vorhanden", "required": true},
                {"id": 9, "text": "Behaelter ordnungsgemaess beschriftet", "required": true}
            ]
        },
        {
            "category": "Ordnung & Sauberkeit",
            "items": [
                {"id": 10, "text": "Arbeitsplatz aufgeraeumt", "required": false},
                {"id": 11, "text": "Abfaelle ordnungsgemaess entsorgt", "required": true},
                {"id": 12, "text": "Oelflecken/Rutschgefahren beseitigt", "required": true}
            ]
        }
    ]'::jsonb,
    1
),
(
    'Lager-Sicherheitskontrolle',
    'Pruefung fuer Lager- und Logistikbereiche',
    'Lager',
    'ArbSchG, BetrSichV, TRBS',
    '[
        {
            "category": "Regale & Lagerung",
            "items": [
                {"id": 1, "text": "Regale standsicher und unbeschaedigt", "required": true},
                {"id": 2, "text": "Maximale Traglasten eingehalten", "required": true},
                {"id": 3, "text": "Schwere Lasten unten gelagert", "required": true}
            ]
        },
        {
            "category": "Flurfoerderzeuge",
            "items": [
                {"id": 4, "text": "Gabelstapler geprueft und zugelassen", "required": true},
                {"id": 5, "text": "Fahrer berechtigt und unterwiesen", "required": true},
                {"id": 6, "text": "Fahrwege markiert und frei", "required": true}
            ]
        },
        {
            "category": "Verkehrswege",
            "items": [
                {"id": 7, "text": "Fussgaenger- und Fahrzeugbereiche getrennt", "required": true},
                {"id": 8, "text": "Kreuzungsbereiche gesichert", "required": true},
                {"id": 9, "text": "Ausreichende Beleuchtung", "required": true}
            ]
        }
    ]'::jsonb,
    1
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 11. PERMISSIONS
-- =====================================================

INSERT INTO permissions (name, description, category) VALUES
    ('asg.view', 'ASG-Kontrollen einsehen', 'asg'),
    ('asg.create', 'ASG-Kontrollen erstellen', 'asg'),
    ('asg.edit', 'ASG-Kontrollen bearbeiten', 'asg'),
    ('asg.delete', 'ASG-Kontrollen loeschen', 'asg'),
    ('asg.sign', 'ASG-Kontrollen unterschreiben', 'asg'),
    ('asg.manage_checklists', 'Prueflisten verwalten', 'asg'),
    ('asg.view_all', 'Alle ASG-Kontrollen standortuebergreifend sehen', 'asg'),
    ('asg.export', 'ASG-Berichte exportieren', 'asg'),
    ('asg.admin', 'ASG-Modul administrieren', 'asg')
ON CONFLICT (name) DO NOTHING;

-- Admin-Rolle alle Berechtigungen geben
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions WHERE category = 'asg'
ON CONFLICT DO NOTHING;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE asg_checklists IS 'Prueflisten-Vorlagen fuer Sicherheitskontrollen';
COMMENT ON TABLE asg_inspections IS 'Durchgefuehrte Sicherheitskontrollen';
COMMENT ON TABLE asg_defects IS 'Erfasste Maengel aus Kontrollen';
COMMENT ON TABLE asg_actions IS 'Massnahmen zur Maengelbeseitigung';
COMMENT ON TABLE asg_comments IS 'Kommentare und Kommunikation';
COMMENT ON TABLE asg_distributions IS 'Dokumentenverteilung (weiss/rot/gelb)';
COMMENT ON TABLE asg_audit_log IS 'Audit-Trail fuer Nachvollziehbarkeit';
