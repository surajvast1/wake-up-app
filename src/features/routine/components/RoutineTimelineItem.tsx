import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Animated as RNAnimated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../../../contexts/ThemeContext";
import type { RoutineSessionItem } from "../types";

interface Props {
  item: RoutineSessionItem;
  accent: string;
  isDark: boolean;
  onToggle: () => void;
  drag?: () => void;
  isActive?: boolean;
}

const RoutineTimelineItem: React.FC<Props> = ({
  item,
  accent,
  onToggle,
  drag,
  isActive,
}) => {
  const { colors, isDark } = useAppTheme();
  const scale = useRef(new RNAnimated.Value(1)).current;

  useEffect(() => {
    if (item.done) {
      RNAnimated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [item.done, scale]);

  return (
    <RNAnimated.View
      style={[
        styles.wrap,
        {
          transform: [{ scale }],
          opacity: isActive ? 0.92 : 1,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={onToggle}
        delayPressIn={50}
        style={[
          styles.card,
          {
            backgroundColor: isDark ? "rgba(255,255,255,0.06)" : colors.surface,
            borderColor: isDark ? "rgba(255,255,255,0.08)" : colors.cardBorder,
            borderWidth: 1,
          },
          item.done && { borderColor: accent + "55" },
        ]}
      >
        <View style={styles.cardInner}>
          <View style={styles.left}>
            <Text
              style={[
                styles.title,
                { color: colors.text },
                item.done && styles.titleDone,
              ]}
              numberOfLines={2}
            >
              {item.title}
            </Text>
            {item.description ? (
              <Text
                style={[styles.desc, { color: colors.textSecondary }]}
                numberOfLines={2}
              >
                {item.description}
              </Text>
            ) : null}
            <View style={styles.metaRow}>
              <Ionicons
                name="time-outline"
                size={13}
                color={colors.textMuted}
              />
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                {item.estimated_time} min
              </Text>
              {!item.is_mandatory && (
                <View
                  style={[styles.optionalPill, { borderColor: colors.textMuted }]}
                >
                  <Text
                    style={[styles.optionalTxt, { color: colors.textMuted }]}
                  >
                    Optional
                  </Text>
                </View>
              )}
            </View>
          </View>
          <View
            style={[
              styles.check,
              {
                borderColor: item.done ? accent : colors.border,
              },
              item.done && { backgroundColor: accent },
            ]}
          >
            <Ionicons
              name={item.done ? "checkmark" : "ellipse-outline"}
              size={22}
              color={item.done ? "#fff" : colors.textMuted}
            />
          </View>
          {drag ? (
            <Pressable
              onLongPress={drag}
              delayLongPress={200}
              style={styles.dragHandle}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 12 }}
            >
              <Ionicons
                name="swap-vertical-outline"
                size={22}
                color={colors.textMuted}
              />
            </Pressable>
          ) : null}
        </View>
      </TouchableOpacity>
    </RNAnimated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
  },
  card: {
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardInner: {
    flexDirection: "row",
    alignItems: "center",
  },
  left: { flex: 1, marginRight: 10 },
  title: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  titleDone: { opacity: 0.55 },
  desc: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 4,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  meta: { fontSize: 12, fontWeight: "700", marginLeft: 6 },
  optionalPill: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  optionalTxt: { fontSize: 10, fontWeight: "800" },
  check: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  dragHandle: {
    paddingLeft: 4,
    justifyContent: "center",
    minWidth: 36,
    alignItems: "center",
  },
});

export default RoutineTimelineItem;
