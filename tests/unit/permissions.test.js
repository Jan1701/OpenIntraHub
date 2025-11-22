/**
 * Unit Tests for Permissions Module (RBAC)
 * Tests: getRolePermissions, hasPermission, hasAnyPermission, hasAllPermissions, middleware
 */

// Mock logger before importing permissions
jest.mock('../../core/logger', () => ({
  createModuleLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }))
}));

const {
  PERMISSIONS,
  ROLES,
  getRolePermissions,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  requirePermission,
  requireAllPermissions,
  isOwner
} = require('../../core/permissions');

const { createMockRequest, createMockResponse, createMockNext } = require('../mocks/express.mock');

describe('Permissions Module', () => {
  describe('PERMISSIONS constant', () => {
    it('should have all required permissions defined', () => {
      expect(PERMISSIONS['users.read']).toBeDefined();
      expect(PERMISSIONS['users.create']).toBeDefined();
      expect(PERMISSIONS['content.read']).toBeDefined();
      expect(PERMISSIONS['content.create']).toBeDefined();
      expect(PERMISSIONS['admin.settings']).toBeDefined();
    });

    it('should have descriptions for all permissions', () => {
      Object.values(PERMISSIONS).forEach(description => {
        expect(typeof description).toBe('string');
        expect(description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('ROLES constant', () => {
    it('should have all required roles defined', () => {
      expect(ROLES.admin).toBeDefined();
      expect(ROLES.moderator).toBeDefined();
      expect(ROLES.editor).toBeDefined();
      expect(ROLES.user).toBeDefined();
      expect(ROLES.guest).toBeDefined();
    });

    it('should have admin role with all permissions', () => {
      expect(ROLES.admin.permissions).toEqual(Object.keys(PERMISSIONS));
    });

    it('should have guest role with minimal permissions', () => {
      expect(ROLES.guest.permissions).toContain('content.read');
      expect(ROLES.guest.permissions).not.toContain('content.create');
      expect(ROLES.guest.permissions).not.toContain('admin.settings');
    });
  });

  describe('getRolePermissions', () => {
    it('should return all permissions for admin', () => {
      const permissions = getRolePermissions('admin');
      expect(permissions).toEqual(Object.keys(PERMISSIONS));
    });

    it('should return limited permissions for user', () => {
      const permissions = getRolePermissions('user');
      expect(permissions).toContain('content.read');
      expect(permissions).toContain('content.create');
      expect(permissions).not.toContain('admin.settings');
    });

    it('should return empty array for unknown role', () => {
      const permissions = getRolePermissions('unknown');
      expect(permissions).toEqual([]);
    });

    it('should return correct permissions for moderator', () => {
      const permissions = getRolePermissions('moderator');
      expect(permissions).toContain('moderation.read');
      expect(permissions).toContain('moderation.action');
      expect(permissions).not.toContain('admin.settings');
    });
  });

  describe('hasPermission', () => {
    it('should return true for admin with any permission', () => {
      expect(hasPermission('admin', 'users.create')).toBe(true);
      expect(hasPermission('admin', 'admin.settings')).toBe(true);
    });

    it('should return false for user with admin permission', () => {
      expect(hasPermission('user', 'admin.settings')).toBe(false);
      expect(hasPermission('user', 'users.delete')).toBe(false);
    });

    it('should return true for user with basic permission', () => {
      expect(hasPermission('user', 'content.read')).toBe(true);
      expect(hasPermission('user', 'content.create')).toBe(true);
    });

    it('should return false for unknown role', () => {
      expect(hasPermission('unknown', 'content.read')).toBe(false);
    });

    it('should return false for unknown permission', () => {
      expect(hasPermission('admin', 'unknown.permission')).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true if user has at least one permission', () => {
      expect(hasAnyPermission('user', ['content.read', 'admin.settings'])).toBe(true);
    });

    it('should return false if user has none of the permissions', () => {
      expect(hasAnyPermission('guest', ['users.create', 'admin.settings'])).toBe(false);
    });

    it('should return true for admin with any permission list', () => {
      expect(hasAnyPermission('admin', ['users.create', 'admin.settings'])).toBe(true);
    });

    it('should handle empty permission list', () => {
      expect(hasAnyPermission('admin', [])).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true if user has all permissions', () => {
      expect(hasAllPermissions('admin', ['users.create', 'admin.settings'])).toBe(true);
    });

    it('should return false if user missing one permission', () => {
      expect(hasAllPermissions('user', ['content.read', 'admin.settings'])).toBe(false);
    });

    it('should return true for empty permission list', () => {
      expect(hasAllPermissions('user', [])).toBe(true);
    });

    it('should handle moderator permissions correctly', () => {
      expect(hasAllPermissions('moderator', ['moderation.read', 'moderation.action'])).toBe(true);
      expect(hasAllPermissions('moderator', ['moderation.read', 'admin.settings'])).toBe(false);
    });
  });

  describe('requirePermission middleware', () => {
    it('should call next for user with required permission', () => {
      const req = createMockRequest({ user: { role: 'admin', username: 'admin' } });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requirePermission('users.create');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 401 for unauthenticated request', () => {
      const req = createMockRequest({ user: null });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requirePermission('users.create');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentifizierung erforderlich' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 for user without required permission', () => {
      const req = createMockRequest({ user: { role: 'guest', username: 'guest' } });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requirePermission('users.create');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Keine Berechtigung'
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow if user has any of multiple permissions', () => {
      const req = createMockRequest({ user: { role: 'editor', username: 'editor' } });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requirePermission('content.create', 'admin.settings');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('requireAllPermissions middleware', () => {
    it('should call next if user has all permissions', () => {
      const req = createMockRequest({ user: { role: 'admin', username: 'admin' } });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireAllPermissions('users.create', 'admin.settings');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 403 if user missing one permission', () => {
      const req = createMockRequest({ user: { role: 'editor', username: 'editor' } });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireAllPermissions('content.create', 'admin.settings');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('isOwner middleware', () => {
    it('should allow admin regardless of ownership', () => {
      const req = createMockRequest({ user: { userId: 1, role: 'admin' } });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = isOwner(999); // Different user ID
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow owner', () => {
      const req = createMockRequest({ user: { userId: 42, role: 'user' } });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = isOwner(42);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should deny non-owner', () => {
      const req = createMockRequest({ user: { userId: 42, role: 'user' } });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = isOwner(999);
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 for unauthenticated request', () => {
      const req = createMockRequest({ user: null });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = isOwner(42);
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});
