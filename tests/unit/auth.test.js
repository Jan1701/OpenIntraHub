/**
 * Unit Tests for Auth Module
 * Tests: generateToken, verifyToken, hashPassword, comparePassword
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// Set environment before importing auth
process.env.JWT_SECRET = 'test-secret-key-for-testing-only-12345678901234567890';
process.env.JWT_EXPIRES_IN = '1h';

// Mock dependencies
jest.mock('../../core/eventBus', () => ({
  on: jest.fn(),
  emit: jest.fn()
}));

jest.mock('../../core/ldapService', () => ({
  enabled: false,
  authenticate: jest.fn()
}));

jest.mock('../../core/database', () => ({
  pool: null,
  query: jest.fn()
}));

jest.mock('../../core/logger', () => ({
  createModuleLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }))
}));

const auth = require('../../core/auth');

describe('Auth Module', () => {
  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const payload = { userId: 1, username: 'testuser', role: 'user' };
      const token = auth.generateToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include payload data in token', () => {
      const payload = { userId: 42, username: 'admin', role: 'admin' };
      const token = auth.generateToken(payload);
      const decoded = jwt.decode(token);

      expect(decoded.userId).toBe(42);
      expect(decoded.username).toBe('admin');
      expect(decoded.role).toBe('admin');
    });

    it('should set expiration time', () => {
      const payload = { userId: 1, username: 'testuser', role: 'user' };
      const token = auth.generateToken(payload);
      const decoded = jwt.decode(token);

      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });

    it('should throw error if JWT_SECRET is not set', () => {
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      expect(() => {
        auth.generateToken({ userId: 1 });
      }).toThrow('JWT_SECRET ist nicht in den Umgebungsvariablen gesetzt');

      process.env.JWT_SECRET = originalSecret;
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const payload = { userId: 1, username: 'testuser', role: 'user' };
      const token = auth.generateToken(payload);
      const decoded = auth.verifyToken(token);

      expect(decoded.userId).toBe(1);
      expect(decoded.username).toBe('testuser');
      expect(decoded.role).toBe('user');
    });

    it('should throw error for invalid token', () => {
      expect(() => {
        auth.verifyToken('invalid-token');
      }).toThrow('Ungültiger oder abgelaufener Token');
    });

    it('should throw error for tampered token', () => {
      const payload = { userId: 1, username: 'testuser', role: 'user' };
      const token = auth.generateToken(payload);
      const tamperedToken = token.slice(0, -5) + 'xxxxx';

      expect(() => {
        auth.verifyToken(tamperedToken);
      }).toThrow('Ungültiger oder abgelaufener Token');
    });

    it('should throw error for token signed with different secret', () => {
      const fakeToken = jwt.sign({ userId: 1 }, 'different-secret');

      expect(() => {
        auth.verifyToken(fakeToken);
      }).toThrow('Ungültiger oder abgelaufener Token');
    });
  });

  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'testPassword123';
      const hash = await auth.hashPassword(password);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50); // bcrypt hashes are ~60 chars
    });

    it('should generate different hashes for same password', async () => {
      const password = 'testPassword123';
      const hash1 = await auth.hashPassword(password);
      const hash2 = await auth.hashPassword(password);

      expect(hash1).not.toBe(hash2); // Different salts
    });

    it('should generate valid bcrypt hash format', async () => {
      const password = 'testPassword123';
      const hash = await auth.hashPassword(password);

      // bcrypt hashes start with $2b$ or $2a$
      expect(hash).toMatch(/^\$2[ab]\$/);
    });
  });

  describe('comparePassword', () => {
    it('should return true for matching password', async () => {
      const password = 'testPassword123';
      const hash = await auth.hashPassword(password);
      const result = await auth.comparePassword(password, hash);

      expect(result).toBe(true);
    });

    it('should return false for non-matching password', async () => {
      const password = 'testPassword123';
      const wrongPassword = 'wrongPassword456';
      const hash = await auth.hashPassword(password);
      const result = await auth.comparePassword(wrongPassword, hash);

      expect(result).toBe(false);
    });

    it('should handle empty password', async () => {
      const password = 'testPassword123';
      const hash = await auth.hashPassword(password);
      const result = await auth.comparePassword('', hash);

      expect(result).toBe(false);
    });

    it('should handle special characters in password', async () => {
      const password = 'Test@123!#$%^&*()_+-=[]{}|;:,.<>?';
      const hash = await auth.hashPassword(password);
      const result = await auth.comparePassword(password, hash);

      expect(result).toBe(true);
    });

    it('should handle unicode characters', async () => {
      const password = 'Tëst123日本語🔐';
      const hash = await auth.hashPassword(password);
      const result = await auth.comparePassword(password, hash);

      expect(result).toBe(true);
    });
  });
});
