/**
 * Integration Tests for Auth API
 * Tests: POST /api/auth/login
 */

process.env.JWT_SECRET = 'test-secret-key-for-testing-only-12345678901234567890';
process.env.NODE_ENV = 'test';

// Mock dependencies
jest.mock('../../core/logger', () => ({
  createModuleLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }))
}));

jest.mock('../../core/eventBus', () => ({
  on: jest.fn(),
  emit: jest.fn()
}));

jest.mock('../../core/ldapService', () => ({
  enabled: false,
  authenticate: jest.fn()
}));

const bcrypt = require('bcrypt');
const databaseMock = require('../mocks/database.mock');

jest.mock('../../core/database', () => require('../mocks/database.mock'));

const { createMockRequest, createMockResponse } = require('../mocks/express.mock');
const auth = require('../../core/auth');

describe('Auth API Integration', () => {
  beforeEach(() => {
    databaseMock.resetMocks();
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid database credentials', async () => {
      const passwordHash = await bcrypt.hash('testpassword', 10);

      databaseMock.mockQueryResult([{
        id: 1,
        username: 'testuser',
        name: 'Test User',
        email: 'test@example.com',
        password_hash: passwordHash,
        role: 'user'
      }]);

      const req = createMockRequest({
        body: { username: 'testuser', password: 'testpassword' }
      });
      const res = createMockResponse();

      await auth.login(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json).toHaveProperty('token');
      expect(res._json).toHaveProperty('user');
      expect(res._json.user.username).toBe('testuser');
      expect(res._json.user.role).toBe('user');
    });

    it('should reject invalid password', async () => {
      const passwordHash = await bcrypt.hash('correctpassword', 10);

      databaseMock.mockQueryResult([{
        id: 1,
        username: 'testuser',
        name: 'Test User',
        email: 'test@example.com',
        password_hash: passwordHash,
        role: 'user'
      }]);

      const req = createMockRequest({
        body: { username: 'testuser', password: 'wrongpassword' }
      });
      const res = createMockResponse();

      await auth.login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res._json).toHaveProperty('error');
    });

    it('should reject non-existent user', async () => {
      databaseMock.mockQueryResult([]);

      const req = createMockRequest({
        body: { username: 'nonexistent', password: 'password' }
      });
      const res = createMockResponse();

      await auth.login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 400 for missing username', async () => {
      const req = createMockRequest({
        body: { password: 'password' }
      });
      const res = createMockResponse();

      await auth.login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res._json.error).toContain('erforderlich');
    });

    it('should return 400 for missing password', async () => {
      const req = createMockRequest({
        body: { username: 'testuser' }
      });
      const res = createMockResponse();

      await auth.login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for non-string input', async () => {
      const req = createMockRequest({
        body: { username: 123, password: 'password' }
      });
      const res = createMockResponse();

      await auth.login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for too long input', async () => {
      const req = createMockRequest({
        body: {
          username: 'a'.repeat(101),
          password: 'password'
        }
      });
      const res = createMockResponse();

      await auth.login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res._json.error).toContain('lang');
    });

    it('should handle database error gracefully', async () => {
      databaseMock.mockQueryError(new Error('Database connection failed'));

      const req = createMockRequest({
        body: { username: 'testuser', password: 'password' }
      });
      const res = createMockResponse();

      await auth.login(req, res);

      // Should fall through to 401 (no user found)
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should include user info in response', async () => {
      const passwordHash = await bcrypt.hash('password', 10);

      databaseMock.mockQueryResult([{
        id: 42,
        username: 'admin',
        name: 'Admin User',
        email: 'admin@example.com',
        password_hash: passwordHash,
        role: 'admin'
      }]);

      const req = createMockRequest({
        body: { username: 'admin', password: 'password' }
      });
      const res = createMockResponse();

      await auth.login(req, res);

      expect(res._json.user).toMatchObject({
        id: 42,
        username: 'admin',
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'admin'
      });
    });

    it('should emit USER_LOGIN event on successful login', async () => {
      const eventBus = require('../../core/eventBus');
      const passwordHash = await bcrypt.hash('password', 10);

      databaseMock.mockQueryResult([{
        id: 1,
        username: 'testuser',
        name: 'Test User',
        email: 'test@example.com',
        password_hash: passwordHash,
        role: 'user'
      }]);

      const req = createMockRequest({
        body: { username: 'testuser', password: 'password' }
      });
      const res = createMockResponse();

      await auth.login(req, res);

      expect(eventBus.emit).toHaveBeenCalledWith(
        'USER_LOGIN',
        expect.objectContaining({ username: 'testuser' })
      );
    });
  });
});
