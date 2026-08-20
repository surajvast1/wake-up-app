import React, { useCallback, useEffect, useRef } from "react";
import {
  ScrollView,
  Text,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NewsCategory } from "../../../services/newsService";

interface CategoryTabsProps {
  categories: NewsCategory[];
  activeIndex: number;
  onSelect: (index: number) => void;
  isDark: boolean;
  showSources?: boolean;
}

const TAB_EST_WIDTH = 92;

const CATEGORY_ICONS: Record<NewsCategory, keyof typeof Ionicons.glyphMap> = {
  India: "flag",
  Entertaining: "film",
  Tech: "hardware-chip",
  Science: "flask",
  Global: "globe",
};

const CategoryTabs: React.FC<CategoryTabsProps> = ({
  categories,
  activeIndex,
  onSelect,
  isDark,
  showSources = false,
}) => {
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      x: Math.max(0, activeIndex * TAB_EST_WIDTH - 40),
      animated: true,
    });
  }, [activeIndex]);

  const handlePress = useCallback(
    (idx: number) => {
      onSelect(idx);
    },
    [onSelect]
  );

  const wrapBg = isDark ? "#1e293b" : "#FAFAF8";
  const borderColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
  const pillBg = isDark ? "#334155" : "#F3F4F6";
  const pillActiveBg = isDark ? "#7A9972" : "#5B7553";
  const pillText = isDark ? "#94a3b8" : "#6B7280";
  const pillActiveText = "#ffffff";

  return (
    <View
      style={[
        styles.wrapper,
        { backgroundColor: wrapBg, borderBottomColor: borderColor },
      ]}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {categories.map((cat, idx) => {
          const isActive = idx === activeIndex;
          const icon = CATEGORY_ICONS[cat];
          return (
            <Pressable
              key={cat}
              onPress={() => handlePress(idx)}
              style={[
                styles.pill,
                { backgroundColor: isActive ? pillActiveBg : pillBg },
              ]}
            >
              {icon && (
                <Ionicons
                  name={icon}
                  size={13}
                  color={isActive ? pillActiveText : pillText}
                  style={styles.pillIcon}
                />
              )}
              <Text
                style={[
                  styles.pillText,
                  { color: isActive ? pillActiveText : pillText },
                ]}
              >
                {cat}
              </Text>
            </Pressable>
          );
        })}
        {showSources && (
          <Pressable
            onPress={() => handlePress(categories.length)}
            style={[styles.pill, { backgroundColor: pillBg }]}
          >
            <Ionicons
              name="options-outline"
              size={13}
              color={pillText}
              style={styles.pillIcon}
            />
            <Text style={[styles.pillText, { color: pillText }]}>Sources</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  container: {
    paddingHorizontal: 16,
    gap: 8,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  pillIcon: {
    marginRight: 5,
  },
  pillText: {
    fontSize: 13,
    fontWeight: "700",
  },
});

export default React.memo(CategoryTabs);
