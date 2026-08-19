import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  Linking,
  Platform,
  ActivityIndicator,
  Keyboard,
  Dimensions,
  ViewToken,
  ScrollView,
} from "react-native";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import LottieView from "lottie-react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import MenuButton from "../../components/MenuButton";
import SwipeToScreens from "../../components/SwipeToScreens";
import { useAppTheme } from "../../contexts/ThemeContext";
import type { AppColors } from "../../theme/colors";
import { getSplashLoaderAnimation } from "../../lib/weatherAnimation";
import {
  searchPlacesNearLocation,
  sortNearbyPlaces,
  type NearbyPlace,
  type NearbyPlaceSortMode,
} from "../../services/nearbyPlacesService";
import { getNearbyPrefetch } from "../../services/nearbyPrefetchService";
import {
  APP_SESSION_SEED,
  seededShuffle,
} from "../../services/newsService";
import PlaceCard from "./components/PlaceCard";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const LIST_BOTTOM_PAD = 12;
/** Only the header title is inset to clear the floating menu (~14 + 36 + gap). */
const TITLE_LEFT_INSET = 54;
/** Normal horizontal padding for everything below the title */
const GUTTER = 20;

const SORT_OPTIONS: {
  id: string;
  label: string;
  mode: NearbyPlaceSortMode;
}[] = [
  { id: "rating", label: "Rating", mode: "rating" },
  { id: "distance", label: "Distance", mode: "distance" },
  { id: "reviews", label: "Reviews", mode: "reviews" },
  { id: "name", label: "A–Z", mode: "name" },
  { id: "relevance", label: "Match", mode: "relevance" },
];

/**
 * "Explore near you" CTA cards. Each card has a gradient, an icon, and a query
 * to trigger when tapped. We rotate which 4 are shown on every app session.
 */
interface ExploreVibe {
  id: string;
  title: string;
  subtitle: string;
  query: string;
  icon: keyof typeof Ionicons.glyphMap;
  colors: readonly [string, string];
}

const EXPLORE_VIBES: ExploreVibe[] = [
  {
    id: "restaurants",
    title: "Nearby restaurants",
    subtitle: "Tonight's best dinners",
    query: "restaurants",
    icon: "restaurant-outline",
    colors: ["#FF6B6B", "#C0392B"] as const,
  },
  {
    id: "cafes",
    title: "Cozy cafés",
    subtitle: "Coffee & slow mornings",
    query: "cafes",
    icon: "cafe-outline",
    colors: ["#A97155", "#6F4A30"] as const,
  },
  {
    id: "bookshops",
    title: "Bookshops",
    subtitle: "A quiet afternoon read",
    query: "bookshop",
    icon: "book-outline",
    colors: ["#E8A87C", "#85586F"] as const,
  },
  {
    id: "bars",
    title: "Bars & lounges",
    subtitle: "Unwind with friends",
    query: "bars",
    icon: "wine-outline",
    colors: ["#5E2B97", "#2D1457"] as const,
  },
  {
    id: "museums",
    title: "Museums",
    subtitle: "Step into a story",
    query: "museum",
    icon: "color-palette-outline",
    colors: ["#355C7D", "#2C3E50"] as const,
  },
  {
    id: "icecream",
    title: "Ice cream spots",
    subtitle: "Sweet & chilled",
    query: "ice cream",
    icon: "ice-cream-outline",
    colors: ["#F78CA0", "#D63384"] as const,
  },
  {
    id: "parks",
    title: "Parks",
    subtitle: "Green, open, breathing",
    query: "parks",
    icon: "leaf-outline",
    colors: ["#3A8E5E", "#1E5128"] as const,
  },
  {
    id: "bakeries",
    title: "Bakeries",
    subtitle: "Fresh bread & pastries",
    query: "bakery",
    icon: "pizza-outline",
    colors: ["#F7B267", "#C76F32"] as const,
  },
  {
    id: "gyms",
    title: "Gyms",
    subtitle: "Get that workout in",
    query: "gym",
    icon: "barbell-outline",
    colors: ["#0F4C5C", "#042A36"] as const,
  },
  {
    id: "spa",
    title: "Spas & salons",
    subtitle: "A little self‑care",
    query: "spa",
    icon: "flower-outline",
    colors: ["#D6A7C2", "#7F5980"] as const,
  },
  {
    id: "cinemas",
    title: "Cinemas",
    subtitle: "Catch a late show",
    query: "cinema",
    icon: "film-outline",
    colors: ["#2C2C54", "#0E0E2C"] as const,
  },
  {
    id: "markets",
    title: "Markets",
    subtitle: "Local finds & groceries",
    query: "supermarket",
    icon: "basket-outline",
    colors: ["#FFBF69", "#CB6C19"] as const,
  },
  {
    id: "pharmacies",
    title: "Pharmacies",
    subtitle: "Meds & essentials",
    query: "pharmacy",
    icon: "medkit-outline",
    colors: ["#3EC1D3", "#115E67"] as const,
  },
  {
    id: "hotels",
    title: "Hotels",
    subtitle: "A place to stay",
    query: "hotel",
    icon: "bed-outline",
    colors: ["#3D5A80", "#1C2E4A"] as const,
  },
  {
    id: "pizza",
    title: "Pizza places",
    subtitle: "A slice away",
    query: "pizza",
    icon: "pizza-outline",
    colors: ["#E63946", "#A31930"] as const,
  },
  {
    id: "galleries",
    title: "Art galleries",
    subtitle: "Fresh perspective",
    query: "art gallery",
    icon: "easel-outline",
    colors: ["#6C5B7B", "#355C7D"] as const,
  },
];

