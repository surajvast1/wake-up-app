import React, { useEffect } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  Easing,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const { width: SCREEN_W } = Dimensions.get("window");
const SIZE = Math.min(SCREEN_W * 0.65, 280);
const STROKE = 6;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export interface BreathingPattern {
  name: string;
  phases: { label: string; duration: number; voice: string }[];
}

export const PATTERNS: BreathingPattern[] = [
  {
    name: "4-7-8 Relaxation",
    phases: [
      { label: "Inhale", duration: 4, voice: "Inhale slowly" },
      { label: "Hold", duration: 7, voice: "Hold" },
      { label: "Exhale", duration: 8, voice: "Exhale gently" },
    ],
  },
  {
    name: "Box Breathing",
    phases: [
      { label: "Inhale", duration: 4, voice: "Inhale" },
      { label: "Hold", duration: 4, voice: "Hold" },
      { label: "Exhale", duration: 4, voice: "Exhale" },
      { label: "Hold", duration: 4, voice: "Hold" },
    ],
  },
  {
    name: "Deep Breathing",
    phases: [
      { label: "Inhale", duration: 5, voice: "Inhale deeply" },
      { label: "Exhale", duration: 5, voice: "Exhale slowly" },
    ],
  },
];

interface Props {
  pattern: BreathingPattern;
  paused: boolean;
  color?: string;
  /** Countdown number color (light sessions use a dark slate). */
  countdownColor?: string;
  onPhaseChange?: (voice: string) => void;
}

const BreathingCircle: React.FC<Props> = ({
  pattern,
  paused,
  color = "#7A9972",
  countdownColor = "rgba(255,255,255,0.6)",
  onPhaseChange,
}) => {
  const scale = useSharedValue(0.7);
  const progress = useSharedValue(0);
  const [phaseLabel, setPhaseLabel] = React.useState(
    pattern.phases[0]?.label ?? ""
  );
  const [countdown, setCountdown] = React.useState(
    pattern.phases[0]?.duration ?? 0
  );
  const pausedRef = React.useRef(paused);
  const cancelledRef = React.useRef(false);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    cancelledRef.current = false;

    const runCycle = async () => {
      while (!cancelledRef.current) {
        for (const phase of pattern.phases) {
          if (cancelledRef.current) return;

          while (pausedRef.current && !cancelledRef.current) {
            await new Promise((r) => setTimeout(r, 200));
          }
          if (cancelledRef.current) return;

          setPhaseLabel(phase.label);
          setCountdown(phase.duration);
          onPhaseChange?.(phase.voice);

          const isInhale = phase.label === "Inhale";
          const isExhale = phase.label === "Exhale";

          scale.value = withTiming(isInhale ? 1 : isExhale ? 0.7 : scale.value, {
            duration: phase.duration * 1000,
            easing: Easing.inOut(Easing.ease),
          });

          progress.value = 0;
          progress.value = withTiming(1, {
            duration: phase.duration * 1000,
            easing: Easing.linear,
          });

          for (let t = phase.duration; t > 0; t--) {
            if (cancelledRef.current) return;
            setCountdown(t);
            await new Promise((r) => setTimeout(r, 1000));
            while (pausedRef.current && !cancelledRef.current) {
              await new Promise((r) => setTimeout(r, 200));
            }
          }
        }
      }
    };

    runCycle();
    return () => {
      cancelledRef.current = true;
    };
  }, [pattern]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const progressProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.ring, ringStyle]}>
        <Svg width={SIZE} height={SIZE}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={STROKE}
            fill="none"
          />
          <AnimatedCircle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={color}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE}
            strokeLinecap="round"
            rotation="-90"
            origin={`${SIZE / 2},${SIZE / 2}`}
            animatedProps={progressProps}
          />
        </Svg>
        <View style={styles.center}>
          <Text style={[styles.phaseLabel, { color }]}>{phaseLabel}</Text>
          <Text style={[styles.countdown, { color: countdownColor }]}>{countdown}</Text>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 24,
  },
  ring: {
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  phaseLabel: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 1,
  },
  countdown: {
    fontSize: 48,
    fontWeight: "200",
    marginTop: 4,
  },
});

export default React.memo(BreathingCircle);
