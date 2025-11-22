/**
 * Middleware Collection - Optimized for 5000+ Users
 * Authentication, Rate Limiting, Input Validation, Security
 */

const { verifyToken } = require('./auth');
const { createModuleLogger } = require('./logger');
const xss = require('xss');
const validator = require('validator');

const logger = createModuleLogger('Middleware');

// ========================================
// AUTHENTICATION MIDDLEWARE
// ========================================

/**
 * Middleware: JWT-Token validieren
 * Fügt User-Daten zu req.user hinzu
 */
const authenticateToken = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Kein Token bereitgestellt' });
        }

        const decoded = verifyToken(token);

        req.user = {
            id: decoded.id || decoded.userId,
            userId: decoded.id || decoded.userId,
            username: decoded.username,
            role: decoded.role,
            permissions: decoded.permissions || []
        };

        logger.debug('Authentifiziert', { username: req.user.username, role: req.user.role });
        next();
    } catch (error) {
        logger.warn('Token-Validierung fehlgeschlagen', { error: error.message });
        return res.status(403).json({ error: 'Ungültiger oder abgelaufener Token' });
    }
};

/**
 * Middleware: Optionale Authentifizierung
 */
const optionalAuth = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
            const decoded = verifyToken(token);
            req.user = {
                id: decoded.id || decoded.userId,
                userId: decoded.id || decoded.userId,
                username: decoded.username,
                role: decoded.role,
                permissions: decoded.permissions || []
            };
        } else {
            req.user = null;
        }
        next();
    } catch (error) {
        req.user = null;
        next();
    }
};

// ========================================
// ROLE-BASED ACCESS CONTROL
// ========================================

/**
 * Middleware-Factory: Rolle erforderlich
 */
const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentifizierung erforderlich' });
        }

        if (!allowedRoles.includes(req.user.role)) {
            logger.warn('Zugriff verweigert - Rolle', {
                username: req.user.username,
                userRole: req.user.role,
                required: allowedRoles
            });
            return res.status(403).json({
                error: 'Keine Berechtigung',
                required: allowedRoles,
                current: req.user.role
            });
        }
        next();
    };
};

const requireAdmin = requireRole('admin');
const requireModerator = requireRole('admin', 'moderator');

/**
 * Middleware: Permission-basierte Autorisierung
 */
const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentifizierung erforderlich' });
        }

        // Admin hat alle Rechte
        if (req.user.role === 'admin') {
            return next();
        }

        // Permission prüfen
        if (!req.user.permissions || !req.user.permissions.includes(permission)) {
            logger.warn('Zugriff verweigert - Permission', {
                username: req.user.username,
                required: permission
            });
            return res.status(403).json({ error: 'Keine Berechtigung' });
        }
        next();
    };
};

// ========================================
// REQUEST LOGGING
// ========================================

const requestLogger = (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'http';

        logger[logLevel]('HTTP Request', {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            user: req.user ? req.user.username : 'anonymous',
            ip: req.ip || req.connection?.remoteAddress
        });
    });

    next();
};

// ========================================
// RATE LIMITING - Memory-Safe with Cleanup
// ========================================

/**
 * Rate Limiter with automatic cleanup (no memory leak)
 */
class RateLimiter {
    constructor() {
        this.requests = new Map();
        this.cleanupInterval = null;
        this.startCleanup();
    }

    startCleanup() {
        // Cleanup every 60 seconds
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            const maxAge = 120000; // 2 minutes

            for (const [key, data] of this.requests.entries()) {
                // Remove entries older than maxAge
                const filtered = data.filter(time => now - time < maxAge);
                if (filtered.length === 0) {
                    this.requests.delete(key);
                } else {
                    this.requests.set(key, filtered);
                }
            }

            logger.debug('Rate limiter cleanup', { entries: this.requests.size });
        }, 60000);
    }

    check(identifier, maxRequests, windowMs) {
        const now = Date.now();
        const windowStart = now - windowMs;

        if (!this.requests.has(identifier)) {
            this.requests.set(identifier, [now]);
            return { allowed: true, remaining: maxRequests - 1 };
        }

        const userRequests = this.requests.get(identifier).filter(time => time > windowStart);
        userRequests.push(now);
        this.requests.set(identifier, userRequests);

        if (userRequests.length > maxRequests) {
            return { allowed: false, remaining: 0, retryAfter: Math.ceil(windowMs / 1000) };
        }

        return { allowed: true, remaining: maxRequests - userRequests.length };
    }

    stop() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}

