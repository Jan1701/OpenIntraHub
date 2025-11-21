/**
 * OpenIntraHub - Module Registry Service
 *
 * Verwaltung der verfügbaren Page Builder Module
 *
 * @author Jan Günther <jg@linxpress.de>
 * @license Apache-2.0
 */

const database = require('./database');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('ModuleRegistryService');

/**
 * Registriert ein neues Modul
 */
async function registerModule(moduleData) {
    const {
        name,
        type,
        component,
        icon,
        category,
        description,
        settings_schema = {},
        default_config = {},
        version = '1.0.0',
        author,
        required_permission
    } = moduleData;

    try {
        const result = await database.query(
            `INSERT INTO module_registry
            (name, type, component, icon, category, description, settings_schema, default_config, version, author, required_permission)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *`,
            [
                name,
                type,
                component,
                icon,
                category,
                description,
                JSON.stringify(settings_schema),
                JSON.stringify(default_config),
                version,
                author,
                required_permission
            ]
        );

        logger.info('Module registered', { moduleId: result.rows[0].id, name });
        return result.rows[0];
    } catch (error) {
        logger.error('Error registering module', { error: error.message, name });
        throw error;
    }
}

/**
 * Findet Modul nach ID
 */
async function findModuleById(moduleId) {
    try {
        const result = await database.query(
            'SELECT * FROM module_registry WHERE id = $1',
            [moduleId]
        );

        if (result.rows.length === 0) {
            return null;
        }

        return result.rows[0];
    } catch (error) {
        logger.error('Error finding module', { error: error.message, moduleId });
        throw error;
    }
}

/**
 * Findet Modul nach Name
 */
async function findModuleByName(name) {
    try {
        const result = await database.query(
            'SELECT * FROM module_registry WHERE name = $1',
            [name]
        );

        if (result.rows.length === 0) {
            return null;
        }

        return result.rows[0];
    } catch (error) {
        logger.error('Error finding module by name', { error: error.message, name });
        throw error;
    }
}

/**
 * Listet alle Module
 */
async function listModules(filters = {}) {
    const { type, category, is_active = true, search } = filters;

    try {
        let query = 'SELECT * FROM module_registry WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        if (type) {
            query += ` AND type = $${paramIndex}`;
            params.push(type);
            paramIndex++;
        }

        if (category) {
            query += ` AND category = $${paramIndex}`;
            params.push(category);
            paramIndex++;
        }

        if (typeof is_active === 'boolean') {
            query += ` AND is_active = $${paramIndex}`;
            params.push(is_active);
            paramIndex++;
        }

        if (search) {
            query += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        query += ' ORDER BY category, name';

        const result = await database.query(query, params);

        return result.rows;
    } catch (error) {
        logger.error('Error listing modules', { error: error.message, filters });
        throw error;
    }
}

/**
 * Gruppiert Module nach Kategorie
 */
async function getModulesByCategory(is_active = true) {
    try {
        const modules = await listModules({ is_active });

        const grouped = {};

        modules.forEach(module => {
            const cat = module.category || 'uncategorized';
            if (!grouped[cat]) {
                grouped[cat] = [];
            }
            grouped[cat].push(module);
        });

        return grouped;
    } catch (error) {
        logger.error('Error grouping modules by category', { error: error.message });
        throw error;
    }
}

/**
 * Aktualisiert ein Modul
 */
async function updateModule(moduleId, moduleData) {
    const {
        name,
        description,
        icon,
        settings_schema,
        default_config,
        version,
        is_active
    } = moduleData;

    try {
        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (name !== undefined) {
            updates.push(`name = $${paramIndex}`);
            params.push(name);
            paramIndex++;
        }

        if (description !== undefined) {
            updates.push(`description = $${paramIndex}`);
            params.push(description);
            paramIndex++;
        }

        if (icon !== undefined) {
            updates.push(`icon = $${paramIndex}`);
            params.push(icon);
            paramIndex++;
        }

        if (settings_schema !== undefined) {
            updates.push(`settings_schema = $${paramIndex}`);
            params.push(JSON.stringify(settings_schema));
            paramIndex++;
        }

        if (default_config !== undefined) {
            updates.push(`default_config = $${paramIndex}`);
            params.push(JSON.stringify(default_config));
            paramIndex++;
        }

        if (version !== undefined) {
            updates.push(`version = $${paramIndex}`);
            params.push(version);
            paramIndex++;
        }

        if (is_active !== undefined) {
            updates.push(`is_active = $${paramIndex}`);
            params.push(is_active);
            paramIndex++;
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);

        params.push(moduleId);

        const query = `UPDATE module_registry SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

        const result = await database.query(query, params);

        if (result.rows.length === 0) {
            return null;
        }

        logger.info('Module updated', { moduleId });
        return result.rows[0];
    } catch (error) {
        logger.error('Error updating module', { error: error.message, moduleId });
        throw error;
    }
}

/**
 * Löscht ein Modul (nur wenn nicht is_system)
 */
async function deleteModule(moduleId) {
    try {
        // Prüfen ob es ein System-Modul ist
        const module = await findModuleById(moduleId);

        if (!module) {
            return false;
        }

        if (module.is_system) {
            throw new Error('System modules cannot be deleted');
        }

        const result = await database.query(
            'DELETE FROM module_registry WHERE id = $1 AND is_system = false RETURNING *',
            [moduleId]
        );

        if (result.rows.length === 0) {
            return false;
        }

        logger.info('Module deleted', { moduleId });
        return true;
    } catch (error) {
        logger.error('Error deleting module', { error: error.message, moduleId });
        throw error;
    }
}

/**
 * Zählt Module-Verwendungen auf Seiten
 */
async function countModuleUsage(moduleId) {
    try {
        const result = await database.query(
            'SELECT COUNT(*) FROM page_modules WHERE module_id = $1',
            [moduleId]
        );

        return parseInt(result.rows[0].count);
    } catch (error) {
        logger.error('Error counting module usage', { error: error.message, moduleId });
        throw error;
    }
}

/**
 * Aktiviert/Deaktiviert ein Modul
 */
async function toggleModuleActive(moduleId, is_active) {
    try {
        const result = await database.query(
            'UPDATE module_registry SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
            [is_active, moduleId]
        );

        if (result.rows.length === 0) {
            return null;
        }

        logger.info('Module active status toggled', { moduleId, is_active });
        return result.rows[0];
    } catch (error) {
        logger.error('Error toggling module active status', { error: error.message, moduleId });
        throw error;
    }
}

module.exports = {
    registerModule,
    findModuleById,
    findModuleByName,
    listModules,
    getModulesByCategory,
    updateModule,
    deleteModule,
    countModuleUsage,
    toggleModuleActive
};
