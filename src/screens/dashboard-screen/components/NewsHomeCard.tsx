import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useAppTheme } from "../../../contexts/ThemeContext";
import HomeDashboardGradientCard from "../../../components/HomeDashboardGradientCard";
import {
  getHomeDashboardCardAccent,
  getHomeDashboardCardText,
  homeCardIconBubbleBg,
} from "../../../theme/homeDashboardCardTheme";
import {
  APP_SESSION_SEED,
  displayCategoryLabel,
  fetchBreakingArticles,
  isBreakingArticle,
  rotatePicks,
  timeAgo,
  fetchMixedDigestArticles,
  type NewsArticle,
} from "../../../services/newsService";

const PLACEHOLDER_GRADIENT_BG = "#1e293b";

const NewsHomeCard: React.FC = () => {
  const navigation = useNavigation<any>();
  const { isDark } = useAppTheme();
  const accent = useMemo(
    () => getHomeDashboardCardAccent("news", isDark),
    [isDark]
  );
  const txt = useMemo(() => getHomeDashboardCardText(isDark), [isDark]);

  const [hero, setHero] = useState<NewsArticle | null>(null);
  const [extras, setExtras] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [items, breaking] = await Promise.all([
        fetchMixedDigestArticles(3),
        fetchBreakingArticles(6).catch(() => [] as NewsArticle[]),
      ]);

      const topBreaking = breaking[0];

      if (items.length === 0 && !topBreaking) {
        setHero(null);
        setExtras([]);
        return;
      }

      const rotated = rotatePicks(items, 3, APP_SESSION_SEED, 8);
      let heroPick: NewsArticle | null = rotated[0] ?? items[0] ?? null;
      let rest = rotated.slice(1, 3);

      if (topBreaking && (!heroPick || !isBreakingArticle(heroPick))) {
        heroPick = topBreaking;
        rest = rotated.filter((a) => a.id !== topBreaking.id).slice(0, 2);
      }

      setHero(heroPick);
      setExtras(rest);
    } catch {
      setHero(null);
      setExtras([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!alive) return;
      await load();
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const openArticle = useCallback(
    (article: NewsArticle | null) => {
      navigation.navigate("news", {
        initialCategoryIndex: 0,
        initialArticleLink: article?.link ?? null,
        initialArticleId: article?.id ?? null,
        _newsNavTs: Date.now(),
      });
    },
    [navigation]
  );

  const openNews = () => openArticle(hero);

  const metaLine = useMemo(() => {
    if (!hero) return null;
    const parts: string[] = [];
    if (hero.source) parts.push(hero.source);
    const rel = timeAgo(hero.publishedAt);
    if (rel) parts.push(rel);
    const label = displayCategoryLabel(hero.category);
    if (label) parts.push(label);
    return parts.join(" · ");
  }, [hero]);

  return (
    <View style={styles.section}>
      <Pressable
        onPress={openNews}
        style={({ pressed }) => [styles.press, pressed && styles.pressPressed]}
      >
        <HomeDashboardGradientCard variant="news">
          <View style={styles.cardOuter}>
            <View style={styles.headerRow}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: homeCardIconBubbleBg(accent, isDark) },
                ]}
              >
                <Ionicons name="sparkles" size={18} color={accent} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={[
                    styles.kicker,
                    { color: hero && isBreakingArticle(hero) ? "#DC2626" : accent },
                  ]}
                >
                  {hero
                    ? isBreakingArticle(hero)
                      ? "Breaking"
                      : "For you"
                    : "News"}
                </Text>
                <Text style={[styles.kickerSub, { color: txt.subtitle }]}>
                  {hero && isBreakingArticle(hero)
                    ? "Urgent headline · tap to read"
                    : "Fresh picks from topics you like"}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={txt.chevron}
              />
            </View>

            {loading && !hero ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={accent} />
                <Text style={[styles.loadingText, { color: txt.subtitle }]}>
                  Loading your picks…
                </Text>
              </View>
            ) : hero ? (
              <>
                <View style={styles.heroRow}>
                  {hero.imageUrl ? (
                    <Image
                      source={{ uri: hero.imageUrl }}
                      style={styles.heroThumb}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.heroThumb, styles.heroThumbPh]}>
                      <Ionicons
                        name="newspaper-outline"
                        size={22}
                        color="rgba(255,255,255,0.45)"
                      />
                    </View>
                  )}
                  <View style={styles.heroText}>
                    <Text
                      style={[styles.heroTitle, { color: txt.title }]}
                      numberOfLines={3}
                    >
                      {hero.title}
                    </Text>
                    {metaLine ? (
                      <Text
                        style={[styles.heroMeta, { color: txt.subtitle }]}
                        numberOfLines={1}
                      >
                        {metaLine}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {extras.length > 0 ? (
                  <View
                    style={[
                      styles.divider,
                      {
                        backgroundColor: isDark
                          ? "rgba(255,255,255,0.08)"
                          : "rgba(0,0,0,0.06)",
                      },
                    ]}
                  />
                ) : null}

                {extras.map((a) => (
                  <Pressable
                    key={a.id}
                    onPress={(e) => {
                      (e as any)?.stopPropagation?.();
                      openArticle(a);
                    }}
                    style={({ pressed }) => [
                      styles.extraRow,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Ionicons
                      name="ellipse"
                      size={6}
                      color={isBreakingArticle(a) ? "#DC2626" : accent}
                      style={{ marginTop: 7 }}
                    />
                    <Text
                      style={[styles.extraTitle, { color: txt.title }]}
                      numberOfLines={2}
                    >
                      {a.title}
                    </Text>
                  </Pressable>
                ))}

                <View style={styles.ctaRow}>
                  <Text style={[styles.ctaText, { color: accent }]}>
                    Open full story
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={14}
                    color={accent}
                    style={{ marginLeft: 4 }}
                  />
                </View>
              </>
            ) : (
              <Text style={[styles.emptyText, { color: txt.subtitle }]}>
                Like a few articles and we’ll personalize stories for you.
              </Text>
            )}
          </View>
        </HomeDashboardGradientCard>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginTop: 12,
    marginBottom: 16,
  },
  press: {
    borderRadius: 22,
  },
  pressPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.995 }],
  },
  cardOuter: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  kickerSub: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: "500",
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  heroThumb: {
    width: 74,
    height: 74,
    borderRadius: 14,
    backgroundColor: PLACEHOLDER_GRADIENT_BG,
  },
  heroThumbPh: {
    alignItems: "center",
    justifyContent: "center",
  },
  heroText: {
    flex: 1,
    minWidth: 0,
  },
  heroTitle: {
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  heroMeta: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 6,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 2,
  },
  extraRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  extraTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  ctaText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
});

export default NewsHomeCard;
