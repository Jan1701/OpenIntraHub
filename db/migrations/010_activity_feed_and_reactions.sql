-- =====================================================
-- Migration 010: Activity Feed & Reactions System
-- Erweitert Posts-Modul zu Social Feed wie Meta Workplace
-- Author: Jan Günther <jg@linxpress.de>
-- =====================================================

-- =====================================================
-- 1. POST REACTIONS (Like, Love, Celebrate, etc.)
-- =====================================================

CREATE TABLE IF NOT EXISTS post_reactions (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_type VARCHAR(20) NOT NULL, -- like, love, celebrate, insightful, support, funny
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, user_id)
);

CREATE INDEX idx_post_reactions_post ON post_reactions(post_id);
CREATE INDEX idx_post_reactions_user ON post_reactions(user_id);
CREATE INDEX idx_post_reactions_type ON post_reactions(reaction_type);

COMMENT ON TABLE post_reactions IS 'Reactions auf Posts (Like, Love, Celebrate, etc.)';

-- =====================================================
-- 2. COMMENT REACTIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS comment_reactions (
    id SERIAL PRIMARY KEY,
    comment_id INTEGER NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(comment_id, user_id)
);

CREATE INDEX idx_comment_reactions_comment ON comment_reactions(comment_id);
CREATE INDEX idx_comment_reactions_user ON comment_reactions(user_id);

COMMENT ON TABLE comment_reactions IS 'Reactions auf Kommentare';

-- =====================================================
-- 3. ACTIVITY STREAM (Unified Feed)
-- =====================================================

CREATE TABLE IF NOT EXISTS activities (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL, -- post_created, post_updated, comment_added, event_created, document_uploaded, etc.

    -- Target (was wurde gemacht)
    target_type VARCHAR(50), -- post, comment, event, document, user, space
    target_id INTEGER,

    -- Content (für aggregierte Activities)
    content JSONB DEFAULT '{}', -- Flexibel für verschiedene Activity-Types

    -- Context (wo wurde es gemacht - später für Spaces)
    space_id INTEGER, -- REFERENCES spaces(id) - später

    -- Metadata
    is_pinned BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activities_user ON activities(user_id);
CREATE INDEX idx_activities_type ON activities(activity_type);
CREATE INDEX idx_activities_target ON activities(target_type, target_id);
CREATE INDEX idx_activities_created ON activities(created_at DESC);
CREATE INDEX idx_activities_space ON activities(space_id) WHERE space_id IS NOT NULL;

COMMENT ON TABLE activities IS 'Unified Activity Stream für Feed';

-- =====================================================
-- 4. MENTIONS (@user Erwähnungen)
-- =====================================================

CREATE TABLE IF NOT EXISTS mentions (
    id SERIAL PRIMARY KEY,

    -- Wo wurde erwähnt
    mentionable_type VARCHAR(50) NOT NULL, -- post, comment
    mentionable_id INTEGER NOT NULL,

    -- Wer wurde erwähnt
    mentioned_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Von wem
    mentioned_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Status
    is_read BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(mentionable_type, mentionable_id, mentioned_user_id)
);

CREATE INDEX idx_mentions_user ON mentions(mentioned_user_id);
CREATE INDEX idx_mentions_unread ON mentions(mentioned_user_id, is_read) WHERE is_read = false;

COMMENT ON TABLE mentions IS '@-Mentions in Posts und Kommentaren';

-- =====================================================
-- 5. NOTIFICATIONS (Benachrichtigungen)
-- =====================================================

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Notification Type
    notification_type VARCHAR(50) NOT NULL, -- reaction, comment, mention, event_reminder, etc.

    -- Source
    source_type VARCHAR(50), -- post, comment, event, etc.
    source_id INTEGER,

    -- Actor (wer hat die Action gemacht)
    actor_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

    -- Content
    title VARCHAR(255),
    message TEXT,
    link VARCHAR(500), -- Deep-Link zur relevanten Seite

    -- Status
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

COMMENT ON TABLE notifications IS 'Benachrichtigungen für Benutzer';

-- =====================================================
-- 6. POST SHARES (Teilen/Repost)
-- =====================================================

CREATE TABLE IF NOT EXISTS post_shares (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    share_comment TEXT, -- Optional: Kommentar beim Teilen
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, user_id, created_at) -- User kann mehrfach teilen, aber mit unterschiedlichen Zeitstempeln
);

CREATE INDEX idx_post_shares_post ON post_shares(post_id);
CREATE INDEX idx_post_shares_user ON post_shares(user_id);

COMMENT ON TABLE post_shares IS 'Post-Shares (Repost/Teilen)';

-- =====================================================
-- 7. ERWEITERE POSTS TABELLE
-- =====================================================

