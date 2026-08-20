import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Dimensions,
  TextInput,
  Pressable,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Image,
  Linking,
  Modal,
  Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FlatList as GestureFlatList } from "react-native-gesture-handler";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import useNews from "../../hooks/useNews";
import useMyFeed from "../../hooks/useMyFeed";
import {
  NewsArticle,
  NewsCategory,
  TopicNewsCategory,
  NEWS_CATEGORIES,
  dbCategoryToTabCategory,
  displayCategoryLabel,
  fetchArticleByLink,
  fetchSimilarArticles,
  searchAllCategories,
  timeAgo,
  DEFAULT_NEWS_SOURCES,
  NEWS_SOURCE_OPTIONS,
  NEWS_SOURCES_STORAGE_KEY,
  loadNewsSources,
  fetchAvailableNewsSources,
  fetchAvailableNewsCategories,
} from "../../services/newsService";
import CategoryTabs from "./components/CategoryTabs";
import NewsCard from "./components/NewsCard";
import { NoInternetView, ErrorStateView } from "../../components/StatusView";
import useIsOffline from "../../hooks/useIsOffline";
import { useNewsReelEngagement } from "../../hooks/useNewsReelEngagement";
import { useAppTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { markNewsSeen } from "../../services/seenNewsService";
import type { AppColors } from "../../theme/colors";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

/**
 * Reel-style pagination: exactly one card per finger swipe, regardless of
 * fling strength. Strategy:
 *
 *  1. Let the native `pagingEnabled` + `snapToInterval` decide where to snap
 *     (so we don't fight it on small drags — fighting it was the source of
 *     the backward-swipe "toggle" bounce).
 *  2. iOS additionally gets `disableIntervalMomentum`, which already clamps
 *     flings to 1 page out of the box.
 *  3. On Android (where `disableIntervalMomentum` is a no-op) we use
 *     `onMomentumScrollEnd` as a safety net: if native momentum carried the
 *     user more than 1 page away from where they started the drag, we pull
 *     them back to exactly startPage ± 1. This runs AFTER native has settled,
 *     so it can't oscillate against the native snap logic.
 */
function useReelScroll(
  listRef: React.RefObject<any>,
  cardHeight: number
): {
  onScrollBeginDrag: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onMomentumScrollEnd: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
} {
  // Native paging owns the vertical gesture. A previous manual clamp here
  // could issue a second scrollToOffset after momentum and pull the reel back
  // to an older story on Android.
  void listRef;
  void cardHeight;
  const onScrollBeginDrag = useCallback((_e: NativeSyntheticEvent<NativeScrollEvent>) => undefined, []);
  const onMomentumScrollEnd = useCallback((_e: NativeSyntheticEvent<NativeScrollEvent>) => undefined, []);

  return { onScrollBeginDrag, onMomentumScrollEnd };
}

const getNewsTheme = (appDark: boolean) => {
  if (appDark) {
    return {
      headerGrad: ["#1C1E1C", "#3D5637"] as [string, string],
      bg: "#0c0c12",
      accent: "#7A9972",
      textPrimary: "#f1f5f9",
      textSecondary: "#94a3b8",
      cardUiDark: true,
    };
  }
  return {
    headerGrad: ["#F5F7F4", "#EDF2EB"] as [string, string],
    bg: "#FFFFFF",
    accent: "#5B7553",
    textPrimary: "#1A1A1A",
    textSecondary: "#6B7280",
    cardUiDark: false,
  };
};

function createNewsStyles(c: AppColors) {
  return StyleSheet.create({
    center: { alignItems: "center", justifyContent: "center" },
    loadingText: { marginTop: 12, fontSize: 14, fontWeight: "600" },
    errorText: { fontSize: 16, fontWeight: "800", color: "#ef4444" },
    errorSub: { fontSize: 13, marginTop: 4 },
    emptyText: { fontSize: 15, fontWeight: "700" },
    counterBadge: {
      position: "absolute",
      top: 18,
      right: 22,
      backgroundColor: c.overlay,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
      zIndex: 10,
    },
    counterText: { fontSize: 12, fontWeight: "700", color: c.text },
    container: { flex: 1 },
    header: { paddingHorizontal: 16, paddingBottom: 12 },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    homeButton: {
      width: 42,
      height: 42,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 21,
      borderWidth: 1,
    },
    headerCopy: { flex: 1, marginHorizontal: 12 },
    headerTitle: { fontSize: 22, fontWeight: "900", letterSpacing: -0.3 },
    headerSub: { fontSize: 11, fontWeight: "600", marginTop: 1 },
    swipeBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 14,
    },
    swipeBadgeText: { fontSize: 10, fontWeight: "800" },
    searchIcon: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 20,
    },
    searchInput: {
      marginTop: 8,
      height: 42,
      borderRadius: 14,
      paddingHorizontal: 14,
      fontSize: 15,
    },
    pagerWrap: { flex: 1 },
  });
}

