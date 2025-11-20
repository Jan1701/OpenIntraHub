const { Pool } = require('pg');

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
            console.log('[Database] Verbindung erfolgreich');
            client.release();

            return true;
        } catch (error) {
            console.error('[Database] Verbindungsfehler:', error.message);
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

            if (process.env.LOG_LEVEL === 'debug') {
                console.log('[Database] Query ausgeführt:', { text, duration, rows: result.rowCount });
            }

            return result;
        } catch (error) {
            console.error('[Database] Query-Fehler:', error.message);
            throw error;
        }
    }

    async close() {
        if (this.pool) {
            await this.pool.end();
            console.log('[Database] Verbindung geschlossen');
        }
    }
}

// Singleton-Instanz
const database = new Database();

module.exports = database;
