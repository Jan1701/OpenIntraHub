/**
 * Events Service
 * Business-Logic für Kalender, Events und Teilnehmerverwaltung
 * Author: Jan Günther <jg@linxpress.de>
 */

const database = require('./database');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('EventsService');

// ==============================================
// EVENT CRUD OPERATIONS
// ==============================================

/**
 * Creates a new event
 */
async function createEvent(eventData, userId) {
    const {
        title,
        description,
        start_time,
        end_time,
        all_day = false,
        timezone = 'Europe/Berlin',
        is_recurring = false,
        recurrence_rule,
        location_id,
        location_details,
        is_online = false,
        meeting_url,
        category = 'general',
        visibility = 'private',
        requires_approval = false,
        max_participants,
        allow_guests = false,
        status = 'confirmed',
        color,
        tags = []
    } = eventData;

    try {
        // Validate required fields
        if (!title || !start_time || !end_time) {
            throw new Error('Title, start_time, and end_time are required');
        }

        // Validate time range
        if (new Date(end_time) <= new Date(start_time)) {
            throw new Error('End time must be after start time');
        }

        const result = await database.query(
            `INSERT INTO events (
                title, description, start_time, end_time, all_day, timezone,
                is_recurring, recurrence_rule, location_id, location_details,
                is_online, meeting_url, organizer_id, category, visibility,
                requires_approval, max_participants, allow_guests, status,
                color, tags, created_by, updated_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $22)
            RETURNING *`,
            [
                title, description, start_time, end_time, all_day, timezone,
                is_recurring, recurrence_rule, location_id, location_details,
                is_online, meeting_url, userId, category, visibility,
                requires_approval, max_participants, allow_guests, status,
                color, JSON.stringify(tags), userId
            ]
        );

        const event = result.rows[0];

        // Auto-add organizer as participant
        await addEventParticipant(event.id, {
            user_id: userId,
            status: 'accepted',
            is_organizer: true,
            is_required: true
        }, userId);

        logger.info('Event created', { eventId: event.id, title: event.title, organizer: userId });

        return event;

    } catch (error) {
        logger.error('Error creating event', { error: error.message, userId });
        throw error;
    }
}

/**
 * Find event by ID
 */
async function findEventById(eventId) {
    try {
        const result = await database.query(
            `SELECT e.*,
                    u.name as organizer_name,
                    u.email as organizer_email,
                    l.name as location_name,
                    l.code as location_code,
                    (SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id = e.id) as participant_count,
                    (SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id = e.id AND ep.status = 'accepted') as accepted_count
             FROM events e
             LEFT JOIN users u ON u.id = e.organizer_id
             LEFT JOIN locations l ON l.id = e.location_id
             WHERE e.id = $1`,
            [eventId]
        );

        return result.rows[0] || null;

    } catch (error) {
        logger.error('Error finding event', { eventId, error: error.message });
        throw error;
    }
}

/**
 * List events with filters
 */
