import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { logSupabaseError } from "../lib/supabaseError";  
import { dataStorageScope, randomUuidV4 } from "../lib/dataStorageScope";


export interface Habit {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  archived: boolean;
  created_at: string;
}

export interface HabitLog {
  habit_id: string;
  date: string;
}

/** Calendar day as YYYY-MM-DD (matches UI `todayStr` and Postgres DATE). */
export function normalizeHabitLogDate(raw: string): string {
  if (typeof raw !== "string" || !raw.trim()) return "";
  const s = raw.trim();
  if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const ms = Date.parse(s);
  if (!Number.isNaN(ms)) {
    const d = new Date(ms);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return s;
}

function normalizeHabitLog(log: HabitLog): HabitLog {
  return {
    habit_id: log.habit_id,
    date: normalizeHabitLogDate(log.date),
  };
}

/** Union remote + local-only rows so a fetch never drops optimistic toggles before Supabase catches up. */
function mergeHabitLogs(local: HabitLog[], remote: HabitLog[]): HabitLog[] {
  const map = new Map<string, HabitLog>();
  const put = (l: HabitLog) => {
    const n = normalizeHabitLog(l);
    if (!n.date) return;
    map.set(`${n.habit_id}|${n.date}`, n);
  };
  for (const l of remote) put(l);
  for (const l of local) {
    const n = normalizeHabitLog(l);
    if (!n.date) continue;
    const k = `${n.habit_id}|${n.date}`;
    if (!map.has(k)) put(l);
  }
  return Array.from(map.values());
}

const LEGACY_HABITS = "HABITS_V2";
const LEGACY_LOGS = "HABIT_LOGS_V2";
const HABITS_PREFIX = "HABITS_V3";
const LOGS_PREFIX = "HABIT_LOGS_V3";

function habitsKey(scope: string): string {
  return `${HABITS_PREFIX}__${scope}`;
}

function logsKey(scope: string): string {
  return `${LOGS_PREFIX}__${scope}`;
}

async function migrateLegacy(scope: string): Promise<void> {
  const hk = habitsKey(scope);
  const lk = logsKey(scope);
  if ((await AsyncStorage.getItem(hk)) == null) {
    const leg = await AsyncStorage.getItem(LEGACY_HABITS);
    if (leg) {
      await AsyncStorage.setItem(hk, leg);
      await AsyncStorage.removeItem(LEGACY_HABITS);
    }
  }
  if ((await AsyncStorage.getItem(lk)) == null) {
    const leg = await AsyncStorage.getItem(LEGACY_LOGS);
    if (leg) {
      await AsyncStorage.setItem(lk, leg);
      await AsyncStorage.removeItem(LEGACY_LOGS);
    }
  }
}

const getLocalHabits = async (scope: string): Promise<Habit[]> => {
  await migrateLegacy(scope);
  const raw = await AsyncStorage.getItem(habitsKey(scope));
  return raw ? JSON.parse(raw) : [];
};

const saveLocalHabits = async (scope: string, h: Habit[]) => {
  await AsyncStorage.setItem(habitsKey(scope), JSON.stringify(h));
};

const getLocalLogs = async (scope: string): Promise<HabitLog[]> => {
  await migrateLegacy(scope);
  const raw = await AsyncStorage.getItem(logsKey(scope));
  return raw ? JSON.parse(raw) : [];
};

const saveLocalLogs = async (scope: string, l: HabitLog[]) => {
  await AsyncStorage.setItem(logsKey(scope), JSON.stringify(l));
};

export const fetchHabits = async (
  userId: string | undefined,
  isGuest: boolean
): Promise<Habit[]> => {
  const scope = dataStorageScope(isGuest, userId);

  if (supabaseConfigured && userId && !isGuest) {
    try {
      const { data, error } = await supabase
        .from("habits")
        .select("*")
        .eq("user_id", userId)
        .eq("archived", false)
        .order("created_at", { ascending: true });
      if (!error && data) {
        const remote = data as Habit[];
        const local = await getLocalHabits(scope);
        const rids = new Set(remote.map((h) => h.id));
        const pending = local.filter((h) => !rids.has(h.id));
        await saveLocalHabits(scope, [...remote, ...pending]);
        return [...remote, ...pending].filter((h) => !h.archived);
      }
      logSupabaseError("habits.select", error);
    } catch {
      /* local */
    }
  }

  return (await getLocalHabits(scope)).filter((h) => !h.archived);
};

export const createHabit = async (
  habit: Omit<Habit, "id" | "created_at" | "archived">,
  userId: string | undefined,
  isGuest: boolean
): Promise<Habit> => {
  const scope = dataStorageScope(isGuest, userId);
  const newH: Habit = {
    ...habit,
    id: randomUuidV4(),
    archived: false,
    created_at: new Date().toISOString(),
  };

  const all = await getLocalHabits(scope);
  all.push(newH);
  await saveLocalHabits(scope, all);

  if (supabaseConfigured && userId && !isGuest) {
    const { error } = await supabase
      .from("habits")
      .insert({ ...newH, user_id: userId });
    logSupabaseError("habits.insert", error);
  }
  return newH;
};

export const updateHabit = async (
  id: string,
  updates: Partial<Habit>,
  userId: string | undefined,
  isGuest: boolean
): Promise<void> => {
  const scope = dataStorageScope(isGuest, userId);
  const all = await getLocalHabits(scope);
  const idx = all.findIndex((h) => h.id === id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...updates };
    await saveLocalHabits(scope, all);
  }

  if (supabaseConfigured && userId && !isGuest) {
    const { error } = await supabase
      .from("habits")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId);
    logSupabaseError("habits.update", error);
  }
};

