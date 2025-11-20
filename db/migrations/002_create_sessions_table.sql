-- Migration: Erstelle sessions-Tabelle
-- Beschreibung: Speichert aktive User-Sessions und JWT-Tokens

DROP TABLE IF EXISTS sessions CASCADE;

CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Token-Informationen
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    -- Wir speichern einen Hash des Tokens, nicht den Token selbst

    -- Session-Metadaten
    ip_address INET,
    user_agent TEXT,
    device_info JSONB,

    -- Zeitstempel
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    last_activity_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    revoked_at TIMESTAMP,
    revoked_reason VARCHAR(255)
);

-- Indizes
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_sessions_is_active ON sessions(is_active);

-- Automatisches Aufräumen abgelaufener Sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM sessions
    WHERE expires_at < CURRENT_TIMESTAMP
       OR (is_active = false AND revoked_at < CURRENT_TIMESTAMP - INTERVAL '30 days');
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE sessions IS 'Aktive User-Sessions mit Token-Tracking';
COMMENT ON COLUMN sessions.token_hash IS 'SHA-256 Hash des JWT-Tokens';
