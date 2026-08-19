import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  useNavigation,
  useRoute,
  useFocusEffect,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from "react-native-draggable-flatlist";
import { useAppTheme } from "../../../contexts/ThemeContext";
import { useAuth } from "../../../contexts/AuthContext";
import MenuButton from "../../../components/MenuButton";
import RoutineProgressRing from "../components/RoutineProgressRing";
import RoutineTimelineItem from "../components/RoutineTimelineItem";
import RoutineCompletionOverlay from "../components/RoutineCompletionOverlay";
import { routineTypeLabel } from "../routineLabels";
import {
  computeRoutineStreak,
  createRoutine,
  fetchRoutines,
  fmtRoutineDate,
  getMorningRoutineWeekStats,
  loadRoutineSession,
  markRoutineLogStarted,
  reorderRoutineItems,
  toggleRoutineItemCompletion,
} from "../services/routineService";
import type {
  RoutineSession,
  RoutineSessionItem,
  RoutineStackParamList,
  RoutineWeekDayStat,
} from "../types";

type Nav = NativeStackNavigationProp<RoutineStackParamList, "RoutineToday">;
type RRoute = RouteProp<RoutineStackParamList, "RoutineToday">;

const SUBTITLES: Record<string, string> = {
  morning:
    "A gentle start to your day, cultivating presence and intention through every breath.",
  afternoon:
    "A mindful pause to recenter, recharge, and carry clarity into the rest of your day.",
  evening:
    "A peaceful close to your day, releasing tension and welcoming restful stillness.",
  custom:
    "A purposeful ritual to nurture your well-being and bring harmony to your day.",
};

const TodayRoutineScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RRoute>();
  const { user, isGuest, loading: authLoading } = useAuth();
  const userId = user?.id;

  const paramRoutineId = route.params?.routineId;

  const [loading, setLoading] = useState(true);
  const [routineId, setRoutineId] = useState<string | null>(paramRoutineId ?? null);
  const [session, setSession] = useState<RoutineSession | null>(null);
  const [streak, setStreak] = useState(0);
  const [weekStats, setWeekStats] = useState<RoutineWeekDayStat[]>([]);
  const [celebrate, setCelebrate] = useState(false);
  const celebratedLogId = useRef<string | null>(null);

  const loadSession = useCallback(
    async (rid: string) => {
      const dayStr = fmtRoutineDate(new Date());
      setLoading(true);
      try {
        const s = await loadRoutineSession(rid, dayStr, userId, isGuest);
        setSession(s);
        if (s) {
          const st = await computeRoutineStreak(rid, userId, isGuest);
          setStreak(st);
        }
        const w = await getMorningRoutineWeekStats(rid, userId, isGuest);
        setWeekStats(w);
      } finally {
        setLoading(false);
      }
    },
    [userId, isGuest]
  );

  /** Always load from storage for the current account — never run before auth is ready (avoids wrong scope). */
  const resolveAndLoad = useCallback(async () => {
    try {
      if (paramRoutineId) {
        setRoutineId(paramRoutineId);
        await loadSession(paramRoutineId);
        return;
      }
      const routines = await fetchRoutines(userId, isGuest);
      const morning = routines.find((r) => r.routine_type === "morning");
      if (morning) {
        setRoutineId(morning.id);
        await loadSession(morning.id);
      } else {
        const created = await createRoutine(
          {
            name: "Morning Routine",
            routine_type: "morning",
            icon: "sunny-outline",
            color: "#5B7553",
          },
          userId,
          isGuest
        );
        setRoutineId(created.id);
        await loadSession(created.id);
      }
    } catch {
      setLoading(false);
    }
  }, [paramRoutineId, userId, isGuest, loadSession]);

  useEffect(() => {
    if (authLoading) return;
    void resolveAndLoad();
  }, [authLoading, paramRoutineId, userId, isGuest, resolveAndLoad]);

  useFocusEffect(
    useCallback(() => {
      const rid = paramRoutineId ?? routineId;
      if (rid) void loadSession(rid);
    }, [paramRoutineId, routineId, loadSession])
  );

  useEffect(() => {
    if (
      session?.log.id &&
      session.mandatoryComplete &&
      session.allTotal > 0
    ) {
      if (celebratedLogId.current !== session.log.id) {
        celebratedLogId.current = session.log.id;
        setCelebrate(true);
      }
    } else {
      celebratedLogId.current = null;
    }
  }, [session?.log.id, session?.mandatoryComplete, session?.allTotal]);

  useEffect(() => {
    if (session?.log.id && !session.log.started_at) {
      void (async () => {
        await markRoutineLogStarted(session.log.id, userId, isGuest);
      })();
    }
  }, [session?.log.id, session?.log.started_at, userId, isGuest]);

  const feedback = useMemo(() => {
    if (!session) return "";
    if (session.allTotal === 0) {
      return "No steps yet \u2014 tap edit to add your morning steps.";
    }
    const left = Math.max(0, session.mandatoryTotal - session.mandatoryDone);
    if (session.mandatoryComplete) return "You\u2019re all set for today";
    if (left === 1) return "Only 1 step left \u2014 finish strong";
    if (left <= 3) return `Only ${left} steps left`;
    return "You\u2019re doing great \u2014 keep the rhythm";
  }, [session]);

  const { pct, done, total } = useMemo(() => {
    if (!session || session.mandatoryTotal === 0) return { pct: 0, done: 0, total: 0 };
    return {
      pct: Math.min(100, Math.round((session.mandatoryDone / session.mandatoryTotal) * 100)),
      done: session.mandatoryDone,
      total: session.mandatoryTotal,
    };
  }, [session]);

  const onDragEndList = useCallback(
    async ({ data }: { data: RoutineSessionItem[] }) => {
      const rid = paramRoutineId ?? routineId;
      if (!rid) return;
      await reorderRoutineItems(rid, data.map((i) => i.id), userId, isGuest);
      await loadSession(rid);
    },
    [paramRoutineId, routineId, userId, isGuest, loadSession]
  );

  const toggleItem = useCallback(
    async (itemId: string) => {
      if (!session) return;
      const rid = paramRoutineId ?? routineId;
      if (!rid) return;
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
      const st = await computeRoutineStreak(rid, userId, isGuest);
      setStreak(st);
      setWeekStats(await getMorningRoutineWeekStats(rid, userId, isGuest));
    },
    [session, paramRoutineId, routineId, userId, isGuest]
  );

  const accent = session?.routine.color ?? colors.primary;
  const trackRing = isDark ? "rgba(255,255,255,0.12)" : accent + "22";

  if (authLoading) {
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <MenuButton />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (loading && !session) {
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <MenuButton />
        <ActivityIndicator size="large" color={accent} />
      </View>
    );
  }

  if (!session) {
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <MenuButton />
        <Text style={{ color: colors.textSecondary }}>Routine not found.</Text>
        <Pressable onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
          <Text style={{ color: accent, fontWeight: "800" }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const routineType = session.routine.routine_type;
  const subtitle = SUBTITLES[routineType] ?? SUBTITLES.custom;
  const isComplete = session.mandatoryComplete && session.allTotal > 0;
  const todayStr = fmtRoutineDate(new Date());

  const header = (
    <View style={{ paddingBottom: 8 }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() =>
            navigation.navigate("RoutineEditor", {
              routineId: session.routine.id,
            })
          }
          hitSlop={10}
          style={[
            styles.iconBtn,
            {
              backgroundColor: isDark
                ? "rgba(255,255,255,0.08)"
                : "rgba(91,117,83,0.1)",
            },
          ]}
        >
          <Ionicons name="create-outline" size={22} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.headingSection}>
        <Text style={[styles.heading, { color: colors.text }]}>
          {routineTypeLabel(routineType)}
          {"\n"}Routine
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {subtitle}
        </Text>
      </View>

      <View style={styles.progressSection}>
        <RoutineProgressRing
          progress={total > 0 ? done / total : 0}
          color={accent}
          trackColor={trackRing}
          label={`${pct}%`}
          sublabel="COMPLETE"
          metaColor={colors.textMuted}
        />

        {isComplete ? (
          <View style={styles.completeBadge}>
            <View
              style={[styles.checkCircle, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="checkmark" size={22} color="#fff" />
            </View>
            <Text
              style={[styles.congratsText, { color: colors.textSecondary }]}
            >
              Well done. You've grounded yourself for the day ahead.
            </Text>
          </View>
        ) : (
          <View style={styles.statsSection}>
            <Text style={[styles.eta, { color: colors.text }]}>
              ~{session.minutesRemaining} min left
            </Text>
            <Text style={[styles.feedback, { color: colors.textSecondary }]}>
              {feedback}
            </Text>
          </View>
        )}

        <View style={styles.streakPill}>
          <Ionicons name="trophy-outline" size={16} color={accent} />
          <Text style={[styles.streakTxt, { color: colors.textSecondary }]}>
            {streak} day streak
          </Text>
        </View>

        {weekStats.length > 0 && (
          <View style={styles.weekSection}>
            <Text
              style={[styles.weekTitle, { color: colors.textMuted }]}
            >
              This week
            </Text>
            <View style={styles.weekRow}>
              {weekStats.map((d) => {
                const isFuture = d.dateStr > todayStr;
                return (
                  <View key={d.dateStr} style={styles.weekDayCol}>
                    <Text
                      style={[
                        styles.weekDayLbl,
                        {
                          color: d.isToday ? accent : colors.textMuted,
                          fontWeight: d.isToday ? "800" : "600",
                        },
                      ]}
                    >
                      {d.shortLabel}
                    </Text>
                    <View
                      style={[
                        styles.weekCell,
                        {
                          borderColor: d.completed
                            ? accent
                            : isFuture
                              ? colors.border
                              : colors.textMuted + "55",
                          backgroundColor: d.completed ? accent : "transparent",
                          opacity: isFuture ? 0.35 : 1,
                        },
                      ]}
                    >
                      {d.completed ? (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      ) : d.started && !isFuture ? (
                        <View
                          style={[
                            styles.weekPartialDot,
                            { backgroundColor: accent + "99" },
                          ]}
                        />
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </View>

      {session.items.length > 0 && (
        <Text
          style={[
            styles.sectionLbl,
            { color: colors.textSecondary, marginTop: 24, marginBottom: 6 },
          ]}
        >
          Long-press \u21C5 on the right to reorder steps
        </Text>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <MenuButton />
      <DraggableFlatList
        data={session.items}
        keyExtractor={(i) => i.id}
        onDragEnd={onDragEndList}
        activationDistance={12}
        ListHeaderComponent={header}
        contentContainerStyle={{
          paddingTop: 0,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 16,
        }}
        renderItem={({
          item,
          drag,
          isActive,
        }: RenderItemParams<RoutineSessionItem>) => (
          <ScaleDecorator>
            <RoutineTimelineItem
              item={item}
              accent={accent}
              isDark={isDark}
              onToggle={() => toggleItem(item.id)}
              drag={drag}
              isActive={isActive}
            />
          </ScaleDecorator>
        )}
        ListEmptyComponent={
          <View
            style={{ paddingTop: 8, paddingBottom: 28, alignItems: "center" }}
          >
            <Text
              style={{
                color: colors.textSecondary,
                textAlign: "center",
                fontWeight: "600",
                fontSize: 15,
                lineHeight: 22,
                paddingHorizontal: 12,
              }}
            >
              No steps yet. Tap the edit button above to add your morning routine steps.
            </Text>
            <Pressable
              onPress={() =>
                navigation.navigate("RoutineEditor", {
                  routineId: session.routine.id,
                })
              }
              style={{
                marginTop: 16,
                paddingVertical: 10,
                paddingHorizontal: 16,
              }}
            >
              <Text
                style={{ color: accent, fontWeight: "800", fontSize: 16 }}
              >
                Edit routine
              </Text>
            </Pressable>
          </View>
        }
      />

      <RoutineCompletionOverlay
        visible={
          celebrate && session.mandatoryComplete && session.allTotal > 0
        }
        routineName={session.routine.name}
        accent={accent}
        streak={streak}
        log={session.log}
        onClose={() => setCelebrate(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    paddingLeft: 42,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  headingSection: {
    marginTop: 4,
    marginBottom: 28,
    paddingLeft: 26,
  },
  heading: {
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: -0.5,
    lineHeight: 44,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 22,
    marginTop: 12,
  },
  progressSection: {
    alignItems: "center",
    marginBottom: 8,
  },
  completeBadge: {
    alignItems: "center",
    marginTop: 16,
  },
  checkCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  congratsText: {
    fontSize: 15,
    fontStyle: "italic",
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  statsSection: {
    alignItems: "center",
    marginTop: 14,
  },
  eta: {
    fontSize: 18,
    fontWeight: "800",
  },
  feedback: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
    textAlign: "center",
    lineHeight: 20,
  },
  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
  },
  streakTxt: { fontSize: 13, fontWeight: "700" },
  weekSection: {
    marginTop: 20,
    width: "100%",
    paddingHorizontal: 8,
  },
  weekTitle: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 10,
    textAlign: "center",
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  weekDayCol: { alignItems: "center", flex: 1 },
  weekDayLbl: { fontSize: 10, marginBottom: 6 },
  weekCell: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  weekPartialDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionLbl: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
});

export default TodayRoutineScreen;
