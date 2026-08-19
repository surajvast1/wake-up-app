import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../../../contexts/ThemeContext";
import type { RoutineLog } from "../types";

interface Props {
  visible: boolean;
  routineName: string;
  accent: string;
  streak: number;
  log: RoutineLog | null;
  onClose: () => void;
}

function formatDurationMs(ms: number): string {
  if (ms < 60000) return `${Math.max(1, Math.round(ms / 1000))} sec`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return s > 0 ? `${m}m ${s}s` : `${m} min`;
}

const RoutineCompletionOverlay: React.FC<Props> = ({
  visible,
  routineName,
  accent,
  streak,
  log,
  onClose,
}) => {
  const { colors, isDark } = useAppTheme();
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      fade.setValue(0);
      scale.setValue(0.9);
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 1,
          duration: 380,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 7,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fade, scale]);

  let durationLabel = "—";
  if (log?.started_at) {
    const end = log.completed_at
      ? new Date(log.completed_at).getTime()
      : Date.now();
    const start = new Date(log.started_at).getTime();
    durationLabel = formatDurationMs(Math.max(0, end - start));
  }

  const gradColors: [string, string, string] = isDark
    ? [accent + "35", colors.surfaceElevated, colors.surface]
    : [accent + "35", "#ffffff", colors.surfaceMuted];

  return (
    <Modal visible={visible} transparent animationType="none">
      <Animated.View style={[styles.backdrop, { opacity: fade, backgroundColor: colors.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ scale }] },
          ]}
        >
          <LinearGradient
            colors={gradColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.grad}
          >
            <View style={[styles.badge, { backgroundColor: accent + "25" }]}>
              <Ionicons name="sparkles" size={28} color={accent} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>
              Routine completed
            </Text>
            <Text style={[styles.sub, { color: colors.textSecondary }]}>
              {routineName}
            </Text>

            <View style={styles.statsRow}>
              <View
                style={[
                  styles.stat,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(255,255,255,0.85)",
                  },
                ]}
              >
                <Ionicons name="timer-outline" size={22} color={accent} />
                <Text style={[styles.statVal, { color: colors.text }]}>
                  {durationLabel}
                </Text>
                <Text style={[styles.statLbl, { color: colors.textMuted }]}>
                  Time
                </Text>
              </View>
              <View
                style={[
                  styles.stat,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(255,255,255,0.85)",
                  },
                ]}
              >
                <Ionicons name="trophy-outline" size={22} color={accent} />
                <Text style={[styles.statVal, { color: colors.text }]}>
                  {streak}
                </Text>
                <Text style={[styles.statLbl, { color: colors.textMuted }]}>
                  Day streak
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.cta,
                { backgroundColor: accent },
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.ctaTxt}>Beautiful work</Text>
            </Pressable>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  sheet: {
    borderRadius: 28,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  grad: {
    paddingVertical: 36,
    paddingHorizontal: 28,
    alignItems: "center",
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  sub: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 28,
    marginBottom: 8,
  },
  stat: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: "center",
    gap: 6,
  },
  statVal: {
    fontSize: 20,
    fontWeight: "900",
  },
  statLbl: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  cta: {
    marginTop: 22,
    alignSelf: "stretch",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  ctaTxt: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
});

export default RoutineCompletionOverlay;
