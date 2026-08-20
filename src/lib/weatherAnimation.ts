/**
 * Maps condition + time of day → Lottie asset under assets/animations/.
 *
 * Most hero assets are Lottie JSON; the clear/sunny daytime hero uses a
 * DotLottie (`.lottie`). `lottie-react-native` resolves bundled `.lottie` URIs
 * via Metro (`assetExts` includes `lottie`).
 */

export type DayPeriod = "morning" | "afternoon" | "evening" | "night";

/**
 * Narrower clock bands used only for picking weather art.
 *  sunrise   5–8
 *  morning   8–12
 *  afternoon 12–16
 *  evening   16–19   ← user-requested "evening" window (4–7pm)
 *  night     19–5
 * `getDayPeriod` is kept as the coarser greeting bucket so existing gradient /
 * greeting logic stays stable.
 */
export type DayBand =
  | "sunrise"
  | "morning"
  | "afternoon"
  | "evening"
  | "night";

export function getDayPeriod(d: Date): DayPeriod {
  const h = d.getHours();
  if (h >= 21 || h < 5) return "night";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

/**
 * Stable module-level handle to the default sunny day Lottie. `require()`
 * returns a Metro asset *number* — we cache it once so callers can compare
 * `lottieSource === DEFAULT_SUNNY_DAY_MORNING_LOTTIE` to detect that asset
 * (used by `HeaderHero` to enlarge the sun art slightly).
 */
export const DEFAULT_SUNNY_DAY_MORNING_LOTTIE: number = require("../../assets/animations/defaultsunnydaymorning.json");

export function getDayBand(d: Date): DayBand {
  const h = d.getHours();
  if (h >= 5 && h < 8) return "sunrise";
  if (h >= 8 && h < 12) return "morning";
  if (h >= 12 && h < 16) return "afternoon";
  if (h >= 16 && h < 19) return "evening";
  return "night";
}

function classifyWeatherKey(description: string, typeFallback: string): string {
  const wl = `${description} ${typeFallback}`.toLowerCase();

  if (wl.includes("thunder") || wl.includes("lightning")) return "thunder";
  if (wl.includes("snow") || wl.includes("sleet") || wl.includes("ice")) return "snow";
  if (wl.includes("rain") || wl.includes("drizzle")) return "rain";
  if (wl.includes("fog") || wl.includes("mist") || wl.includes("haze")) return "fog";

  if (
    wl.includes("partly") ||
    wl.includes("periodic clouds") ||
    wl.includes("intermittent clouds")
  ) {
    return "partly";
  }

  if (wl.includes("clear") || wl.includes("sunny")) return "clear";

  if (wl.includes("storm")) return "thunder";

  if (wl.includes("cloud") || wl.includes("overcast")) return "cloud";
  return "default";
}

/**
 * Pick the best Lottie for the current weather + time of day.
 *
 * Rules (in priority order):
 *   1. Severe / wet weather overrides time — rain, thunder, snow always win.
 *   2. Fog / overcast shows the cloud lottie by day, panda by night.
 *   3. Partly cloudy by day → sun-between-clouds; night → panda.
 *   4. Clear / default weather follows the DayBand so the hero feels alive:
 *        sunrise          → Sunrise-sun-smilingbetweenclouds
 *        morning / afternoon → defaultsunnydaymorning
 *        evening          → evening-bird
 *        night            → night-baby-panda-sleeping
 *
 * Previously every time band returned `defaultsunnydaymorning`, which made
 * the sunny day art appear at night and during dusk. The mapping below also
 * means an unrecognised weather description (`default` key) still shows the
 * correct night/dusk art rather than always-sunny.
 *
 * `now` is an optional override (tests / previews); production callers can
 * omit it and we use the system clock.
 */
export function getWeatherAnimation(
  description: string,
  typeFallback: string,
  _dayPeriod: DayPeriod,
  now: Date = new Date()
): number {
  const key = classifyWeatherKey(description, typeFallback);
  const band = getDayBand(now);
  const isNight = band === "night";

  switch (key) {
    case "rain":
      return require("../../assets/animations/rainy-cloud-smiling-raning.json");
    case "thunder":
      return require("../../assets/animations/thunderstorm2.json");
    case "snow":
      return require("../../assets/animations/Snow.json");
    case "fog":
    case "cloud":
      return isNight
        ? require("../../assets/animations/night-baby-panda-sleeping.json")
        : require("../../assets/animations/cloudy.json");
    case "partly":
      if (band === "evening") {
        return require("../../assets/animations/evening-bird.json");
      }
      return isNight
        ? require("../../assets/animations/night-baby-panda-sleeping.json")
        : require("../../assets/animations/Sunrise-sun-smilingbetweenclouds.json");
    case "clear":
    default:
      switch (band) {
        case "sunrise":
          return require("../../assets/animations/Sunrise-sun-smilingbetweenclouds.json");
        case "morning":
        case "afternoon":
          return DEFAULT_SUNNY_DAY_MORNING_LOTTIE;
        case "evening":
          return require("../../assets/animations/evening-bird.json");
        case "night":
        default:
          return require("../../assets/animations/night-baby-panda-sleeping.json");
      }
  }
}

/**
 * Generic-purpose splash loader (pre-home-screen). Kept separate from weather
 * so the splash never jitters based on the hour — users expect a stable
 * "loading" motion.
 */
export function getSplashLoaderAnimation(): number {
  return require("../../assets/animations/Loader.json");
}

/** Offline / connectivity-failure illustration. */
export function getNoInternetAnimation(): number {
  return require("../../assets/animations/Nointernet.json");
}

/** Generic empty / not-found / error illustration. */
export function getErrorAnimation(): number {
  return require("../../assets/animations/404error.json");
}

/** Small pulsating "live" signal — used next to AQI / weather freshness. */
export function getLiveSignalAnimation(): number {
  return require("../../assets/animations/GreenLiveSignal.json");
}

export type HeaderSkyGradient = {
  colors: [string, string, string];
  /** Optional stops for a smoother blend */
  locations?: [number, number, number];
};

/** Background sky for the hero — shifts by time of day (light + dark variants). */
export function getHeaderSkyGradient(
  period: DayPeriod,
  isDark: boolean
): HeaderSkyGradient {
  if (isDark) {
    switch (period) {
      case "morning":
        return {
          colors: ["#11151F", "#1A2130", "#2A3854"],
          locations: [0, 0.45, 1],
        };
      case "afternoon":
        return {
          colors: ["#111722", "#1B2638", "#30425F"],
          locations: [0, 0.5, 1],
        };
      case "evening":
        return {
          colors: ["#171923", "#27283A", "#3D3C58"],
          locations: [0, 0.45, 1],
        };
      case "night":
      default:
        return {
          colors: ["#0E1118", "#171D2A", "#293750"],
          locations: [0, 0.5, 1],
        };
    }
  }

  switch (period) {
    case "morning":
      return {
        colors: ["#FFF8ED", "#E8F4FC", "#C8E8F5"],
        locations: [0, 0.42, 1],
      };
    case "afternoon":
      return {
        colors: ["#E8F2E8", "#C8E4D4", "#D9C896"],
        locations: [0, 0.48, 1],
      };
    case "evening":
      /* Golden hour: peach → coral blush → soft mauve (distinct from morning’s cool blues). */
      return {
        colors: ["#FFECD8", "#F5C4B0", "#D9A8BE"],
        locations: [0, 0.46, 1],
      };
    case "night":
    default:
      return {
        colors: ["#EDF6F6", "#D5EBEC", "#B8DEE0"],
        locations: [0, 0.48, 1],
      };
  }
}

/** Primary text on hero sky (labels, greeting). */
export function heroPrimaryTextColor(_period: DayPeriod, isDark: boolean): string {
  if (isDark) return "rgba(245,245,244,0.95)";
  return "#2C2C28";
}

export function heroSecondaryTextColor(_period: DayPeriod, isDark: boolean): string {
  if (isDark) return "rgba(200,200,195,0.85)";
  return "#5C5C56";
}

/* ═══════════════════════ Dashboard Ambient Tint ═══════════════════════ */

/** Coarse weather bucket used for dashboard ambient backgrounds. */
export type WeatherMood =
  | "sunny"
  | "partly"
  | "cloudy"
  | "rain"
  | "thunder"
  | "snow"
  | "fog"
  | "default";

export function classifyWeatherMood(
  description?: string | null,
  typeFallback?: string | null
): WeatherMood {
  const key = classifyWeatherKey(description ?? "", typeFallback ?? "");
  switch (key) {
    case "clear":
      return "sunny";
    case "partly":
      return "partly";
    case "cloud":
      return "cloudy";
    case "rain":
      return "rain";
    case "thunder":
      return "thunder";
    case "snow":
      return "snow";
    case "fog":
      return "fog";
    default:
      return "default";
  }
}

export interface DashboardAmbient {
  /** 3-stop gradient for the scrollable body below the hero. */
  colors: [string, string, string];
  locations: [number, number, number];
  /** Solid fallback when gradients would conflict with a card. */
  solid: string;
}

/**
 * Subtle sky/weather-driven wash behind the dashboard content so the UI feels
 * alive without competing with card readability.
 *
 * Light mode uses pastel tints; dark mode keeps a deep-neutral base and nudges
 * the hue toward the mood so temperature changes are felt but not jarring.
 */
export function getDashboardAmbient(
  mood: WeatherMood,
  period: DayPeriod,
  isDark: boolean
): DashboardAmbient {
  if (isDark) {
    const base: [string, string, string] = ["#0c0c12", "#0f1118", "#11141d"];
    switch (mood) {
      case "sunny":
        return {
          colors: ["#14140e", "#1a1a12", "#1f1d14"],
          locations: [0, 0.5, 1],
          solid: "#14140e",
        };
      case "partly":
        return {
          colors: ["#0f1218", "#11161e", "#141a24"],
          locations: [0, 0.5, 1],
          solid: "#0f1218",
        };
      case "rain":
        return {
          colors: ["#0b1420", "#0d1826", "#102033"],
          locations: [0, 0.5, 1],
          solid: "#0b1420",
        };
      case "thunder":
        return {
          colors: ["#10121a", "#14152a", "#1b1a34"],
          locations: [0, 0.5, 1],
          solid: "#10121a",
        };
      case "snow":
        return {
          colors: ["#141821", "#171c28", "#1b2230"],
          locations: [0, 0.5, 1],
          solid: "#141821",
        };
      case "fog":
        return {
          colors: ["#15171c", "#181a20", "#1b1e24"],
          locations: [0, 0.5, 1],
          solid: "#15171c",
        };
      case "cloudy":
        return {
          colors: ["#11141a", "#14171f", "#181b24"],
          locations: [0, 0.5, 1],
          solid: "#11141a",
        };
      default:
        return {
          colors: base,
          locations: [0, 0.5, 1],
          solid: base[0],
        };
    }
  }

  const night = period === "night";
  switch (mood) {
    case "sunny":
      return night
        ? {
            colors: ["#F7F2E3", "#F1E9CE", "#E8DDB4"],
            locations: [0, 0.5, 1],
            solid: "#F3ECD3",
          }
        : {
            colors: ["#FFF9E5", "#FFF1C5", "#FFE7A1"],
            locations: [0, 0.45, 1],
            solid: "#FFF3C9",
          };
    case "partly":
      return {
        colors: ["#FBFBEF", "#F0F5E0", "#E3EEDE"],
        locations: [0, 0.5, 1],
        solid: "#F2F5E6",
      };
    case "rain":
      return {
        colors: ["#EAF2FB", "#D5E6F7", "#B9D5ED"],
        locations: [0, 0.5, 1],
        solid: "#D5E6F7",
      };
    case "thunder":
      return {
        colors: ["#E5E6F4", "#CFD1EA", "#B4B7DB"],
        locations: [0, 0.5, 1],
        solid: "#CFD1EA",
      };
    case "snow":
      return {
        colors: ["#FFFFFF", "#F4F7FA", "#E6EEF5"],
        locations: [0, 0.5, 1],
        solid: "#F4F7FA",
      };
    case "fog":
      return {
        colors: ["#F2F3F4", "#E4E6E9", "#D2D6DA"],
        locations: [0, 0.5, 1],
        solid: "#E4E6E9",
      };
    case "cloudy":
      return {
        colors: ["#EFF4F8", "#DDE6EF", "#C6D3DE"],
        locations: [0, 0.5, 1],
        solid: "#DDE6EF",
      };
    default:
      return {
        colors: ["#F6F6F4", "#EDEFEA", "#E3E6DF"],
        locations: [0, 0.5, 1],
        solid: "#EDEFEA",
      };
  }
}
