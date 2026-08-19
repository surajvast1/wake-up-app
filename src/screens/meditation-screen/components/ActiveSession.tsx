import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import BreathingCircle, { BreathingPattern } from "./BreathingCircle";
import { Chakra } from "./ChakraSelector";
import { useAuth } from "../../../contexts/AuthContext";
import { saveSession } from "../../../services/meditationService";

const { width: SCREEN_W } = Dimensions.get("window");

export type SessionMode = "breathing" | "timer" | "chakra";

interface Props {
  visible: boolean;
  mode: SessionMode;
  durationSec: number;
  pattern: BreathingPattern;
  chakra: Chakra | null;
  onClose: () => void;
  onComplete: () => void;
}

const formatTime = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const speak = (text: string) => {
  try {
    Speech.speak(text, { rate: 0.85, pitch: 1.0 });
  } catch {}
};

const stopSpeech = () => {
  try {
    Speech.stop();
  } catch {}
};

const ActiveSession: React.FC<Props> = ({
  visible,
  mode,
  durationSec,
  pattern,
  chakra,
  onClose,
  onComplete,
}) => {
  const { user, isGuest } = useAuth();
  const [remaining, setRemaining] = useState(durationSec);
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const startedRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef = useRef(false);
  const elapsedRef = useRef(0);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    if (!visible) {
      startedRef.current = false;
      setRemaining(durationSec);
      setPaused(false);
      setDone(false);
      elapsedRef.current = 0;
      return;
    }

    if (startedRef.current) return;
    startedRef.current = true;
    elapsedRef.current = 0;
    setRemaining(durationSec);
    setDone(false);
    setPaused(false);

    if (voiceOn) {
      if (mode === "chakra" && chakra) {
        speak(`Focus on your ${chakra.name} chakra. ${chakra.affirmation}`);
      } else {
        speak("Begin. Close your eyes and breathe.");
      }
    }

    intervalRef.current = setInterval(() => {
      if (pausedRef.current) return;
      elapsedRef.current += 1;
      setRemaining((r) => {
        const next = r - 1;
        if (next <= 0) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      stopSpeech();
    };
  }, [visible, durationSec]);

  useEffect(() => {
    if (remaining === 0 && startedRef.current && !done) {
      setDone(true);
      if (voiceOn) speak("Session complete. Well done.");
      void saveSession(
        elapsedRef.current,
        mode,
        mode === "breathing" ? pattern.name : undefined,
        mode === "chakra" && chakra ? chakra.name : undefined,
        user?.id,
        isGuest
      );
    }
  }, [remaining, done, mode, pattern.name, chakra?.name, user?.id, isGuest]);

  const onPhaseChange = useCallback(
    (voice: string) => {
      if (voiceOn) speak(voice);
    },
    [voiceOn]
  );

  const handleStop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    stopSpeech();
    if (elapsedRef.current > 10) {
      void saveSession(
        elapsedRef.current,
        mode,
        mode === "breathing" ? pattern.name : undefined,
        mode === "chakra" && chakra ? chakra.name : undefined,
        user?.id,
        isGuest
      );
    }
    onClose();
  }, [mode, pattern, chakra, onClose, user?.id, isGuest]);

  const handleDoneClose = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const accentColor =
    mode === "chakra" && chakra ? chakra.color : "#5B7553";
  const bgColors: [string, string, string] =
    mode === "chakra" && chakra
      ? [chakra.gradient[0] + "18", "#f8faf8", "#ffffff"]
      : ["#f8faf8", "#fbfbfb", "#ffffff"];

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <LinearGradient colors={bgColors} style={styles.container}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => setVoiceOn((v) => !v)}
            style={styles.iconBtn}
          >
            <Ionicons
              name={voiceOn ? "volume-high" : "volume-mute"}
              size={22}
              color="#64748b"
            />
          </Pressable>
          <Text style={styles.modeLabel}>
            {mode === "breathing"
              ? pattern.name
              : mode === "chakra" && chakra
              ? `${chakra.name} Chakra`
              : "Meditation"}
          </Text>
          <Pressable onPress={handleStop} style={styles.iconBtn}>
            <Ionicons name="close" size={22} color="#64748b" />
          </Pressable>
        </View>

        {done ? (
          /* Completion view */
          <View style={styles.doneContainer}>
            <View style={[styles.doneBadge, { backgroundColor: accentColor + "22" }]}>
              <Ionicons name="checkmark-circle" size={64} color={accentColor} />
            </View>
            <Text style={styles.doneTitle}>Session Complete</Text>
            <Text style={styles.doneStat}>
              {Math.round(elapsedRef.current / 60)} min {elapsedRef.current % 60}s
            </Text>
            {mode === "chakra" && chakra && (
              <Text style={[styles.doneChakra, { color: chakra.color }]}>
                {chakra.name} Chakra Aligned
              </Text>
            )}
            <Pressable
              onPress={handleDoneClose}
              style={({ pressed }) => [
                styles.doneBtn,
                { backgroundColor: accentColor },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </Pressable>
          </View>
        ) : (
          /* Active session */
          <View style={styles.sessionBody}>
            {/* Chakra info card */}
            {mode === "chakra" && chakra && (
              <View style={styles.chakraInfo}>
                <View style={[styles.chakraDot, { backgroundColor: chakra.color }]} />
                <View style={styles.chakraTextCol}>
                  <Text style={[styles.chakraName, { color: chakra.color }]}>
                    {chakra.name}
                  </Text>
                  <Text style={styles.chakraFocus}>{chakra.focus}</Text>
                </View>
              </View>
            )}

            {/* Breathing circle (shown in breathing & chakra modes) */}
            {(mode === "breathing" || mode === "chakra") && (
              <BreathingCircle
                pattern={pattern}
                paused={paused}
                color={accentColor}
                countdownColor="#94a3b8"
                onPhaseChange={onPhaseChange}
              />
            )}

            {/* Timer-only mode: large countdown */}
            {mode === "timer" && (
              <View style={styles.timerOnly}>
                <Text style={styles.timerBig}>{formatTime(remaining)}</Text>
                <Text style={styles.timerHint}>Focus on your breath</Text>
              </View>
            )}

            {/* Countdown (for breathing/chakra) */}
            {mode !== "timer" && (
              <Text style={styles.countdown}>{formatTime(remaining)}</Text>
            )}

            {/* Controls */}
            <View style={styles.controls}>
              <Pressable
                onPress={() => setPaused((p) => !p)}
                style={({ pressed }) => [
                  styles.controlBtn,
                  { backgroundColor: accentColor },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Ionicons
                  name={paused ? "play" : "pause"}
                  size={28}
                  color="#fff"
                />
              </Pressable>
              <Pressable
                onPress={handleStop}
                style={({ pressed }) => [
                  styles.controlBtn,
                  styles.stopBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Ionicons name="stop" size={24} color="#475569" />
              </Pressable>
            </View>

            {paused && (
              <Text style={styles.pausedLabel}>Paused</Text>
            )}
          </View>
        )}
      </LinearGradient>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 8,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  modeLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#334155",
  },
  sessionBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  chakraInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  chakraDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  chakraTextCol: {
    flex: 1,
  },
  chakraName: {
    fontSize: 16,
    fontWeight: "800",
  },
  chakraFocus: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 2,
  },
  countdown: {
    fontSize: 36,
    fontWeight: "200",
    color: "#64748b",
    marginTop: 8,
    letterSpacing: 4,
  },
  timerOnly: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 60,
  },
  timerBig: {
    fontSize: 72,
    fontWeight: "200",
    color: "#0f172a",
    letterSpacing: 6,
  },
  timerHint: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 12,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    marginTop: 32,
  },
  controlBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  stopBtn: {
    backgroundColor: "#e2e8f0",
  },
  pausedLabel: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: "700",
    color: "#94a3b8",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  doneContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  doneBadge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  doneTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 8,
  },
  doneStat: {
    fontSize: 18,
    fontWeight: "600",
    color: "#64748b",
  },
  doneChakra: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 8,
  },
  doneBtn: {
    marginTop: 32,
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 18,
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
  },
});

export default ActiveSession;
