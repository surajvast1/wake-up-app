import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

interface Props {
  sessionsToday: number;
  minutesThisMonth: number;
  daysActiveThisMonth: number;
  streak: number;
}

const StatsBar: React.FC<Props> = ({
  sessionsToday,
  minutesThisMonth,
  daysActiveThisMonth,
  streak,
}) => {
  const items: {
    icon: keyof typeof Ionicons.glyphMap;
    value: string;
    label: string;
    detail?: string;
    color: string;
  }[] = [
    {
      icon: "today",
      value: String(sessionsToday),
      label: "Today",
      color: "#5B7553",
    },
    {
      icon: "time-outline",
      value: `${minutesThisMonth}m`,
      label: "This month",
      detail: `${daysActiveThisMonth} active day${
        daysActiveThisMonth === 1 ? "" : "s"
      }`,
      color: "#0ea5e9",
    },
    {
      icon: "flame",
      value: String(streak),
      label: streak === 1 ? "Day" : "Day streak",
      color: "#f59e0b",
    },
  ];

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={["#ffffff", "#f8fafc"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.strip}
      >
        {items.map((c, i) => (
          <React.Fragment key={c.label}>
            {i > 0 ? <View style={styles.divider} /> : null}
            <View style={styles.segment}>
              <View style={[styles.iconRing, { borderColor: c.color + "40" }]}>
                <View style={[styles.iconInner, { backgroundColor: c.color + "14" }]}>
                  <Ionicons name={c.icon} size={17} color={c.color} />
                </View>
              </View>
              <Text style={styles.value}>{c.value}</Text>
              <Text style={styles.label} numberOfLines={1}>
                {c.label}
              </Text>
              {c.detail ? (
                <Text style={styles.detail} numberOfLines={1}>
                  {c.detail}
                </Text>
              ) : null}
            </View>
          </React.Fragment>
        ))}
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 22,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  strip: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: "#e2e8f0",
    marginVertical: 4,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    gap: 6,
  },
  iconRing: {
    padding: 2,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  iconInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  value: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0f172a",
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  detail: {
    fontSize: 9,
    fontWeight: "600",
    color: "#94a3b8",
    marginTop: -2,
    textAlign: "center",
  },
});

export default React.memo(StatsBar);
