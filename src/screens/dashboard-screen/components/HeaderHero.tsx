import React, { useEffect, useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import LottieView from "lottie-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getDayPeriod,
  getHeaderSkyGradient,
  getWeatherAnimation,
  heroPrimaryTextColor,
  heroSecondaryTextColor,
} from "../../../lib/weatherAnimation";
import { useAppTheme } from "../../../contexts/ThemeContext";

interface HeaderHeroProps {
  onReady?: () => void;
  forceFreshWeatherOnMount?: boolean;
}

function greetingForPeriod(period: ReturnType<typeof getDayPeriod>): string {
  if (period === "morning") return "Good morning";
  if (period === "afternoon") return "Good afternoon";
  if (period === "evening") return "Good evening";
  return "Good night";
}

const HeaderHero: React.FC<HeaderHeroProps> = ({ onReady }) => {
  const insets = useSafeAreaInsets();
  const { isDark } = useAppTheme();
  const now = useMemo(() => new Date(), []);
  const period = getDayPeriod(now);
  const sky = getHeaderSkyGradient(period, isDark);
  const primary = heroPrimaryTextColor(period, isDark);
  const secondary = heroSecondaryTextColor(period, isDark);

  useEffect(() => {
    const frame = requestAnimationFrame(() => onReady?.());
    return () => cancelAnimationFrame(frame);
  }, [onReady]);

  return (
    <LinearGradient
      colors={sky.colors}
      locations={sky.locations}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={[styles.hero, { paddingTop: insets.top + 18 }]}
    >
      <View style={styles.copy}>
        <Text style={[styles.eyebrow, { color: secondary }]}>UNIFLOW</Text>
        <Text style={[styles.greeting, { color: primary }]}>
          {greetingForPeriod(period)}
        </Text>
        <Text style={[styles.subtitle, { color: secondary }]}>
          A calm start to whatever today brings.
        </Text>
      </View>
      <LottieView
        source={getWeatherAnimation("", "", period, now) as any}
        autoPlay
        loop
        style={styles.lottie}
      />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  hero: {
    minHeight: 270,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  copy: { flex: 1, paddingBottom: 18 },
  eyebrow: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 4,
    marginBottom: 12,
  },
  greeting: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  subtitle: {
    maxWidth: 210,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    marginTop: 10,
  },
  lottie: { width: 150, height: 150 },
});

export default HeaderHero;
