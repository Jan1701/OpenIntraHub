/**
 * Location Service
 * Verwaltet Standorte, Zuordnungen und AD-Integration
 * Author: Jan Günther <jg@linxpress.de>
 */

const database = require('./database');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('LocationService');

// ==============================================
// LOCATIONS
// ==============================================

/**
 * Create a new location
 */
async function createLocation(locationData, userId) {
    const {
        name,
        code,
        type = 'office',
        parent_id,
        street,
        street2,
        postal_code,
        city,
        state,
        country = 'DE',
        phone,
        fax,
        email,
        website,
        latitude,
        longitude,
        timezone = 'Europe/Berlin',
        ad_ou,
        ad_site,
        ad_sync_enabled = false,
        capacity,
        opening_hours,
        emergency_contacts,
        facilities,
        manager_id,
        is_headquarters = false,
        is_active = true,
        image_url,
        logo_url,
        custom_fields
    } = locationData;

    const result = await database.query(
        `INSERT INTO locations (
            name, code, type, parent_id, street, street2, postal_code, city, state, country,
            phone, fax, email, website, latitude, longitude, timezone,
            ad_ou, ad_site, ad_sync_enabled, capacity, opening_hours, emergency_contacts, facilities,
            manager_id, is_headquarters, is_active, image_url, logo_url, custom_fields, created_by
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17,
            $18, $19, $20, $21, $22, $23, $24,
            $25, $26, $27, $28, $29, $30, $31
        ) RETURNING *`,
        [
            name, code, type, parent_id, street, street2, postal_code, city, state, country,
            phone, fax, email, website, latitude, longitude, timezone,
            ad_ou, ad_site, ad_sync_enabled, capacity,
            opening_hours ? JSON.stringify(opening_hours) : null,
            emergency_contacts ? JSON.stringify(emergency_contacts) : null,
            facilities ? JSON.stringify(facilities) : null,
            manager_id, is_headquarters, is_active, image_url, logo_url,
            custom_fields ? JSON.stringify(custom_fields) : null,
            userId
        ]
    );

    logger.info('Location created', { locationId: result.rows[0].id, code, name });
    return result.rows[0];
}

/**
 * Find location by ID
 */
async function findLocationById(locationId, includeUsers = false) {
    const query = `
        SELECT l.*,
               u.username as manager_name,
               p.name as parent_location_name
        FROM locations l
        LEFT JOIN users u ON u.id = l.manager_id
        LEFT JOIN locations p ON p.id = l.parent_id
        WHERE l.id = $1
    `;

    const result = await database.query(query, [locationId]);

    if (result.rows.length === 0) {
        throw new Error('Location not found');
    }

    const location = result.rows[0];

    if (includeUsers) {
        // Load assigned users
        const usersResult = await database.query(
            `SELECT ul.*, u.username, u.email, u.display_name
             FROM user_locations ul
             JOIN users u ON u.id = ul.user_id
             WHERE ul.location_id = $1
             ORDER BY ul.is_primary DESC, u.username ASC`,
            [locationId]
        );
        location.users = usersResult.rows;
    }

    return location;
}

/**
 * Find location by code
 */
async function findLocationByCode(code) {
    const result = await database.query(
        `SELECT l.*,
                u.username as manager_name,
                p.name as parent_location_name
         FROM locations l
         LEFT JOIN users u ON u.id = l.manager_id
         LEFT JOIN locations p ON p.id = l.parent_id
         WHERE l.code = $1`,
        [code]
    );

    if (result.rows.length === 0) {
        throw new Error('Location not found');
    }

    return result.rows[0];
}

/**
 * List all locations with filtering
 */
