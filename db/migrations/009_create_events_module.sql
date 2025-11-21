-- =====================================================
-- Migration 009: Events/Kalender Modul
-- Erstellt Kalender-System mit Events, Teilnehmern, Serien
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
    'Events',
    'Kalender & Events',
    'Event-Management mit Kalender, Terminverwaltung, Teilnehmern und Serien',
    '1.0.0',
    'Jan Günther <jg@linxpress.de>',
    'events',
    true,
    300,
    '[]'::jsonb,
    '{
        "features": {
            "recurring_events": true,
            "reminders": true,
            "location_integration": true,
            "ical_export": true,
            "participant_limits": true,
            "public_events": true
        },
        "defaults": {
            "default_duration_minutes": 60,
            "reminder_minutes_before": [15, 60, 1440],
            "max_participants": 100,
            "allow_guest_participants": false
        }
    }'::jsonb
) ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    version = EXCLUDED.version,
    module_config = EXCLUDED.module_config;

-- =====================================================
-- 2. EVENTS MAIN TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,

    -- Basic Info
    title VARCHAR(255) NOT NULL,
    description TEXT,

    -- Timing
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    all_day BOOLEAN DEFAULT false,
    timezone VARCHAR(50) DEFAULT 'Europe/Berlin',

    -- Recurrence
    is_recurring BOOLEAN DEFAULT false,
    recurrence_rule JSONB, -- RRULE format: {"freq": "WEEKLY", "interval": 1, "byday": ["MO", "WE"]}
    recurrence_parent_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    recurrence_exception_dates JSONB DEFAULT '[]', -- Array of exception dates

    -- Location
    location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    location_details VARCHAR(255), -- Room number, building, etc.
    is_online BOOLEAN DEFAULT false,
    meeting_url TEXT,

    -- Organization
    organizer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(50) DEFAULT 'general', -- general, meeting, training, event, holiday, etc.

    -- Access Control
    visibility VARCHAR(20) DEFAULT 'private', -- private, public, internal
    requires_approval BOOLEAN DEFAULT false,
    max_participants INTEGER,
    allow_guests BOOLEAN DEFAULT false,

    -- Status
    status VARCHAR(20) DEFAULT 'confirmed', -- confirmed, cancelled, tentative
    is_active BOOLEAN DEFAULT true,

    -- Metadata
    color VARCHAR(7), -- Hex color for calendar display
    tags JSONB DEFAULT '[]',
    attachments JSONB DEFAULT '[]',

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),

    -- Constraints
    CONSTRAINT valid_time_range CHECK (end_time > start_time),
    CONSTRAINT valid_color CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE INDEX idx_events_start_time ON events(start_time);
CREATE INDEX idx_events_end_time ON events(end_time);
CREATE INDEX idx_events_organizer ON events(organizer_id);
CREATE INDEX idx_events_location ON events(location_id);
CREATE INDEX idx_events_category ON events(category);
CREATE INDEX idx_events_visibility ON events(visibility);
CREATE INDEX idx_events_recurrence_parent ON events(recurrence_parent_id);
CREATE INDEX idx_events_status ON events(status) WHERE is_active = true;

COMMENT ON TABLE events IS 'Zentrale Event-Verwaltung für Kalender, Termine und Veranstaltungen';

-- =====================================================
-- 3. EVENT PARTICIPANTS
-- =====================================================

CREATE TABLE IF NOT EXISTS event_participants (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Participation
    status VARCHAR(20) DEFAULT 'invited', -- invited, accepted, declined, tentative, maybe
    is_required BOOLEAN DEFAULT false,
    is_organizer BOOLEAN DEFAULT false,

    -- Guest Info (if allow_guests)
    guest_email VARCHAR(255),
    guest_name VARCHAR(255),

    -- Notifications
    notification_sent BOOLEAN DEFAULT false,
    reminder_sent BOOLEAN DEFAULT false,

    -- Metadata
    comment TEXT,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP,
    added_by INTEGER REFERENCES users(id),

    -- Constraints
    UNIQUE(event_id, user_id),
    CONSTRAINT valid_participant CHECK (
        user_id IS NOT NULL OR (guest_email IS NOT NULL AND guest_name IS NOT NULL)
    )
);