const EXPLORE_VIBE_COUNT = 5;
/** Fixed row height so the horizontal ScrollView cannot expand and steal flex space. */
const EXPLORE_ROW_HEIGHT = 118;

const openInMaps = (lat: number, lng: number, name: string) => {
  const encoded = encodeURIComponent(name);
  const url =
    Platform.OS === "ios"
      ? `maps://app?daddr=${lat},${lng}&q=${encoded}`
      : `geo:${lat},${lng}?q=${lat},${lng}(${encoded})`;
  Linking.openURL(url).catch(() =>
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    )
  );
};

function createNearbyStyles(c: AppColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.backgroundSecondary,
    },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingLeft: TITLE_LEFT_INSET,
      paddingRight: GUTTER,
      paddingVertical: 10,
      minHeight: 44,
    },
    title: {
      flex: 1,
      fontSize: 20,
      fontWeight: "800",
      color: c.text,
      lineHeight: 26,
      paddingTop: 2,
    },
    permissionCard: {
      marginHorizontal: 20,
      marginTop: 24,
      padding: 24,
      borderRadius: 20,
      backgroundColor: c.surface,
      alignItems: "center",
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: c.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    permissionTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: c.text,
      marginTop: 12,
      textAlign: "center",
    },
    permissionBody: {
      fontSize: 14,
      fontWeight: "500",
      color: c.textSecondary,
      textAlign: "center",
      marginTop: 10,
      lineHeight: 20,
    },
    primaryBtn: {
      marginTop: 20,
      backgroundColor: c.primary,
      paddingVertical: 14,
      paddingHorizontal: 28,
      borderRadius: 14,
    },
    primaryBtnText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "800",
    },
    permissionError: {
      marginTop: 14,
      fontSize: 13,
      color: "#dc2626",
      fontWeight: "600",
      textAlign: "center",
    },
    centerMessage: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
    },
    centerMessageText: {
      marginTop: 12,
      fontSize: 15,
      fontWeight: "600",
      color: c.textSecondary,
    },
    mainColumn: {
      flex: 1,
    },
    headerBlock: {
      paddingHorizontal: GUTTER,
      paddingBottom: 4,
    },
    exploreHeadingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: GUTTER,
      marginTop: 0,
      marginBottom: 4,
    },
    exploreHeading: {
      fontSize: 12,
      fontWeight: "800",
      color: c.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    exploreHeadingHint: {
      fontSize: 11,
      fontWeight: "700",
      color: c.textMuted,
      letterSpacing: 0.3,
    },
    exploreScroll: {
      paddingHorizontal: GUTTER,
      gap: 10,
      paddingVertical: 0,
      alignItems: "center",
      flexGrow: 0,
    },
    exploreRowWrap: {
      height: EXPLORE_ROW_HEIGHT,
      flexGrow: 0,
      flexShrink: 0,
    },
    exploreCard: {
      width: 148,
      height: 108,
      borderRadius: 16,
      padding: 12,
      justifyContent: "space-between",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.14,
      shadowRadius: 10,
      elevation: 4,
      overflow: "hidden",
    },
    exploreIconBubble: {
      width: 36,
      height: 36,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.22)",
    },
    exploreTitle: {
      fontSize: 13.5,
      fontWeight: "800",
      color: "#FFFFFF",
      letterSpacing: -0.1,
    },
    exploreSubtitle: {
      fontSize: 10.5,
      fontWeight: "700",
      color: "rgba(255,255,255,0.82)",
      marginTop: 2,
      letterSpacing: 0.2,
    },
    listSection: {
      flex: 1,
      minHeight: 200,
    },
    resultsHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingLeft: GUTTER,
      paddingRight: GUTTER,
      marginTop: 10,
      marginBottom: 8,
      gap: 10,
    },
    resultsHeadingInline: {
      marginBottom: 0,
      marginTop: 0,
    },
    sortChip: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    sortChipActive: {
      backgroundColor: c.primarySoftBg,
      borderColor: c.primary,
    },
    sortChipLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: c.textSecondary,
    },
    sortChipLabelActive: {
      color: c.primary,
    },
    listPager: {
      flex: 1,
      position: "relative",
    },
    cardNavBtn: {
      position: "absolute",
      top: "50%",
      marginTop: -22,
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.overlay,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.22)",
      zIndex: 8,
      elevation: 8,
    },
    cardNavBtnLeft: {
      left: 8,
    },
    cardNavBtnRight: {
      right: 8,
    },
    cardNavBtnDisabled: {
      opacity: 0.32,
    },
    pageSlotH: {
      justifyContent: "flex-start",
      paddingTop: 4,
      alignItems: "center",
    },
    counterBadge: {
      position: "absolute",
      bottom: 16,
      right: 20,
      backgroundColor: c.overlay,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 14,
    },
    counterText: {
      fontSize: 12,
      fontWeight: "800",
      color: "#ffffff",
    },
    emptyPage: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: c.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 2,
    },
    chip: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 999,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    chipActive: {
      backgroundColor: c.primarySoftBg,
      borderColor: c.primary,
    },
    chipLabel: {
      fontSize: 14,
      fontWeight: "700",
      color: c.textSecondary,
    },
    chipLabelActive: {
      color: c.primary,
    },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 6,
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 12,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      fontWeight: "600",
      color: c.text,
      paddingVertical: 12,
    },
    searchBtn: {
      backgroundColor: c.primary,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10,
    },
    searchBtnText: {
      color: "#fff",
      fontWeight: "800",
      fontSize: 14,
    },
    hint: {
      fontSize: 12,
      color: c.textMuted,
      fontWeight: "600",
      marginTop: 8,
    },
    loadingBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: GUTTER,
      paddingVertical: 8,
    },
    loadingText: {
      fontSize: 14,
      fontWeight: "600",
      color: c.textSecondary,
    },
    errorBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginHorizontal: GUTTER,
      padding: 12,
      backgroundColor: c.dangerSoftBg,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.dangerSoftBorder,
    },
    errorText: {
      flex: 1,
      fontSize: 13,
      fontWeight: "600",
      color: c.danger,
    },
    emptyText: {
      fontSize: 15,
      color: c.textSecondary,
      fontWeight: "700",
      textAlign: "center",
      lineHeight: 22,
    },
  });
}

