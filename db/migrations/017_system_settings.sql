-- Migration: System Settings Table
-- Beschreibung: Key-Value Storage für System-Konfiguration (Theme, etc.)

DROP TABLE IF EXISTS system_settings CASCADE;

CREATE TABLE system_settings (
    id SERIAL PRIMARY KEY,

    -- Einzigartiger Schlüssel
    key VARCHAR(100) UNIQUE NOT NULL,

    -- Wert als JSON für Flexibilität
    value TEXT NOT NULL,

    -- Beschreibung
    description TEXT,

    -- Wer hat zuletzt geändert
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,

    -- Zeitstempel
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indizes
CREATE INDEX idx_system_settings_key ON system_settings(key);

-- Standard-Einträge
INSERT INTO system_settings (key, value, description) VALUES
    ('theme_config', '{"brand":{"name":"OpenIntraHub","tagline":"Enterprise Social Intranet","logo":"/logo/transparent.png","logoLight":"/logo/light.png","logoDark":"/logo/dark.png","favicon":"/favicon.ico"},"colors":{"primary":"#0284c7","secondary":"#7c3aed","success":"#10b981","warning":"#f59e0b","error":"#ef4444","background":"#f9fafb","surface":"#ffffff"},"layout":{"sidebarWidth":256,"headerHeight":64,"borderRadius":8},"features":{"darkMode":true,"compactMode":false,"animations":true}}', 'White-Label Theme Konfiguration'),
    ('app_version', '"0.1.4-alpha"', 'Aktuelle App-Version'),
    ('maintenance_mode', 'false', 'Wartungsmodus aktiv');

COMMENT ON TABLE system_settings IS 'System-Konfiguration als Key-Value Store';
COMMENT ON COLUMN system_settings.key IS 'Einzigartiger Konfigurations-Schlüssel';
COMMENT ON COLUMN system_settings.value IS 'Wert als JSON-String';
