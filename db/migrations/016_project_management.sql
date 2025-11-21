-- =====================================================
-- Migration 016: Project Management System
-- Vollständiges PM-System mit Kanban, Timeline & Integrations
-- =====================================================

-- =====================================================
-- 1. PROJECTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,

    -- Project Info
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    key VARCHAR(10) NOT NULL UNIQUE, -- z.B. "WEB", "INFRA"

    -- Ownership
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_members INTEGER[] DEFAULT '{}', -- Array of user IDs

    -- Status & Type
    status VARCHAR(50) DEFAULT 'active', -- active, on_hold, completed, archived
    project_type VARCHAR(50) DEFAULT 'software', -- software, marketing, operations, etc.
    priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical

    -- Timeline
    start_date DATE,
    end_date DATE,
    deadline DATE,

    -- Progress
    progress_percentage INTEGER DEFAULT 0,

    -- Metadata
    color VARCHAR(7) DEFAULT '#3B82F6', -- Hex color for UI
    icon VARCHAR(50), -- Icon name
    tags TEXT[],

    -- Drive Integration
    drive_folder_id INTEGER REFERENCES drive_folders(id) ON DELETE SET NULL,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    archived_at TIMESTAMP,

    -- Search
    search_vector TSVECTOR
);

-- Indexes
CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_key ON projects(key);
CREATE INDEX idx_projects_team_members ON projects USING gin(team_members);
CREATE INDEX idx_projects_search ON projects USING gin(search_vector);

