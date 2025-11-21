-- =====================================================
-- Migration 012: Exchange Calendar Synchronization
-- =====================================================
-- Purpose: Enable bi-directional calendar sync with Exchange 2016/2019
-- using Exchange Web Services (EWS)
-- =====================================================

-- Exchange Connections Table
-- Stores user-specific Exchange credentials (encrypted)
CREATE TABLE IF NOT EXISTS exchange_connections (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Exchange Server Configuration
    server_url VARCHAR(255) NOT NULL,  -- e.g., https://mail.company.com/EWS/Exchange.asmx
    username VARCHAR(255) NOT NULL,    -- Exchange username (usually email or domain\user)
    password_encrypted TEXT NOT NULL,  -- AES-256 encrypted password
    encryption_iv TEXT NOT NULL,       -- Initialization vector for decryption

    -- Authentication Type
    auth_type VARCHAR(50) DEFAULT 'basic', -- 'basic', 'ntlm', 'oauth2'

    -- OAuth2 Fields (if using modern auth)
    oauth_access_token TEXT,
    oauth_refresh_token TEXT,
    oauth_token_expires_at TIMESTAMP,

    -- Sync Configuration
    sync_enabled BOOLEAN DEFAULT true,
    sync_frequency_minutes INTEGER DEFAULT 15,
    last_sync_at TIMESTAMP,
    next_sync_at TIMESTAMP,

    -- Conflict Resolution Strategy
    conflict_strategy VARCHAR(50) DEFAULT 'exchange_wins', -- 'exchange_wins', 'openintrahub_wins', 'newest_wins', 'prompt_user'

    -- Selective Sync
    sync_calendars JSONB DEFAULT '[]'::jsonb, -- Array of Exchange calendar IDs to sync
    sync_direction VARCHAR(50) DEFAULT 'bidirectional', -- 'bidirectional', 'exchange_to_openintrahub', 'openintrahub_to_exchange'

    -- Status
    connection_status VARCHAR(50) DEFAULT 'active', -- 'active', 'error', 'disabled'
    last_error TEXT,
    last_error_at TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Ensure one connection per user
    UNIQUE(user_id)
);

CREATE INDEX idx_exchange_connections_user_id ON exchange_connections(user_id);
CREATE INDEX idx_exchange_connections_sync_enabled ON exchange_connections(sync_enabled);
CREATE INDEX idx_exchange_connections_next_sync ON exchange_connections(next_sync_at) WHERE sync_enabled = true;

-- Exchange Calendars Table
-- Stores list of available Exchange calendars for each connection
CREATE TABLE IF NOT EXISTS exchange_calendars (
    id SERIAL PRIMARY KEY,
    connection_id INTEGER NOT NULL REFERENCES exchange_connections(id) ON DELETE CASCADE,

    -- Exchange Calendar Info
    exchange_calendar_id VARCHAR(500) NOT NULL, -- EWS FolderId (can be very long)
    calendar_name VARCHAR(255) NOT NULL,
    calendar_type VARCHAR(50) DEFAULT 'calendar', -- 'calendar', 'shared', 'resource'

    -- Sync Settings
    is_synced BOOLEAN DEFAULT false,
    sync_enabled BOOLEAN DEFAULT true,

    -- Metadata
    discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_synced_at TIMESTAMP,

    UNIQUE(connection_id, exchange_calendar_id)
);

CREATE INDEX idx_exchange_calendars_connection_id ON exchange_calendars(connection_id);
CREATE INDEX idx_exchange_calendars_synced ON exchange_calendars(is_synced) WHERE sync_enabled = true;

