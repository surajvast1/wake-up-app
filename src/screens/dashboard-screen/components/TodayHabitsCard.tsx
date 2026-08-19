import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../../../contexts/AuthContext";
import { useAppTheme } from "../../../contexts/ThemeContext";
import HomeDashboardGradientCard from "../../../components/HomeDashboardGradientCard";
import {
  getHomeDashboardCardAccent,
  getHomeDashboardCardText,
  homeCardIconBubbleBg,
} from "../../../theme/homeDashboardCardTheme";
import {
  Habit,
  HabitLog,
  fetchHabits,
  fetchAllLogs,
  toggleLog,
} from "../../../services/habitService";

const HABIT_ROWS = 4;
const GRID_DAYS = 7;
const TREND_W = 320;
const TREND_H = 122;
const TREND_PAD_X = 12;
const TREND_PAD_TOP = 8;
const TREND_PAD_BOTTOM = 26;

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Rolling 7-day window ending today. Labels are the weekday initial (M/T/W…). */
function buildLast7Days(): { date: string; label: string; isToday: boolean }[] {
  const out: { date: string; label: string; isToday: boolean }[] = [];
  const todayStr = fmtDate(new Date());
  for (let i = GRID_DAYS - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const str = fmtDate(d);
    const initial = ["S", "M", "T", "W", "T", "F", "S"][d.getDay()];
    out.push({ date: str, label: initial, isToday: str === todayStr });
  }
  return out;
}

function chartPoint(ratio: number, idx: number, count: number): { x: number; y: number } {
  const w = TREND_W - TREND_PAD_X * 2;
  const h = TREND_H - TREND_PAD_TOP - TREND_PAD_BOTTOM;
  const step = count > 1 ? w / (count - 1) : 0;
  const x = TREND_PAD_X + idx * step;
  const y = TREND_PAD_TOP + (1 - ratio) * h;
  return { x, y };
}