/* ════════════════════ NearbyLoader ═══════════════════════════
 * Full-screen soft-gradient loader with a Lottie animation, a
 * breathing title, and three pulsing dots. Used while we ask for
 * location permission, grab coordinates, or wait on the first fetch.
 * ═════════════════════════════════════════════════════════════ */
interface NearbyLoaderProps {
  title: string;
  subtitle: string;
  colors: AppColors;
  isDark: boolean;
}

const NearbyLoader: React.FC<NearbyLoaderProps> = React.memo(
  ({ title, subtitle, colors: c, isDark }) => {
    const insets = useSafeAreaInsets();
    const lottieSource = getSplashLoaderAnimation();
    const float = useSharedValue(0);
    const pulse = useSharedValue(1);
    const dot1 = useSharedValue(0.35);
    const dot2 = useSharedValue(0.35);
    const dot3 = useSharedValue(0.35);

    useEffect(() => {
      float.value = withRepeat(
        withSequence(
          withTiming(-6, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
          withTiming(6, { duration: 2400, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      );
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.03, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      );
      dot1.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 420 }),
          withTiming(0.35, { duration: 420 })
        ),
        -1,
        true
      );
      dot2.value = withRepeat(
        withSequence(
          withTiming(0.35, { duration: 180 }),
          withTiming(1, { duration: 420 }),
          withTiming(0.35, { duration: 420 })
        ),
        -1,
        true
      );
      dot3.value = withRepeat(
        withSequence(
          withTiming(0.35, { duration: 360 }),
          withTiming(1, { duration: 420 }),
          withTiming(0.35, { duration: 420 })
        ),
        -1,
        true
      );
    }, [float, pulse, dot1, dot2, dot3]);

    const floatStyle = useAnimatedStyle(() => ({
      transform: [{ translateY: float.value }],
    }));
    const pulseStyle = useAnimatedStyle(() => ({
      transform: [{ scale: pulse.value }],
    }));
    const d1Style = useAnimatedStyle(() => ({ opacity: dot1.value }));
    const d2Style = useAnimatedStyle(() => ({ opacity: dot2.value }));
    const d3Style = useAnimatedStyle(() => ({ opacity: dot3.value }));

    const bg: readonly [string, string, string] = isDark
      ? ["#0F1A14", "#111F18", "#0C1711"]
      : ["#F4F9F4", "#E8F1EA", "#F0F5F0"];
    const dotTint = isDark ? "rgba(255,255,255,0.85)" : "rgba(44,44,40,0.55)";

    return (
      <LinearGradient
        colors={[...bg]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={[nearbyLoaderStyles.container, { paddingTop: insets.top }]}
      >
        <View style={nearbyLoaderStyles.inner}>
          <Animated.View style={[nearbyLoaderStyles.lottieWrap, floatStyle]}>
            <LottieView
              source={
                lottieSource as unknown as React.ComponentProps<
                  typeof LottieView
                >["source"]
              }
              autoPlay
              loop
              style={nearbyLoaderStyles.lottie}
            />
          </Animated.View>
          <Animated.Text
            style={[
              nearbyLoaderStyles.title,
              { color: c.text },
              pulseStyle,
            ]}
          >
            {title}
          </Animated.Text>
          <Text style={[nearbyLoaderStyles.subtitle, { color: c.textSecondary }]}>
            {subtitle}
          </Text>
          <View style={nearbyLoaderStyles.dotsRow}>
            <Animated.View
              style={[nearbyLoaderStyles.dot, { backgroundColor: dotTint }, d1Style]}
            />
            <Animated.View
              style={[nearbyLoaderStyles.dot, { backgroundColor: dotTint }, d2Style]}
            />
            <Animated.View
              style={[nearbyLoaderStyles.dot, { backgroundColor: dotTint }, d3Style]}
            />
          </View>
        </View>
      </LinearGradient>
    );
  }
);

const nearbyLoaderStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  inner: {
    alignItems: "center",
    paddingHorizontal: 32,
  },
  lottieWrap: {
    width: 220,
    height: 220,
    alignItems: "center",
    justifyContent: "center",
  },
  lottie: {
    width: 220,
    height: 220,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.3,
    marginTop: 6,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
    textAlign: "center",
    letterSpacing: 0.1,
    maxWidth: 280,
    lineHeight: 18,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});

const NearbyPlacesScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useAppTheme();
  const styles = useMemo(() => createNearbyStyles(c), [c]);

  // Hydrate from the dashboard's background prefetch if available so the
  // screen appears instantly on first swipe-in.
  const initialSnapshot = useMemo(() => getNearbyPrefetch(), []);

  const [permission, setPermission] = useState<Location.PermissionStatus | null>(
    initialSnapshot ? initialSnapshot.permission : null
  );
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initialSnapshot ? initialSnapshot.coords : null
  );
  const [searchText, setSearchText] = useState(
    initialSnapshot?.query ?? "parks"
  );
  const [fetchedPlaces, setFetchedPlaces] = useState<NearbyPlace[]>(
    initialSnapshot?.places ?? []
  );
  const [sortMode, setSortMode] = useState<NearbyPlaceSortMode>("rating");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [listViewportH, setListViewportH] = useState(0);
  const [cardIndex, setCardIndex] = useState(0);

  const onViewableRef = useRef((info: { viewableItems: ViewToken[] }) => {
    if (info.viewableItems.length > 0 && info.viewableItems[0].index != null) {
      setCardIndex(info.viewableItems[0].index);
    }
  });
  const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 55 });
  const placesListRef = useRef<FlatList<NearbyPlace>>(null);
  const cardIndexRef = useRef(0);
  const searchGenerationRef = useRef(0);

  cardIndexRef.current = cardIndex;

  const displayedPlaces = useMemo(
    () => sortNearbyPlaces(fetchedPlaces, sortMode),
    [fetchedPlaces, sortMode]
  );

  const vibePicks = useMemo<ExploreVibe[]>(
    () =>
      seededShuffle(EXPLORE_VIBES, APP_SESSION_SEED ^ 0x4e3b).slice(
        0,
        EXPLORE_VIBE_COUNT
      ),
    []
  );

  useEffect(() => {
    setCardIndex(0);
    if (displayedPlaces.length === 0) return;
    requestAnimationFrame(() => {
      placesListRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
  }, [displayedPlaces]);

  const refreshPermission = useCallback(async () => {
    setGeoError(null);
    const { status } = await Location.getForegroundPermissionsAsync();
    setPermission(status);
    if (status === Location.PermissionStatus.GRANTED) {
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setCoords({
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
        });
      } catch {
        setCoords(null);
        setGeoError("Could not read your location. Try again.");
      }
    } else {
      setCoords(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshPermission();
    }, [refreshPermission])
  );

  const runSearch = useCallback(
    async (query: string) => {
      if (!coords) return;
      const q = query.trim();
      if (!q) {
        setError("Type something to search (e.g. cafes).");
        return;
      }
      const gen = ++searchGenerationRef.current;
      Keyboard.dismiss();
      setLoading(true);
      setError(null);
      try {
        const { places: next, error: err } = await searchPlacesNearLocation(
          coords.lat,
          coords.lng,
          q,
          { maxResults: 10, radiusM: 10_000 }
        );
        if (gen !== searchGenerationRef.current) return;
        setLoading(false);
        if (err) {
          setFetchedPlaces([]);
          setError(err);
          return;
        }
        setFetchedPlaces(next);
        if (next.length === 0) {
          setError("No places found — try another search.");
        } else {
          setError(null);
        }
      } catch {
        if (gen !== searchGenerationRef.current) return;
        setLoading(false);
        setFetchedPlaces([]);
        setError("Network error loading places.");
      }
    },
    [coords]
  );

  const initialFetchDone = useRef(initialSnapshot !== null);
  useEffect(() => {
    if (permission !== Location.PermissionStatus.GRANTED) {
      initialFetchDone.current = false;
    }
  }, [permission]);

  useEffect(() => {
    if (
      !coords ||
      permission !== Location.PermissionStatus.GRANTED ||
      initialFetchDone.current
    ) {
      return;
    }
    initialFetchDone.current = true;
    void runSearch("parks");
  }, [coords, permission, runSearch]);

  /* Drawer can deep-link into Nearby with a category preselected. */
  const route = useRoute();
  const routeParams = route.params as
    | { initialQuery?: string; _nearbyNavTs?: number }
    | undefined;
  const lastHandledNavTs = useRef<number | undefined>(undefined);
  useEffect(() => {
    const q = routeParams?.initialQuery?.trim();
    const ts = routeParams?._nearbyNavTs;
    if (!q || !coords) return;
    if (ts != null && ts === lastHandledNavTs.current) return;
    lastHandledNavTs.current = ts;
    setSearchText(q);
    void runSearch(q);
  }, [routeParams?.initialQuery, routeParams?._nearbyNavTs, coords, runSearch]);

  const onGrantLocation = useCallback(async () => {
    setError(null);
    const { status } = await Location.requestForegroundPermissionsAsync();
    setPermission(status);
    if (status !== Location.PermissionStatus.GRANTED) {
      setError("Location is off. Enable it in Settings to see places near you.");
      return;
    }
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setGeoError(null);
      setCoords({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      });
    } catch {
      setGeoError("Could not read your location. Try again.");
    }
  }, []);

  const onSubmitSearch = useCallback(() => {
    void runSearch(searchText);
  }, [runSearch, searchText]);

  const openPlace = useCallback((p: NearbyPlace) => {
    openInMaps(p.lat, p.lng, p.name);
  }, []);

  const pageHeight =
    listViewportH > 0 ? listViewportH : Math.max(320, SCREEN_H * 0.52);
  const cardHeight = Math.max(280, pageHeight - LIST_BOTTOM_PAD - 8);

  const renderPlaceItem = useCallback(
    ({ item }: { item: NearbyPlace }) => (
      <View
        style={[styles.pageSlotH, { width: SCREEN_W, height: pageHeight }]}
      >
        <PlaceCard
          place={item}
          cardHeight={cardHeight}
          onOpenMaps={() => openPlace(item)}
        />
      </View>
    ),
    [cardHeight, openPlace, pageHeight, styles]
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: SCREEN_W,
      offset: SCREEN_W * index,
      index,
    }),
    []
  );

  const goPrevPlaceCard = useCallback(() => {
    const i = cardIndexRef.current;
    if (i <= 0) return;
    const next = i - 1;
    placesListRef.current?.scrollToOffset({
      offset: next * SCREEN_W,
      animated: true,
    });
  }, []);

  const goNextPlaceCard = useCallback(() => {
    const i = cardIndexRef.current;
    const n = displayedPlaces.length;
    if (i >= n - 1) return;
    const next = i + 1;
    placesListRef.current?.scrollToOffset({
      offset: next * SCREEN_W,
      animated: true,
    });
  }, [displayedPlaces.length]);

  const checkingPermission = permission === null;
  const needPermission =
    permission !== null &&
    permission !== Location.PermissionStatus.GRANTED;
  const locating =
    permission === Location.PermissionStatus.GRANTED &&
    coords === null &&
    !geoError;
  const ready =
    permission === Location.PermissionStatus.GRANTED && coords !== null;
  const geoFailed =
    permission === Location.PermissionStatus.GRANTED &&
    coords === null &&
    geoError;

  const bgGrad = isDark
    ? ([c.surface, c.background] as const)
    : ([c.primarySoftBg, c.backgroundSecondary] as const);

  return (
    <SwipeToScreens leftScreen="dashboard">
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top, backgroundColor: c.backgroundSecondary },
      ]}
    >
      <LinearGradient colors={[...bgGrad]} style={StyleSheet.absoluteFill} />

      <View style={styles.topBar}>
        <Text style={styles.title}>Nearby places</Text>
        <View style={{ width: 44 }} />
      </View>

      {checkingPermission && (
        <NearbyLoader
          title="Checking location…"
          subtitle="A moment while we confirm your location access."
          colors={c}
          isDark={isDark}
        />
      )}

      {needPermission && (
        <View style={styles.permissionCard}>
          <Ionicons name="location" size={40} color={c.primary} />
          <Text style={styles.permissionTitle}>Give location access</Text>
          <Text style={styles.permissionBody}>
            We use your location only to find parks, cafés, restaurants, and
            gardens near you. Nothing is stored on our servers.
          </Text>
          <Pressable
            onPress={onGrantLocation}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={styles.primaryBtnText}>Allow location</Text>
          </Pressable>
          {error ? <Text style={styles.permissionError}>{error}</Text> : null}
        </View>
      )}

      {locating && (
        <NearbyLoader
          title="Finding your spot on the map…"
          subtitle="Just a second — we’re pinning your position so we can fetch the best places nearby."
          colors={c}
          isDark={isDark}
        />
      )}

      {geoFailed && (
        <View style={styles.permissionCard}>
          <Ionicons name="location-outline" size={40} color={c.primary} />
          <Text style={styles.permissionTitle}>Location needed</Text>
          <Text style={styles.permissionBody}>{geoError}</Text>
          <Pressable
            onPress={() => void refreshPermission()}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={styles.primaryBtnText}>Try again</Text>
          </Pressable>
        </View>
      )}

      {ready && (
        <View style={styles.mainColumn}>
          <View style={styles.exploreHeadingRow}>
            <Text style={styles.exploreHeading}>Explore near you</Text>
            <Text style={styles.exploreHeadingHint}>Swipe →</Text>
          </View>
          <View style={styles.exploreRowWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0 }}
              contentContainerStyle={styles.exploreScroll}
              bounces={false}
            >
              {vibePicks.map((vibe) => (
                <Pressable
                  key={vibe.id}
                  onPress={() => {
                    setSearchText(vibe.query);
                    void runSearch(vibe.query);
                  }}
                  style={({ pressed }) => [
                    { transform: [{ scale: pressed ? 0.97 : 1 }] },
                  ]}
                >
                  <LinearGradient
                    colors={[...vibe.colors]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.exploreCard}
                  >
                    <View style={styles.exploreIconBubble}>
                      <Ionicons name={vibe.icon} size={20} color="#FFFFFF" />
                    </View>
                    <View>
                      <Text style={styles.exploreTitle} numberOfLines={1}>
                        {vibe.title}
                      </Text>
                      <Text style={styles.exploreSubtitle} numberOfLines={1}>
                        {vibe.subtitle}
                      </Text>
                    </View>
                  </LinearGradient>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <View style={styles.headerBlock}>
            <View style={styles.searchRow}>
              <Ionicons name="search" size={20} color={c.textMuted} />
              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                placeholder="e.g. cafes, sushi, gardens"
                placeholderTextColor={c.textMuted}
                style={styles.searchInput}
                returnKeyType="search"
                onSubmitEditing={onSubmitSearch}
              />
              <Pressable
                onPress={onSubmitSearch}
                style={({ pressed }) => [
                  styles.searchBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.searchBtnText}>Go</Text>
              </Pressable>
            </View>
          </View>

          {loading && fetchedPlaces.length === 0 ? (
            <View style={styles.loadingBanner}>
              <ActivityIndicator color={c.primary} />
              <Text style={styles.loadingText}>Finding places…</Text>
            </View>
          ) : null}

          {error && fetchedPlaces.length === 0 && !loading ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={20} color={c.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View
            style={[styles.listSection, { paddingBottom: insets.bottom + 6 }]}
          >
            <View style={styles.resultsHeaderRow}>
              <Text style={[styles.sectionLabel, styles.resultsHeadingInline]}>
                Near you
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {SORT_OPTIONS.map((opt) => {
                  const active = sortMode === opt.mode;
                  return (
                    <Pressable
                      key={opt.id}
                      onPress={() => setSortMode(opt.mode)}
                      style={({ pressed }) => [
                        styles.sortChip,
                        active && styles.sortChipActive,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.sortChipLabel,
                          active && styles.sortChipLabelActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
            <View
              style={styles.listPager}
              onLayout={(e) =>
                setListViewportH(e.nativeEvent.layout.height)
              }
            >
              {listViewportH > 0 && displayedPlaces.length > 0 ? (
                <>
                  <FlatList
                    ref={placesListRef}
                    data={displayedPlaces}
                    keyExtractor={(item) => item.id}
                    renderItem={renderPlaceItem}
                    horizontal
                    pagingEnabled
                    snapToInterval={SCREEN_W}
                    snapToAlignment="start"
                    decelerationRate="fast"
                    showsHorizontalScrollIndicator={false}
                    getItemLayout={getItemLayout}
                    onViewableItemsChanged={onViewableRef.current}
                    viewabilityConfig={viewConfigRef.current}
                    removeClippedSubviews
                    maxToRenderPerBatch={3}
                    windowSize={5}
                    initialNumToRender={2}
                    keyboardShouldPersistTaps="handled"
                  />
                  <Pressable
                    onPress={goPrevPlaceCard}
                    disabled={cardIndex <= 0}
                    accessibilityRole="button"
                    accessibilityLabel="Previous place"
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.cardNavBtn,
                      styles.cardNavBtnLeft,
                      cardIndex <= 0 && styles.cardNavBtnDisabled,
                      pressed && cardIndex > 0 && { opacity: 0.88 },
                    ]}
                  >
                    <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
                  </Pressable>
                  <Pressable
                    onPress={goNextPlaceCard}
                    disabled={cardIndex >= displayedPlaces.length - 1}
                    accessibilityRole="button"
                    accessibilityLabel="Next place"
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.cardNavBtn,
                      styles.cardNavBtnRight,
                      cardIndex >= displayedPlaces.length - 1 &&
                        styles.cardNavBtnDisabled,
                      pressed &&
                        cardIndex < displayedPlaces.length - 1 && {
                          opacity: 0.88,
                        },
                    ]}
                  >
                    <Ionicons
                      name="chevron-forward"
                      size={24}
                      color="#FFFFFF"
                    />
                  </Pressable>
                  <View
                    style={[
                      styles.counterBadge,
                      { bottom: 12 + insets.bottom },
                    ]}
                  >
                    <Text style={styles.counterText}>
                      {cardIndex + 1}/{displayedPlaces.length}
                    </Text>
                  </View>
                </>
              ) : listViewportH > 0 && !loading && !error ? (
                <View style={styles.emptyPage}>
                  <Text style={styles.emptyText}>
                    No results yet. Pick a category or search above.
                  </Text>
                </View>
              ) : listViewportH > 0 && loading && fetchedPlaces.length === 0 ? (
                <View style={styles.emptyPage}>
                  <NearbyLoader
                    title="Scanning the neighbourhood…"
                    subtitle="Pulling restaurants, cafés, parks & more around you."
                    colors={c}
                    isDark={isDark}
                  />
                </View>
              ) : null}
            </View>
          </View>
        </View>
      )}

      <MenuButton />
    </View>
    </SwipeToScreens>
  );
};

export default NearbyPlacesScreen;