async function listEvents(filters = {}) {
    const {
        start_date,
        end_date,
        organizer_id,
        location_id,
        category,
        visibility,
        status,
        user_id, // Events where user is participant
        include_recurring = true,
        limit = 100,
        offset = 0
    } = filters;

    try {
        let query = `
            SELECT DISTINCT e.*,
                   u.name as organizer_name,
                   l.name as location_name,
                   (SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id = e.id AND ep.status = 'accepted') as accepted_count
            FROM events e
            LEFT JOIN users u ON u.id = e.organizer_id
            LEFT JOIN locations l ON l.id = e.location_id
            LEFT JOIN event_participants ep ON ep.event_id = e.id
            WHERE e.is_active = true
        `;

        const params = [];
        let paramIndex = 1;

        if (start_date) {
            query += ` AND e.end_time >= $${paramIndex++}`;
            params.push(start_date);
        }

        if (end_date) {
            query += ` AND e.start_time <= $${paramIndex++}`;
            params.push(end_date);
        }

        if (organizer_id) {
            query += ` AND e.organizer_id = $${paramIndex++}`;
            params.push(organizer_id);
        }

        if (location_id) {
            query += ` AND e.location_id = $${paramIndex++}`;
            params.push(location_id);
        }

        if (category) {
            query += ` AND e.category = $${paramIndex++}`;
            params.push(category);
        }

        if (visibility) {
            query += ` AND e.visibility = $${paramIndex++}`;
            params.push(visibility);
        }

        if (status) {
            query += ` AND e.status = $${paramIndex++}`;
            params.push(status);
        }

        if (user_id) {
            query += ` AND ep.user_id = $${paramIndex++}`;
            params.push(user_id);
        }

        if (!include_recurring) {
            query += ` AND e.is_recurring = false`;
        }

        query += ` ORDER BY e.start_time ASC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(limit, offset);

        const result = await database.query(query, params);

        return result.rows;

    } catch (error) {
        logger.error('Error listing events', { error: error.message, filters });
        throw error;
    }
}

/**
 * Update event
 */
async function updateEvent(eventId, updates, userId) {
    try {
        const allowedFields = [
            'title', 'description', 'start_time', 'end_time', 'all_day',
            'timezone', 'location_id', 'location_details', 'is_online',
            'meeting_url', 'category', 'visibility', 'requires_approval',
            'max_participants', 'allow_guests', 'status', 'color', 'tags'
        ];

        const fields = [];
        const values = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                fields.push(`${key} = $${paramIndex++}`);
                values.push(key === 'tags' ? JSON.stringify(value) : value);
            }
        }

        if (fields.length === 0) {
            throw new Error('No valid update fields provided');
        }

        values.push(userId, eventId);

        const query = `
            UPDATE events
            SET ${fields.join(', ')}, updated_by = $${paramIndex++}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $${paramIndex}
            RETURNING *
        `;

        const result = await database.query(query, values);

        if (result.rows.length === 0) {
            throw new Error('Event not found');
        }

        const event = result.rows[0];

        // If time changed, update reminders
        if (updates.start_time) {
            await updateEventReminders(eventId);
        }

        logger.info('Event updated', { eventId, updates: Object.keys(updates), userId });

        return event;

    } catch (error) {
        logger.error('Error updating event', { eventId, error: error.message, userId });
        throw error;
    }
}

/**
 * Cancel event
 */
async function cancelEvent(eventId, userId, reason = null) {
    try {
        const result = await database.query(
            `UPDATE events
             SET status = 'cancelled', updated_by = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [userId, eventId]
        );

        if (result.rows.length === 0) {
            throw new Error('Event not found');
        }

        // Log cancellation reason
        if (reason) {
            await database.query(
                `INSERT INTO event_changelog (event_id, changed_by, change_type, comment)
                 VALUES ($1, $2, 'cancelled', $3)`,
                [eventId, userId, reason]
            );
        }

        // Notify participants (to be implemented with notification system)
        logger.info('Event cancelled', { eventId, userId, reason });

        return result.rows[0];

    } catch (error) {
        logger.error('Error cancelling event', { eventId, error: error.message, userId });
        throw error;
    }
}

/**
 * Delete event (soft delete)
 */
async function deleteEvent(eventId, userId) {
    try {
        await database.query(
            'UPDATE events SET is_active = false, updated_by = $1 WHERE id = $2',
            [userId, eventId]
        );

        logger.info('Event deleted', { eventId, userId });

    } catch (error) {
        logger.error('Error deleting event', { eventId, error: error.message, userId });
        throw error;
    }
}

// ==============================================
// PARTICIPANT MANAGEMENT
// ==============================================

/**
 * Add participant to event
 */
