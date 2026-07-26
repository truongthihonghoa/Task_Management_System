import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
} from '../api/authApi';
import {
  clearAuth,
  getAccessToken,
  getCurrentUser,
  setCurrentUser,
} from '../services/tokenStorage';
import { getProfile } from "../api/profileApi";
import { useEffect } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getCurrentUser());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function restoreSession() {
      if (!getAccessToken()) {
        setIsLoading(false);
        return;
      }

      try {
        const profile = await getProfile();
        setCurrentUser(profile, { persist: true });
        setUser(profile);
      } catch (err) {
        clearAuth();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, []);

  const login = useCallback(async ({ email, password, remember }) => {
  setIsLoading(true);

  try {
    const response = await loginRequest({
      email,
      password,
      remember,
    });

    // Lấy profile đầy đủ
    const profile = await getProfile();
    const mergedProfile = {
      ...(response.user || {}),
      ...profile,
      user_id: profile.user_id || response.user?.user_id,
    };

    // Đồng bộ Context + Storage
    setCurrentUser(mergedProfile, { persist: true });
    setUser(mergedProfile);

    return response;
  } finally {
    setIsLoading(false);
  }
}, []);

  const register = useCallback(async ({ email, fullName, password, confirmPassword, remember }) => {
    setIsLoading(true);
    try {
      const response = await registerRequest({
        email,
        fullName,
        password,
        confirmPassword,
        remember,
      });
      setCurrentUser(response.user, { persist: true });
      setUser(response.user);
      return response;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await logoutRequest();
    } finally {
      clearAuth();
      setCurrentUser(null);
      setUser(null);
      setIsLoading(false);
    }
  }, []);

  const value = useMemo(() => ({
    user,
    isLoading,
    isAuthenticated: Boolean(user && getAccessToken()),
    login,
    logout,
    register,
    setUser,
  }), [isLoading, login, logout, register, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
}
