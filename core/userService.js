/**
 * User Service
 * Helper-Funktionen für User-Management
 */

const database = require('./database');
const { hashPassword } = require('./auth');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('UserService');

/**
 * Erstellt einen neuen User
 */
async function createUser(userData) {
    const { username, email, password, name, role = 'user', authMethod = 'database' } = userData;

    try {
        // Validierung
        if (!username || !email || !name) {
            throw new Error('Username, Email und Name sind erforderlich');
        }

        if (authMethod === 'database' && !password) {
            throw new Error('Passwort ist erforderlich für database auth');
        }

        // Prüfen ob User bereits existiert
        const existing = await database.query(
            'SELECT id FROM users WHERE username = $1 OR email = $2',
            [username, email]
        );

        if (existing.rows.length > 0) {
            throw new Error('Username oder Email bereits vergeben');
        }

        // Passwort hashen (falls database auth)
        let passwordHash = null;
        if (authMethod === 'database' && password) {
            passwordHash = await hashPassword(password);
        }

        // User erstellen
        const result = await database.query(
            `INSERT INTO users (username, email, password_hash, name, role, auth_method, is_active, is_verified)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id, username, email, name, role, auth_method, is_active, is_verified, created_at`,
            [username, email, passwordHash, name, role, authMethod, true, false]
        );

        const user = result.rows[0];
        logger.info('User erstellt', { userId: user.id, username: user.username });

        return user;

    } catch (error) {
        logger.error('Fehler beim Erstellen des Users', { error: error.message });
        throw error;
    }
}

/**
 * Findet User nach ID
 */
async function findUserById(userId) {
    try {
        const result = await database.query(
            `SELECT id, username, email, name, role, auth_method, ldap_dn,
                    is_active, is_verified, avatar_url, created_at, updated_at, last_login_at
             FROM users WHERE id = $1`,
            [userId]
        );

        return result.rows[0] || null;

    } catch (error) {
        logger.error('Fehler beim Abrufen des Users', { userId, error: error.message });
        throw error;
    }
}

/**
 * Findet User nach Username
 */
async function findUserByUsername(username) {
    try {
        const result = await database.query(
            `SELECT id, username, email, name, role, auth_method, ldap_dn,
                    is_active, is_verified, avatar_url, created_at, updated_at, last_login_at
             FROM users WHERE username = $1`,
            [username]
        );

        return result.rows[0] || null;

    } catch (error) {
        logger.error('Fehler beim Abrufen des Users', { username, error: error.message });
        throw error;
    }
}

/**
 * Findet User nach Email
 */
async function findUserByEmail(email) {
    try {
        const result = await database.query(
            `SELECT id, username, email, name, role, auth_method, ldap_dn,
                    is_active, is_verified, avatar_url, created_at, updated_at, last_login_at
             FROM users WHERE email = $1`,
            [email]
        );

        return result.rows[0] || null;

    } catch (error) {
        logger.error('Fehler beim Abrufen des Users', { email, error: error.message });
        throw error;
    }
}

/**
 * Listet alle User
 */
async function listUsers(filters = {}) {
    const { role, isActive, authMethod, limit = 100, offset = 0 } = filters;

    try {
        let query = `
            SELECT id, username, email, name, role, auth_method,
                   is_active, is_verified, created_at, last_login_at
            FROM users
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (role) {
            query += ` AND role = $${paramIndex++}`;
            params.push(role);
        }

        if (isActive !== undefined) {
            query += ` AND is_active = $${paramIndex++}`;
            params.push(isActive);
        }

        if (authMethod) {
            query += ` AND auth_method = $${paramIndex++}`;
            params.push(authMethod);
        }

        query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(limit, offset);

        const result = await database.query(query, params);

        return result.rows;

    } catch (error) {
        logger.error('Fehler beim Abrufen der User-Liste', { error: error.message });
        throw error;
    }
}

/**
 * Aktualisiert User-Daten
 */
async function updateUser(userId, updates) {
    try {
        const allowedFields = ['name', 'email', 'role', 'avatar_url', 'is_active', 'is_verified'];
        const fields = [];
        const values = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                fields.push(`${key} = $${paramIndex++}`);
                values.push(value);
            }
        }

        if (fields.length === 0) {
            throw new Error('Keine validen Update-Felder angegeben');
        }

        values.push(userId);

        const query = `
            UPDATE users
            SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $${paramIndex}
            RETURNING id, username, email, name, role, is_active, is_verified, updated_at
        `;

        const result = await database.query(query, values);

        if (result.rows.length === 0) {
            throw new Error('User nicht gefunden');
        }

        const user = result.rows[0];
        logger.info('User aktualisiert', { userId, updates: Object.keys(updates) });

        return user;

    } catch (error) {
        logger.error('Fehler beim Aktualisieren des Users', { userId, error: error.message });
        throw error;
    }
}

/**
 * Aktualisiert User-Passwort
 */
async function updatePassword(userId, newPassword) {
    try {
        const passwordHash = await hashPassword(newPassword);

        await database.query(
            'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [passwordHash, userId]
        );

        logger.info('Passwort aktualisiert', { userId });

    } catch (error) {
        logger.error('Fehler beim Aktualisieren des Passworts', { userId, error: error.message });
        throw error;
    }
}

/**
 * Aktualisiert last_login_at
 */
async function updateLastLogin(userId) {
    try {
        await database.query(
            'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
            [userId]
        );

        logger.debug('Last login aktualisiert', { userId });

    } catch (error) {
        logger.error('Fehler beim Aktualisieren von last_login_at', { userId, error: error.message });
    }
}

/**
 * Löscht einen User (Soft Delete)
 */
async function deactivateUser(userId) {
    try {
        await database.query(
            'UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
            [userId]
        );

        logger.info('User deaktiviert', { userId });

    } catch (error) {
        logger.error('Fehler beim Deaktivieren des Users', { userId, error: error.message });
        throw error;
    }
}

/**
 * Löscht einen User permanent (Hard Delete)
 */
async function deleteUser(userId) {
    try {
        await database.query('DELETE FROM users WHERE id = $1', [userId]);

        logger.warn('User permanent gelöscht', { userId });

    } catch (error) {
        logger.error('Fehler beim Löschen des Users', { userId, error: error.message });
        throw error;
    }
}

/**
 * Zählt alle User
 */
async function countUsers(filters = {}) {
    const { role, isActive, authMethod } = filters;

    try {
        let query = 'SELECT COUNT(*) as count FROM users WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        if (role) {
            query += ` AND role = $${paramIndex++}`;
            params.push(role);
        }

        if (isActive !== undefined) {
            query += ` AND is_active = $${paramIndex++}`;
            params.push(isActive);
        }

        if (authMethod) {
            query += ` AND auth_method = $${paramIndex++}`;
            params.push(authMethod);
        }

        const result = await database.query(query, params);

        return parseInt(result.rows[0].count);

    } catch (error) {
        logger.error('Fehler beim Zählen der User', { error: error.message });
        throw error;
    }
}

module.exports = {
    createUser,
    findUserById,
    findUserByUsername,
    findUserByEmail,
    listUsers,
    updateUser,
    updatePassword,
    updateLastLogin,
    deactivateUser,
    deleteUser,
    countUsers
};