CREATE INDEX idx_event_participants_event ON event_participants(event_id);
CREATE INDEX idx_event_participants_user ON event_participants(user_id);
CREATE INDEX idx_event_participants_status ON event_participants(status);
CREATE INDEX idx_event_participants_guest_email ON event_participants(guest_email) WHERE guest_email IS NOT NULL;

COMMENT ON TABLE event_participants IS 'Teilnehmer an Events mit Zusage-Status';

-- =====================================================
-- 4. EVENT REMINDERS
-- =====================================================

CREATE TABLE IF NOT EXISTS event_reminders (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Reminder Config
    remind_at TIMESTAMP WITH TIME ZONE NOT NULL,
    minutes_before INTEGER NOT NULL, -- 15, 60, 1440 (1 day), etc.

    -- Delivery
    method VARCHAR(20) DEFAULT 'notification', -- notification, email, push
    sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(event_id, user_id, minutes_before)
);

CREATE INDEX idx_event_reminders_event ON event_reminders(event_id);
CREATE INDEX idx_event_reminders_user ON event_reminders(user_id);
CREATE INDEX idx_event_reminders_remind_at ON event_reminders(remind_at) WHERE sent = false;

COMMENT ON TABLE event_reminders IS 'Event-Erinnerungen für Teilnehmer';

-- =====================================================
-- 5. EVENT CATEGORIES
-- =====================================================

CREATE TABLE IF NOT EXISTS event_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(7) NOT NULL DEFAULT '#3B82F6',
    icon VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_category_color CHECK (color ~ '^#[0-9A-Fa-f]{6}$')
);

-- Default Categories
INSERT INTO event_categories (name, slug, description, color, icon, display_order) VALUES
    ('Meeting', 'meeting', 'Team-Meetings und Besprechungen', '#3B82F6', 'users', 1),
    ('Training', 'training', 'Schulungen und Weiterbildungen', '#10B981', 'book-open', 2),
    ('Event', 'event', 'Firmen-Events und Veranstaltungen', '#F59E0B', 'calendar', 3),
    ('Holiday', 'holiday', 'Feiertage und freie Tage', '#EF4444', 'sun', 4),
    ('Deadline', 'deadline', 'Termine und Fristen', '#8B5CF6', 'clock', 5),
    ('Birthday', 'birthday', 'Geburtstage', '#EC4899', 'gift', 6),
    ('Other', 'other', 'Sonstige Termine', '#6B7280', 'calendar', 99)
ON CONFLICT (slug) DO NOTHING;

CREATE INDEX idx_event_categories_active ON event_categories(is_active);

-- =====================================================
-- 6. CALENDAR SUBSCRIPTIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS calendar_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Subscription Info
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) DEFAULT 'external', -- external, user, location, category

    -- External Calendar
    ical_url TEXT,
    sync_enabled BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMP,
    sync_interval_minutes INTEGER DEFAULT 60,

    -- Filters (for internal subscriptions)
    filter_category VARCHAR(50),
    filter_location_id INTEGER REFERENCES locations(id),
    filter_organizer_id INTEGER REFERENCES users(id),

    -- Display
    color VARCHAR(7),
    is_visible BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_subscription_color CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE INDEX idx_calendar_subscriptions_user ON calendar_subscriptions(user_id);
CREATE INDEX idx_calendar_subscriptions_sync ON calendar_subscriptions(sync_enabled, last_sync_at)
    WHERE sync_enabled = true;

COMMENT ON TABLE calendar_subscriptions IS 'Kalender-Abonnements für externe iCal-Feeds';

-- =====================================================
-- 7. EVENT CHANGE LOG
-- =====================================================

