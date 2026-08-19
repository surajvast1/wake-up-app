import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  AppState,
  Animated,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useFocusEffect } from "@react-navigation/native";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import LottieView from "lottie-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getDayPeriod,
  getHeaderSkyGradient,
  getLiveSignalAnimation,
  getWeatherAnimation,
  DEFAULT_SUNNY_DAY_MORNING_LOTTIE,
  heroPrimaryTextColor,
  heroSecondaryTextColor,
} from "../../../lib/weatherAnimation";
import {
  isCalendarConnected,
  fetchTodayEvents,
  CalEvent,
  formatEventTime,
} from "../../../services/calendarService";
import { useAuth } from "../../../contexts/AuthContext";
import { useAppTheme } from "../../../contexts/ThemeContext";
import {
  getTempLottieSource,
  getWeatherOverrideLottieSource,
  type WeatherLottieMood,
  useUiPrefs,
} from "../../../contexts/UiPrefsContext";
import type { AppColors } from "../../../theme/colors";
import {
  combinedDisplayFromStore,
  loadAqiDualStore,
  runDualAqiNetworkFetch,
} from "../../../services/aqiStoreService";

const LIVE_CACHE_KEY = "LIVE_AQI_WEATHER_CACHE";
const WEATHER_KEY = process.env.EXPO_PUBLIC_GOOGLE_WHEATHER_API_KEY ?? "";

/** Refetch AQI + weather when user moves farther than this from last fetch (km). */
const MOVE_REFRESH_KM = 12;

/** Refetch AQI (nearest CPCB/WAQI) when GPS moves this far from last saved position — lower than weather; station matching is hyperlocal. */
const AQI_RELOCATE_REFRESH_KM = 5;

