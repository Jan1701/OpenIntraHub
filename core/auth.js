const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const eventBus = require('./eventBus');
const ldapAuth = require('./ldap');
const database = require('./database');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('Auth');

// Event-Listener: Last Login aktualisieren
eventBus.on('USER_LOGIN', async (user) => {
    if (user.id && database.pool) {
        try {
            await database.query(
                'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
                [user.id]
            );
            logger.debug('Last login aktualisiert', { userId: user.id });
        } catch (error) {
            logger.error('Fehler beim Aktualisieren von last_login_at', { userId: user.id, error: error.message });
        }
    }
});

// JWT-Hilfsfunktionen
const generateToken = (payload) => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET ist nicht in den Umgebungsvariablen gesetzt');
    }

    const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

    return jwt.sign(payload, secret, { expiresIn });
};

const verifyToken = (token) => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET ist nicht in den Umgebungsvariablen gesetzt');
    }

    try {
        return jwt.verify(token, secret);
    } catch (error) {
        throw new Error('Ungültiger oder abgelaufener Token');
    }
};

// Passwort-Hilfsfunktionen
const hashPassword = async (password) => {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
};

const comparePassword = async (password, hash) => {
    return await bcrypt.compare(password, hash);
};

module.exports = {
    // Hilfsfunktionen exportieren
    generateToken,
    verifyToken,
    hashPassword,
    comparePassword,

    login: async (req, res) => {
        try {
            const { username, password } = req.body;

            // Input-Validierung
            if (!username || !password) {
                return res.status(400).json({ error: 'Username und Password sind erforderlich' });
            }

            if (typeof username !== 'string' || typeof password !== 'string') {
                return res.status(400).json({ error: 'Ungültige Eingabe' });
            }

            if (username.length > 100 || password.length > 100) {
                return res.status(400).json({ error: 'Eingabe zu lang' });
            }

            let user = null;

            // 1. Versuch: LDAP-Authentifizierung
            if (ldapAuth.enabled) {
                try {
                    const ldapUser = await ldapAuth.authenticate(username, password);
                    if (ldapUser) {
                        const role = ldapAuth.getRoleFromGroups(ldapUser.groups);

                        // TODO: User in lokaler DB speichern/aktualisieren für Caching
                        user = {
                            id: null, // Wird aus DB kommen
                            username: ldapUser.username,
                            name: ldapUser.name,
                            email: ldapUser.email,
                            role: role,
                            authMethod: 'ldap'
                        };
                    }
                } catch (error) {
                    logger.error('LDAP-Authentifizierung fehlgeschlagen', { error: error.message });
                    // Weiter zu nächster Auth-Methode
                }
            }

            // 2. Versuch: Datenbank-Authentifizierung (lokale User)
            if (!user && database.pool) {
                try {
                    const result = await database.query(
                        'SELECT id, username, name, email, password_hash, role FROM users WHERE username = $1',
                        [username]
                    );

                    if (result.rows.length > 0) {
                        const dbUser = result.rows[0];
                        const passwordMatch = await comparePassword(password, dbUser.password_hash);

                        if (passwordMatch) {
                            user = {
                                id: dbUser.id,
                                username: dbUser.username,
                                name: dbUser.name,
                                email: dbUser.email,
                                role: dbUser.role,
                                authMethod: 'database'
                            };
                        }
                    }
                } catch (error) {
                    logger.error('Datenbank-Authentifizierung fehlgeschlagen', { error: error.message });
                    // Weiter zu Mock-User in Development
                }
            }

            // 3. Fallback: Mock-User für Entwicklung (nur wenn keine DB/LDAP)
            if (!user && process.env.NODE_ENV !== 'production') {
                if (username === 'admin' && password === 'secret') {
                    user = {
                        id: 1,
                        username: 'admin',
                        name: 'Admin (Mock)',
                        email: 'admin@openintrahub.local',
                        role: 'admin',
                        authMethod: 'mock'
                    };
                    logger.warn('Mock-User verwendet (nur Development!)', { username });
                }
            }

            // Wenn User gefunden und authentifiziert
            if (user) {
                // JWT-Token generieren
                const token = generateToken({
                    userId: user.id,
                    username: user.username,
                    role: user.role
                });

                // USER_LOGIN Event triggern
                eventBus.emit('USER_LOGIN', user);

                logger.info('Erfolgreicher Login', { username, authMethod: user.authMethod, role: user.role });

                return res.json({
                    token,
                    user: {
                        id: user.id,
                        username: user.username,
                        name: user.name,
                        email: user.email,
                        role: user.role
                    }
                });
            }

            // Login fehlgeschlagen
            return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
        } catch (error) {
            logger.error('Login-Fehler', { error: error.message, stack: error.stack });
            return res.status(500).json({ error: 'Interner Serverfehler' });
        }
    }
};
