import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Keyboard,
  Animated,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import LottieView from "lottie-react-native";
import RAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import HeaderHero from "./components/HeaderHero";
import {
  getDayPeriod,
  getHeaderSkyGradient,
  getWeatherAnimation,
  heroPrimaryTextColor,
  heroSecondaryTextColor,
} from "../../lib/weatherAnimation";
import TodayHabitsCard from "./components/TodayHabitsCard";
import TodayTasksCard from "./components/TodayTasksCard";
import NewsHomeCard from "./components/NewsHomeCard";
import BottomNav from "./components/BottomNav";
import { useAppTheme } from "../../contexts/ThemeContext";
import { getDashboardSurfaceColor, useUiPrefs } from "../../contexts/UiPrefsContext";

function greetingForPeriod(period: ReturnType<typeof getDayPeriod>): string {
  switch (period) {
    case "morning":
      return "Good morning";
    case "afternoon":
      return "Good afternoon";
    case "evening":
      return "Good evening";
    default:
      return "Welcome back";
  }
}

function splashTagline(period: ReturnType<typeof getDayPeriod>): string {
  switch (period) {
    case "morning":
      return "A gentle start to your day…";
    case "afternoon":
      return "Make today feel intentional…";
    case "evening":
      return "Slow down and reset…";
    default:
      return "A quiet moment for yourself…";
  }
}

const SplashLoader: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { isGuest, guestSession } = useAuth();
  const { isDark } = useAppTheme();
  const [firstName, setFirstName] = useState("");
  const now = useMemo(() => new Date(), []);
  const period = getDayPeriod(now);
  const sky = getHeaderSkyGradient(period, isDark);
  const primaryText = heroPrimaryTextColor(period, isDark);
  const secondaryText = heroSecondaryTextColor(period, isDark);
  const lottieSource = getWeatherAnimation("", "", period, now);

  const dot1 = useSharedValue(0.35);
  const dot2 = useSharedValue(0.35);
  const dot3 = useSharedValue(0.35);
  const greetPulse = useSharedValue(1);
  const cardFloat = useSharedValue(0);

  useEffect(() => {
    void (async () => {
      if (isGuest) {
        const n = guestSession?.name?.trim();
        setFirstName(n ? (n.split(/\s+/)[0] ?? "") : "");
        return;
      }
      try {
        const raw = await AsyncStorage.getItem("LOCAL_PROFILE");
        if (raw) {
          const p = JSON.parse(raw) as { name?: string };
          const full = typeof p.name === "string" ? p.name.trim() : "";
          setFirstName(full ? full.split(/\s+/)[0] ?? "" : "");
        }
      } catch {
        setFirstName("");
      }
    })();
  }, [isGuest, guestSession?.name]);

  useEffect(() => {
    dot1.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 420, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.35, { duration: 420, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    dot2.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: 180 }),
        withTiming(1, { duration: 420, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.35, { duration: 420, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    dot3.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: 360 }),
        withTiming(1, { duration: 420, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.35, { duration: 420, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    greetPulse.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    cardFloat.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
        withTiming(6, { duration: 2400, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, []);

  const d1Style = useAnimatedStyle(() => ({ opacity: dot1.value }));
  const d2Style = useAnimatedStyle(() => ({ opacity: dot2.value }));
  const d3Style = useAnimatedStyle(() => ({ opacity: dot3.value }));
  const greetStyle = useAnimatedStyle(() => ({
    transform: [{ scale: greetPulse.value }],
  }));
  const lottieFloatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: cardFloat.value }],
  }));

  const dateLong = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const dotTint = isDark
    ? "rgba(255,255,255,0.85)"
    : "rgba(44,44,40,0.55)";

  return (
    <LinearGradient
      colors={sky.colors}
      locations={sky.locations}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      style={[styles.splash, { paddingTop: insets.top }]}
    >
      <View style={styles.splashGlowTop} pointerEvents="none" />
      <View style={styles.splashGlowBottom} pointerEvents="none" />

      <View style={styles.splashInner}>
        <Text style={[styles.splashBrand, { color: primaryText }]}>UNIFLOW</Text>
        <Text style={[styles.splashDate, { color: secondaryText }]}>{dateLong}</Text>

        <RAnimated.View style={[styles.splashLottieWrap, lottieFloatStyle]}>
          <LottieView
            source={lottieSource as unknown as React.ComponentProps<typeof LottieView>["source"]}
            autoPlay
            loop
            style={styles.splashLottie}
          />
        </RAnimated.View>

        <BlurView
          intensity={Platform.OS === "ios" ? 48 : 32}
          tint={isDark ? "dark" : "light"}
          style={styles.splashGlass}
        >
          <RAnimated.View style={greetStyle}>
            <Text style={[styles.splashGreeting, { color: primaryText }]}>
              {greetingForPeriod(period)}
              {firstName ? (
                <Text style={[styles.splashGreetingName, { color: primaryText }]}>
                  {`, ${firstName}`}
                </Text>
              ) : null}
            </Text>
          </RAnimated.View>
          <Text style={[styles.splashTagline, { color: secondaryText }]}>
            {splashTagline(period)}
          </Text>

          <View style={styles.dotsRow}>
            <RAnimated.View style={[styles.dot, d1Style, { backgroundColor: dotTint }]} />
            <RAnimated.View style={[styles.dot, d2Style, { backgroundColor: dotTint }]} />
            <RAnimated.View style={[styles.dot, d3Style, { backgroundColor: dotTint }]} />
          </View>
        </BlurView>
      </View>
    </LinearGradient>
  );
};

