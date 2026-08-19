import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, supabaseConfigured } from "../../../lib/supabase";
import { logSupabaseError } from "../../../lib/supabaseError";
import {
  dataStorageScope,
  randomUuidV4,
} from "../../../lib/dataStorageScope";
import type {
  Routine,
  RoutineItem,
  RoutineLog,
  RoutineItemLog,
  RoutineSession,
  RoutineSessionItem,
  RoutineType,
  RoutineWeekDayStat,
} from "../types";

/** DB / legacy may still store `night`; app uses `evening`. */
export function normalizeRoutineType(raw: string | undefined | null): RoutineType {
  if (raw === "night") return "evening";
  if (
    raw === "morning" ||
    raw === "afternoon" ||
    raw === "evening" ||
    raw === "custom"
  ) {
    return raw;
  }
  return "custom";
}

function mapRoutineRow(r: Routine): Routine {
  return {
    ...r,
    routine_type: normalizeRoutineType(String(r.routine_type)),
  };
}

const PREFIX_R = "ROUTINE_V1__routines__";
const PREFIX_I = "ROUTINE_V1__items__";
const PREFIX_L = "ROUTINE_V1__logs__";
const PREFIX_IL = "ROUTINE_V1__item_logs__";

function keyR(scope: string) {
  return `${PREFIX_R}${scope}`;
}
function keyI(scope: string) {
  return `${PREFIX_I}${scope}`;
}
function keyL(scope: string) {
  return `${PREFIX_L}${scope}`;
}
function keyIL(scope: string) {
  return `${PREFIX_IL}${scope}`;
}

