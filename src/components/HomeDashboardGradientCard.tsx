import React, { ReactNode, useMemo } from "react";
import { View, StyleSheet, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAppTheme } from "../contexts/ThemeContext";
import {
  getHomeDashboardCardAccent,
  getHomeDashboardCardTheme,
  HomeCardVariant,
} from "../theme/homeDashboardCardTheme";

type Props = {
  variant: HomeCardVariant;
  children: ReactNode;
};

const HomeDashboardGradientCard: React.FC<Props> = ({
  variant,
  children,
}) => {
  const { isDark } = useAppTheme();
  const cardTheme = useMemo(
    () => getHomeDashboardCardTheme(variant, isDark),
    [variant, isDark]
  );
  const accent = useMemo(
    () => getHomeDashboardCardAccent(variant, isDark),
    [variant, isDark]
  );

  const outerShadow = useMemo(
    () =>
      Platform.select({
        ios: {
          shadowColor: cardTheme.shadowColor,
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: isDark ? 0.32 : 0.2,
          shadowRadius: 12,
        },
        android: { elevation: isDark ? 5 : 4 },
        default: {},
      }),
    [cardTheme.shadowColor, isDark]
  );

  return (
    <View style={[styles.outer, outerShadow]}>
      <LinearGradient
        colors={[...cardTheme.gradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.gradient,
          { borderColor: cardTheme.borderColor },
        ]}
      >
        {isDark ? (
          <View style={styles.veil} pointerEvents="none" />
        ) : null}
        <View style={[styles.accentSide, { backgroundColor: accent }]} />
        <View style={styles.inner}>{children}</View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  outer: {
    borderRadius: 22,
    overflow: "visible",
  },
  gradient: {
    borderRadius: 22,
    borderWidth: 1.5,
    overflow: "hidden",
    position: "relative",
  },
  /** Subtle depth only — gradient carries most of the tone. */
  veil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.08)",
    borderRadius: 22,
  },
  accentSide: {
    position: "absolute",
    left: 0,
    top: 12,
    bottom: 12,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    zIndex: 1,
  },
  inner: {
    position: "relative",
    zIndex: 2,
  },
});

export default HomeDashboardGradientCard;
