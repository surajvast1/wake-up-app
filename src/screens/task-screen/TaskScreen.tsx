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
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Animated,
  LayoutAnimation,
  UIManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../contexts/AuthContext";
import { useAppTheme } from "../../contexts/ThemeContext";
import MenuButton from "../../components/MenuButton";
import {
  createTaskStyles,
  type TaskScreenStyles,
} from "./taskScreenStyles";
import {
  Task,
  fetchTasksByDate,
  createTask,
  updateTask,
  deleteTask,
  toggleComplete,
} from "../../services/taskService";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

let _notif: any = null;
function getNotif() {
  if (_notif) return _notif;
  try {
    const mod = require("expo-notifications");
    if (!mod?.scheduleNotificationAsync || !mod?.getPermissionsAsync) return null;
    if (mod.setNotificationHandler) {
      mod.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    }
    _notif = mod;
    return _notif;
  } catch {
    return null;
  }
}

const { width: SCREEN_W } = Dimensions.get("window");
const DAY_W = SCREEN_W / 7;
const DAYS_RANGE = 60;
const PRIORITY_COLORS = { low: "#22c55e", medium: "#f59e0b", high: "#ef4444" };
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const ANIM_CONFIG = LayoutAnimation.create(
  280,
  LayoutAnimation.Types.easeInEaseOut,
  LayoutAnimation.Properties.opacity
);

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function buildDayList(): { date: Date; key: string }[] {
  const arr: { date: Date; key: string }[] = [];
  const today = new Date();
  for (let i = -DAYS_RANGE; i <= DAYS_RANGE; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    d.setHours(0, 0, 0, 0);
    arr.push({ date: d, key: fmtDate(d) });
  }
  return arr;
}

async function ensureNotifPermissions() {
  try {
    const N = getNotif();
    if (!N) return;
    const { status } = await N.getPermissionsAsync();
    if (status !== "granted") await N.requestPermissionsAsync();
  } catch {}
}

async function scheduleTaskReminder(task: Task, date: string) {
  if (!task.time) return;
  try {
    const N = getNotif();
    if (!N) return;
    await ensureNotifPermissions();
    await N.cancelScheduledNotificationAsync(task.id).catch(() => {});
    const [h, m] = task.time.split(":").map(Number);
    const target = new Date(date + "T00:00:00");
    target.setHours(h, m, 0, 0);
    if (target.getTime() <= Date.now() + 60_000) return;
    const secondsUntil = Math.max(
      1,
      Math.floor((target.getTime() - Date.now()) / 1000)
    );
    await N.scheduleNotificationAsync({
      identifier: task.id,
      content: {
        title: "⏰ Task Reminder",
        body: task.title,
        sound: "default",
      },
      trigger: { seconds: secondsUntil },
    });
  } catch {}
}

async function cancelTaskReminder(taskId: string) {
  try {
    const N = getNotif();
    if (!N) return;
    await N.cancelScheduledNotificationAsync(taskId);
  } catch {}
}

// ─── TaskItem with animations ──────────────────────────
interface TaskItemProps {
  task: Task;
  styles: TaskScreenStyles;
  onToggle: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
}

