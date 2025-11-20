-- Migration: Erstelle audit_log-Tabelle
-- Beschreibung: Audit-Trail für sicherheitsrelevante Aktionen

DROP TABLE IF EXISTS audit_log CASCADE;

CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,

    -- Wer?
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    username VARCHAR(100), -- Redundant gespeichert falls User gelöscht wird

    -- Was?
    action VARCHAR(100) NOT NULL,
    -- Beispiele: login, logout, password_change, role_change, user_create, etc.

    resource_type VARCHAR(100),
    -- Beispiele: user, file, content, setting, etc.

    resource_id VARCHAR(100),

    -- Details
    description TEXT,
    changes JSONB,
    -- Speichert old/new Values bei Änderungen

    -- Kontext
    ip_address INET,
    user_agent TEXT,
    request_method VARCHAR(10),
    request_path VARCHAR(500),

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'success',
    -- success, failure, error

    error_message TEXT,

    -- Zeitstempel
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indizes für Queries
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_resource_type ON audit_log(resource_type);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_status ON audit_log(status);

-- Partitionierung nach Datum (für große Datenmengen)
-- Kann später aktiviert werden wenn nötig

COMMENT ON TABLE audit_log IS 'Audit-Trail für sicherheitsrelevante Aktionen';
COMMENT ON COLUMN audit_log.changes IS 'JSON mit {before: {...}, after: {...}}';
