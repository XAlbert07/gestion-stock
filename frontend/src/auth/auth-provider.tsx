import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiRequest } from "@/lib/api";
import {
  AuthContext,
  type AuthContextValue,
  type AuthState,
  type User,
} from "@/auth/auth-context";
import {
  clearSessionToken,
  getSessionToken,
  saveSessionToken,
} from "@/auth/session-token";

type LoginResponse = { token: string; user: User };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getSessionToken());
  const [state, setState] = useState<AuthState>(() =>
    getSessionToken()
      ? { status: "loading", user: null }
      : { status: "anonymous", user: null },
  );

  const signOut = useCallback(() => {
    clearSessionToken();
    setToken(null);
    setState({ status: "anonymous", user: null });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await apiRequest<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    saveSessionToken(result.token);
    setToken(result.token);
    setState({ status: "authenticated", user: result.user });
  }, []);

  useEffect(() => {
    if (!token) return;
    let active = true;
    apiRequest<User>("/auth/me", { token })
      .then((user) => {
        if (active) setState({ status: "authenticated", user });
      })
      .catch(() => {
        if (active) signOut();
      });
    return () => {
      active = false;
    };
  }, [signOut, token]);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, token, signIn, signOut }),
    [state, token, signIn, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
