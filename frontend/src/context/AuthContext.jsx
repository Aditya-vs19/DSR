import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "../services/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("dsr_token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem("dsr_user");
    if (savedUser && token) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem("dsr_user");
        localStorage.removeItem("dsr_token");
        setToken(null);
        setUser(null);
      }
    }
    setLoading(false);
  }, [token]);

  const login = async (username, password) => {
    const { data } = await authApi.login({ username, password });
    localStorage.setItem("dsr_token", data.token);
    localStorage.setItem("dsr_user", JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("dsr_token");
    localStorage.removeItem("dsr_user");
    setToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      logout,
      isAuthenticated: Boolean(token && user)
    }),
    [user, token, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
};
