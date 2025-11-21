/**
 * Migration 008: Locations Module
 * Implementiert Standort-Verwaltung mit AD-Integration
 *
 * @author Jan Günther <jg@linxpress.de>
 */

-- ==============================================
-- LOCATIONS (Standorte)
-- ==============================================

CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,

    -- Basis-Informationen
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL, -- z.B. "HQ", "BERLIN", "NYC"
    type VARCHAR(50) DEFAULT 'office', -- office, branch, warehouse, remote, hybrid

    -- Hierarchie (z.B. Hauptstandort hat Sub-Standorte)
    parent_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,

    -- Adresse
    street VARCHAR(255),
    street2 VARCHAR(255),
    postal_code VARCHAR(20),
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'DE',

    -- Kontakt
    phone VARCHAR(50),
    fax VARCHAR(50),
    email VARCHAR(255),
    website VARCHAR(255),

    -- Geo-Koordinaten (für Karten)
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    timezone VARCHAR(50) DEFAULT 'Europe/Berlin',

    -- AD-Integration
    ad_ou VARCHAR(255), -- AD Organizational Unit
    ad_site VARCHAR(100), -- AD Site Name
    ad_sync_enabled BOOLEAN DEFAULT false,
    last_ad_sync TIMESTAMP,

    -- Ressourcen
    capacity INTEGER, -- Max. Mitarbeiter
    current_count INTEGER DEFAULT 0, -- Aktuelle Mitarbeiterzahl

    -- Öffnungszeiten (JSON)
    opening_hours JSONB DEFAULT '{
        "monday": {"open": "08:00", "close": "17:00"},
        "tuesday": {"open": "08:00", "close": "17:00"},
        "wednesday": {"open": "08:00", "close": "17:00"},
        "thursday": {"open": "08:00", "close": "17:00"},
        "friday": {"open": "08:00", "close": "17:00"},
        "saturday": null,
        "sunday": null
    }',

    -- Notfallkontakte
    emergency_contacts JSONB DEFAULT '[]',

    -- Ausstattung & Features
    facilities JSONB DEFAULT '[]', -- ["parking", "cafeteria", "gym", "bike_storage"]

    -- Verwaltung
    manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    is_headquarters BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,

    -- Bilder
    image_url VARCHAR(500),
    logo_url VARCHAR(500),

    -- Zusätzliche Felder (flexibel)
    custom_fields JSONB DEFAULT '{}',

    -- Metadaten
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id)
);

-- Indizes
CREATE INDEX idx_locations_code ON locations(code);
CREATE INDEX idx_locations_parent ON locations(parent_id);
CREATE INDEX idx_locations_country ON locations(country);
CREATE INDEX idx_locations_active ON locations(is_active);
CREATE INDEX idx_locations_ad_ou ON locations(ad_ou);

-- Trigger für updated_at
CREATE TRIGGER locations_updated_at
BEFORE UPDATE ON locations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE locations IS 'Standorte/Niederlassungen des Unternehmens';

-- ==============================================
-- USER_LOCATIONS (N:M Beziehung)
-- ==============================================

CREATE TABLE IF NOT EXISTS user_locations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,

    -- Zuordnungs-Details
    is_primary BOOLEAN DEFAULT false, -- Hauptstandort des Users
    role_at_location VARCHAR(100), -- Rolle am Standort
    department VARCHAR(100), -- Abteilung am Standort

    -- Zeitraum (für temporäre Zuordnungen)
    valid_from DATE,
    valid_until DATE,

    -- Arbeitsmodell
    work_model VARCHAR(50) DEFAULT 'on_site', -- on_site, remote, hybrid

    -- Metadaten
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INTEGER REFERENCES users(id),

    UNIQUE(user_id, location_id)
);

CREATE INDEX idx_user_locations_user ON user_locations(user_id);
CREATE INDEX idx_user_locations_location ON user_locations(location_id);
CREATE INDEX idx_user_locations_primary ON user_locations(is_primary);

COMMENT ON TABLE user_locations IS 'Zuordnung von Benutzern zu Standorten (N:M)';

-- ==============================================
-- LOCATION_SETTINGS
-- ==============================================

CREATE TABLE IF NOT EXISTS location_settings (
    id SERIAL PRIMARY KEY,
    location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,

    setting_key VARCHAR(100) NOT NULL,
    setting_value JSONB NOT NULL,
    setting_type VARCHAR(50) DEFAULT 'string',

    description TEXT,
    is_public BOOLEAN DEFAULT false,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES users(id),

    UNIQUE(location_id, setting_key)
);

CREATE INDEX idx_location_settings_location ON location_settings(location_id);
CREATE INDEX idx_location_settings_key ON location_settings(setting_key);

COMMENT ON TABLE location_settings IS 'Standort-spezifische Einstellungen';

-- ==============================================
-- LOCATION_RESOURCES
-- ==============================================

