import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { apiClient } from "@/lib/api";

const AuthContext = createContext({ user: null, loading: true, refresh: () => {}, logout: () => {} });

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await apiClient.get("/auth/me");
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // If returning from OAuth callback, skip /me check - AuthCallback will handle it
    if (window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    refresh();
  }, [refresh]);

  const logout = async () => {
    try {
      await apiClient.post("/auth/logout");
    } catch (e) { /* ignore */ }
    setUser(null);
    window.location.href = "/";
  };

  return <AuthContext.Provider value={{ user, loading, refresh, logout, setUser }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

export const loginWithGoogle = () => {
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const redirectUrl = window.location.origin + "/dashboard";
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
};
