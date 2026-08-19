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
import { seedGuestDemoData } from "../services/guestDemoData";

const GUEST_PROFILE_KEY = "GUEST_PROFILE_V1";
const DEFAULT_GUEST_SESSION: GuestSession = {
  name: "Daisy",
  photoUri: null,
};

export interface GuestSession {
  name: string;
  photoUri: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  configured: boolean;
  /** Local-only session (no Supabase account). */
  isGuest: boolean;
  guestSession: GuestSession | null;
  /** AsyncStorage scope for tasks / habits / meditation (guest vs user id). */
  storageScope: string;
  signInWithPhone: (phone: string) => Promise<{ error?: string }>;
  verifyOtp: (phone: string, token: string) => Promise<{ error?: string }>;
  continueAsGuest: (name: string) => Promise<{ error?: string }>;
  updateGuestProfile: (updates: Partial<GuestSession>) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

async function readGuestFromStorage(): Promise<GuestSession | null> {
  try {
    const raw = await AsyncStorage.getItem(GUEST_PROFILE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as GuestSession;
    if (!p.name || typeof p.name !== "string" || !p.name.trim()) return null;
    return {
      name: p.name.trim(),
      photoUri:
        p.photoUri && typeof p.photoUri === "string" ? p.photoUri : null,
    };
  } catch {
    return null;
  }
}

async function ensureGuestSession(): Promise<GuestSession> {
  const existing = await readGuestFromStorage();
  if (existing && existing.name.toLowerCase() !== "guest") return existing;
  if (existing?.name.toLowerCase() === "guest") {
    await AsyncStorage.setItem(
      GUEST_PROFILE_KEY,
      JSON.stringify(DEFAULT_GUEST_SESSION)
    );
    return DEFAULT_GUEST_SESSION;
  }
  await AsyncStorage.setItem(
    GUEST_PROFILE_KEY,
    JSON.stringify(DEFAULT_GUEST_SESSION)
  );
  return DEFAULT_GUEST_SESSION;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [guestSession, setGuestSession] = useState<GuestSession | null>(null);

  const storageScope = useMemo(
    () => dataStorageScope(isGuest, user?.id),
    [isGuest, user?.id]
  );

  useEffect(() => {
    if (!supabaseConfigured) {
      void (async () => {
        const g = await ensureGuestSession();
        setGuestSession(g);
        setIsGuest(true);
        await seedGuestDemoData();
        setLoading(false);
      })();
      return;
    }

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setIsGuest(false);
        setGuestSession(null);
        void AsyncStorage.removeItem(GUEST_PROFILE_KEY);
        setLoading(false);
      } else {
        void (async () => {
          const g = await ensureGuestSession();
          setGuestSession(g);
          setIsGuest(true);
          await seedGuestDemoData();
          setLoading(false);
        })();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setIsGuest(false);
        setGuestSession(null);
        void AsyncStorage.removeItem(GUEST_PROFILE_KEY);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithPhone = useCallback(async (phone: string) => {
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) return { error: error.message };
    return {};
  }, []);

  const verifyOtp = useCallback(async (phone: string, token: string) => {
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: "sms",
    });
    if (error) return { error: error.message };
    const s = data.session;
    if (s?.user) {
      setSession(s);
      setUser(s.user);
      setIsGuest(false);
      setGuestSession(null);
      await AsyncStorage.removeItem(GUEST_PROFILE_KEY);
    }
    return {};
  }, []);

  const continueAsGuest = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return { error: "Please enter your name" };
    const next: GuestSession = { name: trimmed, photoUri: null };
    await AsyncStorage.setItem(GUEST_PROFILE_KEY, JSON.stringify(next));
    setGuestSession(next);
    setIsGuest(true);
    return {};
  }, []);

  const updateGuestProfile = useCallback(async (updates: Partial<GuestSession>) => {
    setGuestSession((prev) => {
      const base = prev ?? { name: "", photoUri: null };
      const next: GuestSession = {
        name:
          updates.name !== undefined
            ? updates.name.trim() || base.name
            : base.name,
        photoUri:
          updates.photoUri !== undefined ? updates.photoUri : base.photoUri,
      };
      void AsyncStorage.setItem(GUEST_PROFILE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const signOut = useCallback(async () => {
    if (supabaseConfigured) {
      await supabase.auth.signOut();
    }
    await AsyncStorage.removeItem(GUEST_PROFILE_KEY);
    setUser(null);
    setSession(null);
    setIsGuest(false);
    setGuestSession(null);
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
        storageScope,
        signInWithPhone,
        verifyOtp,
        continueAsGuest,
        updateGuestProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
