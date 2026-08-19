// src/screens/task-screen/DayTasksCard.tsx
import React, { useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Animated, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import useDayTasks from "../../hooks/useDayTasks";

interface Props {
  compact?: boolean;
}

//Make the text area little bigger

const DayTasksCard: React.FC<Props> = ({ compact }) => {
  const { tasks, loading, error, addFromText, toggleTask, clearCompleted, clearToday } = useDayTasks();
  const [input, setInput] = useState<string>("");
  const btnScale = useRef(new Animated.Value(1)).current;

  const allDone = useMemo(() => tasks.length > 0 && tasks.every((t) => t.done), [tasks]);

  const onCreate = async () => {
    if (!input.trim()) return;
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 1.05, duration: 100, useNativeDriver: true }),
      Animated.spring(btnScale, { toValue: 1, useNativeDriver: true }),
    ]).start();
    await addFromText(input.trim());
    setInput("");
  };

  return (
    <LinearGradient colors={["#F5F7F4", "#E8EDE6"]} style={styles.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Plan Your Day</Text>
        {allDone ? <Text style={styles.celebrate}>🎉 Great job!</Text> : null}
      </View>
      <Text style={styles.subtitle}>Tell me about your day, I’ll make a checklist</Text>

      <View style={styles.inputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Tell me about your day…"
          placeholderTextColor="#475569"
          style={styles.input}
          multiline
          textAlignVertical="top"
          returnKeyType="done"
          numberOfLines={4}
          blurOnSubmit
        />
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <Pressable
            onPress={onCreate}
            disabled={loading}
            style={({ pressed }) => [styles.goBtn, pressed && { opacity: 0.9 }, loading && { opacity: 0.7 }]}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Feather name="plus" color="#fff" size={18} />}
          </Pressable>
        </Animated.View>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ScrollView
        style={{ flexGrow: 0 }}
        showsVerticalScrollIndicator
        persistentScrollbar
        nestedScrollEnabled
        scrollEventThrottle={16}
        overScrollMode="always"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 4 }}
      >
        {tasks.map((t) => (
          <Pressable key={t.id} onPress={() => toggleTask(t.id)} style={({ pressed }) => [styles.taskRow, pressed && { opacity: 0.9 }]}>
            <View style={[styles.checkbox, t.done && styles.checkboxOn]}>
              {t.done ? <Feather name="check" size={14} color="#fff" /> : null}
            </View>
            <Text style={[styles.taskText, t.done && styles.taskTextDone]} numberOfLines={2}>
              {t.title}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.footerRow}>
        <Pressable onPress={clearCompleted} style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.8 }]}>
          <Text style={styles.clearText}>Clear completed</Text>
        </Pressable>
        <Pressable onPress={clearToday} style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.8 }]}>
          <Text style={styles.clearText}>Clear today</Text>
        </Pressable>
        <Text style={styles.countText}>
          {tasks.filter((t) => t.done).length}/{tasks.length} done
        </Text>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({  
  card: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.18)",
    backgroundColor: "rgba(255,255,255,0.7)",
    flexShrink: 1,
    alignSelf: "stretch",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  title: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  celebrate: { fontSize: 16, color: "#0f172a" },
  subtitle: { color: "#334155", marginBottom: 10 },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end", // keep this
    marginBottom: 4,        // slight spacing
  },  
  input: {
    flex: 1,
    minHeight: 70,          // ⬅️ was 40 (too small)
    maxHeight: 140,         // ⬅️ allows comfortable growth
    borderWidth: 1,
    borderColor: "rgba(30,58,138,0.25)",
    borderRadius: 14,       // slightly rounder = softer
    paddingHorizontal: 14,  // more breathing room
    paddingVertical: 12,    // ⬅️ BIG difference
    backgroundColor: "#fff",
    color: "#0f172a",
    fontSize: 15,           // ⬅️ improves readability
    lineHeight: 22,         // ⬅️ prevents cramped lines
  },  
  goBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#5B7553",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#5B7553",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginLeft: 8,
  },
  error: { color: "#b91c1c", marginTop: 6 },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#5B7553",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    backgroundColor: "#fff",
  },
  checkboxOn: {
    backgroundColor: "#5B7553",
  },
  taskText: { color: "#0f172a", flex: 1 },
  taskTextDone: { color: "#475569", textDecorationLine: "line-through" },
  footerRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  clearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  clearText: { color: "#0f172a", fontSize: 12, fontWeight: "600" },
  countText: { color: "#0f172a", fontSize: 12, fontWeight: "600" },
});

export default DayTasksCard;


