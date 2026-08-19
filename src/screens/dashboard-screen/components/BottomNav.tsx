import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../../contexts/ThemeContext";

interface NavItem {
  route: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}

const NAV_ITEMS: NavItem[] = [
  { route: "dashboard", label: "Home", icon: "home-outline", iconActive: "home" },
  { route: "news", label: "News", icon: "newspaper-outline", iconActive: "newspaper" },
  { route: "nearby", label: "Nearby", icon: "location-outline", iconActive: "location" },
  {
    route: "routines",
    label: "Routines",
    icon: "sunny-outline",
    iconActive: "sunny",
  },
  { route: "profile", label: "Settings", icon: "settings-outline", iconActive: "settings" },
];

const BottomNav: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const currentRoute = route.name;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        bottomWrap: {
          position: "absolute",
          left: 10,
          right: 10,
          bottom: Math.max(insets.bottom, 8),
        },
        bar: {
          flexDirection: "row",
          alignItems: "stretch",
          gap: 6,
          borderRadius: 20,
          paddingVertical: 8,
          paddingHorizontal: 6,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          backgroundColor: colors.surface,
          ...Platform.select({
            ios: {
              shadowColor: colors.shadow,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 14,
            },
            android: { elevation: 8 },
            default: {},
          }),
        },
        cell: {
          flex: 1,
          minWidth: 0,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 8,
          paddingHorizontal: 2,
          borderRadius: 14,
        },
        cellActive: {
          backgroundColor: colors.primarySoftBg,
        },
        label: {
          marginTop: 4,
          fontSize: 10,
          fontWeight: "800",
          textAlign: "center",
        },
        labelUpcoming: {
          marginTop: 1,
          fontSize: 8,
          fontWeight: "800",
          textAlign: "center",
          letterSpacing: 0.3,
          textTransform: "uppercase",
        },
        cellDisabled: {
          opacity: 0.45,
        },
      }),
    [colors, insets.bottom]
  );

  return (
    <View style={styles.bottomWrap} pointerEvents="box-none">
      <View style={styles.bar}>
        {NAV_ITEMS.map((item) => {
          const isActive = currentRoute === item.route;
          const fg = isActive ? colors.primary : colors.textMuted;
          return (
            <Pressable
              key={item.route}
              onPress={() => navigation.navigate(item.route)}
              style={({ pressed }) => [
                styles.cell,
                isActive && styles.cellActive,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Ionicons
                name={isActive ? item.iconActive : item.icon}
                size={20}
                color={fg}
              />
              <Text style={[styles.label, { color: fg }]} numberOfLines={1}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

export default BottomNav;