export const deleteHabit = async (
  id: string,
  userId: string | undefined,
  isGuest: boolean
): Promise<void> => {
  const scope = dataStorageScope(isGuest, userId);
  const all = await getLocalHabits(scope);
  await saveLocalHabits(
    scope,
    all.filter((h) => h.id !== id)
  );
  const logs = await getLocalLogs(scope);
  await saveLocalLogs(
    scope,
    logs.filter((l) => l.habit_id !== id)
  );

  if (supabaseConfigured && userId && !isGuest) {
    const { error: e1 } = await supabase
      .from("habits")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    logSupabaseError("habits.delete", e1);
    const { error: e2 } = await supabase
      .from("habit_logs")
      .delete()
      .eq("habit_id", id)
      .eq("user_id", userId);
    logSupabaseError("habit_logs.delete_for_habit", e2);
  }
};

export const fetchLogs = async (
  habitId: string,
  userId: string | undefined,
  isGuest: boolean
): Promise<Set<string>> => {
  const scope = dataStorageScope(isGuest, userId);
  if (supabaseConfigured && userId && !isGuest) {
    try {
      const { data, error } = await supabase
        .from("habit_logs")
        .select("date")
        .eq("habit_id", habitId)
        .eq("user_id", userId);
      if (!error && data)
        return new Set(data.map((r: { date: string }) => r.date));
      logSupabaseError("habit_logs.select_dates", error);
    } catch {
      /* local */
    }
  }
  const logs = await getLocalLogs(scope);
  return new Set(
    logs.filter((l) => l.habit_id === habitId).map((l) => l.date)
  );
};

export const fetchAllLogs = async (
  userId: string | undefined,
  isGuest: boolean
): Promise<HabitLog[]> => {
  const scope = dataStorageScope(isGuest, userId);
  const localRaw = await getLocalLogs(scope);
  const local = localRaw.map(normalizeHabitLog);

  if (supabaseConfigured && userId && !isGuest) {
    try {
      const { data, error } = await supabase
        .from("habit_logs")
        .select("habit_id, date")
        .eq("user_id", userId);
      if (!error && data) {
        const remote = (data as HabitLog[]).map(normalizeHabitLog);
        const merged = mergeHabitLogs(local, remote);
        await saveLocalLogs(scope, merged);
        return merged;
      }
      logSupabaseError("habit_logs.select_all", error);
    } catch {
      /* local */
    }
  }
  await saveLocalLogs(scope, local);
  return local;
};

export const toggleLog = async (
  habitId: string,
  date: string,
  userId: string | undefined,
  isGuest: boolean
): Promise<boolean> => {
  const scope = dataStorageScope(isGuest, userId);
  const day = normalizeHabitLogDate(date);
  const logs = (await getLocalLogs(scope)).map(normalizeHabitLog);
  const idx = logs.findIndex(
    (l) => l.habit_id === habitId && l.date === day
  );
  let added: boolean;
  if (idx >= 0) {
    logs.splice(idx, 1);
    added = false;
  } else {
    logs.push({ habit_id: habitId, date: day });
    added = true;
  }
  await saveLocalLogs(scope, logs);

  if (supabaseConfigured && userId && !isGuest) {
    if (!added) {
      const { error: delErr } = await supabase
        .from("habit_logs")
        .delete()
        .eq("habit_id", habitId)
        .eq("date", day)
        .eq("user_id", userId);
      logSupabaseError("habit_logs.delete_toggle", delErr);
    } else {
      const { error: upErr } = await supabase.from("habit_logs").upsert(
        {
          habit_id: habitId,
          user_id: userId,
          date: day,
        },
        { onConflict: "habit_id,date" }
      );
      logSupabaseError("habit_logs.upsert_toggle", upErr);
    }
  }
  return added;
};
