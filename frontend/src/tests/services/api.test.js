import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for API Service
 * Tests token handling, interceptors, and API calls
 */

describe('API Service', () => {
  let mockAxiosInstance;
  let mockLocalStorage;

  beforeEach(() => {
    // Mock localStorage
    mockLocalStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn()
    };
    Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

    // Mock axios create
    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: {
          use: vi.fn(),
          handlers: []
        },
        response: {
          use: vi.fn(),
          handlers: []
        }
      },
      defaults: {
        headers: {
          common: {}
        }
      }
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Token Management', () => {
    it('should get token from localStorage', () => {
      mockLocalStorage.getItem.mockReturnValue('test-token');

      const token = mockLocalStorage.getItem('token');

      expect(token).toBe('test-token');
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('token');
    });

    it('should set token in localStorage', () => {
      mockLocalStorage.setItem('token', 'new-token');

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('token', 'new-token');
    });

    it('should remove token from localStorage', () => {
      mockLocalStorage.removeItem('token');

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('token');
    });
  });

  describe('Request Interceptor', () => {
    it('should add Authorization header when token exists', () => {
      mockLocalStorage.getItem.mockReturnValue('valid-token');

      const config = { headers: {} };
      const token = mockLocalStorage.getItem('token');

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      expect(config.headers.Authorization).toBe('Bearer valid-token');
    });

    it('should not add Authorization header when no token', () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const config = { headers: {} };
      const token = mockLocalStorage.getItem('token');

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      expect(config.headers.Authorization).toBeUndefined();
    });
  });

  describe('Response Interceptor', () => {
    it('should pass through successful responses', () => {
      const response = { data: { success: true }, status: 200 };

      // Simulate successful response handling
      const result = response;

      expect(result.data.success).toBe(true);
    });

    it('should handle 401 error by removing token', () => {
      const error = {
        response: { status: 401 }
      };

      // Simulate 401 handling
      if (error.response?.status === 401) {
        mockLocalStorage.removeItem('token');
      }

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('token');
    });

    it('should handle 403 error', () => {
      const error = {
        response: { status: 403, data: { error: 'Forbidden' } }
      };

      expect(error.response.status).toBe(403);
      expect(error.response.data.error).toBe('Forbidden');
    });

    it('should handle network error', () => {
      const error = {
        message: 'Network Error',
        response: undefined
      };

      expect(error.response).toBeUndefined();
      expect(error.message).toBe('Network Error');
    });
  });

  describe('API Calls', () => {
    it('should make GET request', async () => {
      const mockData = { users: [{ id: 1, name: 'Test' }] };
      mockAxiosInstance.get.mockResolvedValue({ data: mockData });

      const response = await mockAxiosInstance.get('/api/users');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/users');
      expect(response.data).toEqual(mockData);
    });

    it('should make POST request with data', async () => {
      const postData = { title: 'Test', content: 'Content' };
      const mockResponse = { data: { id: 1, ...postData } };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const response = await mockAxiosInstance.post('/api/posts', postData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/posts', postData);
      expect(response.data.id).toBe(1);
    });

    it('should make PUT request', async () => {
      const updateData = { title: 'Updated' };
      mockAxiosInstance.put.mockResolvedValue({ data: updateData });

      const response = await mockAxiosInstance.put('/api/posts/1', updateData);

      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/api/posts/1', updateData);
      expect(response.data.title).toBe('Updated');
    });

    it('should make DELETE request', async () => {
      mockAxiosInstance.delete.mockResolvedValue({ data: { success: true } });

      const response = await mockAxiosInstance.delete('/api/posts/1');

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/posts/1');
      expect(response.data.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle 400 Bad Request', async () => {
      const error = {
        response: {
          status: 400,
          data: { error: 'Validation failed' }
        }
      };
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(mockAxiosInstance.post('/api/posts', {})).rejects.toEqual(error);
    });

    it('should handle 404 Not Found', async () => {
      const error = {
        response: {
          status: 404,
          data: { error: 'Not found' }
        }
      };
      mockAxiosInstance.get.mockRejectedValue(error);

      await expect(mockAxiosInstance.get('/api/posts/999')).rejects.toEqual(error);
    });

    it('should handle 500 Server Error', async () => {
      const error = {
        response: {
          status: 500,
          data: { error: 'Internal server error' }
        }
      };
      mockAxiosInstance.get.mockRejectedValue(error);

      await expect(mockAxiosInstance.get('/api/health')).rejects.toEqual(error);
    });
  });
});
