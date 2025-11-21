-- =====================================================
-- Migration 015: Drive System (Document Management)
-- Zentrales Datei-Management mit Ordner-Hierarchie
-- =====================================================

-- =====================================================
-- 1. DRIVE FOLDERS (Ordner-Struktur)
-- =====================================================
CREATE TABLE IF NOT EXISTS drive_folders (
    id SERIAL PRIMARY KEY,

    -- Folder info
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,

    -- Hierarchy
    parent_id INTEGER REFERENCES drive_folders(id) ON DELETE CASCADE,
    path VARCHAR(1000), -- Full path: /Documents/Projects/2024
    depth INTEGER DEFAULT 0,

    -- Ownership
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Permissions
    visibility VARCHAR(20) DEFAULT 'private', -- private, shared, public

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP, -- Soft delete

    -- Stats
    file_count INTEGER DEFAULT 0,
    total_size_bytes BIGINT DEFAULT 0,

    -- Full-text search
    search_vector TSVECTOR,

    CONSTRAINT unique_folder_path UNIQUE (owner_id, parent_id, slug)
);

-- Indexes for folders
CREATE INDEX idx_drive_folders_owner ON drive_folders(owner_id);
CREATE INDEX idx_drive_folders_parent ON drive_folders(parent_id);
CREATE INDEX idx_drive_folders_path ON drive_folders(path);
CREATE INDEX idx_drive_folders_visibility ON drive_folders(visibility);
CREATE INDEX idx_drive_folders_deleted ON drive_folders(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_drive_folders_search ON drive_folders USING gin(search_vector);

-- Trigger für search_vector
CREATE OR REPLACE FUNCTION drive_folders_search_trigger() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('german', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('german', COALESCE(NEW.description, '')), 'B');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tsvector_update_drive_folders
    BEFORE INSERT OR UPDATE ON drive_folders
    FOR EACH ROW EXECUTE FUNCTION drive_folders_search_trigger();

-- =====================================================
-- 2. DRIVE FILES (Datei-Metadaten)
-- =====================================================
CREATE TABLE IF NOT EXISTS drive_files (
    id SERIAL PRIMARY KEY,

    -- File info
    name VARCHAR(500) NOT NULL,
    slug VARCHAR(500) NOT NULL,
    description TEXT,

    -- Storage
    file_path VARCHAR(1000) NOT NULL, -- Relative: drive/2024/11/abc123.pdf
    file_hash VARCHAR(64) NOT NULL, -- SHA256 for deduplication

    -- File metadata
    mime_type VARCHAR(255),
    file_size_bytes BIGINT NOT NULL,
    file_extension VARCHAR(50),

    -- Location
    folder_id INTEGER REFERENCES drive_folders(id) ON DELETE CASCADE,

    -- Ownership
    uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Permissions
    visibility VARCHAR(20) DEFAULT 'private', -- private, shared, public

    -- Metadata
    tags TEXT[], -- Array of tags
    metadata JSONB DEFAULT '{}', -- Additional metadata (EXIF, dimensions, etc.)

    -- Versioning
    version INTEGER DEFAULT 1,
    is_current_version BOOLEAN DEFAULT true,
    parent_file_id INTEGER REFERENCES drive_files(id) ON DELETE SET NULL,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP, -- Soft delete

    -- Stats
    download_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP,

    -- Full-text search
    search_vector TSVECTOR,

    CONSTRAINT unique_file_hash_version UNIQUE (file_hash, version)
);

-- Indexes for files
CREATE INDEX idx_drive_files_folder ON drive_files(folder_id);
CREATE INDEX idx_drive_files_uploaded_by ON drive_files(uploaded_by);
CREATE INDEX idx_drive_files_hash ON drive_files(file_hash);
CREATE INDEX idx_drive_files_mime ON drive_files(mime_type);
CREATE INDEX idx_drive_files_visibility ON drive_files(visibility);
CREATE INDEX idx_drive_files_deleted ON drive_files(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_drive_files_tags ON drive_files USING gin(tags);
CREATE INDEX idx_drive_files_search ON drive_files USING gin(search_vector);
CREATE INDEX idx_drive_files_current_version ON drive_files(is_current_version) WHERE is_current_version = true;
CREATE INDEX idx_drive_files_parent ON drive_files(parent_file_id);

-- Trigger für search_vector
CREATE OR REPLACE FUNCTION drive_files_search_trigger() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('german', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('german', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('german', COALESCE(array_to_string(NEW.tags, ' '), '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tsvector_update_drive_files
    BEFORE INSERT OR UPDATE ON drive_files
    FOR EACH ROW EXECUTE FUNCTION drive_files_search_trigger();

-- =====================================================
-- 3. DRIVE SHARES (Berechtigungen)
-- =====================================================
CREATE TABLE IF NOT EXISTS drive_shares (
    id SERIAL PRIMARY KEY,

    -- What is shared
    file_id INTEGER REFERENCES drive_files(id) ON DELETE CASCADE,
    folder_id INTEGER REFERENCES drive_folders(id) ON DELETE CASCADE,

    -- Shared with
    shared_with_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    shared_with_group VARCHAR(100), -- Optional: group name from LDAP

    -- Permissions
    permission VARCHAR(20) NOT NULL DEFAULT 'read', -- read, write, admin

    -- Sharing metadata
    shared_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,

    -- Public link
    public_token VARCHAR(64) UNIQUE,

    -- Stats
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP,

    CONSTRAINT check_share_target CHECK (
        (file_id IS NOT NULL AND folder_id IS NULL) OR
        (file_id IS NULL AND folder_id IS NOT NULL)
    ),
    CONSTRAINT check_share_recipient CHECK (
        (shared_with_user_id IS NOT NULL AND shared_with_group IS NULL AND public_token IS NULL) OR
        (shared_with_user_id IS NULL AND shared_with_group IS NOT NULL AND public_token IS NULL) OR
        (shared_with_user_id IS NULL AND shared_with_group IS NULL AND public_token IS NOT NULL)
    )
);

-- Indexes for shares
CREATE INDEX idx_drive_shares_file ON drive_shares(file_id);
CREATE INDEX idx_drive_shares_folder ON drive_shares(folder_id);
CREATE INDEX idx_drive_shares_user ON drive_shares(shared_with_user_id);
CREATE INDEX idx_drive_shares_group ON drive_shares(shared_with_group);
CREATE INDEX idx_drive_shares_token ON drive_shares(public_token) WHERE public_token IS NOT NULL;
CREATE INDEX idx_drive_shares_expires ON drive_shares(expires_at) WHERE expires_at IS NOT NULL;

-- =====================================================
-- 4. DRIVE FILE VERSIONS (Versionsverwaltung)
-- =====================================================
CREATE TABLE IF NOT EXISTS drive_file_versions (
    id SERIAL PRIMARY KEY,

    -- Reference to current file
    file_id INTEGER NOT NULL REFERENCES drive_files(id) ON DELETE CASCADE,

    -- Version info
    version INTEGER NOT NULL,
    file_path VARCHAR(1000) NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    file_size_bytes BIGINT NOT NULL,

    -- Metadata
    change_description TEXT,
    uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_file_version UNIQUE (file_id, version)
);

CREATE INDEX idx_drive_versions_file ON drive_file_versions(file_id);
CREATE INDEX idx_drive_versions_created ON drive_file_versions(created_at DESC);

-- =====================================================
-- 5. INTEGRATION: Update existing tables
-- =====================================================

-- Mail Attachments: Link to Drive
ALTER TABLE mail_attachments ADD COLUMN IF NOT EXISTS drive_file_id INTEGER REFERENCES drive_files(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_mail_attachments_drive_file ON mail_attachments(drive_file_id);

-- Chat Messages: Add drive_file_ids array
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS drive_file_ids INTEGER[];
CREATE INDEX IF NOT EXISTS idx_chat_messages_drive_files ON chat_messages USING gin(drive_file_ids);

-- Posts: Link featured_image to drive
ALTER TABLE posts ADD COLUMN IF NOT EXISTS featured_image_drive_id INTEGER REFERENCES drive_files(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_posts_featured_image_drive ON posts(featured_image_drive_id);

-- Events: Link image to drive
ALTER TABLE events ADD COLUMN IF NOT EXISTS image_drive_id INTEGER REFERENCES drive_files(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_events_image_drive ON events(image_drive_id);

-- =====================================================
-- 6. HELPER FUNCTIONS
-- =====================================================

-- Function: Get user's storage quota usage
CREATE OR REPLACE FUNCTION get_user_storage_usage(p_user_id INTEGER)
RETURNS BIGINT AS $$
    SELECT COALESCE(SUM(file_size_bytes), 0)
    FROM drive_files
    WHERE uploaded_by = p_user_id
      AND deleted_at IS NULL
      AND is_current_version = true;
$$ LANGUAGE SQL STABLE;

-- Function: Check if user has access to file
CREATE OR REPLACE FUNCTION user_has_drive_file_access(
    p_user_id INTEGER,
    p_file_id INTEGER,
    p_permission VARCHAR DEFAULT 'read'
)
RETURNS BOOLEAN AS $$
DECLARE
    v_file_owner INTEGER;
    v_file_visibility VARCHAR;
    v_has_share BOOLEAN;
BEGIN
    -- Get file info
    SELECT uploaded_by, visibility INTO v_file_owner, v_file_visibility
    FROM drive_files
    WHERE id = p_file_id AND deleted_at IS NULL;

    -- Owner has full access
    IF v_file_owner = p_user_id THEN
        RETURN true;
    END IF;

    -- Public files readable by anyone
    IF v_file_visibility = 'public' AND p_permission = 'read' THEN
        RETURN true;
    END IF;

    -- Check explicit shares
    SELECT EXISTS(
        SELECT 1 FROM drive_shares
        WHERE file_id = p_file_id
          AND (
              shared_with_user_id = p_user_id OR
              shared_with_group IN (
                  SELECT unnest(ldap_groups::text[]) FROM users WHERE id = p_user_id
              )
          )
          AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
          AND (
              (p_permission = 'read' AND permission IN ('read', 'write', 'admin')) OR
              (p_permission = 'write' AND permission IN ('write', 'admin')) OR
              (p_permission = 'admin' AND permission = 'admin')
          )
    ) INTO v_has_share;

    RETURN v_has_share;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Get folder path
CREATE OR REPLACE FUNCTION get_folder_path(p_folder_id INTEGER)
RETURNS VARCHAR AS $$
DECLARE
    v_path VARCHAR := '';
    v_current_id INTEGER := p_folder_id;
    v_name VARCHAR;
    v_parent_id INTEGER;
BEGIN
    WHILE v_current_id IS NOT NULL LOOP
        SELECT name, parent_id INTO v_name, v_parent_id
        FROM drive_folders
        WHERE id = v_current_id;

        IF v_path = '' THEN
            v_path := v_name;
        ELSE
            v_path := v_name || '/' || v_path;
        END IF;

        v_current_id := v_parent_id;
    END LOOP;

    RETURN '/' || v_path;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- 7. DEFAULT DATA
-- =====================================================

-- Create system root folder for each user (will be done via API)
-- Public folder for shared resources
INSERT INTO drive_folders (id, name, slug, description, owner_id, visibility, path, depth)
VALUES (
    1,
    'Public',
    'public',
    'Public shared files',
    (SELECT id FROM users WHERE role = 'admin' LIMIT 1),
    'public',
    '/Public',
    0
) ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 8. COMMENTS
-- =====================================================

COMMENT ON TABLE drive_folders IS 'Folder structure for drive system';
COMMENT ON TABLE drive_files IS 'File metadata for drive system';
COMMENT ON TABLE drive_shares IS 'Sharing permissions for drive files and folders';
COMMENT ON TABLE drive_file_versions IS 'Version history for drive files';

COMMENT ON COLUMN drive_files.file_hash IS 'SHA256 hash for deduplication and integrity';
COMMENT ON COLUMN drive_files.visibility IS 'private: owner only, shared: via drive_shares, public: everyone';
COMMENT ON COLUMN drive_shares.public_token IS 'Token for public sharing without authentication';
