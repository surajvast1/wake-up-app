import { useCallback, useRef } from "react";
import type { ViewToken } from "react-native";
import type { TopicNewsCategory } from "../services/newsService";
import type { NewsArticle } from "../services/newsService";
import {
  NEWS_MIN_DWELL_MS,
  fetchPersonalizedReelInject,
  recordDwellEngagement,
  recordLikeEngagement,
} from "../services/newsEngagementService";

interface UseNewsReelEngagementOptions {
  storageScope: string;
  /** Current topic tab — fallback category for the taste seed. */
  tabCategory: TopicNewsCategory;
  /** Live list backing the reel (same reference as FlatList `data`). */
  effectiveArticles: NewsArticle[];
  insertAfter: (afterId: string, extra: NewsArticle[]) => void;
  isActive: boolean;
  isOffline: boolean;
  /** Called when the primary visible index changes (for counter badge). */
  onVisibleIndexChange: (index: number) => void;
  /** Mark articles seen (existing behaviour). */
  markSeen: (article: NewsArticle) => void;
}

/**
 * Tracks **dwell** on each reel card and periodically injects a
 * profile-matched article after every 3–4 completed swipes. Likes should call
 * `onArticleLiked` from the parent’s like handler.
 */
export function useNewsReelEngagement({
  storageScope,
  tabCategory,
  effectiveArticles,
  insertAfter,
  isActive,
  isOffline,
  onVisibleIndexChange,
  markSeen,
}: UseNewsReelEngagementOptions): {
  onViewableItemsChanged: (info: {
    viewableItems: ViewToken[];
  }) => void;
  onArticleLiked: (article: NewsArticle) => void | Promise<void>;
} {
  /** Article the user is currently “sitting on” + wall-clock start. */
  const visibleRef = useRef<{
    article: NewsArticle;
    index: number;
    startMs: number;
  } | null>(null);
  const reelTurnsRef = useRef(0);
  const nextInjectAfterRef = useRef(3 + Math.floor(Math.random() * 2)); // 3 or 4
  const injectInflightRef = useRef(false);

  const onArticleLiked = useCallback(
    async (article: NewsArticle) => {
      await recordLikeEngagement(storageScope, article);
    },
    [storageScope]
  );

  const tryInject = useCallback(
    async (afterArticle: NewsArticle) => {
      if (!isActive || isOffline || injectInflightRef.current) return;
      injectInflightRef.current = true;
      try {
        const ids = new Set(effectiveArticles.map((a) => a.id));
        const links = new Set(
          effectiveArticles.map((a) => a.link.trim()).filter(Boolean)
        );
        const picks = await fetchPersonalizedReelInject(
          storageScope,
          tabCategory,
          ids,
          links
        );
        const top = picks[0];
        if (top && !ids.has(top.id)) {
          insertAfter(afterArticle.id, [top]);
        }
      } finally {
        injectInflightRef.current = false;
      }
    },
    [
      isActive,
      isOffline,
      effectiveArticles,
      insertAfter,
      storageScope,
      tabCategory,
    ]
  );

  const onViewableItemsChanged = useCallback(
    (info: { viewableItems: ViewToken[] }) => {
      const top = info.viewableItems[0];
      if (top?.index == null || top.item == null) return;

      const item = top.item as NewsArticle;
      const idx = top.index;
      onVisibleIndexChange(idx);
      markSeen(item);

      const prev = visibleRef.current;
      const now = Date.now();

      if (prev && prev.article.id !== item.id) {
        const dwellMs = now - prev.startMs;
        if (dwellMs >= NEWS_MIN_DWELL_MS) {
          void recordDwellEngagement(storageScope, prev.article, dwellMs);
        }
        reelTurnsRef.current += 1;
        if (reelTurnsRef.current >= nextInjectAfterRef.current) {
          reelTurnsRef.current = 0;
          nextInjectAfterRef.current = 3 + Math.floor(Math.random() * 2);
          void tryInject(item);
        }
      }

      visibleRef.current = {
        article: item,
        index: idx,
        startMs: now,
      };
    },
    [storageScope, onVisibleIndexChange, markSeen, tryInject]
  );

  return { onViewableItemsChanged, onArticleLiked };
}
