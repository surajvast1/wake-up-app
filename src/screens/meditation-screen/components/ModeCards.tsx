import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

export type MeditationMode = "breathing" | "timer" | "chakra";

interface Props {
  onSelect: (mode: MeditationMode) => void;
}

interface CardDef {
  mode: MeditationMode;
  title: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradient: [string, string];
}

const CARDS: CardDef[] = [
  {
    mode: "breathing",
    title: "Breathing",
    sub: "Guided inhale & exhale patterns",
    icon: "leaf",
    gradient: ["#5B7553", "#7A9972"],
  },
  {
    mode: "timer",
    title: "Timed Sit",
    sub: "Silent meditation with timer",
    icon: "timer",
    gradient: ["#0ea5e9", "#38bdf8"],
  },
  {
    mode: "chakra",
    title: "Chakra Focus",
    sub: "Align your energy centers",
    icon: "color-palette",
    gradient: ["#8b5cf6", "#a78bfa"],
  },
];

const ModeCards: React.FC<Props> = ({ onSelect }) => {
  return (
    <View style={styles.container}>
      {CARDS.map((card) => (
        <Pressable
          key={card.mode}
          onPress={() => onSelect(card.mode)}
          style={({ pressed }) => [
            styles.cardWrap,
            pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
          ]}
        >
          <LinearGradient
            colors={card.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            <View style={styles.iconWrap}>
              <Ionicons name={card.icon} size={24} color="#fff" />
            </View>
            <View style={styles.textCol}>
              <Text style={styles.title}>{card.title}</Text>
              <Text style={styles.sub}>{card.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.6)" />
          </LinearGradient>
        </Pressable>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 10,
    marginBottom: 22,
  },
  cardWrap: {
    borderRadius: 18,
    overflow: "hidden",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 18,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  textCol: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
  },
  sub: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
});

export default React.memo(ModeCards);
