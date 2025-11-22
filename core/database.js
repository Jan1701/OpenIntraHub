/**
 * Database Connection Pool - Optimized for 5000+ Users
 * Enhanced with connection pooling, health checks, and query optimization
 */

const { Pool } = require('pg');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('Database');

class Database {
    constructor() {
        this.pool = null;
        this.isConnected = false;
        this.healthCheckInterval = null;
    }

    async connect() {
        try {
            // Optimierte Pool-Konfiguration für 5000+ User
            const poolConfig = {
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT) || 5432,
                database: process.env.DB_NAME || 'openintrahub',
                user: process.env.DB_USER || 'postgres',
                password: process.env.DB_PASSWORD || '',

                // Connection Pool Settings für 5000 User
                max: parseInt(process.env.DB_POOL_MAX) || 100,           // Max 100 connections
                min: parseInt(process.env.DB_POOL_MIN) || 10,            // Min 10 idle connections
                idleTimeoutMillis: 60000,                                 // 60s idle timeout
                connectionTimeoutMillis: 10000,                           // 10s connection timeout

                // Statement timeout für lange Queries (30s)
                statement_timeout: 30000,

                // Query timeout
                query_timeout: 30000,

                // Application name für Monitoring
                application_name: 'OpenIntraHub',
            };

            this.pool = new Pool(poolConfig);

            // Pool Event Handlers
            this.pool.on('connect', (client) => {
                logger.debug('New client connected to pool');
            });

            this.pool.on('acquire', (client) => {
                logger.debug('Client acquired from pool');
            });

            this.pool.on('remove', (client) => {
                logger.debug('Client removed from pool');
            });

            this.pool.on('error', (err, client) => {
                logger.error('Unexpected pool error', { error: err.message });
            });

            // Test Verbindung
            const client = await this.pool.connect();
            const result = await client.query('SELECT NOW() as time, current_database() as db');
            client.release();

            this.isConnected = true;

            logger.info('Database connection pool initialized', {
                host: poolConfig.host,
                database: poolConfig.database,
                maxConnections: poolConfig.max,
                minConnections: poolConfig.min,
                serverTime: result.rows[0].time
            });

            // Start health check interval
            this.startHealthCheck();

            // Connection warming - pre-create connections
            await this.warmConnections(poolConfig.min);

            return true;
        } catch (error) {
            logger.error('Database connection failed', { error: error.message, stack: error.stack });
            this.isConnected = false;
            return false;
        }
    }

    /**
     * Pre-warm connection pool
     */
    async warmConnections(count) {
        try {
            const clients = [];
            for (let i = 0; i < count; i++) {
                const client = await this.pool.connect();
                clients.push(client);
            }
            // Release all clients back to pool
            clients.forEach(client => client.release());
            logger.info(`Connection pool warmed with ${count} connections`);
        } catch (error) {
            logger.warn('Connection warming failed', { error: error.message });
        }
    }

    /**
     * Start periodic health checks
     */
    startHealthCheck() {
        // Health check every 30 seconds
        this.healthCheckInterval = setInterval(async () => {
            try {
                const result = await this.pool.query('SELECT 1');
                const stats = this.getPoolStats();
                logger.debug('Health check passed', stats);
            } catch (error) {
                logger.error('Health check failed', { error: error.message });
                this.isConnected = false;
            }
        }, 30000);
    }

    /**
     * Get pool statistics
     */
    getPoolStats() {
        if (!this.pool) return null;
        return {
            totalCount: this.pool.totalCount,
            idleCount: this.pool.idleCount,
            waitingCount: this.pool.waitingCount
        };
    }

    /**
     * Execute query with automatic retry
     */
    async query(text, params, options = {}) {
        if (!this.pool) {
            throw new Error('Database connection not initialized');
        }

        const maxRetries = options.retries || 3;
        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const start = Date.now();
                const result = await this.pool.query(text, params);
                const duration = Date.now() - start;

                // Log slow queries (> 1000ms)
                if (duration > 1000) {
                    logger.warn('Slow query detected', {
                        query: text.substring(0, 100),
                        duration: `${duration}ms`,
                        rows: result.rowCount
                    });
                } else {
                    logger.debug('Query executed', {
                        duration: `${duration}ms`,
                        rows: result.rowCount
                    });
                }

                return result;
            } catch (error) {
                lastError = error;

                // Retry on connection errors
                if (error.code === 'ECONNRESET' || error.code === '57P01') {
                    logger.warn(`Query retry ${attempt}/${maxRetries}`, { error: error.message });
                    await this.sleep(100 * attempt); // Exponential backoff
                    continue;
                }

                // Don't retry other errors
                break;
            }
        }

        logger.error('Query failed', {
            error: lastError.message,
            query: text.substring(0, 200),
            code: lastError.code
        });
        throw lastError;
    }

    /**
     * Execute transaction
     */
    async transaction(callback) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Batch insert helper
     */
    async batchInsert(table, columns, rows, chunkSize = 1000) {
        if (rows.length === 0) return { rowCount: 0 };

        const results = [];
        for (let i = 0; i < rows.length; i += chunkSize) {
            const chunk = rows.slice(i, i + chunkSize);
            const values = [];
            const placeholders = [];

            chunk.forEach((row, rowIndex) => {
                const rowPlaceholders = columns.map((_, colIndex) => {
                    values.push(row[colIndex]);
                    return `$${rowIndex * columns.length + colIndex + 1}`;
                });
                placeholders.push(`(${rowPlaceholders.join(', ')})`);
            });

            const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders.join(', ')}`;
            const result = await this.query(query, values);
            results.push(result);
        }

        return { rowCount: results.reduce((sum, r) => sum + r.rowCount, 0) };
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async close() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }

        if (this.pool) {
            await this.pool.end();
            this.isConnected = false;
            logger.info('Database connection pool closed');
        }
    }
}

// Singleton instance
const database = new Database();

module.exports = database;