/** Two Highest readings ~200ms apart, averaged — reduces one-shot network/cell bias (wrong nearest monitor). */
async function getAveragedHighAccuracyPosition(): Promise<{
  latitude: number;
  longitude: number;
}> {
  const opts = { accuracy: Location.Accuracy.Highest };
  const a = await Location.getCurrentPositionAsync(opts);
  await new Promise<void>((r) => setTimeout(r, 200));
  const b = await Location.getCurrentPositionAsync(opts);
  return {
    latitude: (a.coords.latitude + b.coords.latitude) / 2,
    longitude: (a.coords.longitude + b.coords.longitude) / 2,
  };
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type LiveCache = {
  temp: number | null;
  weather: string;
  weatherType?: string;
  feelsLike?: number | null;
  humidityPct?: number | null;
  aqi: number | null;
  pm25: number | null;
  pm10: number | null;
  stationName: string | null;
  stationDistance: number | null;
  updatedAtIso?: string;
  /** Where we last refreshed from (for move detection). */
  fetchLat?: number | null;
  fetchLon?: number | null;
  /** Local calendar day (YYYY-MM-DD) of last network refresh for daily-once policy. */
  dailyFetchDate?: string | null;
};

interface HeaderHeroProps {
  onReady?: () => void;
  /**
   * First dashboard open after app launch: always hit the network for weather + AQI
   * in the background after cache is shown. Does not delay `onReady` / splash.
   */
  forceFreshWeatherOnMount?: boolean;
}

const LONG_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const LONG_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const getGreeting = (d: Date) => {
  const h = d.getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
};

const humanizeWeatherType = (type: string): string => {
  const t = type
    .replace(/^WEATHER_CONDITION_TYPE_/i, "")
    .replace(/_/g, " ")
    .trim()
    .toLowerCase();
  if (!t) return "";
  return t.replace(/\b\w/g, (c) => c.toUpperCase());
};

const formatConditionLabel = (
  description: string,
  typeFallback: string
): string => {
  const d = description.trim();
  if (d === "Clear with periodic clouds") return "Partly clear";
  if (d.length > 0) {
    const lower = d.toLowerCase();
    if (lower.includes("cloud")) {
      if (lower.includes("partly")) return "Partly cloudy";
      if (lower.includes("mostly")) return "Mostly cloudy";
      if (lower.includes("overcast")) return "Overcast";
      if (d.length > 36) return "Cloudy";
    }
    return d.charAt(0).toUpperCase() + d.slice(1);
  }
  return humanizeWeatherType(typeFallback);
};

function resolveWeatherMood(
  description: string,
  typeFallback: string,
  dayPeriod: ReturnType<typeof getDayPeriod>
): WeatherLottieMood {
  const hay = `${description} ${typeFallback}`.toLowerCase();
  if (hay.includes("thunder") || hay.includes("lightning") || hay.includes("storm")) {
    return "thunder";
  }
  if (hay.includes("snow") || hay.includes("blizzard") || hay.includes("sleet")) {
    return "snow";
  }
  if (hay.includes("rain") || hay.includes("drizzle") || hay.includes("shower")) {
    return "rainy";
  }
  if (hay.includes("partly")) return "partly";
  if (hay.includes("cloud") || hay.includes("fog") || hay.includes("mist") || hay.includes("haze")) {
    return "cloudy";
  }
  if (dayPeriod === "night") return "night";
  if (dayPeriod === "evening") return "evening";
  return "sunny";
}

/** Band colors follow theme palette (sage greens → warm earth → danger). */
const getAqiInfo = (
  aqi: number,
  c: AppColors
): { label: string; dotColor: string } => {
  if (aqi <= 50) return { label: "Good", dotColor: c.aqiGood };
  if (aqi <= 100) return { label: "Satisfactory", dotColor: c.aqiSatisfactory };
  if (aqi <= 200) return { label: "Moderate", dotColor: c.aqiModerate };
  if (aqi <= 300) return { label: "Poor", dotColor: c.aqiPoor };
  if (aqi <= 400) return { label: "Very poor", dotColor: c.aqiVeryPoor };
  return { label: "Severe", dotColor: c.aqiSevere };
};

/* Hex/rgb helpers for tinting the AQI + temperature pills with color bands. */
function parseHexToRgb(hex: string): [number, number, number] | null {
  if (!hex) return null;
  let h = hex.trim();
  if (h.startsWith("#")) h = h.slice(1);
  if (h.length === 3) {
    h = h
      .split("")
      .map((x) => x + x)
      .join("");
  }
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return [r, g, b];
}
function tint(hex: string, alpha: number): string {
  const rgb = parseHexToRgb(hex);
  if (!rgb) return `rgba(180,180,180,${alpha})`;
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}

/** Band palette for an AQI pill — a soft pastel background + readable ink.
 *  Each band has its own hue so the pill itself communicates air quality at
 *  a glance: fresh green → warm yellow → orange → red → purple. */
function getAqiPillColors(
  aqi: number | null,
  _colors: AppColors,
  isDark: boolean
): { bg: string; border: string; text: string; accent: string } {
  if (aqi === null) {
    return {
      bg: isDark ? "rgba(40,44,40,0.88)" : "rgba(255,255,255,0.85)",
      border: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
      text: isDark ? "#E8E6E1" : "#2C2C28",
      accent: isDark ? "#E8E6E1" : "#2C2C28",
    };
  }
  // [bgLight, borderLight, inkLight, bgDark, borderDark, inkDark]
  let p: [string, string, string, string, string, string];
  if (aqi <= 50) {
    // Good — fresh green
    p = ["#E9F6E4", "#B8DCAA", "#2F5E1F", "#1F3A16", "#3F6B31", "#C8E8B9"];
  } else if (aqi <= 100) {
    // Satisfactory — soft yellow-green
    p = ["#F4F7D9", "#D7DF9A", "#5C6414", "#303316", "#5C6B22", "#E6EBB8"];
  } else if (aqi <= 200) {
    // Moderate — warm amber
    p = ["#FCEECF", "#E8C67F", "#7A4B0B", "#3A2B11", "#7A5A23", "#F3D9A7"];
  } else if (aqi <= 300) {
    // Poor — orange
    p = ["#FDE1D2", "#F2A57C", "#8A3416", "#3A1E14", "#8B4A2A", "#F4C4A9"];
  } else if (aqi <= 400) {
    // Very poor — red
    p = ["#FCDADA", "#ED9B9B", "#8B1D1D", "#3A1515", "#8E2E2E", "#F1B8B8"];
  } else {
    // Severe — deep purple
    p = ["#E6D7EC", "#B896C4", "#4A1E5C", "#261434", "#5A2C6E", "#D4B3DF"];
  }
  return isDark
    ? { bg: p[3], border: p[4], text: p[5], accent: p[5] }
    : { bg: p[0], border: p[1], text: p[2], accent: p[2] };
}

/** Band palette for a temperature pill in °C — icy blue → amber → red. */
function getTempPillColors(
  tempC: number | null,
  isDark: boolean
): { bg: string; border: string; text: string; accent: string } {
  if (tempC === null) {
    return {
      bg: isDark ? "rgba(40,44,40,0.88)" : "rgba(255,255,255,0.85)",
      border: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
      text: isDark ? "#E8E6E1" : "#2C2C28",
      accent: isDark ? "#E8E6E1" : "#2C2C28",
    };
  }
  let p: [string, string, string, string, string, string];
  if (tempC <= 0) {
    // Icy
    p = ["#E0EEFB", "#A6CDEE", "#0B4A7A", "#12253A", "#2F547A", "#BEDAF1"];
  } else if (tempC <= 10) {
    // Cool
    p = ["#DCEAFB", "#9FC1EE", "#1E3E7A", "#131E36", "#2E4C7A", "#BCD3F1"];
  } else if (tempC <= 20) {
    // Mild — fresh green
    p = ["#E4F3DE", "#AFD6A1", "#27571B", "#1A2F16", "#3C6B31", "#C6E2BA"];
  } else if (tempC <= 28) {
    // Warm — sunny yellow
    p = ["#F8F1C9", "#E3D587", "#685A0D", "#2F2B10", "#6A5D1E", "#EADFA3"];
  } else if (tempC <= 35) {
    // Hot — orange
    p = ["#FCDEC8", "#F1AA78", "#7F3510", "#351D14", "#8A4A2A", "#F4C4A9"];
  } else {
    // Scorching
    p = ["#FCD6D6", "#EB9595", "#861818", "#3A1515", "#8E2E2E", "#F1B8B8"];
  }
  return isDark
    ? { bg: p[3], border: p[4], text: p[5], accent: p[5] }
    : { bg: p[0], border: p[1], text: p[2], accent: p[2] };
}

function getAqiOutdoorAdvisory(aqi: number | null): string | null {
  if (aqi === null || aqi <= 110) return null;
  if (aqi <= 150) return "😷 Consider a mask outside today";
  if (aqi <= 200) return "😷 A mask is recommended today";
  if (aqi <= 300) return "⚠️ Avoid long outdoor exposure";
  return "🛑 Stay inside — hazardous air today";
}

const HeaderHero: React.FC<HeaderHeroProps> = ({
  onReady,
  forceFreshWeatherOnMount = false,
}) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { isGuest, guestSession } = useAuth();
  const { colors, isDark } = useAppTheme();
  const { prefs } = useUiPrefs();

  const [now, setNow] = useState(new Date());
  const [temp, setTemp] = useState<number | null>(null);
  const [weather, setWeather] = useState("");
  const [weatherType, setWeatherType] = useState("");
  const [feelsLike, setFeelsLike] = useState<number | null>(null);
  const [humidityPct, setHumidityPct] = useState<number | null>(null);
  const [aqi, setAqi] = useState<number | null>(null);
  const [pm25, setPm25] = useState<number | null>(null);
  const [pm10, setPm10] = useState<number | null>(null);
  const [, setAqiStation] = useState("");
  const [stationDistance, setStationDistance] = useState<number | null>(null);
  const [userName, setUserName] = useState("");
  const [calEvents, setCalEvents] = useState<CalEvent[]>([]);
  const [calConnected, setCalConnected] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const forceFreshRef = useRef(forceFreshWeatherOnMount);
  forceFreshRef.current = forceFreshWeatherOnMount;

  const [, setLastLiveIso] = useState<string | null>(null);

  const loadCalendarEvents = useCallback(async () => {
    try {
      const conn = await isCalendarConnected();
      setCalConnected(conn);
      if (conn) {
        const ev = await fetchTodayEvents();
        setCalEvents(ev);
      }
    } catch {}
  }, []);

  const refreshDisplayName = useCallback(async () => {
    if (isGuest) {
      const n = guestSession?.name?.trim();
      setUserName(n ?? "");
      return;
    }
    try {
      const raw = await AsyncStorage.getItem("LOCAL_PROFILE");
      if (raw) {
        const p = JSON.parse(raw) as { name?: string };
        setUserName(typeof p.name === "string" ? p.name.trim() : "");
      } else {
        setUserName("");
      }
    } catch {
      setUserName("");
    }
  }, [isGuest, guestSession?.name]);

  useFocusEffect(
    useCallback(() => {
      loadCalendarEvents();
      void refreshDisplayName();
    }, [loadCalendarEvents, refreshDisplayName])
  );

  const isPollingRef = useRef(false);
  const readyFiredRef = useRef(false);

  /** Dismiss dashboard splash as soon as cache is applied — network refresh runs after. */
  const trySignalHeroReady = () => {
    if (readyFiredRef.current) return;
    readyFiredRef.current = true;
    onReady?.();
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  };

  useEffect(() => {
    void refreshDisplayName();
  }, [refreshDisplayName]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  /* ---------- WEATHER ---------- */
  const refreshWeather = async (lat: number, lon: number) => {
    try {
      const res = await fetch(
        `https://weather.googleapis.com/v1/currentConditions:lookup?key=${WEATHER_KEY}&location.latitude=${lat}&location.longitude=${lon}`
      );
      const json = await res.json();
      const nextTemp = json.temperature?.degrees ?? null;
      const nextWeather = json.weatherCondition?.description?.text ?? "";
      const nextType = String(json.weatherCondition?.type ?? "");
      const nextFeels =
        typeof json.feelsLikeTemperature?.degrees === "number"
          ? json.feelsLikeTemperature.degrees
          : null;
      const nextHum =
        typeof json.relativeHumidity === "number"
          ? Math.round(json.relativeHumidity)
          : null;
      setTemp(nextTemp);
      setWeather(nextWeather);
      setWeatherType(nextType);
      setFeelsLike(nextFeels);
      setHumidityPct(nextHum);
      await saveLiveCache({
        temp: nextTemp,
        weather: nextWeather,
        weatherType: nextType,
        feelsLike: nextFeels,
        humidityPct: nextHum,
      });
    } catch (e) {
      console.error("Weather fetch failed", e);
    }
  };

  /* ---------- AQI (CPCB India) ---------- */
  const runAqiFetch = async (lat: number, lon: number) => {
    try {
      const d = await runDualAqiNetworkFetch(lat, lon);
      setAqi(d.displayAqi);
      setPm25(d.pm25);
      setPm10(d.pm10);
      setAqiStation(d.stationLine);
      setStationDistance(d.stationDistance);
      await saveLiveCache({
        aqi: d.displayAqi,
        pm25: d.pm25,
        pm10: d.pm10,
        stationName: d.stationLine || undefined,
        stationDistance: d.stationDistance,
      });
    } catch (e) {
      console.error("AQI fetch failed", e);
    }
  };

  const refreshAqi = async (lat: number, lon: number) => {
    await runAqiFetch(lat, lon);
  };

  /* ---------- LIVE CACHE ---------- */
  const loadLiveCache = async (): Promise<Partial<LiveCache> | null> => {
    try {
      const cached = await AsyncStorage.getItem(LIVE_CACHE_KEY);
      if (!cached) return null;
      const parsed = JSON.parse(cached) as Partial<LiveCache>;
      if (!parsed) return null;
      if (typeof parsed.temp === "number") setTemp(parsed.temp);
      if (typeof parsed.weather === "string" && parsed.weather)
        setWeather(parsed.weather);
      if (typeof parsed.weatherType === "string")
        setWeatherType(parsed.weatherType);
      if (typeof parsed.feelsLike === "number") setFeelsLike(parsed.feelsLike);
      if (typeof parsed.humidityPct === "number")
        setHumidityPct(parsed.humidityPct);
      if (typeof parsed.aqi === "number") setAqi(parsed.aqi);
      if (typeof parsed.pm25 === "number") setPm25(parsed.pm25);
      if (typeof parsed.pm10 === "number") setPm10(parsed.pm10);
      if (typeof parsed.stationName === "string")
        setAqiStation(parsed.stationName);
      if (typeof parsed.stationDistance === "number")
        setStationDistance(parsed.stationDistance);
      if (typeof parsed.updatedAtIso === "string")
        setLastLiveIso(parsed.updatedAtIso);
      return parsed;
    } catch {
      return null;
    }
  };

  const saveLiveCache = async (partial: {
    temp?: number | null;
    weather?: string;
    weatherType?: string;
    feelsLike?: number | null;
    humidityPct?: number | null;
    aqi?: number | null;
    pm25?: number | null;
    pm10?: number | null;
    stationName?: string;
    stationDistance?: number | null;
    fetchLat?: number | null;
    fetchLon?: number | null;
    dailyFetchDate?: string | null;
  }) => {
    try {
      const existingRaw = await AsyncStorage.getItem(LIVE_CACHE_KEY);
      const existing = existingRaw ? JSON.parse(existingRaw) : {};
      const next = {
        ...existing,
        ...partial,
        updatedAtIso: new Date().toISOString(),
      };
      await AsyncStorage.setItem(LIVE_CACHE_KEY, JSON.stringify(next));
      setLastLiveIso(next.updatedAtIso as string);
    } catch {}
  };

  /**
   * Local calendar day rolled over while app is open (`now` ticks every 30s):
   * refresh temperature + AQI and persist (same as daily policy in startPolling).
   */
  const headerCalendarDayRef = useRef<string | null>(null);
  useEffect(() => {
    const day = fmtLocalDate(now);
    if (headerCalendarDayRef.current === null) {
      headerCalendarDayRef.current = day;
      return;
    }
    if (day === headerCalendarDayRef.current) return;
    headerCalendarDayRef.current = day;

    void (async () => {
      if (isPollingRef.current) return;
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.status !== "granted") return;
        const { latitude, longitude } = await getAveragedHighAccuracyPosition();
        await Promise.all([
          refreshWeather(latitude, longitude),
          refreshAqi(latitude, longitude),
        ]);
        await saveLiveCache({
          fetchLat: latitude,
          fetchLon: longitude,
          dailyFetchDate: day,
        });
      } catch (e) {
        console.error("Header daily rollover refresh failed", e);
      }
    })();
  }, [now]);

  /* ---------- MAIN EFFECT ---------- */
  useEffect(() => {
    let appStateSub: { remove: () => void } | undefined;

    const startPolling = async () => {
      if (isPollingRef.current) return;
      isPollingRef.current = true;
      try {
        const [cacheSnapshot, initialDual, perm] = await Promise.all([
          loadLiveCache(),
          loadAqiDualStore(),
          Location.getForegroundPermissionsAsync(),
        ]);

        if (initialDual && (initialDual.waqi || initialDual.cpcb)) {
          const id = combinedDisplayFromStore(initialDual);
          setAqi(id.displayAqi);
          setPm25(id.pm25);
          setPm10(id.pm10);
          setAqiStation(id.stationLine);
          setStationDistance(id.stationDistance);
        }

        trySignalHeroReady();

        if (perm.status !== "granted") {
          const req = await Location.requestForegroundPermissionsAsync();
          if (req.status !== "granted") {
            return;
          }
        }

        const { latitude: lat, longitude: lon } =
          await getAveragedHighAccuracyPosition();
        if (__DEV__) {
          console.log(
            `[AQI] HeaderHero poll position (2× Highest, avg): lat=${lat.toFixed(6)} lon=${lon.toFixed(6)}`
          );
        }

        const todayStr = fmtLocalDate(new Date());
        const rawMeta = cacheSnapshot ?? {};

        const lastLat =
          typeof rawMeta.fetchLat === "number" ? rawMeta.fetchLat : null;
        const lastLon =
          typeof rawMeta.fetchLon === "number" ? rawMeta.fetchLon : null;
        const lastDaily =
          typeof rawMeta.dailyFetchDate === "string"
            ? rawMeta.dailyFetchDate
            : "";

        const dualDisp = combinedDisplayFromStore(initialDual);
        const hasDualAir =
          !!initialDual &&
          (initialDual.waqi || initialDual.cpcb) &&
          (dualDisp.displayAqi !== null || dualDisp.stationLine.length > 0);

        let distanceKm = Infinity;
        if (lastLat !== null && lastLon !== null) {
          distanceKm = haversineKm(lat, lon, lastLat, lastLon);
        }

        const movedFar = distanceKm > MOVE_REFRESH_KM;
        /** One network refresh per local calendar day for both weather + AQI; persisted under LIVE_CACHE + AQI store. */
        const alreadyFetchedToday = lastDaily === todayStr;
        const hasAnyDisplayable =
          typeof rawMeta.temp === "number" ||
          typeof rawMeta.aqi === "number" ||
          hasDualAir ||
          (typeof rawMeta.weather === "string" &&
            rawMeta.weather.trim().length > 0);

        const shouldFetchNetwork =
          forceFreshRef.current ||
          !hasAnyDisplayable ||
          movedFar ||
          !alreadyFetchedToday;

        if (!shouldFetchNetwork) {
          const needsAqiRelocalize =
            lastLat !== null &&
            lastLon !== null &&
            distanceKm > AQI_RELOCATE_REFRESH_KM;

          if (needsAqiRelocalize) {
            await refreshAqi(lat, lon);
            await saveLiveCache({
              fetchLat: lat,
              fetchLon: lon,
            });
          }

          return;
        }

        await Promise.all([
          refreshWeather(lat, lon),
          refreshAqi(lat, lon),
        ]);

        await saveLiveCache({
          fetchLat: lat,
          fetchLon: lon,
          dailyFetchDate: todayStr,
        });
      } catch (e) {
        console.error(e);
        trySignalHeroReady();
      } finally {
        isPollingRef.current = false;
      }
    };

    const stopPolling = () => {
      isPollingRef.current = false;
    };

    appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") startPolling();
      else stopPolling();
    });

    startPolling();

    const splashFallbackMs = forceFreshRef.current ? 12_000 : 4_000;
    const timeout = setTimeout(() => {
      trySignalHeroReady();
    }, splashFallbackMs);

    return () => {
      clearTimeout(timeout);
      stopPolling();
      appStateSub?.remove();
    };
  }, []);

  /* ---------- DERIVED ---------- */
  const greeting = useMemo(() => getGreeting(now), [now]);

  const conditionLabel = useMemo(
    () => formatConditionLabel(weather, weatherType),
    [weather, weatherType]
  );

  const dayPeriod = useMemo(() => getDayPeriod(now), [now]);
  const activeWeatherMood = useMemo(
    () => resolveWeatherMood(weather, weatherType, dayPeriod),
    [weather, weatherType, dayPeriod]
  );
  const sky = useMemo(
    () => getHeaderSkyGradient(dayPeriod, isDark),
    [dayPeriod, isDark]
  );
  const heroText = useMemo(
    () => heroPrimaryTextColor(dayPeriod, isDark),
    [dayPeriod, isDark]
  );
  const heroMuted = useMemo(
    () => heroSecondaryTextColor(dayPeriod, isDark),
    [dayPeriod, isDark]
  );
  const dateLongStr = useMemo(() => {
    const d = now.getDay();
    const day = now.getDate();
    const m = now.getMonth();
    return `${LONG_DAYS[d]}, ${day} ${LONG_MONTHS[m]}`;
  }, [now]);

  const lottieSource = useMemo(
    () => {
      const severeWeather = ["rainy", "thunder", "snow"].includes(
        activeWeatherMood
      );
      const moodOverride = getWeatherOverrideLottieSource(
        activeWeatherMood,
        prefs.weatherLottieOverrides[activeWeatherMood]
      );

      // Dusk and night must never show a daytime sun asset because of a
      // previously saved UI preset. Severe weather remains more important
      // than the time-of-day art.
      if (!severeWeather && (dayPeriod === "evening" || dayPeriod === "night")) {
        return getWeatherAnimation(weather, weatherType, dayPeriod, now);
      }

      return (
        moodOverride ??
        getTempLottieSource(prefs.tempLottiePreset) ??
        getWeatherAnimation(weather, weatherType, dayPeriod, now)
      );
    },
    [
      prefs.weatherLottieOverrides,
      prefs.tempLottiePreset,
      activeWeatherMood,
      weather,
      weatherType,
      dayPeriod,
      now,
    ]
  );

  const isDefaultSunnyLottie = lottieSource === DEFAULT_SUNNY_DAY_MORNING_LOTTIE;

  const aqiInfo = useMemo(
    () => (aqi !== null ? getAqiInfo(aqi, colors) : null),
    [aqi, colors]
  );

  const itemsStillToday = useMemo(() => {
    const nowMs = now.getTime();
    return calEvents.filter((e) => e.endDate.getTime() > nowMs);
  }, [calEvents, now]);

  const itemCount = itemsStillToday.length;

  const nextItemPreview = useMemo(() => {
    const nowMs = now.getTime();
    const list = itemsStillToday;
    if (list.length === 0) return null;
    const upcoming = list.find((e) => e.startDate.getTime() > nowMs);
    if (upcoming) {
      return {
        event: upcoming,
        timeLabel: upcoming.allDay ? "All day" : formatEventTime(upcoming.startDate),
      };
    }
    const ongoing = list.find(
      (e) => e.startDate.getTime() <= nowMs && e.endDate.getTime() > nowMs
    );
    if (ongoing) {
      return {
        event: ongoing,
        timeLabel: ongoing.allDay ? "All day" : `Until ${formatEventTime(ongoing.endDate)}`,
      };
    }
    const first = list[0];
    return {
      event: first,
      timeLabel: first.allDay ? "All day" : formatEventTime(first.startDate),
    };
  }, [itemsStillToday, now]);

  const avatarLetter = userName ? userName.charAt(0).toUpperCase() : "U";

  const avatarGlassBg = isDark
    ? "rgba(255,255,255,0.14)"
    : "rgba(255,255,255,0.55)";
  const avatarIconColor = isDark ? "#FFFFFF" : colors.primary;
  const pillTextPrimary = isDark ? "#E8E6E1" : "#2C2C28";
  const aqiPill = useMemo(
    () => getAqiPillColors(aqi, colors, isDark),
    [aqi, colors, isDark]
  );
  const tempPill = useMemo(
    () => getTempPillColors(temp, isDark),
    [temp, isDark]
  );

  /* ---------- RENDER ---------- */
  return (
    <LinearGradient
      colors={[...sky.colors]}
      locations={
        sky.locations
          ? ([...sky.locations] as [number, number, number])
          : undefined
      }
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.heroGradient,
        { paddingTop: insets.top + 4 },
      ]}
    >
      <Animated.View
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
      >
        <View style={styles.topBar}>
          <View style={{ width: 42 }} />
          <Text style={[styles.brand, { color: heroText }]}>UNIFLOW</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.navigate("profile")}
            style={[
              styles.avatar,
              {
                backgroundColor: avatarGlassBg,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.35)",
              },
            ]}
          >
            <Ionicons name="person" size={18} color={avatarIconColor} />
          </TouchableOpacity>
        </View>

        <View style={styles.heroTwoCol}>
          <View style={styles.heroColLeft}>
            <Text style={[styles.heroGreeting, { color: heroText }]}>
              {greeting}
              {userName ? ", " : ""}
              {userName ? (
                <Text style={[styles.heroGreetingName, { color: heroText }]}>
                  {userName}
                </Text>
              ) : null}
            </Text>

            <View style={styles.liveDataRow}>
              <LottieView
                source={
                  getLiveSignalAnimation() as unknown as React.ComponentProps<
                    typeof LottieView
                  >["source"]
                }
                autoPlay
                loop
                style={styles.liveDotLottie}
              />
              <Text style={[styles.liveDataLabel, { color: "#22C55E" }]}>
                LIVE DATA
              </Text>
            </View>

            <Text style={[styles.heroDateLong, { color: colors.text }]}>
              {dateLongStr}
            </Text>
          </View>

          <View style={styles.heroColRight}>
            <LottieView
              key={`${conditionLabel}-${dayPeriod}-${prefs.tempLottiePreset}-${activeWeatherMood}-${prefs.weatherLottieOverrides[activeWeatherMood] ?? "auto"}`}
              source={lottieSource as unknown as React.ComponentProps<typeof LottieView>["source"]}
              autoPlay
              loop
              style={styles.heroLottie}
            />
            <View style={styles.heroRightWeatherBlock}>
              <Text style={[styles.heroConditionRight, { color: heroText }]}>
                {conditionLabel || "—"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.heroPillsRow}>
          <View
            style={[
              styles.heroPill,
              styles.tempPill,
              styles.heroPillRowCell,
              {
                backgroundColor: aqiPill.bg,
                borderWidth: 1,
                borderColor: aqiPill.border,
              },
            ]}
          >
            <Text
              style={[
                styles.heroPillValue,
                styles.tempPillValue,
                styles.aqiPillLabel,
                { color: aqiPill.text },
              ]}
            >
              AQI{" "}
            </Text>
            <Text
              style={[
                styles.heroPillValue,
                styles.tempPillValue,
                { color: aqiPill.accent },
              ]}
            >
              {aqi !== null ? aqi : "—"}
            </Text>
            {aqiInfo?.label ? (
              <Text
                style={[
                  styles.heroPillValue,
                  styles.aqiBandLabel,
                  { color: aqiPill.text },
                ]}
              >
                {" · "}
                {aqiInfo.label}
              </Text>
            ) : null}
          </View>
          <View
            style={[
              styles.heroPill,
              styles.tempPill,
              styles.heroPillRowCell,
              {
                backgroundColor: tempPill.bg,
                borderWidth: 1,
                borderColor: tempPill.border,
              },
            ]}
          >
            <Text
              style={[
                styles.heroPillValue,
                styles.tempPillValue,
                { color: tempPill.accent },
              ]}
            >
              {temp !== null ? `${Number(temp).toFixed(1)}°C` : "—°C"}
            </Text>
          </View>
        </View>

        {/* Calendar banner */}
        {calConnected && itemCount > 0 && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.navigate("calendar")}
            style={[
              styles.calBanner,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.calLeft}>
              <View style={[styles.calIconWrap, { backgroundColor: colors.primarySoftBg }]}>
                <Ionicons name="calendar" size={14} color={colors.primary} />
              </View>
              <Text style={[styles.calCount, { color: colors.text }]}>
                {itemCount} item{itemCount !== 1 ? "s" : ""} today
              </Text>
            </View>
            {nextItemPreview && (
              <View style={styles.calRight}>
                <Text
                  style={[styles.calNext, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {nextItemPreview.event.title}
                </Text>
                <Text style={[styles.calTime, { color: colors.primary }]}>
                  {nextItemPreview.timeLabel}
                </Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </Animated.View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  heroGradient: {
    paddingHorizontal: 20,
    paddingBottom: 22,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  brand: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 3,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTwoCol: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  heroColLeft: {
    flex: 1.15,
    minWidth: 0,
    paddingRight: 4,
  },
  heroColRight: {
    flex: 0.85,
    alignItems: "center",
    paddingTop: 0,
  },
  heroRightWeatherBlock: {
    alignItems: "center",
    alignSelf: "center",
    width: "100%",
    maxWidth: "100%",
    marginTop: -30,
  },
  heroPillsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    width: "100%",
    gap: 12,
  },
  heroPillRowCell: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  heroGreeting: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.6,
    lineHeight: 32,
  },
  heroGreetingName: {
    fontWeight: "900",
  },
  liveDataRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 6,
    alignSelf: "flex-start",
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#22C55E",
  },
  liveDotLottie: {
    width: 18,
    height: 18,
    marginLeft: -3,
  },
  liveDataLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  heroDateLong: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
    letterSpacing: 0.2,
  },
  tempPill: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 18,
    minHeight: 40,
    justifyContent: "center",
  },
  tempPillValue: {
    fontSize: 18,
    letterSpacing: -0.25,
  },
  aqiPillLabel: {
    fontWeight: "700",
  },
  aqiBandLabel: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.1,
  },
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
    }),
  },
  heroPillValue: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  heroLottie: {
    width: 148,
    height: 148,
    marginTop: -8,
  },
  heroConditionRight: {
    fontSize: 15,
    fontWeight: "800",
    marginTop: 20,
    marginBottom: 0,
    textAlign: "center",
    width: "100%",
    paddingHorizontal: 4,
    lineHeight: 20,
  },
  calBanner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginTop: 12,
    gap: 10,
  },
  calLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  calIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  calCount: {
    fontSize: 13,
    fontWeight: "700",
  },
  calRight: {
    flex: 1,
    alignItems: "flex-end",
    paddingRight: 4,
  },
  calNext: {
    fontSize: 12,
    fontWeight: "600",
    maxWidth: 160,
  },
  calTime: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 1,
  },
});

export default HeaderHero;
