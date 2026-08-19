import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type DashboardLayoutMode =
  | "quote-manifest-habits"
  | "manifest-quote-habits"
  | "habits-quote-manifest";

export type DashboardColorPreset =
  | "theme-default"
  | "sage-mist"
  | "lavender-dusk"
  | "sunset-cream"
  | "midnight-indigo";

export type TempLottiePreset =
  | "auto"
  | "sunny"
  | "partly-cloudy"
  | "cloudy"
  | "rainy"
  | "thunder"
  | "snow"
  | "evening"
  | "night";

export type WeatherLottieMood =
  | "sunny"
  | "partly"
  | "cloudy"
  | "rainy"
  | "thunder"
  | "snow"
  | "evening"
  | "night";

export type WeatherLottieOptionId =
  | "defaultsunnydaymorning"
  | "sunrise-sun-smilingbetweenclouds"
  | "cloudy"
  | "rainy-cloud-smiling-raning"
  | "thunderstorm2"
  | "snow"
  | "evening-bird"
  | "night-baby-panda-sleeping";

export interface UiPrefs {
  showQuote: boolean;
  showManifest: boolean;
  showHabits: boolean;
  layoutMode: DashboardLayoutMode;
  colorPreset: DashboardColorPreset;
  tempLottiePreset: TempLottiePreset;
  weatherLottieOverrides: Partial<Record<WeatherLottieMood, WeatherLottieOptionId>>;
}

const UI_PREFS_STORAGE_KEY = "UI_PREFS_V1";

const DEFAULT_PREFS: UiPrefs = {
  showQuote: true,
  showManifest: true,
  showHabits: true,
  layoutMode: "quote-manifest-habits",
  colorPreset: "theme-default",
  tempLottiePreset: "auto",
  weatherLottieOverrides: {},
};

interface UiPrefsContextValue {
  prefs: UiPrefs;
  setPrefs: (next: UiPrefs) => Promise<void>;
  patchPrefs: (partial: Partial<UiPrefs>) => Promise<void>;
}

const UiPrefsContext = createContext<UiPrefsContextValue | undefined>(undefined);

export const DASHBOARD_COLOR_PRESET_META: Record<
  DashboardColorPreset,
  { label: string; light: string; dark: string }
> = {
  "theme-default": { label: "Theme default", light: "#FFFFFF", dark: "#0F172A" },
  "sage-mist": { label: "Sage mist", light: "#F1F7EF", dark: "#15251D" },
  "lavender-dusk": { label: "Lavender dusk", light: "#F6F2FF", dark: "#1D1A2D" },
  "sunset-cream": { label: "Sunset cream", light: "#FFF5E9", dark: "#2C2119" },
  "midnight-indigo": { label: "Midnight indigo", light: "#EEF2FF", dark: "#111827" },
};

export const TEMP_LOTTIE_PRESET_META: Record<TempLottiePreset, { label: string }> = {
  auto: { label: "Auto (based on live weather)" },
  sunny: { label: "Sunny day" },
  "partly-cloudy": { label: "Partly cloudy sunrise" },
  cloudy: { label: "Cloudy" },
  rainy: { label: "Rainy" },
  thunder: { label: "Thunderstorm" },
  snow: { label: "Snow" },
  evening: { label: "Evening bird" },
  night: { label: "Night panda" },
};

export const WEATHER_LOTTIE_MOOD_META: Record<WeatherLottieMood, { label: string }> = {
  sunny: { label: "Sunny / Clear" },
  partly: { label: "Partly cloudy" },
  cloudy: { label: "Cloudy / Fog" },
  rainy: { label: "Rainy" },
  thunder: { label: "Thunderstorm" },
  snow: { label: "Snow" },
  evening: { label: "Evening" },
  night: { label: "Night" },
};

export const WEATHER_LOTTIE_OPTIONS: Array<{
  id: WeatherLottieOptionId;
  fileName: string;
  label: string;
  source: number;
  moods: WeatherLottieMood[];
}> = [
  {
    id: "defaultsunnydaymorning",
    fileName: "defaultsunnydaymorning.json",
    label: "Default sunny day",
    source: require("../../assets/animations/defaultsunnydaymorning.json"),
    moods: ["sunny"],
  },
  {
    id: "sunrise-sun-smilingbetweenclouds",
    fileName: "Sunrise-sun-smilingbetweenclouds.json",
    label: "Sunrise smiling sun",
    source: require("../../assets/animations/Sunrise-sun-smilingbetweenclouds.json"),
    moods: ["sunny", "partly"],
  },
  {
    id: "cloudy",
    fileName: "cloudy.json",
    label: "Cloudy",
    source: require("../../assets/animations/cloudy.json"),
    moods: ["cloudy"],
  },
  {
    id: "rainy-cloud-smiling-raning",
    fileName: "rainy-cloud-smiling-raning.json",
    label: "Rain cloud",
    source: require("../../assets/animations/rainy-cloud-smiling-raning.json"),
    moods: ["rainy"],
  },
  {
    id: "thunderstorm2",
    fileName: "thunderstorm2.json",
    label: "Thunderstorm",
    source: require("../../assets/animations/thunderstorm2.json"),
    moods: ["thunder"],
  },
  {
    id: "snow",
    fileName: "Snow.json",
    label: "Snow",
    source: require("../../assets/animations/Snow.json"),
    moods: ["snow"],
  },
  {
    id: "evening-bird",
    fileName: "evening-bird.json",
    label: "Evening bird",
    source: require("../../assets/animations/evening-bird.json"),
    moods: ["evening"],
  },
  {
    id: "night-baby-panda-sleeping",
    fileName: "night-baby-panda-sleeping.json",
    label: "Night panda",
    source: require("../../assets/animations/night-baby-panda-sleeping.json"),
    moods: ["night", "cloudy", "partly"],
  },
];