export function fmtRoutineDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function loadJson<T>(k: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function saveJson(k: string, v: unknown) {
  await AsyncStorage.setItem(k, JSON.stringify(v));
}

export function itemsForRoutine(
  all: RoutineItem[],
  routineId: string
): RoutineItem[] {
  return all
    .filter((i) => i.routine_id === routineId)
    .sort((a, b) => a.order_index - b.order_index);
}

function itemLogsForLog(
  all: RoutineItemLog[],
  logId: string
): RoutineItemLog[] {
  return all.filter((l) => l.routine_log_id === logId);
}

export function buildSession(
  routine: Routine,
  defs: RoutineItem[],
  log: RoutineLog,
  rawItemLogs: RoutineItemLog[]
): RoutineSession {
  const byItem = new Map<string, RoutineItemLog>();
  for (const il of rawItemLogs) {
    byItem.set(il.routine_item_id, il);
  }

  const items: RoutineSessionItem[] = defs.map((def) => {
    const il =
      byItem.get(def.id) ??
      ({
        id: "",
        routine_log_id: log.id,
        routine_item_id: def.id,
        completed: false,
        completed_at: null,
      } as RoutineItemLog);
    return {
      ...def,
      itemLogId: il.id,
      done: il.completed,
      completedAt: il.completed_at,
    };
  });

  const mandatory = items.filter((i) => i.is_mandatory);
  const effectiveRequired =
    mandatory.length > 0 ? mandatory : items;

  const mandatoryDone = effectiveRequired.filter((i) => i.done).length;
  const mandatoryTotal = effectiveRequired.length;

  const optionalItems = items.filter((i) => !i.is_mandatory);
  const optionalDone = optionalItems.filter((i) => i.done).length;
  const optionalTotal = optionalItems.length;

  const allDone = items.filter((i) => i.done).length;
  const allTotal = items.length;

  const minutesRemaining = items
    .filter((i) => !i.done)
    .reduce((s, i) => s + (i.estimated_time || 0), 0);

  const mandatoryComplete =
    mandatoryTotal === 0 ? true : mandatoryDone === mandatoryTotal;

  const completion_percentage =
    allTotal === 0 ? 0 : Math.round((allDone / allTotal) * 100);

  const isFullyComplete = allTotal > 0 && allDone === allTotal;

  return {
    routine,
    items,
    log: {
      ...log,
      completion_percentage,
      completed: mandatoryComplete,
    },
    mandatoryTotal,
    mandatoryDone,
    optionalTotal,
    optionalDone,
    allTotal,
    allDone,
    minutesRemaining,
    isFullyComplete,
    mandatoryComplete,
  };
}

export async function fetchRoutines(
  userId: string | undefined,
  isGuest: boolean
): Promise<Routine[]> {
  const scope = dataStorageScope(isGuest, userId);

  if (supabaseConfigured && userId && !isGuest) {
    try {
      const { data, error } = await supabase
        .from("routines")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      if (!error && data) {
        const remote = (data as Routine[]).map(mapRoutineRow);
        if (remote.length) {
          await saveJson(keyR(scope), remote);
          return remote;
        }
      }
      logSupabaseError("routines.select", error);
    } catch {
      /* local */
    }
  }

  const local = await loadJson<Routine[]>(keyR(scope), []);
  return local.map(mapRoutineRow);
}

export async function fetchAllRoutineItems(
  userId: string | undefined,
  isGuest: boolean
): Promise<RoutineItem[]> {
  const scope = dataStorageScope(isGuest, userId);

  if (supabaseConfigured && userId && !isGuest) {
    try {
      const { data: rws, error: e1 } = await supabase
        .from("routines")
        .select("id")
        .eq("user_id", userId);
      if (e1) {
        logSupabaseError("routines.ids_for_items", e1);
        return loadJson<RoutineItem[]>(keyI(scope), []);
      }
      if (!rws?.length) {
        return loadJson<RoutineItem[]>(keyI(scope), []);
      }
      const ids = rws.map((r: { id: string }) => r.id);
      const { data, error } = await supabase
        .from("routine_items")
        .select("*")
        .in("routine_id", ids)
        .order("order_index", { ascending: true });
      if (!error && data && data.length > 0) {
        await saveJson(keyI(scope), data as RoutineItem[]);
        return data as RoutineItem[];
      }
      logSupabaseError("routine_items.select", error);
    } catch {
      /* local */
    }
  }

  return loadJson<RoutineItem[]>(keyI(scope), []);
}

export async function fetchRoutineLogs(
  userId: string | undefined,
  isGuest: boolean
): Promise<RoutineLog[]> {
  const scope = dataStorageScope(isGuest, userId);

  if (supabaseConfigured && userId && !isGuest) {
    try {
      const { data, error } = await supabase
        .from("routine_logs")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false });
      if (!error && data && data.length > 0) {
        await saveJson(keyL(scope), data as RoutineLog[]);
        return data as RoutineLog[];
      }
      logSupabaseError("routine_logs.select", error);
    } catch {
      /* local */
    }
  }

  return loadJson<RoutineLog[]>(keyL(scope), []);
}

export async function fetchRoutineItemLogs(
  userId: string | undefined,
  isGuest: boolean
): Promise<RoutineItemLog[]> {
  const scope = dataStorageScope(isGuest, userId);

  if (supabaseConfigured && userId && !isGuest) {
    try {
      const { data: logs, error: e1 } = await supabase
        .from("routine_logs")
        .select("id")
        .eq("user_id", userId);
      if (e1) {
        logSupabaseError("routine_logs.ids_for_item_logs", e1);
        return loadJson<RoutineItemLog[]>(keyIL(scope), []);
      }
      if (!logs?.length) {
        return loadJson<RoutineItemLog[]>(keyIL(scope), []);
      }
      const logIds = logs.map((l: { id: string }) => l.id);
      const { data, error } = await supabase
        .from("routine_item_logs")
        .select("*")
        .in("routine_log_id", logIds);
      if (!error && data && data.length > 0) {
        await saveJson(keyIL(scope), data as RoutineItemLog[]);
        return data as RoutineItemLog[];
      }
      logSupabaseError("routine_item_logs.select", error);
    } catch {
      /* local */
    }
  }

  return loadJson<RoutineItemLog[]>(keyIL(scope), []);
}

