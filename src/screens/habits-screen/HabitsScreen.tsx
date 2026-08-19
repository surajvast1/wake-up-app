import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Dimensions,
  Alert,
  Animated,
  ActivityIndicator,
  Platform,
} from "react-native";
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  interpolateColor,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../../contexts/AuthContext";
import { useAppTheme } from "../../contexts/ThemeContext";
import { AppColors } from "../../theme/colors";
import MenuButton from "../../components/MenuButton";
import {
  Habit,
  HabitLog,
  fetchHabits,
  fetchAllLogs,
  createHabit,
  updateHabit,
  deleteHabit,
  toggleLog,
} from "../../services/habitService";
import {
  HabitGoal,
  HabitGoalTier,
  getBestStreak,
  getNextMilestone,
  getQuestProgress,
  getStageForStreak,
  isAtPersonalBest,
} from "../../lib/habitStreak";
import {
  loadHabitGoals,
  maybePromoteHabitGoal,
  setHabitGoal,
} from "../../services/habitGoalService";

const { width: SCREEN_W } = Dimensions.get("window");

/* ─── Habit palette (intentionally broad + not-default-green) ─── */

const COLORS = [
  "#EF4444", "#F97316", "#F59E0B", "#EAB308", "#84CC16",
  "#22C55E", "#10B981", "#14B8A6", "#06B6D4", "#0EA5E9",
  "#3B82F6", "#6366F1", "#8B5CF6", "#A855F7", "#D946EF",
  "#EC4899", "#F43F5E", "#64748B", "#1E293B", "#78716C",
];

const ICONS: (keyof typeof Ionicons.glyphMap)[] = [
  "fitness", "bicycle", "walk", "water", "book",
  "musical-notes", "code-slash", "brush", "camera", "leaf",
  "heart", "flask", "globe", "pizza", "cafe",
  "bed", "barbell", "football", "game-controller", "rocket",
  "sunny", "moon", "star", "flame", "fish",
  "paw", "pencil", "medkit", "nutrition", "body",
];

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/* ─── Date helpers ───────────────────────────────────── */

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Build a N-column heatmap grid ending at today (most recent week on the right). */
function buildRecentWeeks(weeksBack = 15): (string | null)[][] {
  const today = new Date();
  const dow = today.getDay();
  const thisMon = new Date(today);
  thisMon.setDate(today.getDate() - ((dow + 6) % 7));

  const weeks: (string | null)[][] = [];
  for (let w = weeksBack - 1; w >= 0; w--) {
    const start = new Date(thisMon);
    start.setDate(thisMon.getDate() - w * 7);
    const week: (string | null)[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      if (d > today) week.push(null);
      else week.push(fmtDate(d));
    }
    weeks.push(week);
  }
  return weeks;
}

