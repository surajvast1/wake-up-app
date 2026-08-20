import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Session, User } from "@supabase/supabase-js";
import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { dataStorageScope } from "../lib/dataStorageScope";

WebBrowser.maybeCompleteAuthSession();

function parseOAuthCallback(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const part of [url.split("?")[1]?.split("#")[0], url.split("#")[1]]) {
    if (!part) continue;
    for (const pair of part.split("&")) {
      const [rawKey, ...rawValue] = pair.split("=");
      if (!rawKey) continue;
      const decode = (value: string) =>
        decodeURIComponent(value.replace(/\+/g, " "));
      params[decode(rawKey)] = decode(rawValue.join("="));
    }
  }
  return params;
}

export interface GuestSession {
  name: string;
  photoUri: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  configured: boolean;
  /** Temporary guest access flag. */
  isGuest: boolean;
  guestSession: GuestSession | null;
  needsName: boolean;
  /** AsyncStorage scope for tasks / habits / meditation (guest vs user id). */
  storageScope: string;
  sendEmailOtp: (email: string) => Promise<{ error?: string }>;
  verifyEmailOtp: (email: string, token: string) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<{ error?: string; cancelled?: boolean }>;
  continueAsGuest: (name: string) => Promise<{ error?: string }>;
  saveUserName: (name: string) => Promise<{ error?: string }>;
  updateGuestProfile: (updates: Partial<GuestSession>) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [guestSession, setGuestSession] = useState<GuestSession | null>(null);
  const [needsName, setNeedsName] = useState(false);

  const storageScope = useMemo(
    () => dataStorageScope(isGuest, user?.id),
    [isGuest, user?.id]
  );

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setNeedsName(!String(s.user.user_metadata?.name ?? s.user.user_metadata?.full_name ?? "").trim());
        setIsGuest(false);
        setGuestSession(null);
        setLoading(false);
      } else setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setNeedsName(!String(s.user.user_metadata?.name ?? s.user.user_metadata?.full_name ?? "").trim());
        setIsGuest(false);
        setGuestSession(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const sendEmailOtp = useCallback(async (email: string) => {
    if (!supabaseConfigured) return { error: "Supabase is not configured." };
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });
    if (error) return { error: error.message };
    return {};
  }, []);

  const verifyEmailOtp = useCallback(async (email: string, token: string) => {
    if (!supabaseConfigured) return { error: "Supabase is not configured." };
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: token.replace(/\D/g, "").trim(),
      type: "email",
    });
    if (error) return { error: error.message };
    const s = data.session;
    if (!s?.user) return { error: "The code was accepted, but no login session was created. Please request a new code and try again." };
    setSession(s);
    setUser(s.user);
    setIsGuest(false);
    setGuestSession(null);
    setNeedsName(!String(s.user.user_metadata?.name ?? s.user.user_metadata?.full_name ?? "").trim());
    return {};
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!supabaseConfigured) return { error: "Supabase is not configured." };

    try {
      const redirectTo = makeRedirectUri({
        scheme: "uniflow",
        path: "auth/callback",
      });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: { prompt: "select_account" },
        },
      });

      if (error) return { error: error.message };
      if (!data.url) return { error: "Google sign-in could not be started." };

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === "cancel" || result.type === "dismiss") {
        return { cancelled: true };
      }
      if (result.type !== "success" || !result.url) {
        return { error: "Google sign-in did not complete. Please try again." };
      }

      const params = parseOAuthCallback(result.url);
      const oauthError =
        params.error_description || params.error || params.errorCode;
      if (oauthError) return { error: oauthError };

      if (params.code) {
        const { data: codeData, error: codeError } =
          await supabase.auth.exchangeCodeForSession(params.code);
        if (codeError) return { error: codeError.message };
        if (!codeData.session?.user) {
          return { error: "Google approved the request, but no session was created." };
        }
        return {};
      }

      if (!params.access_token || !params.refresh_token) {
        return { error: "Google approved the request, but no session tokens were returned." };
      }

      const { data: sessionData, error: sessionError } =
        await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
      if (sessionError) return { error: sessionError.message };
      if (!sessionData.session?.user) {
        return { error: "Google approved the request, but no session was created." };
      }
      return {};
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Google sign-in failed. Please try again.",
      };
    }
  }, []);

  const saveUserName = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return { error: "Please enter your name" };
    if (!user) return { error: "Your session has expired. Please sign in again." };
    const { error } = await supabase.auth.updateUser({
      data: { name: trimmed, full_name: trimmed },
    });
    if (error) return { error: error.message };
    await AsyncStorage.setItem("LOCAL_PROFILE", JSON.stringify({ name: trimmed }));
    setNeedsName(false);
    return {};
  }, [user]);

  // TEMPORARY GUEST ACCESS: remove this callback and the login-screen button
  // when Google/email authentication is mandatory.
  const continueAsGuest = useCallback(async (name: string) => {
    const guest: GuestSession = {
      name: name.trim() || "Guest",
      photoUri: null,
    };
    setSession(null);
    setUser(null);
    setNeedsName(false);
    setGuestSession(guest);
    setIsGuest(true);
    return {};
  }, []);

  const updateGuestProfile = useCallback(async (_updates: Partial<GuestSession>) => {}, []);

  const signOut = useCallback(async () => {
    if (supabaseConfigured) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
    setIsGuest(false);
    setGuestSession(null);
    setNeedsName(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        configured: supabaseConfigured,
        isGuest,
        guestSession,
        needsName,
        storageScope,
        sendEmailOtp,
        verifyEmailOtp,
        signInWithGoogle,
        continueAsGuest,
        saveUserName,
        updateGuestProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