const TodayHabitsCard: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user, isGuest } = useAuth();
  const { isDark } = useAppTheme();
  const cardAccent = useMemo(
    () => getHomeDashboardCardAccent("habits", isDark),
    [isDark]
  );
  const txt = useMemo(() => getHomeDashboardCardText(isDark), [isDark]);
  const userId = user?.id;
  const todayStr = useMemo(() => fmtDate(new Date()), []);
  const week = useMemo(() => buildLast7Days(), []);

  const [habits, setHabits] = useState<Habit[]>([]);
  const [allLogs, setAllLogs] = useState<HabitLog[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const load = async () => {
        try {
          const [h, l] = await Promise.all([
            fetchHabits(userId, isGuest),
            fetchAllLogs(userId, isGuest),
          ]);
          if (!cancelled) {
            setHabits(h);
            setAllLogs(l);
          }
        } catch {}
      };
      load();
      return () => {
        cancelled = true;
      };
    }, [userId, isGuest])
  );

  /** Map of habitId → set of completed dates. */
  const logsByHabit = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of allLogs) {
      const set = m.get(l.habit_id) ?? new Set<string>();
      set.add(l.date);
      m.set(l.habit_id, set);
    }
    return m;
  }, [allLogs]);

  const completed = useMemo(
    () => habits.filter((h) => logsByHabit.get(h.id)?.has(todayStr)).length,
    [habits, logsByHabit, todayStr]
  );
  const total = habits.length;
  const progress = total > 0 ? completed / total : 0;

  /** Aggregate completion ratio per day across all habits — powers the 7-day
   *  top-of-card pulse strip. */
  const weeklyRatios = useMemo(() => {
    if (total === 0) return week.map(() => 0);
    return week.map(({ date }) => {
      let done = 0;
      for (const h of habits) {
        if (logsByHabit.get(h.id)?.has(date)) done += 1;
      }
      return done / total;
    });
  }, [habits, logsByHabit, week, total]);

  const handleToggle = useCallback(
    async (habit: Habit) => {
      setAllLogs((prev) => {
        const exists = prev.some(
          (l) => l.habit_id === habit.id && l.date === todayStr
        );
        if (exists)
          return prev.filter(
            (l) => !(l.habit_id === habit.id && l.date === todayStr)
          );
        return [...prev, { habit_id: habit.id, date: todayStr }];
      });
      await toggleLog(habit.id, todayStr, userId, isGuest);
    },
    [todayStr, userId, isGuest]
  );

  const doneAccent = isDark ? "#86EFAC" : "#166534";
  const emptyDotBg = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)";
  const emptyDotBorder = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)";
  const chartLine = isDark ? "#7DD3FC" : "#0284C7";
  const chartLabel = isDark ? "#cbd5e1" : "#64748b";
  const chartGuide = isDark ? "rgba(148,163,184,0.25)" : "rgba(148,163,184,0.35)";

  const statusText = useMemo(() => {
    if (total === 0) return "No habits tracked yet";
    if (progress >= 1) return "All done — beautiful day";
    return `${completed}/${total} done today`;
  }, [progress, total, completed]);

  const activeDays = useMemo(
    () => weeklyRatios.filter((v) => v > 0).length,
    [weeklyRatios]
  );

  const trendPoints = useMemo(
    () => weeklyRatios.map((r, i) => chartPoint(r, i, weeklyRatios.length)),
    [weeklyRatios]
  );
  const trendLinePath = useMemo(() => {
    if (trendPoints.length === 0) return "";
    return trendPoints
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
      .join(" ");
  }, [trendPoints]);
  const trendAreaPath = useMemo(() => {
    if (trendPoints.length === 0) return "";
    const first = trendPoints[0];
    const last = trendPoints[trendPoints.length - 1];
    if (!first || !last) return "";
    const baseY = TREND_H - TREND_PAD_BOTTOM;
    return `${trendLinePath} L ${last.x} ${baseY} L ${first.x} ${baseY} Z`;
  }, [trendLinePath, trendPoints]);

  if (total === 0) {
    return (
      <View style={styles.section}>
        <Pressable
          onPress={() => navigation.navigate("habits")}
          style={({ pressed }) => [styles.press, pressed && styles.pressPressed]}
        >
          <HomeDashboardGradientCard variant="habits">
            <View style={styles.cardBody}>
              <View
                style={[
                  styles.iconWrap,
                  {
                    backgroundColor: homeCardIconBubbleBg(cardAccent, isDark),
                  },
                ]}
              >
                <Ionicons name="flame-outline" size={22} color={cardAccent} />
              </View>
              <View style={styles.copy}>
                <Text style={[styles.kicker, { color: cardAccent }]}>
                  Habits
                </Text>
                <Text style={[styles.title, { color: txt.title }]}>
                  Start tracking habits
                </Text>
                <Text style={[styles.sub, { color: txt.subtitle }]}>
                  Tap to create your first habit
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={txt.chevron}
              />
            </View>
          </HomeDashboardGradientCard>
        </Pressable>
      </View>
    );
  }

  const allDone = progress >= 1;
  const accent = allDone ? doneAccent : cardAccent;

  return (
    <View style={styles.section}>
      <HomeDashboardGradientCard variant="habits">
        <Pressable
          onPress={() => navigation.navigate("habits")}
          style={({ pressed }) => pressed && styles.pressPressed}
        >
          <View style={styles.headerRow}>
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: homeCardIconBubbleBg(accent, isDark) },
              ]}
            >
              <Ionicons
                name={allDone ? "checkmark-done" : "flame"}
                size={22}
                color={accent}
              />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.kicker, { color: accent }]}>
                {statusText}
              </Text>
              <Text style={[styles.title, { color: txt.title }]}>
                Habit tracker
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={txt.chevron}
            />
          </View>

          <View
            style={[
              styles.chartWrap,
              { borderColor: emptyDotBorder, backgroundColor: emptyDotBg },
            ]}
          >
            <Svg width={TREND_W} height={TREND_H}>
              <Defs>
                <SvgLinearGradient id="habitAreaFill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={chartLine} stopOpacity="0.22" />
                  <Stop offset="100%" stopColor={chartLine} stopOpacity="0.04" />
                </SvgLinearGradient>
              </Defs>

              {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                const y =
                  TREND_PAD_TOP +
                  (1 - t) * (TREND_H - TREND_PAD_TOP - TREND_PAD_BOTTOM);
                const pct = `${Math.round(t * 100)}%`;
                return (
                  <React.Fragment key={pct}>
                    <Line
                      x1={TREND_PAD_X}
                      x2={TREND_W - TREND_PAD_X}
                      y1={y}
                      y2={y}
                      stroke={chartGuide}
                      strokeWidth={1}
                      strokeDasharray="2 4"
                    />
                    <SvgText
                      x={2}
                      y={y + 3}
                      fill={chartLabel}
                      fontSize="9"
                      fontWeight="700"
                    >
                      {pct}
                    </SvgText>
                  </React.Fragment>
                );
              })}

              {trendAreaPath ? (
                <Path d={trendAreaPath} fill="url(#habitAreaFill)" />
              ) : null}
              {trendLinePath ? (
                <Path
                  d={trendLinePath}
                  fill="none"
                  stroke={chartLine}
                  strokeWidth={2.2}
                />
              ) : null}

              {trendPoints.map((p, i) => {
                const ratio = weeklyRatios[i] ?? 0;
                const dateInfo = week[i];
                return (
                  <React.Fragment key={dateInfo?.date ?? `${i}`}>
                    <Circle
                      cx={p.x}
                      cy={p.y}
                      r={3.4}
                      fill={isDark ? "#0f172a" : "#ffffff"}
                      stroke={ratio >= 0.999 ? doneAccent : chartLine}
                      strokeWidth={1.8}
                    />
                    <SvgText
                      x={p.x}
                      y={p.y - 8}
                      textAnchor="middle"
                      fill={chartLabel}
                      fontSize="9"
                      fontWeight="700"
                    >
                      {`${Math.round(ratio * 100)}%`}
                    </SvgText>
                    <SvgText
                      x={p.x}
                      y={TREND_H - 8}
                      textAnchor="middle"
                      fill={dateInfo?.isToday ? accent : chartLabel}
                      fontSize="10"
                      fontWeight={dateInfo?.isToday ? "800" : "600"}
                    >
                      {dateInfo?.label ?? ""}
                    </SvgText>
                  </React.Fragment>
                );
              })}
            </Svg>
          </View>
          <Text style={[styles.graphCaption, { color: txt.chevron }]}>
            Active {activeDays}/7 days this week
          </Text>
        </Pressable>

        {/* Per-habit rolling 7-day grid. Tapping the right-most (today) dot
            toggles the habit inline — no need to open the full screen. */}
        <View style={styles.habitList}>
          {habits.slice(0, HABIT_ROWS).map((h) => {
            const completedDates = logsByHabit.get(h.id) ?? new Set<string>();
            const color = h.color || cardAccent;
            return (
              <View key={h.id} style={styles.habitRow}>
                <View style={styles.habitLabelWrap}>
                  <View
                    style={[
                      styles.habitDotIcon,
                      { backgroundColor: color + "22" },
                    ]}
                  >
                    <Ionicons
                      name={h.icon as any}
                      size={12}
                      color={color}
                    />
                  </View>
                  <Text
                    style={[styles.habitName, { color: txt.title }]}
                    numberOfLines={1}
                  >
                    {h.name}
                  </Text>
                </View>
                <View style={styles.dotRow}>
                  {week.map((d) => {
                    const done = completedDates.has(d.date);
                    const todayDot = d.isToday;
                    const isTapTarget = todayDot;
                    const inner = (
                      <View
                        style={[
                          styles.dot,
                          {
                            backgroundColor: done ? color : emptyDotBg,
                            borderColor: todayDot
                              ? color
                              : done
                                ? color
                                : emptyDotBorder,
                            borderWidth: todayDot ? 1.5 : 1,
                          },
                        ]}
                      >
                        {done && (
                          <Ionicons
                            name="checkmark"
                            size={9}
                            color={isDark ? "#0f172a" : "#ffffff"}
                          />
                        )}
                      </View>
                    );
                    if (isTapTarget) {
                      return (
                        <Pressable
                          key={d.date}
                          onPress={() => handleToggle(h)}
                          hitSlop={6}
                        >
                          {inner}
                        </Pressable>
                      );
                    }
                    return <View key={d.date}>{inner}</View>;
                  })}
                </View>
              </View>
            );
          })}
          {habits.length > HABIT_ROWS && (
            <Pressable onPress={() => navigation.navigate("habits")}>
              <Text style={[styles.moreText, { color: accent }]}>
                +{habits.length - HABIT_ROWS} more habits →
              </Text>
            </Pressable>
          )}
        </View>
      </HomeDashboardGradientCard>
    </View>
  );
};

const DOT_SIZE = 16;

const styles = StyleSheet.create({
  section: {
    marginBottom: 16,
  },
  press: {
    borderRadius: 22,
    overflow: "hidden",
  },
  pressPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.995 }],
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
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
    marginTop: 3,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 17,
  },
  chartWrap: {
    marginHorizontal: 16,
    borderWidth: 1,
    borderRadius: 14,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  graphCaption: {
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingBottom: 12,
    letterSpacing: 0.2,
  },
  habitList: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 10,
  },
  habitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  habitLabelWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  habitDotIcon: {
    width: 20,
    height: 20,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  habitName: {
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
    minWidth: 0,
  },
  dotRow: {
    flexDirection: "row",
    gap: 4,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  moreText: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  cardBody: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
});

export default TodayHabitsCard;