async function addEventParticipant(eventId, participantData, addedBy) {
    const {
        user_id,
        guest_email,
        guest_name,
        status = 'invited',
        is_required = false,
        is_organizer = false,
        comment
    } = participantData;

    try {
        // Validate: either user_id or guest info
        if (!user_id && (!guest_email || !guest_name)) {
            throw new Error('Either user_id or guest email/name required');
        }

        // Check if event exists and get details
        const event = await findEventById(eventId);
        if (!event) {
            throw new Error('Event not found');
        }

        // Check if participant limit reached (if applicable)
        if (event.max_participants) {
            const countResult = await database.query(
                `SELECT COUNT(*) as count FROM event_participants
                 WHERE event_id = $1 AND status IN ('accepted', 'tentative')`,
                [eventId]
            );

            if (parseInt(countResult.rows[0].count) >= event.max_participants) {
                throw new Error(`Event participant limit (${event.max_participants}) reached`);
            }
        }

        const result = await database.query(
            `INSERT INTO event_participants (
                event_id, user_id, guest_email, guest_name,
                status, is_required, is_organizer, comment, added_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (event_id, user_id) DO UPDATE SET
                status = EXCLUDED.status,
                is_required = EXCLUDED.is_required,
                comment = EXCLUDED.comment
            RETURNING *`,
            [
                eventId, user_id, guest_email, guest_name,
                status, is_required, is_organizer, comment, addedBy
            ]
        );

        const participant = result.rows[0];

        logger.info('Participant added to event', {
            eventId,
            participantId: participant.id,
            userId: user_id,
            status,
            addedBy
        });

        return participant;

    } catch (error) {
        logger.error('Error adding participant', { eventId, error: error.message, addedBy });
        throw error;
    }
}

/**
 * Update participant status (accept, decline, etc.)
 */
async function updateParticipantStatus(eventId, userId, status, comment = null) {
    try {
        const validStatuses = ['invited', 'accepted', 'declined', 'tentative', 'maybe'];
        if (!validStatuses.includes(status)) {
            throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
        }

        const result = await database.query(
            `UPDATE event_participants
             SET status = $1, responded_at = CURRENT_TIMESTAMP, comment = $2
             WHERE event_id = $3 AND user_id = $4
             RETURNING *`,
            [status, comment, eventId, userId]
        );

        if (result.rows.length === 0) {
            throw new Error('Participant not found');
        }

        logger.info('Participant status updated', { eventId, userId, status });

        return result.rows[0];

    } catch (error) {
        logger.error('Error updating participant status', {
            eventId,
            userId,
            status,
            error: error.message
        });
        throw error;
    }
}

/**
 * Remove participant from event
 */
async function removeEventParticipant(eventId, userId) {
    try {
        await database.query(
            'DELETE FROM event_participants WHERE event_id = $1 AND user_id = $2',
            [eventId, userId]
        );

        logger.info('Participant removed from event', { eventId, userId });

    } catch (error) {
        logger.error('Error removing participant', { eventId, userId, error: error.message });
        throw error;
    }
}

/**
 * Get event participants
 */
async function getEventParticipants(eventId, statusFilter = null) {
    try {
        let query = `
            SELECT ep.*,
                   u.name as user_name,
                   u.email as user_email,
                   u.avatar_url
            FROM event_participants ep
            LEFT JOIN users u ON u.id = ep.user_id
            WHERE ep.event_id = $1
        `;

        const params = [eventId];

        if (statusFilter) {
            query += ` AND ep.status = $2`;
            params.push(statusFilter);
        }

        query += ` ORDER BY ep.is_organizer DESC, ep.is_required DESC, ep.added_at ASC`;

        const result = await database.query(query, params);

        return result.rows;

    } catch (error) {
        logger.error('Error getting event participants', { eventId, error: error.message });
        throw error;
    }
}

/**
 * Get user's events
 */