CREATE TABLE IF NOT EXISTS event_changelog (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    changed_by INTEGER NOT NULL REFERENCES users(id),
    change_type VARCHAR(50) NOT NULL, -- created, updated, cancelled, rescheduled, participant_added, etc.
    old_values JSONB,
    new_values JSONB,
    comment TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_event_changelog_event ON event_changelog(event_id);
CREATE INDEX idx_event_changelog_changed_at ON event_changelog(changed_at);

COMMENT ON TABLE event_changelog IS 'Änderungs-Historie für Events (Audit-Log)';

-- =====================================================
-- 8. FUNCTIONS & TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_events_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION update_events_updated_at();

-- Validate participant limits
CREATE OR REPLACE FUNCTION check_event_participant_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_max_participants INTEGER;
    v_current_count INTEGER;
BEGIN
    -- Get event max participants
    SELECT max_participants INTO v_max_participants
    FROM events WHERE id = NEW.event_id;

    -- If no limit, allow
    IF v_max_participants IS NULL THEN
        RETURN NEW;
    END IF;

    -- Count current accepted participants
    SELECT COUNT(*) INTO v_current_count
    FROM event_participants
    WHERE event_id = NEW.event_id
      AND status IN ('accepted', 'tentative');

    -- Check if adding this participant would exceed limit
    IF NEW.status IN ('accepted', 'tentative') AND v_current_count >= v_max_participants THEN
        RAISE EXCEPTION 'Event participant limit (%) exceeded', v_max_participants;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_participant_limit
    BEFORE INSERT OR UPDATE ON event_participants
    FOR EACH ROW
    EXECUTE FUNCTION check_event_participant_limit();

-- Log event changes
CREATE OR REPLACE FUNCTION log_event_change()
RETURNS TRIGGER AS $$
DECLARE
    v_change_type VARCHAR(50);
    v_old_values JSONB;
    v_new_values JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_change_type := 'created';
        v_new_values := to_jsonb(NEW);

        INSERT INTO event_changelog (event_id, changed_by, change_type, new_values)
        VALUES (NEW.id, NEW.created_by, v_change_type, v_new_values);

    ELSIF TG_OP = 'UPDATE' THEN
        -- Determine change type
        IF OLD.status = 'confirmed' AND NEW.status = 'cancelled' THEN
            v_change_type := 'cancelled';
        ELSIF OLD.start_time != NEW.start_time OR OLD.end_time != NEW.end_time THEN
            v_change_type := 'rescheduled';
        ELSE
            v_change_type := 'updated';
        END IF;

        -- Only log changed fields
        v_old_values := jsonb_build_object(
            'title', OLD.title,
            'start_time', OLD.start_time,
            'end_time', OLD.end_time,
            'status', OLD.status
        );
        v_new_values := jsonb_build_object(
            'title', NEW.title,
            'start_time', NEW.start_time,
            'end_time', NEW.end_time,
            'status', NEW.status
        );

        INSERT INTO event_changelog (event_id, changed_by, change_type, old_values, new_values)
        VALUES (NEW.id, NEW.updated_by, v_change_type, v_old_values, v_new_values);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_event_change
    AFTER INSERT OR UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION log_event_change();

-- Auto-create reminders when participant accepts
CREATE OR REPLACE FUNCTION create_default_reminders()
RETURNS TRIGGER AS $$
DECLARE
    v_event_start TIMESTAMP WITH TIME ZONE;
    v_reminder_config JSONB;
    v_minutes INTEGER;
BEGIN
    -- Only create reminders when user accepts
    IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
        -- Get event start time
        SELECT start_time INTO v_event_start
        FROM events WHERE id = NEW.event_id;

        -- Get default reminder config from module settings
        SELECT setting_value INTO v_reminder_config
        FROM module_settings ms
        JOIN module_registry mr ON mr.id = ms.module_id
        WHERE mr.name = 'Events' AND ms.setting_key = 'default_reminder_minutes';

        -- Default to 15 minutes if not configured
        IF v_reminder_config IS NULL THEN
            v_reminder_config := '[15]'::jsonb;
        END IF;

        -- Create reminders
        FOR v_minutes IN SELECT jsonb_array_elements_text(v_reminder_config)::integer
        LOOP
            INSERT INTO event_reminders (event_id, user_id, remind_at, minutes_before)
            VALUES (
                NEW.event_id,
                NEW.user_id,
                v_event_start - (v_minutes || ' minutes')::interval,
                v_minutes
            )
            ON CONFLICT (event_id, user_id, minutes_before) DO NOTHING;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_default_reminders
    AFTER INSERT OR UPDATE ON event_participants
    FOR EACH ROW
    EXECUTE FUNCTION create_default_reminders();

-- =====================================================
-- 9. MODULE PERMISSIONS
-- =====================================================

-- Add event permissions to permissions table (if not exists)
INSERT INTO permissions (permission_key, permission_name, description, category)
VALUES
    ('events.view', 'View Events', 'View events in calendar', 'events'),
    ('events.create', 'Create Events', 'Create new events', 'events'),
    ('events.edit', 'Edit Events', 'Edit existing events', 'events'),
    ('events.delete', 'Delete Events', 'Delete events', 'events'),
    ('events.manage_all', 'Manage All Events', 'Manage all events (not just own)', 'events'),
    ('events.approve', 'Approve Event Requests', 'Approve event participation requests', 'events'),
    ('events.export', 'Export Events', 'Export events to iCal format', 'events')
ON CONFLICT (permission_key) DO NOTHING;

-- Assign permissions to roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.role_name = 'admin'
  AND p.permission_key LIKE 'events.%'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.role_name = 'user'
  AND p.permission_key IN ('events.view', 'events.create', 'events.edit', 'events.export')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 10. MODULE SETTINGS
-- =====================================================

-- Insert default module settings
DO $$
DECLARE
    v_module_id INTEGER;
BEGIN
    SELECT id INTO v_module_id FROM module_registry WHERE name = 'Events';

    INSERT INTO module_settings (module_id, setting_key, setting_value, setting_type) VALUES
        (v_module_id, 'default_reminder_minutes', '[15, 60, 1440]'::jsonb, 'array'),
        (v_module_id, 'max_participants_default', '100'::jsonb, 'integer'),
        (v_module_id, 'allow_recurring_events', 'true'::jsonb, 'boolean'),
        (v_module_id, 'require_approval_for_large_events', 'true'::jsonb, 'boolean'),
        (v_module_id, 'large_event_threshold', '50'::jsonb, 'integer'),
        (v_module_id, 'enable_email_notifications', 'true'::jsonb, 'boolean'),
        (v_module_id, 'ical_export_enabled', 'true'::jsonb, 'boolean')
    ON CONFLICT (module_id, setting_key) DO NOTHING;
END $$;

-- =====================================================
-- 11. SAMPLE DATA (Optional - for development)
-- =====================================================

-- Create a sample public holiday event
DO $$
DECLARE
    v_admin_id INTEGER;
BEGIN
    SELECT id INTO v_admin_id FROM users WHERE role = 'admin' LIMIT 1;

    IF v_admin_id IS NOT NULL THEN
        INSERT INTO events (
            title, description, start_time, end_time, all_day,
            organizer_id, category, visibility, status, color, created_by
        ) VALUES (
            'Neujahr 2025',
            'Gesetzlicher Feiertag',
            '2025-01-01 00:00:00+01',
            '2025-01-01 23:59:59+01',
            true,
            v_admin_id,
            'holiday',
            'public',
            'confirmed',
            '#EF4444',
            v_admin_id
        );
    END IF;
END $$;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

COMMENT ON SCHEMA public IS 'Migration 009: Events/Kalender Modul - Completed';