CREATE TABLE IF NOT EXISTS location_resources (
    id SERIAL PRIMARY KEY,
    location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,

    -- Ressourcen-Info
    resource_type VARCHAR(50) NOT NULL, -- meeting_room, parking_spot, desk, equipment
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    description TEXT,

    -- Verfügbarkeit
    capacity INTEGER DEFAULT 1,
    is_bookable BOOLEAN DEFAULT true,
    requires_approval BOOLEAN DEFAULT false,

    -- Ausstattung
    equipment JSONB DEFAULT '[]', -- ["projector", "whiteboard", "video_conf"]

    -- Buchungs-Einstellungen
    max_booking_duration INTEGER, -- Minuten
    min_booking_duration INTEGER DEFAULT 30,
    booking_buffer INTEGER DEFAULT 0, -- Puffer zwischen Buchungen

    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id)
);

CREATE INDEX idx_location_resources_location ON location_resources(location_id);
CREATE INDEX idx_location_resources_type ON location_resources(resource_type);
CREATE INDEX idx_location_resources_bookable ON location_resources(is_bookable);

COMMENT ON TABLE location_resources IS 'Buchbare Ressourcen an Standorten';

-- ==============================================
-- FUNCTIONS & TRIGGERS
-- ==============================================

-- Funktion: Update location current_count
CREATE OR REPLACE FUNCTION update_location_user_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Update count für betroffene Location(s)
    IF TG_OP = 'INSERT' THEN
        UPDATE locations
        SET current_count = (
            SELECT COUNT(DISTINCT user_id)
            FROM user_locations
            WHERE location_id = NEW.location_id
        )
        WHERE id = NEW.location_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE locations
        SET current_count = (
            SELECT COUNT(DISTINCT user_id)
            FROM user_locations
            WHERE location_id = OLD.location_id
        )
        WHERE id = OLD.location_id;
    ELSIF TG_OP = 'UPDATE' AND OLD.location_id != NEW.location_id THEN
        -- Bei Location-Wechsel beide updaten
        UPDATE locations
        SET current_count = (
            SELECT COUNT(DISTINCT user_id)
            FROM user_locations
            WHERE location_id = OLD.location_id
        )
        WHERE id = OLD.location_id;

        UPDATE locations
        SET current_count = (
            SELECT COUNT(DISTINCT user_id)
            FROM user_locations
            WHERE location_id = NEW.location_id
        )
        WHERE id = NEW.location_id;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_locations_count_trigger
AFTER INSERT OR UPDATE OR DELETE ON user_locations
FOR EACH ROW
EXECUTE FUNCTION update_location_user_count();

-- Funktion: Nur ein primary location pro User
CREATE OR REPLACE FUNCTION enforce_single_primary_location()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_primary = true THEN
        -- Setze alle anderen Locations dieses Users auf nicht-primary
        UPDATE user_locations
        SET is_primary = false
        WHERE user_id = NEW.user_id
        AND id != COALESCE(NEW.id, 0);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_primary_location
BEFORE INSERT OR UPDATE ON user_locations
FOR EACH ROW
WHEN (NEW.is_primary = true)
EXECUTE FUNCTION enforce_single_primary_location();

-- ==============================================
-- VIEWS
-- ==============================================

-- View: Location Overview mit User-Counts
CREATE OR REPLACE VIEW location_overview AS
SELECT
    l.*,
    COUNT(DISTINCT ul.user_id) as actual_user_count,
    u.username as manager_name,
    p.name as parent_location_name
FROM locations l
LEFT JOIN user_locations ul ON ul.location_id = l.id
LEFT JOIN users u ON u.id = l.manager_id
LEFT JOIN locations p ON p.id = l.parent_id
GROUP BY l.id, u.username, p.name;

COMMENT ON VIEW location_overview IS 'Standorte mit Mitarbeiter-Anzahl und Manager';

-- ==============================================
-- SEED DATA
-- ==============================================

-- Beispiel-Standort (Hauptsitz)
INSERT INTO locations (
    name, code, type, is_headquarters, is_active,
    street, city, postal_code, country,
    email, phone, timezone
) VALUES (
    'Hauptsitz', 'HQ', 'office', true, true,
    'Musterstraße 1', 'Berlin', '10115', 'DE',
    'info@example.com', '+49 30 12345678', 'Europe/Berlin'
) ON CONFLICT (code) DO NOTHING;

-- Registriere Locations-Modul in module_registry
INSERT INTO module_registry (
    name, type, component, icon, category, description,
    settings_schema, default_config,
    is_system, required_permission, version, author,
    enabled, install_order, requires_setup, setup_completed
) VALUES (
    'Locations',
    'system',
    'LocationsModule',
    'map-pin',
    'admin',
    'Standort-Verwaltung mit AD-Integration',
    '{
        "type": "object",
        "properties": {
            "enableADSync": {"type": "boolean", "title": "AD-Synchronisation aktivieren", "default": false},
            "defaultTimezone": {"type": "string", "title": "Standard-Zeitzone", "default": "Europe/Berlin"},
            "requireLocationForUsers": {"type": "boolean", "title": "Standort für User verpflichtend", "default": false}
        }
    }',
    '{
        "enableADSync": false,
        "defaultTimezone": "Europe/Berlin",
        "requireLocationForUsers": false
    }',
    true, 'admin.locations', '1.0.0', 'OpenIntraHub',
    true, 0, false, true
) ON CONFLICT (name) DO NOTHING;
