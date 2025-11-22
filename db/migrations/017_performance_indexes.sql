-- =====================================================
-- Migration 017: Performance Indexes for 5000+ Users
-- Optimized indexes for common query patterns
-- =====================================================

-- =====================================================
-- CHAT SYSTEM INDEXES
-- =====================================================

-- Chat messages - frequent queries by conversation and time
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_time
    ON chat_messages(conversation_id, created_at DESC);

-- Chat messages - user's messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender
    ON chat_messages(sender_id, created_at DESC);

-- Chat participants - user lookup
CREATE INDEX IF NOT EXISTS idx_chat_participants_user
    ON chat_participants(user_id);

-- Chat participants - conversation members
CREATE INDEX IF NOT EXISTS idx_chat_participants_conversation
    ON chat_participants(conversation_id);

-- Unread message count optimization
CREATE INDEX IF NOT EXISTS idx_chat_participants_unread
    ON chat_participants(user_id, conversation_id)
    WHERE last_read_message_id IS NOT NULL;

-- =====================================================
-- DRIVE SYSTEM INDEXES
-- =====================================================

-- Files by uploader and time
CREATE INDEX IF NOT EXISTS idx_drive_files_uploader
    ON drive_files(uploaded_by, created_at DESC);

-- Files in folder
CREATE INDEX IF NOT EXISTS idx_drive_files_folder
    ON drive_files(folder_id, created_at DESC)
    WHERE deleted_at IS NULL;

-- File search (name)
CREATE INDEX IF NOT EXISTS idx_drive_files_name_search
    ON drive_files USING gin(to_tsvector('german', name));

-- Folders hierarchy
CREATE INDEX IF NOT EXISTS idx_drive_folders_parent
    ON drive_folders(parent_id, position);

-- Folders by owner
CREATE INDEX IF NOT EXISTS idx_drive_folders_owner
    ON drive_folders(owner_id);

-- File versions
CREATE INDEX IF NOT EXISTS idx_drive_file_versions
    ON drive_file_versions(file_id, version_number DESC);

-- =====================================================
-- ACTIVITY FEED INDEXES
-- =====================================================

-- Activity by user and time
CREATE INDEX IF NOT EXISTS idx_activity_feed_user
    ON activity_feed(user_id, created_at DESC);

-- Activity by target
CREATE INDEX IF NOT EXISTS idx_activity_feed_target
    ON activity_feed(target_type, target_id);

-- Activity feed timeline
CREATE INDEX IF NOT EXISTS idx_activity_feed_timeline
    ON activity_feed(created_at DESC);

-- =====================================================
-- EVENTS INDEXES
-- =====================================================

-- Events by date range
CREATE INDEX IF NOT EXISTS idx_events_date_range
    ON events(start_date, end_date);

-- Events by creator
CREATE INDEX IF NOT EXISTS idx_events_creator
    ON events(created_by, start_date);

-- Event participants by user
CREATE INDEX IF NOT EXISTS idx_event_participants_user
    ON event_participants(user_id, event_id);

-- Event participants by event
CREATE INDEX IF NOT EXISTS idx_event_participants_event
    ON event_participants(event_id);

-- =====================================================
-- POSTS INDEXES
-- =====================================================

-- Published posts by date
CREATE INDEX IF NOT EXISTS idx_posts_published
    ON posts(published_at DESC)
    WHERE status = 'published';

-- Posts by author
CREATE INDEX IF NOT EXISTS idx_posts_author
    ON posts(author_id, created_at DESC);

-- Posts by category
CREATE INDEX IF NOT EXISTS idx_posts_category
    ON posts(category_id, published_at DESC);

-- Post full-text search
CREATE INDEX IF NOT EXISTS idx_posts_search
    ON posts USING gin(to_tsvector('german', title || ' ' || COALESCE(excerpt, '')));

-- Post tags
CREATE INDEX IF NOT EXISTS idx_post_tag_relations
    ON post_tag_relations(post_id, tag_id);

-- =====================================================
-- PROJECT MANAGEMENT INDEXES
-- =====================================================

-- Tasks by project and column
CREATE INDEX IF NOT EXISTS idx_tasks_project_column
    ON tasks(project_id, column_id, position);

-- Tasks by assignee
CREATE INDEX IF NOT EXISTS idx_tasks_assignee
    ON tasks(assignee_id, status)
    WHERE assignee_id IS NOT NULL;

-- Tasks by due date
CREATE INDEX IF NOT EXISTS idx_tasks_due_date
    ON tasks(due_date)
    WHERE due_date IS NOT NULL AND status != 'done';

-- Project members
CREATE INDEX IF NOT EXISTS idx_projects_team_members
    ON projects USING gin(team_members);

-- Board columns order
CREATE INDEX IF NOT EXISTS idx_board_columns_order
    ON board_columns(board_id, position);

-- =====================================================
-- USER & SESSION INDEXES
-- =====================================================

-- Users by username (login)
CREATE INDEX IF NOT EXISTS idx_users_username
    ON users(username);

-- Users by email
CREATE INDEX IF NOT EXISTS idx_users_email
    ON users(email);

-- Users by LDAP DN
CREATE INDEX IF NOT EXISTS idx_users_ldap_dn
    ON users(ldap_dn)
    WHERE ldap_dn IS NOT NULL;

-- Active sessions
CREATE INDEX IF NOT EXISTS idx_sessions_user
    ON sessions(user_id, expires_at)
    WHERE revoked = false;

-- Session token lookup
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash
    ON sessions(token_hash);

-- =====================================================
-- LOCATIONS INDEXES
-- =====================================================

-- Location availability
CREATE INDEX IF NOT EXISTS idx_location_availability
    ON location_availability(location_id, date, start_time);

-- =====================================================
-- MAIL INDEXES
-- =====================================================

-- Mail messages by folder
CREATE INDEX IF NOT EXISTS idx_mail_messages_folder
    ON mail_messages(folder_id, received_at DESC);

-- Mail messages unread
CREATE INDEX IF NOT EXISTS idx_mail_messages_unread
    ON mail_messages(folder_id, is_read)
    WHERE is_read = false;

-- =====================================================
-- AUDIT LOG INDEX
-- =====================================================

-- Audit log by user and time
CREATE INDEX IF NOT EXISTS idx_audit_log_user_time
    ON audit_log(user_id, created_at DESC);

-- Audit log by action
CREATE INDEX IF NOT EXISTS idx_audit_log_action
    ON audit_log(action, created_at DESC);

-- =====================================================
-- COMPOSITE INDEXES FOR COMMON JOINS
-- =====================================================

-- Chat: User conversations with unread count
CREATE INDEX IF NOT EXISTS idx_chat_user_conversations
    ON chat_participants(user_id, conversation_id, last_read_message_id);

-- Events: User's upcoming events
CREATE INDEX IF NOT EXISTS idx_events_user_upcoming
    ON event_participants(user_id)
    INCLUDE (event_id, response_status);

-- =====================================================
-- ANALYZE TABLES
-- =====================================================

ANALYZE users;
ANALYZE sessions;
ANALYZE chat_conversations;
ANALYZE chat_messages;
ANALYZE chat_participants;
ANALYZE drive_files;
ANALYZE drive_folders;
ANALYZE activity_feed;
ANALYZE events;
ANALYZE event_participants;
ANALYZE posts;
ANALYZE tasks;
ANALYZE projects;
