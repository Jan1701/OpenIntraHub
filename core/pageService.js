/**
 * OpenIntraHub - Page Service
 *
 * Service für Page-Management (CRUD Operations)
 *
 * @author Jan Günther <jg@linxpress.de>
 * @license Apache-2.0
 */

const database = require('./database');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('PageService');

/**
 * Erstellt eine neue Page
 */
async function createPage(pageData, userId) {
    const {
        title,
        slug,
        template = 'default',
        layout_type = 'grid',
        status = 'draft',
        is_public = true,
        page_config = {},
        meta_title,
        meta_description
    } = pageData;

    try {
        const result = await database.query(
            `INSERT INTO pages
            (title, slug, template, layout_type, status, is_public, page_config, meta_title, meta_description, created_by, updated_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
            RETURNING *`,
            [title, slug, template, layout_type, status, is_public, JSON.stringify(page_config), meta_title, meta_description, userId]
        );

        logger.info('Page created', { pageId: result.rows[0].id, title, userId });
        return result.rows[0];
    } catch (error) {
        logger.error('Error creating page', { error: error.message, title, userId });
        throw error;
    }
}

/**
 * Findet Page nach ID mit allen Sections und Modules
 */
async function findPageById(pageId, includeDetails = true) {
    try {
        const pageResult = await database.query(
            'SELECT * FROM pages WHERE id = $1',
            [pageId]
        );

        if (pageResult.rows.length === 0) {
            return null;
        }

        const page = pageResult.rows[0];

        if (!includeDetails) {
            return page;
        }

        // Sections laden
        const sectionsResult = await database.query(
            `SELECT * FROM page_sections
             WHERE page_id = $1
             ORDER BY position ASC`,
            [pageId]
        );

        page.sections = sectionsResult.rows;

        // Modules für jede Section laden
        for (const section of page.sections) {
            const modulesResult = await database.query(
                `SELECT pm.*, mr.name as module_name, mr.component, mr.type as module_type
                 FROM page_modules pm
                 JOIN module_registry mr ON pm.module_id = mr.id
                 WHERE pm.section_id = $1
                 ORDER BY pm.position ASC`,
                [section.id]
            );
            section.modules = modulesResult.rows;
        }

        return page;
    } catch (error) {
        logger.error('Error finding page', { error: error.message, pageId });
        throw error;
    }
}

/**
 * Findet Page nach Slug
 */
async function findPageBySlug(slug, includeDetails = true) {
    try {
        const pageResult = await database.query(
            'SELECT * FROM pages WHERE slug = $1',
            [slug]
        );

        if (pageResult.rows.length === 0) {
            return null;
        }

        if (includeDetails) {
            return findPageById(pageResult.rows[0].id, true);
        }

        return pageResult.rows[0];
    } catch (error) {
        logger.error('Error finding page by slug', { error: error.message, slug });
        throw error;
    }
}

/**
 * Listet alle Pages
 */