async function listLocations(options = {}) {
    const {
        is_active,
        type,
        country,
        parent_id,
        search,
        include_user_count = false
    } = options;

    const conditions = [];
    const params = [];

    if (is_active !== undefined) {
        params.push(is_active);
        conditions.push(`l.is_active = $${params.length}`);
    }

    if (type) {
        params.push(type);
        conditions.push(`l.type = $${params.length}`);
    }

    if (country) {
        params.push(country);
        conditions.push(`l.country = $${params.length}`);
    }

    if (parent_id !== undefined) {
        if (parent_id === null) {
            conditions.push(`l.parent_id IS NULL`);
        } else {
            params.push(parent_id);
            conditions.push(`l.parent_id = $${params.length}`);
        }
    }

    if (search) {
        params.push(`%${search}%`);
        conditions.push(`(l.name ILIKE $${params.length} OR l.city ILIKE $${params.length} OR l.code ILIKE $${params.length})`);
    }

    let query = `
        SELECT l.*,
               u.username as manager_name,
               p.name as parent_location_name
    `;

    if (include_user_count) {
        query += `, COUNT(DISTINCT ul.user_id) as user_count`;
    }

    query += `
        FROM locations l
        LEFT JOIN users u ON u.id = l.manager_id
        LEFT JOIN locations p ON p.id = l.parent_id
    `;

    if (include_user_count) {
        query += `LEFT JOIN user_locations ul ON ul.location_id = l.id`;
    }

    if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
    }

    if (include_user_count) {
        query += ` GROUP BY l.id, u.username, p.name`;
    }

    query += ` ORDER BY l.is_headquarters DESC, l.name ASC`;

    const result = await database.query(query, params);
    return result.rows;
}

/**
 * Update location
 */
async function updateLocation(locationId, updates, userId) {
    const allowedFields = [
        'name', 'code', 'type', 'parent_id', 'street', 'street2', 'postal_code',
        'city', 'state', 'country', 'phone', 'fax', 'email', 'website',
        'latitude', 'longitude', 'timezone', 'ad_ou', 'ad_site', 'ad_sync_enabled',
        'capacity', 'opening_hours', 'emergency_contacts', 'facilities',
        'manager_id', 'is_headquarters', 'is_active', 'image_url', 'logo_url',
        'custom_fields'
    ];

    const fields = [];
    const params = [];

    Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
            params.push(updates[key]);
            fields.push(`${key} = $${params.length}`);
        }
    });

    if (fields.length === 0) {
        throw new Error('No valid fields to update');
    }

    params.push(userId);
    fields.push(`updated_by = $${params.length}`);

    params.push(locationId);
    const result = await database.query(
        `UPDATE locations
         SET ${fields.join(', ')}
         WHERE id = $${params.length}
         RETURNING *`,
        params
    );

    if (result.rows.length === 0) {
        throw new Error('Location not found');
    }

    logger.info('Location updated', { locationId, userId });
    return result.rows[0];
}

/**
 * Delete location
 */
async function deleteLocation(locationId) {
    // Check if location has users
    const userCount = await database.query(
        'SELECT COUNT(*) as count FROM user_locations WHERE location_id = $1',
        [locationId]
    );

    if (parseInt(userCount.rows[0].count) > 0) {
        throw new Error('Cannot delete location with assigned users');
    }

    // Check if location has children
    const childCount = await database.query(
        'SELECT COUNT(*) as count FROM locations WHERE parent_id = $1',
        [locationId]
    );

    if (parseInt(childCount.rows[0].count) > 0) {
        throw new Error('Cannot delete location with child locations');
    }

    await database.query('DELETE FROM locations WHERE id = $1', [locationId]);
    logger.info('Location deleted', { locationId });
}

/**
 * Get location hierarchy (tree structure)
 */
async function getLocationHierarchy(rootId = null) {
    const query = `
        WITH RECURSIVE location_tree AS (
            -- Base case
            SELECT l.*, 0 as level,
                   ARRAY[l.id] as path
            FROM locations l
            WHERE l.parent_id ${rootId ? '= $1' : 'IS NULL'}

            UNION ALL

            -- Recursive case
            SELECT l.*, lt.level + 1,
                   lt.path || l.id
            FROM locations l
            JOIN location_tree lt ON l.parent_id = lt.id
        )
        SELECT * FROM location_tree
        ORDER BY path
    `;

    const params = rootId ? [rootId] : [];
    const result = await database.query(query, params);
    return result.rows;
}

// ==============================================
// USER LOCATION ASSIGNMENTS
// ==============================================

/**
 * Assign user to location
 */
