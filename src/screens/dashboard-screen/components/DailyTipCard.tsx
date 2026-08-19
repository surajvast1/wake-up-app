import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useAuth } from "../../../contexts/AuthContext";
import { useAppTheme } from "../../../contexts/ThemeContext";
import {
  Habit,
  HabitLog,
  fetchHabits,
  fetchAllLogs,
} from "../../../services/habitService";
import { loadHabitGoals } from "../../../services/habitGoalService";
import {
  HabitGoalTier,
  getBestStreak,
  isAtPersonalBest,
  isStreakAtRisk,
} from "../../../lib/habitStreak";

/* ─── Date helpers ──────────────────────────────────── */

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

/* ─── Tip selection ─────────────────────────────────── */

type TipTone = "celebrate" | "warn" | "encourage" | "neutral";

interface DailyTip {
  tone: TipTone;
  icon: keyof typeof import("@expo/vector-icons/build/Ionicons").default.glyphMap;
  title: string;
  body: string;
  onPressTarget: "habits" | "habits-detail";
}

interface PerHabitInfo {
  habit: Habit;
  streak: number;
  best: number;
  goal: HabitGoalTier | null;
  doneToday: boolean;
  atRisk: boolean;
  isAtPB: boolean;
}

function pickTip(
  perHabit: PerHabitInfo[],
  todayStr: string
): DailyTip | null {
  if (perHabit.length === 0) {
    return {
      tone: "neutral",
      icon: "leaf-outline",
      title: "Plant your first habit",
      body: "One small daily ritual compounds. Tap to add yours.",
      onPressTarget: "habits",
    };
  }

  /** Priority 1 — streak at risk: yesterday done, today not. */
  const atRisk = perHabit
    .filter((h) => h.atRisk && h.streak > 0)
    .sort((a, b) => b.streak - a.streak)[0];
  if (atRisk) {
    return {
      tone: "warn",
      icon: "flame",
      title: `Don't break your ${atRisk.streak}-day chain`,
      body: `“${atRisk.habit.name}” isn't logged yet today. Knock it out before midnight.`,
      onPressTarget: "habits",
    };
  }

  /** Priority 2 — goal cleared today. */
  const justGraduated = perHabit
    .filter((h) => h.goal != null && h.streak === h.goal && h.doneToday)
    .sort((a, b) => (b.goal ?? 0) - (a.goal ?? 0))[0];
  if (justGraduated) {
    return {
      tone: "celebrate",
      icon: "infinite",
      title: `${justGraduated.goal} days on “${justGraduated.habit.name}”`,
      body:
        justGraduated.goal === 90
          ? "Lifestyle tier reached. This is who you are now."
          : `Quest cleared. The ${justGraduated.goal === 21 ? 60 : 90}-day tier is unlocked.`,
      onPressTarget: "habits-detail",
    };
  }

  /** Priority 3 — new personal best (and ≥3 days). */
  const pb = perHabit
    .filter((h) => h.isAtPB && h.streak >= 3 && h.doneToday)
    .sort((a, b) => b.streak - a.streak)[0];
  if (pb) {
    return {
      tone: "celebrate",
      icon: "trophy",
      title: `New personal best · ${pb.streak} days`,
      body: `“${pb.habit.name}” is in uncharted territory. Keep going.`,
      onPressTarget: "habits-detail",
    };
  }

  /** Priority 4 — all habits done today. */
  const allDone = perHabit.every((h) => h.doneToday);
  if (allDone) {
    const top = [...perHabit].sort((a, b) => b.streak - a.streak)[0];
    return {
      tone: "celebrate",
      icon: "checkmark-done-circle",
      title: "All habits done today",
      body: top?.streak
        ? `Top streak: ${top.streak} days on “${top.habit.name}”.`
        : "Beautiful. Sit with the win for a moment.",
      onPressTarget: "habits",
    };
  }

  /** Priority 5 — active quest (with goal) closest to graduation. */
  const closestQuest = perHabit
    .filter((h) => h.goal != null && h.streak < (h.goal ?? Infinity))
    .map((h) => ({ ...h, remaining: (h.goal ?? 0) - h.streak }))
    .sort((a, b) => a.remaining - b.remaining)[0];
  if (closestQuest) {
    const remaining = (closestQuest.goal ?? 0) - closestQuest.streak;
    return {
      tone: "encourage",
      icon: "flag",
      title: `${remaining} day${remaining === 1 ? "" : "s"} to ${closestQuest.goal}-day goal`,
      body: `“${closestQuest.habit.name}” · day ${closestQuest.streak}. ${
        closestQuest.doneToday
          ? "Today is in the books — keep the chain."
          : "Don't miss today."
      }`,
      onPressTarget: "habits-detail",
    };
  }

  /** Priority 6 — partial day, generic nudge based on top streak / pending. */
  const pending = perHabit.filter((h) => !h.doneToday);
  if (pending.length > 0) {
    const topPending = [...pending].sort((a, b) => b.streak - a.streak)[0];
    if (topPending.streak > 0) {
      return {
        tone: "encourage",
        icon: "flame",
        title: `${topPending.streak}-day streak on “${topPending.habit.name}”`,
        body: `${pending.length} habit${pending.length === 1 ? "" : "s"} left today. Don't break the chain.`,
        onPressTarget: "habits",
      };
    }
    return {
      tone: "neutral",
      icon: "sparkles-outline",
      title: `${pending.length} habit${pending.length === 1 ? "" : "s"} waiting today`,
      body: "Tap one off and start a streak.",
      onPressTarget: "habits",
    };
  }

  return null;
}

