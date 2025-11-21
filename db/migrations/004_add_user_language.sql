-- Migration 004: Add Language Preference to Users
-- Fügt Sprachauswahl für Benutzer hinzu
-- Author: Jan Günther <jg@linxpress.de>

-- Sprach-Spalte hinzufügen
ALTER TABLE users
ADD COLUMN language VARCHAR(5) DEFAULT 'de' NOT NULL;

-- Check Constraint für unterstützte Sprachen
ALTER TABLE users
ADD CONSTRAINT users_language_check
CHECK (language IN ('de', 'en'));

-- Index für Sprach-Filterung
CREATE INDEX idx_users_language ON users(language);

-- Kommentar zur Spalte
COMMENT ON COLUMN users.language IS 'User interface language preference (ISO 639-1 code)';

-- Bestehende Benutzer auf Deutsch setzen (falls NULL)
UPDATE users
SET language = 'de'
WHERE language IS NULL;
