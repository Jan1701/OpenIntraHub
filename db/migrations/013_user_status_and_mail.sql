-- =====================================================
-- Migration 013: Global User Status & Mail System
-- =====================================================
-- Purpose: Global user presence/availability status + Mail infrastructure
-- =====================================================

-- User Status Table
-- Tracks user availability status (Available, Away, Busy, Out of Office, etc.)
CREATE TABLE IF NOT EXISTS user_status (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'available', -- 'available', 'away', 'busy', 'dnd' (do not disturb), 'offline', 'oof' (out of office)
    status_message TEXT, -- Custom status message

    -- Out of Office specific
    oof_enabled BOOLEAN DEFAULT false,
    oof_start_time TIMESTAMP,
    oof_end_time TIMESTAMP,
    oof_internal_message TEXT, -- Message for internal users
    oof_external_message TEXT, -- Message for external users

    -- Exchange sync
    synced_to_exchange BOOLEAN DEFAULT false,
    last_exchange_sync TIMESTAMP,

    -- Metadata
    last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_status_user_id ON user_status(user_id);
CREATE INDEX idx_user_status_status ON user_status(status);
CREATE INDEX idx_user_status_oof_enabled ON user_status(oof_enabled) WHERE oof_enabled = true;

-- User Status History
-- Tracks status changes for analytics and reporting
CREATE TABLE IF NOT EXISTS user_status_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,

    duration_seconds INTEGER, -- How long previous status lasted

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_status_history_user_id ON user_status_history(user_id);
CREATE INDEX idx_user_status_history_created_at ON user_status_history(created_at DESC);

-- Mail Folders Table
-- Stores user's Exchange mail folders
CREATE TABLE IF NOT EXISTS mail_folders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Exchange identifiers
    exchange_folder_id VARCHAR(500) NOT NULL,
    exchange_change_key VARCHAR(500),
    parent_folder_id VARCHAR(500),

    -- Folder info
    folder_name VARCHAR(255) NOT NULL,
    folder_class VARCHAR(100) DEFAULT 'IPF.Note', -- IPF.Note (mail), IPF.Calendar, IPF.Contact, etc.
    folder_type VARCHAR(50) DEFAULT 'user', -- 'system', 'user', 'search'

    -- Counts
    total_count INTEGER DEFAULT 0,
    unread_count INTEGER DEFAULT 0,

    -- Sync
    last_synced_at TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, exchange_folder_id)
);

CREATE INDEX idx_mail_folders_user_id ON mail_folders(user_id);
CREATE INDEX idx_mail_folders_exchange_folder_id ON mail_folders(exchange_folder_id);

-- Mail Messages Table
-- Stores synced mail messages from Exchange
CREATE TABLE IF NOT EXISTS mail_messages (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_id INTEGER REFERENCES mail_folders(id) ON DELETE CASCADE,

    -- Exchange identifiers
    exchange_message_id VARCHAR(500) NOT NULL,
    exchange_change_key VARCHAR(500),
    conversation_id VARCHAR(500),

    -- Message info
    subject TEXT,
    from_email VARCHAR(500),
    from_name VARCHAR(500),
    to_recipients JSONB, -- Array of {email, name}
    cc_recipients JSONB,
    bcc_recipients JSONB,

    -- Content
    body_preview TEXT, -- First 255 chars
    body_text TEXT, -- Plain text body
    body_html TEXT, -- HTML body

    -- Flags
    is_read BOOLEAN DEFAULT false,
    is_flagged BOOLEAN DEFAULT false,
    has_attachments BOOLEAN DEFAULT false,
    importance VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high'

    -- Dates
    sent_at TIMESTAMP,
    received_at TIMESTAMP,

    -- Sync
    last_synced_at TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, exchange_message_id)
);

CREATE INDEX idx_mail_messages_user_id ON mail_messages(user_id);
CREATE INDEX idx_mail_messages_folder_id ON mail_messages(folder_id);
CREATE INDEX idx_mail_messages_exchange_message_id ON mail_messages(exchange_message_id);
CREATE INDEX idx_mail_messages_is_read ON mail_messages(is_read);
CREATE INDEX idx_mail_messages_received_at ON mail_messages(received_at DESC);
CREATE INDEX idx_mail_messages_conversation_id ON mail_messages(conversation_id) WHERE conversation_id IS NOT NULL;

