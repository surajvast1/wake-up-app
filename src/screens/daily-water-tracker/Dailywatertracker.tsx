import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Animated } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";

const STORAGE_KEY = "@water_tracker_state";
const TOTAL_STEPS = 12;

const getTodayKey = () => new Date().toISOString().split("T")[0];

const DailyWaterTracker: React.FC = () => {
  const [count, setCount] = useState<number>(0);
  const [todayKey, setTodayKey] = useState<string>(getTodayKey());
  const btnScale = useRef(new Animated.Value(1)).current;
  const emojiScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { date: string; count: number };
          if (parsed.date === getTodayKey()) {
            setCount(Math.min(TOTAL_STEPS, Math.max(0, parsed.count || 0)));
            setTodayKey(parsed.date);
          } else {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ date: getTodayKey(), count: 0 }));
            setCount(0);
            setTodayKey(getTodayKey());
          }
        } else {
          const today = getTodayKey();
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, count: 0 }));
          setTodayKey(today);
        }
      } catch {
        // ignore: non-critical
      }
    })();
  }, []);

  // Reset automatically at midnight without requiring an app reload
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const currentKey = getTodayKey();
        if (currentKey !== todayKey) {
          setTodayKey(currentKey);
          setCount(0);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ date: currentKey, count: 0 }));
        }
      } catch {
        // ignore
      }
    }, 60_000); // check every minute
    return () => clearInterval(interval);
  }, [todayKey]);

  const saveCount = async (next: number) => {
    setCount(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ date: getTodayKey(), count: next }));
    } catch {
      // ignore
    }
  };

  const handlePlus = () => {
    if (count >= TOTAL_STEPS) return;
    const next = Math.min(TOTAL_STEPS, count + 1);
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 1.15, duration: 120, useNativeDriver: true }),
      Animated.spring(btnScale, { toValue: 1, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.timing(emojiScale, { toValue: 1.2, duration: 120, useNativeDriver: true }),
      Animated.spring(emojiScale, { toValue: 1, useNativeDriver: true }),
    ]).start();
    saveCount(next);
  };

  const progress = count / TOTAL_STEPS;
  const mood = useMemo(() => {
    if (progress >= 1) return "🥳";
    if (progress >= 0.75) return "😄";
    if (progress >= 0.5) return "🙂";
    if (progress >= 0.25) return "😌";
    return "🥱";
  }, [progress]);

  const filledColor = "#3b82f6";
  const emptyColor = "#bfdbfe";

  const rows = useMemo(() => {
    const arr = Array.from({ length: TOTAL_STEPS }, (_, i) => i < count);
    return [arr.slice(0, 6), arr.slice(6, 12)];
  }, [count]);

  return (
    <LinearGradient colors={["#dbeafe", "#93c5fd"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Hydration</Text>
        <Animated.Text style={[styles.mood, { transform: [{ scale: emojiScale }] }]}>{mood}</Animated.Text>
      </View>
      <Text style={styles.subtitle}>{count}/{TOTAL_STEPS} glasses</Text>

      <View style={{ height: 8 }} />
      <View style={styles.row}>
        {rows[0].map((filled, idx) => (
          <View key={`r1-${idx}`} style={[styles.step, { backgroundColor: filled ? filledColor : emptyColor }]} />
        ))}
      </View>
      <View style={styles.row}>
        {rows[1].map((filled, idx) => (
          <View key={`r2-${idx}`} style={[styles.step, { backgroundColor: filled ? filledColor : emptyColor }]} />
        ))}
      </View>

      <View style={styles.actionsRow}>
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <Pressable onPress={handlePlus} style={({ pressed }) => [styles.plusBtn, pressed && { opacity: 0.9 }]}>
            <Text style={styles.plusText}>+</Text>
          </Pressable>
        </Animated.View>
        {count >= TOTAL_STEPS && (
          <Text style={styles.celebrate}>Beautiful! You hit your goal today 💧</Text>
        )}
      </View>
      <Text style={styles.hint}>Tap + every time you sip water</Text>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(37,99,235,0.18)",
    backgroundColor: "rgba(255,255,255,0.65)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  mood: { fontSize: 22 },
  subtitle: { color: "#1e3a8a", marginTop: 2, fontWeight: "600" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  step: {
    height: 14,
    flex: 1,
    marginHorizontal: 3,
    borderRadius: 6,
  },
  actionsRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  plusBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1d4ed8",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1d4ed8",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  plusText: { color: "#fff", fontSize: 22, fontWeight: "900" },
  celebrate: { marginLeft: 10, color: "#1e293b", fontWeight: "700" },
  hint: { marginTop: 8, color: "#1e3a8a", fontSize: 12 },
});

export default DailyWaterTracker;
    