interface AnimatedNewsCardProps {
  article: NewsArticle;
  cardHeight: number;
  isDark: boolean;
  active: boolean;
}

const AnimatedNewsCard: React.FC<AnimatedNewsCardProps> = React.memo(
  ({ article, cardHeight, isDark, active }) => {
    const progress = useRef(new Animated.Value(active ? 1 : 0)).current;

    useEffect(() => {
      Animated.spring(progress, {
        toValue: active ? 1 : 0,
        damping: 18,
        stiffness: 180,
        mass: 0.8,
        useNativeDriver: true,
      }).start();
    }, [active, progress]);

    return (
      <View style={{ width: SCREEN_W, height: cardHeight, paddingHorizontal: 10, paddingVertical: 8 }}>
        <Animated.View
          style={{
            flex: 1,
            borderRadius: 24,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: isDark ? 0.34 : 0.14,
            shadowRadius: 14,
            elevation: active ? 7 : 2,
            opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }),
            transform: [
              { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.965, 1] }) },
              { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [7, 0] }) },
            ],
          }}
        >
          <NewsCard article={article} cardHeight={Math.max(1, cardHeight - 16)} isDark={isDark} />
        </Animated.View>
      </View>
    );
  }
);

/* ════════════════════ CategoryPage ════════════════════ */

interface CategoryPageProps {
  category: TopicNewsCategory;
  storageScope: string;
  isActive: boolean;
  refreshSignal: number;
  cardHeight: number;
  isDark: boolean;
  isOffline: boolean;
  colors: AppColors;
  themedStyles: ReturnType<typeof createNewsStyles>;
  deepLinkArticleLink?: string | null;
  deepLinkArticleId?: string | null;
  deepLinkNonce?: number;
}