-- Reactions-Count Cache (Performance)
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS reaction_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- Indizes für Performance
CREATE INDEX IF NOT EXISTS idx_posts_reaction_count ON posts(reaction_count DESC);
CREATE INDEX IF NOT EXISTS idx_posts_published_at ON posts(published_at DESC) WHERE status = 'published';

-- =====================================================
-- 8. FUNCTIONS & TRIGGERS
-- =====================================================

-- Update reaction_count when reaction added/removed
CREATE OR REPLACE FUNCTION update_post_reaction_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE posts
        SET reaction_count = reaction_count + 1
        WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE posts
        SET reaction_count = GREATEST(reaction_count - 1, 0)
        WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_post_reaction_count
    AFTER INSERT OR DELETE ON post_reactions
    FOR EACH ROW
    EXECUTE FUNCTION update_post_reaction_count();

-- Update share_count when post shared
CREATE OR REPLACE FUNCTION update_post_share_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE posts
        SET share_count = share_count + 1
        WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE posts
        SET share_count = GREATEST(share_count - 1, 0)
        WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_post_share_count
    AFTER INSERT OR DELETE ON post_shares
    FOR EACH ROW
    EXECUTE FUNCTION update_post_share_count();

-- Create activity when post created
CREATE OR REPLACE FUNCTION create_post_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status != 'published') THEN
        INSERT INTO activities (user_id, activity_type, target_type, target_id, content)
        VALUES (
            NEW.author_id,
            'post_created',
            'post',
            NEW.id,
            jsonb_build_object(
                'title', NEW.title,
                'excerpt', LEFT(NEW.content, 200)
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_post_activity
    AFTER INSERT OR UPDATE ON posts
    FOR EACH ROW
    EXECUTE FUNCTION create_post_activity();

-- Create notification when someone reacts to my post
CREATE OR REPLACE FUNCTION create_reaction_notification()
RETURNS TRIGGER AS $$
DECLARE
    v_post_author_id INTEGER;
    v_post_title VARCHAR(255);
    v_reactor_name VARCHAR(255);
BEGIN
    -- Get post author and title
    SELECT author_id, title INTO v_post_author_id, v_post_title
    FROM posts WHERE id = NEW.post_id;

    -- Get reactor name
    SELECT name INTO v_reactor_name
    FROM users WHERE id = NEW.user_id;

    -- Only notify if not reacting to own post
    IF v_post_author_id != NEW.user_id THEN
        INSERT INTO notifications (
            user_id,
            notification_type,
            source_type,
            source_id,
            actor_id,
            title,
            message,
            link
        ) VALUES (
            v_post_author_id,
            'reaction',
            'post',
            NEW.post_id,
            NEW.user_id,
            'Neue Reaction',
            v_reactor_name || ' hat auf deinen Post "' || v_post_title || '" reagiert',
            '/posts/' || NEW.post_id
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_reaction_notification
    AFTER INSERT ON post_reactions
    FOR EACH ROW
    EXECUTE FUNCTION create_reaction_notification();

-- Create notification when someone comments on my post
CREATE OR REPLACE FUNCTION create_comment_notification()
RETURNS TRIGGER AS $$
DECLARE
    v_post_author_id INTEGER;
    v_post_title VARCHAR(255);
    v_commenter_name VARCHAR(255);
BEGIN
    -- Get post author and title
    SELECT author_id, title INTO v_post_author_id, v_post_title
    FROM posts WHERE id = NEW.post_id;

    -- Get commenter name
    SELECT name INTO v_commenter_name
    FROM users WHERE id = NEW.user_id;

    -- Only notify if not commenting on own post
    IF v_post_author_id != NEW.user_id THEN
        INSERT INTO notifications (
            user_id,
            notification_type,
            source_type,
            source_id,
            actor_id,
            title,
            message,
            link
        ) VALUES (
            v_post_author_id,
            'comment',
            'post',
            NEW.post_id,
            NEW.user_id,
            'Neuer Kommentar',
            v_commenter_name || ' hat deinen Post "' || v_post_title || '" kommentiert',
            '/posts/' || NEW.post_id
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_comment_notification
    AFTER INSERT ON post_comments
    FOR EACH ROW
    EXECUTE FUNCTION create_comment_notification();

-- =====================================================
-- 9. DEFAULT REACTION TYPES DOCUMENTATION
-- =====================================================

-- Reaction Types (nicht in DB, nur Documentation):
-- - like: 👍 Standard Like
-- - love: ❤️ Herz
-- - celebrate: 🎉 Feiern/Gratulieren
-- - insightful: 💡 Einsichtsvoll
-- - support: 🤝 Unterstützung
-- - funny: 😄 Lustig

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

COMMENT ON SCHEMA public IS 'Migration 010: Activity Feed & Reactions System - Completed';
