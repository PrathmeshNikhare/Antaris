import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import type { AuthUser, OperatorRole } from "@maitri-bharati/shared";
import { getApiUrl } from "../services/api-config";

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  hasRole: (...roles: OperatorRole[]) => boolean;
  canAccessStation: (stationId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token_backup"));
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(getApiUrl("/auth/me"), {
        headers,
        credentials: "include",
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.user) {
          setUser(json.data.user);
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const res = await fetch(getApiUrl("/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data?.error?.message || "Invalid credentials." };
      }

      setUser(data.data.user);
      setToken(data.data.token);
      localStorage.setItem("token_backup", data.data.token);
      return { success: true };
    } catch (err) {
      return { success: false, error: `Login connection failed: ${(err as Error).message}` };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(getApiUrl("/auth/logout"), {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.warn("Logout request failed:", err);
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem("token_backup");
    }
  }, []);

  const hasRole = useCallback(
    (...roles: OperatorRole[]) => {
      if (!user) return false;
      if (user.role === "ADMIN") return true;
      return roles.includes(user.role);
    },
    [user]
  );

  const canAccessStation = useCallback(
    (targetStationId: string) => {
      if (!user) return false;
      if (user.role === "ADMIN" || !user.stationId) return true;
      return user.stationId === targetStationId;
    },
    [user]
  );

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: !!user,
      loading,
      login,
      logout,
      hasRole,
      canAccessStation,
    }),
    [user, token, loading, login, logout, hasRole, canAccessStation]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
