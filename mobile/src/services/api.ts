import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';

// API Base URL - Configure this for your environment
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token storage keys
const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// Request interceptor - Add auth token
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting auth token:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - Handle errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 - Token expired
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          const { token } = response.data;
          await SecureStore.setItemAsync(TOKEN_KEY, token);

          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Clear tokens and redirect to login
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (username: string, password: string) => {
    const response = await api.post('/auth/login', { username, password });
    const { token, refreshToken, user } = response.data;

    await SecureStore.setItemAsync(TOKEN_KEY, token);
    if (refreshToken) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    }

    return { token, user };
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    }
  },

  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return response.data;
  },

  getToken: async () => {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  },

  isAuthenticated: async () => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    return !!token;
  },
};

// Chat API
export const chatApi = {
  getConversations: async () => {
    const response = await api.get('/chat/conversations');
    return response.data;
  },

  getMessages: async (conversationId: string, page = 1, limit = 50) => {
    const response = await api.get(`/chat/conversations/${conversationId}/messages`, {
      params: { page, limit },
    });
    return response.data;
  },

  sendMessage: async (conversationId: string, content: string, attachments?: string[]) => {
    const response = await api.post(`/chat/conversations/${conversationId}/messages`, {
      content,
      attachments,
    });
    return response.data;
  },

  createConversation: async (participantIds: string[], name?: string, isGroup = false) => {
    const response = await api.post('/chat/conversations', {
      participantIds,
      name,
      isGroup,
    });
    return response.data;
  },

  markAsRead: async (conversationId: string) => {
    const response = await api.post(`/chat/conversations/${conversationId}/read`);
    return response.data;
  },
};

// Drive API
export const driveApi = {
  getFolders: async (parentId?: string) => {
    const response = await api.get('/drive/folders', {
      params: { parentId },
    });
    return response.data;
  },

  getFiles: async (folderId?: string) => {
    const response = await api.get('/drive/files', {
      params: { folderId },
    });
    return response.data;
  },

  uploadFile: async (formData: FormData, folderId?: string) => {
    const response = await api.post('/drive/files', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params: { folderId },
    });
    return response.data;
  },

  downloadFile: async (fileId: string) => {
    const response = await api.get(`/drive/files/${fileId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  createFolder: async (name: string, parentId?: string) => {
    const response = await api.post('/drive/folders', { name, parentId });
    return response.data;
  },

  deleteFile: async (fileId: string) => {
    const response = await api.delete(`/drive/files/${fileId}`);
    return response.data;
  },

  deleteFolder: async (folderId: string) => {
    const response = await api.delete(`/drive/folders/${folderId}`);
    return response.data;
  },
};

// Projects API
export const projectsApi = {
  getProjects: async () => {
    const response = await api.get('/projects');
    return response.data;
  },

  getProject: async (projectId: string) => {
    const response = await api.get(`/projects/${projectId}`);
    return response.data;
  },

  getBoards: async (projectId: string) => {
    const response = await api.get(`/projects/${projectId}/boards`);
    return response.data;
  },

  getTasks: async (projectId: string, boardId?: string) => {
    const response = await api.get(`/projects/${projectId}/tasks`, {
      params: { boardId },
    });
    return response.data;
  },

  createTask: async (projectId: string, task: {
    title: string;
    description?: string;
    columnId: string;
    assigneeId?: string;
    priority?: string;
    dueDate?: string;
  }) => {
    const response = await api.post(`/projects/${projectId}/tasks`, task);
    return response.data;
  },

  updateTask: async (projectId: string, taskId: string, updates: Record<string, unknown>) => {
    const response = await api.patch(`/projects/${projectId}/tasks/${taskId}`, updates);
    return response.data;
  },

  moveTask: async (projectId: string, taskId: string, columnId: string, position: number) => {
    const response = await api.patch(`/projects/${projectId}/tasks/${taskId}/move`, {
      columnId,
      position,
    });
    return response.data;
  },
};

// Events API
export const eventsApi = {
  getEvents: async (start?: string, end?: string) => {
    const response = await api.get('/events', {
      params: { start, end },
    });
    return response.data;
  },

  getEvent: async (eventId: string) => {
    const response = await api.get(`/events/${eventId}`);
    return response.data;
  },

  createEvent: async (event: {
    title: string;
    description?: string;
    startDate: string;
    endDate: string;
    allDay?: boolean;
    locationId?: string;
  }) => {
    const response = await api.post('/events', event);
    return response.data;
  },

  updateEvent: async (eventId: string, updates: Record<string, unknown>) => {
    const response = await api.patch(`/events/${eventId}`, updates);
    return response.data;
  },

  deleteEvent: async (eventId: string) => {
    const response = await api.delete(`/events/${eventId}`);
    return response.data;
  },
};

// Posts API
export const postsApi = {
  getPosts: async (page = 1, limit = 20) => {
    const response = await api.get('/posts', {
      params: { page, limit, status: 'published' },
    });
    return response.data;
  },

  getPost: async (postId: string) => {
    const response = await api.get(`/posts/${postId}`);
    return response.data;
  },

  getCategories: async () => {
    const response = await api.get('/posts/categories');
    return response.data;
  },
};

// User Status API
export const userStatusApi = {
  getStatus: async () => {
    const response = await api.get('/user-status');
    return response.data;
  },

  updateStatus: async (status: 'available' | 'away' | 'busy' | 'dnd' | 'offline') => {
    const response = await api.put('/user-status', { status });
    return response.data;
  },
};

// Users API
export const usersApi = {
  getUsers: async (search?: string) => {
    const response = await api.get('/users', {
      params: { search },
    });
    return response.data;
  },

  getUser: async (userId: string) => {
    const response = await api.get(`/users/${userId}`);
    return response.data;
  },
};

export default api;
