#!/usr/bin/env node
/**
 * Seed-Script: Erstellt einen initialen Admin-User
 *
 * Verwendung:
 *   node db/seeds/001_seed_admin_user.js
 *
 * Oder mit Custom-Daten:
 *   ADMIN_USERNAME=myadmin ADMIN_PASSWORD=mypassword node db/seeds/001_seed_admin_user.js
 */

require('dotenv').config();
const bcrypt = require('bcrypt');
const database = require('../../core/database');
const { createModuleLogger } = require('../../core/logger');

const logger = createModuleLogger('Seed');

// Admin-User Konfiguration
const ADMIN_CONFIG = {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
    email: process.env.ADMIN_EMAIL || 'admin@openintrahub.local',
    name: process.env.ADMIN_NAME || 'System Administrator',
    role: 'admin'
};

async function seedAdminUser() {
    try {
        // Datenbankverbindung herstellen
        logger.info('Verbinde zur Datenbank...');
        await database.connect();

        // Prüfen ob Admin bereits existiert
        const existing = await database.query(
            'SELECT id FROM users WHERE username = $1 OR email = $2',
            [ADMIN_CONFIG.username, ADMIN_CONFIG.email]
        );

        if (existing.rows.length > 0) {
            logger.warn('Admin-User existiert bereits', {
                username: ADMIN_CONFIG.username,
                email: ADMIN_CONFIG.email
            });
            console.log('\n⚠️  Admin-User existiert bereits.');
            console.log('Wenn du den Admin zurücksetzen möchtest, lösche ihn erst manuell aus der DB.\n');
            process.exit(0);
        }

        // Passwort hashen
        logger.info('Generiere Passwort-Hash...');
        const passwordHash = await bcrypt.hash(ADMIN_CONFIG.password, 10);

        // Admin-User erstellen
        logger.info('Erstelle Admin-User...');
        const result = await database.query(
            `INSERT INTO users (username, email, password_hash, name, role, auth_method, is_active, is_verified)
             VALUES ($1, $2, $3, $4, $5, $6, true, true)
             RETURNING id, username, email, name, role`,
            [
                ADMIN_CONFIG.username,
                ADMIN_CONFIG.email,
                passwordHash,
                ADMIN_CONFIG.name,
                ADMIN_CONFIG.role,
                'database'
            ]
        );

        const admin = result.rows[0];

        // Audit-Log erstellen
        await database.query(
            `INSERT INTO audit_log (user_id, username, action, resource_type, resource_id, description, status)
             VALUES ($1, $2, 'user_create', 'user', $3, 'Initial admin user created via seed script', 'success')`,
            [admin.id, admin.username, admin.id.toString()]
        );

        logger.info('Admin-User erfolgreich erstellt', {
            id: admin.id,
            username: admin.username,
            email: admin.email
        });

        console.log('\n✅ Admin-User erfolgreich erstellt!\n');
        console.log('┌─────────────────────────────────────────┐');
        console.log('│  Admin-Zugangsdaten                     │');
        console.log('├─────────────────────────────────────────┤');
        console.log(`│  Username: ${ADMIN_CONFIG.username.padEnd(29)} │`);
        console.log(`│  Password: ${ADMIN_CONFIG.password.padEnd(29)} │`);
        console.log(`│  Email:    ${ADMIN_CONFIG.email.padEnd(29)} │`);
        console.log('└─────────────────────────────────────────┘');
        console.log('\n⚠️  WICHTIG: Ändere das Passwort nach dem ersten Login!\n');

    } catch (error) {
        logger.error('Fehler beim Seeding', { error: error.message, stack: error.stack });
        console.error('\n❌ Fehler beim Erstellen des Admin-Users:');
        console.error(error.message);
        console.error('\nStelle sicher, dass:');
        console.error('1. Die Datenbank läuft');
        console.error('2. Die Migrations ausgeführt wurden');
        console.error('3. Die .env-Datei korrekt konfiguriert ist\n');
        process.exit(1);
    } finally {
        await database.close();
    }
}

// Script ausführen
if (require.main === module) {
    seedAdminUser();
}

module.exports = seedAdminUser;