async function getUserEvents(userId, filters = {}) {
    const {
        start_date,
        end_date,
        status_filter, // accepted, declined, invited
        include_organized = true,
        limit = 100,
        offset = 0
    } = filters;

    try {
        let query = `
            SELECT DISTINCT e.*,
                   u.name as organizer_name,
                   l.name as location_name,
                   ep.status as participation_status,
                   ep.is_organizer,
                   ep.is_required
            FROM events e
            LEFT JOIN users u ON u.id = e.organizer_id
            LEFT JOIN locations l ON l.id = e.location_id
            LEFT JOIN event_participants ep ON ep.event_id = e.id
            WHERE e.is_active = true
              AND (ep.user_id = $1 ${include_organized ? 'OR e.organizer_id = $1' : ''})
        `;

        const params = [userId];
        let paramIndex = 2;

        if (start_date) {
            query += ` AND e.end_time >= $${paramIndex++}`;
            params.push(start_date);
        }

        if (end_date) {
            query += ` AND e.start_time <= $${paramIndex++}`;
            params.push(end_date);
        }

        if (status_filter) {
            query += ` AND ep.status = $${paramIndex++}`;
            params.push(status_filter);
        }

        query += ` ORDER BY e.start_time ASC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(limit, offset);

        const result = await database.query(query, params);

        return result.rows;

    } catch (error) {
        logger.error('Error getting user events', { userId, error: error.message });
        throw error;
    }
}

// ==============================================
// REMINDERS
// ==============================================

/**
 * Create reminder for user
 */
async function createEventReminder(eventId, userId, minutesBefore) {
    try {
        // Get event start time
        const event = await findEventById(eventId);
        if (!event) {
            throw new Error('Event not found');
        }

        const remindAt = new Date(event.start_time);
        remindAt.setMinutes(remindAt.getMinutes() - minutesBefore);

        const result = await database.query(
            `INSERT INTO event_reminders (event_id, user_id, remind_at, minutes_before)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (event_id, user_id, minutes_before) DO UPDATE SET
                remind_at = EXCLUDED.remind_at
             RETURNING *`,
            [eventId, userId, remindAt, minutesBefore]
        );

        logger.debug('Event reminder created', { eventId, userId, minutesBefore });

        return result.rows[0];

    } catch (error) {
        logger.error('Error creating reminder', { eventId, userId, error: error.message });
        throw error;
    }
}

/**
 * Get pending reminders (for notification job)
 */
async function getPendingReminders(limit = 100) {
    try {
        const result = await database.query(
            `SELECT er.*,
                    e.title as event_title,
                    e.start_time as event_start,
                    u.email as user_email,
                    u.name as user_name
             FROM event_reminders er
             JOIN events e ON e.id = er.event_id
             JOIN users u ON u.id = er.user_id
             WHERE er.sent = false
               AND er.remind_at <= CURRENT_TIMESTAMP
               AND e.is_active = true
               AND e.status = 'confirmed'
             ORDER BY er.remind_at ASC
             LIMIT $1`,
            [limit]
        );

        return result.rows;

    } catch (error) {
        logger.error('Error getting pending reminders', { error: error.message });
        throw error;
    }
}

/**
 * Mark reminder as sent
 */
async function markReminderSent(reminderId) {
    try {
        await database.query(
            'UPDATE event_reminders SET sent = true, sent_at = CURRENT_TIMESTAMP WHERE id = $1',
            [reminderId]
        );

        logger.debug('Reminder marked as sent', { reminderId });

    } catch (error) {
        logger.error('Error marking reminder sent', { reminderId, error: error.message });
        throw error;
    }
}

/**
 * Update all reminders for an event (when event time changes)
 */
async function updateEventReminders(eventId) {
    try {
        const event = await findEventById(eventId);
        if (!event) {
            throw new Error('Event not found');
        }

        await database.query(
            `UPDATE event_reminders
             SET remind_at = $1 - (minutes_before || ' minutes')::interval,
                 sent = false,
                 sent_at = NULL
             WHERE event_id = $2`,
            [event.start_time, eventId]
        );

        logger.info('Event reminders updated', { eventId });

    } catch (error) {
        logger.error('Error updating event reminders', { eventId, error: error.message });
        throw error;
    }
}

// ==============================================
// CATEGORIES
// ==============================================

/**
 * Get all event categories
 */
async function getEventCategories() {
    try {
        const result = await database.query(
            `SELECT * FROM event_categories
             WHERE is_active = true
             ORDER BY display_order ASC, name ASC`
        );

        return result.rows;

    } catch (error) {
        logger.error('Error getting event categories', { error: error.message });
        throw error;
    }
}

// ==============================================
// STATISTICS & QUERIES
// ==============================================

/**
 * Get event statistics
 */
async function getEventStatistics(filters = {}) {
    const { start_date, end_date, organizer_id, location_id } = filters;

    try {
        let whereClause = 'WHERE e.is_active = true';
        const params = [];
        let paramIndex = 1;

        if (start_date) {
            whereClause += ` AND e.start_time >= $${paramIndex++}`;
            params.push(start_date);
        }

        if (end_date) {
            whereClause += ` AND e.end_time <= $${paramIndex++}`;
            params.push(end_date);
        }

        if (organizer_id) {
            whereClause += ` AND e.organizer_id = $${paramIndex++}`;
            params.push(organizer_id);
        }

        if (location_id) {
            whereClause += ` AND e.location_id = $${paramIndex++}`;
            params.push(location_id);
        }

        const result = await database.query(
            `SELECT
                COUNT(*) as total_events,
                COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_events,
                COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_events,
                COUNT(*) FILTER (WHERE is_recurring = true) as recurring_events,
                COUNT(DISTINCT organizer_id) as unique_organizers,
                COUNT(DISTINCT location_id) as unique_locations,
                COUNT(DISTINCT category) as categories_used,
                (SELECT COUNT(*) FROM event_participants ep JOIN events e2 ON e2.id = ep.event_id ${whereClause.replace('e.', 'e2.')}) as total_participants,
                (SELECT COUNT(*) FROM event_participants ep JOIN events e2 ON e2.id = ep.event_id WHERE ep.status = 'accepted' AND ${whereClause.replace('e.', 'e2.').replace('WHERE ', '')}) as accepted_participants
             FROM events e
             ${whereClause}`,
            params
        );

        return result.rows[0];

    } catch (error) {
        logger.error('Error getting event statistics', { error: error.message });
        throw error;
    }
}

/**
 * Get upcoming events
 */
async function getUpcomingEvents(userId = null, limit = 10) {
    try {
        let query = `
            SELECT e.*,
                   u.name as organizer_name,
                   l.name as location_name
            FROM events e
            LEFT JOIN users u ON u.id = e.organizer_id
            LEFT JOIN locations l ON l.id = e.location_id
            WHERE e.is_active = true
              AND e.status = 'confirmed'
              AND e.start_time >= CURRENT_TIMESTAMP
        `;

        const params = [];

        if (userId) {
            query += `
                AND (
                    e.visibility = 'public'
                    OR e.organizer_id = $1
                    OR EXISTS (
                        SELECT 1 FROM event_participants ep
                        WHERE ep.event_id = e.id AND ep.user_id = $1
                    )
                )
            `;
            params.push(userId);
        } else {
            query += ` AND e.visibility = 'public'`;
        }

        query += ` ORDER BY e.start_time ASC LIMIT $${params.length + 1}`;
        params.push(limit);

        const result = await database.query(query, params);

        return result.rows;

    } catch (error) {
        logger.error('Error getting upcoming events', { error: error.message });
        throw error;
    }
}

/**
 * Check for event conflicts
 */
async function checkEventConflicts(userId, startTime, endTime, excludeEventId = null) {
    try {
        let query = `
            SELECT e.*, ep.status as participation_status
            FROM events e
            JOIN event_participants ep ON ep.event_id = e.id
            WHERE ep.user_id = $1
              AND e.is_active = true
              AND e.status = 'confirmed'
              AND ep.status IN ('accepted', 'tentative')
              AND (
                  (e.start_time, e.end_time) OVERLAPS ($2, $3)
              )
        `;

        const params = [userId, startTime, endTime];

        if (excludeEventId) {
            query += ` AND e.id != $4`;
            params.push(excludeEventId);
        }

        const result = await database.query(query, params);

        return result.rows;

    } catch (error) {
        logger.error('Error checking event conflicts', { userId, error: error.message });
        throw error;
    }
}

// ==============================================
// EXPORTS
// ==============================================

module.exports = {
    // Event CRUD
    createEvent,
    findEventById,
    listEvents,
    updateEvent,
    cancelEvent,
    deleteEvent,

    // Participants
    addEventParticipant,
    updateParticipantStatus,
    removeEventParticipant,
    getEventParticipants,
    getUserEvents,

    // Reminders
    createEventReminder,
    getPendingReminders,
    markReminderSent,
    updateEventReminders,

    // Categories
    getEventCategories,

    // Statistics & Queries
    getEventStatistics,
    getUpcomingEvents,
    checkEventConflicts,

    // Export database for advanced queries
    database
};
