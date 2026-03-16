import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import * as api from "../lib/api";
import * as store from "../lib/localStorage";

const ACCESS_CODE_KEY = "museeum_access_code";

export function getInitialAccessCode(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("access") ?? params.get("accessCode");
  if (fromUrl?.trim()) {
    try {
      sessionStorage.setItem(ACCESS_CODE_KEY, fromUrl.trim());
    } catch {
      /* ignore */
    }
    return fromUrl.trim();
  }
  try {
    return sessionStorage.getItem(ACCESS_CODE_KEY) || null;
  } catch {
    return null;
  }
}

type AppContextValue = {
  accessCode: string | null;
  setAccessCode: (code: string | null) => void;
  persistAccessCode: (code: string) => void;
  clearAccessCode: (gateError?: string) => void;
  currentVisitSessionId: string | null;
  setCurrentVisitSessionId: (id: string | null) => void;
  gateError: string | null;
  setGateError: (msg: string | null) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [accessCode, setAccessCode] = useState<string | null>(getInitialAccessCode);
  const [currentVisitSessionId, setCurrentVisitSessionId] = useState<string | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);

  const persistAccessCode = useCallback((code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    try {
      sessionStorage.setItem(ACCESS_CODE_KEY, trimmed);
    } catch {
      /* ignore */
    }
    setGateError(null);
    setAccessCode(trimmed);
  }, []);

  const clearAccessCode = useCallback((errorMessage?: string) => {
    try {
      sessionStorage.removeItem(ACCESS_CODE_KEY);
    } catch {
      /* ignore */
    }
    setAccessCode(null);
    if (errorMessage) setGateError(errorMessage);
  }, []);

  return (
    <AppContext.Provider
      value={{
        accessCode,
        setAccessCode,
        persistAccessCode,
        clearAccessCode,
        currentVisitSessionId,
        setCurrentVisitSessionId,
        gateError,
        setGateError,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export { api, store };