/** No seeded templates — users create morning / afternoon / evening routines in the hub. */
export async function ensureDefaultMorningRoutine(
  _userId: string | undefined,
  _isGuest: boolean
): Promise<void> {
  return;
}

async function persistRoutines(
  scope: string,
  rows: Routine[],
  userId: string | undefined,
  isGuest: boolean
) {
  await saveJson(keyR(scope), rows);
  if (supabaseConfigured && userId && !isGuest) {
    /* caller handles granular sync */
  }
}

async function persistItems(
  scope: string,
  rows: RoutineItem[],
  userId: string | undefined,
  isGuest: boolean
) {
  await saveJson(keyI(scope), rows);
}

async function persistLogs(
  scope: string,
  rows: RoutineLog[],
  userId: string | undefined,
  isGuest: boolean
) {
  await saveJson(keyL(scope), rows);
}

async function persistItemLogs(
  scope: string,
  rows: RoutineItemLog[],
  userId: string | undefined,
  isGuest: boolean
) {
  await saveJson(keyIL(scope), rows);
}

export async function ensureTodayRoutineLog(
  routineId: string,
  userId: string | undefined,
  isGuest: boolean,
  dateStr: string
): Promise<{ log: RoutineLog; itemLogs: RoutineItemLog[] }> {
  const scope = dataStorageScope(isGuest, userId);
  let logs = await fetchRoutineLogs(userId, isGuest);
  let itemLogs = await fetchRoutineItemLogs(userId, isGuest);

  const existing = logs.find(
    (l) => l.routine_id === routineId && l.date === dateStr
  );
  if (existing) {
    const items = itemsForRoutine(
      await fetchAllRoutineItems(userId, isGuest),
      routineId
    );
    let forLog = itemLogsForLog(itemLogs, existing.id);
    const have = new Set(forLog.map((x) => x.routine_item_id));
    const missing = items.filter((it) => !have.has(it.id));
    if (missing.length > 0) {
      const newRows: RoutineItemLog[] = missing.map((it) => ({
        id: randomUuidV4(),
        routine_log_id: existing.id,
        routine_item_id: it.id,
        completed: false,
        completed_at: null,
      }));
      itemLogs = [...itemLogs, ...newRows];
      await persistItemLogs(scope, itemLogs, userId, isGuest);
      if (supabaseConfigured && userId && !isGuest) {
        const { error } = await supabase.from("routine_item_logs").insert(
          newRows.map((il) => ({
            id: il.id,
            routine_log_id: il.routine_log_id,
            routine_item_id: il.routine_item_id,
            completed: il.completed,
            completed_at: il.completed_at,
          }))
        );
        logSupabaseError("routine_item_logs.insert_missing", error);
      }
      forLog = itemLogsForLog(itemLogs, existing.id);
    }
    return {
      log: existing,
      itemLogs: forLog,
    };
  }

  const items = itemsForRoutine(
    await fetchAllRoutineItems(userId, isGuest),
    routineId
  );
  const logId = randomUuidV4();
  const now = new Date().toISOString();
  const log: RoutineLog = {
    id: logId,
    routine_id: routineId,
    user_id: userId ?? null,
    date: dateStr,
    completed: false,
    completion_percentage: 0,
    started_at: now,
    completed_at: null,
  };

  const newItemLogs: RoutineItemLog[] = items.map((it) => ({
    id: randomUuidV4(),
    routine_log_id: logId,
    routine_item_id: it.id,
    completed: false,
    completed_at: null,
  }));

  logs = [...logs, log];
  itemLogs = [...itemLogs, ...newItemLogs];
  await persistLogs(scope, logs, userId, isGuest);
  await persistItemLogs(scope, itemLogs, userId, isGuest);

  if (supabaseConfigured && userId && !isGuest) {
    const { error: logErr } = await supabase.from("routine_logs").insert({
      id: log.id,
      user_id: userId,
      routine_id: log.routine_id,
      date: log.date,
      completed: log.completed,
      completion_percentage: log.completion_percentage,
      started_at: log.started_at,
      completed_at: log.completed_at,
    });
    logSupabaseError("routine_logs.insert", logErr);
    if (newItemLogs.length) {
      const { error: ilErr } = await supabase.from("routine_item_logs").insert(
        newItemLogs.map((il) => ({
          id: il.id,
          routine_log_id: il.routine_log_id,
          routine_item_id: il.routine_item_id,
          completed: il.completed,
          completed_at: il.completed_at,
        }))
      );
      logSupabaseError("routine_item_logs.insert_new_log", ilErr);
    }
  }

  return { log, itemLogs: newItemLogs };
}

