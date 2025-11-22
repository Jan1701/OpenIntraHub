/**
 * Redis Service - Caching & Pub/Sub für 5000+ User
 * Used for Socket.io adapter, session caching, and general caching
 */

const Redis = require('ioredis');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('Redis');

class RedisService {
    constructor() {
        this.client = null;
        this.subscriber = null;
        this.publisher = null;
        this.isConnected = false;
    }

    /**
     * Initialize Redis connections
     */
    async connect() {
        const redisConfig = {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT) || 6379,
            password: process.env.REDIS_PASSWORD || undefined,
            db: parseInt(process.env.REDIS_DB) || 0,
            retryDelayOnFailover: 100,
            maxRetriesPerRequest: 3,
            lazyConnect: false,
            enableReadyCheck: true,
            // Connection pool
            family: 4, // IPv4
            connectTimeout: 10000,
            commandTimeout: 5000,
        };

        try {
            // Main client for caching
            this.client = new Redis(redisConfig);

            // Separate clients for pub/sub (required for Socket.io adapter)
            this.publisher = new Redis(redisConfig);
            this.subscriber = new Redis(redisConfig);

            // Event handlers
            this.client.on('connect', () => {
                logger.info('Redis client connected');
                this.isConnected = true;
            });

            this.client.on('error', (err) => {
                logger.error('Redis client error', { error: err.message });
                this.isConnected = false;
            });

            this.client.on('close', () => {
                logger.warn('Redis connection closed');
                this.isConnected = false;
            });

            // Wait for connection
            await this.client.ping();
            logger.info('Redis connected successfully', {
                host: redisConfig.host,
                port: redisConfig.port
            });

            this.isConnected = true;
            return true;
        } catch (error) {
            logger.warn('Redis connection failed - running without cache', { error: error.message });
            this.isConnected = false;
            return false;
        }
    }

    /**
     * Get pub/sub clients for Socket.io adapter
     */
    getPubSubClients() {
        return {
            pubClient: this.publisher,
            subClient: this.subscriber
        };
    }

    // ========================================
    // CACHING METHODS
    // ========================================

    /**
     * Get cached value
     */
    async get(key) {
        if (!this.isConnected) return null;
        try {
            const value = await this.client.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            logger.error('Cache get error', { key, error: error.message });
            return null;
        }
    }

    /**
     * Set cached value with TTL
     */
    async set(key, value, ttlSeconds = 300) {
        if (!this.isConnected) return false;
        try {
            await this.client.setex(key, ttlSeconds, JSON.stringify(value));
            return true;
        } catch (error) {
            logger.error('Cache set error', { key, error: error.message });
            return false;
        }
    }

    /**
     * Delete cached value
     */
    async del(key) {
        if (!this.isConnected) return false;
        try {
            await this.client.del(key);
            return true;
        } catch (error) {
            logger.error('Cache delete error', { key, error: error.message });
            return false;
        }
    }

    /**
     * Delete by pattern
     */
    async delPattern(pattern) {
        if (!this.isConnected) return false;
        try {
            const keys = await this.client.keys(pattern);
            if (keys.length > 0) {
                await this.client.del(...keys);
            }
            return true;
        } catch (error) {
            logger.error('Cache delete pattern error', { pattern, error: error.message });
            return false;
        }
    }

    // ========================================
    // SESSION & USER CACHING
    // ========================================

    /**
     * Cache user profile
     */
    async cacheUser(userId, userData) {
        return this.set(`user:${userId}`, userData, 600); // 10 min
    }

    /**
     * Get cached user profile
     */
    async getCachedUser(userId) {
        return this.get(`user:${userId}`);
    }

    /**
     * Invalidate user cache
     */
    async invalidateUser(userId) {
        return this.del(`user:${userId}`);
    }

    /**
     * Cache user's conversations list
     */
    async cacheConversations(userId, conversations) {
        return this.set(`conversations:${userId}`, conversations, 120); // 2 min
    }

    /**
     * Get cached conversations
     */
    async getCachedConversations(userId) {
        return this.get(`conversations:${userId}`);
    }

    // ========================================
    // RATE LIMITING
    // ========================================

    /**
     * Rate limit check with sliding window
     */
    async checkRateLimit(key, maxRequests, windowSeconds) {
        if (!this.isConnected) return { allowed: true, remaining: maxRequests };

        try {
            const now = Date.now();
            const windowStart = now - (windowSeconds * 1000);
            const redisKey = `ratelimit:${key}`;

            // Remove old entries
            await this.client.zremrangebyscore(redisKey, 0, windowStart);

            // Count current requests
            const count = await this.client.zcard(redisKey);

            if (count >= maxRequests) {
                return { allowed: false, remaining: 0 };
            }

            // Add new request
            await this.client.zadd(redisKey, now, `${now}-${Math.random()}`);
            await this.client.expire(redisKey, windowSeconds);

            return { allowed: true, remaining: maxRequests - count - 1 };
        } catch (error) {
            logger.error('Rate limit check error', { key, error: error.message });
            return { allowed: true, remaining: maxRequests }; // Fail open
        }
    }

    // ========================================
    // ONLINE STATUS TRACKING
    // ========================================

    /**
     * Set user online
     */
    async setUserOnline(userId, socketId) {
        if (!this.isConnected) return;
        try {
            await this.client.hset('online_users', userId.toString(), JSON.stringify({
                socketId,
                timestamp: Date.now()
            }));
        } catch (error) {
            logger.error('Set user online error', { userId, error: error.message });
        }
    }

    /**
     * Set user offline
     */
    async setUserOffline(userId) {
        if (!this.isConnected) return;
        try {
            await this.client.hdel('online_users', userId.toString());
        } catch (error) {
            logger.error('Set user offline error', { userId, error: error.message });
        }
    }

    /**
     * Get all online users
     */
    async getOnlineUsers() {
        if (!this.isConnected) return [];
        try {
            const users = await this.client.hgetall('online_users');
            return Object.keys(users).map(id => parseInt(id));
        } catch (error) {
            logger.error('Get online users error', { error: error.message });
            return [];
        }
    }

    /**
     * Check if user is online
     */
    async isUserOnline(userId) {
        if (!this.isConnected) return false;
        try {
            const exists = await this.client.hexists('online_users', userId.toString());
            return !!exists;
        } catch (error) {
            return false;
        }
    }

    /**
     * Close all connections
     */
    async close() {
        try {
            if (this.client) await this.client.quit();
            if (this.publisher) await this.publisher.quit();
            if (this.subscriber) await this.subscriber.quit();
            logger.info('Redis connections closed');
        } catch (error) {
            logger.error('Redis close error', { error: error.message });
        }
    }
}

// Singleton instance
const redis = new RedisService();

module.exports = redis;