async function listPages(filters = {}) {
    const { status, is_public, limit = 50, offset = 0, search } = filters;

    try {
        let query = 'SELECT * FROM pages WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        if (status) {
            query += ` AND status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (typeof is_public === 'boolean') {
            query += ` AND is_public = $${paramIndex}`;
            params.push(is_public);
            paramIndex++;
        }

        if (search) {
            query += ` AND (title ILIKE $${paramIndex} OR slug ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        query += ` ORDER BY updated_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await database.query(query, params);

        // Count total
        const countQuery = query.substring(0, query.indexOf('ORDER BY')).replace('SELECT *', 'SELECT COUNT(*)');
        const countResult = await database.query(countQuery, params.slice(0, -2));

        return {
            pages: result.rows,
            total: parseInt(countResult.rows[0].count),
            limit,
            offset
        };
    } catch (error) {
        logger.error('Error listing pages', { error: error.message, filters });
        throw error;
    }
}

/**
 * Aktualisiert eine Page
 */
async function updatePage(pageId, pageData, userId) {
    const {
        title,
        slug,
        template,
        layout_type,
        status,
        is_public,
        page_config,
        custom_css,
        custom_js,
        meta_title,
        meta_description,
        meta_keywords
    } = pageData;

    try {
        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (title !== undefined) {
            updates.push(`title = $${paramIndex}`);
            params.push(title);
            paramIndex++;
        }

        if (slug !== undefined) {
            updates.push(`slug = $${paramIndex}`);
            params.push(slug);
            paramIndex++;
        }

        if (template !== undefined) {
            updates.push(`template = $${paramIndex}`);
            params.push(template);
            paramIndex++;
        }

        if (layout_type !== undefined) {
            updates.push(`layout_type = $${paramIndex}`);
            params.push(layout_type);
            paramIndex++;
        }

        if (status !== undefined) {
            updates.push(`status = $${paramIndex}`);
            params.push(status);
            paramIndex++;

            if (status === 'published') {
                updates.push(`published_at = CURRENT_TIMESTAMP`);
            }
        }

        if (is_public !== undefined) {
            updates.push(`is_public = $${paramIndex}`);
            params.push(is_public);
            paramIndex++;
        }

        if (page_config !== undefined) {
            updates.push(`page_config = $${paramIndex}`);
            params.push(JSON.stringify(page_config));
            paramIndex++;
        }

        if (custom_css !== undefined) {
            updates.push(`custom_css = $${paramIndex}`);
            params.push(custom_css);
            paramIndex++;
        }

        if (custom_js !== undefined) {
            updates.push(`custom_js = $${paramIndex}`);
            params.push(custom_js);
            paramIndex++;
        }

        if (meta_title !== undefined) {
            updates.push(`meta_title = $${paramIndex}`);
            params.push(meta_title);
            paramIndex++;
        }

        if (meta_description !== undefined) {
            updates.push(`meta_description = $${paramIndex}`);
            params.push(meta_description);
            paramIndex++;
        }

        if (meta_keywords !== undefined) {
            updates.push(`meta_keywords = $${paramIndex}`);
            params.push(meta_keywords);
            paramIndex++;
        }

        updates.push(`updated_by = $${paramIndex}`);
        params.push(userId);
        paramIndex++;

        updates.push(`updated_at = CURRENT_TIMESTAMP`);

        params.push(pageId);

        const query = `UPDATE pages SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

        const result = await database.query(query, params);

        if (result.rows.length === 0) {
            return null;
        }

        logger.info('Page updated', { pageId, userId });
        return result.rows[0];
    } catch (error) {
        logger.error('Error updating page', { error: error.message, pageId, userId });
        throw error;
    }
}

/**
 * Löscht eine Page
 */
async function deletePage(pageId, userId) {
    try {
        const result = await database.query(
            'DELETE FROM pages WHERE id = $1 RETURNING *',
            [pageId]
        );

        if (result.rows.length === 0) {
            return false;
        }

        logger.info('Page deleted', { pageId, userId });
        return true;
    } catch (error) {
        logger.error('Error deleting page', { error: error.message, pageId, userId });
        throw error;
    }
}

/**
 * Erstellt eine Section
 */
async function createSection(sectionData) {
    const {
        page_id,
        name,
        section_type = 'container',
        position = 0,
        parent_section_id,
        grid_columns = 12,
        width = 'full',
        styles = {}
    } = sectionData;

    try {
        const result = await database.query(
            `INSERT INTO page_sections
            (page_id, name, section_type, position, parent_section_id, grid_columns, width, styles)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [page_id, name, section_type, position, parent_section_id, grid_columns, width, JSON.stringify(styles)]
        );

        logger.info('Section created', { sectionId: result.rows[0].id, page_id, name });
        return result.rows[0];
    } catch (error) {
        logger.error('Error creating section', { error: error.message, page_id, name });
        throw error;
    }
}

/**
 * Aktualisiert eine Section
 */
async function updateSection(sectionId, sectionData) {
    const {
        name,
        position,
        grid_columns,
        width,
        styles,
        mobile_styles,
        tablet_styles,
        is_visible
    } = sectionData;

    try {
        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (name !== undefined) {
            updates.push(`name = $${paramIndex}`);
            params.push(name);
            paramIndex++;
        }

        if (position !== undefined) {
            updates.push(`position = $${paramIndex}`);
            params.push(position);
            paramIndex++;
        }

        if (grid_columns !== undefined) {
            updates.push(`grid_columns = $${paramIndex}`);
            params.push(grid_columns);
            paramIndex++;
        }

        if (width !== undefined) {
            updates.push(`width = $${paramIndex}`);
            params.push(width);
            paramIndex++;
        }

        if (styles !== undefined) {
            updates.push(`styles = $${paramIndex}`);
            params.push(JSON.stringify(styles));
            paramIndex++;
        }

        if (mobile_styles !== undefined) {
            updates.push(`mobile_styles = $${paramIndex}`);
            params.push(JSON.stringify(mobile_styles));
            paramIndex++;
        }

        if (tablet_styles !== undefined) {
            updates.push(`tablet_styles = $${paramIndex}`);
            params.push(JSON.stringify(tablet_styles));
            paramIndex++;
        }

        if (is_visible !== undefined) {
            updates.push(`is_visible = $${paramIndex}`);
            params.push(is_visible);
            paramIndex++;
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);

        params.push(sectionId);

        const query = `UPDATE page_sections SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

        const result = await database.query(query, params);

        if (result.rows.length === 0) {
            return null;
        }

        logger.info('Section updated', { sectionId });
        return result.rows[0];
    } catch (error) {
        logger.error('Error updating section', { error: error.message, sectionId });
        throw error;
    }
}

/**
 * Löscht eine Section
 */
async function deleteSection(sectionId) {
    try {
        const result = await database.query(
            'DELETE FROM page_sections WHERE id = $1 RETURNING *',
            [sectionId]
        );

        if (result.rows.length === 0) {
            return false;
        }

        logger.info('Section deleted', { sectionId });
        return true;
    } catch (error) {
        logger.error('Error deleting section', { error: error.message, sectionId });
        throw error;
    }
}

/**
 * Fügt ein Modul zu einer Section hinzu
 */
async function addModuleToSection(moduleData) {
    const {
        page_id,
        section_id,
        module_id,
        position = 0,
        config = {},
        content = {},
        styles = {}
    } = moduleData;

    try {
        const result = await database.query(
            `INSERT INTO page_modules
            (page_id, section_id, module_id, position, config, content, styles)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [page_id, section_id, module_id, position, JSON.stringify(config), JSON.stringify(content), JSON.stringify(styles)]
        );

        logger.info('Module added to section', {
            moduleInstanceId: result.rows[0].id,
            section_id,
            module_id
        });
        return result.rows[0];
    } catch (error) {
        logger.error('Error adding module to section', { error: error.message, section_id, module_id });
        throw error;
    }
}

/**
 * Aktualisiert ein Page Module
 */
async function updatePageModule(moduleInstanceId, moduleData) {
    const {
        position,
        config,
        content,
        styles,
        is_visible
    } = moduleData;

    try {
        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (position !== undefined) {
            updates.push(`position = $${paramIndex}`);
            params.push(position);
            paramIndex++;
        }

        if (config !== undefined) {
            updates.push(`config = $${paramIndex}`);
            params.push(JSON.stringify(config));
            paramIndex++;
        }

        if (content !== undefined) {
            updates.push(`content = $${paramIndex}`);
            params.push(JSON.stringify(content));
            paramIndex++;
        }

        if (styles !== undefined) {
            updates.push(`styles = $${paramIndex}`);
            params.push(JSON.stringify(styles));
            paramIndex++;
        }

        if (is_visible !== undefined) {
            updates.push(`is_visible = $${paramIndex}`);
            params.push(is_visible);
            paramIndex++;
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);

        params.push(moduleInstanceId);

        const query = `UPDATE page_modules SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

        const result = await database.query(query, params);

        if (result.rows.length === 0) {
            return null;
        }

        logger.info('Page module updated', { moduleInstanceId });
        return result.rows[0];
    } catch (error) {
        logger.error('Error updating page module', { error: error.message, moduleInstanceId });
        throw error;
    }
}

/**
 * Löscht ein Page Module
 */
async function deletePageModule(moduleInstanceId) {
    try {
        const result = await database.query(
            'DELETE FROM page_modules WHERE id = $1 RETURNING *',
            [moduleInstanceId]
        );

        if (result.rows.length === 0) {
            return false;
        }

        logger.info('Page module deleted', { moduleInstanceId });
        return true;
    } catch (error) {
        logger.error('Error deleting page module', { error: error.message, moduleInstanceId });
        throw error;
    }
}

/**
 * Findet Homepage
 */
async function getHomepage() {
    try {
        const result = await database.query(
            'SELECT * FROM pages WHERE is_homepage = true AND status = $1 LIMIT 1',
            ['published']
        );

        if (result.rows.length === 0) {
            return null;
        }

        return findPageById(result.rows[0].id, true);
    } catch (error) {
        logger.error('Error getting homepage', { error: error.message });
        throw error;
    }
}

module.exports = {
    createPage,
    findPageById,
    findPageBySlug,
    listPages,
    updatePage,
    deletePage,
    createSection,
    updateSection,
    deleteSection,
    addModuleToSection,
    updatePageModule,
    deletePageModule,
    getHomepage
};