-- Mail Attachments Table
CREATE TABLE IF NOT EXISTS mail_attachments (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES mail_messages(id) ON DELETE CASCADE,

    -- Exchange info
    exchange_attachment_id VARCHAR(500),

    -- Attachment info
    name VARCHAR(500) NOT NULL,
    content_type VARCHAR(255),
    size_bytes INTEGER,
    is_inline BOOLEAN DEFAULT false,
    content_id VARCHAR(255), -- For inline images

    -- Local storage
    stored_locally BOOLEAN DEFAULT false,
    local_path TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mail_attachments_message_id ON mail_attachments(message_id);

-- Mail Sync Queue
-- Tracks pending mail operations to sync to Exchange
CREATE TABLE IF NOT EXISTS mail_sync_queue (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    operation VARCHAR(50) NOT NULL, -- 'send', 'move', 'delete', 'mark_read', 'mark_unread'
    message_id INTEGER REFERENCES mail_messages(id) ON DELETE CASCADE,

    -- Operation data
    operation_data JSONB, -- Contains operation-specific data

    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_attempt_at TIMESTAMP,
    error_message TEXT,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX idx_mail_sync_queue_user_id ON mail_sync_queue(user_id);
CREATE INDEX idx_mail_sync_queue_status ON mail_sync_queue(status) WHERE status = 'pending';
CREATE INDEX idx_mail_sync_queue_created_at ON mail_sync_queue(created_at);

-- Function: Update user_status updated_at
CREATE OR REPLACE FUNCTION update_user_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_status_updated_at
    BEFORE UPDATE ON user_status
    FOR EACH ROW
    EXECUTE FUNCTION update_user_status_updated_at();

-- Function: Track status changes in history
CREATE OR REPLACE FUNCTION track_user_status_change()
RETURNS TRIGGER AS $$
DECLARE
    duration INTEGER;
BEGIN
    -- Only track if status actually changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Calculate duration of previous status
        duration := EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - OLD.status_updated_at));

        -- Insert into history
        INSERT INTO user_status_history (user_id, previous_status, new_status, duration_seconds)
        VALUES (NEW.user_id, OLD.status, NEW.status, duration);

        -- Update status_updated_at
        NEW.status_updated_at = CURRENT_TIMESTAMP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_track_user_status_change
    BEFORE UPDATE ON user_status
    FOR EACH ROW
    EXECUTE FUNCTION track_user_status_change();

-- Function: Auto-disable OOF when end time is reached
CREATE OR REPLACE FUNCTION check_oof_expiration()
RETURNS void AS $$
BEGIN
    UPDATE user_status
    SET
        oof_enabled = false,
        status = 'available',
        status_message = NULL
    WHERE
        oof_enabled = true
        AND oof_end_time IS NOT NULL
        AND oof_end_time < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Initialize user_status for existing users
INSERT INTO user_status (user_id, status, last_active_at)
SELECT id, 'available', CURRENT_TIMESTAMP
FROM users
ON CONFLICT (user_id) DO NOTHING;

-- Comments
COMMENT ON TABLE user_status IS 'Global user presence and availability status';
COMMENT ON TABLE user_status_history IS 'Historical tracking of user status changes';
COMMENT ON TABLE mail_folders IS 'Exchange mail folders synced for each user';
COMMENT ON TABLE mail_messages IS 'Mail messages synced from Exchange';
COMMENT ON TABLE mail_attachments IS 'Attachments for mail messages';
COMMENT ON TABLE mail_sync_queue IS 'Pending mail operations to sync to Exchange';

COMMENT ON COLUMN user_status.status IS 'Current user status: available, away, busy, dnd, offline, oof';
COMMENT ON COLUMN user_status.oof_enabled IS 'Whether user is currently out of office';
COMMENT ON COLUMN user_status.synced_to_exchange IS 'Whether status has been synced to Exchange';

COMMENT ON FUNCTION check_oof_expiration() IS 'Called by scheduler to disable expired OOF settings';
