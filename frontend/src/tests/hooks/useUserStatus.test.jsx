import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock the useUserStatus hook behavior
const createUseUserStatusHook = (apiMock) => {
  return function useUserStatus(userIds = []) {
    const [statuses, setStatuses] = React.useState({});
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState(null);

    const fetchStatuses = React.useCallback(async (ids) => {
      if (!ids || ids.length === 0) return;

      setLoading(true);
      setError(null);

      try {
        const response = await apiMock.post('/api/status/bulk', { userIds: ids });
        setStatuses((prev) => ({ ...prev, ...response.data }));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }, []);

    const updateMyStatus = React.useCallback(async (status, message) => {
      try {
        await apiMock.put('/api/status/me', { status, message });
        return true;
      } catch (err) {
        setError(err.message);
        return false;
      }
    }, []);

    React.useEffect(() => {
      if (userIds.length > 0) {
        fetchStatuses(userIds);
      }
    }, [userIds.join(',')]);

    return {
      statuses,
      loading,
      error,
      fetchStatuses,
      updateMyStatus
    };
  };
};

import React from 'react';

describe('useUserStatus Hook', () => {
  let apiMock;
  let useUserStatus;

  beforeEach(() => {
    apiMock = {
      post: vi.fn(),
      put: vi.fn(),
      get: vi.fn()
    };
    useUserStatus = createUseUserStatusHook(apiMock);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have empty statuses initially', () => {
      const { result } = renderHook(() => useUserStatus([]));

      expect(result.current.statuses).toEqual({});
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
    });
  });

  describe('fetchStatuses', () => {
    it('should fetch statuses for given user IDs', async () => {
      const mockResponse = {
        data: {
          1: { status: 'available', message: '' },
          2: { status: 'busy', message: 'In a meeting' }
        }
      };
      apiMock.post.mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useUserStatus([1, 2]));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(apiMock.post).toHaveBeenCalledWith('/api/status/bulk', { userIds: [1, 2] });
    });

    it('should handle fetch error', async () => {
      apiMock.post.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useUserStatus([1]));

      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
      });
    });

    it('should not fetch if userIds is empty', () => {
      renderHook(() => useUserStatus([]));

      expect(apiMock.post).not.toHaveBeenCalled();
    });
  });

  describe('updateMyStatus', () => {
    it('should update status successfully', async () => {
      apiMock.put.mockResolvedValueOnce({ data: { success: true } });

      const { result } = renderHook(() => useUserStatus([]));

      let success;
      await act(async () => {
        success = await result.current.updateMyStatus('away', 'Back in 5 minutes');
      });

      expect(success).toBe(true);
      expect(apiMock.put).toHaveBeenCalledWith('/api/status/me', {
        status: 'away',
        message: 'Back in 5 minutes'
      });
    });

    it('should handle update error', async () => {
      apiMock.put.mockRejectedValueOnce(new Error('Update failed'));

      const { result } = renderHook(() => useUserStatus([]));

      let success;
      await act(async () => {
        success = await result.current.updateMyStatus('busy', '');
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe('Update failed');
    });
  });
});

describe('Status Types', () => {
  const validStatuses = ['available', 'away', 'busy', 'dnd', 'offline', 'oof'];

  it('should have all valid status types defined', () => {
    expect(validStatuses).toHaveLength(6);
    expect(validStatuses).toContain('available');
    expect(validStatuses).toContain('away');
    expect(validStatuses).toContain('busy');
    expect(validStatuses).toContain('dnd');
    expect(validStatuses).toContain('offline');
    expect(validStatuses).toContain('oof');
  });
});
