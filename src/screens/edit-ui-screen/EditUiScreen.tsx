import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MenuButton from "../../components/MenuButton";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../contexts/ThemeContext";
import {
  DASHBOARD_COLOR_PRESET_META,
  LAYOUT_MODE_META,
  WEATHER_LOTTIE_MOOD_META,
  TEMP_LOTTIE_PRESET_META,
  getWeatherLottieOptionsForMood,
  type DashboardColorPreset,
  type DashboardLayoutMode,
  type TempLottiePreset,
  type WeatherLottieMood,
  useUiPrefs,
} from "../../contexts/UiPrefsContext";

const EditUiScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const { prefs, patchPrefs } = useUiPrefs();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.backgroundSecondary },
        content: { paddingTop: insets.top + 58, paddingHorizontal: 20, paddingBottom: 40 },
        heading: {
          fontSize: 28,
          fontWeight: "900",
          color: colors.text,
          letterSpacing: -0.5,
        },
        subHeading: {
          marginTop: 8,
          fontSize: 14,
          color: colors.textSecondary,
          fontWeight: "600",
          lineHeight: 20,
        },
        sectionTitle: {
          marginTop: 24,
          marginBottom: 10,
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: 1,
          color: colors.textSecondary,
          fontWeight: "800",
        },
        card: {
          backgroundColor: colors.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
        },
        row: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 14,
          paddingVertical: 14,
        },
        rowDivider: {
          height: StyleSheet.hairlineWidth,
          marginLeft: 14,
          backgroundColor: colors.border,
        },
        rowLeft: { flex: 1, minWidth: 0, paddingRight: 8 },
        rowTitle: { fontSize: 15, fontWeight: "800", color: colors.text },
        rowSub: {
          marginTop: 3,
          fontSize: 12,
          fontWeight: "600",
          color: colors.textSecondary,
        },
        chipWrap: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 10,
        },
        chip: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          borderRadius: 14,
          borderWidth: 1,
          paddingHorizontal: 12,
          paddingVertical: 10,
          minWidth: "47%",
        },
        chipText: {
          flex: 1,
          fontSize: 13,
          fontWeight: "700",
          color: colors.text,
        },
      }),
    [colors, insets.top]
  );

  const colorOptions = Object.keys(DASHBOARD_COLOR_PRESET_META) as DashboardColorPreset[];
  const lottieOptions = Object.keys(TEMP_LOTTIE_PRESET_META) as TempLottiePreset[];
  const layoutOptions = Object.keys(LAYOUT_MODE_META) as DashboardLayoutMode[];
  const weatherMoodOptions = Object.keys(WEATHER_LOTTIE_MOOD_META) as WeatherLottieMood[];

  return (
    <View style={styles.container}>
      <MenuButton />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>Edit UI</Text>
        <Text style={styles.subHeading}>
          Personalize your home: choose which cards appear, their order, page color mood, and your temperature animation.
        </Text>

        <Text style={styles.sectionTitle}>Show or hide cards</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowTitle}>Quote screen block</Text>
              <Text style={styles.rowSub}>Daily quote section on dashboard</Text>
            </View>
            <Switch
              value={prefs.showQuote}
              onValueChange={(v) => void patchPrefs({ showQuote: v })}
              trackColor={{ false: colors.border, true: colors.primarySoftBg }}
              thumbColor={prefs.showQuote ? colors.primary : colors.textMuted}
            />
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowTitle}>Manifest screen block</Text>
              <Text style={styles.rowSub}>Manifest/vision card in home feed</Text>
            </View>
            <Switch
              value={prefs.showManifest}
              onValueChange={(v) => void patchPrefs({ showManifest: v })}
              trackColor={{ false: colors.border, true: colors.primarySoftBg }}
              thumbColor={prefs.showManifest ? colors.primary : colors.textMuted}
            />
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowTitle}>Habit screen block</Text>
              <Text style={styles.rowSub}>Today habits card on home feed</Text>
            </View>
            <Switch
              value={prefs.showHabits}
              onValueChange={(v) => void patchPrefs({ showHabits: v })}
              trackColor={{ false: colors.border, true: colors.primarySoftBg }}
              thumbColor={prefs.showHabits ? colors.primary : colors.textMuted}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Layout (above/below order)</Text>
        <View style={styles.chipWrap}>
          {layoutOptions.map((mode) => {
            const selected = prefs.layoutMode === mode;
            return (
              <Pressable
                key={mode}
                onPress={() => void patchPrefs({ layoutMode: mode })}
                style={[
                  styles.chip,
                  {
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected
                      ? isDark
                        ? "rgba(122,153,114,0.2)"
                        : colors.primarySoftBg
                      : colors.surface,
                  },
                ]}
              >
                <Ionicons
                  name={selected ? "checkmark-circle" : "ellipse-outline"}
                  size={18}
                  color={selected ? colors.primary : colors.textMuted}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.chipText}>{LAYOUT_MODE_META[mode].label}</Text>
                  <Text style={[styles.rowSub, { marginTop: 2 }]}>{LAYOUT_MODE_META[mode].subtitle}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Page color mood</Text>
        <View style={styles.chipWrap}>
          {colorOptions.map((preset) => {
            const selected = prefs.colorPreset === preset;
            const swatch = isDark
              ? DASHBOARD_COLOR_PRESET_META[preset].dark
              : DASHBOARD_COLOR_PRESET_META[preset].light;
            return (
              <Pressable
                key={preset}
                onPress={() => void patchPrefs({ colorPreset: preset })}
                style={[
                  styles.chip,
                  {
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected
                      ? isDark
                        ? "rgba(122,153,114,0.2)"
                        : colors.primarySoftBg
                      : colors.surface,
                  },
                ]}
              >
                <View
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: swatch,
                    borderWidth: 1,
                    borderColor: "rgba(0,0,0,0.12)",
                  }}
                />
                <Text style={styles.chipText}>{DASHBOARD_COLOR_PRESET_META[preset].label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Temp Lottie style</Text>
        <View style={styles.chipWrap}>
          {lottieOptions.map((preset) => {
            const selected = prefs.tempLottiePreset === preset;
            return (
              <Pressable
                key={preset}
                onPress={() => void patchPrefs({ tempLottiePreset: preset })}
                style={[
                  styles.chip,
                  {
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected
                      ? isDark
                        ? "rgba(122,153,114,0.2)"
                        : colors.primarySoftBg
                      : colors.surface,
                  },
                ]}
              >
                <Ionicons
                  name={selected ? "radio-button-on" : "radio-button-off"}
                  size={18}
                  color={selected ? colors.primary : colors.textMuted}
                />
                <Text style={styles.chipText}>{TEMP_LOTTIE_PRESET_META[preset].label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Lottie by weather (file picker)</Text>
        <View style={[styles.card, { padding: 12, gap: 14 }]}>
          {weatherMoodOptions.map((mood) => {
            const options = getWeatherLottieOptionsForMood(mood);
            const selected = prefs.weatherLottieOverrides[mood];
            return (
              <View key={mood}>
                <Text style={[styles.rowTitle, { marginBottom: 2 }]}>
                  {WEATHER_LOTTIE_MOOD_META[mood].label}
                </Text>
                <Text style={[styles.rowSub, { marginTop: 0, marginBottom: 8 }]}>
                  {options.length} option{options.length > 1 ? "s" : ""} available
                </Text>
                <View style={styles.chipWrap}>
                  {options.map((opt) => {
                    const isSelected = selected === opt.id;
                    return (
                      <Pressable
                        key={opt.id}
                        onPress={() =>
                          void patchPrefs({
                            weatherLottieOverrides: {
                              ...prefs.weatherLottieOverrides,
                              [mood]: isSelected ? undefined : opt.id,
                            },
                          })
                        }
                        style={[
                          styles.chip,
                          {
                            borderColor: isSelected ? colors.primary : colors.border,
                            backgroundColor: isSelected
                              ? isDark
                                ? "rgba(122,153,114,0.2)"
                                : colors.primarySoftBg
                              : colors.surface,
                          },
                        ]}
                      >
                        <Ionicons
                          name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                          size={18}
                          color={isSelected ? colors.primary : colors.textMuted}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.chipText}>{opt.label}</Text>
                          <Text style={[styles.rowSub, { marginTop: 1 }]} numberOfLines={1}>
                            {opt.fileName}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

export default EditUiScreen;