const globalRateLimiter = new RateLimiter();

/**
 * Rate Limiting Middleware
 */
const rateLimit = (maxRequests = 100, windowMs = 60000) => {
    return (req, res, next) => {
        const identifier = req.ip || req.connection?.remoteAddress || 'unknown';
        const result = globalRateLimiter.check(identifier, maxRequests, windowMs);

        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', result.remaining);

        if (!result.allowed) {
            res.setHeader('Retry-After', result.retryAfter);
            return res.status(429).json({
                error: 'Zu viele Anfragen',
                retryAfter: result.retryAfter
            });
        }

        next();
    };
};

/**
 * Strict rate limit for sensitive endpoints (login, etc.)
 */
const strictRateLimit = rateLimit(10, 60000); // 10 requests per minute

// ========================================
// INPUT VALIDATION & SANITIZATION
// ========================================

/**
 * XSS Protection - sanitize string inputs
 */
const sanitizeInput = (input) => {
    if (typeof input === 'string') {
        return xss(input.trim());
    }
    if (typeof input === 'object' && input !== null) {
        const sanitized = {};
        for (const [key, value] of Object.entries(input)) {
            sanitized[key] = sanitizeInput(value);
        }
        return sanitized;
    }
    return input;
};

/**
 * Middleware: Sanitize request body
 */
const sanitizeBody = (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeInput(req.body);
    }
    next();
};

/**
 * Validation helpers
 */
const validate = {
    email: (email) => validator.isEmail(email || ''),
    uuid: (uuid) => validator.isUUID(uuid || ''),
    int: (val) => validator.isInt(String(val)),
    length: (str, min, max) => validator.isLength(str || '', { min, max }),
    alphanumeric: (str) => validator.isAlphanumeric(str || '', 'de-DE'),
    url: (url) => validator.isURL(url || ''),
    notEmpty: (str) => typeof str === 'string' && str.trim().length > 0
};

/**
 * Validation middleware factory
 */
const validateBody = (schema) => {
    return (req, res, next) => {
        const errors = [];

        for (const [field, rules] of Object.entries(schema)) {
            const value = req.body[field];

            if (rules.required && (value === undefined || value === null || value === '')) {
                errors.push({ field, message: `${field} ist erforderlich` });
                continue;
            }

            if (value !== undefined && value !== null) {
                if (rules.type === 'email' && !validate.email(value)) {
                    errors.push({ field, message: `${field} muss eine gültige E-Mail sein` });
                }
                if (rules.type === 'uuid' && !validate.uuid(value)) {
                    errors.push({ field, message: `${field} muss eine gültige UUID sein` });
                }
                if (rules.minLength && !validate.length(value, rules.minLength)) {
                    errors.push({ field, message: `${field} muss mindestens ${rules.minLength} Zeichen haben` });
                }
                if (rules.maxLength && !validate.length(value, 0, rules.maxLength)) {
                    errors.push({ field, message: `${field} darf maximal ${rules.maxLength} Zeichen haben` });
                }
            }
        }

        if (errors.length > 0) {
            return res.status(400).json({ error: 'Validierungsfehler', details: errors });
        }

        next();
    };
};

/**
 * SQL Injection protection - validate sort fields
 */
const allowedSortFields = new Set([
    'id', 'name', 'title', 'created_at', 'updated_at', 'username', 'email',
    'first_name', 'last_name', 'status', 'priority', 'position', 'size'
]);

const validateSortField = (field) => {
    return allowedSortFields.has(field?.toLowerCase());
};

const validateSortOrder = (order) => {
    return ['asc', 'desc'].includes(order?.toLowerCase());
};

// ========================================
// EXPORTS
// ========================================

module.exports = {
    // Authentication
    authenticateToken,
    optionalAuth,

    // Authorization
    requireRole,
    requireAdmin,
    requireModerator,
    requirePermission,

    // Logging
    requestLogger,

    // Rate Limiting
    rateLimit,
    strictRateLimit,
    globalRateLimiter,

    // Validation & Sanitization
    sanitizeBody,
    sanitizeInput,
    validateBody,
    validate,
    validateSortField,
    validateSortOrder
};
