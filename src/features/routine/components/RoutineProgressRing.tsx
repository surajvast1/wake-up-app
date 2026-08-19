import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 118;
const STROKE = 8;
const R = (SIZE - STROKE) / 2;
const CX = SIZE / 2;
const CY = SIZE / 2;
const CIRC = 2 * Math.PI * R;

interface RoutineProgressRingProps {
  progress: number;
  color: string;
  trackColor: string;
  label?: string;
  sublabel?: string;
  metaColor?: string;
}

const RoutineProgressRing: React.FC<RoutineProgressRingProps> = ({
  progress,
  color,
  trackColor,
  label,
  sublabel,
  metaColor = "rgba(0,0,0,0.38)",
}) => {
  const p = useSharedValue(0);

  useEffect(() => {
    const target = Math.max(0, Math.min(1, progress));
    p.value = withTiming(target, {
      duration: 720,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, p]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRC * (1 - p.value),
  }));

  return (
    <View style={styles.wrap}>
      <Svg width={SIZE} height={SIZE} style={styles.svg}>
        <Circle
          cx={CX}
          cy={CY}
          r={R}
          stroke={trackColor}
          strokeWidth={STROKE}
          fill="none"
        />
        <AnimatedCircle
          cx={CX}
          cy={CY}
          r={R}
          stroke={color}
          strokeWidth={STROKE}
          fill="none"
          strokeDasharray={`${CIRC}`}
          strokeLinecap="round"
          rotation="-90"
          origin={`${CX}, ${CY}`}
          animatedProps={animatedProps}
        />
      </Svg>
      <View style={styles.center} pointerEvents="none">
        {label != null && (
          <Text style={[styles.pct, { color }]}>{label}</Text>
        )}
        {sublabel != null && (
          <Text style={[styles.sub, { color: metaColor }]} numberOfLines={1}>
            {sublabel}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  svg: { position: "absolute" },
  center: {
    alignItems: "center",
    justifyContent: "center",
    maxWidth: SIZE - 28,
  },
  pct: {
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  sub: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "700",
  },
});

export default RoutineProgressRing;
