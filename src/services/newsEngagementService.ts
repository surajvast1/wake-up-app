/**
 * Lightweight on-device news taste model: combines **dwell time** on reels
 * (user pauses ≥ `MIN_DWELL_MS` on a card before swiping) with **likes**
 * to bias keyword / category weights. Downstream we synthesize a seed article
 * and call `fetchSimilarArticles` to pull one matching story after every
 * N reel turns (see `useNewsReelEngagement`).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NewsArticle, TopicNewsCategory } from "./newsService";
import {
  fetchSimilarArticles,
  topicTabToDbCategory,
} from "./newsService";

const STORAGE_PREFIX = "NEWS_ENGAGEMENT_V1__";

const PROFILE_VERSION = 1;

/** Must pause at least this long before a swipe counts as "interested". */
export const NEWS_MIN_DWELL_MS = 4_000;

const MAX_KEYWORD_TERMS = 80;
const MAX_KEYWORD_LEN = 42;

export interface EngagementProfile {
  v: number;
  /** Raw `news_articles.category` string → weight */
  categoryWeight: Record<string, number>;
  keywordWeight: Record<string, number>;
  dwellEvents: number;
  likeEvents: number;
  updatedAt: number;
}

function storageKey(scope: string): string {
  return `${STORAGE_PREFIX}${scope}`;
}

function normalizeKeyword(k: string): string | null {
  const s = String(k).toLowerCase().trim();
  if (s.length < 2 || s.length > MAX_KEYWORD_LEN) return null;
  return s;
}

function defaultProfile(): EngagementProfile {
  return {
    v: PROFILE_VERSION,
    categoryWeight: {},
    keywordWeight: {},
    dwellEvents: 0,
    likeEvents: 0,
    updatedAt: 0,
  };
}

export async function loadEngagementProfile(
  scope: string
): Promise<EngagementProfile> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(scope));
    if (!raw) return defaultProfile();
    const p = JSON.parse(raw) as Partial<EngagementProfile>;
    if (!p || p.v !== PROFILE_VERSION) return defaultProfile();
    return {
      v: PROFILE_VERSION,
      categoryWeight:
        p.categoryWeight && typeof p.categoryWeight === "object"
          ? (p.categoryWeight as Record<string, number>)
          : {},
      keywordWeight:
        p.keywordWeight && typeof p.keywordWeight === "object"
          ? (p.keywordWeight as Record<string, number>)
          : {},
      dwellEvents: typeof p.dwellEvents === "number" ? p.dwellEvents : 0,
      likeEvents: typeof p.likeEvents === "number" ? p.likeEvents : 0,
      updatedAt: typeof p.updatedAt === "number" ? p.updatedAt : 0,
    };
  } catch {
    return defaultProfile();
  }
}

async function saveProfile(scope: string, p: EngagementProfile): Promise<void> {
  p.updatedAt = Date.now();
  try {
    await AsyncStorage.setItem(storageKey(scope), JSON.stringify(p));
  } catch {
    /* non-fatal */
  }
}

function capMap(
  m: Record<string, number>,
  maxKeys: number,
  maxVal = 120
): Record<string, number> {
  const entries = Object.entries(m)
    .filter(([, v]) => v > 0 && Number.isFinite(v))
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeys);
  const out: Record<string, number> = {};
  for (const [k, v] of entries) {
    out[k] = Math.min(maxVal, v);
  }
  return out;
}

/**
 * User spent at least `NEWS_MIN_DWELL_MS` on this card before moving on.
 */
export async function recordDwellEngagement(
  scope: string,
  article: NewsArticle,
  dwellMs: number
): Promise<void> {
  if (dwellMs < NEWS_MIN_DWELL_MS) return;
  const p = await loadEngagementProfile(scope);
  p.dwellEvents += 1;
  const cat = String(article.category ?? "").toLowerCase().trim();
  if (cat) {
    p.categoryWeight[cat] = (p.categoryWeight[cat] ?? 0) + 1.2;
  }
  const kws = (article.keywords ?? [])
    .map((k) => normalizeKeyword(String(k)))
    .filter((x): x is string => !!x);
  for (const k of kws.slice(0, 12)) {
    p.keywordWeight[k] = (p.keywordWeight[k] ?? 0) + 0.8;
  }
  p.categoryWeight = capMap(p.categoryWeight, 24);
  p.keywordWeight = capMap(p.keywordWeight, MAX_KEYWORD_TERMS);
  await saveProfile(scope, p);
}

/** Stronger signal than dwell — also invoked from the like handler. */
export async function recordLikeEngagement(
  scope: string,
  article: NewsArticle
): Promise<void> {
  const p = await loadEngagementProfile(scope);
  p.likeEvents += 1;
  const cat = String(article.category ?? "").toLowerCase().trim();
  if (cat) {
    p.categoryWeight[cat] = (p.categoryWeight[cat] ?? 0) + 6;
  }
  const kws = (article.keywords ?? [])
    .map((k) => normalizeKeyword(String(k)))
    .filter((x): x is string => !!x);
  for (const k of kws.slice(0, 14)) {
    p.keywordWeight[k] = (p.keywordWeight[k] ?? 0) + 3;
  }
  p.categoryWeight = capMap(p.categoryWeight, 24);
  p.keywordWeight = capMap(p.keywordWeight, MAX_KEYWORD_TERMS);
  await saveProfile(scope, p);
}

/** Enough data to personalize inserts without spamming random noise. */
export function engagementProfileReady(p: EngagementProfile): boolean {
  if (p.likeEvents >= 1) return true;
  if (p.dwellEvents >= 2) return true;
  const kwSum = Object.values(p.keywordWeight).reduce((a, b) => a + b, 0);
  const catSum = Object.values(p.categoryWeight).reduce((a, b) => a + b, 0);
  return kwSum >= 4 || catSum >= 5;
}

function topKeywords(p: EngagementProfile, n: number): string[] {
  return Object.entries(p.keywordWeight)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

function topDbCategory(p: EngagementProfile): string | null {
  const e = Object.entries(p.categoryWeight).sort((a, b) => b[1] - a[1])[0];
  return e?.[0] ?? null;
}

/**
 * Synthetic article so `fetchSimilarArticles` can run purely from profile.
 */
export function buildEngagementSeedArticle(
  p: EngagementProfile,
  tabFallback: TopicNewsCategory
): NewsArticle {
  const catRaw = topDbCategory(p) ?? topicTabToDbCategory(tabFallback);
  const keywords = topKeywords(p, 10);

  return {
    id: `engagement-seed-${p.updatedAt}`,
    title: "",
    description: "",
    link: "engagement://seed",
    imageUrl: null,
    source: "",
    publishedAt: new Date().toISOString(),
    category: catRaw,
    keywords: keywords.length > 0 ? keywords : undefined,
  };
}

/**
 * Pull articles matching the learned profile, excluding anything already
 * on-screen.
 */
export async function fetchPersonalizedReelInject(
  scope: string,
  tabFallback: TopicNewsCategory,
  excludeIds: Set<string>,
  excludeLinks?: Set<string>
): Promise<NewsArticle[]> {
  const p = await loadEngagementProfile(scope);
  if (!engagementProfileReady(p)) return [];
  const seed = buildEngagementSeedArticle(p, tabFallback);
  const links = excludeLinks ?? new Set<string>();
  return fetchSimilarArticles(seed, {
    limit: 4,
    excludeIds,
    excludeLinks: links,
  });
}
