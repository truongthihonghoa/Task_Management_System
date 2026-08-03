import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getProfile,
  updateProfile,
  uploadAvatar,
} from '../../api/profileApi';
import { API_BASE_URL } from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';
import { clearAuth, setCurrentUser } from '../../services/tokenStorage';
import ChangePasswordSection from './ChangePasswordSection';

const DEFAULT_AVATAR = 'https://via.placeholder.com/150';
const PROFILE_CACHE_KEY = 'taskflow_profile_cache';
const PROFILE_CACHE_TTL_MS = 60 * 1000;

function getErrorMessage(error) {
  const detail = error?.response?.data?.detail;
  const message = error?.response?.data?.message;

  if (message) return message;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  if (detail?.message) return detail.message;

  return 'Unable to update profile. Please try again.';
}

function getBackendOrigin() {
  try {
    const url = new URL(API_BASE_URL);
    return url.origin;
  } catch {
    return ''; // relative URL — same origin, proxy handles it
  }
}

function normalizeAvatarUrl(avatarUrl) {
  if (!avatarUrl) return DEFAULT_AVATAR;
  if (avatarUrl.startsWith('http') || avatarUrl.startsWith('data:')) return avatarUrl;
  const path = avatarUrl.startsWith('media/') ? `/${avatarUrl}` : avatarUrl;
  if (path.startsWith('/media/')) return `${getBackendOrigin()}${path}`;
  return avatarUrl;
}

function initialsForName(value = '') {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'U';
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join('');
}

function formatDate(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function normalizeProfile(profile) {
  return {
    avatarUrl: profile?.avatar_url || '',
    fullName: profile?.full_name || 'User',
    email: profile?.email || '',
    role: profile?.role || 'USER',
    status: profile?.status_user || 'Active',
    createdAt: profile?.created_at || null,
    lastLogin: profile?.last_login || null,
  };
}

function readProfileCache(authUser) {
  try {
    const cachedValue = window.sessionStorage.getItem(PROFILE_CACHE_KEY);
    if (!cachedValue) return normalizeProfile(authUser);

    const cached = JSON.parse(cachedValue);
    if (!cached?.profile || Date.now() - cached.cachedAt > PROFILE_CACHE_TTL_MS) {
      return normalizeProfile(authUser);
    }

    return normalizeProfile({
      avatar_url: cached.profile.avatarUrl,
      full_name: cached.profile.fullName,
      email: cached.profile.email,
      role: cached.profile.role,
      status_user: cached.profile.status,
      created_at: cached.profile.createdAt,
      last_login: cached.profile.lastLogin,
    });
  } catch {
    return normalizeProfile(authUser);
  }
}

function writeProfileCache(profile) {
  window.sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({
    profile,
    cachedAt: Date.now(),
  }));
}

function isProfileCacheFresh() {
  try {
    const cachedValue = window.sessionStorage.getItem(PROFILE_CACHE_KEY);
    if (!cachedValue) return false;

    const cached = JSON.parse(cachedValue);
    return Boolean(cached?.profile && Date.now() - cached.cachedAt <= PROFILE_CACHE_TTL_MS);
  } catch {
    return false;
  }
}

