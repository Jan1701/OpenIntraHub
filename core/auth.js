module.exports = {
    login: async (req, res) => {
        const { username, password } = req.body;
        
        // TODO: Hier echte LDAP Prüfung einbauen
        // const ldap = require('ldapjs');
        
        if (username === 'admin' && password === 'secret') {
            // Mock Token
            return res.json({ token: 'fake-jwt-token', user: { name: 'Admin', role: 'admin' } });
        }
        
        return res.status(401).json({ error: 'Invalid credentials' });
    }
};
