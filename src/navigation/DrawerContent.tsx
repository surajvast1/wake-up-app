import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  DrawerContentComponentProps,
  useDrawerStatus,
} from "@react-navigation/drawer";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../contexts/AuthContext";
import { useAppTheme } from "../contexts/ThemeContext";
import type { AppColors } from "../theme/colors";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { loadMyFeedArticles } from "../services/myFeedService";
import {
  APP_SESSION_SEED,
  fetchBreakingArticles,
  isBreakingArticle,
  rotatePicks,
  seededShuffle,
} from "../services/newsService";
import type { NewsArticle } from "../services/newsService";

interface NavItem {
  route: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

/** All primary app destinations. */
const MAIN_ITEMS: NavItem[] = [
  { route: "dashboard", label: "Home", icon: "home-outline" },
  { route: "news", label: "News", icon: "newspaper-outline" },
  { route: "tasks", label: "Tasks", icon: "checkbox-outline" },
  { route: "habits", label: "Habits", icon: "bar-chart-outline" },
  { route: "routines", label: "Routines", icon: "sunny-outline" },
  { route: "calendar", label: "Calendar", icon: "calendar-outline" },
  { route: "meditation", label: "Meditate", icon: "leaf-outline" },
  { route: "nearby", label: "Nearby", icon: "location-outline" },
];

const DRAWER_TEASER_COUNT = 3;
const DRAWER_NEARBY_COUNT = 3;

/** Rotating "check out nearby…" vibe cards for the drawer. */
interface DrawerNearbyVibe {
  id: string;
  title: string;
  subtitle: string;
  query: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Single saturated accent used for icon, arrow & border tint. */
  accent: string;
}

const DRAWER_NEARBY_VIBES: DrawerNearbyVibe[] = [
  {
    id: "restaurants",
    title: "Nearby restaurants",
    subtitle: "Book tonight's dinner",
    query: "restaurants",
    icon: "restaurant-outline",
    accent: "#EF4444",
  },
  {
    id: "cafes",
    title: "Cozy cafés",
    subtitle: "Slow mornings, good coffee",
    query: "cafes",
    icon: "cafe-outline",
    accent: "#B45309",
  },
  {
    id: "bookshops",
    title: "Bookshops",
    subtitle: "A quiet afternoon read",
    query: "bookshop",
    icon: "book-outline",
    accent: "#9333EA",
  },
  {
    id: "bars",
    title: "Bars & lounges",
    subtitle: "Unwind with friends",
    query: "bars",
    icon: "wine-outline",
    accent: "#7C3AED",
  },
  {
    id: "museums",
    title: "Museums",
    subtitle: "Step into a story",
    query: "museum",
    icon: "color-palette-outline",
    accent: "#0EA5E9",
  },
  {
    id: "icecream",
    title: "Ice cream spots",
    subtitle: "Sweet & chilled",
    query: "ice cream",
    icon: "ice-cream-outline",
    accent: "#EC4899",
  },
  {
    id: "bakeries",
    title: "Bakeries",
    subtitle: "Fresh bread & pastries",
    query: "bakery",
    icon: "pizza-outline",
    accent: "#D97706",
  },
  {
    id: "gyms",
    title: "Gyms nearby",
    subtitle: "Get that workout in",
    query: "gym",
    icon: "barbell-outline",
    accent: "#0891B2",
  },
  {
    id: "parks",
    title: "Parks",
    subtitle: "Green, open, breathing",
    query: "parks",
    icon: "leaf-outline",
    accent: "#16A34A",
  },
  {
    id: "markets",
    title: "Markets",
    subtitle: "Local finds & groceries",
    query: "supermarket",
    icon: "basket-outline",
    accent: "#F59E0B",
  },
  {
    id: "cinemas",
    title: "Cinemas",
    subtitle: "Catch a late show",
    query: "cinema",
    icon: "film-outline",
    accent: "#6366F1",
  },
  {
    id: "spa",
    title: "Spas & salons",
    subtitle: "A little self‑care",
    query: "spa",
    icon: "flower-outline",
    accent: "#DB2777",
  },
];

/** Returns an rgba() with given alpha for a #RRGGBB color. */
function hexWithAlpha(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function createDrawerStyles(c: AppColors, isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.drawerBg,
      paddingHorizontal: 12,
    },
    profileSection: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 4,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 16,
    },
    avatarPlaceholder: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    profileText: {
      flex: 1,
      marginLeft: 12,
    },
    name: {
      fontSize: 16,
      fontWeight: "800",
      color: c.drawerText,
    },
    sub: {
      fontSize: 12,
      fontWeight: "500",
      color: c.drawerMuted,
      marginTop: 1,
    },
    divider: {
      height: 1,
      backgroundColor: c.drawerDivider,
      marginVertical: 8,
    },
    navSection: {
      flex: 1,
    },
    navCard: {
      backgroundColor: c.cardBg,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.cardBorder,
      marginBottom: 10,
      shadowColor: c.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07,
      shadowRadius: 10,
      elevation: 3,
      overflow: "hidden",
    },
    navItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      paddingHorizontal: 14,
    },
    navIconBubble: {
      width: 46,
      height: 46,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.primarySoftBg,
    },
    navCardRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
      minWidth: 0,
    },
    navItemActive: {
      backgroundColor: c.primarySoftBg,
    },
    navLabel: {
      flex: 1,
      minWidth: 0,
      fontSize: 15,
      fontWeight: "600",
      color: c.drawerText,
    },
    navLabelActive: {
      color: c.primary,
      fontWeight: "700",
    },
    teaserSection: {
      marginTop: 4,
      marginBottom: 10,
    },
    teaserHeadingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
      paddingHorizontal: 4,
    },
    teaserHeading: {
      fontSize: 11,
      fontWeight: "800",
      color: c.drawerMuted,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    teaserHeadingCta: {
      fontSize: 11,
      fontWeight: "800",
      color: c.primary,
      letterSpacing: 0.4,
    },
    teaserCard: {
      backgroundColor: c.cardBg,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.cardBorder,
      overflow: "hidden",
    },
    teaserRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.drawerDivider,
    },
    teaserRowLast: {
      borderBottomWidth: 0,
    },
    teaserThumb: {
      width: 52,
      height: 52,
      borderRadius: 12,
      backgroundColor: c.primarySoftBg,
    },
    teaserThumbPh: {
      width: 52,
      height: 52,
      borderRadius: 12,
      backgroundColor: c.primarySoftBg,
      alignItems: "center",
      justifyContent: "center",
    },
    teaserBody: {
      flex: 1,
      minWidth: 0,
    },
    teaserTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: c.drawerText,
      lineHeight: 17,
    },
    teaserMeta: {
      fontSize: 10,
      fontWeight: "700",
      color: c.drawerMuted,
      marginTop: 4,
      letterSpacing: 0.3,
    },
    teaserBreakingBadge: {
      fontSize: 9,
      fontWeight: "900",
      color: "#DC2626",
      letterSpacing: 1.1,
      marginBottom: 3,
    },
    nearbyStack: {
      gap: 10,
    },
    nearbyCard: {
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderWidth: 1,
    },
    nearbyIconBubble: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    nearbyTextCol: {
      flex: 1,
      minWidth: 0,
    },
    nearbyTitle: {
      fontSize: 14,
      fontWeight: "800",
      color: c.text,
      letterSpacing: -0.1,
    },
    nearbySubtitle: {
      fontSize: 11,
      fontWeight: "700",
      color: c.textSecondary,
      marginTop: 2,
      letterSpacing: 0.2,
    },
  });
}

