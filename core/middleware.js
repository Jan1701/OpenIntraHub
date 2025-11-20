const { verifyToken } = require('./auth');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('Middleware');

/**
 * Middleware: JWT-Token validieren
 * Fügt User-Daten zu req.user hinzu
 */
const authenticateToken = (req, res, next) => {
    try {
        // Token aus Authorization-Header extrahieren
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

        if (!token) {
            return res.status(401).json({ error: 'Kein Token bereitgestellt' });
        }

        // Token validieren
        const decoded = verifyToken(token);

        // User-Daten an Request anhängen
        req.user = {
            userId: decoded.userId,
            username: decoded.username,
            role: decoded.role
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
 * Fügt User-Daten hinzu falls Token vorhanden, erlaubt aber auch anonyme Requests
 */
const optionalAuth = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
            const decoded = verifyToken(token);
            req.user = {
                userId: decoded.userId,
                username: decoded.username,
                role: decoded.role
            };
        } else {
            req.user = null;
        }

        next();
    } catch (error) {
        // Bei ungültigem Token: als anonymer User behandeln
        req.user = null;
        next();
    }
};

/**
 * Middleware-Factory: Rolle erforderlich
 * Prüft ob User eine bestimmte Rolle hat
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

/**
 * Middleware: Nur für Admins
 */
const requireAdmin = requireRole('admin');

/**
 * Middleware: Für Admins und Moderatoren
 */
const requireModerator = requireRole('admin', 'moderator');

/**
 * Middleware: Request-Logging
 */
const requestLogger = (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.http('HTTP Request', {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            user: req.user ? req.user.username : 'anonymous',
            ip: req.ip
        });
    });

    next();
};

/**
 * Middleware: Rate Limiting (einfache Implementierung)
 */
const rateLimit = (maxRequests = 100, windowMs = 60000) => {
    const requests = new Map();

    return (req, res, next) => {
        const identifier = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        const windowStart = now - windowMs;

        // Alte Einträge löschen
        if (!requests.has(identifier)) {
            requests.set(identifier, []);
        }

        const userRequests = requests.get(identifier).filter(time => time > windowStart);
        userRequests.push(now);
        requests.set(identifier, userRequests);

        if (userRequests.length > maxRequests) {
            return res.status(429).json({
                error: 'Zu viele Anfragen',
                retryAfter: Math.ceil(windowMs / 1000)
            });
        }

        next();
    };
};

module.exports = {
    authenticateToken,
    optionalAuth,
    requireRole,
    requireAdmin,
    requireModerator,
    requestLogger,
    rateLimit
};
