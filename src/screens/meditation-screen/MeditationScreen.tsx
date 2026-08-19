import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useRoute,
  useNavigation,
  useFocusEffect,
} from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import MenuButton from "../../components/MenuButton";
import { useAuth } from "../../contexts/AuthContext";
import { useAppTheme } from "../../contexts/ThemeContext";
import type { AppColors } from "../../theme/colors";
import StatsBar from "./components/StatsBar";
import ModeCards, { MeditationMode } from "./components/ModeCards";
import WeekChart from "./components/WeekChart";
import MonthChart from "./components/MonthChart";
import ChakraSelector, { Chakra, CHAKRAS } from "./components/ChakraSelector";
import ActiveSession from "./components/ActiveSession";
import { PATTERNS, BreathingPattern } from "./components/BreathingCircle";
import {
  getTodaySessionCount,
  getTotalMinutesThisMonth,
  getDaysActiveThisMonth,
  getStreak,
  getWeekMinutes,
  getMonthMinutes,
  getCurrentMonthTitle,
  hydrateMeditationFromSupabase,
  DayMinutes,
} from "../../services/meditationService";

const DURATION_OPTIONS = [
  { label: "5 min", sec: 300 },
  { label: "10 min", sec: 600 },
  { label: "15 min", sec: 900 },
  { label: "20 min", sec: 1200 },
];

type MeditationNavParams = { startTimerSec?: number };

function createMeditationStyles(c: AppColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    content: {
      paddingHorizontal: 20,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 20,
    },
    title: {
      fontSize: 30,
      fontWeight: "900",
      color: c.text,
    },
    subtitle: {
      fontSize: 14,
      fontWeight: "600",
      color: c.textSecondary,
      marginTop: 4,
    },
    streakBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "rgba(245,158,11,0.15)",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(245,158,11,0.25)",
    },
    streakText: {
      fontSize: 16,
      fontWeight: "900",
      color: "#f59e0b",
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: c.text,
      marginBottom: 12,
    },

    /* Bottom sheet */
    sheetOverlay: {
      flex: 1,
      backgroundColor: c.overlay,
    },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 40,
      borderTopWidth: 1,
      borderColor: c.border,
    },
    sheetTall: {
      maxHeight: "70%",
    },
    sheetTitle: {
      fontSize: 20,
      fontWeight: "900",
      color: c.text,
      marginBottom: 16,
    },
    sheetItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: c.surfaceMuted,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: c.border,
    },
    sheetItemLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    sheetItemTitle: {
      fontSize: 15,
      fontWeight: "800",
      color: c.text,
    },
    sheetItemSub: {
      fontSize: 11,
      fontWeight: "600",
      color: c.textSecondary,
      marginTop: 2,
    },
    sheetCancel: {
      alignItems: "center",
      paddingVertical: 12,
      marginTop: 4,
    },
    sheetCancelText: {
      fontSize: 14,
      fontWeight: "700",
      color: c.textSecondary,
    },
    sheetStartBtn: {
      alignItems: "center",
      backgroundColor: c.primary,
      borderRadius: 16,
      paddingVertical: 14,
      marginTop: 12,
    },
    sheetStartText: {
      fontSize: 16,
      fontWeight: "800",
      color: "#fff",
    },

    /* Duration chips */
    durRow: {
      flexDirection: "row",
      gap: 10,
      marginVertical: 12,
    },
    durChip: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: c.surfaceMuted,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    durChipActive: {
      borderColor: c.primary,
      backgroundColor: c.primarySoftBg,
    },
    durChipText: {
      fontSize: 14,
      fontWeight: "700",
      color: c.textSecondary,
    },
    durChipTextActive: {
      color: c.primary,
    },

    /* Chakra preview */
    chakraPreview: {
      marginTop: 14,
      backgroundColor: c.surfaceMuted,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: c.border,
    },
    chakraPreviewName: {
      fontSize: 16,
      fontWeight: "800",
    },
    chakraPreviewFocus: {
      fontSize: 13,
      fontWeight: "600",
      color: c.textSecondary,
      marginTop: 4,
    },
    chakraAffirmation: {
      fontSize: 13,
      fontWeight: "600",
      color: c.textMuted,
      fontStyle: "italic",
      marginTop: 8,
      lineHeight: 19,
    },
  });
}

const MeditationScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors: c } = useAppTheme();
  const styles = useMemo(() => createMeditationStyles(c), [c]);
  const route = useRoute();
  const navigation = useNavigation();
  const { user, isGuest, storageScope } = useAuth();

  const [sessionsToday, setSessionsToday] = useState(0);
  const [minutesMonth, setMinutesMonth] = useState(0);
  const [daysActiveMonth, setDaysActiveMonth] = useState(0);
  const [streak, setStreak] = useState(0);
  const [weekData, setWeekData] = useState<DayMinutes[]>([]);
  const [monthData, setMonthData] = useState<DayMinutes[]>([]);
  const [monthTitle, setMonthTitle] = useState("");

  // Sub-picker state
  const [pickerMode, setPickerMode] = useState<MeditationMode | null>(null);
  const [selectedPattern, setSelectedPattern] = useState<BreathingPattern>(PATTERNS[0]);
  const [selectedDuration, setSelectedDuration] = useState(600);
  const [selectedChakra, setSelectedChakra] = useState<Chakra | null>(null);

  // Active session
  const [sessionVisible, setSessionVisible] = useState(false);
  const [sessionMode, setSessionMode] = useState<MeditationMode>("breathing");
  const [sessionDuration, setSessionDuration] = useState(300);
  const [sessionPattern, setSessionPattern] = useState<BreathingPattern>(PATTERNS[0]);
  const [sessionChakra, setSessionChakra] = useState<Chakra | null>(null);

  const loadStats = useCallback(async () => {
    const [count, mm, da, s, week, month, title] = await Promise.all([
      getTodaySessionCount(storageScope),
      getTotalMinutesThisMonth(storageScope),
      getDaysActiveThisMonth(storageScope),
      getStreak(storageScope),
      getWeekMinutes(storageScope),
      getMonthMinutes(storageScope),
      Promise.resolve(getCurrentMonthTitle()),
    ]);
    setSessionsToday(count);
    setMinutesMonth(mm);
    setDaysActiveMonth(da);
    setStreak(s);
    setWeekData(week);
    setMonthData(month);
    setMonthTitle(title);
  }, [storageScope]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (user?.id && !isGuest) {
          await hydrateMeditationFromSupabase(user.id, storageScope);
        }
        if (!cancelled) await loadStats();
      })();
      return () => {
        cancelled = true;
      };
    }, [user?.id, isGuest, storageScope, loadStats])
  );

  const onModeSelect = useCallback((mode: MeditationMode) => {
    setPickerMode(mode);
  }, []);

  const startSession = useCallback(
    (mode: MeditationMode, dur: number, pat: BreathingPattern, chk: Chakra | null) => {
      setSessionMode(mode);
      setSessionDuration(dur);
      setSessionPattern(pat);
      setSessionChakra(chk);
      setPickerMode(null);
      setSessionVisible(true);
    },
    []
  );

  useEffect(() => {
    const p = route.params as MeditationNavParams | undefined;
    const sec = p?.startTimerSec;
    if (typeof sec !== "number" || sec <= 0) return;
    (navigation as unknown as { setParams: (p: object) => void }).setParams({
      startTimerSec: undefined,
    });
    const t = setTimeout(() => {
      startSession("timer", sec, PATTERNS[2], null);
    }, 280);
    return () => clearTimeout(t);
  }, [route.params, navigation, startSession]);

  const onSessionClose = useCallback(() => {
    setSessionVisible(false);
    loadStats();
  }, [loadStats]);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: 110 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ paddingLeft: 42 }}>
            <Text style={styles.title}>Meditate</Text>
            <Text style={styles.subtitle}>
              Calm your mind, find your peace
            </Text>
          </View>
          {streak > 0 && (
            <View style={styles.streakBadge}>
              <Ionicons name="flame" size={16} color="#f59e0b" />
              <Text style={styles.streakText}>{streak}</Text>
            </View>
          )}
        </View>

        <StatsBar
          sessionsToday={sessionsToday}
          minutesThisMonth={minutesMonth}
          daysActiveThisMonth={daysActiveMonth}
          streak={streak}
        />

        <Text style={styles.sectionTitle}>Choose Your Practice</Text>
        <ModeCards onSelect={onModeSelect} />

        {weekData.length > 0 && <WeekChart data={weekData} />}
        {monthData.length > 0 && (
          <MonthChart
            data={monthData}
            daysActive={daysActiveMonth}
            monthTitle={monthTitle}
          />
        )}
      </ScrollView>

      {/* Sub-pickers */}
      {/* Breathing pattern picker */}
      <Modal
        visible={pickerMode === "breathing"}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerMode(null)}
      >
        <Pressable style={styles.sheetOverlay} onPress={() => setPickerMode(null)}>
          <View />
        </Pressable>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Choose a Breathing Pattern</Text>
          {PATTERNS.map((p) => (
            <Pressable
              key={p.name}
              onPress={() => {
                setSelectedPattern(p);
                const totalCycleSec = p.phases.reduce((s, ph) => s + ph.duration, 0);
                startSession("breathing", totalCycleSec * 5, p, null);
              }}
              style={({ pressed }) => [
                styles.sheetItem,
                pressed && { opacity: 0.7 },
              ]}
            >
              <View style={styles.sheetItemLeft}>
                <Ionicons name="leaf" size={20} color={c.primaryLight} />
                <View>
                  <Text style={styles.sheetItemTitle}>{p.name}</Text>
                  <Text style={styles.sheetItemSub}>
                    {p.phases.map((ph) => `${ph.label} ${ph.duration}s`).join(" → ")}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />
            </Pressable>
          ))}
          <Pressable onPress={() => setPickerMode(null)} style={styles.sheetCancel}>
            <Text style={styles.sheetCancelText}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>

      {/* Timer duration picker */}
      <Modal
        visible={pickerMode === "timer"}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerMode(null)}
      >
        <Pressable style={styles.sheetOverlay} onPress={() => setPickerMode(null)}>
          <View />
        </Pressable>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Choose Duration</Text>
          <View style={styles.durRow}>
            {DURATION_OPTIONS.map((opt) => (
              <Pressable
                key={opt.sec}
                onPress={() => setSelectedDuration(opt.sec)}
                style={[
                  styles.durChip,
                  selectedDuration === opt.sec && styles.durChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.durChipText,
                    selectedDuration === opt.sec && styles.durChipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={() =>
              startSession("timer", selectedDuration, PATTERNS[2], null)
            }
            style={({ pressed }) => [
              styles.sheetStartBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.sheetStartText}>Start Meditation</Text>
          </Pressable>
          <Pressable onPress={() => setPickerMode(null)} style={styles.sheetCancel}>
            <Text style={styles.sheetCancelText}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>

      {/* Chakra picker */}
      <Modal
        visible={pickerMode === "chakra"}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerMode(null)}
      >
        <Pressable style={styles.sheetOverlay} onPress={() => setPickerMode(null)}>
          <View />
        </Pressable>
        <View style={[styles.sheet, styles.sheetTall]}>
          <Text style={styles.sheetTitle}>Choose a Chakra</Text>
          <ChakraSelector
            selected={selectedChakra}
            onSelect={setSelectedChakra}
          />
          {selectedChakra && (
            <View style={styles.chakraPreview}>
              <Text style={[styles.chakraPreviewName, { color: selectedChakra.color }]}>
                {selectedChakra.name} — {selectedChakra.sanskrit}
              </Text>
              <Text style={styles.chakraPreviewFocus}>{selectedChakra.focus}</Text>
              <Text style={styles.chakraAffirmation}>
                "{selectedChakra.affirmation}"
              </Text>
            </View>
          )}
          <View style={styles.durRow}>
            {DURATION_OPTIONS.slice(0, 3).map((opt) => (
              <Pressable
                key={opt.sec}
                onPress={() => setSelectedDuration(opt.sec)}
                style={[
                  styles.durChip,
                  selectedDuration === opt.sec && styles.durChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.durChipText,
                    selectedDuration === opt.sec && styles.durChipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={() => {
              if (selectedChakra)
                startSession("chakra", selectedDuration, PATTERNS[2], selectedChakra);
            }}
            style={({ pressed }) => [
              styles.sheetStartBtn,
              !selectedChakra && { opacity: 0.4 },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.sheetStartText}>Begin Chakra Session</Text>
          </Pressable>
          <Pressable onPress={() => setPickerMode(null)} style={styles.sheetCancel}>
            <Text style={styles.sheetCancelText}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>

      {/* Active session */}
      <ActiveSession
        visible={sessionVisible}
        mode={sessionMode}
        durationSec={sessionDuration}
        pattern={sessionPattern}
        chakra={sessionChakra}
        onClose={onSessionClose}
        onComplete={onSessionClose}
      />

      <MenuButton />
    </View>
  );
};

export default MeditationScreen;