export async function loadRoutineSession(
  routineId: string,
  dateStr: string,
  userId: string | undefined,
  isGuest: boolean
): Promise<RoutineSession | null> {
  const routines = await fetchRoutines(userId, isGuest);
  const routine = routines.find((r) => r.id === routineId);
  if (!routine) return null;
  const defs = itemsForRoutine(
    await fetchAllRoutineItems(userId, isGuest),
    routineId
  );
  const { log, itemLogs } = await ensureTodayRoutineLog(
    routineId,
    userId,
    isGuest,
    dateStr
  );
  return buildSession(routine, defs, log, itemLogs);
}

export async function toggleRoutineItemCompletion(
  routineItemId: string,
  routineLogId: string,
  userId: string | undefined,
  isGuest: boolean,
  routine: Routine,
  defs: RoutineItem[],
  dateStr: string
): Promise<RoutineSession> {
  const scope = dataStorageScope(isGuest, userId);
  let logs = await fetchRoutineLogs(userId, isGuest);
  let itemLogs = await fetchRoutineItemLogs(userId, isGuest);

  let ilIdx = itemLogs.findIndex(
    (x) =>
      x.routine_log_id === routineLogId &&
      x.routine_item_id === routineItemId
  );
  if (ilIdx < 0) {
    await ensureTodayRoutineLog(routine.id, userId, isGuest, dateStr);
    itemLogs = await fetchRoutineItemLogs(userId, isGuest);
    ilIdx = itemLogs.findIndex(
      (x) =>
        x.routine_log_id === routineLogId &&
        x.routine_item_id === routineItemId
    );
  }
  if (ilIdx < 0) {
    await loadRoutineSession(routine.id, dateStr, userId, isGuest);
    itemLogs = await fetchRoutineItemLogs(userId, isGuest);
    ilIdx = itemLogs.findIndex(
      (x) =>
        x.routine_log_id === routineLogId &&
        x.routine_item_id === routineItemId
    );
  }
  if (ilIdx < 0) {
    const refreshed = await loadRoutineSession(
      routine.id,
      dateStr,
      userId,
      isGuest
    );
    return (
      refreshed ??
      buildSession(
        routine,
        defs,
        {
          id: routineLogId,
          routine_id: routine.id,
          user_id: userId ?? null,
          date: dateStr,
          completed: false,
          completion_percentage: 0,
          started_at: null,
          completed_at: null,
        },
        itemLogsForLog(itemLogs, routineLogId)
      )
    );
  }

  const row = { ...itemLogs[ilIdx] };
  const nextDone = !row.completed;
  row.completed = nextDone;
  row.completed_at = nextDone ? new Date().toISOString() : null;
  itemLogs[ilIdx] = row;

  const logIdx = logs.findIndex((l) => l.id === routineLogId);
  const log = logIdx >= 0 ? { ...logs[logIdx] } : null;
  if (!log) {
    await persistItemLogs(scope, itemLogs, userId, isGuest);
    const { log: lg, itemLogs: fresh } = await ensureTodayRoutineLog(
      routine.id,
      userId,
      isGuest,
      dateStr
    );
    return buildSession(routine, defs, lg, fresh);
  }

  const sessionDraft = buildSession(
    routine,
    defs,
    log,
    itemLogsForLog(itemLogs, routineLogId)
  );
  log.completion_percentage = sessionDraft.log.completion_percentage;
  log.completed = sessionDraft.mandatoryComplete;
  if (sessionDraft.mandatoryComplete && !log.completed_at) {
    log.completed_at = new Date().toISOString();
  }
  if (!sessionDraft.mandatoryComplete) {
    log.completed_at = null;
  }
  logs[logIdx] = log;

  await persistLogs(scope, logs, userId, isGuest);
  await persistItemLogs(scope, itemLogs, userId, isGuest);

  if (supabaseConfigured && userId && !isGuest) {
    const { error: e1 } = await supabase
      .from("routine_item_logs")
      .update({
        completed: row.completed,
        completed_at: row.completed_at,
      })
      .eq("id", row.id);
    logSupabaseError("routine_item_logs.update_toggle", e1);
    const { error: e2 } = await supabase
      .from("routine_logs")
      .update({
        completed: log.completed,
        completion_percentage: log.completion_percentage,
        completed_at: log.completed_at,
      })
      .eq("id", log.id)
      .eq("user_id", userId);
    logSupabaseError("routine_logs.update_toggle", e2);
  }

  return buildSession(
    routine,
    defs,
    log,
    itemLogsForLog(itemLogs, routineLogId)
  );
}

