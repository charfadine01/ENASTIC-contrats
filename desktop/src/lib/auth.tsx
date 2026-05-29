import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, API_BASE_URL } from "./api";
import type { User } from "./types";

type ApiStatus = "checking" | "ready" | "down";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  apiStatus: ApiStatus;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function pingApi(timeoutMs = 1500): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${API_BASE_URL}/health`, { signal: ctrl.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Attend que l'API embarquée réponde à /health (jusqu'à ~20s).
 * Retourne true si OK, false si timeout.
 */
async function waitForApi(maxAttempts = 40, delayMs = 500): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    if (await pingApi()) return true;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Attente du démarrage de l'API embarquée
      const ok = await waitForApi();
      if (cancelled) return;
      if (!ok) {
        setApiStatus("down");
        setLoading(false);
        return;
      }
      setApiStatus("ready");

      // API prête → tester si on a déjà un token valide
      const token = localStorage.getItem("enastic_token");
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get<User>("/auth/me");
        if (!cancelled) setUser(res.data);
      } catch {
        localStorage.removeItem("enastic_token");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function login(username: string, password: string) {
    const res = await api.post<{ access_token: string }>("/auth/login", {
      username,
      password,
    });
    localStorage.setItem("enastic_token", res.data.access_token);
    const me = await api.get<User>("/auth/me");
    setUser(me.data);
  }

  function logout() {
    localStorage.removeItem("enastic_token");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, apiStatus, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
