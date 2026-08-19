/**
 * Homepage cards: diagonal fill matches the **left rail hue** — very light (top-left)
 * → a bit darker (bottom-right), like the quote card’s mood strip + fill relationship.
 */

export type HomeCardVariant = "routine" | "manifest" | "habits" | "news";

type CardTheme = {
  gradient: readonly [string, string, string];
  borderColor: string;
  /** Same family as the 4px rail; used for shadow tint */
  shadowColor: string;
};

function themeFor(
  variant: HomeCardVariant,
  isDark: boolean
): CardTheme {
  if (isDark) {
    switch (variant) {
      case "routine":
        return {
          gradient: ["#14130F", "#1A1813", "#201D17"] as const,
          borderColor: "rgba(212, 184, 120, 0.22)",
          shadowColor: "#6B5C45",
        };
      case "manifest":
        return {
          gradient: ["#2A1810", "#3A2014", "#452618"] as const,
          borderColor: "rgba(249, 115, 22, 0.34)",
          shadowColor: "#F97316",
        };
      case "habits":
        return {
          gradient: ["#142016", "#1A2A1C", "#1F3522"] as const,
          borderColor: "rgba(163, 230, 53, 0.28)",
          shadowColor: "#65A30D",
        };
      case "news":
        return {
          gradient: ["#181624", "#1E1C2E", "#242038"] as const,
          borderColor: "rgba(165, 180, 252, 0.32)",
          shadowColor: "#6366F1",
        };
    }
  }

  /* Light: top-left pale tint of rail hue → bottom-right deeper same hue (not flat blue). */
  switch (variant) {
    case "routine":
      return {
        // add little darker colors
        gradient: ["#FAFAF6", "#F4F0E4", "#D6CFA8"] as const,
        borderColor: "rgba(154, 136, 98, 0.22)",
        shadowColor: "#B8A88A",
      };
    case "manifest":
      return {
        gradient: ["#FFFAF5", "#FFDCC4", "#E8A87C"] as const,
        borderColor: "rgba(154, 52, 18, 0.3)",
        shadowColor: "#C2410C",
      };
    case "habits":
      return {
        gradient: ["#F6FEF8", "#D1FAE5", "#4ADE80"] as const,
        borderColor: "rgba(63, 98, 18, 0.3)",
        shadowColor: "#4D7C0F",
      };
    case "news":
      return {
        gradient: ["#FAFBFF", "#E8ECFF", "#A5B4FC"] as const,
        borderColor: "rgba(49, 46, 129, 0.28)",
        shadowColor: "#4F46E5",
      };
  }
}

export function getHomeDashboardCardTheme(
  variant: HomeCardVariant,
  isDark: boolean
): CardTheme {
  return themeFor(variant, isDark);
}

export function getHomeDashboardCardAccent(
  variant: HomeCardVariant,
  isDark: boolean
): string {
  switch (variant) {
    case "routine":
      return isDark ? "#C9B896" : "#8F7F5C";
    case "manifest":
      return isDark ? "#F97316" : "#9A3412";
    case "habits":
      return isDark ? "#BEF264" : "#3F6212";
    case "news":
      return isDark ? "#A5B4FC" : "#312E81";
  }
}

export function getHomeDashboardCardText(isDark: boolean): {
  title: string;
  subtitle: string;
  chevron: string;
} {
  if (isDark) {
    return {
      title: "#F1F5F9",
      subtitle: "#A8B2BD",
      chevron: "#8896A4",
    };
  }
  return {
    title: "#0A0F1A",
    subtitle: "#2C3D4F",
    chevron: "#4A5D6E",
  };
}

/** Soft tint behind icon circles (8-digit hex where supported). */
export function homeCardIconBubbleBg(accent: string, isDark: boolean): string {
  return accent + (isDark ? "38" : "2A");
}
