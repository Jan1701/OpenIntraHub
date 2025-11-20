const eventBus = require('./eventBus');

module.exports = {
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

            // TODO: Hier echte LDAP Prüfung einbauen
            // const ldap = require('ldapjs');

            if (username === 'admin' && password === 'secret') {
                const user = { name: 'Admin', role: 'admin', username: 'admin' };

                // USER_LOGIN Event triggern
                eventBus.emit('USER_LOGIN', user);

                // Mock Token
                return res.json({
                    token: 'fake-jwt-token',
                    user
                });
            }

            return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
        } catch (error) {
            console.error('[Auth] Login-Fehler:', error);
            return res.status(500).json({ error: 'Interner Serverfehler' });
        }
    }
};
