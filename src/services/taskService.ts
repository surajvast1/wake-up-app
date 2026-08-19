import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { logSupabaseError } from "../lib/supabaseError";
import { dataStorageScope, randomUuidV4 } from "../lib/dataStorageScope";

export interface Task {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  priority: "low" | "medium" | "high";
  completed: boolean;
  created_at: string;
}

const LEGACY_KEY = "TASKS_V2";
const STORAGE_PREFIX = "TASKS_V3";

function storageKey(scope: string): string {
  return `${STORAGE_PREFIX}__${scope}`;
}

async function migrateLegacyTasks(scope: string): Promise<void> {
  const k = storageKey(scope);
  if ((await AsyncStorage.getItem(k)) != null) return;
  const leg = await AsyncStorage.getItem(LEGACY_KEY);
  if (leg) {
    await AsyncStorage.setItem(k, leg);
    await AsyncStorage.removeItem(LEGACY_KEY);
  }
}

const getLocal = async (scope: string): Promise<Task[]> => {
  await migrateLegacyTasks(scope);
  const raw = await AsyncStorage.getItem(storageKey(scope));
  return raw ? JSON.parse(raw) : [];
};

const saveLocal = async (scope: string, tasks: Task[]) => {
  await AsyncStorage.setItem(storageKey(scope), JSON.stringify(tasks));
};

export const fetchTasksByDate = async (
  date: string,
  userId: string | undefined,
  isGuest: boolean
): Promise<Task[]> => {
  const scope = dataStorageScope(isGuest, userId);

  if (supabaseConfigured && userId && !isGuest) {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", userId)
        .eq("date", date)
        .order("time", { ascending: true, nullsFirst: false });
      if (!error && data) {
        const remote = data as Task[];
        const allLocal = await getLocal(scope);
        const other = allLocal.filter((t) => t.date !== date);
        await saveLocal(scope, [...other, ...remote]);
        return [...remote].sort((a, b) =>
          (a.time || "").localeCompare(b.time || "")
        );
      }
      logSupabaseError("tasks.select_by_date", error);
    } catch {
      /* use local */
    }
  }

  const all = await getLocal(scope);
  return all
    .filter((t) => t.date === date)
    .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
};

export const createTask = async (
  task: Omit<Task, "id" | "created_at">,
  userId: string | undefined,
  isGuest: boolean
): Promise<Task> => {
  const scope = dataStorageScope(isGuest, userId);
  const newTask: Task = {
    ...task,
    id: randomUuidV4(),
    created_at: new Date().toISOString(),
  };

  const all = await getLocal(scope);
  all.push(newTask);
  await saveLocal(scope, all);

  if (supabaseConfigured && userId && !isGuest) {
    const { error } = await supabase
      .from("tasks")
      .insert({ ...newTask, user_id: userId });
    logSupabaseError("tasks.insert", error);
  }
  return newTask;
};

export const updateTask = async (
  id: string,
  updates: Partial<Task>,
  userId: string | undefined,
  isGuest: boolean
): Promise<void> => {
  const scope = dataStorageScope(isGuest, userId);
  const all = await getLocal(scope);
  const idx = all.findIndex((t) => t.id === id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...updates };
    await saveLocal(scope, all);
  }

  if (supabaseConfigured && userId && !isGuest) {
    const { error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId);
    logSupabaseError("tasks.update", error);
  }
};

export const deleteTask = async (
  id: string,
  userId: string | undefined,
  isGuest: boolean
): Promise<void> => {
  const scope = dataStorageScope(isGuest, userId);
  const all = await getLocal(scope);
  await saveLocal(
    scope,
    all.filter((t) => t.id !== id)
  );

  if (supabaseConfigured && userId && !isGuest) {
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    logSupabaseError("tasks.delete", error);
  }
};

export const toggleComplete = async (
  id: string,
  completed: boolean,
  userId: string | undefined,
  isGuest: boolean
): Promise<void> => {
  await updateTask(id, { completed }, userId, isGuest);
};
