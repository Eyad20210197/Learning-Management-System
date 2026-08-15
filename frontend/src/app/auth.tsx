import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { authApi, type User } from "../lib/api";

type AuthContextValue = {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function device() {
  const key = "lms-device-id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return { clientDeviceId: id, name: navigator.userAgent.slice(0, 120) };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const bootstrapStarted = useRef(false);

  useEffect(() => {
    if (bootstrapStarted.current) return;
    bootstrapStarted.current = true;
    authApi
      .refresh()
      .then(({ accessToken: token }) => {
        setAccessToken(token);
        return authApi.me(token);
      })
      .then(setUser)
      .catch(() => undefined)
      .finally(() => setIsLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      isLoading,
      async signIn(email, password) {
        const result = await authApi.login({
          email,
          password,
          device: device(),
        });
        setAccessToken(result.accessToken);
        setUser(result.user);
      },
      async signOut() {
        if (accessToken)
          await authApi.logout(accessToken).catch(() => undefined);
        setAccessToken(null);
        setUser(null);
      },
    }),
    [accessToken, isLoading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
