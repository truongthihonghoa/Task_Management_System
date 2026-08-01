import axiosClient from './axiosClient';
import {
  clearAuth,
  getRefreshToken,
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
  setAccessToken(accessToken, { persist: true });

  if (refreshToken) {
    setRefreshToken(refreshToken, { persist: true });
  }

  setCurrentUser(user, { persist: true });
  return response.data;
}

export async function refreshAccessToken() {
  const storedRefreshToken = getRefreshToken();
  const response = await axiosClient.post(
    '/auth/refresh',
    { refresh_token: storedRefreshToken },
    { skipAuthRefresh: true },
  );
  const {
    access_token: accessToken,
    refresh_token: refreshToken,
  } = response.data;
  setAccessToken(accessToken, { persist: true });

  if (refreshToken) {
    setRefreshToken(refreshToken, { persist: true });
  }
  return response.data;
}

export const refresh = refreshAccessToken;

export async function getCurrentUser() {
  const response = await axiosClient.get('/users/profile');
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

export async function verifyResetToken({ email, token }) {
  const response = await axiosClient.get('/auth/verify-reset-token', {
    params: { email, token },
    skipAuthRefresh: true,
  });
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

export async function verifyEmail({ email, otpCode }) {
  const response = await axiosClient.post(
    '/auth/verify-email',
    { email, otp_code: otpCode },
    { skipAuthRefresh: true },
  );
  return response.data;
}

export async function resendVerification(email) {
  const response = await axiosClient.post(
    '/auth/resend-verification',
    { email },
    { skipAuthRefresh: true },
  );
  return response.data;
}

export async function register({ email, fullName, password, confirmPassword, remember = true }) {
  const response = await axiosClient.post(
    '/auth/register',
    {
      email,
      full_name: fullName,
      password,
      confirm_password: confirmPassword,
    },
    { skipAuthRefresh: true },
  );

  const {
    access_token: accessToken,
    refresh_token: refreshToken,
    user: responseUser,
  } = response.data;

  setAccessToken(accessToken, { persist: true });

  if (refreshToken) {
    setRefreshToken(refreshToken, { persist: true });
  }

  const user = responseUser || {
    full_name: response.data.full_name,
    email: response.data.email,
    role: response.data.role,
  };
  setCurrentUser(user, { persist: true });

  return { ...response.data, user };
}

export async function uploadRegistrationAvatar(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await axiosClient.post('/auth/register/avatar', formData);
  return response.data;
}
