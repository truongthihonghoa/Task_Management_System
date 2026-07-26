const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'current_user';
const LEGACY_USER_KEY = 'auth_user';

let accessToken =
  window.sessionStorage.getItem(ACCESS_TOKEN_KEY) ||
  window.localStorage.getItem(ACCESS_TOKEN_KEY) ||
  null;

function setStorageValue(key, value, { persist = false } = {}) {
  const primaryStorage = persist ? window.localStorage : window.sessionStorage;
  const secondaryStorage = persist ? window.sessionStorage : window.localStorage;

  if (!value) {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
    return;
  }

  primaryStorage.setItem(key, value);
  secondaryStorage.removeItem(key);
}

function getStorageValue(key) {
  return window.sessionStorage.getItem(key) || window.localStorage.getItem(key);
}

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token, options = {}) {
  accessToken = token || null;
  setStorageValue(ACCESS_TOKEN_KEY, token, options);
}

export function getRefreshToken() {
  return getStorageValue(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token, options = {}) {
  setStorageValue(REFRESH_TOKEN_KEY, token, options);
}

export function isRefreshTokenPersisted() {
  return Boolean(window.localStorage.getItem(REFRESH_TOKEN_KEY));
}

export function getCurrentUser() {
  const value = getStorageValue(USER_KEY) || getStorageValue(LEGACY_USER_KEY);
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function setCurrentUser(user, options = {}) {
  const value = user ? JSON.stringify(user) : null;
  setStorageValue(USER_KEY, value, options);
  setStorageValue(LEGACY_USER_KEY, null, options);
}

export function clearAuth() {
  accessToken = null;
  [ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY, LEGACY_USER_KEY].forEach((key) => {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  });
}

export const getStoredUser = getCurrentUser;
export const setStoredUser = setCurrentUser;
export const clearAuthState = clearAuth;
