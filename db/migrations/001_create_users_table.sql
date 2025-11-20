-- Migration: Erstelle users-Tabelle
-- Beschreibung: Basis-Tabelle für User-Authentifizierung und -Verwaltung

-- Drop table if exists (für Dev-Umgebung)
DROP TABLE IF EXISTS users CASCADE;

-- Erstelle users-Tabelle
CREATE TABLE users (
    -- Primary Key
    id SERIAL PRIMARY KEY,

    -- Authentifizierung
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255), -- NULL erlaubt für LDAP-only users

    -- Profil-Informationen
    name VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(500),

    -- Rollen & Berechtigungen
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    -- role kann sein: admin, moderator, editor, user, guest

    -- Account-Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_verified BOOLEAN NOT NULL DEFAULT false,

    -- LDAP-Integration
    ldap_dn VARCHAR(500), -- LDAP Distinguished Name
    auth_method VARCHAR(20) NOT NULL DEFAULT 'database',
    -- auth_method kann sein: database, ldap, oauth

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP,

    -- Constraints
    CONSTRAINT chk_role CHECK (role IN ('admin', 'moderator', 'editor', 'user', 'guest')),
    CONSTRAINT chk_auth_method CHECK (auth_method IN ('database', 'ldap', 'oauth', 'mock'))
);

-- Indizes für Performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_auth_method ON users(auth_method);

-- Trigger: Automatisches Update von updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Kommentare für Dokumentation
COMMENT ON TABLE users IS 'Basis-Tabelle für User-Authentifizierung und -Verwaltung';
COMMENT ON COLUMN users.id IS 'Eindeutige User-ID';
COMMENT ON COLUMN users.username IS 'Eindeutiger Benutzername (Login)';
COMMENT ON COLUMN users.email IS 'Eindeutige E-Mail-Adresse';
COMMENT ON COLUMN users.password_hash IS 'Bcrypt-Hash des Passworts (NULL bei LDAP-only)';
COMMENT ON COLUMN users.role IS 'User-Rolle für RBAC-System';
COMMENT ON COLUMN users.ldap_dn IS 'LDAP Distinguished Name (falls LDAP-Auth)';
COMMENT ON COLUMN users.auth_method IS 'Authentifizierungsmethode (database, ldap, oauth)';
