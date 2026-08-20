import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAppTheme } from "../contexts/ThemeContext";

const BackHomeButton: React.FC = () => {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  return (
    <Pressable onPress={() => navigation.navigate("dashboard")} style={[styles.button, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
      <Ionicons name="arrow-back" size={18} color={colors.text} />
      <Text style={[styles.label, { color: colors.text }]}>Home</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: { position: "absolute", top: 14, left: 16, zIndex: 20, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 14, paddingHorizontal: 11, paddingVertical: 8 },
  label: { fontSize: 12, fontWeight: "800" },
});

export default BackHomeButton;

