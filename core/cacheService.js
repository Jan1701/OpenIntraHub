/**
 * Cache Service
 * Memory and Redis caching for performance optimization
 * Author: Jan Guenther <jg@linxpress.de>
 */

const { createModuleLogger } = require('./logger');
const logger = createModuleLogger('CacheService');

// In-Memory Cache (LRU-style with TTL)
class MemoryCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize || 1000;
    this.defaultTTL = options.defaultTTL || 300000; // 5 minutes
    this.cleanupInterval = options.cleanupInterval || 60000; // 1 minute

    // Start cleanup timer
    this.cleanupTimer = setInterval(() => this.cleanup(), this.cleanupInterval);
  }

  /**
   * Get value from cache
   */
  get(key) {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Update access time for LRU
    entry.lastAccess = Date.now();

    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(key, value, ttl = null) {
    // Enforce max size - remove oldest entries
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const expiresAt = Date.now() + (ttl || this.defaultTTL);

    this.cache.set(key, {
      value,
      expiresAt,
      lastAccess: Date.now(),
      createdAt: Date.now()
    });

    return true;
  }

  /**
   * Delete key from cache
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * Delete keys matching pattern
   */
  deletePattern(pattern) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    let count = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * Check if key exists
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  stats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      defaultTTL: this.defaultTTL
    };
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      logger.debug('Cache cleanup', { removed, remaining: this.cache.size });
    }
  }

  /**
   * Evict oldest entries (LRU)
   */
  evictOldest() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      logger.debug('Evicted cache entry', { key: oldestKey });
    }
  }

  /**
   * Stop cleanup timer
   */
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }
}

// Redis Cache Wrapper
class RedisCache {
  constructor(redisClient) {
    this.client = redisClient;
    this.prefix = 'oih:';
    this.defaultTTL = 300; // 5 minutes in seconds
  }

  async get(key) {
    try {
      const value = await this.client.get(this.prefix + key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis get error', { key, error: error.message });
      return null;
    }
  }

  async set(key, value, ttl = null) {
    try {
      const ttlSeconds = Math.floor((ttl || this.defaultTTL * 1000) / 1000);
      await this.client.set(
        this.prefix + key,
        JSON.stringify(value),
        'EX',
        ttlSeconds
      );
      return true;
    } catch (error) {
      logger.error('Redis set error', { key, error: error.message });
      return false;
    }
  }

  async delete(key) {
    try {
      await this.client.del(this.prefix + key);
      return true;
    } catch (error) {
      logger.error('Redis delete error', { key, error: error.message });
      return false;
    }
  }

  async deletePattern(pattern) {
    try {
      const keys = await this.client.keys(this.prefix + pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
      return keys.length;
    } catch (error) {
      logger.error('Redis deletePattern error', { pattern, error: error.message });
      return 0;
    }
  }

  async has(key) {
    try {
      return await this.client.exists(this.prefix + key) === 1;
    } catch (error) {
      return false;
    }
  }

  async clear() {
    try {
      const keys = await this.client.keys(this.prefix + '*');
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
      return true;
    } catch (error) {
      logger.error('Redis clear error', { error: error.message });
      return false;
    }
  }

  async stats() {
    try {
      const info = await this.client.info('memory');
      return {
        memory: info,
        prefix: this.prefix,
        defaultTTL: this.defaultTTL
      };
    } catch (error) {
      return { error: error.message };
    }
  }
}

// ==============================================
// CACHE INSTANCE MANAGEMENT
// ==============================================

let cacheInstance = null;

/**
 * Initialize cache (Memory or Redis)
 */
function initCache(options = {}) {
  if (process.env.REDIS_URL || process.env.REDIS_HOST) {
    try {
      const Redis = require('ioredis');
      const redisClient = new Redis(process.env.REDIS_URL || {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined
      });

      cacheInstance = new RedisCache(redisClient);
      logger.info('Redis cache initialized');
    } catch (error) {
      logger.warn('Redis not available, using memory cache', { error: error.message });
      cacheInstance = new MemoryCache(options);
    }
  } else {
    cacheInstance = new MemoryCache(options);
    logger.info('Memory cache initialized');
  }

  return cacheInstance;
}

/**
 * Get cache instance
 */
function getCache() {
  if (!cacheInstance) {
    cacheInstance = new MemoryCache();
  }
  return cacheInstance;
}

// ==============================================
// CACHE MIDDLEWARE
// ==============================================

/**
 * Cache middleware for GET requests
 */
function cacheMiddleware(options = {}) {
  const {
    ttl = 60000,
    keyGenerator = (req) => `route:${req.originalUrl}`,
    condition = () => true
  } = options;

  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Check condition
    if (!condition(req)) {
      return next();
    }

    const cache = getCache();
    const key = keyGenerator(req);

    // Try to get from cache
    const cached = await cache.get(key);
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.json(cached);
    }

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json to cache response
    res.json = (data) => {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(key, data, ttl);
      }
      res.set('X-Cache', 'MISS');
      return originalJson(data);
    };

    next();
  };
}

/**
 * Invalidate cache for pattern
 */
async function invalidateCache(pattern) {
  const cache = getCache();
  return await cache.deletePattern(pattern);
}

// ==============================================
// CACHE DECORATORS / HELPERS
// ==============================================

/**
 * Memoize async function with cache
 */
function memoize(fn, options = {}) {
  const {
    keyGenerator = (...args) => JSON.stringify(args),
    ttl = 60000
  } = options;

  return async function (...args) {
    const cache = getCache();
    const key = `memo:${fn.name}:${keyGenerator(...args)}`;

    const cached = await cache.get(key);
    if (cached !== null) {
      return cached;
    }

    const result = await fn.apply(this, args);
    await cache.set(key, result, ttl);

    return result;
  };
}

// ==============================================
// EXPORTS
// ==============================================

module.exports = {
  // Cache classes
  MemoryCache,
  RedisCache,

  // Cache management
  initCache,
  getCache,

  // Middleware
  cacheMiddleware,
  invalidateCache,

  // Helpers
  memoize
};
