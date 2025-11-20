/**
 * RBAC (Role-Based Access Control) System
 * Definiert Rollen, Permissions und Zugriffskontrolle
 */

const { createModuleLogger } = require('./logger');
const logger = createModuleLogger('Permissions');

// Permission-Definitionen
const PERMISSIONS = {
    // User Management
    'users.read': 'Benutzer anzeigen',
    'users.create': 'Benutzer erstellen',
    'users.update': 'Benutzer bearbeiten',
    'users.delete': 'Benutzer löschen',

    // Content Management
    'content.read': 'Inhalte anzeigen',
    'content.create': 'Inhalte erstellen',
    'content.update': 'Inhalte bearbeiten',
    'content.delete': 'Inhalte löschen',
    'content.publish': 'Inhalte veröffentlichen',

    // Moderation
    'moderation.read': 'Moderations-Queue anzeigen',
    'moderation.action': 'Moderations-Aktionen durchführen',

    // Administration
    'admin.settings': 'System-Einstellungen verwalten',
    'admin.modules': 'Module verwalten',
    'admin.logs': 'System-Logs anzeigen',

    // Files
    'files.read': 'Dateien anzeigen',
    'files.upload': 'Dateien hochladen',
    'files.delete': 'Dateien löschen',

    // Wiki
    'wiki.read': 'Wiki lesen',
    'wiki.edit': 'Wiki bearbeiten',
    'wiki.admin': 'Wiki administrieren'
};

// Rollen-Definitionen mit ihren Permissions
const ROLES = {
    admin: {
        name: 'Administrator',
        description: 'Voller Zugriff auf alle Funktionen',
        permissions: Object.keys(PERMISSIONS), // Alle Permissions
        inherits: []
    },

    moderator: {
        name: 'Moderator',
        description: 'Kann Inhalte moderieren und verwalten',
        permissions: [
            'users.read',
            'content.read',
            'content.update',
            'content.delete',
            'content.publish',
            'moderation.read',
            'moderation.action',
            'files.read',
            'files.delete',
            'wiki.read',
            'wiki.edit'
        ],
        inherits: []
    },

    editor: {
        name: 'Redakteur',
        description: 'Kann Inhalte erstellen und bearbeiten',
        permissions: [
            'content.read',
            'content.create',
            'content.update',
            'content.publish',
            'files.read',
            'files.upload',
            'wiki.read',
            'wiki.edit'
        ],
        inherits: []
    },

    user: {
        name: 'Benutzer',
        description: 'Standard-Benutzer mit Basis-Rechten',
        permissions: [
            'content.read',
            'content.create',
            'files.read',
            'files.upload',
            'wiki.read'
        ],
        inherits: []
    },

    guest: {
        name: 'Gast',
        description: 'Nur Lese-Zugriff',
        permissions: [
            'content.read',
            'wiki.read'
        ],
        inherits: []
    }
};

/**
 * Gibt alle Permissions für eine Rolle zurück (inkl. geerbte)
 */
const getRolePermissions = (roleName) => {
    const role = ROLES[roleName];
    if (!role) {
        return [];
    }

    let permissions = [...role.permissions];

    // Geerbte Permissions hinzufügen
    if (role.inherits && role.inherits.length > 0) {
        for (const inheritedRole of role.inherits) {
            const inheritedPerms = getRolePermissions(inheritedRole);
            permissions = [...new Set([...permissions, ...inheritedPerms])];
        }
    }

    return permissions;
};

/**
 * Prüft ob eine Rolle eine bestimmte Permission hat
 */
const hasPermission = (roleName, permission) => {
    const permissions = getRolePermissions(roleName);
    return permissions.includes(permission);
};

/**
 * Prüft ob eine Rolle eine der angegebenen Permissions hat
 */
const hasAnyPermission = (roleName, permissionList) => {
    const permissions = getRolePermissions(roleName);
    return permissionList.some(p => permissions.includes(p));
};

/**
 * Prüft ob eine Rolle alle angegebenen Permissions hat
 */
const hasAllPermissions = (roleName, permissionList) => {
    const permissions = getRolePermissions(roleName);
    return permissionList.every(p => permissions.includes(p));
};

/**
 * Middleware: Permission erforderlich
 * Prüft ob der User eine bestimmte Permission hat
 */
const requirePermission = (...requiredPermissions) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentifizierung erforderlich' });
        }

        const userRole = req.user.role;
        const hasRequiredPermission = requiredPermissions.some(perm =>
            hasPermission(userRole, perm)
        );

        if (!hasRequiredPermission) {
            logger.warn('Zugriff verweigert - Permission', {
                username: req.user.username,
                userRole,
                required: requiredPermissions
            });
            return res.status(403).json({
                error: 'Keine Berechtigung',
                required: requiredPermissions,
                userRole: userRole
            });
        }

        next();
    };
};

/**
 * Middleware: Mehrere Permissions erforderlich (UND)
 */
const requireAllPermissions = (...requiredPermissions) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentifizierung erforderlich' });
        }

        const userRole = req.user.role;
        const hasAll = hasAllPermissions(userRole, requiredPermissions);

        if (!hasAll) {
            logger.warn('Zugriff verweigert - Mehrere Permissions', {
                username: req.user.username,
                userRole,
                required: requiredPermissions
            });
            return res.status(403).json({
                error: 'Unzureichende Berechtigungen',
                required: requiredPermissions,
                userRole: userRole
            });
        }

        next();
    };
};

/**
 * Prüft ob User Owner einer Ressource ist
 * Wird oft kombiniert mit Permission-Checks
 */
const isOwner = (resourceUserId) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentifizierung erforderlich' });
        }

        // Admins haben immer Zugriff
        if (req.user.role === 'admin') {
            return next();
        }

        // Prüfen ob User der Owner ist
        if (req.user.userId === resourceUserId) {
            return next();
        }

        return res.status(403).json({ error: 'Nur der Besitzer kann diese Aktion durchführen' });
    };
};

module.exports = {
    PERMISSIONS,
    ROLES,
    getRolePermissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    requirePermission,
    requireAllPermissions,
    isOwner
};