const CategoryPage: React.FC<CategoryPageProps> = React.memo(
  ({
    category,
    storageScope,
    isActive,
    refreshSignal,
    cardHeight,
    isDark,
    isOffline,
    colors,
    themedStyles: s,
    deepLinkArticleLink,
    deepLinkArticleId,
    deepLinkNonce,
  }) => {
    const {
      articles,
      isLoading,
      isLoadingMore,
      hasMore,
      error,
      refresh,
      loadMore,
      insertAfter,
    } = useNews(category, storageScope);
    const [currentIdx, setCurrentIdx] = useState(0);
    const listRef = useRef<any>(null);
    const consumedDeepLinkRef = useRef<number | undefined>(undefined);
    const [injected, setInjected] = useState<NewsArticle | null>(null);
    const { onScrollBeginDrag, onMomentumScrollEnd } = useReelScroll(
      listRef,
      cardHeight
    );

    const effectiveArticles = useMemo(() => {
      if (!injected) return articles;
      if (articles.some((a) => a.id === injected.id)) return articles;
      return [injected, ...articles];
    }, [injected, articles]);

    const markSeen = useCallback(
      (article: NewsArticle) => {
        void markNewsSeen(storageScope, article);
      },
      [storageScope]
    );

    const { onViewableItemsChanged, onArticleLiked } = useNewsReelEngagement({
      storageScope,
      tabCategory: category,
      effectiveArticles,
      insertAfter,
      isActive,
      isOffline,
      onVisibleIndexChange: setCurrentIdx,
      markSeen,
    });

    const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 60 });

    const lastRefreshSignal = useRef<number>(refreshSignal);
    const wasActive = useRef<boolean>(isActive);
    useEffect(() => {
      if (!isActive) {
        wasActive.current = false;
        return;
      }
      const signalChanged = refreshSignal !== lastRefreshSignal.current;
      const becameActive = !wasActive.current;
      wasActive.current = true;
      if (signalChanged || becameActive) {
        lastRefreshSignal.current = refreshSignal;
        void refresh();
      }
    }, [isActive, refreshSignal, refresh]);

    const handleLiked = useCallback(
      async (liked: NewsArticle) => {
        await onArticleLiked(liked);
        try {
          const existingIds = new Set(effectiveArticles.map((a) => a.id));
          const similar = await fetchSimilarArticles(liked, {
            limit: 5,
            excludeIds: existingIds,
          });
          if (similar.length > 0) insertAfter(liked.id, similar);
        } catch {}
      },
      [effectiveArticles, insertAfter, onArticleLiked]
    );

    const renderItem = useCallback(
      ({ item, index }: { item: NewsArticle; index: number }) => (
        <AnimatedNewsCard
          article={item}
          cardHeight={cardHeight}
          isDark={isDark}
          active={index === currentIdx}
        />
      ),
      [cardHeight, currentIdx, isDark]
    );

    const getItemLayout = useCallback(
      (_: any, index: number) => ({
        length: cardHeight,
        offset: cardHeight * index,
        index,
      }),
      [cardHeight]
    );

    useEffect(() => {
      if (!isActive) return;
      if (!deepLinkNonce) return;
      if (consumedDeepLinkRef.current === deepLinkNonce) return;
      if (articles.length === 0) return;
      const wantId = deepLinkArticleId?.trim();
      const wantLink = deepLinkArticleLink?.trim();
      if (!wantId && !wantLink) return;

      const inList = articles.findIndex(
        (a) =>
          (wantId && a.id === wantId) ||
          (wantLink && a.link?.trim() === wantLink)
      );

      if (inList >= 0) {
        consumedDeepLinkRef.current = deepLinkNonce;
        setTimeout(() => {
          listRef.current?.scrollToIndex?.({ index: inList, animated: false });
        }, 60);
        return;
      }

      if (wantLink) {
        consumedDeepLinkRef.current = deepLinkNonce;
        void (async () => {
          const fetched = await fetchArticleByLink(wantLink);
          if (fetched && !articles.some((a) => a.id === fetched.id)) {
            setInjected(fetched);
            setTimeout(() => {
              listRef.current?.scrollToIndex?.({ index: 0, animated: false });
            }, 60);
          }
        })();
      }
    }, [
      isActive,
      deepLinkNonce,
      deepLinkArticleId,
      deepLinkArticleLink,
      articles,
    ]);

    const loadingColor = isDark ? colors.primaryLight : colors.primary;

    if (isLoading && effectiveArticles.length === 0) {
      return (
        <View style={[s.center, { width: SCREEN_W, height: cardHeight }]}>
          <ActivityIndicator size="large" color={loadingColor} />
          <Text style={[s.loadingText, { color: colors.textMuted }]}>
            Loading {category}...
          </Text>
        </View>
      );
    }

    if (error && effectiveArticles.length === 0) {
      return (
        <View style={{ width: SCREEN_W, height: cardHeight }}>
          {isOffline ? (
            <NoInternetView onRetry={() => void refresh()} />
          ) : (
            <ErrorStateView
              title="Could not load news"
              subtitle={error}
              onRetry={() => void refresh()}
            />
          )}
        </View>
      );
    }

    return (
      <View style={{ width: SCREEN_W, height: cardHeight }}>
        <GestureFlatList
          ref={listRef}
          style={{ flex: 1 }}
          data={effectiveArticles}
          renderItem={renderItem}
          keyExtractor={keyExtract}
          pagingEnabled
          snapToInterval={cardHeight}
          decelerationRate="fast"
          snapToAlignment="start"
          disableIntervalMomentum
          scrollEventThrottle={16}
          onScrollBeginDrag={onScrollBeginDrag}
          onMomentumScrollEnd={onMomentumScrollEnd}
          showsVerticalScrollIndicator={false}
          getItemLayout={getItemLayout}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewConfigRef.current}
          refreshing={isLoading}
          onRefresh={refresh}
          removeClippedSubviews
          maxToRenderPerBatch={3}
          windowSize={5}
          initialNumToRender={2}
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (hasMore && !isLoadingMore && !isLoading) void loadMore();
          }}
          ListFooterComponent={
            isLoadingMore ? (
              <View style={{ paddingVertical: 24, alignItems: "center" }}>
                <ActivityIndicator size="small" color={loadingColor} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={{ width: SCREEN_W, height: cardHeight }}>
              <ErrorStateView
                title="No articles yet"
                subtitle="Pull to refresh — new stories arrive hourly."
                onRetry={() => void refresh()}
              />
            </View>
          }
        />
        {effectiveArticles.length > 0 && (
          <View style={s.counterBadge}>
            <Text style={s.counterText}>
              {currentIdx + 1}/{effectiveArticles.length}
              {hasMore ? "+" : ""}
            </Text>
          </View>
        )}
      </View>
    );
  }
);

interface MyFeedPageProps {
  storageScope: string;
  supabaseUserId: string | null;
  isActive: boolean;
  refreshSignal: number;
  cardHeight: number;
  isDark: boolean;
  isOffline: boolean;
  colors: AppColors;
  themedStyles: ReturnType<typeof createNewsStyles>;
  deepLinkArticleLink?: string | null;
  deepLinkArticleId?: string | null;
  deepLinkNonce?: number;
}

