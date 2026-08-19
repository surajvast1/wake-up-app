import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAppTheme } from "../../../contexts/ThemeContext";
import { useRoutinesCatalog } from "../hooks/routineHooks";
import { deleteRoutine } from "../services/routineService";
import { useAuth } from "../../../contexts/AuthContext";
import { routineTypeLabel } from "../routineLabels";
import type { Routine, RoutineStackParamList } from "../types";

type Nav = NativeStackNavigationProp<RoutineStackParamList, "RoutineHub">;

const RoutinesHubScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const navigation = useNavigation<Nav>();
  const { user, isGuest } = useAuth();
  const { loading, routines, items, refresh } = useRoutinesCatalog();

  const countItems = useCallback(
    (rid: string) => items.filter((i) => i.routine_id === rid).length,
    [items]
  );

  const onDelete = useCallback(
    (r: Routine) => {
      Alert.alert("Delete routine", `Remove “${r.name}”?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteRoutine(r.id, user?.id, isGuest);
            await refresh();
          },
        },
      ]);
    },
    [user?.id, isGuest, refresh]
  );

  const renderItem = useCallback(
    ({ item }: { item: Routine }) => {
      const n = countItems(item.id);
      return (
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: isDark ? "rgba(255,255,255,0.08)" : colors.border,
            },
          ]}
        >
          <View style={[styles.accent, { backgroundColor: item.color }]} />
          <Pressable
            onPress={() =>
              navigation.navigate("RoutineToday", { routineId: item.id })
            }
            style={({ pressed }) => [
              styles.cardMain,
              pressed && { opacity: 0.92 },
            ]}
          >
            <View
              style={[
                styles.iconB,
                { backgroundColor: item.color + (isDark ? "35" : "18") },
              ]}
            >
              <Ionicons
                name={
                  (item.icon as keyof typeof Ionicons.glyphMap) ||
                  "albums-outline"
                }
                size={22}
                color={item.color}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.name, { color: colors.text }]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Text style={[styles.meta, { color: colors.textSecondary }]}>
                {n} steps · {routineTypeLabel(item.routine_type)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.iconMuted} />
          </Pressable>
          <View style={styles.cardActions}>
            <Pressable
              onPress={() =>
                navigation.navigate("RoutineEditor", { routineId: item.id })
              }
              hitSlop={10}
              style={styles.actionHit}
            >
              <Ionicons name="create-outline" size={22} color={colors.primary} />
            </Pressable>
            <Pressable
              onPress={() => onDelete(item)}
              hitSlop={10}
              style={styles.actionHit}
            >
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </Pressable>
          </View>
        </View>
      );
    },
    [colors, isDark, navigation, countItems, onDelete]
  );

  const listHeader = useMemo(
    () => (
      <View
        style={[
          styles.hero,
          {
            paddingTop: insets.top + 14,
            backgroundColor: isDark ? colors.surface : "#F5F7F4",
          },
        ]}
      >
        <View style={{ paddingLeft: 42 }}>
          <Text style={[styles.heroK, { color: colors.primary }]}>
            Rhythm
          </Text>
          <Text style={[styles.heroT, { color: colors.text }]}>
            Routines
          </Text>
          <Text style={[styles.heroS, { color: colors.textSecondary }]}>
            Morning, afternoon, evening, or anytime — your rhythm.
          </Text>
        </View>
      </View>
    ),
    [insets.top, isDark, colors]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.backgroundSecondary }}>
      <FlatList
        data={routines}
        keyExtractor={(r) => r.id}
        ListHeaderComponent={listHeader}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        renderItem={renderItem}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator
              style={{ marginTop: 40 }}
              color={colors.primary}
            />
          ) : (
            <Text
              style={{
                textAlign: "center",
                marginTop: 32,
                color: colors.textSecondary,
                fontWeight: "600",
              }}
            >
              No routines yet. Tap + to create one.
            </Text>
          )
        }
      />

      <Pressable
        onPress={() => navigation.navigate("RoutineEditor", {})}
        style={({ pressed }) => [
          styles.fab,
          { bottom: insets.bottom + 24, opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <LinearGradient
          colors={["#5B7553", "#7A9972"]}
          style={styles.fabIn}
        >
          <Ionicons name="add" size={30} color="#fff" />
        </LinearGradient>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    marginBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
    }),
  },
  heroK: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  heroT: {
    fontSize: 32,
    fontWeight: "900",
    marginTop: 2,
    letterSpacing: -0.5,
  },
  heroS: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 10,
    maxWidth: 320,
    lineHeight: 20,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "stretch",
    shadowColor: "#5B7553",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  accent: { width: 5 },
  cardMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingRight: 8,
    paddingLeft: 12,
  },
  cardActions: {
    justifyContent: "center",
    paddingRight: 8,
    paddingVertical: 8,
  },
  actionHit: { padding: 8, marginVertical: 2 },
  iconB: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  name: { fontSize: 17, fontWeight: "800" },
  meta: { fontSize: 12, fontWeight: "600", marginTop: 4 },
  fab: {
    position: "absolute",
    right: 22,
    zIndex: 20,
    elevation: 12,
  },
  fabIn: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#5B7553",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
});

export default RoutinesHubScreen;