async function assignUserToLocation(userId, locationId, options = {}, assignedBy = null) {
    const {
        is_primary = false,
        role_at_location,
        department,
        valid_from,
        valid_until,
        work_model = 'on_site'
    } = options;

    const result = await database.query(
        `INSERT INTO user_locations (
            user_id, location_id, is_primary, role_at_location, department,
            valid_from, valid_until, work_model, assigned_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (user_id, location_id)
        DO UPDATE SET
            is_primary = EXCLUDED.is_primary,
            role_at_location = EXCLUDED.role_at_location,
            department = EXCLUDED.department,
            valid_from = EXCLUDED.valid_from,
            valid_until = EXCLUDED.valid_until,
            work_model = EXCLUDED.work_model
        RETURNING *`,
        [userId, locationId, is_primary, role_at_location, department,
         valid_from, valid_until, work_model, assignedBy]
    );

    logger.info('User assigned to location', { userId, locationId, is_primary });
    return result.rows[0];
}

/**
 * Remove user from location
 */
async function removeUserFromLocation(userId, locationId) {
    await database.query(
        'DELETE FROM user_locations WHERE user_id = $1 AND location_id = $2',
        [userId, locationId]
    );

    logger.info('User removed from location', { userId, locationId });
}

/**
 * Get user's locations
 */
async function getUserLocations(userId) {
    const result = await database.query(
        `SELECT ul.*, l.name, l.code, l.city, l.country
         FROM user_locations ul
         JOIN locations l ON l.id = ul.location_id
         WHERE ul.user_id = $1
         ORDER BY ul.is_primary DESC, l.name ASC`,
        [userId]
    );

    return result.rows;
}

/**
 * Get user's primary location
 */
