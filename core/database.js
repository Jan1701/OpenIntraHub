const { Pool } = require('pg');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('Database');

class Database {
    constructor() {
        this.pool = null;
    }

    async connect() {
        try {
            this.pool = new Pool({
                host: process.env.DB_HOST || 'localhost',
                port: process.env.DB_PORT || 5432,
                database: process.env.DB_NAME || 'openintrahub',
                user: process.env.DB_USER || 'postgres',
                password: process.env.DB_PASSWORD || '',
                max: 20,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
            });

            // Test Verbindung
            const client = await this.pool.connect();
            logger.info('Datenbankverbindung erfolgreich', {
                host: process.env.DB_HOST || 'localhost',
                database: process.env.DB_NAME || 'openintrahub'
            });
            client.release();

            return true;
        } catch (error) {
            logger.error('Datenbankverbindung fehlgeschlagen', { error: error.message });
            return false;
        }
    }

    async query(text, params) {
        if (!this.pool) {
            throw new Error('Datenbankverbindung nicht initialisiert');
        }

        try {
            const start = Date.now();
            const result = await this.pool.query(text, params);
            const duration = Date.now() - start;

            logger.debug('Query ausgeführt', { text, duration: `${duration}ms`, rows: result.rowCount });

            return result;
        } catch (error) {
            logger.error('Query-Fehler', { error: error.message, query: text });
            throw error;
        }
    }

    async close() {
        if (this.pool) {
            await this.pool.end();
            logger.info('Datenbankverbindung geschlossen');
        }
    }
}

// Singleton-Instanz
const database = new Database();

module.exports = database;
