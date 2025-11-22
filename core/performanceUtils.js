/**
 * Performance Utilities
 * Optimization helpers for API responses and database queries
 * Author: Jan Guenther <jg@linxpress.de>
 */

const { createModuleLogger } = require('./logger');
const logger = createModuleLogger('Performance');

// ==============================================
// RESPONSE COMPRESSION HELPER
// ==============================================

/**
 * Compression middleware setup
 * Returns configuration for compression middleware
 */
function compressionConfig() {
  return {
    // Compression threshold in bytes
    threshold: 1024, // 1KB

    // Compression level (1-9, higher = more compression but slower)
    level: 6,

    // Filter function to determine if response should be compressed
    filter: (req, res) => {
      // Don't compress if already compressed
      if (req.headers['x-no-compression']) {
        return false;
      }

      // Use default filter
      return true;
    }
  };
}

// ==============================================
// QUERY OPTIMIZATION HELPERS
// ==============================================

/**
 * Paginate query results with cursor-based pagination
 */
function buildCursorPagination(options = {}) {
  const {
    cursor,
    limit = 20,
    orderBy = 'id',
    direction = 'DESC'
  } = options;

  let whereClause = '';
  const params = [];
  let paramIndex = 1;

  if (cursor) {
    const operator = direction === 'DESC' ? '<' : '>';
    whereClause = `${orderBy} ${operator} $${paramIndex++}`;
    params.push(cursor);
  }

  return {
    whereClause,
    params,
    limitClause: `LIMIT ${limit + 1}`, // +1 to check for next page
    orderClause: `ORDER BY ${orderBy} ${direction}`
  };
}

/**
 * Process cursor pagination result
 */
function processCursorResult(rows, limit) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1]?.id : null;

  return {
    items,
    hasMore,
    nextCursor
  };
}

/**
 * Build efficient SELECT with only needed columns
 */
function selectColumns(columns, alias = '') {
  const prefix = alias ? `${alias}.` : '';
  return columns.map(col => `${prefix}${col}`).join(', ');
}

// ==============================================
// BATCH PROCESSING
// ==============================================

/**
 * Process items in batches
 */
async function processBatch(items, batchSize, processor) {
  const results = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((item, index) => processor(item, i + index))
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Debounce function execution
 */
function debounce(fn, delay) {
  let timeoutId;

  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Throttle function execution
 */
function throttle(fn, limit) {
  let inThrottle;

  return function (...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// ==============================================
// PERFORMANCE MONITORING
// ==============================================

/**
 * Measure execution time of async function
 */
async function measureTime(name, fn) {
  const start = process.hrtime.bigint();

  try {
    const result = await fn();
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1e6; // Convert to ms

    logger.debug('Performance measurement', {
      name,
      duration: `${duration.toFixed(2)}ms`
    });

    return result;
  } catch (error) {
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1e6;

    logger.error('Performance measurement (failed)', {
      name,
      duration: `${duration.toFixed(2)}ms`,
      error: error.message
    });

    throw error;
  }
}

/**
 * Create performance timer
 */
function createTimer(name) {
  const start = process.hrtime.bigint();

  return {
    stop() {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1e6;

      logger.debug('Timer stopped', {
        name,
        duration: `${duration.toFixed(2)}ms`
      });

      return duration;
    },

    lap(lapName) {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1e6;

      logger.debug('Timer lap', {
        name,
        lap: lapName,
        duration: `${duration.toFixed(2)}ms`
      });

      return duration;
    }
  };
}

// ==============================================
// REQUEST RATE LIMITING HELPERS
// ==============================================

/**
 * Simple in-memory rate limiter
 */
class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60000; // 1 minute
    this.maxRequests = options.maxRequests || 100;
    this.requests = new Map();

    // Cleanup old entries periodically
    setInterval(() => this.cleanup(), this.windowMs);
  }

  /**
   * Check if request is allowed
   */
  isAllowed(key) {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get existing requests for this key
    let requests = this.requests.get(key) || [];

    // Filter out old requests
    requests = requests.filter(time => time > windowStart);

    // Check if under limit
    if (requests.length >= this.maxRequests) {
      return {
        allowed: false,
        retryAfter: Math.ceil((requests[0] + this.windowMs - now) / 1000)
      };
    }

    // Add current request
    requests.push(now);
    this.requests.set(key, requests);

    return {
      allowed: true,
      remaining: this.maxRequests - requests.length
    };
  }

  /**
   * Cleanup old entries
   */
  cleanup() {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    for (const [key, requests] of this.requests.entries()) {
      const valid = requests.filter(time => time > windowStart);
      if (valid.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, valid);
      }
    }
  }
}

/**
 * Rate limiting middleware
 */
function rateLimitMiddleware(options = {}) {
  const limiter = new RateLimiter(options);
  const keyGenerator = options.keyGenerator || ((req) => req.ip);

  return (req, res, next) => {
    const key = keyGenerator(req);
    const result = limiter.isAllowed(key);

    if (!result.allowed) {
      res.set('Retry-After', result.retryAfter);
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: result.retryAfter
      });
    }

    res.set('X-RateLimit-Remaining', result.remaining);
    next();
  };
}

// ==============================================
// RESPONSE OPTIMIZATION
// ==============================================

/**
 * Compress response data by removing null/undefined values
 */
function cleanResponse(data) {
  if (Array.isArray(data)) {
    return data.map(cleanResponse);
  }

  if (data && typeof data === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== null && value !== undefined) {
        cleaned[key] = cleanResponse(value);
      }
    }
    return cleaned;
  }

  return data;
}

/**
 * Add pagination metadata to response
 */
function withPagination(items, options = {}) {
  const { page = 1, limit = 20, total } = options;

  return {
    data: items,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: total || items.length,
      totalPages: total ? Math.ceil(total / limit) : 1,
      hasMore: total ? page * limit < total : false
    }
  };
}

// ==============================================
// EXPORTS
// ==============================================

module.exports = {
  // Compression
  compressionConfig,

  // Query optimization
  buildCursorPagination,
  processCursorResult,
  selectColumns,

  // Batch processing
  processBatch,
  debounce,
  throttle,

  // Performance monitoring
  measureTime,
  createTimer,

  // Rate limiting
  RateLimiter,
  rateLimitMiddleware,

  // Response optimization
  cleanResponse,
  withPagination
};
