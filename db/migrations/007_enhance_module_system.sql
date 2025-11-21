/**
 * Migration 007: Enhanced Module System
 * Erweitert das Modulsystem um Feature-Flags, Dependencies und Module-Config
 *
 * @author Jan Günther <jg@linxpress.de>
 */

-- Erweitere module_registry Tabelle
ALTER TABLE module_registry
ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS dependencies JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS module_config JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS install_order INTEGER DEFAULT 999,
ADD COLUMN IF NOT EXISTS requires_setup BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS setup_completed BOOLEAN DEFAULT false;

-- Kommentare für neue Spalten
COMMENT ON COLUMN module_registry.enabled IS 'Feature-Flag: Modul aktiviert/deaktiviert';
COMMENT ON COLUMN module_registry.dependencies IS 'Array von Modul-IDs, die benötigt werden';
COMMENT ON COLUMN module_registry.module_config IS 'Modul-spezifische Konfiguration';
COMMENT ON COLUMN module_registry.install_order IS 'Installations-Reihenfolge (niedrigere Werte zuerst)';
COMMENT ON COLUMN module_registry.requires_setup IS 'Benötigt das Modul eine Ersteinrichtung?';
COMMENT ON COLUMN module_registry.setup_completed IS 'Wurde die Ersteinrichtung abgeschlossen?';

-- Update bestehende Module mit sinnvollen Defaults
UPDATE module_registry
SET install_order = CASE
    WHEN category = 'layout' THEN 1
    WHEN category = 'navigation' THEN 2
    WHEN category = 'content' THEN 3
    WHEN category = 'media' THEN 4
    WHEN category = 'widget' THEN 5
    ELSE 999
END
WHERE install_order = 999;

-- Setze Posts-Modul als setup_completed (bereits installiert)
UPDATE module_registry
SET setup_completed = true
WHERE component = 'PostsModule';

-- Neue Tabelle: module_settings
-- Globale Modul-Einstellungen, die zur Laufzeit geändert werden können
CREATE TABLE IF NOT EXISTS module_settings (
    id SERIAL PRIMARY KEY,
    module_id INTEGER NOT NULL REFERENCES module_registry(id) ON DELETE CASCADE,
    setting_key VARCHAR(100) NOT NULL,
    setting_value JSONB NOT NULL,
    setting_type VARCHAR(50) DEFAULT 'string', -- string, number, boolean, json, array
    description TEXT,
    is_public BOOLEAN DEFAULT false, -- Kann ohne Auth abgerufen werden
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES users(id),
    UNIQUE(module_id, setting_key)
);

CREATE INDEX idx_module_settings_module ON module_settings(module_id);
CREATE INDEX idx_module_settings_key ON module_settings(setting_key);

COMMENT ON TABLE module_settings IS 'Laufzeit-Einstellungen für Module';

-- Neue Tabelle: module_hooks
-- Event-System für Module (Observer-Pattern)
CREATE TABLE IF NOT EXISTS module_hooks (
    id SERIAL PRIMARY KEY,
    module_id INTEGER NOT NULL REFERENCES module_registry(id) ON DELETE CASCADE,
    hook_name VARCHAR(100) NOT NULL, -- z.B. 'user.created', 'post.published', 'file.uploaded'
    handler_function VARCHAR(255) NOT NULL, -- Name der Handler-Funktion
    priority INTEGER DEFAULT 10, -- Niedrigere Werte = höhere Priorität
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(module_id, hook_name, handler_function)
);

CREATE INDEX idx_module_hooks_name ON module_hooks(hook_name);
CREATE INDEX idx_module_hooks_enabled ON module_hooks(enabled);

COMMENT ON TABLE module_hooks IS 'Event-Hooks für modulare Erweiterungen';