export function getWeatherLottieOptionsForMood(
  mood: WeatherLottieMood
): Array<{
  id: WeatherLottieOptionId;
  fileName: string;
  label: string;
  source: number;
  moods: WeatherLottieMood[];
}> {
  return WEATHER_LOTTIE_OPTIONS.filter((opt) => opt.moods.includes(mood));
}

export const LAYOUT_MODE_META: Record<DashboardLayoutMode, { label: string; subtitle: string }> = {
  "quote-manifest-habits": { label: "Balanced", subtitle: "Quote → Manifest → Habits" },
  "manifest-quote-habits": { label: "Manifest first", subtitle: "Manifest above quote and habits" },
  "habits-quote-manifest": { label: "Habits first", subtitle: "Habits above quote and manifest" },
};

function coercePrefs(v: unknown): UiPrefs {
  if (!v || typeof v !== "object") return DEFAULT_PREFS;
  const raw = v as Partial<UiPrefs>;
  return {
    showQuote: raw.showQuote ?? DEFAULT_PREFS.showQuote,
    showManifest: raw.showManifest ?? DEFAULT_PREFS.showManifest,
    showHabits: raw.showHabits ?? DEFAULT_PREFS.showHabits,
    layoutMode: raw.layoutMode ?? DEFAULT_PREFS.layoutMode,
    colorPreset: raw.colorPreset ?? DEFAULT_PREFS.colorPreset,
    tempLottiePreset: raw.tempLottiePreset ?? DEFAULT_PREFS.tempLottiePreset,
    weatherLottieOverrides:
      raw.weatherLottieOverrides && typeof raw.weatherLottieOverrides === "object"
        ? (raw.weatherLottieOverrides as UiPrefs["weatherLottieOverrides"])
        : {},
  };
}

export function getDashboardSurfaceColor(
  preset: DashboardColorPreset,
  isDark: boolean,
  defaultColor: string
): string {
  if (preset === "theme-default") return defaultColor;
  const meta = DASHBOARD_COLOR_PRESET_META[preset];
  return isDark ? meta.dark : meta.light;
}

export function getTempLottieSource(preset: TempLottiePreset): number | null {
  switch (preset) {
    case "sunny":
      return require("../../assets/animations/defaultsunnydaymorning.json");
    case "partly-cloudy":
      return require("../../assets/animations/Sunrise-sun-smilingbetweenclouds.json");
    case "cloudy":
      return require("../../assets/animations/cloudy.json");
    case "rainy":
      return require("../../assets/animations/rainy-cloud-smiling-raning.json");
    case "thunder":
      return require("../../assets/animations/thunderstorm2.json");
    case "snow":
      return require("../../assets/animations/Snow.json");
    case "evening":
      return require("../../assets/animations/evening-bird.json");
    case "night":
      return require("../../assets/animations/night-baby-panda-sleeping.json");
    case "auto":
    default:
      return null;
  }
}

export function getWeatherOverrideLottieSource(
  mood: WeatherLottieMood,
  selected: WeatherLottieOptionId | undefined
): number | null {
  if (!selected) return null;
  const options = getWeatherLottieOptionsForMood(mood);
  const matched = options.find((opt) => opt.id === selected);
  return matched ? matched.source : null;
}

export const UiPrefsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [prefs, setPrefsState] = useState<UiPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(UI_PREFS_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as unknown;
        setPrefsState(coercePrefs(parsed));
      } catch {
        setPrefsState(DEFAULT_PREFS);
      }
    })();
  }, []);

  const setPrefs = useCallback(async (next: UiPrefs) => {
    setPrefsState(next);
    try {
      await AsyncStorage.setItem(UI_PREFS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* no-op */
    }
  }, []);

  const patchPrefs = useCallback(async (partial: Partial<UiPrefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...partial };
      void AsyncStorage.setItem(UI_PREFS_STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const value = useMemo<UiPrefsContextValue>(
    () => ({ prefs, setPrefs, patchPrefs }),
    [prefs, setPrefs, patchPrefs]
  );

  return <UiPrefsContext.Provider value={value}>{children}</UiPrefsContext.Provider>;
};

export function useUiPrefs(): UiPrefsContextValue {
  const ctx = useContext(UiPrefsContext);
  if (!ctx) throw new Error("useUiPrefs must be used inside UiPrefsProvider");
  return ctx;
}
