import React from "react";
import { View, Text, StyleSheet, Pressable, StyleProp, ViewStyle } from "react-native";
import LottieView from "lottie-react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../contexts/ThemeContext";
import {
  getErrorAnimation,
  getNoInternetAnimation,
} from "../lib/weatherAnimation";

type LottieSource = React.ComponentProps<typeof LottieView>["source"];

interface StatusViewProps {
  title: string;
  subtitle?: string;
  lottie: LottieSource;
  lottieSize?: number;
  ctaLabel?: string;
  onCtaPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Shared empty/offline/error illustration slot. Centered Lottie + title,
 * optional subtitle + CTA. Kept generic so it can be dropped anywhere we'd
 * otherwise show a plain "failed to load" string.
 */
const StatusView: React.FC<StatusViewProps> = ({
  title,
  subtitle,
  lottie,
  lottieSize = 200,
  ctaLabel,
  onCtaPress,
  style,
}) => {
  const { colors, isDark } = useAppTheme();

  return (
    <View style={[styles.wrap, style]}>
      <LottieView
        source={lottie}
        autoPlay
        loop
        style={{ width: lottieSize, height: lottieSize }}
      />
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {subtitle}
        </Text>
      ) : null}
      {ctaLabel && onCtaPress ? (
        <Pressable
          onPress={onCtaPress}
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: colors.primary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Ionicons
            name="refresh"
            size={16}
            color={isDark ? "#0f172a" : "#ffffff"}
          />
          <Text
            style={[
              styles.ctaText,
              { color: isDark ? "#0f172a" : "#ffffff" },
            ]}
          >
            {ctaLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
};

/** Fetch failed / no connectivity — pairs with Nointernet.json. */
export const NoInternetView: React.FC<{
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
}> = ({ onRetry, style }) => (
    <StatusView
    lottie={getNoInternetAnimation() as unknown as LottieSource}
    title="You're offline"
    subtitle="Check your connection — we'll refresh the moment you're back."
    ctaLabel={onRetry ? "Retry" : undefined}
    onCtaPress={onRetry}
    style={style}
  />
);

/** Generic empty / not-found — pairs with 404error.json. */
export const ErrorStateView: React.FC<{
  title?: string;
  subtitle?: string;
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
}> = ({ title = "Nothing here yet", subtitle, onRetry, style }) => (
  <StatusView
    lottie={getErrorAnimation() as unknown as LottieSource}
    title={title}
    subtitle={subtitle}
    ctaLabel={onRetry ? "Try again" : undefined}
    onCtaPress={onRetry}
    style={style}
  />
);

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.2,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    textAlign: "center",
    maxWidth: 300,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
});

export default StatusView;
