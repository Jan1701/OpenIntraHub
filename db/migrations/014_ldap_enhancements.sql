-- =====================================================
-- Migration 014: LDAP Enhancements
-- Erweiterte LDAP-Integration mit User-Caching & Sync
-- =====================================================

-- Add additional LDAP fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS ldap_guid VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS ldap_sam_account_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS ldap_user_principal_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS ldap_groups JSONB DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS ldap_last_sync_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ldap_source_server VARCHAR(255);

-- Add language preference (for i18n)
ALTER TABLE users ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'de';

-- Create index for LDAP lookups
CREATE INDEX IF NOT EXISTS idx_users_ldap_guid ON users(ldap_guid) WHERE ldap_guid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_ldap_sam ON users(ldap_sam_account_name) WHERE ldap_sam_account_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_ldap_upn ON users(ldap_user_principal_name) WHERE ldap_user_principal_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_ldap_sync ON users(ldap_last_sync_at) WHERE auth_method = 'ldap';

-- LDAP Sync Log Table
CREATE TABLE IF NOT EXISTS ldap_sync_log (
    id SERIAL PRIMARY KEY,
    sync_type VARCHAR(50) NOT NULL, -- 'full_sync', 'user_sync', 'group_sync'
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    duration_seconds INTEGER,

    -- Statistics
    users_processed INTEGER DEFAULT 0,
    users_created INTEGER DEFAULT 0,
    users_updated INTEGER DEFAULT 0,
    users_deactivated INTEGER DEFAULT 0,
    users_errors INTEGER DEFAULT 0,

    -- Status
    status VARCHAR(20) DEFAULT 'running', -- 'running', 'completed', 'failed'
    error_message TEXT,

    -- Details
    sync_details JSONB DEFAULT '{}'
);

CREATE INDEX idx_ldap_sync_log_started ON ldap_sync_log(started_at DESC);
CREATE INDEX idx_ldap_sync_log_status ON ldap_sync_log(status);

-- LDAP Group Mapping Table
CREATE TABLE IF NOT EXISTS ldap_group_mappings (
    id SERIAL PRIMARY KEY,
    ldap_group_dn VARCHAR(500) NOT NULL UNIQUE,
    ldap_group_name VARCHAR(255) NOT NULL,
    app_role VARCHAR(50) NOT NULL, -- Maps to users.role
    priority INTEGER DEFAULT 0, -- Higher priority wins if user in multiple groups
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_ldap_group_role FOREIGN KEY (app_role)
        REFERENCES roles(role_name) ON DELETE CASCADE
);

CREATE INDEX idx_ldap_group_mappings_dn ON ldap_group_mappings(ldap_group_dn);
CREATE INDEX idx_ldap_group_mappings_active ON ldap_group_mappings(is_active) WHERE is_active = true;

-- Auto-update trigger for ldap_group_mappings
CREATE TRIGGER ldap_group_mappings_updated_at
    BEFORE UPDATE ON ldap_group_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON COLUMN users.ldap_guid IS 'LDAP/AD GUID (objectGUID) for unique identification';
COMMENT ON COLUMN users.ldap_sam_account_name IS 'Active Directory sAMAccountName';
COMMENT ON COLUMN users.ldap_user_principal_name IS 'Active Directory userPrincipalName (UPN)';
COMMENT ON COLUMN users.ldap_groups IS 'Array of LDAP group DNs the user belongs to';
COMMENT ON COLUMN users.ldap_last_sync_at IS 'Timestamp of last LDAP sync for this user';
COMMENT ON COLUMN users.ldap_source_server IS 'LDAP server URL this user was synced from';

COMMENT ON TABLE ldap_sync_log IS 'Log of LDAP synchronization runs';
COMMENT ON TABLE ldap_group_mappings IS 'Mapping of LDAP groups to application roles';

-- Function: Get role from LDAP groups based on mappings
CREATE OR REPLACE FUNCTION get_role_from_ldap_groups(p_ldap_groups TEXT[])
RETURNS VARCHAR(50) AS $$
DECLARE
    v_role VARCHAR(50) := 'user';
    v_max_priority INTEGER := -1;
    v_mapping RECORD;
BEGIN
    -- Loop through active mappings and find highest priority match
    FOR v_mapping IN
        SELECT app_role, priority
        FROM ldap_group_mappings
        WHERE is_active = true
          AND ldap_group_dn = ANY(p_ldap_groups)
        ORDER BY priority DESC
    LOOP
        IF v_mapping.priority > v_max_priority THEN
            v_role := v_mapping.app_role;
            v_max_priority := v_mapping.priority;
        END IF;
    END LOOP;

    RETURN v_role;
END;
$$ LANGUAGE plpgsql;

-- Insert default group mappings (examples - can be customized)
INSERT INTO ldap_group_mappings (ldap_group_dn, ldap_group_name, app_role, priority) VALUES
    ('cn=Domain Admins,cn=Users,dc=example,dc=com', 'Domain Admins', 'admin', 100),
    ('cn=Administrators,cn=Builtin,dc=example,dc=com', 'Administrators', 'admin', 100),
    ('cn=IT-Admins,ou=Groups,dc=example,dc=com', 'IT Admins', 'admin', 90),
    ('cn=Moderators,ou=Groups,dc=example,dc=com', 'Moderators', 'moderator', 50),
    ('cn=Editors,ou=Groups,dc=example,dc=com', 'Editors', 'editor', 40),
    ('cn=Domain Users,cn=Users,dc=example,dc=com', 'Domain Users', 'user', 10)
ON CONFLICT (ldap_group_dn) DO NOTHING;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

COMMENT ON SCHEMA public IS 'Migration 014: LDAP Enhancements - Completed';