const MyFeedCategoryPage: React.FC<MyFeedPageProps> = React.memo(
  ({
    storageScope,
    supabaseUserId,
    isActive,
    refreshSignal,
    cardHeight,
    isDark,
    isOffline,
    colors,
    themedStyles: s,
    deepLinkArticleLink,
    deepLinkArticleId,
    deepLinkNonce,
  }) => {
    const {
      articles,
      isLoading,
      isLoadingMore,
      hasMore,
      error,
      refresh,
      loadMore,
      insertAfter,
    } = useMyFeed(storageScope, supabaseUserId);
    const [currentIdx, setCurrentIdx] = useState(0);
    const listRef = useRef<any>(null);
    const consumedDeepLinkRef = useRef<number | undefined>(undefined);
    const [injected, setInjected] = useState<NewsArticle | null>(null);
    const { onScrollBeginDrag, onMomentumScrollEnd } = useReelScroll(
      listRef,
      cardHeight
    );

    const effectiveArticles = useMemo(() => {
      if (!injected) return articles;
      if (articles.some((a) => a.id === injected.id)) return articles;
      return [injected, ...articles];
    }, [injected, articles]);

    const markSeen = useCallback(
      (article: NewsArticle) => {
        void markNewsSeen(storageScope, article);
      },
      [storageScope]
    );

    const { onViewableItemsChanged, onArticleLiked } = useNewsReelEngagement({
      storageScope,
      tabCategory: "India",
      effectiveArticles,
      insertAfter,
      isActive,
      isOffline,
      onVisibleIndexChange: setCurrentIdx,
      markSeen,
    });

    const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 60 });

    const lastRefreshSignal = useRef<number>(refreshSignal);
    const wasActive = useRef<boolean>(isActive);
    useEffect(() => {
      if (!isActive) {
        wasActive.current = false;
        return;
      }
      const signalChanged = refreshSignal !== lastRefreshSignal.current;
      const becameActive = !wasActive.current;
      wasActive.current = true;
      if (signalChanged || becameActive) {
        lastRefreshSignal.current = refreshSignal;
        void refresh();
      }
    }, [isActive, refreshSignal, refresh]);

    const handleLiked = useCallback(
      async (liked: NewsArticle) => {
        await onArticleLiked(liked);
        try {
          const existingIds = new Set(effectiveArticles.map((a) => a.id));
          const similar = await fetchSimilarArticles(liked, {
            limit: 5,
            excludeIds: existingIds,
          });
          if (similar.length > 0) insertAfter(liked.id, similar);
        } catch {}
      },
      [effectiveArticles, insertAfter, onArticleLiked]
    );

    const renderItem = useCallback(
      ({ item, index }: { item: NewsArticle; index: number }) => (
        <AnimatedNewsCard
          article={item}
          cardHeight={cardHeight}
          isDark={isDark}
          active={index === currentIdx}
        />
      ),
      [cardHeight, currentIdx, isDark]
    );

    const getItemLayout = useCallback(
      (_: any, index: number) => ({
        length: cardHeight,
        offset: cardHeight * index,
        index,
      }),
      [cardHeight]
    );

    useEffect(() => {
      if (!isActive) return;
      if (!deepLinkNonce) return;
      if (consumedDeepLinkRef.current === deepLinkNonce) return;
      if (articles.length === 0) return;
      const wantId = deepLinkArticleId?.trim();
      const wantLink = deepLinkArticleLink?.trim();
      if (!wantId && !wantLink) return;

      const inList = articles.findIndex(
        (a) =>
          (wantId && a.id === wantId) ||
          (wantLink && a.link?.trim() === wantLink)
      );

      if (inList >= 0) {
        consumedDeepLinkRef.current = deepLinkNonce;
        setTimeout(() => {
          listRef.current?.scrollToIndex?.({ index: inList, animated: false });
        }, 60);
        return;
      }

      if (wantLink) {
        consumedDeepLinkRef.current = deepLinkNonce;
        void (async () => {
          const fetched = await fetchArticleByLink(wantLink);
          if (fetched && !articles.some((a) => a.id === fetched.id)) {
            setInjected(fetched);
            setTimeout(() => {
              listRef.current?.scrollToIndex?.({ index: 0, animated: false });
            }, 60);
          }
        })();
      }
    }, [
      isActive,
      deepLinkNonce,
      deepLinkArticleId,
      deepLinkArticleLink,
      articles,
    ]);

    const loadingColor = isDark ? colors.primaryLight : colors.primary;

    if (isLoading && effectiveArticles.length === 0) {
      return (
        <View style={[s.center, { width: SCREEN_W, height: cardHeight }]}>
          <ActivityIndicator size="large" color={loadingColor} />
          <Text style={[s.loadingText, { color: colors.textMuted }]}>
            Building your feed…
          </Text>
        </View>
      );
    }

    if (error && effectiveArticles.length === 0) {
      return (
        <View style={{ width: SCREEN_W, height: cardHeight }}>
          {isOffline ? (
            <NoInternetView onRetry={() => void refresh()} />
          ) : (
            <ErrorStateView
              title="Could not load your feed"
              subtitle={error}
              onRetry={() => void refresh()}
            />
          )}
        </View>
      );
    }

    return (
      <View style={{ width: SCREEN_W, height: cardHeight }}>
        <GestureFlatList
          ref={listRef}
          style={{ flex: 1 }}
          data={effectiveArticles}
          renderItem={renderItem}
          keyExtractor={keyExtract}
          pagingEnabled
          snapToInterval={cardHeight}
          decelerationRate="fast"
          snapToAlignment="start"
          disableIntervalMomentum
          scrollEventThrottle={16}
          onScrollBeginDrag={onScrollBeginDrag}
          onMomentumScrollEnd={onMomentumScrollEnd}
          showsVerticalScrollIndicator={false}
          getItemLayout={getItemLayout}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewConfigRef.current}
          refreshing={isLoading}
          onRefresh={refresh}
          removeClippedSubviews
          maxToRenderPerBatch={3}
          windowSize={5}
          initialNumToRender={2}
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (hasMore && !isLoadingMore && !isLoading) void loadMore();
          }}
          ListFooterComponent={
            isLoadingMore ? (
              <View style={{ paddingVertical: 24, alignItems: "center" }}>
                <ActivityIndicator size="small" color={loadingColor} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={{ width: SCREEN_W, height: cardHeight }}>
              <ErrorStateView
                title="No stories yet"
                subtitle="Like a few articles (double-tap a card) and we'll match topics you care about. Until then, we'll mix in fresh picks."
                onRetry={() => void refresh()}
              />
            </View>
          }
        />
        {effectiveArticles.length > 0 && (
          <View style={s.counterBadge}>
            <Text style={s.counterText}>
              {currentIdx + 1}/{effectiveArticles.length}
              {hasMore ? "+" : ""}
            </Text>
          </View>
        )}
      </View>
    );
  }
);