-- Search vector trigger
CREATE OR REPLACE FUNCTION projects_search_trigger() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('german', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('german', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('german', COALESCE(NEW.key, '')), 'A');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tsvector_update_projects
    BEFORE INSERT OR UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION projects_search_trigger();

-- =====================================================
-- 2. PROJECT BOARDS (Kanban)
-- =====================================================
CREATE TABLE IF NOT EXISTS project_boards (
    id SERIAL PRIMARY KEY,

    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Ordering
    position INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_project_boards_project ON project_boards(project_id);
CREATE INDEX idx_project_boards_position ON project_boards(project_id, position);

-- =====================================================
-- 3. BOARD COLUMNS (Kanban Columns)
-- =====================================================
CREATE TABLE IF NOT EXISTS board_columns (
    id SERIAL PRIMARY KEY,

    board_id INTEGER NOT NULL REFERENCES project_boards(id) ON DELETE CASCADE,

    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#6B7280',

    -- Column Type (für Workflow)
    column_type VARCHAR(50) DEFAULT 'in_progress', -- backlog, todo, in_progress, review, done

    -- Ordering & Limits
    position INTEGER DEFAULT 0,
    wip_limit INTEGER, -- Work-in-Progress Limit

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_board_columns_board ON board_columns(board_id);
CREATE INDEX idx_board_columns_position ON board_columns(board_id, position);

-- =====================================================
-- 4. TASKS
-- =====================================================
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,

    -- Project & Board
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    board_id INTEGER REFERENCES project_boards(id) ON DELETE SET NULL,
    column_id INTEGER REFERENCES board_columns(id) ON DELETE SET NULL,

    -- Task Info
    title VARCHAR(500) NOT NULL,
    description TEXT,
    task_key VARCHAR(50) UNIQUE, -- z.B. "WEB-123"

    -- Type & Priority
    task_type VARCHAR(50) DEFAULT 'task', -- task, bug, feature, epic, story
    priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
    status VARCHAR(50) DEFAULT 'open', -- open, in_progress, in_review, done, blocked

    -- Assignment
    assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Timeline
    start_date DATE,
    due_date DATE,
    estimated_hours NUMERIC(10, 2),
    actual_hours NUMERIC(10, 2) DEFAULT 0,

    -- Progress
    progress_percentage INTEGER DEFAULT 0,

    -- Relationships
    parent_task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    depends_on INTEGER[] DEFAULT '{}', -- Array of task IDs this depends on

    -- Ordering (in Kanban column)
    position INTEGER DEFAULT 0,

    -- Labels & Tags
    labels TEXT[],
    tags TEXT[],

    -- Drive Integration
    attachment_file_ids INTEGER[] DEFAULT '{}', -- Array of drive_file IDs

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,

    -- Search
    search_vector TSVECTOR
);

-- Indexes
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_board ON tasks(board_id);
CREATE INDEX idx_tasks_column ON tasks(column_id);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX idx_tasks_reporter ON tasks(reporter_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX idx_tasks_position ON tasks(column_id, position);
CREATE INDEX idx_tasks_due_date ON tasks(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX idx_tasks_search ON tasks USING gin(search_vector);
CREATE INDEX idx_tasks_attachments ON tasks USING gin(attachment_file_ids);

-- Search vector trigger
CREATE OR REPLACE FUNCTION tasks_search_trigger() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('german', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('german', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('german', COALESCE(NEW.task_key, '')), 'A');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tsvector_update_tasks
    BEFORE INSERT OR UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION tasks_search_trigger();

-- =====================================================
-- 5. TASK COMMENTS
-- =====================================================
CREATE TABLE IF NOT EXISTS task_comments (
    id SERIAL PRIMARY KEY,

    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    content TEXT NOT NULL,

    -- Reply threading
    parent_comment_id INTEGER REFERENCES task_comments(id) ON DELETE CASCADE,

    -- Attachments
    attachment_file_ids INTEGER[] DEFAULT '{}',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_task_comments_task ON task_comments(task_id);
CREATE INDEX idx_task_comments_user ON task_comments(user_id);
CREATE INDEX idx_task_comments_parent ON task_comments(parent_comment_id);

-- =====================================================
-- 6. TASK ACTIVITY LOG
-- =====================================================
CREATE TABLE IF NOT EXISTS task_activity (
    id SERIAL PRIMARY KEY,

    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    action VARCHAR(100) NOT NULL, -- created, updated, status_changed, assigned, commented, etc.

    old_value TEXT,
    new_value TEXT,

    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_task_activity_task ON task_activity(task_id);
CREATE INDEX idx_task_activity_user ON task_activity(user_id);
CREATE INDEX idx_task_activity_created ON task_activity(created_at DESC);

-- =====================================================
-- 7. TASK TIME TRACKING
-- =====================================================
CREATE TABLE IF NOT EXISTS task_time_entries (
    id SERIAL PRIMARY KEY,

    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    description TEXT,

    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    duration_minutes INTEGER,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_task_time_entries_task ON task_time_entries(task_id);
CREATE INDEX idx_task_time_entries_user ON task_time_entries(user_id);
CREATE INDEX idx_task_time_entries_start ON task_time_entries(start_time);

-- =====================================================
-- 8. MILESTONES
-- =====================================================
CREATE TABLE IF NOT EXISTS project_milestones (
    id SERIAL PRIMARY KEY,

    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    description TEXT,

    due_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'open', -- open, completed, overdue

    -- Progress
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,

    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_project_milestones_project ON project_milestones(project_id);
CREATE INDEX idx_project_milestones_due_date ON project_milestones(due_date);

-- Link tasks to milestones
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS milestone_id INTEGER REFERENCES project_milestones(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_milestone ON tasks(milestone_id);

-- =====================================================
-- 9. HELPER FUNCTIONS
-- =====================================================

-- Function: Update project progress based on tasks
CREATE OR REPLACE FUNCTION update_project_progress()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE projects
    SET progress_percentage = (
        SELECT COALESCE(
            ROUND(
                (COUNT(*) FILTER (WHERE status IN ('done', 'completed'))::NUMERIC /
                 NULLIF(COUNT(*), 0) * 100)
            , 0), 0
        )
        FROM tasks
        WHERE project_id = NEW.project_id AND parent_task_id IS NULL
    ),
    updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.project_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_project_progress
    AFTER INSERT OR UPDATE OF status ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_project_progress();

-- Function: Auto-generate task key
CREATE OR REPLACE FUNCTION generate_task_key()
RETURNS TRIGGER AS $$
DECLARE
    project_key VARCHAR(10);
    task_number INTEGER;
BEGIN
    -- Get project key
    SELECT key INTO project_key
    FROM projects
    WHERE id = NEW.project_id;

    -- Get next task number for this project
    SELECT COALESCE(MAX(
        CAST(
            SUBSTRING(task_key FROM LENGTH(project_key) + 2)
            AS INTEGER
        )
    ), 0) + 1
    INTO task_number
    FROM tasks
    WHERE project_id = NEW.project_id
      AND task_key LIKE project_key || '-%';

    -- Generate key
    NEW.task_key := project_key || '-' || task_number;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_task_key
    BEFORE INSERT ON tasks
    FOR EACH ROW
    WHEN (NEW.task_key IS NULL)
    EXECUTE FUNCTION generate_task_key();

-- Function: Log task activity
CREATE OR REPLACE FUNCTION log_task_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO task_activity (task_id, user_id, action, new_value)
        VALUES (NEW.id, NEW.reporter_id, 'created', NEW.title);
    ELSIF TG_OP = 'UPDATE' THEN
        -- Status changed
        IF OLD.status != NEW.status THEN
            INSERT INTO task_activity (task_id, user_id, action, old_value, new_value)
            VALUES (NEW.id, NEW.assignee_id, 'status_changed', OLD.status, NEW.status);
        END IF;

        -- Assignee changed
        IF OLD.assignee_id IS DISTINCT FROM NEW.assignee_id THEN
            INSERT INTO task_activity (task_id, user_id, action, old_value, new_value)
            VALUES (NEW.id, COALESCE(NEW.assignee_id, OLD.assignee_id), 'assigned',
                    OLD.assignee_id::TEXT, NEW.assignee_id::TEXT);
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_task_activity
    AFTER INSERT OR UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION log_task_activity();

-- =====================================================
-- 10. DEFAULT DATA
-- =====================================================

-- Default board columns for new boards will be created via API

-- =====================================================
-- 11. COMMENTS
-- =====================================================

COMMENT ON TABLE projects IS 'Project management - Projects';
COMMENT ON TABLE project_boards IS 'Kanban boards for projects';
COMMENT ON TABLE board_columns IS 'Columns in Kanban boards';
COMMENT ON TABLE tasks IS 'Tasks/Issues in projects';
COMMENT ON TABLE task_comments IS 'Comments on tasks';
COMMENT ON TABLE task_activity IS 'Activity log for tasks';
COMMENT ON TABLE task_time_entries IS 'Time tracking for tasks';
COMMENT ON TABLE project_milestones IS 'Project milestones';
