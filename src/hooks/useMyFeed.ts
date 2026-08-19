import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadMoreMyFeedArticles,
  loadMyFeedArticles,
} from "../services/myFeedService";
import type { NewsArticle } from "../services/newsService";

interface UseMyFeedResult {
  articles: NewsArticle[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  insertAfter: (afterId: string, extra: NewsArticle[]) => void;
}

const useMyFeed = (
  storageScope: string,
  supabaseUserId: string | null
): UseMyFeedResult => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const inflightRef = useRef(false);
  const cacheRef = useRef<NewsArticle[] | null>(null);
  const scopeKey = `${storageScope}|${supabaseUserId ?? ""}`;

  const load = useCallback(
    async (force = false) => {
      if (inflightRef.current) return;
      inflightRef.current = true;
      setError(null);
      setIsLoading(true);

      try {
        if (!force && cacheRef.current && cacheRef.current.length > 0) {
          setArticles(cacheRef.current);
          setIsLoading(false);
          inflightRef.current = false;
          return;
        }

        const fresh = await loadMyFeedArticles(storageScope, supabaseUserId, {
          limit: 40,
        });
        cacheRef.current = fresh;
        setArticles(fresh);
        setHasMore(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load feed");
      } finally {
        setIsLoading(false);
        inflightRef.current = false;
      }
    },
    [storageScope, supabaseUserId]
  );

  const loadMore = useCallback(async () => {
    if (inflightRef.current) return;
    if (!hasMore) return;
    if (isLoading) return;
    inflightRef.current = true;
    setIsLoadingMore(true);
    try {
      const current = cacheRef.current ?? [];
      const shownIds = new Set(current.map((a) => a.id));
      const more = await loadMoreMyFeedArticles(
        storageScope,
        supabaseUserId,
        shownIds,
        { limit: 20 }
      );
      if (more.length === 0) {
        setHasMore(false);
      } else {
        const next = [...current, ...more];
        cacheRef.current = next;
        setArticles(next);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load more");
    } finally {
      setIsLoadingMore(false);
      inflightRef.current = false;
    }
  }, [storageScope, supabaseUserId, hasMore, isLoading]);

  useEffect(() => {
    cacheRef.current = null;
    setHasMore(true);
    void load();
  }, [load, scopeKey]);

  const refresh = useCallback(() => load(true), [load]);

  const insertAfter = useCallback(
    (afterId: string, extra: NewsArticle[]) => {
      if (!extra || extra.length === 0) return;
      const current = cacheRef.current ?? [];
      const idx = current.findIndex((a) => a.id === afterId);
      if (idx < 0) return;
      const existing = new Set(current.map((a) => a.id));
      const fresh = extra.filter((a) => !existing.has(a.id));
      if (fresh.length === 0) return;
      const next = [
        ...current.slice(0, idx + 1),
        ...fresh,
        ...current.slice(idx + 1),
      ];
      cacheRef.current = next;
      setArticles(next);
    },
    []
  );

  return {
    articles,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    refresh,
    loadMore,
    insertAfter,
  };
};

export default useMyFeed;