export async function markRoutineLogStarted(
  routineLogId: string,
  userId: string | undefined,
  isGuest: boolean
): Promise<void> {
  const scope = dataStorageScope(isGuest, userId);
  const logs = await fetchRoutineLogs(userId, isGuest);
  const idx = logs.findIndex((l) => l.id === routineLogId);
  if (idx < 0) return;
  if (logs[idx].started_at) return;
  const next = [...logs];
  next[idx] = { ...next[idx], started_at: new Date().toISOString() };
  await persistLogs(scope, next, userId, isGuest);
  if (supabaseConfigured && userId && !isGuest) {
    const { error } = await supabase
      .from("routine_logs")
      .update({ started_at: next[idx].started_at })
      .eq("id", routineLogId)
      .eq("user_id", userId);
    logSupabaseError("routine_logs.update_started", error);
  }
}

export async function reorderRoutineItems(
  routineId: string,
  orderedIds: string[],
  userId: string | undefined,
  isGuest: boolean
): Promise<RoutineItem[]> {
  const scope = dataStorageScope(isGuest, userId);
  const all = await fetchAllRoutineItems(userId, isGuest);
  const map = new Map(all.map((i) => [i.id, { ...i }]));
  orderedIds.forEach((id, order_index) => {
    const row = map.get(id);
    if (row && row.routine_id === routineId) {
      row.order_index = order_index;
    }
  });
  const next = all.map((i) => map.get(i.id) ?? i);
  await persistItems(scope, next, userId, isGuest);

  if (supabaseConfigured && userId && !isGuest) {
    for (const id of orderedIds) {
      const row = map.get(id);
      if (row && row.routine_id === routineId) {
        const { error } = await supabase
          .from("routine_items")
          .update({ order_index: row.order_index })
          .eq("id", id);
        logSupabaseError("routine_items.reorder", error);
      }
    }
  }

  return itemsForRoutine(next, routineId);
}

