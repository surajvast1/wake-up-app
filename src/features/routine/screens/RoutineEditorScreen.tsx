import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useAppTheme } from "../../../contexts/ThemeContext";
import { useAuth } from "../../../contexts/AuthContext";
import {
  createRoutine,
  createRoutineItemRow,
  deleteRoutineItem,
  fetchAllRoutineItems,
  fetchRoutines,
  itemsForRoutine,
  updateRoutine,
  updateRoutineItemRow,
} from "../services/routineService";
import type { RoutineStackParamList, RoutineType } from "../types";

type Nav = NativeStackNavigationProp<RoutineStackParamList, "RoutineEditor">;
type RRoute = RouteProp<RoutineStackParamList, "RoutineEditor">;

/* Routine type is always "morning" — simplified from multi-type */

const COLOR_PRESETS = [
  "#5B7553", "#f59e0b", "#ec4899", "#10b981", "#0ea5e9", "#8b5cf6",
];

interface DraftItem {
  id?: string;
  title: string;
  estimated_time: number;
  is_mandatory: boolean;
}

function iconForType(t: RoutineType): string {
  if (t === "morning") return "sunny-outline";
  if (t === "afternoon") return "partly-sunny-outline";
  if (t === "evening") return "moon-outline";
  return "sparkles-outline";
}

const RoutineEditorScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RRoute>();
  const editRoutineId = route.params?.routineId;
  const { user, isGuest } = useAuth();

  const [name, setName] = useState("");
  const [rtype] = useState<RoutineType>("morning");
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!editRoutineId);
  const [items, setItems] = useState<DraftItem[]>([]);
  const initialItemIdsRef = useRef<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      if (!editRoutineId) {
        setName("");
        // always morning
        setColor(COLOR_PRESETS[0]);
        setItems([]);
        initialItemIdsRef.current = new Set();
        setLoading(false);
        return;
      }
      let cancelled = false;
      setLoading(true);
      void (async () => {
        try {
          const routines = await fetchRoutines(user?.id, isGuest);
          const r = routines.find((x) => x.id === editRoutineId);
          const allItems = await fetchAllRoutineItems(user?.id, isGuest);
          const ordered = itemsForRoutine(allItems, editRoutineId);
          if (cancelled || !r) return;
          setName(r.name);
          setColor(r.color);
          const rows: DraftItem[] =
            ordered.length > 0
              ? ordered.map((it) => ({
                  id: it.id,
                  title: it.title,
                  estimated_time: it.estimated_time,
                  is_mandatory: it.is_mandatory,
                }))
              : [];
          setItems(rows);
          initialItemIdsRef.current = new Set(
            rows.map((x) => x.id).filter(Boolean) as string[]
          );
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [editRoutineId, user?.id, isGuest])
  );

  const addRow = () =>
    setItems((p) => [...p, { title: "", estimated_time: 5, is_mandatory: true }]);

  const updateRow = (i: number, patch: Partial<DraftItem>) =>
    setItems((p) => p.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  const removeRow = (i: number) =>
    setItems((p) => p.filter((_, j) => j !== i));

  const onSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert("Name required", "Give your routine a name.");
      return;
    }
    const filledRows = items.filter((i) => i.title.trim());

    setSaving(true);
    try {
      if (editRoutineId) {
        await updateRoutine(
          editRoutineId,
          {
            name: trimmed,
            routine_type: rtype,
            icon: iconForType(rtype),
            color,
          },
          user?.id,
          isGuest
        );

        const nextIds = new Set(
          filledRows.map((x) => x.id).filter(Boolean) as string[]
        );
        for (const id of initialItemIdsRef.current) {
          if (!nextIds.has(id)) {
            await deleteRoutineItem(id, user?.id, isGuest);
          }
        }

        let order = 0;
        for (const row of filledRows) {
          const t = row.title.trim();
          if (row.id) {
            await updateRoutineItemRow(
              row.id,
              {
                title: t,
                description: "",
                estimated_time: Math.max(1, row.estimated_time),
                is_mandatory: row.is_mandatory,
                order_index: order,
              },
              user?.id,
              isGuest
            );
          } else {
            await createRoutineItemRow(
              editRoutineId,
              {
                title: t,
                description: "",
                estimated_time: Math.max(1, row.estimated_time),
                is_mandatory: row.is_mandatory,
                order_index: order,
              },
              user?.id,
              isGuest
            );
          }
          order++;
        }
        navigation.goBack();
        return;
      }

      const r = await createRoutine(
        {
          name: trimmed,
          routine_type: rtype,
          icon: iconForType(rtype),
          color,
        },
        user?.id,
        isGuest
      );
      let order = 0;
      for (const it of filledRows) {
        const t = it.title.trim();
        await createRoutineItemRow(
          r.id,
          {
            title: t,
            description: "",
            estimated_time: Math.max(1, it.estimated_time),
            is_mandatory: it.is_mandatory,
            order_index: order,
          },
          user?.id,
          isGuest
        );
        order++;
      }
      if (filledRows.length > 0) {
        navigation.replace("RoutineToday", { routineId: r.id });
      } else {
        navigation.goBack();
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.backgroundSecondary,
          justifyContent: "center",
          alignItems: "center",
          paddingTop: insets.top,
        }}
      >
        <ActivityIndicator size="large" color={color} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.backgroundSecondary }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 40,
        paddingHorizontal: 20,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="close" size={28} color={colors.text} />
        </Pressable>
        <Text style={[styles.screenTitle, { color: colors.text }]}>
          {editRoutineId ? "Edit routine" : "New routine"}
        </Text>
        <View style={{ width: 28 }} />
      </View>

      <Text style={[styles.lbl, { color: colors.textSecondary }]}>Name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Deep work wind-down"
        placeholderTextColor={colors.placeholder}
        style={[
          styles.input,
          {
            backgroundColor: colors.inputBg,
            borderColor: colors.inputBorder,
            color: colors.text,
          },
        ]}
      />

      <Text style={[styles.lbl, { color: colors.textSecondary, marginTop: 18 }]}>
        Accent
      </Text>
      <View style={styles.colorRow}>
        {COLOR_PRESETS.map((c) => (
          <Pressable
            key={c}
            onPress={() => setColor(c)}
            style={[
              styles.colorDot,
              { backgroundColor: c, marginRight: 12, marginBottom: 12 },
              color === c && styles.colorDotOn,
            ]}
          />
        ))}
      </View>

      <View style={styles.stepsHeader}>
        <Text style={[styles.lbl, { color: colors.textSecondary, marginTop: 0 }]}>
          Steps
        </Text>
        <Pressable onPress={addRow}>
          <Text style={{ color: color, fontWeight: "800" }}>+ Add step</Text>
        </Pressable>
      </View>

      {items.length === 0 ? (
        <Text
          style={[
            styles.emptyStepsHint,
            { color: colors.textMuted, borderColor: colors.border },
          ]}
        >
          No steps yet. Save empty to keep only a name/type (it will not show on
          home until you add steps), or tap + Add step. Afternoon/evening slots
          are optional.
        </Text>
      ) : null}

      {items.map((row, i) => (
        <View
          key={row.id ?? `new-${i}`}
          style={[
            styles.stepCard,
            {
              backgroundColor: colors.surface,
              borderColor: isDark ? "rgba(255,255,255,0.08)" : colors.border,
            },
          ]}
        >
          <View style={styles.stepTop}>
            <TextInput
              value={row.title}
              onChangeText={(t) => updateRow(i, { title: t })}
              placeholder={`Step ${i + 1}`}
              placeholderTextColor={colors.placeholder}
              style={[styles.stepTitle, { color: colors.text }]}
            />
            <Pressable onPress={() => removeRow(i)} hitSlop={8}>
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
            </Pressable>
          </View>
          <View style={styles.stepMeta}>
            <Text style={[styles.miniLbl, { color: colors.textMuted }]}>
              Minutes
            </Text>
            <TextInput
              value={String(row.estimated_time)}
              onChangeText={(t) => {
                const n = parseInt(t.replace(/\D/g, ""), 10);
                updateRow(i, {
                  estimated_time: Number.isFinite(n) ? Math.max(1, n) : 1,
                });
              }}
              keyboardType="number-pad"
              style={[
                styles.minInput,
                {
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
            />
          </View>
          <Text style={[styles.miniLbl, { color: colors.textMuted, marginTop: 10 }]}>
            Counts toward “done” for the day
          </Text>
          <View style={styles.segRow}>
            <Pressable
              onPress={() => updateRow(i, { is_mandatory: true })}
              style={[
                styles.segBtn,
                { marginRight: 10 },
                {
                  borderColor: colors.border,
                  backgroundColor: row.is_mandatory
                    ? color + "28"
                    : colors.surfaceMuted,
                },
              ]}
            >
              <Text
                style={{
                  fontWeight: "800",
                  fontSize: 13,
                  color: row.is_mandatory ? color : colors.textMuted,
                }}
              >
                Required
              </Text>
            </Pressable>
            <Pressable
              onPress={() => updateRow(i, { is_mandatory: false })}
              style={[
                styles.segBtn,
                {
                  borderColor: colors.border,
                  backgroundColor: !row.is_mandatory
                    ? color + "28"
                    : colors.surfaceMuted,
                },
              ]}
            >
              <Text
                style={{
                  fontWeight: "800",
                  fontSize: 13,
                  color: !row.is_mandatory ? color : colors.textMuted,
                }}
              >
                Optional
              </Text>
            </Pressable>
          </View>
        </View>
      ))}

      <Pressable
        onPress={onSave}
        disabled={saving}
        style={({ pressed }) => [
          styles.saveBtn,
          { backgroundColor: color, opacity: pressed || saving ? 0.88 : 1 },
        ]}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveTxt}>
            {editRoutineId
              ? "Save changes"
              : items.some((i) => i.title.trim())
                ? "Create routine"
                : "Create empty routine"}
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  screenTitle: { fontSize: 18, fontWeight: "900" },
  lbl: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: "600",
  },
  typeRow: { flexDirection: "row", flexWrap: "wrap" },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  typeTxt: { fontSize: 14, fontWeight: "800" },
  colorRow: { flexDirection: "row", flexWrap: "wrap" },
  colorDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  colorDotOn: {
    borderWidth: 3,
    borderColor: "#0f172a",
  },
  stepsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 22,
    marginBottom: 10,
  },
  emptyStepsHint: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 21,
    marginBottom: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  stepCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  stepTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    paddingVertical: 8,
  },
  stepMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    flexWrap: "wrap",
  },
  miniLbl: { fontSize: 12, fontWeight: "700" },
  minInput: {
    width: 52,
    marginLeft: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontWeight: "800",
    textAlign: "center",
  },
  segRow: {
    flexDirection: "row",
    marginTop: 10,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
  },
  saveBtn: {
    marginTop: 24,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveTxt: { color: "#fff", fontSize: 17, fontWeight: "900" },
});

export default RoutineEditorScreen;
