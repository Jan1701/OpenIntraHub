-- =====================================================
-- Migration 011: Chat System für Unternehmenskommunikation
-- Real-time Messaging mit Socket.io + Redis
-- Author: Jan Günther <jg@linxpress.de>
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
    'Chat',
    'Chat & Messaging',
    'Real-time Chat-System mit Direct Messages, Group Chats und Reactions',
    '1.0.0',
    'Jan Günther <jg@linxpress.de>',
    'chat',
    true,
    400,
    '[]'::jsonb,
    '{
        "features": {
            "direct_messages": true,
            "group_chats": true,
            "file_sharing": true,
            "reactions": true,
            "read_receipts": true,
            "typing_indicators": true,
            "message_search": true
        },
        "defaults": {
            "max_group_members": 100,
            "message_retention_days": 365,
            "max_file_size_mb": 25
        }
    }'::jsonb
) ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    version = EXCLUDED.version,
    module_config = EXCLUDED.module_config;

-- =====================================================
-- 2. CHAT CONVERSATIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS chat_conversations (
    id SERIAL PRIMARY KEY,

    -- Conversation Type
    type VARCHAR(20) DEFAULT 'direct', -- direct (1:1), group, space (später)

    -- Group Chat Info
    name VARCHAR(255), -- Für Group Chats
    description TEXT,
    avatar_url VARCHAR(500),

    -- Space Integration (später)
    space_id INTEGER, -- REFERENCES spaces(id) - später

    -- Creator
    created_by INTEGER REFERENCES users(id),

    -- Metadata
    last_message_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chat_conversations_type ON chat_conversations(type);
CREATE INDEX idx_chat_conversations_space ON chat_conversations(space_id) WHERE space_id IS NOT NULL;
CREATE INDEX idx_chat_conversations_last_message ON chat_conversations(last_message_at DESC NULLS LAST);

COMMENT ON TABLE chat_conversations IS 'Chat-Konversationen (1:1, Group, Space)';

-- =====================================================
-- 3. CHAT PARTICIPANTS
-- =====================================================

CREATE TABLE IF NOT EXISTS chat_participants (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Role (für Group Chats)
    role VARCHAR(20) DEFAULT 'member', -- admin, member

    -- Read Tracking
    last_read_message_id INTEGER, -- REFERENCES chat_messages(id)
    last_read_at TIMESTAMP,

    -- Notifications
    muted_until TIMESTAMP, -- NULL = not muted
    notifications_enabled BOOLEAN DEFAULT true,

    -- Status
    is_active BOOLEAN DEFAULT true, -- false = left conversation

    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP,

    UNIQUE(conversation_id, user_id)
);

CREATE INDEX idx_chat_participants_conversation ON chat_participants(conversation_id);
CREATE INDEX idx_chat_participants_user ON chat_participants(user_id);
CREATE INDEX idx_chat_participants_active ON chat_participants(user_id, is_active) WHERE is_active = true;

COMMENT ON TABLE chat_participants IS 'Teilnehmer in Chat-Konversationen';

-- =====================================================
-- 4. CHAT MESSAGES
-- =====================================================

CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Message Content
    message_type VARCHAR(20) DEFAULT 'text', -- text, file, image, system
    message_text TEXT,

    -- Attachments
    attachments JSONB DEFAULT '[]', -- [{"name": "file.pdf", "url": "/uploads/...", "size": 123456, "mime_type": "application/pdf"}]

    -- Reply/Thread
    reply_to_message_id INTEGER REFERENCES chat_messages(id) ON DELETE SET NULL,

    -- Editing
    is_edited BOOLEAN DEFAULT false,
    edited_at TIMESTAMP,

    -- Deletion
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMP,

    -- Reactions Count (cached)
    reaction_count INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chat_messages_conversation ON chat_messages(conversation_id, created_at DESC);
CREATE INDEX idx_chat_messages_user ON chat_messages(user_id);
CREATE INDEX idx_chat_messages_reply ON chat_messages(reply_to_message_id) WHERE reply_to_message_id IS NOT NULL;
CREATE INDEX idx_chat_messages_text_search ON chat_messages USING gin(to_tsvector('german', message_text)) WHERE message_text IS NOT NULL;

COMMENT ON TABLE chat_messages IS 'Chat-Nachrichten';

-- =====================================================
-- 5. MESSAGE REACTIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS chat_message_reactions (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_type VARCHAR(20) NOT NULL, -- like, love, celebrate, funny, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, user_id)
);

CREATE INDEX idx_chat_message_reactions_message ON chat_message_reactions(message_id);
CREATE INDEX idx_chat_message_reactions_user ON chat_message_reactions(user_id);

COMMENT ON TABLE chat_message_reactions IS 'Reactions auf Chat-Nachrichten';

-- =====================================================
-- 6. TYPING INDICATORS (In-Memory via Redis, aber für Fallback)
-- =====================================================

CREATE TABLE IF NOT EXISTS chat_typing (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '10 seconds',
    UNIQUE(conversation_id, user_id)
);