let dashboardBootstrapDone = false;

/**
 * Hold the splash for at least this long on a cold start so the loader’s
 * Lottie + greeting can actually be felt. With cached weather/AQI the hero
 * is ready in <300ms which made the splash flash by — too fast to register.
 * Skipped on warm starts where `dashboardBootstrapDone` is already true.
 */
const SPLASH_MIN_VISIBLE_MS = 1000;

const DashboardScreen: React.FC = () => {
  const { colors, isDark } = useAppTheme();
  const { prefs } = useUiPrefs();

  const fadeIn = useRef(new Animated.Value(dashboardBootstrapDone ? 1 : 0)).current;
  const [heroReady, setHeroReady] = useState(dashboardBootstrapDone);
  const [minSplashElapsed, setMinSplashElapsed] = useState(dashboardBootstrapDone);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardBottomInset, setKeyboardBottomInset] = useState(0);

  /** The lightweight greeting hero drives the splash. */
  const dataReady = heroReady && minSplashElapsed;

  useEffect(() => {
    if (dashboardBootstrapDone) return;
    const t = setTimeout(() => setMinSplashElapsed(true), SPLASH_MIN_VISIBLE_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setIsKeyboardVisible(true);
        setKeyboardBottomInset(e.endCoordinates?.height ?? 0);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setIsKeyboardVisible(false);
        setKeyboardBottomInset(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const onHeroReady = useCallback(() => {
    setHeroReady(true);
  }, []);

  useEffect(() => {
    if (heroReady) {
      dashboardBootstrapDone = true;
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  }, [heroReady, fadeIn]);

  /**
   * Warm the Nearby Places data in the background as soon as the dashboard
   * is visible. By the time the user swipes over to Nearby, location +
   * initial "parks" results are already cached in-memory, shaving the 5-7s
   * cold-load down to near-instant. Only runs once location permission has
   * already been granted — we never request it from the dashboard.
   */
  /** Android: extra scroll room when `resize` leaves the field above the keyboard. iOS: KeyboardAvoidingView handles inset — avoid double padding. */
  const scrollBottomPad =
    128 +
    (Platform.OS === "android" && isKeyboardVisible ? keyboardBottomInset : 0);

  const pageBg = getDashboardSurfaceColor(
    prefs.colorPreset,
    isDark,
    isDark ? colors.background : colors.backgroundSecondary
  );

  return (
    <View style={[styles.container, { backgroundColor: pageBg }]}>
      {!dataReady && <SplashLoader />}

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        enabled={dataReady}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          nestedScrollEnabled
          scrollEnabled={dataReady}
          pointerEvents={dataReady ? "auto" : "none"}
          style={{ flex: 1, backgroundColor: pageBg }}
          contentContainerStyle={{ paddingBottom: scrollBottomPad }}
          showsVerticalScrollIndicator={false}
        >
        <HeaderHero
          onReady={onHeroReady}
          forceFreshWeatherOnMount={!dashboardBootstrapDone}
        />

        <Animated.View
          style={[
            styles.content,
            { opacity: fadeIn, backgroundColor: pageBg },
          ]}
        >
          <TodayHabitsCard />
          <TodayTasksCard />
          <NewsHomeCard />
        </Animated.View>
      </ScrollView>
      </KeyboardAvoidingView>
      {dataReady && <BottomNav />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -8,
    overflow: "hidden",
  },
  splash: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  splashGlowTop: {
    ...StyleSheet.absoluteFillObject,
    top: "8%",
    height: "42%",
    backgroundColor: "rgba(255,255,255,0.12)",
    opacity: 0.35,
    transform: [{ scaleX: 1.4 }],
    borderRadius: 999,
  },
  splashGlowBottom: {
    position: "absolute",
    left: "-20%",
    right: "-20%",
    bottom: "-15%",
    height: "55%",
    backgroundColor: "rgba(255,255,255,0.08)",
    opacity: 0.4,
    borderRadius: 999,
  },
  splashInner: {
    alignItems: "center",
    paddingHorizontal: 28,
    width: "100%",
    maxWidth: 400,
  },
  splashBrand: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 5,
    marginBottom: 6,
  },
  splashDate: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  splashLottieWrap: {
    width: 200,
    height: 200,
    marginVertical: 4,
  },
  splashLottie: {
    width: "100%",
    height: "100%",
  },
  splashGlass: {
    width: "100%",
    borderRadius: 22,
    overflow: "hidden",
    paddingVertical: 22,
    paddingHorizontal: 22,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: Platform.OS === "android" ? "rgba(255,255,255,0.08)" : undefined,
  },
  splashGreeting: {
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  splashGreetingName: {
    fontWeight: "800",
  },
  splashTagline: {
    fontSize: 15,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 22,
    marginTop: 10,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
});

export default DashboardScreen;
