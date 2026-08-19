import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  Linking,
  Share,
  Dimensions,
  Animated,
  ScrollView,
} from "react-native";
import { TapGestureHandler } from "react-native-gesture-handler";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import {
  NewsArticle,
  timeAgo,
} from "../../../services/newsService";
import { useAuth } from "../../../contexts/AuthContext";
import {
  isNewsLiked,
  toggleLikeNews,
} from "../../../services/likedNewsService";

const { width: SCREEN_W } = Dimensions.get("window");

interface NewsCardProps {
  article: NewsArticle;
  cardHeight: number;
  isDark: boolean;
  /** Fires when the user likes (not unlikes) the article. Used upstream to
   *  splice in similar stories right after this card. */
  onLiked?: (article: NewsArticle) => void;
}

const PLACEHOLDER_COLORS: [string, string][] = [
  ["#1a1a2e", "#16213e"],
  ["#0f3460", "#1a1a2e"],
  ["#2d132c", "#1a1a2e"],
  ["#1b1b2f", "#162447"],
  ["#0a3d62", "#1e3c72"],
];

const NewsCard: React.FC<NewsCardProps> = ({ article, cardHeight, isDark, onLiked }) => {
  const { storageScope, user, isGuest } = useAuth();
  const supabaseUserId = isGuest ? null : user?.id ?? null;

  const [liked, setLiked] = useState(false);
  const burstOpacity = useRef(new Animated.Value(0)).current;
  const burstScale = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    let alive = true;
    void (async () => {
      const v = await isNewsLiked(storageScope, article, supabaseUserId);
      if (alive) setLiked(v);
    })();
    return () => { alive = false; };
  }, [storageScope, supabaseUserId, article.id, article.link]);

  const playBurst = useCallback(() => {
    burstOpacity.setValue(0);
    burstScale.setValue(0.5);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(burstOpacity, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(burstOpacity, { toValue: 0, duration: 550, delay: 120, useNativeDriver: true }),
      ]),
      Animated.spring(burstScale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
    ]).start();
  }, [burstOpacity, burstScale]);

  const onDoubleTapLike = useCallback(() => {
    void (async () => {
      const next = await toggleLikeNews(storageScope, article, supabaseUserId);
      setLiked(next);
      if (next) {
        playBurst();
        onLiked?.(article);
      }
    })();
  }, [article, storageScope, supabaseUserId, playBurst, onLiked]);

  const handleLikePress = useCallback(() => {
    void (async () => {
      const next = await toggleLikeNews(storageScope, article, supabaseUserId);
      setLiked(next);
      if (next) {
        playBurst();
        onLiked?.(article);
      }
    })();
  }, [article, storageScope, supabaseUserId, playBurst, onLiked]);

  const openLink = useCallback(() => {
    if (article.link) Linking.openURL(article.link);
  }, [article.link]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        title: article.title,
        message: `${article.title}\n\nRead more: ${article.link}`,
      });
    } catch {}
  }, [article.title, article.link]);

  const placeholderIdx = article.title.charCodeAt(0) % PLACEHOLDER_COLORS.length;

  const relativeTime = useMemo(() => timeAgo(article.publishedAt), [article.publishedAt]);

  const imageH = cardHeight * 0.38;
  const hasImage = !!article.imageUrl;

  const bg = isDark ? "#0f172a" : "#ffffff";
  const textPrimary = isDark ? "#f1f5f9" : "#1A1A1A";
  const textSecondary = isDark ? "#94a3b8" : "#6B7280";
  const accent = isDark ? "#7A9972" : "#5B7553";
  const heartTint = liked ? "#ef4444" : (isDark ? "#64748b" : "#9CA3AF");
  const actionBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
  const dividerColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const storyBg = isDark ? "rgba(148,163,184,0.08)" : "rgba(15,23,42,0.04)";
  const storyBorder = isDark ? "rgba(148,163,184,0.2)" : "rgba(15,23,42,0.08)";
  const storyLabelColor = isDark ? "#cbd5e1" : "#475569";

  return (
    <TapGestureHandler
      numberOfTaps={2}
      maxDelayMs={350}
      maxDeltaY={28}
      onActivated={onDoubleTapLike}
    >
      <View style={[styles.card, { height: cardHeight, backgroundColor: bg }]} collapsable={false}>
        {/* ── Image Section ── */}
        <View style={styles.imageWrap}>
          {hasImage ? (
            <Image
              source={{ uri: article.imageUrl! }}
              style={[styles.image, { height: imageH }]}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={PLACEHOLDER_COLORS[placeholderIdx]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.imagePlaceholder, { height: imageH }]}
            >
              <Ionicons name="newspaper-outline" size={48} color="rgba(255,255,255,0.2)" />
            </LinearGradient>
          )}

          {/* Uniflow branding overlay */}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.6)"]}
            style={styles.imageOverlay}
          >
            <Text style={styles.brandText}>uniflow</Text>
          </LinearGradient>

          {/* Source pill on image */}
          <View style={styles.sourcePillOnImage}>
            <Text style={styles.sourcePillText}>{article.source}</Text>
          </View>

          {/* Heart burst */}
          <Animated.View
            style={[
              styles.burstHeart,
              { opacity: burstOpacity, transform: [{ scale: burstScale }] },
            ]}
            pointerEvents="none"
          >
            <Ionicons name="heart" size={72} color="#fff" />
          </Animated.View>
        </View>

      {/* ── Action Bar ── */}
      <View style={[styles.actionBar, { borderBottomColor: dividerColor }]}>
        <Pressable
          onPress={handleLikePress}
          style={({ pressed }) => [styles.actionBtn, { backgroundColor: actionBg }, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name={liked ? "bookmark" : "bookmark-outline"} size={20} color={liked ? accent : textSecondary} />
        </Pressable>
        <Pressable
          onPress={handleShare}
          style={({ pressed }) => [styles.actionBtn, { backgroundColor: actionBg }, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="share-social-outline" size={20} color={textSecondary} />
        </Pressable>
      </View>

      {/* ── Content ── */}
      <View style={styles.body}>
        <Text style={[styles.headline, { color: textPrimary }]} numberOfLines={3}>
          {article.title}
        </Text>

        <View style={[styles.descriptionPanel, { backgroundColor: storyBg, borderColor: storyBorder }]}>
          <View style={styles.descriptionPanelHeader}>
            <Ionicons name="book-outline" size={13} color={storyLabelColor} />
            <Text style={[styles.descriptionPanelLabel, { color: storyLabelColor }]}>Full story</Text>
          </View>
          <ScrollView
            style={styles.descriptionScroll}
            contentContainerStyle={styles.descriptionScrollContent}
            showsVerticalScrollIndicator
            nestedScrollEnabled
          >
            <Text style={[styles.description, { color: textSecondary }]}>
              {article.description}
            </Text>
          </ScrollView>
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            {relativeTime !== "" && (
              <Text style={[styles.footerText, { color: textSecondary }]}>{relativeTime}</Text>
            )}
            <Text style={[styles.footerDot, { color: textSecondary }]}>|</Text>
            <Text style={[styles.footerText, { color: textSecondary }]}>{article.source}</Text>
          </View>
          <Pressable
            onPress={openLink}
            style={({ pressed }) => [styles.readMoreBtn, { backgroundColor: accent }, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.readMoreText}>Read more</Text>
            <Ionicons name="open-outline" size={12} color="#fff" />
          </Pressable>
        </View>
      </View>
      </View>
    </TapGestureHandler>
  );
};

const styles = StyleSheet.create({
  card: {
    width: SCREEN_W,
    overflow: "hidden",
  },

  /* ── Image ── */
  imageWrap: {
    position: "relative",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    backgroundColor: "#1e293b",
  },
  imagePlaceholder: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  imageOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 50,
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  brandText: {
    fontSize: 14,
    fontWeight: "900",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 1.5,
    textTransform: "lowercase",
  },
  sourcePillOnImage: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sourcePillText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#fff",
  },
  burstHeart: {
    position: "absolute",
    alignSelf: "center",
    top: "30%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },

  /* ── Action Bar ── */
  actionBar: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  /* ── Body ── */
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  headline: {
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 30,
    letterSpacing: -0.4,
    marginBottom: 10,
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
    fontWeight: "400",
    letterSpacing: 0.1,
  },
  descriptionPanel: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    flex: 1,
    minHeight: 120,
  },
  descriptionPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  descriptionPanelLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  descriptionScroll: {
    flex: 1,
  },
  descriptionScrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },

  /* ── Footer ── */
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    paddingBottom: 10,
  },
  footerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  footerText: {
    fontSize: 12,
    fontWeight: "600",
  },
  footerDot: {
    fontSize: 12,
    fontWeight: "400",
  },
  readMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  readMoreText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
});

export default React.memo(NewsCard);
