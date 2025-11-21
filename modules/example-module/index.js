module.exports = {
    init: (ctx) => {
        const { router, events, services, middleware, permissions } = ctx;
        const logger = services.logger;

        // 1. Öffentliche Route
        router.get('/api/example/hello', (req, res) => {
            logger.info('Hello-Endpoint aufgerufen');
            res.json({
                message: 'Hallo aus dem Example Modul!',
                timestamp: new Date().toISOString()
            });
        });

        // 2. Geschützte Route (nur mit gültigem Token)
        router.get('/api/example/protected', middleware.authenticateToken, (req, res) => {
            logger.info('Protected-Endpoint aufgerufen', { user: req.user.username });
            res.json({
                message: 'Du bist authentifiziert!',
                user: req.user
            });
        });

        // 3. Admin-Only Route
        router.get('/api/example/admin', middleware.authenticateToken, middleware.requireAdmin, (req, res) => {
            logger.info('Admin-Endpoint aufgerufen', { user: req.user.username });
            res.json({
                message: 'Willkommen im Admin-Bereich!',
                user: req.user
            });
        });

        // 4. Permission-basierte Route
        router.post('/api/example/create',
            middleware.authenticateToken,
            permissions.requirePermission('content.create'),
            (req, res) => {
                logger.info('Create-Endpoint aufgerufen', { user: req.user.username });
                res.json({
                    message: 'Du hast die Permission content.create!',
                    user: req.user
                });
            }
        );

        // 5. Auf Events hören
        events.on('USER_LOGIN', (user) => {
            logger.info('User-Login bemerkt', { username: user.username, role: user.role });
        });

        logger.info('Example Modul erfolgreich initialisiert');
    }
};
