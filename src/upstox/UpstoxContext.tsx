import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { upstoxApi, type AuthStatus } from './api';

interface UpstoxContextValue {
  status: AuthStatus;
  loading: boolean;
  refresh: () => Promise<void>;
  login: () => void;
  logout: () => Promise<void>;
}

const UpstoxContext = createContext<UpstoxContextValue | null>(null);

export function UpstoxProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>({ connected: false });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const s = await upstoxApi.status();
      setStatus(s);
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Upstox redirects back here with ?upstox_connected=1 or ?upstox_error=...
    const params = new URLSearchParams(window.location.search);
    if (params.has('upstox_connected') || params.has('upstox_error')) {
      const errorCode = params.get('upstox_error');
      if (errorCode) {
        // Surface it once via a simple banner state; consumers can read status.lastError.
        setStatus((s) => ({ ...s, lastError: errorCode }));
      }
      window.history.replaceState({}, '', window.location.pathname);
    }
    refresh();
  }, [refresh]);

  const login = useCallback(() => {
    window.location.href = upstoxApi.loginUrl();
  }, []);

  const logout = useCallback(async () => {
    await upstoxApi.logout();
    await refresh();
  }, [refresh]);

  return <UpstoxContext.Provider value={{ status, loading, refresh, login, logout }}>{children}</UpstoxContext.Provider>;
}

export function useUpstox(): UpstoxContextValue {
  const ctx = useContext(UpstoxContext);
  if (!ctx) throw new Error('useUpstox must be used within <UpstoxProvider>');
  return ctx;
}
