-- Migration 006: Posts/Beiträge System
-- Content-Management für Blog-Posts
-- Author: Jan Günther <jg@linxpress.de>

-- ==============================================
-- 1. POST CATEGORIES
-- ==============================================
CREATE TABLE post_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    parent_id INTEGER REFERENCES post_categories(id) ON DELETE SET NULL,

    -- SEO
    meta_title VARCHAR(255),
    meta_description TEXT,

    -- Display
    color VARCHAR(7), -- Hex color code
    icon VARCHAR(50),

    -- Ordering
    position INTEGER DEFAULT 0,

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_post_categories_slug ON post_categories(slug);
CREATE INDEX idx_post_categories_parent ON post_categories(parent_id);
CREATE INDEX idx_post_categories_active ON post_categories(is_active);

-- ==============================================
-- 2. POST TAGS
-- ==============================================
CREATE TABLE post_tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_post_tags_slug ON post_tags(slug);

-- ==============================================
-- 3. POSTS
-- ==============================================
CREATE TABLE posts (
    id SERIAL PRIMARY KEY,

    -- Content
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(500) NOT NULL UNIQUE,
    excerpt TEXT,
    content TEXT,

    -- Featured Image
    featured_image VARCHAR(500),
    featured_image_alt VARCHAR(255),
    featured_image_caption TEXT,

    -- Classification
    category_id INTEGER REFERENCES post_categories(id) ON DELETE SET NULL,

    -- Author
    author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Status & Publishing
    status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'published', 'scheduled', 'archived'
    published_at TIMESTAMP,
    scheduled_at TIMESTAMP,

    -- Visibility
    is_featured BOOLEAN DEFAULT false,
    is_sticky BOOLEAN DEFAULT false, -- Sticky posts bleiben oben
    visibility VARCHAR(20) DEFAULT 'public', -- 'public', 'private', 'password', 'members'
    password_hash VARCHAR(255),

    -- SEO
    meta_title VARCHAR(255),
    meta_description TEXT,
    meta_keywords TEXT,
    og_image VARCHAR(500),
    canonical_url VARCHAR(500),

    -- Engagement
    views_count INTEGER DEFAULT 0,
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,

    -- Comments
    allow_comments BOOLEAN DEFAULT true,
    comments_closed_at TIMESTAMP,

    -- Content Format
    format VARCHAR(20) DEFAULT 'standard', -- 'standard', 'video', 'audio', 'gallery', 'quote', 'link'

    -- Reading
    reading_time INTEGER, -- in minutes

    -- Tracking
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    deleted_at TIMESTAMP, -- Soft delete

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_posts_slug ON posts(slug);
CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_posts_category ON posts(category_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_published_at ON posts(published_at);
CREATE INDEX idx_posts_featured ON posts(is_featured);
CREATE INDEX idx_posts_sticky ON posts(is_sticky);
CREATE INDEX idx_posts_visibility ON posts(visibility);
CREATE INDEX idx_posts_deleted ON posts(deleted_at);

-- Full-text search index
CREATE INDEX idx_posts_search ON posts USING gin(to_tsvector('german', title || ' ' || COALESCE(excerpt, '') || ' ' || COALESCE(content, '')));

-- ==============================================
-- 4. POST TAGS RELATIONSHIP
-- ==============================================
CREATE TABLE post_tag_relations (
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES post_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (post_id, tag_id)
);

CREATE INDEX idx_post_tag_relations_post ON post_tag_relations(post_id);
CREATE INDEX idx_post_tag_relations_tag ON post_tag_relations(tag_id);

-- ==============================================
-- 5. POST META (Custom Fields)
-- ==============================================
CREATE TABLE post_meta (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    meta_key VARCHAR(255) NOT NULL,
    meta_value TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_post_meta_post ON post_meta(post_id);
CREATE INDEX idx_post_meta_key ON post_meta(meta_key);
CREATE UNIQUE INDEX idx_post_meta_unique ON post_meta(post_id, meta_key);

-- ==============================================
-- 6. POST COMMENTS
-- ==============================================
CREATE TABLE post_comments (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES post_comments(id) ON DELETE CASCADE,

    -- Author
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    author_name VARCHAR(255), -- Für Gäste
    author_email VARCHAR(255),
    author_website VARCHAR(500),
    author_ip VARCHAR(45),

    -- Content
    content TEXT NOT NULL,

    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'spam', 'trash'

    -- Engagement
    likes_count INTEGER DEFAULT 0,

    approved_at TIMESTAMP,
    approved_by INTEGER REFERENCES users(id),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_post_comments_post ON post_comments(post_id);
CREATE INDEX idx_post_comments_parent ON post_comments(parent_id);
CREATE INDEX idx_post_comments_user ON post_comments(user_id);
CREATE INDEX idx_post_comments_status ON post_comments(status);
CREATE INDEX idx_post_comments_created ON post_comments(created_at);

-- ==============================================
-- 7. POST REVISIONS
-- ==============================================
CREATE TABLE post_revisions (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,

    -- Snapshot
    title VARCHAR(500),
    slug VARCHAR(500),
    excerpt TEXT,
    content TEXT,

    -- Metadata
    revision_note TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_post_revisions_post ON post_revisions(post_id);
CREATE INDEX idx_post_revisions_created ON post_revisions(created_at);

-- ==============================================
-- TRIGGERS
-- ==============================================

-- Auto-update timestamps
CREATE TRIGGER update_post_categories_updated_at BEFORE UPDATE ON post_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_post_tags_updated_at BEFORE UPDATE ON post_tags
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_post_meta_updated_at BEFORE UPDATE ON post_meta
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_post_comments_updated_at BEFORE UPDATE ON post_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-update comments count
CREATE OR REPLACE FUNCTION update_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_post_comments_count_trigger
    AFTER INSERT OR DELETE ON post_comments
    FOR EACH ROW EXECUTE FUNCTION update_post_comments_count();

-- ==============================================
-- KOMMENTARE
-- ==============================================
COMMENT ON TABLE posts IS 'Blog posts and articles';
COMMENT ON TABLE post_categories IS 'Hierarchical post categories';
COMMENT ON TABLE post_tags IS 'Post tags for classification';
COMMENT ON TABLE post_comments IS 'Comments on posts';
COMMENT ON TABLE post_revisions IS 'Post revision history';
COMMENT ON TABLE post_meta IS 'Custom fields for posts';

COMMENT ON COLUMN posts.status IS 'Post publication status: draft, published, scheduled, archived';
COMMENT ON COLUMN posts.visibility IS 'Who can see the post: public, private, password, members';
COMMENT ON COLUMN posts.format IS 'Post format: standard, video, audio, gallery, quote, link';
COMMENT ON COLUMN posts.is_sticky IS 'Sticky posts stay at the top of listings';
COMMENT ON COLUMN posts.reading_time IS 'Estimated reading time in minutes';