const TaskItem: React.FC<TaskItemProps> = React.memo(
  ({ task, styles: sty, onToggle, onEdit, onDelete }) => {
    const checkScale = useRef(new Animated.Value(1)).current;
    const sparkleOpacity = useRef(new Animated.Value(0)).current;
    const sparkleScale = useRef(new Animated.Value(0.5)).current;

    const handleToggle = () => {
      if (!task.completed) {
        Animated.parallel([
          Animated.sequence([
            Animated.timing(checkScale, {
              toValue: 1.5,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.spring(checkScale, {
              toValue: 1,
              friction: 3,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.parallel([
              Animated.timing(sparkleOpacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
              }),
              Animated.spring(sparkleScale, {
                toValue: 1.2,
                friction: 3,
                useNativeDriver: true,
              }),
            ]),
            Animated.timing(sparkleOpacity, {
              toValue: 0,
              duration: 600,
              useNativeDriver: true,
            }),
          ]),
        ]).start(() => {
          sparkleScale.setValue(0.5);
        });
      }
      onToggle(task);
    };

    return (
      <View style={sty.taskCard}>
        <TouchableOpacity
          activeOpacity={0.5}
          onPress={handleToggle}
          style={sty.checkWrap}
        >
          <Animated.View style={{ transform: [{ scale: checkScale }] }}>
            <View
              style={[
                sty.checkbox,
                task.completed && {
                  backgroundColor: PRIORITY_COLORS[task.priority],
                  borderColor: PRIORITY_COLORS[task.priority],
                },
              ]}
            >
              {task.completed && (
                <Ionicons name="checkmark" size={14} color="#fff" />
              )}
            </View>
          </Animated.View>
          <Animated.Text
            style={[
              sty.sparkle,
              {
                opacity: sparkleOpacity,
                transform: [{ scale: sparkleScale }],
              },
            ]}
          >
            ✅
          </Animated.Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.6}
          onPress={() => onEdit(task)}
          style={sty.taskInfo}
        >
          <Text
            style={[sty.taskTitle, task.completed && sty.taskTitleDone]}
            numberOfLines={1}
          >
            {task.title}
          </Text>
          {task.time !== "" && (
            <View style={sty.timeRow}>
              <Ionicons name="time-outline" size={11} color="#94a3b8" />
              <Text style={sty.taskTime}>{task.time}</Text>
              <Ionicons
                name="notifications-outline"
                size={10}
                color="#7A9972"
              />
            </View>
          )}
        </TouchableOpacity>

        <View
          style={[
            sty.priorityBadge,
            { backgroundColor: PRIORITY_COLORS[task.priority] + "20" },
          ]}
        >
          <View
            style={[
              sty.priorityDot,
              { backgroundColor: PRIORITY_COLORS[task.priority] },
            ]}
          />
          <Text
            style={[
              sty.priorityText,
              { color: PRIORITY_COLORS[task.priority] },
            ]}
          >
            {task.priority}
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.5}
          onPress={() => onDelete(task)}
          style={sty.deleteBtn}
        >
          <View style={sty.deleteBtnInner}>
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
          </View>
        </TouchableOpacity>
      </View>
    );
  }
);

// ─── Main Screen ───────────────────────────────────────
const TaskScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { user, isGuest } = useAuth();
  const { colors: themeColors } = useAppTheme();
  const styles = useMemo(
    () => createTaskStyles(themeColors),
    [themeColors]
  );
  const userId = user?.id;

  const days = useMemo(() => buildDayList(), []);
  const todayStr = useMemo(() => fmtDate(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [time, setTime] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">(
    "medium"
  );

  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerHour, setPickerHour] = useState(9);
  const [pickerMin, setPickerMin] = useState(0);

  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [toastMsg, setToastMsg] = useState("");
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const calRef = useRef<FlatList>(null);

  useEffect(() => {
    void loadTasks(selectedDate);
  }, [selectedDate, userId, isGuest]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    Animated.sequence([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.delay(1500),
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const loadTasks = async (date: string) => {
    try {
      const data = await fetchTasksByDate(date, userId, isGuest);
      LayoutAnimation.configureNext(ANIM_CONFIG);
      setTasks(data);
    } catch {
      setTasks([]);
    }
  };

  const scrollToToday = useCallback(() => {
    const idx = days.findIndex((d) => d.key === todayStr);
    if (idx >= 0) {
      calRef.current?.scrollToIndex({
        index: idx,
        viewOffset: SCREEN_W / 2 - DAY_W / 2,
        animated: false,
      });
    }
  }, [days, todayStr]);

  const handleToggle = async (task: Task) => {
    const next = !task.completed;
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, completed: next } : t))
    );
    try {
      await toggleComplete(task.id, next, userId, isGuest);
    } catch {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, completed: !next } : t))
      );
    }
  };

  const handleDeletePress = (task: Task) => {
    setDeleteTarget(task);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const taskToDelete = deleteTarget;
    setDeleteTarget(null);
    LayoutAnimation.configureNext(ANIM_CONFIG);
    setTasks((prev) => prev.filter((t) => t.id !== taskToDelete.id));
    showToast("Task deleted");
    try {
      await cancelTaskReminder(taskToDelete.id);
      await deleteTask(taskToDelete.id, userId, isGuest);
    } catch {
      await loadTasks(selectedDate);
    }
  };

  const openAdd = () => {
    setEditingTask(null);
    setTitle("");
    setDescription("");
    setTime("");
    setPriority("medium");
    setModalVisible(true);
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || "");
    setTime(task.time || "");
    setPriority(task.priority);
    setModalVisible(true);
  };

  const openTimePicker = () => {
    if (time) {
      const parts = time.split(":");
      setPickerHour(parseInt(parts[0], 10) || 9);
      setPickerMin(parseInt(parts[1], 10) || 0);
    } else {
      const now = new Date();
      setPickerHour(now.getHours());
      setPickerMin(Math.round(now.getMinutes() / 5) * 5);
    }
    setShowTimePicker(true);
  };

  const confirmTime = () => {
    setTime(`${pad2(pickerHour)}:${pad2(pickerMin)}`);
    setShowTimePicker(false);
  };

  const clearTime = () => {
    setTime("");
    setShowTimePicker(false);
  };

  const handleSave = async () => {
    if (!title.trim()) return;

    let savedTask: Task;
    if (editingTask) {
      const updates = {
        title: title.trim(),
        description: description.trim(),
        time: time.trim(),
        priority,
      };
      await updateTask(editingTask.id, updates, userId, isGuest);
      savedTask = { ...editingTask, ...updates };
      showToast("Task updated");
    } else {
      savedTask = await createTask(
        {
          title: title.trim(),
          description: description.trim(),
          date: selectedDate,
          time: time.trim(),
          priority,
          completed: false,
        },
        userId,
        isGuest
      );
      showToast("Task created");
    }

    if (savedTask.time) {
      await scheduleTaskReminder(savedTask, savedTask.date || selectedDate);
    } else if (editingTask) {
      await cancelTaskReminder(editingTask.id);
    }

    setModalVisible(false);
    await loadTasks(selectedDate);
  };

  const selDate = useMemo(() => {
    const d = new Date(selectedDate + "T00:00:00");
    return `${SHORT_DAYS[d.getDay()]}, ${d.getDate()} ${SHORT_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }, [selectedDate]);

  const completedCount = tasks.filter((t) => t.completed).length;

  const renderDay = ({ item }: { item: { date: Date; key: string } }) => {
    const isToday = item.key === todayStr;
    const isSelected = item.key === selectedDate;
    const showMonth = item.date.getDate() === 1 || item.key === days[0]?.key;
    return (
      <Pressable
        onPress={() => setSelectedDate(item.key)}
        style={[styles.dayCell, isSelected && styles.dayCellSelected]}
      >
        {showMonth && (
          <Text
            style={[styles.monthTag, isSelected && styles.dayTextSelected]}
          >
            {SHORT_MONTHS[item.date.getMonth()]}
          </Text>
        )}
        <Text
          style={[styles.dayName, isSelected && styles.dayTextSelected]}
        >
          {SHORT_DAYS[item.date.getDay()]}
        </Text>
        <Text
          style={[
            styles.dayNum,
            isSelected && styles.dayTextSelected,
            isToday && !isSelected && styles.dayNumToday,
          ]}
        >
          {item.date.getDate()}
        </Text>
        {isToday && (
          <View
            style={[styles.todayDot, isSelected && styles.todayDotSelected]}
          />
        )}
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <MenuButton />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tasks</Text>
        <Text style={styles.headerDate}>{selDate}</Text>
      </View>

      <FlatList
        ref={calRef}
        data={days}
        renderItem={renderDay}
        keyExtractor={(item) => item.key}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.calStrip}
        contentContainerStyle={{ paddingHorizontal: 8 }}
        getItemLayout={(_, index) => ({
          length: DAY_W,
          offset: DAY_W * index,
          index,
        })}
        onLayout={scrollToToday}
        initialScrollIndex={DAYS_RANGE}
      />

      {tasks.length > 0 && (
        <View style={styles.progressRow}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${(completedCount / tasks.length) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {completedCount}/{tasks.length}
          </Text>
        </View>
      )}

      <FlatList
        data={tasks}
        renderItem={({ item }) => (
          <TaskItem
            task={item}
            styles={styles}
            onToggle={handleToggle}
            onEdit={openEdit}
            onDelete={handleDeletePress}
          />
        )}
        keyExtractor={(item) => item.id}
        extraData={{ tasks, styles }}
        contentContainerStyle={styles.taskList}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitle}>No tasks yet</Text>
            <Text style={styles.emptySub}>
              Tap + to add a task for this day
            </Text>
          </View>
        }
      />

      {/* ─── Toast ─── */}
      <Animated.View
        pointerEvents="none"
        style={[styles.toast, { opacity: toastOpacity }]}
      >
        <View style={styles.toastInner}>
          <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
          <Text style={styles.toastText}>{toastMsg}</Text>
        </View>
      </Animated.View>

      {/* ─── FAB ─── */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={openAdd}
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
      >
        <LinearGradient
          colors={["#5B7553", "#7A9972"]}
          style={styles.fabGrad}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      {/* ─── Delete Confirmation Modal ─── */}
      <Modal
        visible={deleteTarget !== null}
        animationType="fade"
        transparent
      >
        <View style={styles.delOverlay}>
          <View style={styles.delCard}>
            <View style={styles.delIconWrap}>
              <LinearGradient
                colors={[
                  themeColors.dangerSoftBg,
                  themeColors.surfaceMuted,
                ]}
                style={styles.delIconCircle}
              >
                <Ionicons name="trash" size={30} color="#ef4444" />
              </LinearGradient>
            </View>
            <Text style={styles.delTitle}>Delete Task?</Text>
            <Text style={styles.delMsg} numberOfLines={2}>
              &quot;{deleteTarget?.title}&quot; will be removed permanently.
            </Text>
            <View style={styles.delActions}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setDeleteTarget(null)}
                style={styles.delCancelBtn}
              >
                <Text style={styles.delCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={confirmDelete}
                style={styles.delConfirmBtn}
              >
                <LinearGradient
                  colors={["#ef4444", "#dc2626"]}
                  style={styles.delConfirmGrad}
                >
                  <Ionicons name="trash-outline" size={16} color="#fff" />
                  <Text style={styles.delConfirmText}>Delete</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Add / Edit Modal ─── */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingTask ? "Edit Task" : "New Task"}
              </Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Ionicons
                  name="close"
                  size={24}
                  color={themeColors.iconMuted}
                />
              </Pressable>
            </View>

            <Text style={styles.modalLabel}>Title</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="What needs to be done?"
              placeholderTextColor={themeColors.placeholder}
              value={title}
              onChangeText={setTitle}
            />

            <Text style={styles.modalLabel}>Description</Text>
            <TextInput
              style={[styles.modalInput, { minHeight: 70 }]}
              placeholder="Add details (optional)"
              placeholderTextColor={themeColors.placeholder}
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <View style={styles.modalRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Time & Reminder</Text>
                <Pressable onPress={openTimePicker} style={styles.timeBtn}>
                  <Ionicons
                    name="notifications-outline"
                    size={16}
                    color={themeColors.primary}
                  />
                  <Text
                    style={[
                      styles.timeBtnText,
                      !time && { color: themeColors.textMuted },
                    ]}
                  >
                    {time || "Set time"}
                  </Text>
                </Pressable>
              </View>
              <View style={{ width: 16 }} />
              <View style={{ flex: 1.5 }}>
                <Text style={styles.modalLabel}>Priority</Text>
                <View style={styles.priorityRow}>
                  {(["low", "medium", "high"] as const).map((p) => (
                    <Pressable
                      key={p}
                      onPress={() => setPriority(p)}
                      style={[
                        styles.prioBtn,
                        priority === p && {
                          backgroundColor: PRIORITY_COLORS[p] + "20",
                          borderColor: PRIORITY_COLORS[p],
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.prioBtnText,
                          priority === p && { color: PRIORITY_COLORS[p] },
                        ]}
                      >
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            {time !== "" && (
              <View style={styles.reminderNote}>
                <Ionicons
                  name="notifications"
                  size={13}
                  color={themeColors.primaryLight}
                />
                <Text style={styles.reminderNoteText}>
                  You&apos;ll be reminded at {time}
                </Text>
              </View>
            )}

            <Pressable
              onPress={handleSave}
              style={({ pressed }) => [
                styles.saveBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.saveBtnText}>
                {editingTask ? "Update" : "Add Task"}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Time Picker Modal ─── */}
      <Modal visible={showTimePicker} animationType="fade" transparent>
        <View style={styles.tpOverlay}>
          <View style={styles.tpCard}>
            <Text style={styles.tpTitle}>Set Time</Text>
            <View style={styles.tpDisplay}>
              <Text style={styles.tpBigTime}>
                {pad2(pickerHour)}:{pad2(pickerMin)}
              </Text>
            </View>
            <View style={styles.tpRow}>
              <View style={styles.tpCol}>
                <Text style={styles.tpLabel}>Hour</Text>
                <ScrollView
                  style={styles.tpScroll}
                  showsVerticalScrollIndicator={false}
                >
                  {HOURS.map((h) => (
                    <Pressable
                      key={h}
                      onPress={() => setPickerHour(h)}
                      style={[
                        styles.tpCell,
                        pickerHour === h && styles.tpCellActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.tpCellText,
                          pickerHour === h && styles.tpCellTextActive,
                        ]}
                      >
                        {pad2(h)}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
              <Text style={styles.tpColon}>:</Text>
              <View style={styles.tpCol}>
                <Text style={styles.tpLabel}>Min</Text>
                <ScrollView
                  style={styles.tpScroll}
                  showsVerticalScrollIndicator={false}
                >
                  {MINUTES.map((m) => (
                    <Pressable
                      key={m}
                      onPress={() => setPickerMin(m)}
                      style={[
                        styles.tpCell,
                        pickerMin === m && styles.tpCellActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.tpCellText,
                          pickerMin === m && styles.tpCellTextActive,
                        ]}
                      >
                        {pad2(m)}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>
            <View style={styles.tpActions}>
              <Pressable onPress={clearTime} style={styles.tpSecBtn}>
                <Text style={styles.tpSecBtnText}>No Time</Text>
              </Pressable>
              <Pressable
                onPress={confirmTime}
                style={({ pressed }) => [
                  styles.tpDoneBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.tpDoneBtnText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default TaskScreen;
