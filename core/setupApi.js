// =====================================================
// Setup API - Web Installer Routes
// =====================================================

const express = require('express');
const router = express.Router();
const setupService = require('./setupService');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('SetupAPI');

/**
 * Middleware: Check if setup is needed
 */
async function requireSetup(req, res, next) {
    const completed = await setupService.isSetupCompleted();
    if (completed) {
        return res.status(403).json({
            success: false,
            message: 'Setup already completed. Delete .setup-lock file to run setup again.'
        });
    }
    next();
}

/**
 * GET /api/setup/status
 * Check setup status
 */
router.get('/setup/status', async (req, res) => {
    try {
        const completed = await setupService.isSetupCompleted();
        res.json({
            success: true,
            setupCompleted: completed,
            needsSetup: !completed
        });
    } catch (error) {
        logger.error('Error checking setup status', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Error checking setup status'
        });
    }
});

/**
 * GET /api/setup/requirements
 * Check system requirements
 */
router.get('/setup/requirements', requireSetup, async (req, res) => {
    try {
        const checks = await setupService.checkSystemRequirements();
        res.json({
            success: true,
            checks
        });
    } catch (error) {
        logger.error('Error checking requirements', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Error checking system requirements'
        });
    }
});

/**
 * POST /api/setup/test-database
 * Test database connection
 */
router.post('/setup/test-database', requireSetup, async (req, res) => {
    try {
        const { host, port, database, user, password } = req.body;

        if (!host || !database || !user || !password) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: host, database, user, password'
            });
        }

        const result = await setupService.testDatabaseConnection({
            host,
            port,
            database,
            user,
            password
        });

        res.json(result);
    } catch (error) {
        logger.error('Database test error', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * POST /api/setup/test-redis
 * Test Redis connection
 */
router.post('/setup/test-redis', requireSetup, async (req, res) => {
    try {
        const { host, port, password } = req.body;

        if (!host) {
            return res.status(400).json({
                success: false,
                message: 'Host is required'
            });
        }

        const result = await setupService.testRedisConnection({
            host,
            port,
            password
        });

        res.json(result);
    } catch (error) {
        logger.error('Redis test error', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * POST /api/setup/test-ldap
 * Test LDAP connection
 */
router.post('/setup/test-ldap', requireSetup, async (req, res) => {
    try {
        const { url, bindDn, bindPassword, searchBase } = req.body;

        const result = await setupService.testLdapConnection({
            url,
            bindDn,
            bindPassword,
            searchBase
        });

        res.json(result);
    } catch (error) {
        logger.error('LDAP test error', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * POST /api/setup/test-exchange
 * Test Exchange connection
 */
router.post('/setup/test-exchange', requireSetup, async (req, res) => {
    try {
        const { server_url, username, password, auth_type } = req.body;

        if (!server_url || !username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Exchange server URL, username, and password are required'
            });
        }

        const result = await setupService.testExchangeConnection({
            server_url,
            username,
            password,
            auth_type: auth_type || 'basic'
        });

        res.json(result);
    } catch (error) {
        logger.error('Exchange test error', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * POST /api/setup/install
 * Run complete installation
 */
router.post('/setup/install', requireSetup, async (req, res) => {
    try {
        const config = req.body;

        // Validate required fields
        if (!config.database?.host || !config.database?.database || !config.database?.user) {
            return res.status(400).json({
                success: false,
                message: 'Database configuration is required'
            });
        }

        if (!config.admin?.username || !config.admin?.password || !config.admin?.email) {
            return res.status(400).json({
                success: false,
                message: 'Admin user configuration is required'
            });
        }

        logger.info('Starting installation...');

        // Step 1: Write .env file
        logger.info('Step 1/4: Writing .env file...');
        await setupService.writeEnvFile(config);

        // Step 2: Test database connection
        logger.info('Step 2/4: Testing database connection...');
        const dbTest = await setupService.testDatabaseConnection(config.database);
        if (!dbTest.success) {
            throw new Error(`Database connection failed: ${dbTest.message}`);
        }

        // Step 3: Run migrations
        logger.info('Step 3/4: Running database migrations...');
        const migrations = await setupService.runDatabaseMigrations(config.database);

        // Step 4: Create admin user
        logger.info('Step 4/4: Creating admin user...');
        const adminResult = await setupService.createAdminUser(config.database, {
            username: config.admin.username,
            email: config.admin.email,
            name: config.admin.name || config.admin.username,
            password: config.admin.password
        });

        if (!adminResult.success) {
            throw new Error(`Admin user creation failed: ${adminResult.message}`);
        }

        // Step 5: Create setup lock
        logger.info('Step 5/5: Finalizing setup...');
        await setupService.createSetupLock();

        logger.info('Installation completed successfully!');

        res.json({
            success: true,
            message: 'Installation completed successfully!',
            details: {
                envCreated: true,
                migrationsExecuted: migrations.executed,
                adminCreated: adminResult.user.username
            }
        });

    } catch (error) {
        logger.error('Installation failed', { error: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            message: `Installation failed: ${error.message}`
        });
    }
});

/**
 * POST /api/setup/generate-secret
 * Generate secure JWT secret
 */
router.post('/setup/generate-secret', requireSetup, async (req, res) => {
    try {
        const secret = setupService.generateSecureSecret(64);
        res.json({
            success: true,
            secret
        });
    } catch (error) {
        logger.error('Secret generation error', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;
