// =====================================================
// Project Management API
// =====================================================

const express = require('express');
const router = express.Router();
const pool = require('./database');
const { authenticateToken } = require('./middleware');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('ProjectAPI');

// =====================================================
// PROJECTS ENDPOINTS
// =====================================================

// GET /api/projects - List all projects
router.get('/projects', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.*, u.name as owner_name,
                   (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count
            FROM projects p
            LEFT JOIN users u ON p.owner_id = u.id
            WHERE p.owner_id = $1 OR $1 = ANY(p.team_members)
            ORDER BY p.created_at DESC
        `, [req.user.id]);

        res.json({ success: true, data: result.rows });
    } catch (error) {
        logger.error('List projects failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/projects - Create project
router.post('/projects', authenticateToken, async (req, res) => {
    try {
        const { name, description, key, start_date, end_date, color } = req.body;

        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

        const result = await pool.query(`
            INSERT INTO projects (name, slug, description, key, owner_id, color, start_date, end_date, team_members)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ARRAY[$5])
            RETURNING *
        `, [name, slug, description, key, req.user.id, color || '#3B82F6', start_date, end_date]);

        // Create default board with columns
        const boardResult = await pool.query(`
            INSERT INTO project_boards (project_id, name) VALUES ($1, 'Main Board') RETURNING *
        `, [result.rows[0].id]);

        const boardId = boardResult.rows[0].id;
        const columns = [
            ['Backlog', 'backlog', '#6B7280', 0],
            ['To Do', 'todo', '#3B82F6', 1],
            ['In Progress', 'in_progress', '#F59E0B', 2],
            ['Review', 'review', '#8B5CF6', 3],
            ['Done', 'done', '#10B981', 4]
        ];

        for (const [name, type, color, pos] of columns) {
            await pool.query(`
                INSERT INTO board_columns (board_id, name, column_type, color, position)
                VALUES ($1, $2, $3, $4, $5)
            `, [boardId, name, type, color, pos]);
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        logger.error('Create project failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/projects/:id - Get project details
router.get('/projects/:id', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.*, u.name as owner_name
            FROM projects p
            LEFT JOIN users u ON p.owner_id = u.id
            WHERE p.id = $1
        `, [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Project not found' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        logger.error('Get project failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// =====================================================
// BOARDS & COLUMNS
// =====================================================

// GET /api/projects/:id/boards - Get project boards
router.get('/projects/:id/boards', authenticateToken, async (req, res) => {
    try {
        const boards = await pool.query('SELECT * FROM project_boards WHERE project_id = $1 ORDER BY position', [req.params.id]);

        for (const board of boards.rows) {
            const columns = await pool.query('SELECT * FROM board_columns WHERE board_id = $1 ORDER BY position', [board.id]);
            board.columns = columns.rows;
        }

        res.json({ success: true, data: boards.rows });
    } catch (error) {
        logger.error('Get boards failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// =====================================================
// TASKS ENDPOINTS
// =====================================================

// GET /api/projects/:id/tasks - Get project tasks
router.get('/projects/:id/tasks', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT t.*, 
                   u.name as assignee_name, 
                   r.name as reporter_name,
                   c.name as column_name,
                   c.color as column_color
            FROM tasks t
            LEFT JOIN users u ON t.assignee_id = u.id
            LEFT JOIN users r ON t.reporter_id = r.id
            LEFT JOIN board_columns c ON t.column_id = c.id
            WHERE t.project_id = $1
            ORDER BY t.position, t.created_at DESC
        `, [req.params.id]);

        res.json({ success: true, data: result.rows });
    } catch (error) {
        logger.error('Get tasks failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/tasks - Create task
router.post('/tasks', authenticateToken, async (req, res) => {
    try {
        const { project_id, title, description, task_type, priority, assignee_id, column_id, due_date } = req.body;

        const result = await pool.query(`
            INSERT INTO tasks (project_id, title, description, task_type, priority, assignee_id, reporter_id, column_id, due_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `, [project_id, title, description, task_type || 'task', priority || 'medium', assignee_id, req.user.id, column_id, due_date]);

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        logger.error('Create task failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/tasks/:id - Update task
router.put('/tasks/:id', authenticateToken, async (req, res) => {
    try {
        const { title, description, status, priority, assignee_id, column_id, due_date, position } = req.body;

        const result = await pool.query(`
            UPDATE tasks SET
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                status = COALESCE($3, status),
                priority = COALESCE($4, priority),
                assignee_id = COALESCE($5, assignee_id),
                column_id = COALESCE($6, column_id),
                due_date = COALESCE($7, due_date),
                position = COALESCE($8, position),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $9
            RETURNING *
        `, [title, description, status, priority, assignee_id, column_id, due_date, position, req.params.id]);

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        logger.error('Update task failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/tasks/:id - Delete task
router.delete('/tasks/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Task deleted' });
    } catch (error) {
        logger.error('Delete task failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/tasks/:id/move - Move task to column
router.post('/tasks/:id/move', authenticateToken, async (req, res) => {
    try {
        const { column_id, position } = req.body;

        await pool.query('UPDATE tasks SET column_id = $1, position = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3', 
            [column_id, position, req.params.id]);

        res.json({ success: true, message: 'Task moved' });
    } catch (error) {
        logger.error('Move task failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// =====================================================
// TASK COMMENTS
// =====================================================

// GET /api/tasks/:id/comments - Get task comments
router.get('/tasks/:id/comments', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT c.*, u.name as user_name, u.avatar_url
            FROM task_comments c
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.task_id = $1 AND c.deleted_at IS NULL
            ORDER BY c.created_at ASC
        `, [req.params.id]);

        res.json({ success: true, data: result.rows });
    } catch (error) {
        logger.error('Get comments failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/tasks/:id/comments - Add comment
router.post('/tasks/:id/comments', authenticateToken, async (req, res) => {
    try {
        const { content } = req.body;

        const result = await pool.query(`
            INSERT INTO task_comments (task_id, user_id, content)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [req.params.id, req.user.id, content]);

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        logger.error('Add comment failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// =====================================================
// TASK ACTIVITY
// =====================================================

// GET /api/tasks/:id/activity - Get task activity
router.get('/tasks/:id/activity', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT a.*, u.name as user_name
            FROM task_activity a
            LEFT JOIN users u ON a.user_id = u.id
            WHERE a.task_id = $1
            ORDER BY a.created_at DESC
            LIMIT 50
        `, [req.params.id]);

        res.json({ success: true, data: result.rows });
    } catch (error) {
        logger.error('Get activity failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
