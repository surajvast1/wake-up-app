import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../../../contexts/AuthContext";
import {
  Task,
  fetchTasksByDate,
  toggleComplete,
} from "../../../services/taskService";

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const RING_SIZE = 72;
const RING_SIZE_COMPACT = 52;
const STROKE = 7;
const STROKE_COMPACT = 5;
const DASHBOARD_TASK_LIMIT = 6;

interface ProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
}

const ProgressRing: React.FC<ProgressRingProps> = ({
  progress,
  size = RING_SIZE,
  strokeWidth = STROKE,
}) => {
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(1, Math.max(0, progress)));

  return (
    <Svg width={size} height={size}>
      <Circle
        cx={center}
        cy={center}
        r={radius}
        stroke="rgba(255,255,255,0.2)"
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Circle
        cx={center}
        cy={center}
        r={radius}
        stroke="#ffffff"
        strokeWidth={strokeWidth}
        strokeDasharray={`${circumference}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        fill="none"
        transform={`rotate(-90 ${center} ${center})`}
      />
    </Svg>
  );
};

interface TodayTasksCardProps {
  compact?: boolean;
}

const TodayTasksCard: React.FC<TodayTasksCardProps> = ({ compact }) => {
  const navigation = useNavigation<any>();
  const { user, isGuest } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const today = fmtDate(new Date());
      const data = await fetchTasksByDate(today, user?.id, isGuest);
      setTasks(data);
    } catch {
      setTasks([]);
    }
    setLoading(false);
  }, [user?.id, isGuest]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          const today = fmtDate(new Date());
          const data = await fetchTasksByDate(today, user?.id, isGuest);
          if (!cancelled) setTasks(data);
        } catch {}
        if (!cancelled) setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
    }, [user?.id, isGuest])
  );

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const completed = tasks.filter((t) => t.completed).length;
  const total = tasks.length;
  const progress = total > 0 ? completed / total : 0;

  const emoji = useMemo(() => {
    if (total === 0) return "📋";
    if (progress >= 1) return "🎉";
    if (progress >= 0.75) return "💪";
    if (progress >= 0.5) return "🔥";
    if (progress > 0) return "✨";
    return "📝";
  }, [progress, total]);

  const statusText = useMemo(() => {
    if (total === 0) return "No tasks for today";
    if (progress >= 1) return "All done! Amazing!";
    if (progress >= 0.75) return "Almost there!";
    if (progress >= 0.5) return "Great progress!";
    if (completed > 0) return "Keep going!";
    return "Let's get started!";
  }, [progress, total, completed]);

  const displayTasks = useMemo(() => {
    const list = [...tasks];
    list.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return (a.time || "").localeCompare(b.time || "");
    });
    return list.slice(0, DASHBOARD_TASK_LIMIT);
  }, [tasks]);

  const handleToggleTask = useCallback(
    async (t: Task) => {
      const next = !t.completed;
      setTasks((prev) =>
        prev.map((x) => (x.id === t.id ? { ...x, completed: next } : x))
      );
      try {
        await toggleComplete(t.id, next, user?.id, isGuest);
      } catch {
        await reload();
      }
    },
    [user?.id, isGuest, reload]
  );

  const ringSize = compact ? RING_SIZE_COMPACT : RING_SIZE;
  const strokeW = compact ? STROKE_COMPACT : STROKE;

  return (
    <View style={compact ? styles.touchFull : undefined}>
      <LinearGradient
        colors={
          progress >= 1
            ? ["#22c55e", "#16a34a"]
            : ["#5B7553", "#7A9972"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, compact && styles.cardCompact]}
      >
        <View style={styles.topRow}>
          <View style={[styles.leftCol, compact && styles.leftColCompact]}>
            <View style={[styles.titleRow, compact && styles.titleRowCompact]}>
              <Ionicons
                name="checkmark-circle"
                size={compact ? 14 : 18}
                color="rgba(255,255,255,0.8)"
              />
              <Text style={[styles.title, compact && styles.titleCompact]}>
                {compact ? "Tasks" : "Today's Tasks"}
              </Text>
            </View>
            <Text style={[styles.countText, compact && styles.countTextCompact]}>
              {completed}
              <Text style={styles.countDim}>/{total}</Text>
              {compact ? "" : " completed"}
            </Text>
            {!compact ? (
              <Text style={styles.statusText}>{statusText}</Text>
            ) : (
              <Text
                style={[styles.statusText, styles.statusTextCompact]}
                numberOfLines={1}
              >
                {statusText}
              </Text>
            )}
          </View>

          <Animated.View
            style={[
              styles.ringWrap,
              compact && styles.ringWrapCompact,
              { transform: [{ scale: pulseAnim }] },
            ]}
          >
            <ProgressRing
              progress={progress}
              size={ringSize}
              strokeWidth={strokeW}
            />
            <Text
              style={[styles.ringEmoji, compact && styles.ringEmojiCompact]}
            >
              {emoji}
            </Text>
          </Animated.View>
        </View>

        {!loading && total > 0 && (
          <View style={[styles.taskList, compact && styles.taskListCompact]}>
            {displayTasks.map((t) => (
              <TouchableOpacity
                key={t.id}
                activeOpacity={0.75}
                onPress={() => handleToggleTask(t)}
                style={[styles.taskRow, compact && styles.taskRowCompact]}
              >
                <Ionicons
                  name={t.completed ? "checkbox" : "square-outline"}
                  size={compact ? 20 : 22}
                  color={
                    t.completed
                      ? "rgba(255,255,255,0.95)"
                      : "rgba(255,255,255,0.65)"
                  }
                />
                <View style={styles.taskRowText}>
                  <Text
                    style={[
                      styles.taskTitle,
                      compact && styles.taskTitleCompact,
                      t.completed && styles.taskTitleDone,
                    ]}
                    numberOfLines={1}
                  >
                    {t.title}
                  </Text>
                  {t.time ? (
                    <Text
                      style={[
                        styles.taskTime,
                        compact && styles.taskTimeCompact,
                      ]}
                    >
                      {t.time}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))}
            {total > DASHBOARD_TASK_LIMIT && (
              <Text style={styles.moreLabel}>
                +{total - DASHBOARD_TASK_LIMIT} more in Tasks
              </Text>
            )}
          </View>
        )}

        {!compact && !loading && total === 0 && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate("tasks")}
            style={styles.emptyHintRow}
          >
            <Text style={styles.emptyHint}>Tap to add your first task</Text>
            <Ionicons
              name="arrow-forward"
              size={16}
              color="rgba(255,255,255,0.7)"
            />
          </TouchableOpacity>
        )}

        {compact && !loading && total === 0 && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate("tasks")}
            style={styles.emptyHintRowCompact}
          >
            <Text style={styles.emptyHintCompact}>Tap to add tasks</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate("tasks")}
          style={[styles.bottomRow, compact && styles.bottomRowCompact]}
        >
          <Text style={[styles.tapHint, compact && styles.tapHintCompact]}>
            {compact ? "Open Tasks" : "Tap to view & complete tasks"}
          </Text>
          <Ionicons
            name="arrow-forward"
            size={compact ? 14 : 16}
            color="rgba(255,255,255,0.7)"
          />
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  touchFull: {
    width: "100%",
    alignSelf: "stretch",
  },
  card: {
    borderRadius: 20,
    padding: 18,
  },
  cardCompact: {
    borderRadius: 16,
    padding: 11,
    width: "100%",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  leftCol: { flex: 1, paddingRight: 16 },
  leftColCompact: { paddingRight: 10 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  titleRowCompact: { marginBottom: 4 },
  title: {
    fontSize: 14,
    fontWeight: "800",
    color: "rgba(255,255,255,0.85)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  titleCompact: {
    fontSize: 10,
    letterSpacing: 0.35,
  },
  countText: {
    fontSize: 28,
    fontWeight: "900",
    color: "#ffffff",
  },
  countTextCompact: {
    fontSize: 20,
  },
  countDim: {
    fontWeight: "600",
    color: "rgba(255,255,255,0.6)",
  },
  statusText: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  statusTextCompact: {
    fontSize: 11,
    marginTop: 4,
    lineHeight: 14,
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  ringWrapCompact: {
    width: RING_SIZE_COMPACT,
    height: RING_SIZE_COMPACT,
  },
  ringEmoji: {
    position: "absolute",
    fontSize: 26,
  },
  ringEmojiCompact: {
    fontSize: 20,
  },
  taskList: {
    marginTop: 12,
    gap: 6,
  },
  taskListCompact: {
    marginTop: 8,
    gap: 4,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  taskRowCompact: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    gap: 8,
  },
  taskRowText: {
    flex: 1,
    minWidth: 0,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
  taskTitleCompact: {
    fontSize: 13,
  },
  taskTitleDone: {
    textDecorationLine: "line-through",
    opacity: 0.75,
  },
  taskTime: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.55)",
    marginTop: 2,
  },
  taskTimeCompact: {
    fontSize: 10,
    marginTop: 1,
  },
  moreLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.55)",
    marginTop: 4,
    marginLeft: 2,
  },
  emptyHintRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingVertical: 8,
  },
  emptyHintRowCompact: {
    marginTop: 8,
    paddingVertical: 4,
  },
  emptyHint: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.75)",
  },
  emptyHintCompact: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.75)",
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
  },
  bottomRowCompact: {
    marginTop: 8,
  },
  tapHint: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.6)",
  },
  tapHintCompact: {
    fontSize: 11,
  },
});

export default TodayTasksCard;
