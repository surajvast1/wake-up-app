import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  Alert,
  Share,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useAuth } from "../../contexts/AuthContext";
import { useAppTheme } from "../../contexts/ThemeContext";
import type { AppColors } from "../../theme/colors";
import {
  listLikedNewsForProfile,
  removeLikedNews,
  type LikedNewsStored,
} from "../../services/likedNewsService";
import {
  listLikedQuotesForProfile,
  toggleLikeQuote,
  type LikedQuoteStored,
} from "../../services/likedQuotesService";

type TabId = "news" | "quotes";

/** "2026-04-19T..." → "Apr 19" (best-effort, falls back to the raw date). */
function shortDate(iso?: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function createStyles(c: AppColors, isDark: boolean) {
  const heroGrad: [string, string] = isDark
    ? ["#3b0764", "#701a75"]
    : ["#a855f7", "#ec4899"];
  const quoteBg = isDark ? "#2a1840" : "#faf5ff";
  const quoteBorder = isDark ? "#4b226a" : "#e9d5ff";

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.backgroundSecondary },

    /* ── top bar ─────────────────────────────────────────────────── */
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingBottom: 4,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    topBarTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: c.text,
      marginLeft: 2,
    },

    /* ── hero card ───────────────────────────────────────────────── */
    hero: {
      marginHorizontal: 16,
      marginTop: 6,
      borderRadius: 22,
      overflow: "hidden",
    },
    heroInner: {
      paddingHorizontal: 20,
      paddingVertical: 18,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    heroIconBubble: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.22)",
    },
    heroEyebrow: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.2,
      textTransform: "uppercase",
      color: "rgba(255,255,255,0.8)",
    },
    heroTitle: {
      fontSize: 20,
      fontWeight: "900",
      color: "#ffffff",
      marginTop: 2,
    },
    heroSub: {
      fontSize: 12,
      fontWeight: "500",
      color: "rgba(255,255,255,0.9)",
      marginTop: 4,
      lineHeight: 17,
    },

    /* ── tabs ────────────────────────────────────────────────────── */
    tabsRow: {
      flexDirection: "row",
      marginHorizontal: 16,
      marginTop: 16,
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    tabBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 10,
      flexDirection: "row",
      gap: 6,
    },
    tabBtnActive: {
      backgroundColor: c.primary,
    },
    tabLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: c.textSecondary,
    },
    tabLabelActive: {
      color: "#ffffff",
    },
    tabCountPill: {
      minWidth: 22,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 10,
      backgroundColor: c.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    tabCountPillActive: {
      backgroundColor: "rgba(255,255,255,0.25)",
    },
    tabCountText: {
      fontSize: 11,
      fontWeight: "800",
      color: c.textSecondary,
    },
    tabCountTextActive: {
      color: "#ffffff",
    },

    /* ── list container ──────────────────────────────────────────── */
    listContent: {
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 40,
    },

    /* ── news card ───────────────────────────────────────────────── */
    newsCard: {
      backgroundColor: c.surface,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      marginBottom: 12,
      overflow: "hidden",
    },
    newsCardInner: {
      flexDirection: "row",
      padding: 12,
      gap: 12,
    },
    newsThumb: {
      width: 86,
      height: 86,
      borderRadius: 14,
      backgroundColor: c.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    newsThumbImage: {
      width: "100%",
      height: "100%",
    },
    newsBody: {
      flex: 1,
      minWidth: 0,
    },
    newsSourceRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 4,
    },
    newsSourcePill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      backgroundColor: c.primarySoftBg,
    },
    newsSourceText: {
      fontSize: 10,
      fontWeight: "800",
      color: c.primary,
      letterSpacing: 0.3,
    },
    newsDate: {
      fontSize: 11,
      fontWeight: "600",
      color: c.textMuted,
    },
    newsTitle: {
      fontSize: 14.5,
      fontWeight: "800",
      color: c.text,
      lineHeight: 20,
    },
    newsCategory: {
      fontSize: 11,
      fontWeight: "700",
      color: c.textMuted,
      marginTop: 4,
      textTransform: "capitalize",
    },
    newsActionsRow: {
      flexDirection: "row",
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      backgroundColor: c.surfaceMuted,
    },
    newsAction: {
      flex: 1,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    newsActionDivider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
    },
    newsActionText: {
      fontSize: 12.5,
      fontWeight: "700",
      color: c.textSecondary,
    },
    newsActionDangerText: {
      color: c.danger,
    },

    /* ── quote card ──────────────────────────────────────────────── */
    quoteCard: {
      borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: quoteBorder,
      backgroundColor: quoteBg,
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 10,
      marginBottom: 12,
    },
    quoteMark: {
      position: "absolute",
      top: 6,
      left: 10,
      fontSize: 48,
      lineHeight: 52,
      fontWeight: "900",
      color: c.primarySoftBg,
      opacity: 0.7,
    },
    quoteText: {
      fontSize: 15,
      fontWeight: "600",
      color: c.text,
      fontStyle: "italic",
      lineHeight: 22,
      paddingLeft: 6,
      marginTop: 8,
    },
    quoteAuthor: {
      fontSize: 13,
      fontWeight: "800",
      color: c.primary,
      marginTop: 10,
      paddingLeft: 6,
    },
    quoteMoodRow: {
      flexDirection: "row",
      marginTop: 10,
      gap: 6,
      paddingLeft: 6,
    },
    quoteMoodPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: quoteBorder,
    },
    quoteMoodText: {
      fontSize: 11,
      fontWeight: "700",
      color: c.textSecondary,
      textTransform: "capitalize",
    },
    quoteActionsRow: {
      flexDirection: "row",
      marginTop: 12,
      marginHorizontal: -2,
    },
    quoteActionBtn: {
      flex: 1,
      paddingVertical: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },

    /* ── empty state ─────────────────────────────────────────────── */
    emptyWrap: {
      alignItems: "center",
      paddingVertical: 56,
      paddingHorizontal: 24,
    },
    emptyIconBubble: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: c.primarySoftBg,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: c.text,
      marginBottom: 6,
      textAlign: "center",
    },
    emptySub: {
      fontSize: 13,
      fontWeight: "500",
      color: c.textMuted,
      textAlign: "center",
      lineHeight: 19,
      maxWidth: 280,
    },
  });
}

const LikedItemsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { colors: c, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const { user, isGuest, storageScope } = useAuth();

  const [likedNews, setLikedNews] = useState<LikedNewsStored[]>([]);
  const [likedQuotes, setLikedQuotes] = useState<LikedQuoteStored[]>([]);
  const [tab, setTab] = useState<TabId>("news");

  const loadLikes = useCallback(async () => {
    const uid = isGuest ? null : user?.id ?? null;
    try {
      const [n, q] = await Promise.all([
        listLikedNewsForProfile(storageScope, uid),
        listLikedQuotesForProfile(storageScope, uid),
      ]);
      setLikedNews(n);
      setLikedQuotes(q);
    } catch {
      setLikedNews([]);
      setLikedQuotes([]);
    }
  }, [storageScope, user?.id, isGuest]);

  useFocusEffect(
    useCallback(() => {
      void loadLikes();
    }, [loadLikes])
  );

  const removeNewsItem = useCallback(
    (row: LikedNewsStored) => {
      Alert.alert("Remove", "Remove this article from liked?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void (async () => {
              await removeLikedNews(
                storageScope,
                row,
                isGuest ? null : user?.id ?? null
              );
              await loadLikes();
            })();
          },
        },
      ]);
    },
    [storageScope, isGuest, user?.id, loadLikes]
  );

  const shareNewsItem = useCallback((row: LikedNewsStored) => {
    void Share.share({
      title: row.title,
      message: row.link ? `${row.title}\n\n${row.link}` : row.title,
    });
  }, []);

  const openNewsItem = useCallback((row: LikedNewsStored) => {
    if (row.link) void Linking.openURL(row.link);
  }, []);

  const removeQuoteItem = useCallback(
    (q: LikedQuoteStored) => {
      Alert.alert("Remove", "Remove this quote from liked?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void (async () => {
              await toggleLikeQuote(
                storageScope,
                {
                  text: q.text,
                  author: q.author || "",
                  mood: q.mood,
                },
                isGuest ? null : user?.id ?? null
              );
              await loadLikes();
            })();
          },
        },
      ]);
    },
    [storageScope, isGuest, user?.id, loadLikes]
  );

  const shareQuoteItem = useCallback((q: LikedQuoteStored) => {
    void Share.share({
      message: q.author ? `"${q.text}" — ${q.author}` : q.text,
    });
  }, []);

  const renderNews = useCallback(
    ({ item }: { item: LikedNewsStored }) => (
      <View style={styles.newsCard}>
        <Pressable
          onPress={() => openNewsItem(item)}
          style={({ pressed }) => [
            styles.newsCardInner,
            pressed && { opacity: 0.86 },
          ]}
        >
          <View style={styles.newsThumb}>
            {item.image_url ? (
              <Image
                source={{ uri: item.image_url }}
                style={styles.newsThumbImage}
                resizeMode="cover"
              />
            ) : (
              <Ionicons
                name="newspaper-outline"
                size={30}
                color={c.iconMuted}
              />
            )}
          </View>
          <View style={styles.newsBody}>
            <View style={styles.newsSourceRow}>
              {item.source ? (
                <View style={styles.newsSourcePill}>
                  <Text style={styles.newsSourceText} numberOfLines={1}>
                    {item.source.toUpperCase()}
                  </Text>
                </View>
              ) : null}
              <Text style={styles.newsDate} numberOfLines={1}>
                {shortDate(item.published_at)}
              </Text>
            </View>
            <Text style={styles.newsTitle} numberOfLines={3}>
              {item.title}
            </Text>
            {item.category ? (
              <Text style={styles.newsCategory} numberOfLines={1}>
                {item.category}
              </Text>
            ) : null}
          </View>
        </Pressable>
        <View style={styles.newsActionsRow}>
          <Pressable
            onPress={() => openNewsItem(item)}
            style={({ pressed }) => [
              styles.newsAction,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="open-outline" size={16} color={c.primary} />
            <Text style={[styles.newsActionText, { color: c.primary }]}>
              Open
            </Text>
          </Pressable>
          <View style={styles.newsActionDivider} />
          <Pressable
            onPress={() => shareNewsItem(item)}
            style={({ pressed }) => [
              styles.newsAction,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="share-outline" size={16} color={c.textSecondary} />
            <Text style={styles.newsActionText}>Share</Text>
          </Pressable>
          <View style={styles.newsActionDivider} />
          <Pressable
            onPress={() => removeNewsItem(item)}
            style={({ pressed }) => [
              styles.newsAction,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="trash-outline" size={16} color={c.danger} />
            <Text style={[styles.newsActionText, styles.newsActionDangerText]}>
              Remove
            </Text>
          </Pressable>
        </View>
      </View>
    ),
    [styles, c, openNewsItem, shareNewsItem, removeNewsItem]
  );

  const renderQuote = useCallback(
    ({ item, index }: { item: LikedQuoteStored; index: number }) => (
      <View style={styles.quoteCard} key={item.content_hash ?? index}>
        <Text style={styles.quoteMark}>&ldquo;</Text>
        <Text style={styles.quoteText}>{item.text}</Text>
        {item.author ? (
          <Text style={styles.quoteAuthor}>— {item.author}</Text>
        ) : null}
        {item.mood ? (
          <View style={styles.quoteMoodRow}>
            <View style={styles.quoteMoodPill}>
              <Text style={styles.quoteMoodText}>{item.mood}</Text>
            </View>
          </View>
        ) : null}
        <View style={styles.quoteActionsRow}>
          <Pressable
            onPress={() => shareQuoteItem(item)}
            style={({ pressed }) => [
              styles.quoteActionBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="share-outline" size={16} color={c.primary} />
            <Text style={[styles.newsActionText, { color: c.primary }]}>
              Share
            </Text>
          </Pressable>
          <Pressable
            onPress={() => removeQuoteItem(item)}
            style={({ pressed }) => [
              styles.quoteActionBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="trash-outline" size={16} color={c.danger} />
            <Text style={[styles.newsActionText, styles.newsActionDangerText]}>
              Remove
            </Text>
          </Pressable>
        </View>
      </View>
    ),
    [styles, c, shareQuoteItem, removeQuoteItem]
  );

  const heroGrad: [string, string] = isDark
    ? ["#3b0764", "#701a75"]
    : ["#a855f7", "#ec4899"];

  const totalSaved = likedNews.length + likedQuotes.length;

  const emptyNews = (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconBubble}>
        <Ionicons name="newspaper-outline" size={32} color={c.primary} />
      </View>
      <Text style={styles.emptyTitle}>No liked articles yet</Text>
      <Text style={styles.emptySub}>
        Double-tap a story card in News to save it. Your saves stay here ready to revisit anytime.
      </Text>
    </View>
  );

  const emptyQuotes = (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconBubble}>
        <Ionicons name="sparkles-outline" size={32} color={c.primary} />
      </View>
      <Text style={styles.emptyTitle}>No liked quotes yet</Text>
      <Text style={styles.emptySub}>
        Tap the heart on any daily quote on your dashboard to keep it forever.
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.backBtn,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="chevron-back" size={22} color={c.text} />
        </Pressable>
        <Text style={styles.topBarTitle}>Liked items</Text>
      </View>

      <View style={styles.hero}>
        <LinearGradient
          colors={heroGrad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroInner}
        >
          <View style={styles.heroIconBubble}>
            <Ionicons name="heart" size={24} color="#ffffff" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.heroEyebrow}>Your saves</Text>
            <Text style={styles.heroTitle} numberOfLines={1}>
              {totalSaved === 0
                ? "Start your collection"
                : totalSaved === 1
                ? "1 thing you loved"
                : `${totalSaved} things you loved`}
            </Text>
            <Text style={styles.heroSub} numberOfLines={2}>
              {isGuest
                ? "Saved on this device only — sign in to sync."
                : "Saved to your account and synced across devices."}
            </Text>
          </View>
        </LinearGradient>
      </View>

      <View style={styles.tabsRow}>
        <Pressable
          onPress={() => setTab("news")}
          style={({ pressed }) => [
            styles.tabBtn,
            tab === "news" && styles.tabBtnActive,
            pressed && { opacity: 0.8 },
          ]}
        >
          <Ionicons
            name="newspaper"
            size={15}
            color={tab === "news" ? "#ffffff" : c.textSecondary}
          />
          <Text
            style={[
              styles.tabLabel,
              tab === "news" && styles.tabLabelActive,
            ]}
          >
            News
          </Text>
          <View
            style={[
              styles.tabCountPill,
              tab === "news" && styles.tabCountPillActive,
            ]}
          >
            <Text
              style={[
                styles.tabCountText,
                tab === "news" && styles.tabCountTextActive,
              ]}
            >
              {likedNews.length}
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => setTab("quotes")}
          style={({ pressed }) => [
            styles.tabBtn,
            tab === "quotes" && styles.tabBtnActive,
            pressed && { opacity: 0.8 },
          ]}
        >
          <Ionicons
            name="sparkles"
            size={15}
            color={tab === "quotes" ? "#ffffff" : c.textSecondary}
          />
          <Text
            style={[
              styles.tabLabel,
              tab === "quotes" && styles.tabLabelActive,
            ]}
          >
            Quotes
          </Text>
          <View
            style={[
              styles.tabCountPill,
              tab === "quotes" && styles.tabCountPillActive,
            ]}
          >
            <Text
              style={[
                styles.tabCountText,
                tab === "quotes" && styles.tabCountTextActive,
              ]}
            >
              {likedQuotes.length}
            </Text>
          </View>
        </Pressable>
      </View>

      {tab === "news" ? (
        <FlatList
          data={likedNews}
          keyExtractor={(row) => row.content_hash}
          renderItem={renderNews}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={emptyNews}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={likedQuotes}
          keyExtractor={(row, i) =>
            row.content_hash || `q-${i}-${row.text.slice(0, 24)}`
          }
          renderItem={renderQuote}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={emptyQuotes}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

export default LikedItemsScreen;