CREATE INDEX idx_chat_typing_conversation ON chat_typing(conversation_id);
CREATE INDEX idx_chat_typing_expires ON chat_typing(expires_at);

COMMENT ON TABLE chat_typing IS 'Typing Indicators (Fallback für Redis)';

-- =====================================================
-- 7. ONLINE STATUS (In-Memory via Redis, aber für Fallback)
-- =====================================================

CREATE TABLE IF NOT EXISTS user_online_status (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    is_online BOOLEAN DEFAULT false,
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    socket_id VARCHAR(100), -- Socket.io Connection ID
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_online_status_online ON user_online_status(is_online, last_seen_at DESC);

COMMENT ON TABLE user_online_status IS 'Online-Status der Benutzer (Fallback für Redis)';

-- =====================================================
-- 8. FUNCTIONS & TRIGGERS
-- =====================================================

-- Update conversation last_message_at when message sent
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_conversations
    SET last_message_at = NEW.created_at,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.conversation_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_last_message
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_last_message();

-- Update message reaction_count
CREATE OR REPLACE FUNCTION update_message_reaction_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE chat_messages
        SET reaction_count = reaction_count + 1
        WHERE id = NEW.message_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE chat_messages
        SET reaction_count = GREATEST(reaction_count - 1, 0)
        WHERE id = OLD.message_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_message_reaction_count
    AFTER INSERT OR DELETE ON chat_message_reactions
    FOR EACH ROW
    EXECUTE FUNCTION update_message_reaction_count();

-- Clean up old typing indicators (called periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_typing_indicators()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM chat_typing
    WHERE expires_at < CURRENT_TIMESTAMP;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Auto-create Direct Conversation wenn noch nicht existiert
CREATE OR REPLACE FUNCTION get_or_create_direct_conversation(
    p_user1_id INTEGER,
    p_user2_id INTEGER
)
RETURNS INTEGER AS $$
DECLARE
    v_conversation_id INTEGER;
BEGIN
    -- Check if conversation exists (beide Richtungen)
    SELECT c.id INTO v_conversation_id
    FROM chat_conversations c
    WHERE c.type = 'direct'
      AND c.is_active = true
      AND EXISTS (
          SELECT 1 FROM chat_participants cp1
          WHERE cp1.conversation_id = c.id AND cp1.user_id = p_user1_id AND cp1.is_active = true
      )
      AND EXISTS (
          SELECT 1 FROM chat_participants cp2
          WHERE cp2.conversation_id = c.id AND cp2.user_id = p_user2_id AND cp2.is_active = true
      );

    -- Create if not exists
    IF v_conversation_id IS NULL THEN
        INSERT INTO chat_conversations (type, created_by)
        VALUES ('direct', p_user1_id)
        RETURNING id INTO v_conversation_id;

        -- Add both participants
        INSERT INTO chat_participants (conversation_id, user_id)
        VALUES (v_conversation_id, p_user1_id), (v_conversation_id, p_user2_id);
    END IF;

    RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 9. PERMISSIONS
-- =====================================================

INSERT INTO permissions (permission_key, permission_name, description, category)
VALUES
    ('chat.view', 'View Chat', 'View chat messages', 'chat'),
    ('chat.send', 'Send Messages', 'Send chat messages', 'chat'),
    ('chat.create_group', 'Create Group Chats', 'Create group chat conversations', 'chat'),
    ('chat.delete_own_messages', 'Delete Own Messages', 'Delete own messages', 'chat'),
    ('chat.delete_any_messages', 'Delete Any Messages', 'Delete any messages (admin)', 'chat')
ON CONFLICT (permission_key) DO NOTHING;

-- Assign permissions to roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.role_name = 'admin'
  AND p.permission_key LIKE 'chat.%'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.role_name = 'user'
  AND p.permission_key IN ('chat.view', 'chat.send', 'chat.create_group', 'chat.delete_own_messages')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 10. MODULE SETTINGS
-- =====================================================

DO $$
DECLARE
    v_module_id INTEGER;
BEGIN
    SELECT id INTO v_module_id FROM module_registry WHERE name = 'Chat';

    INSERT INTO module_settings (module_id, setting_key, setting_value, setting_type) VALUES
        (v_module_id, 'max_group_members', '100'::jsonb, 'integer'),
        (v_module_id, 'message_retention_days', '365'::jsonb, 'integer'),
        (v_module_id, 'max_file_size_mb', '25'::jsonb, 'integer'),
        (v_module_id, 'enable_typing_indicators', 'true'::jsonb, 'boolean'),
        (v_module_id, 'enable_read_receipts', 'true'::jsonb, 'boolean'),
        (v_module_id, 'enable_online_status', 'true'::jsonb, 'boolean')
    ON CONFLICT (module_id, setting_key) DO NOTHING;
END $$;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

COMMENT ON SCHEMA public IS 'Migration 011: Chat System - Completed';
