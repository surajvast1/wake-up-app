import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export interface Chakra {
  id: string;
  name: string;
  sanskrit: string;
  color: string;
  gradient: [string, string];
  location: string;
  focus: string;
  affirmation: string;
}

export const CHAKRAS: Chakra[] = [
  {
    id: "root",
    name: "Root",
    sanskrit: "Muladhara",
    color: "#ef4444",
    gradient: ["#ef4444", "#dc2626"],
    location: "Base of spine",
    focus: "Grounding & Stability",
    affirmation: "I am grounded. I am safe. I am connected to the earth.",
  },
  {
    id: "sacral",
    name: "Sacral",
    sanskrit: "Svadhisthana",
    color: "#f97316",
    gradient: ["#f97316", "#ea580c"],
    location: "Below navel",
    focus: "Creativity & Emotion",
    affirmation: "I embrace my creativity. I flow with life's rhythms.",
  },
  {
    id: "solar",
    name: "Solar Plexus",
    sanskrit: "Manipura",
    color: "#eab308",
    gradient: ["#eab308", "#ca8a04"],
    location: "Stomach area",
    focus: "Power & Confidence",
    affirmation: "I am powerful. I am confident. I trust my inner strength.",
  },
  {
    id: "heart",
    name: "Heart",
    sanskrit: "Anahata",
    color: "#22c55e",
    gradient: ["#22c55e", "#16a34a"],
    location: "Center of chest",
    focus: "Love & Compassion",
    affirmation: "I am love. I give and receive love freely and openly.",
  },
  {
    id: "throat",
    name: "Throat",
    sanskrit: "Vishuddha",
    color: "#3b82f6",
    gradient: ["#3b82f6", "#2563eb"],
    location: "Throat",
    focus: "Communication & Truth",
    affirmation: "I speak my truth with clarity. My voice matters.",
  },
  {
    id: "third-eye",
    name: "Third Eye",
    sanskrit: "Ajna",
    color: "#5B7553",
    gradient: ["#5B7553", "#4A6B44"],
    location: "Between eyebrows",
    focus: "Intuition & Wisdom",
    affirmation: "I trust my intuition. I see clearly beyond the surface.",
  },
  {
    id: "crown",
    name: "Crown",
    sanskrit: "Sahasrara",
    color: "#8b5cf6",
    gradient: ["#8b5cf6", "#7c3aed"],
    location: "Top of head",
    focus: "Consciousness & Peace",
    affirmation: "I am connected to the divine. I am at peace with all.",
  },
];

interface Props {
  selected: Chakra | null;
  onSelect: (chakra: Chakra) => void;
}

const ChakraSelector: React.FC<Props> = ({ selected, onSelect }) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      {CHAKRAS.map((c) => {
        const isActive = selected?.id === c.id;
        return (
          <Pressable
            key={c.id}
            onPress={() => onSelect(c)}
            style={({ pressed }) => [
              styles.card,
              isActive && styles.cardActive,
              pressed && { opacity: 0.85 },
            ]}
          >
            <LinearGradient
              colors={c.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.dot}
            />
            <Text style={[styles.name, isActive && { color: c.color }]}>
              {c.name}
            </Text>
            <Text style={styles.sanskrit}>{c.sanskrit}</Text>
            <Text style={styles.location}>{c.location}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    gap: 10,
    paddingRight: 8,
    paddingVertical: 4,
  },
  card: {
    width: 110,
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
  },
  cardActive: {
    borderColor: "#C5D4C1",
    backgroundColor: "#EDF2EB",
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginBottom: 8,
  },
  name: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0f172a",
    textAlign: "center",
  },
  sanskrit: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 2,
    fontStyle: "italic",
  },
  location: {
    fontSize: 10,
    fontWeight: "600",
    color: "#94a3b8",
    marginTop: 4,
    textAlign: "center",
  },
});

export default React.memo(ChakraSelector);
