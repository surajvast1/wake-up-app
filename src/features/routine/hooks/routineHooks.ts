import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../../../contexts/AuthContext";
import type { Routine, RoutineSession } from "../types";
import {
  computeRoutineStreak,
  fetchAllRoutineItems,
  fetchRoutines,
  fmtRoutineDate,
  loadRoutineSession,
  markRoutineLogStarted,
  reorderRoutineItems,
  toggleRoutineItemCompletion,
} from "../services/routineService";

/** Widget + quick stats for home — morning routine only, visible only before noon */
export function useRoutineHomeWidget() {
  const { user, isGuest } = useAuth();
  const userId = user?.id;

  const [loading, setLoading] = useState(true);
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [session, setSession] = useState<RoutineSession | null>(null);

  const refresh = useCallback(async () => {
    const dayStr = fmtRoutineDate(new Date());
    setLoading(true);
    try {
      const routines = await fetchRoutines(userId, isGuest);
      const morning = routines.find((r) => r.routine_type === "morning") ?? null;
      if (!morning) {
        setRoutine(null);
        setSession(null);
        return;
      }
      const s = await loadRoutineSession(
        morning.id,
        dayStr,
        userId,
        isGuest
      );
      setRoutine(morning);
      setSession(s);
    } finally {
      setLoading(false);
    }
  }, [userId, isGuest]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const isMorning = new Date().getHours() < 12;

  const visible =
    isMorning &&
    !!routine &&
    !!session &&
    session.allTotal > 0 &&
    !session.mandatoryComplete;

  const remaining = session
    ? Math.max(0, session.mandatoryTotal - session.mandatoryDone)
    : 0;

  const quickToggleItem = useCallback(
    async (itemId: string) => {
      if (!routine || !session) return;
      const dayStr = fmtRoutineDate(new Date());
      const defs = session.items.map((i) => ({
        id: i.id,
        routine_id: i.routine_id,
        title: i.title,
        description: i.description,
        order_index: i.order_index,
        estimated_time: i.estimated_time,
        is_mandatory: i.is_mandatory,
      }));
      const next = await toggleRoutineItemCompletion(
        itemId,
        session.log.id,
        userId,
        isGuest,
        session.routine,
        defs,
        dayStr
      );
      setSession(next);
    },
    [routine, session, userId, isGuest]
  );

  return {
    loading,
    visible,
    routine,
    session,
    remaining,
    refresh,
    quickToggleItem,
    primaryLabel: routine?.name ?? "Routine",
    progressLabel: session
      ? `${session.mandatoryDone}/${session.mandatoryTotal}`
      : "0/0",
  };
}

/** Full session for today’s routine screen */
export function useTodayRoutineSession(routineId: string | undefined) {
  const { user, isGuest } = useAuth();
  const userId = user?.id;

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<RoutineSession | null>(null);
  const [streak, setStreak] = useState(0);

  const refresh = useCallback(async () => {
    if (!routineId) {
      setSession(null);
      setLoading(false);
      return;
    }
    const dayStr = fmtRoutineDate(new Date());
    setLoading(true);
    try {
      const s = await loadRoutineSession(
        routineId,
        dayStr,
        userId,
        isGuest
      );
      setSession(s);
      if (s) {
        const st = await computeRoutineStreak(routineId, userId, isGuest);
        setStreak(st);
      }
    } finally {
      setLoading(false);
    }
  }, [routineId, userId, isGuest]);

  useEffect(() => {
    if (routineId) void refresh();
  }, [routineId, refresh]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const toggleItem = useCallback(
    async (itemId: string) => {
      if (!session || !routineId) return;
      const dayStr = fmtRoutineDate(new Date());
      const next = await toggleRoutineItemCompletion(
        itemId,
        session.log.id,
        userId,
        isGuest,
        session.routine,
        session.items.map((i) => ({
          id: i.id,
          routine_id: i.routine_id,
          title: i.title,
          description: i.description,
          order_index: i.order_index,
          estimated_time: i.estimated_time,
          is_mandatory: i.is_mandatory,
        })),
        dayStr
      );
      setSession(next);
      const st = await computeRoutineStreak(routineId, userId, isGuest);
      setStreak(st);
    },
    [session, routineId, userId, isGuest]
  );

  const onDragEnd = useCallback(
    async (orderedIds: string[]) => {
      if (!routineId) return;
      await reorderRoutineItems(routineId, orderedIds, userId, isGuest);
      await refresh();
    },
    [routineId, userId, isGuest, refresh]
  );

  const markStarted = useCallback(async () => {
    if (!session?.log.id) return;
    await markRoutineLogStarted(session.log.id, userId, isGuest);
    await refresh();
  }, [session?.log.id, userId, isGuest, refresh]);

  return {
    loading,
    session,
    streak,
    refresh,
    toggleItem,
    onDragEnd,
    markStarted,
  };
}

/** Catalog for hub / editor */
export function useRoutinesCatalog() {
  const { user, isGuest } = useAuth();
  const userId = user?.id;
  const [loading, setLoading] = useState(true);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [items, setItems] = useState<
    import("../types").RoutineItem[]
  >([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [r, i] = await Promise.all([
        fetchRoutines(userId, isGuest),
        fetchAllRoutineItems(userId, isGuest),
      ]);
      setRoutines(r);
      setItems(i);
    } finally {
      setLoading(false);
    }
  }, [userId, isGuest]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  return { loading, routines, items, refresh };
}

export function useRoutineProgress(session: RoutineSession | null) {
  return useMemo(() => {
    if (!session || session.mandatoryTotal === 0) {
      return { pct: 0, done: 0, total: 0 };
    }
    return {
      pct: Math.min(
        100,
        Math.round((session.mandatoryDone / session.mandatoryTotal) * 100)
      ),
      done: session.mandatoryDone,
      total: session.mandatoryTotal,
    };
  }, [session]);
}

/** Spec names */
export { useRoutinesCatalog as useRoutine };
export { useTodayRoutineSession as useTodayRoutine };
