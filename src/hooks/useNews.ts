import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchNewsByCategory,
  NewsArticle,
  NEWS_PAGE_SIZE,
  TopicNewsCategory,
} from "../services/newsService";
import { filterUnseen } from "../services/seenNewsService";

interface UseNewsResult {
  articles: NewsArticle[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  /** Splice `extra` into the article list right after the item with id
   *  `afterId`. Duplicates (by id) are dropped. */
  insertAfter: (afterId: string, extra: NewsArticle[]) => void;
}

const useNews = (
  category: TopicNewsCategory,
  storageScope: string
): UseNewsResult => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const inflightRef = useRef(false);
  const cacheRef = useRef<NewsArticle[] | null>(null);
  const cacheHasMoreRef = useRef(true);
  const offsetRef = useRef(0);

  const load = useCallback(
    async (force = false) => {
      if (inflightRef.current) return;
      inflightRef.current = true;
      setError(null);
      setIsLoading(true);

      try {
        if (!force && cacheRef.current && cacheRef.current.length > 0) {
          setArticles(cacheRef.current);
          setHasMore(cacheHasMoreRef.current);
          setIsLoading(false);
          inflightRef.current = false;
          return;
        }

        offsetRef.current = 0;
        const page = await fetchNewsByCategory(category, {
          offset: 0,
          limit: NEWS_PAGE_SIZE,
        });
        const filtered = await filterUnseen(storageScope, page.articles);
        cacheRef.current = filtered;
        cacheHasMoreRef.current = page.hasMore;
        offsetRef.current = page.articles.length;
        setArticles(filtered);
        setHasMore(page.hasMore);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load news");
      } finally {
        setIsLoading(false);
        inflightRef.current = false;
      }
    },
    [category, storageScope]
  );

  const loadMore = useCallback(async () => {
    if (inflightRef.current) return;
    if (!cacheHasMoreRef.current) return;
    if (isLoading) return;
    inflightRef.current = true;
    setIsLoadingMore(true);
    try {
      const page = await fetchNewsByCategory(category, {
        offset: offsetRef.current,
        limit: NEWS_PAGE_SIZE,
      });
      offsetRef.current += page.articles.length;

      const seenIds = new Set((cacheRef.current ?? []).map((a) => a.id));
      const fresh = page.articles.filter((a) => !seenIds.has(a.id));
      const filtered = await filterUnseen(storageScope, fresh);

      const next = [...(cacheRef.current ?? []), ...filtered];
      cacheRef.current = next;
      cacheHasMoreRef.current = page.hasMore;
      setArticles(next);
      setHasMore(page.hasMore);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load more");
    } finally {
      setIsLoadingMore(false);
      inflightRef.current = false;
    }
  }, [category, storageScope, isLoading]);

  useEffect(() => {
    cacheRef.current = null;
    cacheHasMoreRef.current = true;
    offsetRef.current = 0;
    load();
  }, [load]);

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

export default useNews;
