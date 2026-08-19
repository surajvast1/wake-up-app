import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { logSupabaseError } from "../lib/supabaseError";
import type { NewsArticle } from "./newsService";

const LOCAL_KEY_PREFIX = "LIKED_NEWS_V1__";

export interface LikedNewsStored {
  article_id: string;
  title: string;
  link: string;
  description: string;
  image_url: string | null;
  source: string;
  published_at: string;
  category?: string;
  content_hash: string;
}

function localKey(scope: string): string {
  return `${LOCAL_KEY_PREFIX}${scope}`;
}

export async function newsContentHash(article: NewsArticle): Promise<string> {
  const base =
    (article.link && article.link.trim()) ||
    `${article.id}|${article.title.trim()}`;
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, base);
}

function toStored(article: NewsArticle, hash: string): LikedNewsStored {
  return {
    article_id: article.id,
    title: article.title,
    link: article.link,
    description: article.description.slice(0, 4000),
    image_url: article.imageUrl,
    source: article.source,
    published_at: article.publishedAt,
    category: article.category,
    content_hash: hash,
  };
}

async function readLocal(scope: string): Promise<LikedNewsStored[]> {
  try {
    const raw = await AsyncStorage.getItem(localKey(scope));
    if (!raw) return [];
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return [];
    return p.filter(
      (x): x is LikedNewsStored =>
        x &&
        typeof x === "object" &&
        typeof (x as LikedNewsStored).content_hash === "string" &&
        typeof (x as LikedNewsStored).link === "string"
    ) as LikedNewsStored[];
  } catch {
    return [];
  }
}

async function writeLocal(scope: string, rows: LikedNewsStored[]): Promise<void> {
  await AsyncStorage.setItem(localKey(scope), JSON.stringify(rows));
}

export async function isNewsLiked(
  scope: string,
  article: NewsArticle,
  supabaseUserId: string | null | undefined
): Promise<boolean> {
  const h = await newsContentHash(article);
  const rows = await readLocal(scope);
  if (rows.some((r) => r.content_hash === h)) return true;
  if (!supabaseUserId || !supabaseConfigured) return false;
  const { data, error } = await supabase
    .from("liked_news")
    .select("id")
    .eq("user_id", supabaseUserId)
    .eq("content_hash", h)
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}

/** Returns true if liked after toggle. Supabase only when logged in (not guest). */
export async function toggleLikeNews(
  scope: string,
  article: NewsArticle,
  supabaseUserId: string | null | undefined
): Promise<boolean> {
  const hash = await newsContentHash(article);
  let rows = await readLocal(scope);
  const localIdx = rows.findIndex((r) => r.content_hash === hash);
  const inLocal = localIdx >= 0;

  let inRemote = false;
  if (supabaseUserId && supabaseConfigured) {
    const { data } = await supabase
      .from("liked_news")
      .select("id")
      .eq("user_id", supabaseUserId)
      .eq("content_hash", hash)
      .maybeSingle();
    inRemote = Boolean(data);
  }

  if (inLocal || inRemote) {
    if (inLocal) {
      rows = rows.filter((_, i) => i !== localIdx);
      await writeLocal(scope, rows);
    }
    if (inRemote && supabaseUserId && supabaseConfigured) {
      const { error } = await supabase
        .from("liked_news")
        .delete()
        .eq("user_id", supabaseUserId)
        .eq("content_hash", hash);
      logSupabaseError("liked_news.delete_toggle", error);
    }
    return false;
  }

  rows.push(toStored(article, hash));
  await writeLocal(scope, rows);

  if (supabaseUserId && supabaseConfigured) {
    const { error } = await supabase.from("liked_news").upsert(
      {
        user_id: supabaseUserId,
        content_hash: hash,
        article_id: article.id,
        title: article.title,
        link: article.link,
        description: article.description.slice(0, 8000),
        image_url: article.imageUrl,
        source: article.source,
        published_at: article.publishedAt,
        category: article.category ?? null,
      },
      { onConflict: "user_id,content_hash" }
    );
    if (error) {
      console.warn("liked_news upsert", error.message);
    }
  }

  return true;
}

