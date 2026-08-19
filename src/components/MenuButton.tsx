import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { DrawerActions, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../contexts/ThemeContext";

const MenuButton: React.FC = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  return (
    <Pressable
      onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      style={({ pressed }) => [
        styles.btn,
        {
          top: insets.top + 8,
          backgroundColor: colors.menuButtonBg,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Ionicons
        name="menu"
        size={22}
        color={colors.menuButtonIcon}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  btn: {
    position: "absolute",
    left: 14,
    zIndex: 100,
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});

export default MenuButton;