const keyExtract = (item: NewsArticle) => item.id;

/* ════════════════════ SearchResultItem ════════════════════ */

interface SearchItemProps {
  article: NewsArticle;
  isDark: boolean;
  onCategoryPress?: (cat: string) => void;
}

const SearchResultItem: React.FC<SearchItemProps> = React.memo(
  ({ article, isDark, onCategoryPress }) => {
    const openLink = useCallback(() => {
      if (article.link) Linking.openURL(article.link);
    }, [article.link]);

    const relative = useMemo(
      () => timeAgo(article.publishedAt),
      [article.publishedAt]
    );

    const bg = isDark ? "#1e293b" : "#ffffff";
    const text = isDark ? "#f1f5f9" : "#1A1A1A";
    const sub = isDark ? "#94a3b8" : "#6B7280";
    const accent = isDark ? "#7A9972" : "#5B7553";
    const sourceBg = isDark ? "rgba(122,153,114,0.12)" : "#EDF2EB";
    const catBg = isDark ? "rgba(255,255,255,0.08)" : "#F3F4F6";
    const border = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";

    return (
      <Pressable
        onPress={openLink}
        style={({ pressed }) => [
          searchStyles.item,
          { backgroundColor: bg, borderBottomColor: border },
          pressed && { opacity: 0.85 },
        ]}
      >
        {article.imageUrl ? (
          <Image
            source={{ uri: article.imageUrl }}
            style={searchStyles.thumb}
          />
        ) : (
          <View
            style={[
              searchStyles.thumbPlaceholder,
              { backgroundColor: isDark ? "#334155" : "#F3F4F6" },
            ]}
          >
            <Ionicons
              name="newspaper-outline"
              size={20}
              color={isDark ? "#475569" : "#9CA3AF"}
            />
          </View>
        )}
        <View style={searchStyles.itemContent}>
          <Text style={[searchStyles.itemTitle, { color: text }]} numberOfLines={2}>
            {article.title}
          </Text>
          <View style={searchStyles.itemMeta}>
            <View style={[searchStyles.sourcePill, { backgroundColor: sourceBg }]}>
              <Text style={[searchStyles.sourcePillText, { color: accent }]}>
                {article.source}
              </Text>
            </View>
            {article.category ? (
              <Pressable
                onPress={() => onCategoryPress?.(article.category!)}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              >
                <View style={[searchStyles.catPill, { backgroundColor: catBg }]}>
                  <Text style={[searchStyles.catPillText, { color: sub }]}>
                    {displayCategoryLabel(article.category)}
                  </Text>
                </View>
              </Pressable>
            ) : null}
            {relative ? (
              <Text style={[searchStyles.itemTime, { color: sub }]}>
                {relative}
              </Text>
            ) : null}
          </View>
          {article.description.length > 10 && (
            <Text
              style={[searchStyles.itemDesc, { color: sub }]}
              numberOfLines={2}
            >
              {article.description}
            </Text>
          )}
        </View>
      </Pressable>
    );
  }
);

