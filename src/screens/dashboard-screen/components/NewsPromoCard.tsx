import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

const NewsPromoCard: React.FC = () => {
  const navigation = useNavigation<any>();

  return (
    <Pressable
      onPress={() =>
        navigation.navigate("news", { _newsNavTs: Date.now() })
      }
      accessibilityRole="button"
      accessibilityLabel="Open latest news"
      style={({ pressed }) => [styles.press, pressed && styles.pressPressed]}
    >
      <LinearGradient
        colors={["#FFFFFF", "#F5F7F4", "#EDF2EB"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="newspaper-outline" size={20} color="#1d4ed8" />
        </View>
        <View style={styles.copy}>
          <Text style={styles.kicker}>Stay informed</Text>
          <Text style={styles.title}>Latest news</Text>
          <Text style={styles.sub} numberOfLines={2}>
            Read the latest headlines and stay aware.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color="#2563eb" />
      </LinearGradient>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  press: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 2,
  },
  pressPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.992 }],
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.28)",
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.15)",
  },
  copy: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
    minWidth: 0,
  },
  kicker: {
    fontSize: 10,
    fontWeight: "800",
    color: "#2563eb",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1e3a8a",
    letterSpacing: -0.3,
  },
  sub: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "600",
    color: "#1e40af",
    lineHeight: 16,
    opacity: 0.92,
  },
});

export default NewsPromoCard;
