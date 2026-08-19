import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Appearance,
  AppState,
  ColorSchemeName,
  useColorScheme,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ThemePreference,
  AppColors,
  paletteForScheme,
} from "../theme/colors";

const STORAGE_KEY = "@uniflow_theme_preference_v1";

type ThemeContextValue = {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => Promise<void>;
  isDark: boolean;
  colors: AppColors;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveScheme(
  preference: ThemePreference,
  system: ColorSchemeName
): boolean {
  if (preference === "dark") return true;
  if (preference === "light") return false;
  return system === "dark";
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const systemScheme = useColorScheme();
  const [preference, setPrefState] = useState<ThemePreference>("light");

  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw === "light" || raw === "dark" || raw === "system") {
          setPrefState(raw);
        }
      } catch {
        /* keep system */
      }
    })();
  }, []);

  const setPreference = useCallback(async (p: ThemePreference) => {
    setPrefState(p);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, p);
    } catch {
      /* ignore */
    }
  }, []);

  const [systemSnapshot, setSystemSnapshot] = useState(systemScheme);

  useEffect(() => {
    setSystemSnapshot(systemScheme);
  }, [systemScheme]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && preference === "system") {
        setSystemSnapshot(Appearance.getColorScheme());
      }
    });
    return () => sub.remove();
  }, [preference]);

  const isDark = useMemo(
    () => resolveScheme(preference, systemSnapshot ?? "light"),
    [preference, systemSnapshot]
  );

  const colors = useMemo(() => paletteForScheme(isDark), [isDark]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      setPreference,
      isDark,
      colors,
    }),
    [preference, setPreference, isDark, colors]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export function useAppTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useAppTheme must be used within ThemeProvider");
  }
  return ctx;
}

export function useAppThemeOptional(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx) return ctx;
  return {
    preference: "light",
    setPreference: async () => {},
    isDark: false,
    colors: paletteForScheme(false),
  };
}