-- Exchange Sync Log Table
-- Tracks sync operations, errors, and statistics
CREATE TABLE IF NOT EXISTS exchange_sync_log (
    id SERIAL PRIMARY KEY,
    connection_id INTEGER NOT NULL REFERENCES exchange_connections(id) ON DELETE CASCADE,

    -- Sync Operation
    sync_started_at TIMESTAMP NOT NULL,
    sync_finished_at TIMESTAMP,
    sync_duration_ms INTEGER,
    sync_direction VARCHAR(50), -- 'exchange_to_openintrahub', 'openintrahub_to_exchange', 'bidirectional'

    -- Statistics
    events_fetched_from_exchange INTEGER DEFAULT 0,
    events_created_in_openintrahub INTEGER DEFAULT 0,
    events_updated_in_openintrahub INTEGER DEFAULT 0,
    events_deleted_in_openintrahub INTEGER DEFAULT 0,

    events_created_in_exchange INTEGER DEFAULT 0,
    events_updated_in_exchange INTEGER DEFAULT 0,
    events_deleted_in_exchange INTEGER DEFAULT 0,

    conflicts_detected INTEGER DEFAULT 0,
    conflicts_resolved INTEGER DEFAULT 0,

    -- Status
    sync_status VARCHAR(50) NOT NULL, -- 'success', 'partial_success', 'failed'
    error_message TEXT,
    error_stack TEXT,

    -- Metadata
    triggered_by VARCHAR(50) DEFAULT 'automatic', -- 'automatic', 'manual', 'webhook'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_exchange_sync_log_connection_id ON exchange_sync_log(connection_id);
CREATE INDEX idx_exchange_sync_log_status ON exchange_sync_log(sync_status);
CREATE INDEX idx_exchange_sync_log_started_at ON exchange_sync_log(sync_started_at DESC);

-- Add Exchange fields to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS exchange_event_id VARCHAR(500);
ALTER TABLE events ADD COLUMN IF NOT EXISTS exchange_calendar_id VARCHAR(500);
ALTER TABLE events ADD COLUMN IF NOT EXISTS exchange_change_key VARCHAR(500); -- EWS ChangeKey for optimistic locking
ALTER TABLE events ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP;
ALTER TABLE events ADD COLUMN IF NOT EXISTS sync_source VARCHAR(50) DEFAULT 'openintrahub'; -- 'openintrahub', 'exchange'

CREATE INDEX idx_events_exchange_event_id ON events(exchange_event_id) WHERE exchange_event_id IS NOT NULL;
CREATE INDEX idx_events_exchange_calendar_id ON events(exchange_calendar_id) WHERE exchange_calendar_id IS NOT NULL;

-- Event Sync Conflicts Table
-- Stores conflicts that require user resolution
CREATE TABLE IF NOT EXISTS exchange_sync_conflicts (
    id SERIAL PRIMARY KEY,
    connection_id INTEGER NOT NULL REFERENCES exchange_connections(id) ON DELETE CASCADE,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    exchange_event_id VARCHAR(500),

    -- Conflict Details
    conflict_type VARCHAR(50) NOT NULL, -- 'update_conflict', 'delete_conflict', 'duplicate'
    conflict_detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Conflicting Data
    openintrahub_data JSONB,
    exchange_data JSONB,

    -- Resolution
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP,
    resolution_strategy VARCHAR(50), -- 'keep_openintrahub', 'keep_exchange', 'merge', 'skip'
    resolved_by INTEGER REFERENCES users(id),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_exchange_sync_conflicts_connection_id ON exchange_sync_conflicts(connection_id);
CREATE INDEX idx_exchange_sync_conflicts_resolved ON exchange_sync_conflicts(resolved) WHERE resolved = false;
CREATE INDEX idx_exchange_sync_conflicts_event_id ON exchange_sync_conflicts(event_id);

-- Function: Update exchange_connections updated_at timestamp
CREATE OR REPLACE FUNCTION update_exchange_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_exchange_connections_updated_at
    BEFORE UPDATE ON exchange_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_exchange_connections_updated_at();

-- Function: Calculate next sync time when sync is enabled
CREATE OR REPLACE FUNCTION calculate_next_exchange_sync()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.sync_enabled = true THEN
        NEW.next_sync_at = CURRENT_TIMESTAMP + (NEW.sync_frequency_minutes || ' minutes')::INTERVAL;
    ELSE
        NEW.next_sync_at = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_next_exchange_sync
    BEFORE INSERT OR UPDATE OF sync_enabled, sync_frequency_minutes, last_sync_at ON exchange_connections
    FOR EACH ROW
    EXECUTE FUNCTION calculate_next_exchange_sync();

-- Comments for documentation
COMMENT ON TABLE exchange_connections IS 'Stores user-specific Exchange server connections with encrypted credentials';
COMMENT ON TABLE exchange_calendars IS 'Lists available Exchange calendars for each connection';
COMMENT ON TABLE exchange_sync_log IS 'Tracks all sync operations between OpenIntraHub and Exchange';
COMMENT ON TABLE exchange_sync_conflicts IS 'Stores unresolved sync conflicts requiring user intervention';

COMMENT ON COLUMN exchange_connections.password_encrypted IS 'AES-256-GCM encrypted Exchange password';
COMMENT ON COLUMN exchange_connections.encryption_iv IS 'Initialization vector for password decryption';
COMMENT ON COLUMN exchange_connections.sync_frequency_minutes IS 'How often to sync (default: 15 minutes)';
COMMENT ON COLUMN exchange_connections.conflict_strategy IS 'How to handle sync conflicts automatically';

COMMENT ON COLUMN events.exchange_event_id IS 'Exchange ItemId for bidirectional sync';
COMMENT ON COLUMN events.exchange_change_key IS 'Exchange ChangeKey for optimistic concurrency control';
COMMENT ON COLUMN events.sync_source IS 'Where this event originated (openintrahub or exchange)';
