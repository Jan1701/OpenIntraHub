/**
 * Unit Tests for Middleware Module
 * Tests: authenticateToken, requireRole, requireAdmin
 */

// Set environment
process.env.JWT_SECRET = 'test-secret-key-for-testing-only-12345678901234567890';

// Mock dependencies - must be before imports
jest.mock('../../core/logger', () => ({
  createModuleLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }))
}));

jest.mock('../../core/database', () => ({
  pool: null,
  query: jest.fn()
}));

// Mock ldapService to prevent db import errors
jest.mock('../../core/ldapService', () => ({
  enabled: false,
  authenticate: jest.fn()
}));

const jwt = require('jsonwebtoken');
const { createMockRequest, createMockResponse, createMockNext } = require('../mocks/express.mock');
const middleware = require('../../core/middleware');

describe('Middleware Module', () => {
  describe('authenticateToken', () => {
    it('should authenticate valid Bearer token', () => {
      const token = jwt.sign(
        { userId: 1, username: 'testuser', role: 'user' },
        process.env.JWT_SECRET
      );

      const req = createMockRequest({
        headers: { authorization: `Bearer ${token}` }
      });
      const res = createMockResponse();
      const next = createMockNext();

      middleware.authenticateToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.userId).toBe(1);
      expect(req.user.username).toBe('testuser');
    });

    it('should reject request without token', () => {
      const req = createMockRequest({});
      const res = createMockResponse();
      const next = createMockNext();

      middleware.authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.any(String)
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject invalid token', () => {
      const req = createMockRequest({
        headers: { authorization: 'Bearer invalid-token' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      middleware.authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject expired token', () => {
      const token = jwt.sign(
        { userId: 1, username: 'testuser', role: 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' } // Already expired
      );

      const req = createMockRequest({
        headers: { authorization: `Bearer ${token}` }
      });
      const res = createMockResponse();
      const next = createMockNext();

      middleware.authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle malformed authorization header', () => {
      const req = createMockRequest({
        headers: { authorization: 'NotBearer token' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      middleware.authenticateToken(req, res, next);

      // Malformed header is treated as invalid token (403) not missing token (401)
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('requireRole', () => {
    it('should allow user with required role', () => {
      const req = createMockRequest({
        user: { userId: 1, username: 'admin', role: 'admin' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const roleMiddleware = middleware.requireRole('admin');
      roleMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow user with any of multiple roles', () => {
      const req = createMockRequest({
        user: { userId: 1, username: 'mod', role: 'moderator' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const roleMiddleware = middleware.requireRole('admin', 'moderator');
      roleMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should reject user without required role', () => {
      const req = createMockRequest({
        user: { userId: 1, username: 'user', role: 'user' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      const roleMiddleware = middleware.requireRole('admin');
      roleMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject unauthenticated request', () => {
      const req = createMockRequest({ user: null });
      const res = createMockResponse();
      const next = createMockNext();

      const roleMiddleware = middleware.requireRole('admin');
      roleMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('requireAdmin', () => {
    it('should allow admin user', () => {
      const req = createMockRequest({
        user: { userId: 1, username: 'admin', role: 'admin' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      middleware.requireAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should reject non-admin user', () => {
      const req = createMockRequest({
        user: { userId: 1, username: 'user', role: 'user' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      middleware.requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject moderator', () => {
      const req = createMockRequest({
        user: { userId: 1, username: 'mod', role: 'moderator' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      middleware.requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('optionalAuth', () => {
    it('should set user if valid token provided', () => {
      const token = jwt.sign(
        { userId: 1, username: 'testuser', role: 'user' },
        process.env.JWT_SECRET
      );

      const req = createMockRequest({
        headers: { authorization: `Bearer ${token}` }
      });
      const res = createMockResponse();
      const next = createMockNext();

      middleware.optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
    });

    it('should continue without user if no token', () => {
      const req = createMockRequest({});
      const res = createMockResponse();
      const next = createMockNext();

      middleware.optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeNull();
    });

    it('should continue without user if invalid token', () => {
      const req = createMockRequest({
        headers: { authorization: 'Bearer invalid-token' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      middleware.optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeNull();
    });
  });
});