function buildCurrentYearWeeks(): (string | null)[][] {
  const year = new Date().getFullYear();
  const jan1 = new Date(year, 0, 1);
  const dec31 = new Date(year, 11, 31);

  const weeks: (string | null)[][] = [];
  let week: (string | null)[] = [];

  const startDay = jan1.getDay();
  for (let i = 0; i < startDay; i++) week.push(null);

  for (let d = new Date(jan1); d <= dec31; d.setDate(d.getDate() + 1)) {
    week.push(fmtDate(new Date(d)));
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

function getStreak(logSet: Set<string>): number {
  let streak = 0;
  const d = new Date();
  if (!logSet.has(fmtDate(d))) {
    d.setDate(d.getDate() - 1);
  }
  while (logSet.has(fmtDate(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/** Consistency over the last 30 days (0–100). */
function getConsistencyPct(logSet: Set<string>): number {
  const today = new Date();
  let done = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (logSet.has(fmtDate(d))) done += 1;
  }
  return Math.round((done / 30) * 100);
}

/* ─── Themed (non-default) color palette for this page ─── */

interface HabitsPalette {
  pageGradient: [string, string, string];
  cardBg: string;
  cardBorder: string;
  cardShadow: string;
  bodyText: string;
  subtleText: string;
  mutedText: string;
  gridEmpty: string;
  streakBg: string;
  streakText: string;
  totalBg: string;
  totalText: string;
  consistencyText: string;
  accent: string;
  accentSoft: string;
  fabGradient: [string, string];
}

function buildHabitsPalette(isDark: boolean, c: AppColors): HabitsPalette {
  if (isDark) {
    return {
      pageGradient: ["#1A1224", "#241633", "#2A1A2E"],
      cardBg: "rgba(255,255,255,0.04)",
      cardBorder: "rgba(255,255,255,0.08)",
      cardShadow: "#000000",
      bodyText: "#F5F1FF",
      subtleText: "#C8BEE0",
      mutedText: "#8B80A6",
      gridEmpty: "rgba(255,255,255,0.06)",
      streakBg: "rgba(251,191,36,0.16)",
      streakText: "#FCD34D",
      totalBg: "rgba(167,139,250,0.16)",
      totalText: "#C4B5FD",
      consistencyText: "#C4B5FD",
      accent: "#A78BFA",
      accentSoft: "rgba(167,139,250,0.18)",
      fabGradient: ["#7C3AED", "#EC4899"],
    };
  }
  return {
    pageGradient: ["#FFF7EF", "#FCEFEF", "#F3ECFF"],
    cardBg: "#FFFFFF",
    cardBorder: "rgba(17,24,39,0.06)",
    cardShadow: "#0F0F23",
    bodyText: "#1F1A2E",
    subtleText: "#5A5468",
    mutedText: "#8B8397",
    gridEmpty: "#F1EDF7",
    streakBg: "#FFF4E0",
    streakText: "#B45309",
    totalBg: "#F0EAFE",
    totalText: "#6D28D9",
    consistencyText: "#6D28D9",
    accent: "#7C3AED",
    accentSoft: "rgba(124,58,237,0.12)",
    fabGradient: ["#7C3AED", "#EC4899"],
  };
}

/* ─── Styles ─────────────────────────────────────────── */

function createHabitStyles(c: AppColors, p: HabitsPalette) {
  return StyleSheet.create({
    container: { flex: 1 },

    listContent: { paddingHorizontal: 16, paddingBottom: 140, paddingTop: 8 },

    /* ── Habit Card ── */
    habitCard: {
      borderRadius: 24,
      paddingVertical: 18,
      paddingHorizontal: 18,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: p.cardBorder,
      backgroundColor: p.cardBg,
      ...Platform.select({
        ios: {
          shadowColor: p.cardShadow,
          shadowOpacity: 0.06,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
        },
        android: { elevation: 2 },
      }),
    },
    habitHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    habitIconCircle: {
      width: 56,
      height: 56,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    habitInfo: { flex: 1, minWidth: 0 },
    habitName: {
      fontSize: 17,
      fontWeight: "800",
      color: p.bodyText,
      letterSpacing: -0.3,
    },
    habitDesc: {
      fontSize: 12,
      fontWeight: "600",
      color: p.mutedText,
      marginTop: 2,
    },
    habitActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    editBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: p.accentSoft,
    },

    /* Stat pills */
    statRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 14,
      flexWrap: "wrap",
    },
    statPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
    },
    statPillText: {
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0.1,
    },

    /* 7-day row */
    weekRowLabel: {
      fontSize: 10,
      fontWeight: "800",
      color: p.mutedText,
      letterSpacing: 1.4,
      marginTop: 18,
      marginBottom: 8,
      textTransform: "uppercase",
    },
    weekRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 6,
    },
    weekDayCol: { flex: 1, alignItems: "center", gap: 6 },
    weekDayLabel: {
      fontSize: 10,
      fontWeight: "700",
      color: p.mutedText,
    },
    weekDayCell: {
      width: "100%",
      height: 38,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
    },
    weekDayCellToday: {
      borderWidth: 2,
    },
    weekDayNum: { fontSize: 12, fontWeight: "800" },

    /* 12-week mini heatmap */
    miniHeatWrap: {
      marginTop: 16,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: p.cardBorder,
    },
    miniHeatHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    miniHeatTitle: {
      fontSize: 11,
      fontWeight: "800",
      color: p.mutedText,
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    miniHeatSub: {
      fontSize: 11,
      fontWeight: "700",
      color: p.consistencyText,
    },
    miniHeatGrid: {
      flexDirection: "row",
    },

    /* ── Skeleton ── */
    skeletonWrap: { alignItems: "center", paddingTop: 8, paddingBottom: 40 },
    skeletonCard: {
      width: "100%",
      borderRadius: 24,
      padding: 18,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: p.cardBorder,
      backgroundColor: p.cardBg,
    },
    skeletonHeader: { flexDirection: "row", alignItems: "center" },
    skeletonIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: p.gridEmpty },
    skeletonLines: { flex: 1, marginLeft: 14, gap: 8 },
    skeletonLineLg: { height: 14, borderRadius: 7, backgroundColor: p.gridEmpty, width: "60%" },
    skeletonLineSm: { height: 10, borderRadius: 5, backgroundColor: p.gridEmpty, width: "40%" },
    skeletonRow: {
      marginTop: 16,
      flexDirection: "row",
      gap: 6,
    },
    skeletonPill: { height: 36, flex: 1, borderRadius: 11, backgroundColor: p.gridEmpty },

    /* ── Empty (no habits) ── */
    emptySimpleWrap: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 32,
    },
    emptySimpleTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: p.bodyText,
      letterSpacing: -0.3,
    },
    emptySimpleSub: {
      fontSize: 14,
      fontWeight: "600",
      color: p.subtleText,
      marginTop: 8,
      lineHeight: 21,
    },

    /* ── FAB ── */
    fab: { position: "absolute", right: 22, zIndex: 10, elevation: 10 },
    fabGrad: {
      width: 60,
      height: 60,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      ...Platform.select({
        ios: {
          shadowColor: p.accent,
          shadowOpacity: 0.4,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
        },
        android: { elevation: 8 },
      }),
    },

    /* ── Create / Edit Modal ── */
    modalOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: "flex-end" },
    modalCard: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 24,
      paddingBottom: 40,
      maxHeight: "88%",
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    modalTitle: { fontSize: 22, fontWeight: "900", color: c.text, letterSpacing: -0.4 },
    selectedIconWrap: { alignItems: "center", marginBottom: 14 },
    bigIcon: {
      width: 80,
      height: 80,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    modalInput: {
      backgroundColor: c.inputBg,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: c.inputBorder,
      paddingHorizontal: 16,
      paddingVertical: 13,
      fontSize: 15,
      fontWeight: "600",
      color: c.text,
    },
    colorLabel: {
      fontSize: 12,
      fontWeight: "800",
      color: c.textSecondary,
      marginTop: 16,
      marginBottom: 10,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    goalChoiceRow: { flexDirection: "row", gap: 8 },
    goalChoice: {
      flex: 1,
      minHeight: 42,
      paddingHorizontal: 6,
      borderRadius: 12,
      borderWidth: 1.5,
      alignItems: "center",
      justifyContent: "center",
    },
    goalChoiceText: { fontSize: 11, fontWeight: "800" },
    colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    colorBtn: { width: 30, height: 30, borderRadius: 15 },
    colorBtnSelected: { borderWidth: 3, borderColor: c.text },
    saveBtn: {
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 22,
    },
    saveBtnText: { fontSize: 16, fontWeight: "800", color: "#ffffff" },
    deleteLink: {
      marginTop: 14,
      paddingVertical: 10,
      alignItems: "center",
    },
    deleteLinkText: {
      fontSize: 13,
      fontWeight: "700",
      color: "#EF4444",
      letterSpacing: 0.2,
    },
  });
}

type HabitStyles = ReturnType<typeof createHabitStyles>;

/* ─── Mini 12-week heatmap inside each card ─────────── */

interface MiniHeatProps {
  logSet: Set<string>;
  color: string;
  emptyColor: string;
  todayStr: string;
  onTogglePress?: (dateStr: string) => void;
}

const MINI_WEEKS = 15;
const MINI_CELL = 12;
const MINI_GAP = 3;

const MiniHeat: React.FC<MiniHeatProps> = React.memo(
  ({ logSet, color, emptyColor, todayStr, onTogglePress }) => {
    const weeks = useMemo(() => buildRecentWeeks(MINI_WEEKS), []);
    const cellRadius = 3;
    return (
      <View style={{ flexDirection: "row" }}>
        {weeks.map((week, wi) => (
          <View
            key={wi}
            style={{ marginRight: wi < weeks.length - 1 ? MINI_GAP : 0 }}
          >
            {week.map((ds, di) => {
              const mb = di < 6 ? MINI_GAP : 0;
              if (!ds) {
                return (
                  <View
                    key={`e-${wi}-${di}`}
                    style={{
                      width: MINI_CELL,
                      height: MINI_CELL,
                      marginBottom: mb,
                      borderRadius: cellRadius,
                      backgroundColor: "transparent",
                    }}
                  />
                );
              }
              const filled = logSet.has(ds);
              const isToday = ds === todayStr;
              const isFuture = ds > todayStr;
              const disabled = isFuture || !onTogglePress;
              const cellStyle = {
                width: MINI_CELL,
                height: MINI_CELL,
                marginBottom: mb,
                borderRadius: cellRadius,
                backgroundColor: filled ? color : emptyColor,
                borderWidth: isToday ? 1.5 : 0,
                borderColor: isToday ? color : "transparent",
                opacity: isFuture ? 0.45 : 1,
              } as const;
              if (disabled) {
                return <View key={ds} style={cellStyle} />;
              }
              return (
                <Pressable
                  key={ds}
                  hitSlop={3}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    onTogglePress?.(ds);
                  }}
                  style={({ pressed }) => [
                    cellStyle,
                    pressed && { transform: [{ scale: 0.88 }] },
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>
    );
  }
);

/* ─── Streak Quest Strip (goal-aware) ────────────────── */

interface HabitQuestProps {
  streak: number;
  bestStreak: number;
  /** Goal in days (21/60/90) or null if user hasn't activated quest mode. */
  goal: HabitGoal;
  color: string;
  bodyText: string;
  subtle: string;
  muted: string;
  emptyColor: string;
  isDark: boolean;
  /** Tap handler for the "Activate streak quest" CTA shown when goal is null. */
  onActivate?: () => void;
}

/**
 * Visualises the user's progress toward the active streak goal as a single
 * tinted progress bar with three phase markers (Spark / Build / Lock-in).
 * Works for 21, 60 and 90 day goals because the bar is fluid rather than
 * fixed-cell. When `goal` is null the strip renders an "Activate" CTA so
 * habits don't get the quest UI by default.
 */
const HabitQuest: React.FC<HabitQuestProps> = React.memo(
  ({
    streak,
    bestStreak,
    goal,
    color,
    bodyText,
    subtle,
    muted,
    emptyColor,
    isDark,
    onActivate,
  }) => {
    const stage = getStageForStreak(streak, goal);
    const milestone = getNextMilestone(streak);
    const personalBest = isAtPersonalBest(streak, bestStreak);

    /** No-goal CTA: keep card plain and offer to opt in. */
    if (!goal) {
      return (
        <View
          style={{
            marginTop: 16,
            paddingTop: 14,
            borderTopWidth: 1,
            borderTopColor: emptyColor,
          }}
        >
          <Pressable
            onPress={(e) => {
              (e as any)?.stopPropagation?.();
              onActivate?.();
            }}
            style={({ pressed }) => [
              {
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 16,
                backgroundColor: color + (isDark ? "1F" : "12"),
                borderWidth: 1,
                borderColor: color + (isDark ? "44" : "24"),
              },
              pressed && { opacity: 0.85 },
            ]}
          >
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: color + (isDark ? "30" : "1A"),
              }}
            >
              <Ionicons name="flag-outline" size={18} color={color} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "900",
                  color: bodyText,
                  letterSpacing: -0.2,
                }}
              >
                Set a streak goal
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: subtle,
                  marginTop: 2,
                  lineHeight: 15,
                }}
              >
                Start at 21 days, then unlock 60 and 90.
                {streak > 0 ? `  Already on day ${streak}.` : ""}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={muted} />
          </Pressable>
        </View>
      );
    }

    const quest = getQuestProgress(streak, goal);

    /** Microcopy under the bar. Comeback > graduation > milestone > stage. */
    const subtitle = (() => {
      if (streak === 0 && bestStreak >= 3) {
        return `Comeback time — beat your best of ${bestStreak} days.`;
      }
      if (personalBest && streak >= 3) {
        return `New personal best — every day from here is uncharted.`;
      }
      if (quest.graduated) {
        if (quest.nextTier) {
          return `Quest complete. Promote to the ${quest.nextTier}-day tier to keep pushing.`;
        }
        return `Quest complete — 90 days locked in. Lifestyle achieved.`;
      }
      const left = goal - quest.daysInQuest;
      return `${left} day${left === 1 ? "" : "s"} to ${goal}-day goal · ${milestone.label}`;
    })();

    const stageBadgeBg = color + (isDark ? "30" : "1F");

    return (
      <View
        style={{
          marginTop: 16,
          paddingTop: 14,
          borderTopWidth: 1,
          borderTopColor: emptyColor,
        }}
      >
        {/* Header row */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "800",
                color: muted,
                letterSpacing: 1.4,
                textTransform: "uppercase",
              }}
            >
              {goal}-Day Quest
            </Text>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 999,
                backgroundColor: stageBadgeBg,
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Text style={{ fontSize: 10 }}>{stage.emoji}</Text>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "900",
                  color,
                  letterSpacing: 0.4,
                  textTransform: "uppercase",
                }}
              >
                {stage.label}
              </Text>
            </View>
          </View>
          {!quest.graduated ? (
            <Text style={{ fontSize: 11, fontWeight: "800", color: bodyText }}>
              Day {quest.daysInQuest}
              <Text style={{ color: muted, fontWeight: "700" }}> / {goal}</Text>
            </Text>
          ) : (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                paddingHorizontal: 9,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: color,
              }}
            >
              <Ionicons name="infinite" size={11} color="#FFFFFF" />
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "900",
                  color: "#FFFFFF",
                  letterSpacing: 0.3,
                  textTransform: "uppercase",
                }}
              >
                Day {streak}
              </Text>
            </View>
          )}
        </View>

        {!quest.graduated ? (
          <View>
            {/* Single fluid progress bar with 1/3 + 2/3 phase ticks */}
            <View
              style={{
                height: 14,
                borderRadius: 7,
                backgroundColor: emptyColor,
                overflow: "hidden",
                position: "relative",
              }}
            >
              <View
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${Math.min(100, quest.ratio * 100)}%`,
                  backgroundColor: color,
                  borderRadius: 7,
                }}
              />
              {[1 / 3, 2 / 3].map((frac) => (
                <View
                  key={frac}
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: `${frac * 100}%`,
                    width: 1.5,
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.18)"
                      : "rgba(0,0,0,0.14)",
                  }}
                />
              ))}
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: 6,
              }}
            >
              {(["Spark", "Build", "Lock-in"] as const).map((label, i) => {
                const phaseDay = (goal / 3) * (i + 1);
                const reached = streak >= phaseDay;
                return (
                  <Text
                    key={label}
                    style={{
                      fontSize: 9,
                      fontWeight: "800",
                      color: reached ? color : muted,
                      letterSpacing: 0.5,
                      textTransform: "uppercase",
                    }}
                  >
                    {label}
                  </Text>
                );
              })}
            </View>
          </View>
        ) : (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderRadius: 18,
              backgroundColor: color + (isDark ? "26" : "16"),
              borderWidth: 1,
              borderColor: color + (isDark ? "55" : "33"),
            }}
          >
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: color,
              }}
            >
              <Ionicons name="infinite" size={26} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "900",
                  color: bodyText,
                  letterSpacing: -0.3,
                }}
              >
                {stage.label} · Day {streak}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: subtle,
                  marginTop: 2,
                }}
              >
                {quest.nextTier
                  ? `${goal}-day goal cleared. Next tier: ${quest.nextTier} days.`
                  : `90-day lifestyle achieved. Personal best ${Math.max(streak, bestStreak)}d.`}
              </Text>
            </View>
          </View>
        )}

        {/* Subtitle copy */}
        <Text
          style={{
            marginTop: 10,
            fontSize: 11,
            fontWeight: "700",
            color: subtle,
            lineHeight: 16,
          }}
        >
          {subtitle}
        </Text>
      </View>
    );
  }
);

/* ─── Toggle Circle (animated) ───────────────────────── */

interface ToggleProps {
  done: boolean;
  color: string;
  onPress: () => void;
  size?: number;
}

const ToggleCircle: React.FC<ToggleProps> = React.memo(
  ({ done, color, onPress, size = 46 }) => {
    const scale = useSharedValue(1);
    const progress = useSharedValue(done ? 1 : 0);

    useEffect(() => {
      progress.value = withTiming(done ? 1 : 0, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
      });
    }, [done, progress]);

    const handlePress = useCallback(() => {
      scale.value = withSequence(
        withTiming(0.86, { duration: 70, easing: Easing.out(Easing.quad) }),
        withSpring(1, { damping: 10, stiffness: 220, mass: 0.5 })
      );
      onPress();
    }, [onPress, scale]);

    const wrapStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const bgStyle = useAnimatedStyle(() => {
      const bg = interpolateColor(
        progress.value,
        [0, 1],
        ["rgba(0,0,0,0)", color]
      );
      const borderColor = interpolateColor(
        progress.value,
        [0, 1],
        [color + "55", color]
      );
      return {
        backgroundColor: bg,
        borderColor,
        borderWidth: 2.2,
      };
    });

    const checkStyle = useAnimatedStyle(() => ({
      opacity: progress.value,
      transform: [{ scale: 0.6 + progress.value * 0.4 }],
    }));

    const plusStyle = useAnimatedStyle(() => ({
      opacity: 1 - progress.value,
      transform: [{ scale: 0.6 + (1 - progress.value) * 0.4 }],
    }));

    const shadowStyle = useAnimatedStyle(() => ({
      opacity: progress.value,
    }));

    return (
      <Reanimated.View style={wrapStyle}>
        <Pressable
          onPress={handlePress}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={done ? "Mark not done" : "Mark done"}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Reanimated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                width: size,
                height: size,
                borderRadius: size / 2,
                ...Platform.select({
                  ios: {
                    shadowColor: color,
                    shadowOpacity: 0.35,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 4 },
                  },
                  android: { elevation: 4 },
                }),
              },
              shadowStyle,
            ]}
          />
          <Reanimated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                width: size,
                height: size,
                borderRadius: size / 2,
              },
              bgStyle,
            ]}
          />
          <Reanimated.View style={[{ position: "absolute" }, checkStyle]}>
            <Ionicons name="checkmark" size={size * 0.55} color="#fff" />
          </Reanimated.View>
          <Reanimated.View style={[{ position: "absolute" }, plusStyle]}>
            <Ionicons name="add" size={size * 0.55} color={color} />
          </Reanimated.View>
        </Pressable>
      </Reanimated.View>
    );
  }
);

/* ─── Yearly Heatmap (kept for richer look on detail) ─── */

interface YearlyHeatmapProps {
  logSet: Set<string>;
  color: string;
  todayStr: string;
  monthLabelColor: string;
  emptyColor: string;
}

const YearlyHeatmap = React.memo<YearlyHeatmapProps>(
  ({ logSet, color, todayStr, monthLabelColor, emptyColor }) => {
    const weeks = useMemo(() => buildCurrentYearWeeks(), []);
    const scrollRef = useRef<ScrollView>(null);
    const cellSize = 12;
    const cellGap = 2;
    const colWidth = cellSize + cellGap;
    const gridH = 7 * cellSize + 6 * cellGap;
    const monthRowH = 14;
    const scrollOuterH = monthRowH + 4 + gridH + 4;

    const currentWeekIdx = useMemo(() => {
      for (let i = 0; i < weeks.length; i++) {
        if (weeks[i].includes(todayStr)) return i;
      }
      return weeks.length - 1;
    }, [weeks, todayStr]);

    const monthMarkers = useMemo(() => {
      const markers: { label: string; weekIdx: number }[] = [];
      let lastMonth = -1;
      for (let wi = 0; wi < weeks.length; wi++) {
        for (const ds of weeks[wi]) {
          if (!ds) continue;
          const month = parseInt(ds.split("-")[1], 10) - 1;
          if (month !== lastMonth) {
            markers.push({ label: SHORT_MONTHS[month], weekIdx: wi });
            lastMonth = month;
            break;
          }
        }
      }
      return markers;
    }, [weeks]);

    const handleLayout = useCallback(() => {
      const targetX = Math.max(0, currentWeekIdx * colWidth - SCREEN_W * 0.45);
      scrollRef.current?.scrollTo({ x: targetX, animated: false });
    }, [currentWeekIdx, colWidth]);

    const contentW =
      weeks.length * cellSize + Math.max(0, weeks.length - 1) * cellGap;

    return (
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={handleLayout}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        style={{ height: scrollOuterH }}
        contentContainerStyle={{ paddingVertical: 2, flexGrow: 0 }}
      >
        <View style={{ width: contentW }}>
          <View
            style={{
              height: monthRowH,
              width: contentW,
              marginBottom: 4,
              position: "relative",
            }}
          >
            {monthMarkers.map((m, i) => (
              <Text
                key={i}
                style={{
                  position: "absolute",
                  left: m.weekIdx * colWidth,
                  fontSize: 9,
                  fontWeight: "700",
                  color: monthLabelColor,
                }}
              >
                {m.label}
              </Text>
            ))}
          </View>
          <View style={{ flexDirection: "row", width: contentW, height: gridH }}>
            {weeks.map((week, wi) => (
              <View key={wi} style={{ marginRight: wi < weeks.length - 1 ? cellGap : 0 }}>
                {week.map((ds, di) => {
                  const mb = di < 6 ? cellGap : 0;
                  if (!ds) {
                    return (
                      <View
                        key={`e-${wi}-${di}`}
                        style={{
                          width: cellSize,
                          height: cellSize,
                          marginBottom: mb,
                          borderRadius: 3,
                          backgroundColor: "transparent",
                        }}
                      />
                    );
                  }
                  const filled = logSet.has(ds);
                  const isToday = ds === todayStr;
                  return (
                    <View
                      key={ds}
                      style={{
                        width: cellSize,
                        height: cellSize,
                        marginBottom: mb,
                        borderRadius: 3,
                        backgroundColor: filled ? color : emptyColor,
                        borderWidth: isToday ? 1.4 : 0,
                        borderColor: isToday ? color : "transparent",
                      }}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    );
  }
);

/* ─── Skeleton ───────────────────────────────────────── */

interface HabitListSkeletonProps {
  styles: HabitStyles;
  indicatorColor: string;
}

const HabitListSkeleton: React.FC<HabitListSkeletonProps> = ({ styles, indicatorColor }) => {
  const opacity = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <View style={styles.skeletonWrap}>
      <ActivityIndicator size="small" color={indicatorColor} style={{ marginBottom: 20 }} />
      {[0, 1, 2].map((i) => (
        <Animated.View key={i} style={[styles.skeletonCard, { opacity }]}>
          <View style={styles.skeletonHeader}>
            <View style={styles.skeletonIcon} />
            <View style={styles.skeletonLines}>
              <View style={styles.skeletonLineLg} />
              <View style={styles.skeletonLineSm} />
            </View>
          </View>
          <View style={styles.skeletonRow}>
            {[0, 1, 2, 3, 4, 5, 6].map((k) => (
              <View key={k} style={styles.skeletonPill} />
            ))}
          </View>
        </Animated.View>
      ))}
    </View>
  );
};

/* ─── Habit Detail Modal ─────────────────────────────── */
/**
 * Dedicated screen for a single habit that lets the user review history and
 * **edit any previous day** (tap a calendar cell to toggle). Also surfaces
 * quick "Edit" and "Delete" actions so the card tap can open this instead of
 * jumping straight into the name/icon edit modal.
 */

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Build the 6×7 calendar grid (Mon-first) for the given month. Null = out of month. */
function buildMonthGrid(
  year: number,
  month: number
): { grid: (Date | null)[][]; days: number } {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Mon = 0, Sun = 6
  const firstCol = (first.getDay() + 6) % 7;

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstCol; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const grid: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) grid.push(cells.slice(i, i + 7));
  return { grid, days: daysInMonth };
}

interface HabitDetailModalProps {
  visible: boolean;
  habit: Habit | null;
  logSet: Set<string>;
  todayStr: string;
  palette: HabitsPalette;
  isDark: boolean;
  goal: HabitGoal;
  onClose: () => void;
  onToggleDate: (date: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpenGoalPicker: () => void;
}

const HabitDetailModal: React.FC<HabitDetailModalProps> = ({
  visible,
  habit,
  logSet,
  todayStr,
  palette,
  isDark,
  goal,
  onClose,
  onToggleDate,
  onEdit,
  onDelete,
  onOpenGoalPicker,
}) => {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  // Reset month cursor to today each time the modal opens for a habit.
  useEffect(() => {
    if (!visible) return;
    const d = new Date();
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  }, [visible, habit?.id]);

  const { grid } = useMemo(
    () => buildMonthGrid(cursor.y, cursor.m),
    [cursor.y, cursor.m]
  );

  const monthLabel = useMemo(() => {
    return `${SHORT_MONTHS[cursor.m]} ${cursor.y}`;
  }, [cursor.y, cursor.m]);

  const stats = useMemo(() => {
    if (!habit) return { streak: 0, total: 0, consistency: 0, best: 0 };
    const streak = getStreak(logSet);
    const total = logSet.size;
    const consistency = getConsistencyPct(logSet);
    const best = getBestStreak(logSet);
    return { streak, total, consistency, best };
  }, [habit, logSet]);

  if (!habit) return null;

  const goPrevMonth = () => {
    setCursor((c) => {
      const nm = c.m === 0 ? 11 : c.m - 1;
      const ny = c.m === 0 ? c.y - 1 : c.y;
      return { y: ny, m: nm };
    });
  };
  const goNextMonth = () => {
    setCursor((c) => {
      const nm = c.m === 11 ? 0 : c.m + 1;
      const ny = c.m === 11 ? c.y + 1 : c.y;
      return { y: ny, m: nm };
    });
  };

  const surface = isDark ? "#1E1826" : "#FFFFFF";
  const surfaceMuted = isDark ? "rgba(255,255,255,0.05)" : "#F7F4FB";
  const borderCol = isDark ? "rgba(255,255,255,0.08)" : "rgba(17,24,39,0.08)";
  const bodyText = palette.bodyText;
  const subtle = palette.subtleText;
  const muted = palette.mutedText;
  const emptyCell = isDark ? "rgba(255,255,255,0.06)" : "#F1EDF7";
  const habitSoft = habit.color + (isDark ? "30" : "22");

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
        <View
          style={{
            backgroundColor: surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingTop: 18,
            paddingBottom: 28,
            paddingHorizontal: 20,
            maxHeight: "92%",
          }}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 16,
                  backgroundColor: habitSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name={habit.icon as any} size={24} color={habit.color} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{ fontSize: 20, fontWeight: "900", color: bodyText }}
                  numberOfLines={1}
                >
                  {habit.name}
                </Text>
                <Text
                  style={{ fontSize: 12, fontWeight: "600", color: muted, marginTop: 2 }}
                  numberOfLines={1}
                >
                  {habit.description?.trim() || "No description"}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={8}
                style={({ pressed }) => [
                  {
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    backgroundColor: surfaceMuted,
                    alignItems: "center",
                    justifyContent: "center",
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons name="close" size={20} color={bodyText} />
              </Pressable>
            </View>

            {/* Streak Quest (goal-aware) */}
            <View style={{ marginTop: 8 }}>
              <HabitQuest
                streak={stats.streak}
                bestStreak={stats.best}
                goal={goal}
                color={habit.color}
                bodyText={bodyText}
                subtle={subtle}
                muted={muted}
                emptyColor={emptyCell}
                isDark={isDark}
                onActivate={onOpenGoalPicker}
              />
            </View>

            {/* Heatmap strip (last 15 weeks) */}
            <View style={{ marginTop: 18 }}>
              <MiniHeat
                logSet={logSet}
                color={habit.color}
                emptyColor={emptyCell}
                todayStr={todayStr}
                onTogglePress={(ds) => onToggleDate(ds)}
              />
            </View>

            {/* Stat pills row */}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
              <View
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  borderRadius: 14,
                  backgroundColor: palette.streakBg,
                  alignItems: "center",
                }}
              >
                <Ionicons name="flame" size={18} color={palette.streakText} />
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "900",
                    color: palette.streakText,
                    marginTop: 4,
                  }}
                >
                  {stats.streak}
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "700",
                    color: subtle,
                    marginTop: 2,
                    letterSpacing: 0.4,
                    textTransform: "uppercase",
                  }}
                >
                  Streak
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  borderRadius: 14,
                  backgroundColor: palette.totalBg,
                  alignItems: "center",
                }}
              >
                <Ionicons name="trophy" size={18} color={palette.totalText} />
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "900",
                    color: palette.totalText,
                    marginTop: 4,
                  }}
                >
                  {stats.best}
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "700",
                    color: subtle,
                    marginTop: 2,
                    letterSpacing: 0.4,
                    textTransform: "uppercase",
                  }}
                >
                  Best
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  borderRadius: 14,
                  backgroundColor: palette.accentSoft,
                  alignItems: "center",
                }}
              >
                <Ionicons name="trending-up" size={18} color={palette.accent} />
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "900",
                    color: palette.accent,
                    marginTop: 4,
                  }}
                >
                  {stats.consistency}%
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "700",
                    color: subtle,
                    marginTop: 2,
                    letterSpacing: 0.4,
                    textTransform: "uppercase",
                  }}
                >
                  30-day
                </Text>
              </View>
            </View>

            {/* Month calendar — tap a day to toggle */}
            <View style={{ marginTop: 22 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: surfaceMuted,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: borderCol,
                  }}
                >
                  <Ionicons name="calendar-outline" size={14} color={bodyText} />
                  <Text style={{ fontSize: 13, fontWeight: "800", color: bodyText }}>
                    {monthLabel}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    onPress={goPrevMonth}
                    hitSlop={8}
                    style={({ pressed }) => [
                      {
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: borderCol,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: surface,
                      },
                      pressed && { opacity: 0.65 },
                    ]}
                  >
                    <Ionicons name="chevron-back" size={18} color={bodyText} />
                  </Pressable>
                  <Pressable
                    onPress={goNextMonth}
                    hitSlop={8}
                    style={({ pressed }) => [
                      {
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: borderCol,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: surface,
                      },
                      pressed && { opacity: 0.65 },
                    ]}
                  >
                    <Ionicons name="chevron-forward" size={18} color={bodyText} />
                  </Pressable>
                </View>
              </View>

              {/* Weekday header */}
              <View style={{ flexDirection: "row", marginBottom: 6 }}>
                {WEEKDAY_LABELS.map((wd) => (
                  <Text
                    key={wd}
                    style={{
                      flex: 1,
                      fontSize: 11,
                      fontWeight: "800",
                      color: muted,
                      textAlign: "center",
                      letterSpacing: 0.3,
                    }}
                  >
                    {wd}
                  </Text>
                ))}
              </View>

              {/* Calendar grid */}
              {grid.map((row, rIdx) => (
                <View
                  key={`r-${rIdx}`}
                  style={{ flexDirection: "row", marginBottom: 6 }}
                >
                  {row.map((cell, cIdx) => {
                    if (!cell) {
                      return (
                        <View
                          key={`c-${rIdx}-${cIdx}`}
                          style={{ flex: 1, aspectRatio: 1 }}
                        />
                      );
                    }
                    const ds = fmtDate(cell);
                    const filled = logSet.has(ds);
                    const isToday = ds === todayStr;
                    const isFuture = ds > todayStr;
                    return (
                      <View
                        key={`c-${rIdx}-${cIdx}`}
                        style={{ flex: 1, aspectRatio: 1, padding: 3 }}
                      >
                        <Pressable
                          disabled={isFuture}
                          onPress={() => onToggleDate(ds)}
                          style={({ pressed }) => [
                            {
                              flex: 1,
                              borderRadius: 12,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: filled
                                ? habit.color
                                : isToday
                                ? habitSoft
                                : "transparent",
                              borderWidth: isToday && !filled ? 1.5 : 0,
                              borderColor: isToday ? habit.color : "transparent",
                              opacity: isFuture ? 0.35 : 1,
                            },
                            pressed && !isFuture && { transform: [{ scale: 0.94 }] },
                          ]}
                        >
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: filled || isToday ? "800" : "600",
                              color: filled
                                ? "#FFFFFF"
                                : isFuture
                                ? muted
                                : isToday
                                ? habit.color
                                : bodyText,
                            }}
                          >
                            {cell.getDate()}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              ))}

              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: muted,
                  textAlign: "center",
                  marginTop: 4,
                  lineHeight: 16,
                }}
              >
                Tap any day to mark it done (or un-done).
              </Text>
            </View>

            {/* Footer actions */}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 22 }}>
              <Pressable
                onPress={onEdit}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    paddingVertical: 14,
                    borderRadius: 14,
                    backgroundColor: palette.accent,
                  },
                  pressed && { opacity: 0.88 },
                ]}
              >
                <Ionicons name="create-outline" size={18} color="#FFFFFF" />
                <Text style={{ fontSize: 14, fontWeight: "800", color: "#FFFFFF" }}>
                  Edit habit
                </Text>
              </Pressable>
              <Pressable
                onPress={onDelete}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    paddingVertical: 14,
                    borderRadius: 14,
                    borderWidth: 1.5,
                    borderColor: isDark ? "#5C2020" : "#F5C6C6",
                    backgroundColor: isDark ? "#2D1A1A" : "#FDF2F2",
                  },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Ionicons name="trash-outline" size={18} color={isDark ? "#E87171" : "#C45050"} />
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "800",
                    color: isDark ? "#E87171" : "#C45050",
                  }}
                >
                  Delete
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

/* ─── Streak Goal Picker (off / 21 / 60 / 90) ────────── */

interface GoalPickerModalProps {
  visible: boolean;
  habit: Habit | null;
  currentGoal: HabitGoal;
  isDark: boolean;
  palette: HabitsPalette;
  onClose: () => void;
  onSelect: (goal: HabitGoal) => void | Promise<void>;
}

const GOAL_OPTIONS: {
  value: HabitGoal;
  label: string;
  blurb: string;
  emoji: string;
}[] = [
  {
    value: null,
    label: "Off",
    blurb: "Plain tracking — no quest UI.",
    emoji: "—",
  },
  {
    value: 21,
    label: "21-day quest",
    blurb: "Folklore tier. Three weeks to anchor it.",
    emoji: "🌱",
  },
  {
    value: 60,
    label: "60-day quest",
    blurb: "Research tier (~Lally et al.). Most habits become automatic.",
    emoji: "🌳",
  },
  {
    value: 90,
    label: "90-day quest",
    blurb: "Lifestyle tier. This is who you are now.",
    emoji: "🏛️",
  },
];

const GoalPickerModal: React.FC<GoalPickerModalProps> = ({
  visible,
  habit,
  currentGoal,
  isDark,
  palette,
  onClose,
  onSelect,
}) => {
  if (!habit) return null;
  const surface = isDark ? "#1E1826" : "#FFFFFF";
  const muted = isDark ? "rgba(255,255,255,0.05)" : "#F7F4FB";

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            backgroundColor: surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingTop: 18,
            paddingBottom: 32,
            paddingHorizontal: 20,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              marginBottom: 4,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: habit.color + (isDark ? "30" : "1A"),
              }}
            >
              <Ionicons name="flag" size={20} color={habit.color} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "900",
                  color: palette.bodyText,
                  letterSpacing: -0.3,
                }}
                numberOfLines={1}
              >
                Streak goal · {habit.name}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: palette.subtleText,
                  marginTop: 2,
                }}
              >
                Auto-promotes 21 → 60 → 90 once you hit the goal.
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={({ pressed }) => [
                {
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: muted,
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name="close" size={20} color={palette.bodyText} />
            </Pressable>
          </View>

          {/* Options */}
          <View style={{ marginTop: 18, gap: 10 }}>
            {GOAL_OPTIONS.map((opt) => {
              const selected = currentGoal === opt.value;
              return (
                <Pressable
                  key={String(opt.value ?? "off")}
                  onPress={() => onSelect(opt.value)}
                  style={({ pressed }) => [
                    {
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 14,
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      borderRadius: 16,
                      borderWidth: 1.5,
                      borderColor: selected
                        ? habit.color
                        : isDark
                          ? "rgba(255,255,255,0.08)"
                          : "rgba(17,24,39,0.08)",
                      backgroundColor: selected
                        ? habit.color + (isDark ? "26" : "16")
                        : muted,
                    },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: habit.color + (isDark ? "30" : "1F"),
                    }}
                  >
                    <Text style={{ fontSize: 20 }}>{opt.emoji}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "900",
                        color: palette.bodyText,
                        letterSpacing: -0.2,
                      }}
                    >
                      {opt.label}
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "600",
                        color: palette.subtleText,
                        marginTop: 2,
                        lineHeight: 15,
                      }}
                    >
                      {opt.blurb}
                    </Text>
                  </View>
                  {selected ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={habit.color}
                    />
                  ) : (
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={palette.mutedText}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
};

/* ─── Main Screen ────────────────────────────────────── */

const HabitsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useAppTheme();
  const { user, isGuest, storageScope } = useAuth();
  const userId = user?.id;
  const todayStr = useMemo(() => fmtDate(new Date()), []);
  const palette = useMemo(() => buildHabitsPalette(isDark, c), [isDark, c]);
  const styles = useMemo(() => createHabitStyles(c, palette), [c, palette]);

  const [habits, setHabits] = useState<Habit[]>([]);
  const [allLogs, setAllLogs] = useState<HabitLog[]>([]);
  /** Per-habit streak goal (21/60/90), or absent when user hasn't opted in. */
  const [habitGoals, setHabitGoals] = useState<Record<string, HabitGoalTier>>({});
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);

  const [cName, setCName] = useState("");
  const [cDesc, setCDesc] = useState("");
  const [cIcon, setCIcon] = useState<string>("fitness");
  const [cColor, setCColor] = useState<string>(COLORS[11]); // #6366F1 indigo
  const [cGoal, setCGoal] = useState<HabitGoal>(21);
  const [editMode, setEditMode] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  /** Currently-opened habit on the detail sheet (calendar + edit prev days). */
  const [detailHabitId, setDetailHabitId] = useState<string | null>(null);
  /** Habit ID whose goal picker is open (null = closed). */
  const [goalPickerForHabit, setGoalPickerForHabit] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [h, l, goals] = await Promise.all([
        fetchHabits(userId, isGuest),
        fetchAllLogs(userId, isGuest),
        loadHabitGoals(storageScope),
      ]);
      setHabits(h);
      setAllLogs(l);
      setHabitGoals(goals);
    } finally {
      setInitialLoadDone(true);
    }
  }, [userId, isGuest, storageScope]);

  useEffect(() => {
    setInitialLoadDone(false);
    setHabits([]);
    setAllLogs([]);
    setHabitGoals({});
  }, [userId, isGuest, storageScope]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const logsByHabit = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const l of allLogs) {
      if (!map.has(l.habit_id)) map.set(l.habit_id, new Set());
      map.get(l.habit_id)!.add(l.date);
    }
    return map;
  }, [allLogs]);

  const handleToggleLog = async (habitId: string, date: string) => {
    let nextLogs: HabitLog[] = [];
    setAllLogs((prev) => {
      const exists = prev.some((l) => l.habit_id === habitId && l.date === date);
      const out = exists
        ? prev.filter((l) => !(l.habit_id === habitId && l.date === date))
        : [...prev, { habit_id: habitId, date }];
      nextLogs = out;
      return out;
    });
    await toggleLog(habitId, date, userId, isGuest);

    /** Auto-promote 21 → 60 → 90 the moment the streak crosses the goal. */
    const currentGoal = habitGoals[habitId];
    if (currentGoal) {
      const dates = new Set(
        nextLogs
          .filter((l) => l.habit_id === habitId)
          .map((l) => l.date)
      );
      const newStreak = getStreak(dates);
      if (newStreak >= currentGoal) {
        const promoted = await maybePromoteHabitGoal(
          storageScope,
          habitId,
          newStreak
        );
        if (promoted && promoted !== currentGoal) {
          setHabitGoals((g) => ({ ...g, [habitId]: promoted }));
        }
      }
    }
  };

  const applyGoal = async (habitId: string, goal: HabitGoal): Promise<void> => {
    await setHabitGoal(storageScope, habitId, goal);
    setHabitGoals((g) => {
      const out = { ...g };
      if (goal == null) delete out[habitId];
      else out[habitId] = goal;
      return out;
    });
  };

  const openCreate = () => {
    setEditMode(false);
    setEditingHabit(null);
    setCName("");
    setCDesc("");
    setCIcon("fitness");
    setCColor(COLORS[11]);
    setCGoal(21);
    setCreateVisible(true);
  };

  const openEdit = (h: Habit) => {
    setEditMode(true);
    setEditingHabit(h);
    setCName(h.name);
    setCDesc(h.description);
    setCIcon(h.icon);
    setCColor(h.color);
    setCGoal(habitGoals[h.id] ?? null);
    setCreateVisible(true);
  };

  const openDetail = (h: Habit) => {
    setDetailHabitId(h.id);
  };

  const handleSaveHabit = async () => {
    if (!cName.trim()) {
      Alert.alert("Error", "Habit name is required");
      return;
    }
    if (editMode && editingHabit) {
      await updateHabit(
        editingHabit.id,
        {
          name: cName.trim(),
          description: cDesc.trim(),
          icon: cIcon,
          color: cColor,
        },
        userId,
        isGuest
      );
      await applyGoal(editingHabit.id, cGoal);
    } else {
      const created = await createHabit(
        {
          name: cName.trim(),
          description: cDesc.trim(),
          icon: cIcon,
          color: cColor,
        },
        userId,
        isGuest
      );
      await applyGoal(created.id, cGoal);
    }
    setCreateVisible(false);
    setEditingHabit(null);
    await load();
  };

  const handleDeleteHabit = (h: Habit) => {
    Alert.alert("Delete habit", `Remove "${h.name}"? Its history will also be cleared.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteHabit(h.id, userId, isGuest);
          setCreateVisible(false);
          setEditingHabit(null);
          await load();
        },
      },
    ]);
  };

  /* ─── Habit card ─── */

  const renderHabitCard = useCallback(
    ({ item }: { item: Habit }) => {
      const logs = logsByHabit.get(item.id) || new Set<string>();
      const doneToday = logs.has(todayStr);
      const streak = getStreak(logs);
      const best = getBestStreak(logs);
      const goal = habitGoals[item.id] ?? null;
      const stage = getStageForStreak(streak, goal);

      return (
        <Pressable
          onPress={() => openDetail(item)}
          style={({ pressed }) => [styles.habitCard, pressed && { opacity: 0.96 }]}
        >
          {/* Header */}
          <View style={styles.habitHeader}>
            <View
              style={[
                styles.habitIconCircle,
                { backgroundColor: item.color + (isDark ? "28" : "1A") },
              ]}
            >
              <Ionicons name={item.icon as any} size={26} color={item.color} />
            </View>
            <View style={styles.habitInfo}>
              <Text style={styles.habitName} numberOfLines={1}>
                {item.name}
              </Text>
              {item.description ? (
                <Text style={styles.habitDesc} numberOfLines={1}>
                  {item.description}
                </Text>
              ) : (
                <Text style={styles.habitDesc} numberOfLines={1}>
                  {streak > 0
                    ? `${stage.emoji} ${stage.label} · ${streak}-day streak`
                    : "Tap today's circle to begin"}
                </Text>
              )}
            </View>
            <View style={styles.habitActions}>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  openEdit(item);
                }}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.editBtn,
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Ionicons name="create-outline" size={18} color={palette.accent} />
              </Pressable>
              <ToggleCircle
                done={doneToday}
                color={item.color}
                onPress={() => handleToggleLog(item.id, todayStr)}
              />
            </View>
          </View>

          {/* Streak Quest (opt-in: shows CTA when goal is null) */}
          <HabitQuest
            streak={streak}
            bestStreak={best}
            goal={goal}
            color={item.color}
            bodyText={palette.bodyText}
            subtle={palette.subtleText}
            muted={palette.mutedText}
            emptyColor={palette.gridEmpty}
            isDark={isDark}
            onActivate={() => setGoalPickerForHabit(item.id)}
          />

          {/* Mini heatmap — last 15 weeks */}
          <View style={styles.miniHeatWrap}>
            <View style={styles.miniHeatHeader}>
              <Text style={styles.miniHeatTitle}>Last 15 weeks</Text>
              {best > 0 ? (
                <Text style={styles.miniHeatSub}>
                  Best {best}d{streak >= best && streak > 0 ? " · personal record" : ""}
                </Text>
              ) : null}
            </View>
            <MiniHeat
              logSet={logs}
              color={item.color}
              emptyColor={palette.gridEmpty}
              todayStr={todayStr}
              onTogglePress={(ds) => handleToggleLog(item.id, ds)}
            />
          </View>
        </Pressable>
      );
    },
    [logsByHabit, todayStr, styles, palette, isDark, handleToggleLog, habitGoals]
  );

  /* ─── Empty / loading ─── */

  const listEmpty = !initialLoadDone ? (
    <HabitListSkeleton styles={styles} indicatorColor={palette.accent} />
  ) : (
    <View style={styles.emptySimpleWrap}>
      <Text style={styles.emptySimpleTitle}>Create your first habit</Text>
      <Text style={styles.emptySimpleSub}>Tap + below to get started.</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={palette.pageGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <MenuButton />

      <FlatList
        data={habits}
        renderItem={renderHabitCard}
        keyExtractor={(item) => item.id}
        extraData={allLogs}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: insets.top + 70 },
        ]}
        ListEmptyComponent={listEmpty}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      />

      {/* FAB */}
      {initialLoadDone && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={openCreate}
          style={[styles.fab, { bottom: insets.bottom + 24 }]}
        >
          <LinearGradient colors={palette.fabGradient} style={styles.fabGrad}>
            <Ionicons name="add" size={30} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Habit Detail (per-day edit) */}
      <HabitDetailModal
        visible={detailHabitId !== null}
        habit={habits.find((h) => h.id === detailHabitId) ?? null}
        logSet={
          detailHabitId
            ? logsByHabit.get(detailHabitId) ?? new Set<string>()
            : new Set<string>()
        }
        todayStr={todayStr}
        palette={palette}
        isDark={isDark}
        goal={detailHabitId ? habitGoals[detailHabitId] ?? null : null}
        onClose={() => setDetailHabitId(null)}
        onToggleDate={(ds) => {
          if (detailHabitId) void handleToggleLog(detailHabitId, ds);
        }}
        onEdit={() => {
          const h = habits.find((x) => x.id === detailHabitId);
          if (!h) return;
          setDetailHabitId(null);
          setTimeout(() => openEdit(h), 180);
        }}
        onDelete={() => {
          const h = habits.find((x) => x.id === detailHabitId);
          if (!h) return;
          setDetailHabitId(null);
          setTimeout(() => handleDeleteHabit(h), 180);
        }}
        onOpenGoalPicker={() => {
          if (detailHabitId) setGoalPickerForHabit(detailHabitId);
        }}
      />

      {/* Streak goal picker (off / 21 / 60 / 90) */}
      <GoalPickerModal
        visible={goalPickerForHabit !== null}
        habit={habits.find((h) => h.id === goalPickerForHabit) ?? null}
        currentGoal={
          goalPickerForHabit ? habitGoals[goalPickerForHabit] ?? null : null
        }
        isDark={isDark}
        palette={palette}
        onClose={() => setGoalPickerForHabit(null)}
        onSelect={async (g) => {
          if (!goalPickerForHabit) return;
          await applyGoal(goalPickerForHabit, g);
          setGoalPickerForHabit(null);
        }}
      />

      {/* Create / Edit Modal */}
      <Modal visible={createVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editMode ? "Edit Habit" : "New Habit"}
              </Text>
              <Pressable onPress={() => setCreateVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={26} color={c.iconMuted} />
              </Pressable>
            </View>

            <View style={styles.selectedIconWrap}>
              <View style={[styles.bigIcon, { backgroundColor: cColor + "22" }]}>
                <Ionicons name={cIcon as any} size={38} color={cColor} />
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ maxHeight: 48, marginBottom: 14 }}
              contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}
            >
              {ICONS.map((ic) => (
                <Pressable
                  key={ic}
                  onPress={() => setCIcon(ic)}
                  style={[
                    styles.iconBtn,
                    cIcon === ic && {
                      backgroundColor: cColor + "22",
                      borderColor: cColor,
                    },
                  ]}
                >
                  <Ionicons
                    name={ic}
                    size={19}
                    color={cIcon === ic ? cColor : c.textMuted}
                  />
                </Pressable>
              ))}
            </ScrollView>

            <TextInput
              style={styles.modalInput}
              placeholder="Habit name"
              placeholderTextColor={c.placeholder}
              value={cName}
              onChangeText={setCName}
            />
            <TextInput
              style={[styles.modalInput, { marginTop: 10 }]}
              placeholder="Description (optional)"
              placeholderTextColor={c.placeholder}
              value={cDesc}
              onChangeText={setCDesc}
            />

            <Text style={styles.colorLabel}>Streak target</Text>
            <View style={styles.goalChoiceRow}>
              {GOAL_OPTIONS.map((opt) => {
                const selected = cGoal === opt.value;
                return (
                  <Pressable
                    key={`create-goal-${String(opt.value ?? "off")}`}
                    onPress={() => setCGoal(opt.value)}
                    style={[
                      styles.goalChoice,
                      {
                        borderColor: selected ? cColor : c.border,
                        backgroundColor: selected ? cColor + "18" : c.surface,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.goalChoiceText,
                        { color: selected ? cColor : c.textSecondary },
                      ]}
                    >
                      {opt.value == null ? "Off" : `${opt.value} days`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.colorLabel}>Pick a color</Text>
            <View style={styles.colorGrid}>
              {COLORS.map((clr) => (
                <Pressable
                  key={clr}
                  onPress={() => setCColor(clr)}
                  style={[
                    styles.colorBtn,
                    { backgroundColor: clr },
                    cColor === clr && styles.colorBtnSelected,
                  ]}
                />
              ))}
            </View>

            <Pressable
              onPress={handleSaveHabit}
              style={({ pressed }) => [
                styles.saveBtn,
                { backgroundColor: cColor },
                pressed && { opacity: 0.88 },
              ]}
            >
              <Text style={styles.saveBtnText}>
                {editMode ? "Save changes" : "Create Habit"}
              </Text>
            </Pressable>

            {editMode && editingHabit ? (
              <Pressable
                onPress={() => handleDeleteHabit(editingHabit)}
                style={({ pressed }) => [styles.deleteLink, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.deleteLinkText}>Delete this habit</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default HabitsScreen;

/** Re-export for potential reuse elsewhere. */
export { YearlyHeatmap };
