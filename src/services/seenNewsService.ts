import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NewsArticle } from "./newsService";

/**
 * Lightweight "already seen" tracker for news articles, kept in AsyncStorage so
 * the feed can skip stories the user has already scrolled past. We key by URL
 * (falls back to id) which is stable across Supabase re-ingests.
 */

const KEY_PREFIX = "SEEN_NEWS_V1__";
const MAX_ENTRIES = 1500;
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

function storageKey(scope: string): string {
  return `${KEY_PREFIX}${scope}`;
}

export function articleSeenKey(a: Pick<NewsArticle, "id" | "link">): string {
  const link = a.link?.trim();
  if (link) return link;
  return a.id;
}

interface ScopeCache {
  scope: string;
  map: Map<string, number>;
  dirty: boolean;
  flushTimer: ReturnType<typeof setTimeout> | null;
}

let cache: ScopeCache | null = null;

async function loadMap(scope: string): Promise<Map<string, number>> {
  if (cache && cache.scope === scope) return cache.map;

  const map = new Map<string, number>();
  try {
    const raw = await AsyncStorage.getItem(storageKey(scope));
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, number>;
      const now = Date.now();
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "number" && now - v < TTL_MS) {
          map.set(k, v);
        }
      }
    }
  } catch {}

  cache = { scope, map, dirty: false, flushTimer: null };
  return map;
}

async function persist(scope: string): Promise<void> {
  if (!cache || cache.scope !== scope) return;
  cache.dirty = false;

  let map = cache.map;
  if (map.size > MAX_ENTRIES) {
    const trimmed = [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_ENTRIES);
    map = new Map(trimmed);
    cache.map = map;
  }

  const obj: Record<string, number> = {};
  for (const [k, v] of map.entries()) obj[k] = v;

  try {
    await AsyncStorage.setItem(storageKey(scope), JSON.stringify(obj));
  } catch {}
}

function scheduleFlush(scope: string): void {
  if (!cache || cache.scope !== scope) return;
  cache.dirty = true;
  if (cache.flushTimer) return;
  cache.flushTimer = setTimeout(() => {
    if (cache && cache.scope === scope) {
      cache.flushTimer = null;
      if (cache.dirty) void persist(scope);
    }
  }, 600);
}

export async function getSeenKeys(scope: string): Promise<Set<string>> {
  const map = await loadMap(scope);
  return new Set(map.keys());
}

export async function markNewsSeen(
  scope: string,
  article: Pick<NewsArticle, "id" | "link">
): Promise<void> {
  const map = await loadMap(scope);
  map.set(articleSeenKey(article), Date.now());
  scheduleFlush(scope);
}

export async function markNewsSeenBulk(
  scope: string,
  articles: Pick<NewsArticle, "id" | "link">[]
): Promise<void> {
  if (articles.length === 0) return;
  const map = await loadMap(scope);
  const now = Date.now();
  for (const a of articles) {
    map.set(articleSeenKey(a), now);
  }
  scheduleFlush(scope);
}

/**
 * Filter out articles the user has already viewed. If every article has been
 * seen we return the input unchanged — better to show a repeat than an empty
 * screen.
 */
export async function filterUnseen<T extends Pick<NewsArticle, "id" | "link">>(
  scope: string,
  articles: T[]
): Promise<T[]> {
  if (articles.length === 0) return articles;
  const seen = await getSeenKeys(scope);
  if (seen.size === 0) return articles;
  const fresh = articles.filter((a) => !seen.has(articleSeenKey(a)));
  return fresh.length === 0 ? articles : fresh;
}
