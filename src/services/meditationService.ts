import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { dataStorageScope } from "../lib/dataStorageScope";

const LEGACY_SESSIONS_KEY = "MEDITATION_SESSIONS";
const SESSIONS_PREFIX = "MEDITATION_SESSIONS_V2";

function sessionsStorageKey(scope: string): string {
  return `${SESSIONS_PREFIX}__${scope}`;
}

async function migrateMeditationLegacy(scope: string): Promise<void> {
  const k = sessionsStorageKey(scope);
  if ((await AsyncStorage.getItem(k)) != null) return;
  const leg = await AsyncStorage.getItem(LEGACY_SESSIONS_KEY);
  if (leg) {
    await AsyncStorage.setItem(k, leg);
    await AsyncStorage.removeItem(LEGACY_SESSIONS_KEY);
  }
}

export interface MeditationSession {
  id: string;
  /** Set when row was synced from or saved to Supabase */
  serverId?: string;
  date: string;
  durationSec: number;
  mode: "breathing" | "timer" | "chakra";
  pattern?: string;
  chakra?: string;
}

export interface DayMinutes {
  date: string;
  minutes: number;
}

export const dateKeyISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const dateKey = dateKeyISO;

async function getSessions(scope: string): Promise<MeditationSession[]> {
  try {
    await migrateMeditationLegacy(scope);
    const raw = await AsyncStorage.getItem(sessionsStorageKey(scope));
    if (raw) return JSON.parse(raw) as MeditationSession[];
  } catch {}
  return [];
}

async function persistSessions(
  scope: string,
  sessions: MeditationSession[]
): Promise<void> {
  const recent = sessions.slice(-300);
  await AsyncStorage.setItem(sessionsStorageKey(scope), JSON.stringify(recent));
}

/** Merge server rows into scoped local storage (by server id). */
export async function hydrateMeditationFromSupabase(
  userId: string,
  scope: string
): Promise<void> {
  if (!supabaseConfigured || !userId) return;
  try {
    const start = new Date();
    start.setMonth(start.getMonth() - 3);
    const startStr = dateKey(start);
    const { data, error } = await supabase
      .from("meditation_sessions")
      .select("*")
      .eq("user_id", userId)
      .gte("session_date", startStr)
      .order("session_date", { ascending: true });
    if (error || !data?.length) return;

    const local = await getSessions(scope);
    const seen = new Set(
      local.map((s) => s.serverId).filter(Boolean) as string[]
    );
    for (const row of data as {
      id: string;
      session_date: string;
      duration_sec: number;
      mode: MeditationSession["mode"];
      pattern: string | null;
      chakra_label: string | null;
    }[]) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      local.push({
        id: row.id,
        serverId: row.id,
        date: row.session_date,
        durationSec: row.duration_sec,
        mode: row.mode,
        pattern: row.pattern ?? undefined,
        chakra: row.chakra_label ?? undefined,
      });
    }
    local.sort(
      (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
    );
    await persistSessions(scope, local);
  } catch {
    /* offline / table missing */
  }
}

export async function saveSession(
  durationSec: number,
  mode: MeditationSession["mode"],
  pattern: string | undefined,
  chakra: string | undefined,
  userId: string | undefined,
  isGuest: boolean
): Promise<void> {
  const scope = dataStorageScope(isGuest, userId);
  const sessions = await getSessions(scope);
  const localId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const entry: MeditationSession = {
    id: localId,
    date: dateKey(new Date()),
    durationSec,
    mode,
    pattern,
    chakra,
  };
  sessions.push(entry);
  await persistSessions(scope, sessions);

  if (supabaseConfigured && userId && !isGuest) {
    try {
      const { data, error } = await supabase
        .from("meditation_sessions")
        .insert({
          user_id: userId,
          session_date: entry.date,
          duration_sec: durationSec,
          mode,
          pattern: pattern ?? null,
          chakra_label: chakra ?? null,
        })
        .select("id")
        .single();
      if (!error && data?.id) {
        entry.serverId = data.id as string;
        entry.id = data.id as string;
        await persistSessions(scope, sessions);
      }
    } catch {
      /* keep local only */
    }
  }
}

export async function getTodaySessionCount(scope: string): Promise<number> {
  const today = dateKey(new Date());
  const sessions = await getSessions(scope);
  return sessions.filter((s) => s.date === today).length;
}

/** Sum of all session lengths today (seconds). */
export async function getTodayTotalMeditationSeconds(
  scope: string
): Promise<number> {
  const today = dateKey(new Date());
  const sessions = await getSessions(scope);
  return sessions
    .filter((s) => s.date === today)
    .reduce((sum, s) => sum + s.durationSec, 0);
}

/** Home dashboard hides the meditation CTA once today reaches this (10 min). */
export const HOME_MEDITATION_GOAL_SEC = 600;

export async function getWeekMinutes(scope: string): Promise<DayMinutes[]> {
  const sessions = await getSessions(scope);
  const now = new Date();
  const days: DayMinutes[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = dateKey(d);
    const dayTotal = sessions
      .filter((s) => s.date === key)
      .reduce((sum, s) => sum + s.durationSec, 0);
    days.push({ date: key, minutes: Math.round(dayTotal / 60) });
  }
  return days;
}

export async function getTotalMinutesThisWeek(scope: string): Promise<number> {
  const week = await getWeekMinutes(scope);
  return week.reduce((sum, d) => sum + d.minutes, 0);
}

/** Every calendar day in the current month → total minutes that day */
export async function getMonthMinutes(scope: string): Promise<DayMinutes[]> {
  const sessions = await getSessions(scope);
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const out: DayMinutes[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const sec = sessions
      .filter((s) => s.date === key)
      .reduce((sum, s) => sum + s.durationSec, 0);
    out.push({ date: key, minutes: Math.round(sec / 60) });
  }
  return out;
}

export async function getTotalMinutesThisMonth(scope: string): Promise<number> {
  const month = await getMonthMinutes(scope);
  return month.reduce((sum, d) => sum + d.minutes, 0);
}

export async function getDaysActiveThisMonth(scope: string): Promise<number> {
  const month = await getMonthMinutes(scope);
  return month.filter((d) => d.minutes > 0).length;
}

export async function getStreak(scope: string): Promise<number> {
  const sessions = await getSessions(scope);
  const sessionDates = new Set(sessions.map((s) => s.date));
  let streak = 0;
  const d = new Date();

  while (true) {
    const key = dateKey(d);
    if (sessionDates.has(key)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const now = new Date();
  if (dateStr === dateKey(now)) return "Today";

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateStr === dateKey(yesterday)) return "Yday";

  return d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3);
}

/** "Mar 2026" for chart title */
export function getCurrentMonthTitle(): string {
  const now = new Date();
  return now.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}
