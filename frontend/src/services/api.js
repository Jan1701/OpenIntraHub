import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request Interceptor: Token hinzufügen
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Error Handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// PAGES API
export const pagesApi = {
  list: (params) => api.get('/pages', { params }),
  get: (id) => api.get(`/pages/${id}`),
  getBySlug: (slug) => api.get(`/pages/slug/${slug}`),
  getHomepage: () => api.get('/pages/homepage'),
  create: (data) => api.post('/pages', data),
  update: (id, data) => api.put(`/pages/${id}`, data),
  delete: (id) => api.delete(`/pages/${id}`)
};

// SECTIONS API
export const sectionsApi = {
  create: (pageId, data) => api.post(`/pages/${pageId}/sections`, data),
  update: (id, data) => api.put(`/sections/${id}`, data),
  delete: (id) => api.delete(`/sections/${id}`)
};

// MODULES API
export const modulesApi = {
  list: (params) => api.get('/modules', { params }),
  getByCategory: () => api.get('/modules/by-category'),
  get: (id) => api.get(`/modules/${id}`),
  create: (data) => api.post('/modules', data),
  update: (id, data) => api.put(`/modules/${id}`, data),
  delete: (id) => api.delete(`/modules/${id}`),
  toggle: (id, is_active) => api.patch(`/modules/${id}/toggle`, { is_active })
};

// PAGE MODULES API
export const pageModulesApi = {
  create: (sectionId, data) => api.post(`/sections/${sectionId}/modules`, data),
  update: (id, data) => api.put(`/page-modules/${id}`, data),
  delete: (id) => api.delete(`/page-modules/${id}`)
};

// AUTH API
export const authApi = {
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  getProfile: () => api.get('/user/profile')
};

export default api;
