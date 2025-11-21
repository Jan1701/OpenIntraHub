module.exports = {
    init: (ctx) => {
        const { router, events, services, middleware, permissions, i18n } = ctx;
        const logger = services.logger;

        // 1. Öffentliche Route mit i18n
        router.get('/api/example/hello', (req, res) => {
            logger.info('Hello-Endpoint aufgerufen');
            res.json({
                message: req.t('common:app.welcome', { name: 'Example Module' }),
                timestamp: new Date().toISOString(),
                language: req.language || 'de'
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

        // 6. i18n Demonstration
        router.get('/api/example/i18n-demo', (req, res) => {
            logger.info('i18n-Demo Endpoint aufgerufen', { language: req.language });

            // Verschiedene Übersetzungen demonstrieren
            const demo = {
                currentLanguage: req.language || 'de',
                availableLanguages: i18n.languages,
                translations: {
                    welcome: req.t('common:app.welcome', { name: 'OpenIntraHub' }),
                    success: req.t('common:general.success'),
                    loading: req.t('common:general.loading'),
                    login: req.t('auth:login.title'),
                    logout: req.t('auth:logout.title'),
                    profile: req.t('auth:profile.title'),
                    roles: {
                        admin: req.t('auth:roles.admin'),
                        user: req.t('auth:roles.user'),
                        guest: req.t('auth:roles.guest')
                    }
                },
                moduleTranslations: {
                    greeting: i18n.t('example.greeting'),
                    description: i18n.t('example.description')
                },
                usage: {
                    requestTranslation: 'Use req.t("namespace:key") for request-based translation',
                    moduleTranslation: 'Use i18n.t("key") for module-specific translation',
                    changeLanguage: 'Use ?lang=en or ?lang=de query parameter, or set Accept-Language header'
                }
            };

            res.json({
                success: true,
                data: demo
            });
        });

        // 7. Lokalisierte Fehlerantwort
        router.get('/api/example/error-demo', (req, res) => {
            // Demonstriert res.localizedJson() für konsistente lokalisierte Antworten
            res.localizedJson(400, 'errors:validation.required', {
                field: req.t('validation:fields.username')
            });
        });

        logger.info('Example Modul erfolgreich initialisiert');
    }
};
