-- Migration 005: Page Builder & Module System
-- Erstellt Datenbank-Struktur für No-Code Page Builder
-- Author: Jan Günther <jg@linxpress.de>

-- ==============================================
-- 1. MODULE REGISTRY
-- ==============================================
-- Registriert verfügbare Module (Posts, Wiki, Calendar, etc.)
CREATE TABLE module_registry (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL, -- 'content', 'navigation', 'widget', 'layout'
    component VARCHAR(100) NOT NULL, -- React component name
    icon VARCHAR(50), -- Icon identifier
    category VARCHAR(50), -- 'content', 'media', 'form', 'social', etc.

    -- Konfiguration
    settings_schema JSONB DEFAULT '{}', -- JSON Schema für Module-Settings
    default_config JSONB DEFAULT '{}', -- Standard-Konfiguration

    -- Metadaten
    description TEXT,
    version VARCHAR(20) DEFAULT '1.0.0',
    author VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false, -- System-Module können nicht gelöscht werden

    -- Berechtigungen
    required_permission VARCHAR(100), -- z.B. 'content.create'

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_module_registry_type ON module_registry(type);
CREATE INDEX idx_module_registry_category ON module_registry(category);
CREATE INDEX idx_module_registry_active ON module_registry(is_active);

-- ==============================================
-- 2. PAGES
-- ==============================================
-- Hauptseiten-Tabelle
CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,

    -- Template & Layout
    template VARCHAR(50) DEFAULT 'default', -- 'default', 'blank', 'full-width', etc.
    layout_type VARCHAR(50) DEFAULT 'grid', -- 'grid', 'flex', 'custom'

    -- Status & Sichtbarkeit
    status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'published', 'archived'
    is_homepage BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT true,
    password_protected BOOLEAN DEFAULT false,
    password_hash VARCHAR(255),

    -- SEO
    meta_title VARCHAR(255),
    meta_description TEXT,
    meta_keywords TEXT,
    og_image VARCHAR(500), -- Open Graph Image URL

    -- Konfiguration
    page_config JSONB DEFAULT '{}', -- Globale Seiten-Einstellungen (Farben, Fonts, etc.)
    custom_css TEXT,
    custom_js TEXT,

    -- Responsive
    mobile_config JSONB, -- Mobile-spezifische Overrides
    tablet_config JSONB, -- Tablet-spezifische Overrides

    -- Berechtigungen
    required_permission VARCHAR(100),
    allowed_roles TEXT[], -- Array von Rollen die Zugriff haben

    -- Versionierung
    parent_page_id INTEGER REFERENCES pages(id) ON DELETE SET NULL, -- Für Seiten-Hierarchie
    version INTEGER DEFAULT 1,
    published_version INTEGER,

    -- Metadaten
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pages_slug ON pages(slug);
CREATE INDEX idx_pages_status ON pages(status);
CREATE INDEX idx_pages_homepage ON pages(is_homepage);
CREATE INDEX idx_pages_created_by ON pages(created_by);
CREATE UNIQUE INDEX idx_pages_homepage_unique ON pages(is_homepage) WHERE is_homepage = true;

-- ==============================================
-- 3. PAGE SECTIONS
-- ==============================================
-- Abschnitte/Bereiche auf einer Seite (Header, Content, Sidebar, Footer, etc.)
CREATE TABLE page_sections (
    id SERIAL PRIMARY KEY,
    page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,

    -- Identifikation
    name VARCHAR(100) NOT NULL, -- 'header', 'content', 'sidebar', 'footer', 'hero', etc.
    section_type VARCHAR(50) DEFAULT 'container', -- 'container', 'row', 'column', 'grid'

    -- Positionierung
    position INTEGER NOT NULL DEFAULT 0, -- Reihenfolge auf der Seite
    parent_section_id INTEGER REFERENCES page_sections(id) ON DELETE CASCADE, -- Für verschachtelte Sections

    -- Layout
    grid_columns INTEGER DEFAULT 12, -- Anzahl Spalten im Grid
    grid_rows INTEGER, -- Anzahl Zeilen (optional)
    width VARCHAR(50) DEFAULT 'full', -- 'full', 'boxed', 'narrow', 'wide', 'custom'
    max_width VARCHAR(20), -- z.B. '1200px', '100%'
    min_height VARCHAR(20),

    -- Styling (JSON mit CSS-Properties)
    styles JSONB DEFAULT '{}', -- {background, padding, margin, border, etc.}
    classes TEXT[], -- CSS-Klassen Array

    -- Responsive
    mobile_styles JSONB,
    tablet_styles JSONB,
    hide_on_mobile BOOLEAN DEFAULT false,
    hide_on_tablet BOOLEAN DEFAULT false,
    hide_on_desktop BOOLEAN DEFAULT false,

    -- Visibility
    is_visible BOOLEAN DEFAULT true,
    visibility_condition JSONB, -- Bedingungen für Sichtbarkeit (logged_in, role, etc.)

    -- Animation
    animation VARCHAR(50), -- 'fade-in', 'slide-up', etc.
    animation_delay INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_page_sections_page_id ON page_sections(page_id);
CREATE INDEX idx_page_sections_position ON page_sections(page_id, position);
CREATE INDEX idx_page_sections_parent ON page_sections(parent_section_id);

-- ==============================================
-- 4. PAGE MODULES
-- ==============================================
-- Module die in Sections platziert werden
CREATE TABLE page_modules (
    id SERIAL PRIMARY KEY,
    page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    section_id INTEGER NOT NULL REFERENCES page_sections(id) ON DELETE CASCADE,
    module_id INTEGER NOT NULL REFERENCES module_registry(id) ON DELETE RESTRICT,

    -- Positionierung
    position INTEGER NOT NULL DEFAULT 0, -- Position innerhalb der Section
    grid_column_start INTEGER, -- Grid Position
    grid_column_end INTEGER,
    grid_row_start INTEGER,
    grid_row_end INTEGER,

    -- Konfiguration
    config JSONB DEFAULT '{}', -- Modul-spezifische Konfiguration
    content JSONB, -- Content-Daten (für Content-Module)

    -- Styling
    styles JSONB DEFAULT '{}',
    classes TEXT[],

    -- Responsive
    mobile_config JSONB,
    tablet_config JSONB,
    hide_on_mobile BOOLEAN DEFAULT false,
    hide_on_tablet BOOLEAN DEFAULT false,
    hide_on_desktop BOOLEAN DEFAULT false,

    -- Visibility
    is_visible BOOLEAN DEFAULT true,
    visibility_condition JSONB,

    -- Metadaten
    custom_id VARCHAR(100), -- Custom HTML ID für das Modul
    custom_data JSONB, -- Zusätzliche Daten

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_page_modules_page_id ON page_modules(page_id);
CREATE INDEX idx_page_modules_section_id ON page_modules(section_id);
CREATE INDEX idx_page_modules_module_id ON page_modules(module_id);
CREATE INDEX idx_page_modules_position ON page_modules(section_id, position);

-- ==============================================
-- 5. NAVIGATION MENUS
-- ==============================================
CREATE TABLE navigation_menus (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    location VARCHAR(50), -- 'header', 'footer', 'sidebar', 'mobile'

    -- Konfiguration
    config JSONB DEFAULT '{}', -- Styling, Layout-Optionen

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_navigation_menus_location ON navigation_menus(location);
CREATE INDEX idx_navigation_menus_active ON navigation_menus(is_active);

-- ==============================================
-- 6. NAVIGATION ITEMS
-- ==============================================
CREATE TABLE navigation_items (
    id SERIAL PRIMARY KEY,
    menu_id INTEGER NOT NULL REFERENCES navigation_menus(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES navigation_items(id) ON DELETE CASCADE,

    -- Content
    label VARCHAR(255) NOT NULL,
    type VARCHAR(50) DEFAULT 'link', -- 'link', 'page', 'module', 'custom', 'dropdown'

    -- Link
    url VARCHAR(500),
    page_id INTEGER REFERENCES pages(id) ON DELETE SET NULL,
    target VARCHAR(20) DEFAULT '_self', -- '_self', '_blank', '_parent', '_top'

    -- Styling
    icon VARCHAR(50),
    css_classes TEXT[],

    -- Positionierung
    position INTEGER NOT NULL DEFAULT 0,

    -- Visibility
    is_visible BOOLEAN DEFAULT true,
    visibility_condition JSONB,
    required_permission VARCHAR(100),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_navigation_items_menu_id ON navigation_items(menu_id);
CREATE INDEX idx_navigation_items_parent_id ON navigation_items(parent_id);
CREATE INDEX idx_navigation_items_position ON navigation_items(menu_id, position);
CREATE INDEX idx_navigation_items_page_id ON navigation_items(page_id);

-- ==============================================
-- 7. PAGE REVISIONS (Versionskontrolle)
-- ==============================================
CREATE TABLE page_revisions (
    id SERIAL PRIMARY KEY,
    page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,

    -- Snapshot aller Daten
    page_data JSONB NOT NULL, -- Kompletter Page-State als JSON
    sections_data JSONB, -- Alle Sections
    modules_data JSONB, -- Alle Module

    -- Metadaten
    created_by INTEGER REFERENCES users(id),
    revision_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_page_revisions_page_id ON page_revisions(page_id);
CREATE INDEX idx_page_revisions_version ON page_revisions(page_id, version);

-- ==============================================
-- TRIGGERS
-- ==============================================

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_module_registry_updated_at BEFORE UPDATE ON module_registry
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pages_updated_at BEFORE UPDATE ON pages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_page_sections_updated_at BEFORE UPDATE ON page_sections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_page_modules_updated_at BEFORE UPDATE ON page_modules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_navigation_menus_updated_at BEFORE UPDATE ON navigation_menus
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_navigation_items_updated_at BEFORE UPDATE ON navigation_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- KOMMENTARE
-- ==============================================
COMMENT ON TABLE module_registry IS 'Registry of available modules (Posts, Wiki, Calendar, etc.)';
COMMENT ON TABLE pages IS 'Main pages table with configuration and metadata';
COMMENT ON TABLE page_sections IS 'Sections/areas within pages (Header, Content, Footer, etc.)';
COMMENT ON TABLE page_modules IS 'Module instances placed in page sections';
COMMENT ON TABLE navigation_menus IS 'Navigation menu definitions';
COMMENT ON TABLE navigation_items IS 'Navigation menu items with hierarchy';
COMMENT ON TABLE page_revisions IS 'Version history for pages';
