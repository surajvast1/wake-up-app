import React, { useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAppTheme } from "../../../contexts/ThemeContext";
import HomeDashboardGradientCard from "../../../components/HomeDashboardGradientCard";
import {
  getHomeDashboardCardAccent,
  getHomeDashboardCardText,
  homeCardIconBubbleBg,
} from "../../../theme/homeDashboardCardTheme";
import { useRoutineHomeWidget } from "../hooks/routineHooks";
import { routineTypeLabel } from "../routineLabels";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const StartYourDayCard: React.FC = () => {
  const { isDark } = useAppTheme();
  const accent = useMemo(
    () => getHomeDashboardCardAccent("routine", isDark),
    [isDark]
  );
  const txt = useMemo(() => getHomeDashboardCardText(isDark), [isDark]);
  const navigation = useNavigation();
  const {
    loading,
    visible,
    routine,
    session,
    remaining,
    progressLabel,
    quickToggleItem,
  } = useRoutineHomeWidget();

  const progressAnim = useRef(new Animated.Value(0)).current;
  const scaleCard = useRef(new Animated.Value(1)).current;
  const opacityPress = useRef(new Animated.Value(1)).current;

  const pct =
    session && session.mandatoryTotal > 0
      ? session.mandatoryDone / session.mandatoryTotal
      : 0;

  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.timing(progressAnim, {
      toValue: pct,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [pct, progressAnim]);

  if (loading || !visible || !routine || !session) {
    return null;
  }

  const kicker =
    routine.routine_type === "custom"
      ? "Your routine"
      : `${routineTypeLabel(routine.routine_type)} routine`;
  const headerIcon =
    (routine.icon as keyof typeof Ionicons.glyphMap) || "albums-outline";

  const barW = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const openRoutine = () => {
    (navigation as { navigate: (a: string, b?: object) => void }).navigate(
      "routines",
      {
        screen: "RoutineToday",
        params: { routineId: routine.id },
      }
    );
  };

  const onPressIn = () => {
    Animated.parallel([
      Animated.spring(scaleCard, {
        toValue: 0.98,
        friction: 6,
        tension: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityPress, {
        toValue: 0.92,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const onPressOut = () => {
    Animated.parallel([
      Animated.spring(scaleCard, {
        toValue: 1,
        friction: 5,
        tension: 280,
        useNativeDriver: true,
      }),
      Animated.spring(opacityPress, {
        toValue: 1,
        friction: 6,
        tension: 280,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const sub =
    remaining === 1
      ? "1 item left in your routine"
      : `${remaining} items left in your routine`;

  const pending = session.items.filter((i) => !i.done).slice(0, 3);

  return (
    <View style={styles.sectionWrap}>
      <Animated.View
        style={{
          transform: [{ scale: scaleCard }],
          opacity: opacityPress,
        }}
      >
        <HomeDashboardGradientCard variant="routine">
          <Pressable
            onPress={openRoutine}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            style={styles.cardPressable}
          >
            <View style={styles.topRow}>
              <View
                style={[
                  styles.iconBubble,
                  {
                    backgroundColor: homeCardIconBubbleBg(accent, isDark),
                  },
                ]}
              >
                <Ionicons name={headerIcon} size={22} color={accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.kicker, { color: accent }]}
                >
                  {kicker}
                </Text>
                <Text style={[styles.title, { color: txt.title }]}>
                  {routine.name}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={txt.chevron}
              />
            </View>

            <View style={styles.progressBlock}>
              <View style={styles.progressMeta}>
                <Text style={[styles.progressText, { color: txt.title }]}>
                  {progressLabel} completed
                </Text>
                <Text style={[styles.remain, { color: accent }]}>{sub}</Text>
              </View>
              <View
                style={[
                  styles.track,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.12)"
                      : accent + "33",
                  },
                ]}
              >
                <Animated.View
                  style={[
                    styles.fill,
                    {
                      width: barW,
                      backgroundColor: accent,
                    },
                  ]}
                />
              </View>
            </View>
          </Pressable>

          {pending.length > 0 ? (
            <View style={styles.quickRow} pointerEvents="box-none">
              {pending.map((i, idx) => (
                <TouchableOpacity
                  key={i.id}
                  activeOpacity={0.75}
                  onPress={() => {
                    void quickToggleItem(i.id);
                  }}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  style={[
                    styles.chip,
                    {
                      borderColor: isDark
                        ? "rgba(255,255,255,0.12)"
                        : accent + "18",
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.06)"
                        : accent + "08",
                      marginRight: idx < pending.length - 1 ? 8 : 0,
                      marginBottom: 8,
                    },
                  ]}
                >
                  <Text
                    style={[styles.chipTxt, { color: txt.subtitle }]}
                    numberOfLines={1}
                  >
                    {i.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </HomeDashboardGradientCard>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  sectionWrap: {
    marginBottom: 16,
  },
  cardPressable: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 4,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  kicker: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    marginTop: 2,
    letterSpacing: -0.3,
  },
  progressBlock: { marginTop: 18 },
  progressMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 10,
  },
  progressText: { fontSize: 14, fontWeight: "700" },
  remain: { fontSize: 13, fontWeight: "600" },
  track: {
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  fill: {
    height: 6,
    borderRadius: 999,
  },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 16,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: "100%",
  },
  chipTxt: { fontSize: 12, fontWeight: "600", maxWidth: 200 },
});

export default StartYourDayCard;