/** Remove by stored row (profile). */
export async function removeLikedNews(
  scope: string,
  row: LikedNewsStored,
  supabaseUserId: string | null | undefined
): Promise<void> {
  const h = row.content_hash;
  let rows = await readLocal(scope);
  rows = rows.filter((r) => r.content_hash !== h);
  await writeLocal(scope, rows);
  if (supabaseUserId && supabaseConfigured) {
    const { error } = await supabase
      .from("liked_news")
      .delete()
      .eq("user_id", supabaseUserId)
      .eq("content_hash", h);
    logSupabaseError("liked_news.delete", error);
  }
}

const INTEREST_STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "are",
  "but",
  "not",
  "you",
  "all",
  "can",
  "her",
  "was",
  "one",
  "our",
  "out",
  "day",
  "get",
  "has",
  "him",
  "his",
  "how",
  "its",
  "may",
  "new",
  "now",
  "old",
  "see",
  "two",
  "who",
  "way",
  "use",
  "man",
  "any",
  "she",
  "say",
  "per",
  "off",
  "why",
  "let",
  "put",
  "too",
  "also",
  "into",
  "over",
  "such",
  "than",
  "then",
  "them",
  "these",
  "this",
  "that",
  "with",
  "from",
  "have",
  "been",
  "will",
  "your",
  "what",
  "when",
  "where",
  "which",
  "while",
  "about",
  "after",
  "before",
  "between",
  "through",
  "under",
  "more",
  "some",
  "very",
  "just",
  "like",
  "news",
  "report",
  "reports",
  "says",
  "said",
]);

/** Tokenize liked headlines/summaries for `keywords` overlap in “My feed”. */
export function interestTermsFromLiked(
  rows: LikedNewsStored[],
  maxTerms = 24
): string[] {
  const parts: string[] = [];
  for (const r of rows.slice(0, 20)) {
    const t = `${r.title} ${r.description}`.toLowerCase();
    for (const w of t.split(/[^a-z0-9]+/)) {
      if (w.length >= 3 && w.length < 40 && !INTEREST_STOPWORDS.has(w)) {
        parts.push(w);
      }
    }
  }
  return [...new Set(parts)].slice(0, maxTerms);
}

export async function listLikedNewsForProfile(
  scope: string,
  supabaseUserId: string | null | undefined
): Promise<LikedNewsStored[]> {
  if (!supabaseUserId || !supabaseConfigured) {
    return readLocal(scope);
  }
  const { data, error } = await supabase
    .from("liked_news")
    .select(
      "article_id,title,link,description,image_url,source,published_at,category,content_hash,created_at"
    )
    .eq("user_id", supabaseUserId)
    .order("created_at", { ascending: false });

  const seen = new Set<string>();
  const out: LikedNewsStored[] = [];

  if (!error && Array.isArray(data)) {
    for (const row of data) {
      const h = row.content_hash as string;
      if (!h || seen.has(h)) continue;
      seen.add(h);
      out.push({
        article_id: String(row.article_id ?? ""),
        title: String(row.title ?? ""),
        link: String(row.link ?? ""),
        description: String(row.description ?? ""),
        image_url:
          row.image_url != null && String(row.image_url).trim()
            ? String(row.image_url)
            : null,
        source: String(row.source ?? ""),
        published_at: String(row.published_at ?? ""),
        category:
          row.category != null ? String(row.category) : undefined,
        content_hash: h,
      });
    }
  }

  const local = await readLocal(scope);
  for (const r of local) {
    if (!seen.has(r.content_hash)) {
      seen.add(r.content_hash);
      out.push(r);
    }
  }

  return out;
}
