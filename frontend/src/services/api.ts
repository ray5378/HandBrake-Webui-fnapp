import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const KNOWN_ROUTES = ['/login', '/files', '/jobs', '/presets', '/settings', '/account'];

function detectBasePath(): string {
  const p = window.location.pathname;
  for (const route of KNOWN_ROUTES) {
    const idx = p.indexOf(route);
    if (idx > 0) {
      return p.slice(0, idx);
    }
    if (idx === 0) {
      return '/';
    }
  }
  return p.replace(/\/$/, '') || '/';
}

const _basePath = detectBasePath();

export function getBasePath(): string {
  return _basePath;
}

const api = axios.create({
  baseURL: _basePath === '/' ? '/api' : _basePath + '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use(
  config => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const response = await axios.post(_basePath + '/api/auth/refresh', {
            refreshToken
          });
          const { token } = response.data.data;

          useAuthStore.getState().setToken(token);
          originalRequest.headers.Authorization = `Bearer ${token}`;

          return api(originalRequest);
        } catch (refreshError) {
          useAuthStore.getState().logout();
          window.location.href = _basePath + '/login';
          return Promise.reject(refreshError);
        }
      }

      useAuthStore.getState().logout();
      window.location.href = _basePath + '/login';
    }

    return Promise.reject(error);
  }
);

export default api;
