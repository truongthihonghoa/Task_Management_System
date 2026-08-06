import { API_BASE_URL } from '../api/axiosClient';

export function getBackendOrigin() {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return '';
  }
}

export function normalizeAvatarUrl(avatarUrl, fallback = '') {
  if (!avatarUrl) return fallback;
  if (/^(blob:|data:|https?:\/\/)/i.test(avatarUrl)) return avatarUrl;

  const path = avatarUrl.startsWith('media/') ? `/${avatarUrl}` : avatarUrl;
  if (path.startsWith('/media/')) return `${getBackendOrigin()}${path}`;
  return avatarUrl;
}

export function getInitials(value = '', fallback = 'U') {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return fallback;
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join('');
}
