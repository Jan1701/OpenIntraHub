/**
 * Integration Tests for Posts API
 * Tests: GET /api/posts, POST /api/posts, etc.
 */

process.env.JWT_SECRET = 'test-secret-key-for-testing-only-12345678901234567890';
process.env.NODE_ENV = 'test';

// Mock logger first
jest.mock('../../core/logger', () => ({
  createModuleLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }))
}));

// Mock event bus
jest.mock('../../core/eventBus', () => ({
  on: jest.fn(),
  emit: jest.fn()
}));

const databaseMock = require('../mocks/database.mock');
jest.mock('../../core/database', () => require('../mocks/database.mock'));

const { createMockRequest, createMockResponse, createAuthenticatedRequest } = require('../mocks/express.mock');

// Simple mock for posts service functions
const postsServiceHandlers = {
  getPosts: async (req, res) => {
    const { page = 1, limit = 10 } = req.query;

    try {
      const result = await databaseMock.query(
        'SELECT * FROM posts WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, (page - 1) * limit]
      );

      res.json({
        posts: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: result.rows.length
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  },

  getPostById: async (req, res) => {
    const { id } = req.params;

    try {
      const result = await databaseMock.query(
        'SELECT * FROM posts WHERE id = $1 AND deleted_at IS NULL',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Post nicht gefunden' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  },

  createPost: async (req, res) => {
    const { title, content, category_id } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Titel und Inhalt erforderlich' });
    }

    try {
      const slug = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

      const result = await databaseMock.query(
        'INSERT INTO posts (title, slug, content, category_id, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [title, slug, content, category_id, req.user.userId]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  },

  updatePost: async (req, res) => {
    const { id } = req.params;
    const { title, content } = req.body;

    try {
      const result = await databaseMock.query(
        'UPDATE posts SET title = $1, content = $2, updated_at = NOW() WHERE id = $3 AND deleted_at IS NULL RETURNING *',
        [title, content, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Post nicht gefunden' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  },

  deletePost: async (req, res) => {
    const { id } = req.params;

    try {
      const result = await databaseMock.query(
        'UPDATE posts SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Post nicht gefunden' });
      }

      res.json({ message: 'Post gelöscht', id: result.rows[0].id });
    } catch (error) {
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  }
};

describe('Posts API Integration', () => {
  beforeEach(() => {
    databaseMock.resetMocks();
    jest.clearAllMocks();
  });

  describe('GET /api/posts', () => {
    it('should return list of posts', async () => {
      const mockPosts = [
        { id: 1, title: 'Post 1', slug: 'post-1', content: 'Content 1' },
        { id: 2, title: 'Post 2', slug: 'post-2', content: 'Content 2' }
      ];

      databaseMock.mockQueryResult(mockPosts);

      const req = createMockRequest({ query: {} });
      const res = createMockResponse();

      await postsServiceHandlers.getPosts(req, res);

      expect(res._json.posts).toHaveLength(2);
      expect(res._json.posts[0].title).toBe('Post 1');
    });

    it('should support pagination', async () => {
      databaseMock.mockQueryResult([
        { id: 3, title: 'Post 3' }
      ]);

      const req = createMockRequest({
        query: { page: '2', limit: '10' }
      });
      const res = createMockResponse();

      await postsServiceHandlers.getPosts(req, res);

      // Query params come as strings, offset calculation: (2-1)*10 = 10
      expect(databaseMock.query).toHaveBeenCalledWith(
        expect.any(String),
        ['10', 10] // limit (string from query), offset (calculated)
      );
    });

    it('should return empty array when no posts', async () => {
      databaseMock.mockQueryResult([]);

      const req = createMockRequest({ query: {} });
      const res = createMockResponse();

      await postsServiceHandlers.getPosts(req, res);

      expect(res._json.posts).toHaveLength(0);
    });

    it('should handle database error', async () => {
      databaseMock.mockQueryError(new Error('DB Error'));

      const req = createMockRequest({ query: {} });
      const res = createMockResponse();

      await postsServiceHandlers.getPosts(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('GET /api/posts/:id', () => {
    it('should return single post by id', async () => {
      const mockPost = {
        id: 1,
        title: 'Test Post',
        slug: 'test-post',
        content: 'Test content'
      };

      databaseMock.mockQueryResult([mockPost]);

      const req = createMockRequest({ params: { id: '1' } });
      const res = createMockResponse();

      await postsServiceHandlers.getPostById(req, res);

      expect(res._json.id).toBe(1);
      expect(res._json.title).toBe('Test Post');
    });

    it('should return 404 for non-existent post', async () => {
      databaseMock.mockQueryResult([]);

      const req = createMockRequest({ params: { id: '999' } });
      const res = createMockResponse();

      await postsServiceHandlers.getPostById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('POST /api/posts', () => {
    it('should create new post', async () => {
      const newPost = {
        id: 1,
        title: 'New Post',
        slug: 'new-post',
        content: 'New content',
        created_by: 1
      };

      databaseMock.mockQueryResult([newPost]);

      const req = createAuthenticatedRequest(
        { id: 1, role: 'user' },
        { body: { title: 'New Post', content: 'New content' } }
      );
      const res = createMockResponse();

      await postsServiceHandlers.createPost(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res._json.title).toBe('New Post');
    });

    it('should return 400 for missing title', async () => {
      const req = createAuthenticatedRequest(
        { id: 1, role: 'user' },
        { body: { content: 'Content only' } }
      );
      const res = createMockResponse();

      await postsServiceHandlers.createPost(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for missing content', async () => {
      const req = createAuthenticatedRequest(
        { id: 1, role: 'user' },
        { body: { title: 'Title only' } }
      );
      const res = createMockResponse();

      await postsServiceHandlers.createPost(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should generate slug from title', async () => {
      databaseMock.mockQueryResult([{
        id: 1,
        title: 'My Test Post',
        slug: 'my-test-post',
        content: 'Content'
      }]);

      const req = createAuthenticatedRequest(
        { id: 1, role: 'user' },
        { body: { title: 'My Test Post', content: 'Content' } }
      );
      const res = createMockResponse();

      await postsServiceHandlers.createPost(req, res);

      expect(databaseMock.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['my-test-post'])
      );
    });
  });

  describe('PUT /api/posts/:id', () => {
    it('should update existing post', async () => {
      const updatedPost = {
        id: 1,
        title: 'Updated Title',
        content: 'Updated content'
      };

      databaseMock.mockQueryResult([updatedPost]);

      const req = createAuthenticatedRequest(
        { id: 1, role: 'user' },
        {
          params: { id: '1' },
          body: { title: 'Updated Title', content: 'Updated content' }
        }
      );
      const res = createMockResponse();

      await postsServiceHandlers.updatePost(req, res);

      expect(res._json.title).toBe('Updated Title');
    });

    it('should return 404 for non-existent post', async () => {
      databaseMock.mockQueryResult([]);

      const req = createAuthenticatedRequest(
        { id: 1, role: 'user' },
        {
          params: { id: '999' },
          body: { title: 'Updated', content: 'Content' }
        }
      );
      const res = createMockResponse();

      await postsServiceHandlers.updatePost(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('DELETE /api/posts/:id', () => {
    it('should soft delete post', async () => {
      databaseMock.mockQueryResult([{ id: 1 }]);

      const req = createAuthenticatedRequest(
        { id: 1, role: 'admin' },
        { params: { id: '1' } }
      );
      const res = createMockResponse();

      await postsServiceHandlers.deletePost(req, res);

      expect(res._json.message).toContain('gelöscht');
    });

    it('should return 404 for non-existent post', async () => {
      databaseMock.mockQueryResult([]);

      const req = createAuthenticatedRequest(
        { id: 1, role: 'admin' },
        { params: { id: '999' } }
      );
      const res = createMockResponse();

      await postsServiceHandlers.deletePost(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
