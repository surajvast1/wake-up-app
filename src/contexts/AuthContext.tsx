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
import { supabase, supabaseConfigured } from "../lib/supabase";
import { dataStorageScope } from "../lib/dataStorageScope";

export interface GuestSession {
  name: string;
  photoUri: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  configured: boolean;
  /** Deprecated compatibility flag; guest mode is disabled. */
  isGuest: boolean;
  guestSession: GuestSession | null;
  needsName: boolean;
  /** AsyncStorage scope for tasks / habits / meditation (guest vs user id). */
  storageScope: string;
  sendEmailOtp: (email: string) => Promise<{ error?: string }>;
  verifyEmailOtp: (email: string, token: string) => Promise<{ error?: string }>;
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

  const continueAsGuest = useCallback(async () => ({
    error: "Guest mode is disabled. Please use email sign in.",
  }), []);

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
