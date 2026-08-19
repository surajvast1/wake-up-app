import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../../contexts/AuthContext";
import { useAppTheme } from "../../../contexts/ThemeContext";
import {
  getStreak,
  getDaysActiveThisMonth,
  getTodaySessionCount,
  getTotalMinutesThisMonth,
  getTodayTotalMeditationSeconds,
  HOME_MEDITATION_GOAL_SEC,
  hydrateMeditationFromSupabase,
} from "../../../services/meditationService";

const DEFAULT_TIMER_SEC = 600;

const MeditationPromptCard: React.FC = () => {
  const navigation = useNavigation<{ navigate: (n: string, p?: object) => void }>();
  const { user, isGuest, storageScope } = useAuth();
  const { colors, isDark } = useAppTheme();
  const [streak, setStreak] = useState(0);
  const [daysMonth, setDaysMonth] = useState(0);
  const [minsMonth, setMinsMonth] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [dailyGoalMet, setDailyGoalMet] = useState(false);

  const refresh = useCallback(async () => {
    if (user?.id && !isGuest) {
      await hydrateMeditationFromSupabase(user.id, storageScope);
    }
    const [s, d, m, t, secToday] = await Promise.all([
      getStreak(storageScope),
      getDaysActiveThisMonth(storageScope),
      getTotalMinutesThisMonth(storageScope),
      getTodaySessionCount(storageScope),
      getTodayTotalMeditationSeconds(storageScope),
    ]);
    setStreak(s);
    setDaysMonth(d);
    setMinsMonth(m);
    setTodayCount(t);
    setDailyGoalMet(secToday >= HOME_MEDITATION_GOAL_SEC);
  }, [user?.id, isGuest, storageScope]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const doneToday = todayCount > 0;

  const subLine = doneToday
    ? "You already showed up today — want another gentle 10?"
    : "Just ten minutes. Sit, breathe, come back softer.";

  const statLine =
    daysMonth > 0
      ? `${daysMonth} day${daysMonth === 1 ? "" : "s"} this month · ${minsMonth} min total`
      : "Start your month of small pauses";

  if (dailyGoalMet) return null;

  const accent = isDark ? "#7AAFA0" : "#5B8A7A";

  return (
    <View style={styles.section}>
      <Pressable
        onPress={() =>
          navigation.navigate("meditation", { startTimerSec: DEFAULT_TIMER_SEC })
        }
        style={({ pressed }) => [styles.press, pressed && styles.pressPressed]}
      >
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.cardBg,
              borderColor: colors.cardBorder,
            },
          ]}
        >
          <View style={[styles.accentSide, { backgroundColor: accent }]} />
          <View style={styles.cardBody}>
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: accent + (isDark ? "18" : "10"),
                },
              ]}
            >
              <Ionicons name="leaf" size={22} color={accent} />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.kicker, { color: accent }]}>
                Meditation
              </Text>
              <Text style={[styles.title, { color: colors.text }]}>
                Let&apos;s meditate — 10 min
              </Text>
              <Text style={[styles.sub, { color: colors.textSecondary }]}>
                {subLine}
              </Text>
              <Text style={[styles.stats, { color: colors.textMuted }]}>
                {statLine}
              </Text>
              {streak > 0 ? (
                <View style={styles.streakRow}>
                  <Ionicons name="flame" size={14} color={accent} />
                  <Text style={[styles.streakText, { color: accent }]}>
                    {streak}-day streak
                  </Text>
                </View>
              ) : null}
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textMuted}
            />
          </View>
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: 16,
  },
  press: {
    borderRadius: 20,
    overflow: "hidden",
  },
  pressPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.992 }],
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  accentSide: {
    position: "absolute",
    left: 0,
    top: 12,
    bottom: 12,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  cardBody: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    marginLeft: 14,
    marginRight: 6,
    minWidth: 0,
  },
  kicker: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  sub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 17,
  },
  stats: {
    marginTop: 5,
    fontSize: 11,
    fontWeight: "600",
  },
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
  },
  streakText: {
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 4,
  },
});

export default MeditationPromptCard;