export async function computeRoutineStreak(
  routineId: string,
  userId: string | undefined,
  isGuest: boolean
): Promise<number> {
  const logs = await fetchRoutineLogs(userId, isGuest);
  const completedDates = new Set(
    logs
      .filter((l) => l.routine_id === routineId && l.completed)
      .map((l) => l.date)
  );
  let streak = 0;
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  while (true) {
    const key = fmtRoutineDate(d);
    if (completedDates.has(key)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return streak;
}

const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Mon–Sun of the current week (local). Completion comes from saved routine_logs only. */
export async function getMorningRoutineWeekStats(
  routineId: string,
  userId: string | undefined,
  isGuest: boolean
): Promise<RoutineWeekDayStat[]> {
  const logs = await fetchRoutineLogs(userId, isGuest);
  const byDate = new Map<string, RoutineLog>();
  for (const l of logs) {
    if (l.routine_id === routineId) byDate.set(l.date, l);
  }

  const now = new Date();
  const dow = now.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + mondayOffset
  );
  monday.setHours(12, 0, 0, 0);
  const todayStr = fmtRoutineDate(now);

  const out: RoutineWeekDayStat[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = fmtRoutineDate(d);
    const log = byDate.get(dateStr);
    out.push({
      dateStr,
      shortLabel: WEEKDAY_SHORT[i],
      isToday: dateStr === todayStr,
      completed: log?.completed ?? false,
      started: log?.started_at != null,
    });
  }
  return out;
}

export async function createRoutine(
  payload: {
    name: string;
    routine_type: RoutineType;
    icon: string;
    color: string;
  },
  userId: string | undefined,
  isGuest: boolean
): Promise<Routine> {
  const scope = dataStorageScope(isGuest, userId);
  const r: Routine = {
    id: randomUuidV4(),
    user_id: userId ?? null,
    name: payload.name,
    routine_type: payload.routine_type,
    icon: payload.icon,
    color: payload.color,
    created_at: new Date().toISOString(),
  };
  const all = await fetchRoutines(userId, isGuest);
  await persistRoutines(scope, [...all, r], userId, isGuest);

  if (supabaseConfigured && userId && !isGuest) {
    const { error } = await supabase.from("routines").insert({
      id: r.id,
      user_id: userId,
      name: r.name,
      routine_type: r.routine_type,
      icon: r.icon,
      color: r.color,
      created_at: r.created_at,
    });
    logSupabaseError("routines.insert", error);
  }
  return r;
}

export async function createRoutineItemRow(
  routineId: string,
  payload: {
    title: string;
    description: string;
    estimated_time: number;
    is_mandatory: boolean;
    /** When set, use this order; otherwise append at end */
    order_index?: number;
  },
  userId: string | undefined,
  isGuest: boolean
): Promise<RoutineItem> {
  const scope = dataStorageScope(isGuest, userId);
  const all = await fetchAllRoutineItems(userId, isGuest);
  const siblings = itemsForRoutine(all, routineId);
  const order_index =
    payload.order_index !== undefined
      ? payload.order_index
      : siblings.length;
  const item: RoutineItem = {
    id: randomUuidV4(),
    routine_id: routineId,
    title: payload.title,
    description: payload.description,
    order_index,
    estimated_time: payload.estimated_time,
    is_mandatory: payload.is_mandatory,
  };
  await persistItems(scope, [...all, item], userId, isGuest);

  if (supabaseConfigured && userId && !isGuest) {
    const { error } = await supabase.from("routine_items").insert({
      id: item.id,
      routine_id: item.routine_id,
      title: item.title,
      description: item.description,
      order_index: item.order_index,
      estimated_time: item.estimated_time,
      is_mandatory: item.is_mandatory,
    });
    logSupabaseError("routine_items.insert", error);
  }
  return item;
}

export async function updateRoutine(
  routineId: string,
  patch: Partial<Pick<Routine, "name" | "icon" | "color" | "routine_type">>,
  userId: string | undefined,
  isGuest: boolean
): Promise<void> {
  const scope = dataStorageScope(isGuest, userId);
  const all = await fetchRoutines(userId, isGuest);
  const idx = all.findIndex((r) => r.id === routineId);
  if (idx < 0) return;
  const next = [...all];
  next[idx] = { ...next[idx], ...patch };
  await persistRoutines(scope, next, userId, isGuest);

  if (supabaseConfigured && userId && !isGuest) {
    const { error } = await supabase
      .from("routines")
      .update(patch)
      .eq("id", routineId)
      .eq("user_id", userId);
    logSupabaseError("routines.update", error);
  }
}

export async function updateRoutineItemRow(
  itemId: string,
  patch: Partial<
    Pick<
      RoutineItem,
      "title" | "description" | "estimated_time" | "is_mandatory" | "order_index"
    >
  >,
  userId: string | undefined,
  isGuest: boolean
): Promise<void> {
  const scope = dataStorageScope(isGuest, userId);
  const all = await fetchAllRoutineItems(userId, isGuest);
  const idx = all.findIndex((i) => i.id === itemId);
  if (idx < 0) return;
  const next = [...all];
  next[idx] = { ...next[idx], ...patch };
  await persistItems(scope, next, userId, isGuest);

  if (supabaseConfigured && userId && !isGuest) {
    const { error } = await supabase
      .from("routine_items")
      .update(patch)
      .eq("id", itemId);
    logSupabaseError("routine_items.update", error);
  }
}

export async function deleteRoutineItem(
  itemId: string,
  userId: string | undefined,
  isGuest: boolean
): Promise<void> {
  const scope = dataStorageScope(isGuest, userId);
  const all = await fetchAllRoutineItems(userId, isGuest);
  const target = all.find((i) => i.id === itemId);
  if (!target) return;
  const next = all.filter((i) => i.id !== itemId);
  const reordered = itemsForRoutine(next, target.routine_id).map((it, oi) => ({
    ...it,
    order_index: oi,
  }));
  const merged = next
    .filter((i) => i.routine_id !== target.routine_id)
    .concat(reordered);
  await persistItems(scope, merged, userId, isGuest);

  if (supabaseConfigured && userId && !isGuest) {
    const { error: delErr } = await supabase
      .from("routine_items")
      .delete()
      .eq("id", itemId);
    logSupabaseError("routine_items.delete", delErr);
    for (const it of reordered) {
      const { error } = await supabase
        .from("routine_items")
        .update({ order_index: it.order_index })
        .eq("id", it.id);
      logSupabaseError("routine_items.reorder_after_delete", error);
    }
  }
}

export async function deleteRoutine(
  routineId: string,
  userId: string | undefined,
  isGuest: boolean
): Promise<void> {
  const scope = dataStorageScope(isGuest, userId);
  const routines = (await fetchRoutines(userId, isGuest)).filter(
    (r) => r.id !== routineId
  );
  const items = (await fetchAllRoutineItems(userId, isGuest)).filter(
    (i) => i.routine_id !== routineId
  );
  const allLogs = await fetchRoutineLogs(userId, isGuest);
  const logIds = allLogs
    .filter((l) => l.routine_id === routineId)
    .map((l) => l.id);
  const logs = allLogs.filter((l) => l.routine_id !== routineId);
  const itemLogs = (await fetchRoutineItemLogs(userId, isGuest)).filter(
    (il) => !logIds.includes(il.routine_log_id)
  );

  await persistRoutines(scope, routines, userId, isGuest);
  await persistItems(scope, items, userId, isGuest);
  await persistLogs(scope, logs, userId, isGuest);
  await persistItemLogs(scope, itemLogs, userId, isGuest);

  if (supabaseConfigured && userId && !isGuest) {
    if (logIds.length) {
      const { error: e0 } = await supabase
        .from("routine_item_logs")
        .delete()
        .in("routine_log_id", logIds);
      logSupabaseError("routine_item_logs.delete_bulk", e0);
    }
    const { error: e1 } = await supabase
      .from("routine_logs")
      .delete()
      .eq("routine_id", routineId)
      .eq("user_id", userId);
    logSupabaseError("routine_logs.delete_routine", e1);
    const { error: e2 } = await supabase
      .from("routine_items")
      .delete()
      .eq("routine_id", routineId);
    logSupabaseError("routine_items.delete_routine", e2);
    const { error: e3 } = await supabase
      .from("routines")
      .delete()
      .eq("id", routineId)
      .eq("user_id", userId);
    logSupabaseError("routines.delete", e3);
  }
}