async function getUserPrimaryLocation(userId) {
    const result = await database.query(
        `SELECT ul.*, l.*
         FROM user_locations ul
         JOIN locations l ON l.id = ul.location_id
         WHERE ul.user_id = $1 AND ul.is_primary = true
         LIMIT 1`,
        [userId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Get location's users
 */
async function getLocationUsers(locationId, options = {}) {
    const { include_inactive = false } = options;

    let query = `
        SELECT ul.*, u.username, u.email, u.display_name, u.is_active
        FROM user_locations ul
        JOIN users u ON u.id = ul.user_id
        WHERE ul.location_id = $1
    `;

    if (!include_inactive) {
        query += ` AND u.is_active = true`;
    }

    query += ` ORDER BY ul.is_primary DESC, u.username ASC`;

    const result = await database.query(query, [locationId]);
    return result.rows;
}

/**
 * Set primary location for user
 */
async function setPrimaryLocation(userId, locationId) {
    // Check if assignment exists
    const exists = await database.query(
        'SELECT id FROM user_locations WHERE user_id = $1 AND location_id = $2',
        [userId, locationId]
    );

    if (exists.rows.length === 0) {
        throw new Error('User is not assigned to this location');
    }

    // Update - trigger will handle setting others to false
    await database.query(
        'UPDATE user_locations SET is_primary = true WHERE user_id = $1 AND location_id = $2',
        [userId, locationId]
    );

    logger.info('Primary location set', { userId, locationId });
}

// ==============================================
// LOCATION SETTINGS
// ==============================================

/**
 * Set location setting
 */
async function setLocationSetting(locationId, key, value, type = 'string', userId = null) {
    await database.query(
        `INSERT INTO location_settings (location_id, setting_key, setting_value, setting_type, updated_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (location_id, setting_key)
         DO UPDATE SET
            setting_value = EXCLUDED.setting_value,
            setting_type = EXCLUDED.setting_type,
            updated_by = EXCLUDED.updated_by,
            updated_at = CURRENT_TIMESTAMP`,
        [locationId, key, JSON.stringify(value), type, userId]
    );
}

/**
 * Get location setting
 */
async function getLocationSetting(locationId, key) {
    const result = await database.query(
        'SELECT setting_value, setting_type FROM location_settings WHERE location_id = $1 AND setting_key = $2',
        [locationId, key]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0].setting_value;
}

/**
 * Get all location settings
 */
async function getLocationSettings(locationId) {
    const result = await database.query(
        'SELECT setting_key, setting_value, setting_type FROM location_settings WHERE location_id = $1',
        [locationId]
    );

    const settings = {};
    result.rows.forEach(row => {
        settings[row.setting_key] = row.setting_value;
    });

    return settings;
}

// ==============================================
// LOCATION RESOURCES
// ==============================================

/**
 * Create location resource (meeting room, parking, etc.)
 */
async function createLocationResource(locationId, resourceData, userId) {
    const {
        resource_type,
        name,
        code,
        description,
        capacity = 1,
        is_bookable = true,
        requires_approval = false,
        equipment,
        max_booking_duration,
        min_booking_duration = 30,
        booking_buffer = 0
    } = resourceData;

    const result = await database.query(
        `INSERT INTO location_resources (
            location_id, resource_type, name, code, description, capacity,
            is_bookable, requires_approval, equipment,
            max_booking_duration, min_booking_duration, booking_buffer, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [locationId, resource_type, name, code, description, capacity,
         is_bookable, requires_approval, equipment ? JSON.stringify(equipment) : null,
         max_booking_duration, min_booking_duration, booking_buffer, userId]
    );

    return result.rows[0];
}

/**
 * List location resources
 */
async function listLocationResources(locationId, resourceType = null) {
    let query = 'SELECT * FROM location_resources WHERE location_id = $1';
    const params = [locationId];

    if (resourceType) {
        params.push(resourceType);
        query += ` AND resource_type = $${params.length}`;
    }

    query += ' AND is_active = true ORDER BY name ASC';

    const result = await database.query(query, params);
    return result.rows;
}

/**
 * Update location resource
 */
async function updateLocationResource(resourceId, updates) {
    const allowedFields = [
        'name', 'code', 'description', 'capacity', 'is_bookable',
        'requires_approval', 'equipment', 'max_booking_duration',
        'min_booking_duration', 'booking_buffer', 'is_active'
    ];

    const fields = [];
    const params = [];

    Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
            params.push(updates[key]);
            fields.push(`${key} = $${params.length}`);
        }
    });

    if (fields.length === 0) {
        throw new Error('No valid fields to update');
    }

    params.push(resourceId);
    const result = await database.query(
        `UPDATE location_resources
         SET ${fields.join(', ')}
         WHERE id = $${params.length}
         RETURNING *`,
        params
    );

    if (result.rows.length === 0) {
        throw new Error('Resource not found');
    }

    return result.rows[0];
}

/**
 * Delete location resource
 */
async function deleteLocationResource(resourceId) {
    await database.query('DELETE FROM location_resources WHERE id = $1', [resourceId]);
}

// ==============================================
// AD INTEGRATION
// ==============================================

/**
 * Sync location from Active Directory
 */
async function syncLocationFromAD(locationId) {
    const location = await findLocationById(locationId);

    if (!location.ad_sync_enabled || !location.ad_ou) {
        throw new Error('AD sync not enabled for this location');
    }

    // TODO: Implement actual AD sync logic
    // This would use LDAP to query the AD and sync data

    logger.info('AD sync triggered for location', { locationId });

    // Update last sync timestamp
    await database.query(
        'UPDATE locations SET last_ad_sync = CURRENT_TIMESTAMP WHERE id = $1',
        [locationId]
    );
}

// ==============================================
// STATISTICS
// ==============================================

/**
 * Get location statistics
 */
async function getLocationStatistics(locationId) {
    const stats = {};

    // User count
    const userCount = await database.query(
        'SELECT COUNT(*) as count FROM user_locations WHERE location_id = $1',
        [locationId]
    );
    stats.user_count = parseInt(userCount.rows[0].count);

    // Resource count
    const resourceCount = await database.query(
        'SELECT COUNT(*) as count FROM location_resources WHERE location_id = $1 AND is_active = true',
        [locationId]
    );
    stats.resource_count = parseInt(resourceCount.rows[0].count);

    // Work model distribution
    const workModels = await database.query(
        `SELECT work_model, COUNT(*) as count
         FROM user_locations
         WHERE location_id = $1
         GROUP BY work_model`,
        [locationId]
    );
    stats.work_models = workModels.rows;

    return stats;
}

// ==============================================
// EXPORTS
// ==============================================

module.exports = {
    // Locations
    createLocation,
    findLocationById,
    findLocationByCode,
    listLocations,
    updateLocation,
    deleteLocation,
    getLocationHierarchy,

    // User Assignments
    assignUserToLocation,
    removeUserFromLocation,
    getUserLocations,
    getUserPrimaryLocation,
    getLocationUsers,
    setPrimaryLocation,

    // Settings
    setLocationSetting,
    getLocationSetting,
    getLocationSettings,

    // Resources
    createLocationResource,
    listLocationResources,
    updateLocationResource,
    deleteLocationResource,

    // AD Integration
    syncLocationFromAD,

    // Statistics
    getLocationStatistics
};