const DrawerContent: React.FC<DrawerContentComponentProps> = (props) => {
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useAppTheme();
  const styles = useMemo(() => createDrawerStyles(c, isDark), [c, isDark]);
  const { user, signOut, configured, isGuest, guestSession, storageScope } =
    useAuth();
  const supabaseUserId = isGuest ? null : user?.id ?? null;
  const [localName, setLocalName] = useState("");
  const [localPhoto, setLocalPhoto] = useState<string | null>(null);
  const [drawerTeasers, setDrawerTeasers] = useState<NewsArticle[]>([]);
  const drawerStatus = useDrawerStatus();

  const loadDrawerProfile = useCallback(async () => {
    try {
      if (isGuest && guestSession) {
        setLocalName(guestSession.name);
        setLocalPhoto(guestSession.photoUri);
        return;
      }
      let name = "";
      let photo: string | null = null;
      const raw = await AsyncStorage.getItem("LOCAL_PROFILE");
      if (raw) {
        const p = JSON.parse(raw) as {
          name?: string;
          photo_url?: string;
        };
        if (p.name) name = p.name;
        if (p.photo_url) photo = p.photo_url;
      }
      if (supabaseConfigured && configured && user) {
        const { data } = await supabase
          .from("profiles")
          .select("name, photo_url")
          .eq("id", user.id)
          .maybeSingle();
        if (data?.name) name = data.name;
        if (data?.photo_url) {
          const u = data.photo_url.trim();
          if (u.startsWith("http://") || u.startsWith("https://")) {
            photo = u;
          } else if (!photo) {
            photo = u;
          }
        }
      }
      setLocalName(name);
      setLocalPhoto(photo);
    } catch {}
  }, [configured, user, isGuest, guestSession]);

  useEffect(() => {
    void loadDrawerProfile();
  }, [loadDrawerProfile, user?.id, isGuest, guestSession?.name, guestSession?.photoUri]);

  useEffect(() => {
    if (drawerStatus === "open") {
      void loadDrawerProfile();
    }
  }, [drawerStatus, loadDrawerProfile]);

  useEffect(() => {
    if (drawerStatus !== "open") return;
    let alive = true;
    void (async () => {
      try {
        const [rows, breaking] = await Promise.all([
          loadMyFeedArticles(storageScope, supabaseUserId, {
            limit: 10,
            digestPerCategory: 2,
            skipSeenFilter: true,
            includeBreaking: true,
          }),
          fetchBreakingArticles(4).catch(() => [] as NewsArticle[]),
        ]);
        const rotated = rotatePicks(
          rows,
          DRAWER_TEASER_COUNT,
          APP_SESSION_SEED ^ 0x9e37,
          8
        );
        const picks: NewsArticle[] = [];
        const seen = new Set<string>();
        const add = (a: NewsArticle | undefined) => {
          if (!a || seen.has(a.id) || picks.length >= DRAWER_TEASER_COUNT)
            return;
          seen.add(a.id);
          picks.push(a);
        };
        if (breaking[0]) add(breaking[0]);
        for (const a of rotated) add(a);
        if (alive) setDrawerTeasers(picks);
      } catch {
        if (alive) setDrawerTeasers([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [drawerStatus, storageScope, supabaseUserId]);

  const activeRoute = props.state.routes[props.state.index]?.name;

  const nearbyVibePicks = useMemo<DrawerNearbyVibe[]>(
    () =>
      seededShuffle(
        DRAWER_NEARBY_VIBES,
        APP_SESSION_SEED ^ 0x4e3b
      ).slice(0, DRAWER_NEARBY_COUNT),
    []
  );

  const avatarUrl = localPhoto || user?.user_metadata?.avatar_url;
  const displayName =
    localName ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    "Guest";
  const displaySub = isGuest
    ? "On this device only"
    : user?.email || user?.phone || "";

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <Pressable
        onPress={() => props.navigation.navigate("profile")}
        style={styles.profileSection}
      >
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <LinearGradient
            colors={["#5B7553", "#7A9972"]}
            style={styles.avatarPlaceholder}
          >
            <Ionicons name="person" size={24} color="#fff" />
          </LinearGradient>
        )}
        <View style={styles.profileText}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          {displaySub !== "" && (
            <Text style={styles.sub} numberOfLines={1}>
              {displaySub}
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={18} color={c.drawerMuted} />
      </Pressable>

      <View style={styles.divider} />

      <ScrollView
        style={styles.navSection}
        showsVerticalScrollIndicator={false}
      >
        {MAIN_ITEMS.map((item) => {
          const active = activeRoute === item.route;
          return (
            <View key={item.route} style={styles.navCard}>
              <Pressable
                onPress={() => props.navigation.navigate(item.route)}
                style={({ pressed }) => [
                  styles.navItem,
                  active && styles.navItemActive,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <View style={styles.navCardRow}>
                  <View style={styles.navIconBubble}>
                    <Ionicons
                      name={item.icon}
                      size={24}
                      color={active ? c.primary : c.iconMuted}
                    />
                  </View>
                  <Text
                    style={[
                      styles.navLabel,
                      active && styles.navLabelActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={c.drawerMuted}
                />
              </Pressable>
            </View>
          );
        })}

        {drawerTeasers.length > 0 ? (
          <View style={styles.teaserSection}>
            <View style={styles.teaserHeadingRow}>
              <Text style={styles.teaserHeading}>News picks for you</Text>
              <Pressable
                onPress={() => {
                  props.navigation.closeDrawer();
                  props.navigation.navigate("news", {
                    initialCategoryIndex: 0,
                    _newsNavTs: Date.now(),
                  });
                }}
                hitSlop={6}
              >
                <Text style={styles.teaserHeadingCta}>See all →</Text>
              </Pressable>
            </View>
            <View style={styles.teaserCard}>
              {drawerTeasers.map((article, i) => {
                const source = article.source || "";
                const cat = article.category
                  ? article.category.charAt(0).toUpperCase() +
                    article.category.slice(1)
                  : "";
                const meta = [source, cat].filter(Boolean).join(" · ");
                return (
                  <Pressable
                    key={article.id}
                    onPress={() => {
                      props.navigation.closeDrawer();
                      props.navigation.navigate("news", {
                        initialCategoryIndex: 0,
                        initialArticleLink: article.link,
                        initialArticleId: article.id,
                        _newsNavTs: Date.now(),
                      });
                    }}
                    style={({ pressed }) => [
                      styles.teaserRow,
                      i === drawerTeasers.length - 1 && styles.teaserRowLast,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    {article.imageUrl ? (
                      <Image
                        source={{ uri: article.imageUrl }}
                        style={styles.teaserThumb}
                      />
                    ) : (
                      <View style={styles.teaserThumbPh}>
                        <Ionicons
                          name="newspaper-outline"
                          size={20}
                          color={c.primary}
                        />
                      </View>
                    )}
                    <View style={styles.teaserBody}>
                      {isBreakingArticle(article) ? (
                        <Text style={styles.teaserBreakingBadge}>
                          BREAKING
                        </Text>
                      ) : null}
                      <Text style={styles.teaserTitle} numberOfLines={2}>
                        {article.title}
                      </Text>
                      {meta ? (
                        <Text style={styles.teaserMeta} numberOfLines={1}>
                          {meta.toUpperCase()}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={styles.teaserSection}>
          <View style={styles.teaserHeadingRow}>
            <Text style={styles.teaserHeading}>Explore nearby</Text>
            <Pressable
              onPress={() => {
                props.navigation.closeDrawer();
                props.navigation.navigate("nearby");
              }}
              hitSlop={6}
            >
              <Text style={styles.teaserHeadingCta}>See all →</Text>
            </Pressable>
          </View>
          <View style={styles.nearbyStack}>
            {nearbyVibePicks.map((vibe) => {
              const tintBg = hexWithAlpha(vibe.accent, isDark ? 0.18 : 0.12);
              const tintBorder = hexWithAlpha(vibe.accent, isDark ? 0.38 : 0.25);
              const bubbleBg = hexWithAlpha(vibe.accent, isDark ? 0.32 : 0.2);
              return (
                <Pressable
                  key={vibe.id}
                  onPress={() => {
                    props.navigation.closeDrawer();
                    props.navigation.navigate("nearby", {
                      initialQuery: vibe.query,
                      _nearbyNavTs: Date.now(),
                    });
                  }}
                  style={({ pressed }) => [
                    styles.nearbyCard,
                    {
                      backgroundColor: tintBg,
                      borderColor: tintBorder,
                    },
                    pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                  ]}
                >
                  <View
                    style={[styles.nearbyIconBubble, { backgroundColor: bubbleBg }]}
                  >
                    <Ionicons name={vibe.icon} size={20} color={vibe.accent} />
                  </View>
                  <View style={styles.nearbyTextCol}>
                    <Text style={styles.nearbyTitle} numberOfLines={1}>
                      {vibe.title}
                    </Text>
                    <Text style={styles.nearbySubtitle} numberOfLines={1}>
                      {vibe.subtitle}
                    </Text>
                  </View>
                  <Ionicons name="arrow-forward" size={18} color={vibe.accent} />
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={styles.divider} />

      <Pressable
        onPress={signOut}
        style={({ pressed }) => [
          styles.navItem,
          pressed && { opacity: 0.8 },
          { marginTop: 4 },
        ]}
      >
        <Ionicons name="log-out-outline" size={20} color={c.danger} />
        <Text style={[styles.navLabel, { color: c.danger }]}>
          {isGuest ? "Leave guest mode" : "Sign Out"}
        </Text>
      </Pressable>

      <View style={{ height: insets.bottom + 16 }} />
    </View>
  );
};

export default DrawerContent;