const searchStyles = StyleSheet.create({
  item: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: "#e2e8f0",
    marginRight: 12,
  },
  thumbPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 12,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  itemContent: {
    flex: 1,
    minWidth: 0,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  itemMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 4,
  },
  sourcePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sourcePillText: {
    fontSize: 10,
    fontWeight: "800",
  },
  catPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  catPillText: {
    fontSize: 10,
    fontWeight: "700",
  },
  itemTime: {
    fontSize: 11,
    fontWeight: "600",
  },
  itemDesc: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "400",
  },
});

/* ════════════════════ NewsScreen ════════════════════ */

const NewsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { storageScope, user, isGuest } = useAuth();
  const supabaseUserId = isGuest ? null : user?.id ?? null;
  const { isDark: appDark, colors } = useAppTheme();
  const theme = useMemo(() => getNewsTheme(appDark), [appDark]);
  const themedStyles = useMemo(() => createNewsStyles(colors), [colors]);
  const isOffline = useIsOffline();

  const [activeIdx, setActiveIdx] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [contentH, setContentH] = useState(0);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [enabledSources, setEnabledSources] = useState<string[]>([
    ...DEFAULT_NEWS_SOURCES,
  ]);
  const [sourceOptions, setSourceOptions] = useState<string[]>([
    ...NEWS_SOURCE_OPTIONS,
  ]);
  const [newsCategories, setNewsCategories] = useState<NewsCategory[]>(
    NEWS_CATEGORIES
  );

  const [searchResults, setSearchResults] = useState<NewsArticle[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  const horizontalRef = useRef<FlatList<NewsCategory>>(null);
  const lastNewsNavSig = useRef<string>("");
  const [refreshSignal, setRefreshSignal] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setRefreshSignal((n) => n + 1);
    }, [])
  );

  useEffect(() => {
    void Promise.all([
      loadNewsSources(),
      fetchAvailableNewsSources(),
      fetchAvailableNewsCategories(),
      AsyncStorage.getItem(NEWS_SOURCES_STORAGE_KEY),
    ]).then(([enabled, available, categories, saved]) => {
      const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
      const savedMatchesLiveSource = enabled.some((selected) =>
        available.some((publisher) => {
          const a = normalize(selected);
          const b = normalize(publisher);
          return a.includes(b) || b.includes(a) || (a.includes("hindu") && b.includes("hindu")) || (a.includes("bbc") && b.includes("bbc"));
        })
      );
      const nextEnabled = saved && savedMatchesLiveSource ? enabled : available;
      setEnabledSources(nextEnabled);
      setSourceOptions(available);
      setNewsCategories(categories);
      if (!saved || !savedMatchesLiveSource) {
        void AsyncStorage.setItem(NEWS_SOURCES_STORAGE_KEY, JSON.stringify(nextEnabled));
      }
      setActiveIdx(0);
      setRefreshSignal((value) => value + 1);
    });
  }, []);

  const isSearchActive = showSearch && searchQuery.trim().length > 0;

  useEffect(() => {
    const idx = route.params?.initialCategoryIndex;
    if (typeof idx !== "number" || idx < 0 || idx >= newsCategories.length) {
      return;
    }
    const ts = route.params?._newsNavTs;
    if (typeof ts !== "number" || Number.isNaN(ts)) return;
    const sig = `${idx}:${ts}`;
    if (lastNewsNavSig.current === sig) return;
    lastNewsNavSig.current = sig;
    setActiveIdx(idx);
    const t = setTimeout(() => {
      horizontalRef.current?.scrollToIndex({
        index: idx,
        animated: true,
      });
    }, 80);
    return () => clearTimeout(t);
  }, [newsCategories, route.params?.initialCategoryIndex, route.params?._newsNavTs]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await searchAllCategories(searchQuery);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      }
      setSearchLoading(false);
    }, 350);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchQuery]);

  const handleHorizontalScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
      setActiveIdx((prev) => (idx !== prev ? idx : prev));
    },
    []
  );

  const handleTabPress = useCallback((idx: number) => {
    if (idx === newsCategories.length) {
      setShowSourcePicker(true);
      return;
    }
    setActiveIdx(idx);
    horizontalRef.current?.scrollToIndex({ index: idx, animated: true });
  }, [newsCategories.length]);

  const toggleSource = useCallback((source: string) => {
    setEnabledSources((current) => {
      const next = current.includes(source)
        ? current.filter((item) => item !== source)
        : [...current, source];
      if (next.length === 0) return current;
      void AsyncStorage.setItem(NEWS_SOURCES_STORAGE_KEY, JSON.stringify(next));
      setRefreshSignal((value) => value + 1);
      return next;
    });
  }, []);

  const handleCategoryFromSearch = useCallback((cat: string) => {
    const tab = dbCategoryToTabCategory(cat);
    if (!tab) return;
    const idx = newsCategories.indexOf(tab);
    if (idx >= 0) {
      setShowSearch(false);
      setSearchQuery("");
      setActiveIdx(idx);
      setTimeout(() => {
        horizontalRef.current?.scrollToIndex({ index: idx, animated: true });
      }, 100);
    }
  }, []);

  const toggleSearch = useCallback(() => {
    setShowSearch((v) => {
      if (v) {
        setSearchQuery("");
        setSearchResults([]);
      }
      return !v;
    });
  }, []);

  /** Must match the pager viewport height exactly so one card fills the screen with no peek of the next. */
  const cardH = contentH > 0 ? contentH : SCREEN_H * 0.7;

  const deepLinkArticleLink =
    typeof route.params?.initialArticleLink === "string"
      ? (route.params.initialArticleLink as string)
      : null;
  const deepLinkArticleId =
    typeof route.params?.initialArticleId === "string"
      ? (route.params.initialArticleId as string)
      : null;
  const deepLinkNonce =
    typeof route.params?._newsNavTs === "number"
      ? (route.params._newsNavTs as number)
      : undefined;

  const renderPage = useCallback(
    ({ item, index }: { item: NewsCategory; index: number }) => (
      <CategoryPage
        category={item}
        storageScope={storageScope}
        isActive={index === activeIdx}
        refreshSignal={refreshSignal}
        cardHeight={cardH}
        isDark={theme.cardUiDark}
        isOffline={isOffline}
        colors={colors}
        themedStyles={themedStyles}
        deepLinkArticleLink={deepLinkArticleLink}
        deepLinkArticleId={deepLinkArticleId}
        deepLinkNonce={deepLinkNonce}
      />
    ),
    [
      cardH,
      theme.cardUiDark,
      colors,
      themedStyles,
      storageScope,
      supabaseUserId,
      activeIdx,
      refreshSignal,
      isOffline,
      deepLinkArticleLink,
      deepLinkArticleId,
      deepLinkNonce,
    ]
  );

  const hGetItemLayout = useCallback(
    (_: any, idx: number) => ({
      length: SCREEN_W,
      offset: SCREEN_W * idx,
      index: idx,
    }),
    []
  );

  const renderSearchItem = useCallback(
    ({ item }: { item: NewsArticle }) => (
      <SearchResultItem
        article={item}
        isDark={theme.cardUiDark}
        onCategoryPress={handleCategoryFromSearch}
      />
    ),
    [theme.cardUiDark, handleCategoryFromSearch]
  );

  const searchKeyExtract = useCallback((item: NewsArticle) => item.id, []);

  return (
    <View style={[themedStyles.container, { backgroundColor: theme.bg }]}>
      <LinearGradient
        colors={theme.headerGrad}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[themedStyles.header, { paddingTop: insets.top + 8 }]}
      >
        <View style={themedStyles.headerRow}>
          <Pressable
            onPress={() => navigation.navigate("dashboard")}
            accessibilityRole="button"
            accessibilityLabel="Back to home"
            hitSlop={8}
            style={({ pressed }) => [
              themedStyles.homeButton,
              {
                backgroundColor: theme.cardUiDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.72)",
                borderColor: theme.cardUiDark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.08)",
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Ionicons name="arrow-back" size={21} color={theme.textPrimary} />
          </Pressable>

          <View style={themedStyles.headerCopy}>
            <Text style={[themedStyles.headerTitle, { color: theme.textPrimary }]}>News</Text>
            <Text style={[themedStyles.headerSub, { color: theme.textSecondary }]}>Fresh stories, one card at a time</Text>
          </View>

          <View
            style={[
              themedStyles.swipeBadge,
              { backgroundColor: theme.cardUiDark ? "rgba(122,153,114,0.18)" : "rgba(91,117,83,0.10)" },
            ]}
          >
            <Ionicons name="swap-vertical" size={13} color={theme.accent} />
            <Text style={[themedStyles.swipeBadgeText, { color: theme.accent }]}>SWIPE</Text>
          </View>
        </View>
      </LinearGradient>

      <CategoryTabs
        categories={newsCategories}
        activeIndex={activeIdx}
        onSelect={handleTabPress}
        isDark={theme.cardUiDark}
        showSources
      />

      {false ? (
        <View style={{ flex: 1 }}>
          {searchLoading && searchResults.length === 0 ? (
            <View style={[themedStyles.center, { flex: 1 }]}>
              <ActivityIndicator size="large" color={theme.accent} />
              <Text
                style={[
                  themedStyles.loadingText,
                  { color: theme.textSecondary },
                ]}
              >
                Searching all categories...
              </Text>
            </View>
          ) : searchResults.length === 0 ? (
            <View style={[themedStyles.center, { flex: 1 }]}>
              <Ionicons
                name="search-outline"
                size={48}
                color={colors.textMuted}
              />
              <Text
                style={[
                  themedStyles.emptyText,
                  { color: colors.textMuted, marginTop: 12 },
                ]}
              >
                No results for &ldquo;{searchQuery}&rdquo;
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: colors.textMuted,
                  marginTop: 4,
                  fontWeight: "500",
                }}
              >
                Try a different keyword
              </Text>
            </View>
          ) : (
            <>
              <View
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.cardUiDark
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(0,0,0,0.04)",
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: theme.textSecondary,
                  }}
                >
                  {searchResults.length} result
                  {searchResults.length !== 1 ? "s" : ""} across all categories
                </Text>
              </View>
              <FlatList
                data={searchResults}
                renderItem={renderSearchItem}
                keyExtractor={searchKeyExtract}
                showsVerticalScrollIndicator={false}
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={7}
              />
            </>
          )}
        </View>
      ) : (
        <View
          style={themedStyles.pagerWrap}
          onLayout={(e) => setContentH(e.nativeEvent.layout.height)}
        >
          {contentH > 0 && (
            <FlatList
              ref={horizontalRef}
              data={newsCategories}
              renderItem={renderPage}
              keyExtractor={catKey}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleHorizontalScroll}
              getItemLayout={hGetItemLayout}
              initialNumToRender={1}
              windowSize={3}
              removeClippedSubviews={false}
              onScrollToIndexFailed={({ index }) => {
                setTimeout(() => {
                  horizontalRef.current?.scrollToIndex({
                    index,
                    animated: false,
                  });
                }, 400);
              }}
            />
          )}
        </View>
      )}

      <Modal
        visible={showSourcePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSourcePicker(false)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" }}>
          <View
            style={{
              backgroundColor: theme.cardUiDark ? "#191D26" : "#FFFFFF",
              borderTopLeftRadius: 26,
              borderTopRightRadius: 26,
              padding: 22,
              paddingBottom: insets.bottom + 22,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ color: theme.textPrimary, fontSize: 22, fontWeight: "900" }}>
                Select sources
              </Text>
              <Pressable onPress={() => setShowSourcePicker(false)}>
                <Ionicons name="close-circle" size={28} color={theme.textSecondary} />
              </Pressable>
            </View>
            <Text style={{ color: theme.textSecondary, fontSize: 13, marginBottom: 10 }}>
              Choose which publishers appear when news is fetched.
            </Text>
            {sourceOptions.map((source) => {
              const enabled = enabledSources.includes(source);
              return (
                <Pressable
                  key={source}
                  onPress={() => toggleSource(source)}
                  style={({ pressed }) => [
                    { flexDirection: "row", alignItems: "center", paddingVertical: 11 },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Ionicons
                    name={enabled ? "checkmark-circle" : "ellipse-outline"}
                    size={23}
                    color={enabled ? theme.accent : theme.textSecondary}
                  />
                  <Text style={{ color: theme.textPrimary, fontSize: 15, fontWeight: "700", marginLeft: 12 }}>
                    {source}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>

    </View>
  );
};

const catKey = (item: NewsCategory) => item;

export default NewsScreen;
