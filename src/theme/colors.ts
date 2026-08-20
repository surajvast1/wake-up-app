export type ThemePreference = "light" | "dark" | "system";

export type AppColors = {
  background: string;
  backgroundSecondary: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderStrong: string;
  primary: string;
  primaryLight: string;
  primarySoftBg: string;
  danger: string;
  dangerSoftBg: string;
  dangerSoftBorder: string;
  success: string;
  overlay: string;
  overlayModal: string;
  inputBg: string;
  inputBorder: string;
  placeholder: string;
  menuButtonBg: string;
  menuButtonIcon: string;
  drawerBg: string;
  drawerDivider: string;
  drawerText: string;
  drawerMuted: string;
  inverse: string;
  shadow: string;
  sectionTitle: string;
  guestBannerBg: string;
  guestBannerBorder: string;
  guestBannerText: string;
  iconMuted: string;
  cardBg: string;
  cardBorder: string;
  /** Ring + dot on dashboard AQI card (bands match headline number). */
  aqiGood: string;
  aqiSatisfactory: string;
  aqiModerate: string;
  aqiPoor: string;
  aqiVeryPoor: string;
  aqiSevere: string;
};

export const lightColors: AppColors = {
  background: "#FFFFFF",
  backgroundSecondary: "#F1F6EE",
  surface: "#FFFFFF",
  surfaceElevated: "#FFFFFF",
  surfaceMuted: "#F5F5F5",
  text: "#1A1A1A",
  textSecondary: "#6B6B6B",
  textMuted: "#A0A0A0",
  border: "#EBEBEB",
  borderStrong: "#D5D5D5",
  primary: "#5B7553",
  primaryLight: "#7A9972",
  primarySoftBg: "#EDF2EB",
  danger: "#C45050",
  dangerSoftBg: "#FDF2F2",
  dangerSoftBorder: "#F5C6C6",
  success: "#5B7553",
  overlay: "rgba(0,0,0,0.40)",
  overlayModal: "rgba(0,0,0,0.35)",
  inputBg: "#FFFFFF",
  inputBorder: "#EBEBEB",
  placeholder: "#A0A0A0",
  menuButtonBg: "rgba(255,255,255,0.95)",
  menuButtonIcon: "#3D3D3D",
  drawerBg: "#FFFFFF",
  drawerDivider: "#EBEBEB",
  drawerText: "#1A1A1A",
  drawerMuted: "#A0A0A0",
  inverse: "#FFFFFF",
  shadow: "#000000",
  sectionTitle: "#3D3D3D",
  guestBannerBg: "#EDF2EB",
  guestBannerBorder: "#C5D4C1",
  guestBannerText: "#3D5637",
  iconMuted: "#8B8B8B",
  cardBg: "#FFFFFF",
  cardBorder: "rgba(0,0,0,0.06)",
  aqiGood: "#5B7553",
  aqiSatisfactory: "#6E8566",
  aqiModerate: "#9A8C5C",
  aqiPoor: "#B87A52",
  aqiVeryPoor: "#C56D5E",
  aqiSevere: "#C45050",
};

export const darkColors: AppColors = {
  background: "#0F1115",
  backgroundSecondary: "#151821",
  surface: "#191D26",
  surfaceElevated: "#222734",
  surfaceMuted: "#171A22",
  text: "#F1F3F8",
  textSecondary: "#AAB2C3",
  textMuted: "#70798C",
  border: "#2B3140",
  borderStrong: "#3A4355",
  primary: "#8EA7FF",
  primaryLight: "#B0C0FF",
  primarySoftBg: "#202844",
  danger: "#E87171",
  dangerSoftBg: "#2D1A1A",
  dangerSoftBorder: "#5C2020",
  success: "#8EA7FF",
  overlay: "rgba(0,0,0,0.70)",
  overlayModal: "rgba(0,0,0,0.72)",
  inputBg: "#191D26",
  inputBorder: "#2B3140",
  placeholder: "#626C80",
  menuButtonBg: "rgba(25,29,38,0.95)",
  menuButtonIcon: "#F1F3F8",
  drawerBg: "#13161D",
  drawerDivider: "#2B3140",
  drawerText: "#F1F3F8",
  drawerMuted: "#70798C",
  inverse: "#0F1115",
  shadow: "#000000",
  sectionTitle: "#D5DAE6",
  guestBannerBg: "#202844",
  guestBannerBorder: "#3B4B7A",
  guestBannerText: "#B0C0FF",
  iconMuted: "#70798C",
  cardBg: "#191D26",
  cardBorder: "rgba(255,255,255,0.06)",
  aqiGood: "#8BAF83",
  aqiSatisfactory: "#98B891",
  aqiModerate: "#C4AE6E",
  aqiPoor: "#D4986E",
  aqiVeryPoor: "#E4A090",
  aqiSevere: "#E87171",
};

export function paletteForScheme(isDark: boolean): AppColors {
  return isDark ? darkColors : lightColors;
}
