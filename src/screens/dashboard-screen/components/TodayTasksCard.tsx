import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../../../contexts/AuthContext";
import { useAppTheme } from "../../../contexts/ThemeContext";
import {
  Task,
  createTask,
  fetchTasksByDate,
  toggleComplete,
} from "../../../services/taskService";

const PRIORITIES: Task["priority"][] = ["low", "medium", "high"];
const PRIORITY_COLORS: Record<Task["priority"], string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#ef4444",
};

function todayKey(): string {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

const TodayTasksCard: React.FC = () => {
  const { user, isGuest } = useAuth();
  const { colors } = useAppTheme();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const titleInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!showComposer) return;
    const focusTimer = setTimeout(() => titleInputRef.current?.focus(), 250);
    return () => clearTimeout(focusTimer);
  }, [showComposer]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setTasks(await fetchTasksByDate(todayKey(), user?.id, isGuest));
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [isGuest, user?.id]);

  useFocusEffect(useCallback(() => {
    void reload();
  }, [reload]));

  const completed = tasks.filter((task) => task.completed).length;
  const visibleTasks = useMemo(() => tasks, [tasks]);

  const saveTask = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    setLoading(true);
    try {
      const created = await createTask(
        {
          title: cleanTitle,
          description: description.trim(),
          date: todayKey(),
          time: "",
          priority,
          completed: false,
        },
        user?.id,
        isGuest
      );
      setTasks((current) => [...current, created]);
      setTitle("");
      setDescription("");
      setPriority("medium");
      setShowComposer(false);
    } finally {
      setLoading(false);
    }
  };

  const toggle = async (task: Task) => {
    const next = !task.completed;
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, completed: next } : item));
    await toggleComplete(task.id, next, user?.id, isGuest);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Today’s tasks</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {completed}/{tasks.length} completed
          </Text>
        </View>
        <Pressable
          onPress={() => setShowComposer(true)}
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          accessibilityLabel="Add task"
        >
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      {loading && tasks.length === 0 ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : visibleTasks.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textMuted }]}>Add one small thing to make today count.</Text>
      ) : (
        visibleTasks.map((task) => (
          <Pressable key={task.id} onPress={() => void toggle(task)} style={styles.taskRow}>
            <View style={[styles.checkbox, { borderColor: PRIORITY_COLORS[task.priority] }, task.completed && { backgroundColor: PRIORITY_COLORS[task.priority] }]}>
              {task.completed ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
            </View>
            <View style={styles.taskCopy}>
              <Text style={[styles.taskTitle, { color: colors.text }, task.completed && styles.completed]} numberOfLines={1}>{task.title}</Text>
              <Text style={[styles.priority, { color: PRIORITY_COLORS[task.priority] }]}>{task.priority} priority</Text>
            </View>
          </Pressable>
        ))
      )}

      <Modal visible={showComposer} transparent animationType="slide" onRequestClose={() => setShowComposer(false)}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>New task</Text>
              <Pressable onPress={() => setShowComposer(false)}><Ionicons name="close" size={24} color={colors.textMuted} /></Pressable>
            </View>
            <TextInput
              ref={titleInputRef}
              value={title}
              onChangeText={setTitle}
              placeholder="What needs to be done?"
              placeholderTextColor={colors.placeholder}
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
              autoFocus
            />
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Description (optional)"
              placeholderTextColor={colors.placeholder}
              style={[styles.input, styles.descriptionInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
              multiline
            />
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Priority</Text>
            <View style={styles.priorityRow}>
              {PRIORITIES.map((item) => (
                <Pressable key={item} onPress={() => setPriority(item)} style={[styles.priorityChoice, { borderColor: PRIORITY_COLORS[item] }, priority === item && { backgroundColor: PRIORITY_COLORS[item] }]}>
                  <Text style={{ color: priority === item ? "#fff" : PRIORITY_COLORS[item], fontWeight: "800", textTransform: "capitalize" }}>{item}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => void saveTask()} disabled={!title.trim() || loading} style={[styles.saveButton, { backgroundColor: colors.primary }, (!title.trim() || loading) && { opacity: 0.5 }]}>
              <Text style={styles.saveText}>{loading ? "Saving…" : "Add task"}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: 24, borderWidth: 1, padding: 18, marginTop: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 18, fontWeight: "900" },
  subtitle: { fontSize: 12, fontWeight: "700", marginTop: 3 },
  addButton: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  loader: { marginVertical: 24 },
  empty: { fontSize: 14, fontWeight: "600", marginTop: 20, marginBottom: 4 },
  taskRow: { flexDirection: "row", alignItems: "center", paddingTop: 16 },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, alignItems: "center", justifyContent: "center", marginRight: 12 },
  taskCopy: { flex: 1 },
  taskTitle: { fontSize: 15, fontWeight: "800" },
  completed: { textDecorationLine: "line-through", opacity: 0.55 },
  priority: { fontSize: 11, fontWeight: "800", marginTop: 3, textTransform: "capitalize" },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  modal: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 34 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  modalTitle: { fontSize: 22, fontWeight: "900" },
  input: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, marginBottom: 12 },
  descriptionInput: { minHeight: 82, textAlignVertical: "top" },
  fieldLabel: { fontSize: 12, fontWeight: "800", marginBottom: 9, textTransform: "uppercase", letterSpacing: 0.6 },
  priorityRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  priorityChoice: { flex: 1, borderRadius: 12, borderWidth: 1.5, alignItems: "center", paddingVertical: 11 },
  saveButton: { alignItems: "center", borderRadius: 14, paddingVertical: 15 },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "900" },
});

export default TodayTasksCard;
