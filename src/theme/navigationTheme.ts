import { DarkTheme, DefaultTheme, Theme } from "@react-navigation/native";
import { AppColors } from "./colors";

export function buildNavigationTheme(
  colors: AppColors,
  isDark: boolean
): Theme {
  const base = isDark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.primary,
    },
  };
}
