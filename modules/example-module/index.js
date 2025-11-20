module.exports = {
    init: (ctx) => {
        const { router, events } = ctx;

        // 1. Eine neue Route registrieren
        router.get('/api/example/hello', (req, res) => {
            res.json({ message: 'Hallo aus dem Example Modul!' });
        });

        // 2. Auf Events hören
        events.on('USER_LOGIN', () => {
            console.log('Example Modul hat einen Login bemerkt!');
        });
    }
};