-- Neue Tabelle: module_routes
-- Dynamische Routen-Registrierung für Module
CREATE TABLE IF NOT EXISTS module_routes (
    id SERIAL PRIMARY KEY,
    module_id INTEGER NOT NULL REFERENCES module_registry(id) ON DELETE CASCADE,
    route_path VARCHAR(255) NOT NULL,
    route_method VARCHAR(10) DEFAULT 'GET', -- GET, POST, PUT, DELETE, PATCH
    handler_file VARCHAR(255) NOT NULL,
    handler_function VARCHAR(100) NOT NULL,
    middleware JSONB DEFAULT '[]', -- Array von Middleware-Namen
    required_permission VARCHAR(100),
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(route_path, route_method)
);

CREATE INDEX idx_module_routes_module ON module_routes(module_id);
CREATE INDEX idx_module_routes_path ON module_routes(route_path);

COMMENT ON TABLE module_routes IS 'Dynamische API-Routen von Modulen';

-- Funktion: Check Module Dependencies
-- Überprüft ob alle Dependencies eines Moduls erfüllt sind
CREATE OR REPLACE FUNCTION check_module_dependencies(p_module_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    v_dependencies JSONB;
    v_dep_id INTEGER;
    v_dep_enabled BOOLEAN;
BEGIN
    -- Hole Dependencies
    SELECT dependencies INTO v_dependencies
    FROM module_registry
    WHERE id = p_module_id;

    -- Keine Dependencies = OK
    IF v_dependencies IS NULL OR jsonb_array_length(v_dependencies) = 0 THEN
        RETURN true;
    END IF;

    -- Prüfe jede Dependency
    FOR v_dep_id IN SELECT jsonb_array_elements_text(v_dependencies)::INTEGER
    LOOP
        SELECT enabled INTO v_dep_enabled
        FROM module_registry
        WHERE id = v_dep_id;

        -- Dependency nicht gefunden oder deaktiviert
        IF v_dep_enabled IS NULL OR v_dep_enabled = false THEN
            RETURN false;
        END IF;
    END LOOP;

    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Verhindere Deaktivierung wenn andere Module davon abhängen
CREATE OR REPLACE FUNCTION prevent_disable_if_dependents()
RETURNS TRIGGER AS $$
DECLARE
    v_dependent_count INTEGER;
BEGIN
    -- Nur bei Deaktivierung prüfen
    IF OLD.enabled = true AND NEW.enabled = false THEN
        -- Zähle abhängige Module
        SELECT COUNT(*) INTO v_dependent_count
        FROM module_registry
        WHERE enabled = true
        AND dependencies @> to_jsonb(ARRAY[OLD.id]);

        IF v_dependent_count > 0 THEN
            RAISE EXCEPTION 'Cannot disable module: % other module(s) depend on it', v_dependent_count;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_module_dependencies_before_disable
BEFORE UPDATE ON module_registry
FOR EACH ROW
EXECUTE FUNCTION prevent_disable_if_dependents();

-- Seed: Core Module Metadata
-- Markiere bestehende Module als Core-Module mit korrekten Dependencies

-- Layout-Module haben keine Dependencies
UPDATE module_registry
SET dependencies = '[]'::jsonb,
    enabled = true,
    install_order = 1
WHERE category = 'layout';

-- Content-Module könnten Layout-Module als Dependency haben
-- (erstmal ohne, können später hinzugefügt werden)
UPDATE module_registry
SET dependencies = '[]'::jsonb,
    enabled = true,
    install_order = 3
WHERE category = 'content';

-- Navigation-Module
UPDATE module_registry
SET dependencies = '[]'::jsonb,
    enabled = true,
    install_order = 2
WHERE category = 'navigation';

-- Media-Module
UPDATE module_registry
SET dependencies = '[]'::jsonb,
    enabled = true,
    install_order = 4
WHERE category = 'media';

-- Widget-Module
UPDATE module_registry
SET dependencies = '[]'::jsonb,
    enabled = true,
    install_order = 5
WHERE category = 'widget';
