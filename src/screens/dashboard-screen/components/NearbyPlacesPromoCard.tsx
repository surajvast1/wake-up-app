import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

const NearbyPlacesPromoCard: React.FC = () => {
  const navigation = useNavigation<{ navigate: (name: string) => void }>();

  return (
    <Pressable
      onPress={() => navigation.navigate("nearby")}
      accessibilityRole="button"
      accessibilityLabel="Open nearby places"
      style={({ pressed }) => [styles.press, pressed && styles.pressPressed]}
    >
      <LinearGradient
        colors={["#ecfdf5", "#d1fae5", "#bbf7d0"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="map-outline" size={20} color="#047857" />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>Nearby places</Text>
          <Text style={styles.sub}>Cafés, parks & spots around you</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color="#059669" />
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
    borderColor: "rgba(5, 150, 105, 0.35)",
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.2)",
  },
  copy: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
    minWidth: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: "900",
    color: "#065f46",
    letterSpacing: -0.3,
  },
  sub: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "600",
    color: "#047857",
    lineHeight: 16,
    opacity: 0.9,
  },
});

export default NearbyPlacesPromoCard;