export default function ProfileTab() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const { user: authUser, setUser } = useAuth();

  const [profileData, setProfileData] = useState(() => readProfileCache(authUser));
  const [editData, setEditData] = useState(() => readProfileCache(authUser));
  const [selectedAvatarFile, setSelectedAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const syncAuthUser = (profile) => {
    const nextUser = {
      ...(authUser || {}),
        full_name: profile.fullName,
        email: profile.email,
        role: profile.role,
        avatar_url: profile.avatarUrl,
        status_user: profile.status,
        created_at: profile.createdAt,
        last_login: profile.lastLogin,
    };
    writeProfileCache(profile);
    setCurrentUser(nextUser);
    setUser(nextUser);
  };

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      if (isProfileCacheFresh()) return;

      setIsRefreshing(true);
      setErrorMessage('');

      try {
        const response = await getProfile();
        if (!isMounted) return;
        const nextProfile = normalizeProfile(response);
        setProfileData(nextProfile);
        setEditData(nextProfile);
        syncAuthUser(nextProfile);
      } catch (error) {
        if (isMounted) {
          setErrorMessage(getErrorMessage(error));
        }
      } finally {
        if (isMounted) {
          setIsRefreshing(false);
        }
      }
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  const profileCompletion = useMemo(() => {
    const fields = ['fullName', 'role', 'status', 'email', 'avatarUrl'];
    const filledFields = fields.filter((field) => {
      const value = profileData[field];
      return value && value !== '' && value !== DEFAULT_AVATAR;
    });
    const percentage = Math.round((filledFields.length / fields.length) * 100);

    return {
      percentage,
      completed: filledFields.length,
      total: fields.length,
    };
  }, [profileData]);

  const activeAvatar = normalizeAvatarUrl(
    avatarPreview || (isEditing ? editData.avatarUrl : profileData.avatarUrl),
  );
  const showAvatarImage = activeAvatar && activeAvatar !== DEFAULT_AVATAR;

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Avatar must be an image file.');
      return;
    }

    setSelectedAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleEditClick = () => {
    setEditData({ ...profileData });
    setSelectedAvatarFile(null);
    setAvatarPreview('');
    setErrorMessage('');
    setSuccessMessage('');
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditData({ ...profileData });
    setSelectedAvatarFile(null);
    setAvatarPreview('');
    setErrorMessage('');
    setIsEditing(false);
  };

  const handleSave = async () => {
  const trimmedFullName = editData.fullName.trim();

  if (!trimmedFullName) {
    setErrorMessage("Full name is required.");
    return;
  }

  setIsSaving(true);
  setErrorMessage("");
  setSuccessMessage("");

  try {
    if (trimmedFullName !== profileData.fullName) {
      await updateProfile({ fullName: trimmedFullName });
    }

    if (selectedAvatarFile) {
      await uploadAvatar(selectedAvatarFile);
    }

    // Lấy profile mới nhất từ backend
    const profile = await getProfile();

    const nextProfile = normalizeProfile(profile);

    setProfileData(nextProfile);
    setEditData(nextProfile);

    syncAuthUser(nextProfile);

    setSelectedAvatarFile(null);
    setAvatarPreview("");
    setIsEditing(false);

    // setSuccessMessage("Profile updated successfully.");
  } catch (error) {
    setErrorMessage(getErrorMessage(error));
  } finally {
    setIsSaving(false);
  }
};

  const handlePasswordChanged = () => {
    window.setTimeout(() => {
      clearAuth();
      setUser(null);
      navigate('/', {
        replace: true,
        state: { message: 'Password changed successfully. Please sign in again.' },
      });
    }, 1000);
  };

  return (
    <div className="space-y-6">
      {isRefreshing && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
          Refreshing profile...
        </div>
      )}

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {successMessage}
        </div>
      )}

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex items-center gap-6">
        <div className="relative">
          <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-indigo-100 bg-gradient-to-br from-[#2D1B4E] to-[#4A3B7A] flex items-center justify-center">
            {showAvatarImage ? (
              <img src={activeAvatar} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="text-white text-3xl font-bold">
                {initialsForName(profileData.fullName)}
              </span>
            )}
          </div>

          {isEditing && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-8 h-8 bg-[#2D1B4E] rounded-full border-2 border-white shadow-sm flex items-center justify-center hover:bg-opacity-90 transition"
            >
              <span className="material-symbols-outlined text-white text-[18px]">
                photo_camera
              </span>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900 truncate">{profileData.fullName}</h1>
          </div>
          <p className="text-gray-500 text-sm mb-2 break-all">{profileData.email}</p>
          <div className="flex gap-3">
            {!isEditing && (
              <button
                type="button"
                onClick={handleEditClick}
                className="px-4 py-1.5 bg-[#2D1B4E] text-white text-sm font-bold rounded-lg hover:bg-opacity-90 shadow-sm"
              >
                Edit Profile
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Personal Information
              </h2>
            </div>

            {isEditing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    value={editData.fullName}
                    onChange={(event) => {
                      setEditData({ ...editData, fullName: event.target.value });
                      setErrorMessage('');
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2D1B4E]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editData.email}
                    readOnly
                    className="w-full px-3 py-2 text-gray-600 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4">
                  <div>
                    <p className="text-sm text-gray-900 font-medium">Full Name</p>
                    <p className="text-gray-500 mt-0.5">{profileData.fullName}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-900 font-medium">Email</p>
                    <p className="text-gray-500 mt-0.5 break-all">{profileData.email}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {isEditing && (
            <>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <ChangePasswordSection onPasswordChanged={handlePasswordChanged} />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-bold"
                  disabled={isSaving}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  className="px-4 py-2 bg-[#2D1B4E] text-white rounded-lg hover:bg-opacity-90 font-bold disabled:opacity-70 disabled:cursor-not-allowed"
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Profile Completion
            </h2>

            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">
                  {profileCompletion.percentage}% Complete
                </span>
                <span className="text-gray-600">
                  {profileCompletion.completed}/{profileCompletion.total} Steps
                </span>
              </div>

              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-[#2D1B4E] h-2 rounded-full"
                  style={{ width: `${profileCompletion.percentage}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              System Logs
            </h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-gray-600">Created Date</span>
                <span className="font-medium text-right">{formatDate(profileData.createdAt)}</span>
              </div>

              <div className="flex justify-between gap-3">
                <span className="text-gray-600">Last Login</span>
                <span className="font-medium text-right">{formatDate(profileData.lastLogin)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
