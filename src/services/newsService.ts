import { supabase, supabaseConfigured } from "../lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Base URL of the deployed cron app (Vercel), without trailing slash.
 * Example: `https://your-project.vercel.app`
 *
 * When set, all news reads go through `GET /api/preview-news` (server uses
 * service_role) instead of Supabase anon — use this if `news_articles` RLS
 * no longer allows public SELECT or you prefer not to expose the table to
 * clients. No `DASHBOARD_PREVIEW_KEY` or other auth header is required.
 */
const NEWS_API_BASE =
  process.env.EXPO_PUBLIC_NEWS_API_BASE?.trim().replace(/\/$/, "") ?? "";

export function newsApiConfigured(): boolean {
  return (
    NEWS_API_BASE.length > 0 &&
    !NEWS_API_BASE.startsWith("YOUR_") &&
    !NEWS_API_BASE.includes("placeholder")
  );
}

/** News can load from either Supabase (anon) or the cron preview HTTP API. */
function newsSourceReady(): boolean {
  return supabaseConfigured;
}

interface PreviewNewsResponse {
  ok?: boolean;
  articles?: unknown[];
  error?: string;
}

async function fetchPreviewNews(
  params: Record<string, string | undefined>
): Promise<NewsArticle[]> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") qs.set(k, v);
  }
  const url = `${NEWS_API_BASE}/api/preview-news?${qs.toString()}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  let body: PreviewNewsResponse = {};
  try {
    body = (await res.json()) as PreviewNewsResponse;
  } catch {
    body = {};
  }
  if (!res.ok) {
    const msg =
      typeof body.error === "string" && body.error
        ? body.error
        : `News API failed (${res.status})`;
    throw new Error(msg);
  }
  const rows = Array.isArray(body.articles) ? body.articles : [];
  return filterArticlesBySources(rows.map((r) => mapRow(r)));
}

/* ═══════════════════════ Types ═══════════════════════ */

export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  link: string;
  imageUrl: string | null;
  source: string;
  publishedAt: string;
  category?: string;
  /** AI / cron — overlap with user interests for “my feed” */
  keywords?: string[];
}

/** Horizontal tabs: personalized first, then regions/topics. */
export type NewsCategory =
  | "India"
  | "Entertaining"
  | "Tech"
  | "Science"
  | "Global";

export type TopicNewsCategory = NewsCategory;

export const NEWS_CATEGORIES: NewsCategory[] = [
  "India",
  "Entertaining",
  "Tech",
  "Science",
  "Global",
];

const CATEGORY_DB_MAP: Record<TopicNewsCategory, string> = {
  India: "india",
  Entertaining: "entertaining",
  Tech: "tech",
  Science: "science",
  Global: "global",
};

export function topicTabToDbCategory(tab: TopicNewsCategory): string {
  return CATEGORY_DB_MAP[tab] ?? "india";
}

/** Categories pulled when building a mixed digest (e.g. my feed fallback). */
export const MY_FEED_DIGEST_CATEGORIES: TopicNewsCategory[] = [
  "India",
  "Entertaining",
  "Tech",
  "Science",
  "Global",
];

export function isTopicNewsCategory(c: NewsCategory): c is TopicNewsCategory {
  return true;
}

export const NEWS_SOURCE_OPTIONS = [
  "Hindustan Times",
  "The Hindu",
  "The Indian Express",
  "NDTV",
  "BBC News",
  "Reuters",
] as const;
export const DEFAULT_NEWS_SOURCES = [
  "Hindustan Times",
  "The Hindu",
  "The Indian Express",
  "NDTV",
  "BBC News",
];
export const NEWS_SOURCES_STORAGE_KEY = "NEWS_SOURCES_V2";

export async function loadNewsSources(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(NEWS_SOURCES_STORAGE_KEY);
    if (!raw) return [...DEFAULT_NEWS_SOURCES];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const sources = parsed.filter((value): value is string => typeof value === "string");
      if (sources.length > 0) return sources;
    }
  } catch {}
  return [...DEFAULT_NEWS_SOURCES];
}

export async function fetchAvailableNewsSources(): Promise<string[]> {
  if (!supabaseConfigured) return [...NEWS_SOURCE_OPTIONS];
  const { data, error } = await supabase
    .from("news_articles")
    .select("source")
    .not("source", "is", null)
    .limit(200);
  if (error) return [...NEWS_SOURCE_OPTIONS];
  const fromTable = (data ?? [])
    .map((row) => String((row as { source?: unknown }).source ?? "").trim())
    .filter(Boolean);
  return [...new Set([...NEWS_SOURCE_OPTIONS, ...fromTable])];
}

export async function fetchAvailableNewsCategories(): Promise<TopicNewsCategory[]> {
  if (!supabaseConfigured) return NEWS_CATEGORIES.filter(isTopicNewsCategory);
  const { data, error } = await supabase
    .from("news_articles")
    .select("category")
    .not("category", "is", null)
    .limit(200);
  if (error) return NEWS_CATEGORIES.filter(isTopicNewsCategory);
  const found = new Set<TopicNewsCategory>();
  for (const row of data ?? []) {
    const tab = dbCategoryToTabCategory(String((row as { category?: unknown }).category ?? ""));
    if (tab) found.add(tab);
  }
  const preferredOrder: TopicNewsCategory[] = [
    "India",
    "Entertaining",
    "Tech",
    "Science",
    "Global",
  ];
  const available = preferredOrder.filter((category) => found.has(category));
  return available.length > 0 ? available : NEWS_CATEGORIES.filter(isTopicNewsCategory);
}

async function filterArticlesBySources(articles: NewsArticle[]): Promise<NewsArticle[]> {
  const enabled = await loadNewsSources();
  const aliases: Record<string, string[]> = {
    "hindustan times": ["hindustantimes", "hindustan"],
    "the hindu": ["thehindu", "hindu"],
    "the indian express": ["theindianexpress", "indianexpress"],
    "bbc news": ["bbc", "bbcnews"],
    ndtv: ["ndtv"],
    reuters: ["reuters"],
  };
  return articles.filter((article) =>
    enabled.some((source) => {
      const publisher = article.source.toLowerCase().replace(/[^a-z0-9]/g, "");
      const selected = source.toLowerCase();
      const names = aliases[selected] ?? [selected.replace(/[^a-z0-9]/g, "")];
      return names.some((name) => publisher.includes(name));
    })
  );
}

/** Map Supabase `news_articles.category` to a topic tab (not “My Feed”). */
export function dbCategoryToTabCategory(db: string): TopicNewsCategory | null {
  const x = String(db).toLowerCase().trim();
  if (x === "india") return "India";
  if (x === "tech") return "Tech";
  if (x === "science") return "Science";
  if (x === "global") return "Global";
  if (x === "entertaining" || x === "business") return "Entertaining";
  return null;
}

/** Short label for search / cards (legacy `business` → Entertaining). */
export function displayCategoryLabel(dbCategory?: string): string {
  if (!dbCategory) return "";
  const tab = dbCategoryToTabCategory(dbCategory);
  if (tab) return tab;
  return dbCategory;
}

/**
 * Topic tab index for a Supabase `category` value (India, Tech, …).
 * Do **not** use for deep links from **My Feed** teasers — those articles are
 * only guaranteed in the "My Feed" tab (index 0); use that index instead.
 * Falls back to India when category is missing or unknown.
 */
export function initialNewsTabIndexForArticle(dbCategory?: string | null): number {
  const tab = dbCategory ? dbCategoryToTabCategory(dbCategory) : null;
  if (tab) {
    const i = NEWS_CATEGORIES.indexOf(tab);
    if (i >= 0) return i;
  }
  return NEWS_CATEGORIES.indexOf("India");
}

/** Cron keeps ~24h of rows; query slightly wider so UI never misses a bucket */
const NEWS_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

/* ═══════════════════════ Date Helpers ═══════════════════════ */

export const getOrdinalSuffix = (n: number): string => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
};

export const timeAgo = (dateStr: string): string => {
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  if (diffMs < 0) return "just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

export const formatNewsDate = (dateStr: string): string => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const day = d.getDate();
  const suffix = getOrdinalSuffix(day);
  const month = d.toLocaleString("default", { month: "short" });
  const hours = d.getHours();
  const mins = d.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 || 12;
  const minStr = mins < 10 ? `0${mins}` : `${mins}`;
  return `${day}${suffix} ${month}, ${h12}:${minStr} ${ampm}`;
};

/* ═══════════════════════ Supabase Queries ═══════════════════════ */

function cleanNewsDescription(value: unknown): string {
  const text = String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";

  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text];
  return sentences
    .filter((sentence) => {
      const lower = sentence.toLowerCase();
      return ![
        "download toi app",
        "download the toi app",
        "download our app",
        "subscribe to",
        "follow us on",
        "click here",
        "advertisement",
        "sponsored",
      ].some((phrase) => lower.includes(phrase));
    })
    .join(" ")
    .trim();
}

function mapRow(row: any): NewsArticle {
  return {
    id: String(row.id ?? row.link ?? "").trim() || row.link,
    title: row.title,
    description: cleanNewsDescription(row.description),
    link: row.link,
    imageUrl: upgradeNewsImageUrl(row.image_url),
    source: row.source,
    publishedAt: row.published_at || row.created_at || "",
    category: row.category,
    keywords: Array.isArray(row.keywords) ? row.keywords : undefined,
  };
}

function sortArticlesNewestFirst(list: NewsArticle[]): NewsArticle[] {
  return [...list].sort((a, b) => {
    const ta = new Date(a.publishedAt).getTime();
    const tb = new Date(b.publishedAt).getTime();
    const na = Number.isNaN(ta) ? 0 : ta;
    const nb = Number.isNaN(tb) ? 0 : tb;
    return nb - na;
  });
}

export const NEWS_PAGE_SIZE = 20;

export interface NewsPage {
  articles: NewsArticle[];
  hasMore: boolean;
}

export async function fetchNewsByCategory(
  category: TopicNewsCategory,
  options?: { offset?: number; limit?: number }
): Promise<NewsPage> {
  if (!newsSourceReady()) return { articles: [], hasMore: false };

  const offset = Math.max(0, options?.offset ?? 0);
  const limit = options?.limit ?? NEWS_PAGE_SIZE;
  const dbCategory = CATEGORY_DB_MAP[category];
  const since = new Date(Date.now() - NEWS_LOOKBACK_MS).toISOString();

  if (newsApiConfigured() && !supabaseConfigured) {
    try {
      const fetchCount = limit + 1;
      const rows = await fetchPreviewNews({
        category: dbCategory,
        offset: String(offset),
        limit: String(fetchCount),
        since,
      });
      const hasMore = rows.length > limit;
      const articles = hasMore ? rows.slice(0, limit) : rows;
      return { articles, hasMore };
    } catch (e) {
      console.error("fetchNewsByCategory (HTTP) error:", e);
      return { articles: [], hasMore: false };
    }
  }

  let q = supabase
    .from("news_articles")
    .select("*")
    .gte("created_at", since)
    .order("feed_order", { ascending: true })
    .order("published_at", { ascending: false })
    .range(offset, offset + limit); // +1 to detect hasMore

  if (category === "Entertaining") {
    q = q.in("category", ["entertaining", "business"]);
  } else {
    q = q.eq("category", dbCategory);
  }

  const { data, error } = await q;

  if (error) {
    console.error("fetchNewsByCategory error:", error.message);
    return { articles: [], hasMore: false };
  }

  const rows = await filterArticlesBySources((data || []).map(mapRow));
  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();
  return { articles: rows, hasMore };
}

/** A few fresh items per vertical — used to pad “My feed” when keyword matches are thin. */
export async function fetchMixedDigestArticles(
  perCategory = 2
): Promise<NewsArticle[]> {
  const parts = await Promise.all(
    MY_FEED_DIGEST_CATEGORIES.map((c) =>
      fetchNewsByCategory(c, { limit: Math.max(perCategory, 4) }).then((r) =>
        r.articles.slice(0, perCategory)
      )
    )
  );
  const flat = parts.flat();
  const byId = new Map<string, NewsArticle>();
  for (const a of flat) {
    if (!byId.has(a.id)) byId.set(a.id, a);
  }
  return sortArticlesNewestFirst([...byId.values()]);
}

export async function searchAllCategories(
  query: string
): Promise<NewsArticle[]> {
  if (!newsSourceReady()) return [];
  const q = query.trim();
  if (!q) return [];

  const since = new Date(Date.now() - NEWS_LOOKBACK_MS).toISOString();

  if (newsApiConfigured() && !supabaseConfigured) {
    try {
      return await fetchPreviewNews({
        search: q,
        limit: "40",
        since,
      });
    } catch (e) {
      console.error("searchAllCategories (HTTP) error:", e);
      return [];
    }
  }

  const { data, error } = await supabase
    .from("news_articles")
    .select("*")
    .gte("created_at", since)
    .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
    .order("feed_order", { ascending: true })
    .order("published_at", { ascending: false })
    .limit(40);

  if (error) {
    console.error("searchAllCategories error:", error.message);
    return [];
  }

  return (data || []).map(mapRow);
}

/** “My feed”: rows whose `keywords` overlap user interest terms (from likes / saved topics). */
export async function fetchArticlesMatchingKeywords(
  terms: string[],
  limit = 30
): Promise<NewsArticle[]> {
  if (!newsSourceReady()) return [];
  const normalized = [
    ...new Set(
      terms
        .map((t) => String(t).toLowerCase().trim())
        .filter((t) => t.length > 1 && t.length < 48)
    ),
  ].slice(0, 24);
  if (normalized.length === 0) return [];

  const since = new Date(Date.now() - NEWS_LOOKBACK_MS).toISOString();

  if (newsApiConfigured() && !supabaseConfigured) {
    try {
      return await fetchPreviewNews({
        keywords: normalized.join(","),
        limit: String(Math.min(200, Math.max(1, limit))),
        since,
      });
    } catch (e) {
      console.error("fetchArticlesMatchingKeywords (HTTP) error:", e);
      return [];
    }
  }

  const { data, error } = await supabase
    .from("news_articles")
    .select("*")
    .gte("created_at", since)
    .overlaps("keywords", normalized)
    .order("feed_order", { ascending: true })
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("fetchArticlesMatchingKeywords error:", error.message);
    return [];
  }

  return (data || []).map(mapRow);
}

/* ═══════════════════════ Rotation helpers ═══════════════════════ */

/**
 * App-launch seed (changes every process start). Used to vary the home card and
 * drawer teasers so the user sees different stories each time they open the app.
 */
export const APP_SESSION_SEED = Date.now() ^ Math.floor(Math.random() * 1e9);

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded shuffle, used to rotate a small pool of articles deterministically per seed. */
export function seededShuffle<T>(items: T[], seed = APP_SESSION_SEED): T[] {
  const arr = [...items];
  const rng = mulberry32(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Pick `count` items from the top of a pool, shuffled with the session seed. */
export function rotatePicks<T>(
  items: T[],
  count: number,
  seed = APP_SESSION_SEED,
  pool = Math.max(6, count * 3)
): T[] {
  if (items.length <= count) return items.slice(0, count);
  const head = items.slice(0, Math.min(pool, items.length));
  return seededShuffle(head, seed).slice(0, count);
}

/* ═══════════════════════ Breaking / urgent detection ═══════════════════════ */

/**
 * App-side breaking classifier. We look for urgency signals in the TITLE
 * (more reliable than body). Also bonus for very-recent items.
 *
 * This is deliberately loose so we never miss real breaking news — when we
 * can't decide, we return 0 and normal sort applies.
 */
const URGENT_TITLE_PATTERNS: RegExp[] = [
  /\bbreaking\b/i,
  /\burgent\b/i,
  /\bjust in\b/i,
  /\blive\b/i,
  /\bwar\b/i,
  /\battack(?:s|ed|ing)?\b/i,
  /\bstrike(?:s|d)?\b/i,
  /\bmissile(?:s)?\b/i,
  /\bexplosion(?:s)?\b/i,
  /\bblast(?:s)?\b/i,
  /\bterror(?:ism|ist)?\b/i,
  /\bkilled\b/i,
  /\bdead\b/i,
  /\bdies\b/i,
  /\bshooting\b/i,
  /\bearthquake\b/i,
  /\btsunami\b/i,
  /\bcyclone\b/i,
  /\bflood(?:s|ing)?\b/i,
  /\bemergency\b/i,
  /\bevacuat(?:e|ion|ed)\b/i,
  /\bhostage(?:s)?\b/i,
  /\bmartial law\b/i,
  /\bcoup\b/i,
  /\bcrash(?:es|ed)?\b/i,
  /\bfire\b/i,
  /\bresign(?:s|ed|ation)\b/i,
];

export function urgencyScore(article: NewsArticle): number {
  const t = article.title || "";
  let s = 0;
  for (const re of URGENT_TITLE_PATTERNS) {
    if (re.test(t)) s += 1;
  }
  const pubMs = new Date(article.publishedAt).getTime();
  if (!Number.isNaN(pubMs)) {
    const ageHr = (Date.now() - pubMs) / 3_600_000;
    if (ageHr < 1) s += 2;
    else if (ageHr < 3) s += 1;
    else if (ageHr < 6) s += 0.5;
  }
  return s;
}

export function isBreakingArticle(article: NewsArticle): boolean {
  return urgencyScore(article) >= 2;
}

/**
 * Pull the most urgent items across every category. The cron already keeps
 * 30h of history — the urgency score handles staleness.
 */
export async function fetchBreakingArticles(limit = 12): Promise<NewsArticle[]> {
  if (!newsSourceReady()) return [];
  const since = new Date(Date.now() - NEWS_LOOKBACK_MS).toISOString();

  let rows: NewsArticle[];
  if (newsApiConfigured() && !supabaseConfigured) {
    try {
      rows = await fetchPreviewNews({ limit: "120", since });
    } catch (e) {
      console.error("fetchBreakingArticles (HTTP) error:", e);
      return [];
    }
  } else {
    const { data, error } = await supabase
      .from("news_articles")
      .select("*")
      .gte("created_at", since)
      .order("published_at", { ascending: false })
      .limit(120);

    if (error) {
      console.error("fetchBreakingArticles error:", error.message);
      return [];
    }

    rows = (data || []).map(mapRow);
  }
  const scored = rows
    .map((a) => ({ a, s: urgencyScore(a) }))
    .filter((x) => x.s >= 2)
    .sort((x, y) => y.s - x.s || new Date(y.a.publishedAt).getTime() - new Date(x.a.publishedAt).getTime())
    .map((x) => x.a);

  const seen = new Set<string>();
  const out: NewsArticle[] = [];
  for (const a of scored) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    out.push(a);
    if (out.length >= limit) break;
  }
  return out;
}

/* ═══════════════════════ Similar-articles-by-article ═══════════════════════ */

/**
 * Find articles similar to `article` by keyword overlap. Uses the article's
 * Supabase `keywords` array (populated by the cron via AI). Excludes the
 * source article itself and anything in `excludeIds` / `excludeLinks`.
 */
export async function fetchSimilarArticles(
  article: NewsArticle,
  options?: {
    limit?: number;
    excludeIds?: Set<string>;
    excludeLinks?: Set<string>;
  }
): Promise<NewsArticle[]> {
  const limit = options?.limit ?? 6;
  const excludeIds = options?.excludeIds ?? new Set<string>();
  const excludeLinks = options?.excludeLinks ?? new Set<string>();

  const keywords = (article.keywords || [])
    .map((k) => String(k).toLowerCase().trim())
    .filter((k) => k.length > 1 && k.length < 48);

  if (keywords.length === 0) {
    const { articles } = await fetchNewsByCategory(
      (dbCategoryToTabCategory(article.category || "") || "India") as TopicNewsCategory,
      { limit: limit * 3 }
    );
    return articles
      .filter((a) => a.id !== article.id)
      .filter((a) => !excludeIds.has(a.id))
      .filter((a) => !excludeLinks.has(a.link.trim()))
      .slice(0, limit);
  }

  const matched = await fetchArticlesMatchingKeywords(keywords, limit * 4);

  const scoreFor = (a: NewsArticle): number => {
    if (!Array.isArray(a.keywords)) return 0;
    const hits = a.keywords.filter((k) =>
      keywords.includes(String(k).toLowerCase().trim())
    ).length;
    return hits;
  };

  const result = matched
    .filter((a) => a.id !== article.id)
    .filter((a) => !excludeIds.has(a.id))
    .filter((a) => !excludeLinks.has(a.link.trim()))
    .map((a) => ({ a, s: scoreFor(a) }))
    .sort(
      (x, y) =>
        y.s - x.s ||
        new Date(y.a.publishedAt).getTime() - new Date(x.a.publishedAt).getTime()
    )
    .map((x) => x.a);

  return result.slice(0, limit);
}

/** Lookup a single article by its canonical link (deep-link from home card / drawer). */
export async function fetchArticleByLink(
  link: string
): Promise<NewsArticle | null> {
  if (!newsSourceReady()) return null;
  const l = link?.trim();
  if (!l) return null;

  if (newsApiConfigured() && !supabaseConfigured) {
    try {
      const rows = await fetchPreviewNews({ link: l });
      return rows[0] ?? null;
    } catch (e) {
      console.error("fetchArticleByLink (HTTP) error:", e);
      return null;
    }
  }

  const { data, error } = await supabase
    .from("news_articles")
    .select("*")
    .eq("link", l)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("fetchArticleByLink error:", error.message);
    return null;
  }
  return data ? mapRow(data) : null;
}

/* ═══════════════════════ Image URL upgrader ═══════════════════════ */

/**
 * Rewrite common CDN URLs to request larger versions so the hero images in
 * the feed / home card never look pixelated. Conservative — only touches
 * patterns we recognise; unknown URLs are returned untouched.
 */
export function upgradeNewsImageUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  let url = String(input).trim();
  if (!url.startsWith("http")) return url || null;

  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();

    if (host.includes("ndtv") || host.includes("ndtvimg")) {
      url = url.replace(/-\d{2,3}x\d{2,3}\./, "-1280x720.");
      u.searchParams.set("w", "1200");
      return u.toString();
    }

    if (host.includes("hindustantimes") || host.includes("htmedia")) {
      u.searchParams.set("w", "1200");
      u.searchParams.set("q", "85");
      return u.toString();
    }

    if (host.includes("indianexpress") || host.includes("ieimg")) {
      url = url.replace(/resize=\d+[,x]\d+/, "resize=1200,675");
      return url;
    }

    if (host.includes("thehindu") || host.includes("bloncampus")) {
      url = url.replace(/\/article\d+\.ece\/[^/]+\//, "/article.ece/alternates/LANDSCAPE_1200/");
      return url;
    }

    if (host.includes("toi") || host.includes("timesofindia")) {
      url = url.replace(/-\d{2,3},\d{2,3},\d{2,3},\d{2,3}\./, ".");
      u.searchParams.set("w", "1200");
      return u.toString();
    }

    if (host.includes("guim.co.uk") || host.includes("guardian")) {
      url = url.replace(/\/\d{2,4}\.(jpg|jpeg|png|webp)/i, "/1200.$1");
      url = url.replace(/width=\d+/, "width=1200");
      u.searchParams.set("width", "1200");
      u.searchParams.set("quality", "85");
      return u.toString();
    }

    if (host.includes("variety") || host.includes("wordpress")) {
      u.searchParams.set("w", "1200");
      u.searchParams.set("quality", "85");
      return u.toString();
    }

    if (host.includes("bollywoodhungama")) {
      u.searchParams.set("w", "1200");
      return u.toString();
    }

    if (host.includes("ign.com") || host.includes("ignimgs.com")) {
      u.searchParams.set("width", "1280");
      return u.toString();
    }

    if (host.includes("natgeo") || host.includes("nationalgeographic")) {
      u.searchParams.set("w", "1200");
      return u.toString();
    }

    if (u.searchParams.has("w")) {
      const w = parseInt(u.searchParams.get("w") || "0", 10);
      if (w > 0 && w < 800) {
        u.searchParams.set("w", "1200");
        return u.toString();
      }
    }
    if (u.searchParams.has("width")) {
      const w = parseInt(u.searchParams.get("width") || "0", 10);
      if (w > 0 && w < 800) {
        u.searchParams.set("width", "1200");
        return u.toString();
      }
    }

    return url;
  } catch {
    return url;
  }
}
