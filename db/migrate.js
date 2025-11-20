#!/usr/bin/env node
/**
 * Database Migration Tool
 *
 * Führt alle SQL-Migrations-Scripts aus
 *
 * Verwendung:
 *   node db/migrate.js
 *   npm run db:migrate
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const database = require('../core/database');
const { createModuleLogger } = require('../core/logger');

const logger = createModuleLogger('Migration');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function runMigrations() {
    try {
        console.log('\n🔄 Starte Datenbank-Migration...\n');

        // Verbindung herstellen
        logger.info('Verbinde zur Datenbank...');
        const connected = await database.connect();

        if (!connected) {
            throw new Error('Datenbankverbindung fehlgeschlagen');
        }

        // Migrations-Tabelle erstellen (falls nicht vorhanden)
        logger.info('Erstelle migrations-Tabelle...');
        await database.query(`
            CREATE TABLE IF NOT EXISTS migrations (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) NOT NULL UNIQUE,
                executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Bereits ausgeführte Migrations laden
        const executedResult = await database.query(
            'SELECT filename FROM migrations ORDER BY id'
        );
        const executedMigrations = new Set(executedResult.rows.map(r => r.filename));

        // Alle Migrations-Dateien laden
        const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
            .filter(f => f.endsWith('.sql'))
            .sort();

        if (migrationFiles.length === 0) {
            logger.warn('Keine Migrations gefunden');
            console.log('⚠️  Keine Migrations-Dateien gefunden.\n');
            return;
        }

        logger.info(`Gefundene Migrations: ${migrationFiles.length}`);
        let executed = 0;
        let skipped = 0;

        // Migrations ausführen
        for (const filename of migrationFiles) {
            if (executedMigrations.has(filename)) {
                logger.debug(`Migration übersprungen: ${filename}`);
                console.log(`⏭️  Übersprungen: ${filename}`);
                skipped++;
                continue;
            }

            const filePath = path.join(MIGRATIONS_DIR, filename);
            const sql = fs.readFileSync(filePath, 'utf8');

            logger.info(`Führe Migration aus: ${filename}`);
            console.log(`🔄 Ausführen: ${filename}`);

            try {
                // Migration ausführen
                await database.query(sql);

                // Als ausgeführt markieren
                await database.query(
                    'INSERT INTO migrations (filename) VALUES ($1)',
                    [filename]
                );

                logger.info(`Migration erfolgreich: ${filename}`);
                console.log(`✅ Erfolgreich: ${filename}`);
                executed++;

            } catch (error) {
                logger.error(`Migration fehlgeschlagen: ${filename}`, { error: error.message });
                console.error(`\n❌ Fehler in Migration: ${filename}`);
                console.error(error.message);
                console.error('\nMigration abgebrochen.\n');
                throw error;
            }
        }

        console.log('\n┌─────────────────────────────────────────┐');
        console.log('│  Migration abgeschlossen                │');
        console.log('├─────────────────────────────────────────┤');
        console.log(`│  Ausgeführt:    ${executed.toString().padEnd(23)} │`);
        console.log(`│  Übersprungen:  ${skipped.toString().padEnd(23)} │`);
        console.log(`│  Gesamt:        ${migrationFiles.length.toString().padEnd(23)} │`);
        console.log('└─────────────────────────────────────────┘\n');

        logger.info('Datenbank-Migration abgeschlossen', { executed, skipped, total: migrationFiles.length });

    } catch (error) {
        logger.error('Migration fehlgeschlagen', { error: error.message, stack: error.stack });
        console.error('\n❌ Migration fehlgeschlagen.');
        console.error('Stelle sicher, dass PostgreSQL läuft und die .env korrekt ist.\n');
        process.exit(1);
    } finally {
        await database.close();
    }
}

// Script ausführen
if (require.main === module) {
    runMigrations();
}

module.exports = runMigrations;
