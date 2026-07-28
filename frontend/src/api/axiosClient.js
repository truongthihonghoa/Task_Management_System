import axios from 'axios';
import {
  clearAuth,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '../services/tokenStorage';

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  '/api/v1'
).replace(/\/$/, '');

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    Accept: 'application/json',
  },
});

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

let refreshPromise = null;

function isAuthBypassRequest(config = {}) {
  const url = config.url || '';
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/logout') ||
    url.includes('/auth/refresh')
  );
}

function redirectToLogin() {
  if (!['/', '/login'].includes(window.location.pathname)) {
    window.location.assign('/');
  }
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      return Promise.reject(new Error('No refresh token is available.'));
    }

    const body = refreshToken ? { refresh_token: refreshToken } : {};

    refreshPromise = refreshClient
      .post('/auth/refresh', body)
      .then((response) => {
        const newAccessToken = response.data?.access_token;
        if (!newAccessToken) {
          throw new Error('Refresh response did not include an access token.');
        }
        setAccessToken(newAccessToken, { persist: true });

        if (response.data?.refresh_token) {
          setRefreshToken(response.data.refresh_token, { persist: true });
        }

        return newAccessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

axiosClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  config.headers = config.headers || {};

  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
    delete config.headers['content-type'];
  }

  return config;
});

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {};
    const status = error.response?.status;

    if (
      status !== 401 ||
      originalRequest._retry ||
      originalRequest.skipAuthRefresh ||
      isAuthBypassRequest(originalRequest)
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const newAccessToken = await refreshAccessToken();
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return axiosClient(originalRequest);
    } catch (refreshError) {
      clearAuth();
      redirectToLogin();
      return Promise.reject(refreshError);
    }
  },
);

export default axiosClient;
export { API_BASE_URL };
