import axiosClient from './axiosClient';
import {
  clearAuth,
  setAccessToken,
  setCurrentUser,
  setRefreshToken,
} from '../services/tokenStorage';

export async function login({ email, password, remember = true }) {
  const response = await axiosClient.post(
    '/auth/login',
    { email, password },
    { skipAuthRefresh: true },
  );
  const {
    access_token: accessToken,
    refresh_token: refreshToken,
    user,
  } = response.data;
  setAccessToken(accessToken, { persist: remember });
  if (refreshToken) {
    setRefreshToken(refreshToken, { persist: remember });
  }
  setCurrentUser(user, { persist: remember });
  return response.data;
}

export async function refreshAccessToken() {
  const response = await axiosClient.post('/auth/refresh', null, { skipAuthRefresh: true });
  const {
    access_token: accessToken,
    refresh_token: refreshToken,
  } = response.data;
  setAccessToken(accessToken);
  if (refreshToken) {
    setRefreshToken(refreshToken);
  }
  return response.data;
}

export const refresh = refreshAccessToken;

export async function getCurrentUser() {
  const response = await axiosClient.get('/auth/me');
  setCurrentUser(response.data);
  return response.data;
}

export async function logout() {
  try {
    await axiosClient.post('/auth/logout', null, { skipAuthRefresh: true });
  } finally {
    clearAuth();
  }
}

export async function forgotPassword(email) {
  const response = await axiosClient.post(
    '/auth/forgot-password',
    { email },
    { skipAuthRefresh: true },
  );
  return response.data;
}

export async function resetPassword({ email, token, password, confirmPassword }) {
  const response = await axiosClient.post(
    '/auth/reset-password',
    {
      email,
      token,
      password,
      confirm_password: confirmPassword,
    },
    { skipAuthRefresh: true },
  );
  return response.data;
}

export async function checkEmail(email) {
  const response = await axiosClient.post(
    '/auth/check-email',
    { email },
    { skipAuthRefresh: true },
  );
  return response.data;
}
