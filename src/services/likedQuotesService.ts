import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { logSupabaseError } from "../lib/supabaseError";
import type { Quote, QuoteMood } from "./quoteService";
import { resolveQuoteMood } from "./quoteService";
import { isAuthorFromFavoriteList } from "../lib/quoteAuthorMatch";

const LOCAL_KEY_PREFIX = "LIKED_QUOTES_V1__";

export interface LikedQuoteStored {
  text: string;
  author: string;
  mood?: QuoteMood;
  /** Present for rows saved after this feature shipped; older rows rehashed on read. */
  content_hash?: string;
}

function localKey(scope: string): string {
  return `${LOCAL_KEY_PREFIX}${scope}`;
}

export async function quoteContentHash(text: string, author: string): Promise<string> {
  const s = `${text.trim()}\n${(author || "").trim()}`;
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, s);
}

async function normalizeRows(rows: LikedQuoteStored[]): Promise<LikedQuoteStored[]> {
  const out: LikedQuoteStored[] = [];
  for (const r of rows) {
    const h =
      r.content_hash ||
      (await quoteContentHash(r.text, typeof r.author === "string" ? r.author : ""));
    out.push({
      text: r.text,
      author: typeof r.author === "string" ? r.author : "",
      mood: r.mood,
      content_hash: h,
    });
  }
  return out;
}

async function readLocal(scope: string): Promise<LikedQuoteStored[]> {
  try {
    const raw = await AsyncStorage.getItem(localKey(scope));
    if (!raw) return [];
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return [];
    const rawRows = p
      .filter(
        (x): x is LikedQuoteStored =>
          x &&
          typeof x === "object" &&
          typeof (x as LikedQuoteStored).text === "string"
      )
      .map((x) => ({
        text: x.text,
        author: typeof x.author === "string" ? x.author : "",
        mood: x.mood,
        content_hash: x.content_hash,
      }));
    return normalizeRows(rawRows);
  } catch {
    return [];
  }
}

async function writeLocal(scope: string, rows: LikedQuoteStored[]): Promise<void> {
  const normalized = await normalizeRows(rows);
  await AsyncStorage.setItem(localKey(scope), JSON.stringify(normalized));
}

export async function getLocalLikedQuotes(scope: string): Promise<LikedQuoteStored[]> {
  return readLocal(scope);
}

export async function isQuoteLiked(
  scope: string,
  text: string,
  author: string,
  supabaseUserId: string | null | undefined
): Promise<boolean> {
  const h = await quoteContentHash(text, author);
  const rows = await readLocal(scope);
  if (rows.some((r) => r.content_hash === h)) return true;
  if (!supabaseUserId || !supabaseConfigured) return false;
  const { data, error } = await supabase
    .from("liked_quotes")
    .select("id")
    .eq("user_id", supabaseUserId)
    .eq("content_hash", h)
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}

/** Returns true if the quote is liked after toggle. */
export async function toggleLikeQuote(
  scope: string,
  quote: Quote,
  supabaseUserId: string | null | undefined
): Promise<boolean> {
  const { text, author = "", mood } = quote;
  const hash = await quoteContentHash(text, author);
  let rows = await readLocal(scope);
  const localIdx = rows.findIndex((r) => r.content_hash === hash);
  const inLocal = localIdx >= 0;

  let inRemote = false;
  if (supabaseUserId && supabaseConfigured) {
    const { data } = await supabase
      .from("liked_quotes")
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
        .from("liked_quotes")
        .delete()
        .eq("user_id", supabaseUserId)
        .eq("content_hash", hash);
      logSupabaseError("liked_quotes.delete_toggle", error);
    }
    return false;
  }

  rows.push({
    text,
    author,
    mood: mood ?? resolveQuoteMood(mood),
    content_hash: hash,
  });
  await writeLocal(scope, rows);

  if (supabaseUserId && supabaseConfigured) {
    const { error } = await supabase.from("liked_quotes").upsert(
      {
        user_id: supabaseUserId,
        text,
        author: author || "",
        mood: (mood ?? "default") as string,
        content_hash: hash,
      },
      { onConflict: "user_id,content_hash" }
    );
    logSupabaseError("liked_quotes.upsert", error);
  }

  return true;
}

/** Merged list for profile: remote order when logged in, plus local-only rows. */
export async function listLikedQuotesForProfile(
  scope: string,
  supabaseUserId: string | null | undefined
): Promise<LikedQuoteStored[]> {
  if (!supabaseUserId || !supabaseConfigured) {
    return readLocal(scope);
  }
  const { data, error } = await supabase
    .from("liked_quotes")
    .select("text,author,mood,content_hash,created_at")
    .eq("user_id", supabaseUserId)
    .order("created_at", { ascending: false });

  const seen = new Set<string>();
  const out: LikedQuoteStored[] = [];

  if (!error && Array.isArray(data)) {
    for (const row of data) {
      if (typeof row.text !== "string") continue;
      const h =
        typeof row.content_hash === "string"
          ? row.content_hash
          : await quoteContentHash(
              row.text,
              typeof row.author === "string" ? row.author : ""
            );
      if (seen.has(h)) continue;
      seen.add(h);
      out.push({
        text: row.text,
        author: typeof row.author === "string" ? row.author : "",
        mood: resolveQuoteMood(row.mood as string | undefined),
        content_hash: h,
      });
    }
  }

  const local = await readLocal(scope);
  for (const r of local) {
    const h =
      r.content_hash ||
      (await quoteContentHash(r.text, typeof r.author === "string" ? r.author : ""));
    if (!seen.has(h)) {
      seen.add(h);
      out.push({ ...r, content_hash: h });
    }
  }

  return out;
}

export async function pickRandomLikedQuote(
  scope: string,
  supabaseUserId: string | null | undefined,
  /** When set, only quotes whose author matches one of these names are considered. */
  restrictToAuthors?: string[] | null
): Promise<Quote | null> {
  const pool: LikedQuoteStored[] = [];

  const local = await readLocal(scope);
  pool.push(...local);

  if (supabaseUserId && supabaseConfigured) {
    const { data, error } = await supabase
      .from("liked_quotes")
      .select("text,author,mood")
      .eq("user_id", supabaseUserId);
    if (!error && Array.isArray(data)) {
      for (const row of data) {
        if (typeof row.text === "string") {
          pool.push({
            text: row.text,
            author: typeof row.author === "string" ? row.author : "",
            mood: row.mood as QuoteMood | undefined,
          });
        }
      }
    }
  }

  if (pool.length === 0) return null;

  const seen = new Set<string>();
  let deduped: LikedQuoteStored[] = [];
  for (const r of pool) {
    const k = `${r.text.trim()}|${(r.author || "").trim()}`;
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(r);
  }

  if (restrictToAuthors && restrictToAuthors.length > 0) {
    deduped = deduped.filter((r) =>
      isAuthorFromFavoriteList(r.author || "", restrictToAuthors)
    );
  }
  if (deduped.length === 0) return null;

  const pick = deduped[Math.floor(Math.random() * deduped.length)];
  return {
    text: pick.text,
    author: pick.author || "",
    mood: resolveQuoteMood(pick.mood),
  };
}