function toneColors(tone: TipTone, isDark: boolean) {
  switch (tone) {
    case "celebrate":
      return isDark
        ? { bg: "#221A2E", border: "#7C3AED55", accent: "#C4B5FD", text: "#F5F3FF" }
        : { bg: "#F4F0FF", border: "#A78BFA66", accent: "#6D28D9", text: "#1E1B4B" };
    case "warn":
      return isDark
        ? { bg: "#2A1B12", border: "#F9731655", accent: "#FDBA74", text: "#FFEDD5" }
        : { bg: "#FFF4E6", border: "#F9731666", accent: "#C2410C", text: "#431407" };
    case "encourage":
      return isDark
        ? { bg: "#13231A", border: "#65A30D55", accent: "#BEF264", text: "#ECFCCB" }
        : { bg: "#F0FAEA", border: "#65A30D44", accent: "#3F6212", text: "#1A2E05" };
    case "neutral":
    default:
      return isDark
        ? { bg: "#181C24", border: "rgba(255,255,255,0.08)", accent: "#A8B2BD", text: "#E2E8F0" }
        : { bg: "#F4F6F8", border: "rgba(17,24,39,0.08)", accent: "#475569", text: "#0F172A" };
  }
}

/* ─── Component ─────────────────────────────────────── */

const DailyTipCard: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user, isGuest, storageScope } = useAuth();
  const { isDark } = useAppTheme();
  const userId = user?.id;
  const todayStr = useMemo(() => fmtDate(new Date()), []);

  const [habits, setHabits] = useState<Habit[]>([]);
  const [allLogs, setAllLogs] = useState<HabitLog[]>([]);
  const [goals, setGoals] = useState<Record<string, HabitGoalTier>>({});
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        try {
          const [h, l, g] = await Promise.all([
            fetchHabits(userId, isGuest),
            fetchAllLogs(userId, isGuest),
            loadHabitGoals(storageScope),
          ]);
          if (!cancelled) {
            setHabits(h);
            setAllLogs(l);
            setGoals(g);
          }
        } finally {
          if (!cancelled) setLoaded(true);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [userId, isGuest, storageScope])
  );

  const perHabit: PerHabitInfo[] = useMemo(() => {
    const byHabit = new Map<string, Set<string>>();
    for (const l of allLogs) {
      if (!byHabit.has(l.habit_id)) byHabit.set(l.habit_id, new Set());
      byHabit.get(l.habit_id)!.add(l.date);
    }
    return habits.map((h) => {
      const set = byHabit.get(h.id) ?? new Set<string>();
      const streak = getStreak(set);
      const best = getBestStreak(set);
      return {
        habit: h,
        streak,
        best,
        goal: goals[h.id] ?? null,
        doneToday: set.has(todayStr),
        atRisk: isStreakAtRisk(set, todayStr),
        isAtPB: isAtPersonalBest(streak, best),
      };
    });
  }, [habits, allLogs, goals, todayStr]);

  const tip = useMemo(() => pickTip(perHabit, todayStr), [perHabit, todayStr]);

  if (!loaded || !tip) return null;

  const colors = toneColors(tip.tone, isDark);

  return (
    <View style={styles.section}>
      <Pressable
        onPress={() => navigation.navigate("habits")}
        accessibilityRole="button"
        accessibilityLabel={tip.title}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: colors.bg,
            borderColor: colors.border,
          },
          pressed && styles.pressed,
        ]}
      >
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: colors.accent + (isDark ? "33" : "22") },
          ]}
        >
          <Ionicons name={tip.icon as any} size={20} color={colors.accent} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {tip.title}
          </Text>
          <Text
            style={[styles.body, { color: colors.text, opacity: 0.78 }]}
            numberOfLines={2}
          >
            {tip.body}
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={colors.accent}
          style={{ marginLeft: 4 }}
        />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: 16,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
    }),
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.997 }],
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  body: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
});

export default DailyTipCard;
