/**
 * Events API
 * REST-Endpunkte für Kalender und Event-Verwaltung
 * Author: Jan Günther <jg@linxpress.de>
 */

const express = require('express');
const router = express.Router();
const eventsService = require('./eventsService');
const { authenticateToken, requirePermission, optionalAuth } = require('./middleware');
const i18n = require('./i18n');

// ==============================================
// EVENT CRUD OPERATIONS
// ==============================================

/**
 * GET /api/events
 * List events with filters
 */
router.get('/events', authenticateToken, async (req, res) => {
    try {
        const {
            start_date,
            end_date,
            organizer_id,
            location_id,
            category,
            visibility,
            status,
            my_events, // Boolean: only events where user is participant
            include_recurring = 'true',
            limit = 100,
            offset = 0
        } = req.query;

        const filters = {
            start_date,
            end_date,
            organizer_id: organizer_id ? parseInt(organizer_id) : undefined,
            location_id: location_id ? parseInt(location_id) : undefined,
            category,
            visibility,
            status,
            user_id: my_events === 'true' ? req.user.id : undefined,
            include_recurring: include_recurring === 'true',
            limit: parseInt(limit),
            offset: parseInt(offset)
        };

        const events = await eventsService.listEvents(filters);

        res.json({
            success: true,
            data: events,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                count: events.length
            }
        });
    } catch (error) {
        console.error('Error listing events:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * GET /api/events/upcoming
 * Get upcoming events
 */
router.get('/events/upcoming', optionalAuth, async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        const events = await eventsService.getUpcomingEvents(
            req.user?.id,
            parseInt(limit)
        );

        res.json({
            success: true,
            data: events
        });
    } catch (error) {
        console.error('Error getting upcoming events:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * GET /api/events/statistics
 * Get event statistics
 */
router.get('/events/statistics', authenticateToken, requirePermission('events.view'), async (req, res) => {
    try {
        const { start_date, end_date, organizer_id, location_id } = req.query;

        const stats = await eventsService.getEventStatistics({
            start_date,
            end_date,
            organizer_id: organizer_id ? parseInt(organizer_id) : undefined,
            location_id: location_id ? parseInt(location_id) : undefined
        });

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error getting event statistics:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * GET /api/events/:id
 * Get event details
 */
router.get('/events/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const event = await eventsService.findEventById(parseInt(id));

        if (!event) {
            return res.status(404).json({
                success: false,
                message: i18n.t('errors.notFound', { lng: req.language })
            });
        }

        // Check access rights (visibility)
        if (event.visibility === 'private' &&
            event.organizer_id !== req.user.id) {
            // Check if user is participant
            const participants = await eventsService.getEventParticipants(parseInt(id));
            const isParticipant = participants.some(p => p.user_id === req.user.id);

            if (!isParticipant) {
                return res.status(403).json({
                    success: false,
                    message: i18n.t('errors.forbidden', { lng: req.language })
                });
            }
        }

        // Get participants
        const participants = await eventsService.getEventParticipants(parseInt(id));
        event.participants = participants;

        res.json({
            success: true,
            data: event
        });
    } catch (error) {
        console.error('Error getting event:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * POST /api/events
 * Create new event
 */
router.post('/events', authenticateToken, requirePermission('events.create'), async (req, res) => {
    try {
        const event = await eventsService.createEvent(req.body, req.user.id);

        res.status(201).json({
            success: true,
            data: event,
            message: 'Event created successfully'
        });
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(400).json({
            success: false,
            message: error.message || i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * PUT /api/events/:id
 * Update event
 */
router.put('/events/:id', authenticateToken, requirePermission('events.edit'), async (req, res) => {
    try {
        const { id } = req.params;

        // Check if user is organizer (unless has manage_all permission)
        const event = await eventsService.findEventById(parseInt(id));
        if (!event) {
            return res.status(404).json({
                success: false,
                message: i18n.t('errors.notFound', { lng: req.language })
            });
        }

        // Check permissions (organizer or admin)
        const hasManageAll = req.user.permissions?.includes('events.manage_all');
        if (event.organizer_id !== req.user.id && !hasManageAll) {
            return res.status(403).json({
                success: false,
                message: i18n.t('errors.forbidden', { lng: req.language })
            });
        }

        const updatedEvent = await eventsService.updateEvent(
            parseInt(id),
            req.body,
            req.user.id
        );

        res.json({
            success: true,
            data: updatedEvent,
            message: 'Event updated successfully'
        });
    } catch (error) {
        console.error('Error updating event:', error);
        res.status(400).json({
            success: false,
            message: error.message || i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * POST /api/events/:id/cancel
 * Cancel event
 */
router.post('/events/:id/cancel', authenticateToken, requirePermission('events.edit'), async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        // Check if user is organizer
        const event = await eventsService.findEventById(parseInt(id));
        if (!event) {
            return res.status(404).json({
                success: false,
                message: i18n.t('errors.notFound', { lng: req.language })
            });
        }

        const hasManageAll = req.user.permissions?.includes('events.manage_all');
        if (event.organizer_id !== req.user.id && !hasManageAll) {
            return res.status(403).json({
                success: false,
                message: i18n.t('errors.forbidden', { lng: req.language })
            });
        }

        const cancelledEvent = await eventsService.cancelEvent(
            parseInt(id),
            req.user.id,
            reason
        );

        res.json({
            success: true,
            data: cancelledEvent,
            message: 'Event cancelled successfully'
        });
    } catch (error) {
        console.error('Error cancelling event:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * DELETE /api/events/:id
 * Delete event
 */
router.delete('/events/:id', authenticateToken, requirePermission('events.delete'), async (req, res) => {
    try {
        const { id } = req.params;

        // Check if user is organizer
        const event = await eventsService.findEventById(parseInt(id));
        if (!event) {
            return res.status(404).json({
                success: false,
                message: i18n.t('errors.notFound', { lng: req.language })
            });
        }

        const hasManageAll = req.user.permissions?.includes('events.manage_all');
        if (event.organizer_id !== req.user.id && !hasManageAll) {
            return res.status(403).json({
                success: false,
                message: i18n.t('errors.forbidden', { lng: req.language })
            });
        }

        await eventsService.deleteEvent(parseInt(id), req.user.id);

        res.json({
            success: true,
            message: 'Event deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * POST /api/events/:id/check-conflicts
 * Check for event conflicts
 */
router.post('/events/:id/check-conflicts', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id, start_time, end_time } = req.body;

        // User can only check their own conflicts unless admin
        const checkUserId = user_id || req.user.id;
        const hasManageAll = req.user.permissions?.includes('events.manage_all');

        if (checkUserId !== req.user.id && !hasManageAll) {
            return res.status(403).json({
                success: false,
                message: i18n.t('errors.forbidden', { lng: req.language })
            });
        }

        const conflicts = await eventsService.checkEventConflicts(
            checkUserId,
            start_time,
            end_time,
            id === 'new' ? null : parseInt(id)
        );

        res.json({
            success: true,
            data: {
                has_conflicts: conflicts.length > 0,
                conflicts: conflicts
            }
        });
    } catch (error) {
        console.error('Error checking conflicts:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

// ==============================================
// PARTICIPANT MANAGEMENT
// ==============================================

/**
 * GET /api/events/:id/participants
 * Get event participants
 */
router.get('/events/:id/participants', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.query;

        const participants = await eventsService.getEventParticipants(
            parseInt(id),
            status
        );

        res.json({
            success: true,
            data: participants
        });
    } catch (error) {
        console.error('Error getting participants:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * POST /api/events/:id/participants
 * Add participant to event
 */
router.post('/events/:id/participants', authenticateToken, requirePermission('events.edit'), async (req, res) => {
    try {
        const { id } = req.params;

        // Check if user is organizer
        const event = await eventsService.findEventById(parseInt(id));
        if (!event) {
            return res.status(404).json({
                success: false,
                message: i18n.t('errors.notFound', { lng: req.language })
            });
        }

        const hasManageAll = req.user.permissions?.includes('events.manage_all');
        if (event.organizer_id !== req.user.id && !hasManageAll) {
            return res.status(403).json({
                success: false,
                message: i18n.t('errors.forbidden', { lng: req.language })
            });
        }

        const participant = await eventsService.addEventParticipant(
            parseInt(id),
            req.body,
            req.user.id
        );

        res.status(201).json({
            success: true,
            data: participant,
            message: 'Participant added successfully'
        });
    } catch (error) {
        console.error('Error adding participant:', error);
        res.status(400).json({
            success: false,
            message: error.message || i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * PUT /api/events/:id/participants/:userId/status
 * Update participant status (accept, decline, etc.)
 */
router.put('/events/:id/participants/:userId/status', authenticateToken, async (req, res) => {
    try {
        const { id, userId } = req.params;
        const { status, comment } = req.body;

        // User can only update their own status
        if (parseInt(userId) !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: i18n.t('errors.forbidden', { lng: req.language })
            });
        }

        const participant = await eventsService.updateParticipantStatus(
            parseInt(id),
            parseInt(userId),
            status,
            comment
        );

        res.json({
            success: true,
            data: participant,
            message: 'Participation status updated'
        });
    } catch (error) {
        console.error('Error updating participant status:', error);
        res.status(400).json({
            success: false,
            message: error.message || i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

/**
 * DELETE /api/events/:id/participants/:userId
 * Remove participant from event
 */
router.delete('/events/:id/participants/:userId', authenticateToken, async (req, res) => {
    try {
        const { id, userId } = req.params;

        // Check if user is organizer or removing themselves
        const event = await eventsService.findEventById(parseInt(id));
        if (!event) {
            return res.status(404).json({
                success: false,
                message: i18n.t('errors.notFound', { lng: req.language })
            });
        }

        const hasManageAll = req.user.permissions?.includes('events.manage_all');
        const isOrganizer = event.organizer_id === req.user.id;
        const isSelf = parseInt(userId) === req.user.id;

        if (!isOrganizer && !isSelf && !hasManageAll) {
            return res.status(403).json({
                success: false,
                message: i18n.t('errors.forbidden', { lng: req.language })
            });
        }

        await eventsService.removeEventParticipant(parseInt(id), parseInt(userId));

        res.json({
            success: true,
            message: 'Participant removed successfully'
        });
    } catch (error) {
        console.error('Error removing participant:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

// ==============================================
// USER EVENTS
// ==============================================

/**
 * GET /api/user/events
 * Get current user's events
 */
router.get('/user/events', authenticateToken, async (req, res) => {
    try {
        const {
            start_date,
            end_date,
            status_filter,
            include_organized = 'true',
            limit = 100,
            offset = 0
        } = req.query;

        const events = await eventsService.getUserEvents(req.user.id, {
            start_date,
            end_date,
            status_filter,
            include_organized: include_organized === 'true',
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            data: events,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                count: events.length
            }
        });
    } catch (error) {
        console.error('Error getting user events:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

// ==============================================
// REMINDERS
// ==============================================

/**
 * POST /api/events/:id/reminders
 * Create reminder for event
 */
router.post('/events/:id/reminders', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { minutes_before } = req.body;

        if (!minutes_before || minutes_before <= 0) {
            return res.status(400).json({
                success: false,
                message: 'minutes_before must be a positive number'
            });
        }

        const reminder = await eventsService.createEventReminder(
            parseInt(id),
            req.user.id,
            parseInt(minutes_before)
        );

        res.status(201).json({
            success: true,
            data: reminder,
            message: 'Reminder created successfully'
        });
    } catch (error) {
        console.error('Error creating reminder:', error);
        res.status(400).json({
            success: false,
            message: error.message || i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

// ==============================================
// CATEGORIES
// ==============================================

/**
 * GET /api/events/categories
 * Get all event categories
 */
router.get('/events/categories', authenticateToken, async (req, res) => {
    try {
        const categories = await eventsService.getEventCategories();

        res.json({
            success: true,
            data: categories
        });
    } catch (error) {
        console.error('Error getting categories:', error);
        res.status(500).json({
            success: false,
            message: i18n.t('errors.serverError', { lng: req.language })
        });
    }
});

module.exports = router;
