import {
  fetchArticlesMatchingKeywords,
  fetchBreakingArticles,
  fetchMixedDigestArticles,
  fetchSimilarArticles,
  isBreakingArticle,
  urgencyScore,
  type NewsArticle,
} from "./newsService";
import {
  interestTermsFromLiked,
  listLikedNewsForProfile,
  type LikedNewsStored,
} from "./likedNewsService";
import { filterUnseen } from "./seenNewsService";

const MIN_MATCH_BEFORE_DIGEST = 8;
const MAX_BREAKING_IN_FEED = 3;
const SIMILAR_PER_LIKED = 3;
const MAX_RECENT_LIKES_FOR_SIMILAR = 3;

/**
 * Personalized stories: keyword overlap with liked articles, padded with
 * breaking news and a mixed digest so the feed always feels fresh. Items the
 * user has already liked (by link) are excluded; seen items are hidden unless
 * `skipSeenFilter` is passed (used for small UI teasers that must never be
 * empty).
 *
 * Ranking strategy (highest wins):
 *   1. Urgency score (breaking news boost) — multiplied by 3
 *   2. Keyword overlap with user's liked articles
 *   3. Recency (ms since epoch / 1e12 as a tie-breaker)
 */
export async function loadMyFeedArticles(
  storageScope: string,
  supabaseUserId: string | null | undefined,
  options?: {
    limit?: number;
    digestPerCategory?: number;
    skipSeenFilter?: boolean;
    includeBreaking?: boolean;
  }
): Promise<NewsArticle[]> {
  const limit = options?.limit ?? 30;
  const digestN = options?.digestPerCategory ?? 2;
  const includeBreaking = options?.includeBreaking ?? true;

  const liked = await listLikedNewsForProfile(storageScope, supabaseUserId);
  const terms = interestTermsFromLiked(liked);
  const likedLinks = new Set(liked.map((l) => l.link.trim()).filter(Boolean));

  const pool = new Map<string, NewsArticle>();

  if (includeBreaking) {
    try {
      const breaking = await fetchBreakingArticles(12);
      for (const a of breaking.slice(0, MAX_BREAKING_IN_FEED)) {
        if (!likedLinks.has(a.link.trim())) pool.set(a.id, a);
      }
    } catch {}
  }

  let matched: NewsArticle[] = [];
  if (terms.length > 0) {
    matched = await fetchArticlesMatchingKeywords(
      terms,
      Math.max(limit, 40)
    );
    matched = matched.filter((a) => !likedLinks.has(a.link.trim()));
  }
  for (const a of matched) if (!pool.has(a.id)) pool.set(a.id, a);

  const recentLikes = liked.slice(0, MAX_RECENT_LIKES_FOR_SIMILAR);
  for (const like of recentLikes) {
    try {
      const seed = likedToSeed(like);
      const similar = await fetchSimilarArticles(seed, {
        limit: SIMILAR_PER_LIKED,
        excludeIds: new Set([...pool.keys()]),
        excludeLinks: likedLinks,
      });
      for (const a of similar) {
        if (!pool.has(a.id)) pool.set(a.id, a);
      }
    } catch {}
  }

  if (pool.size < MIN_MATCH_BEFORE_DIGEST) {
    const digest = await fetchMixedDigestArticles(digestN);
    for (const a of digest) {
      if (!pool.has(a.id) && !likedLinks.has(a.link.trim())) pool.set(a.id, a);
    }
  }

  const termSet = new Set(terms);

  let ranked = [...pool.values()].map((a) => ({
    a,
    r: rankScore(a, termSet),
  }));

  ranked.sort((x, y) => y.r - x.r);

  let ordered = ranked.map((x) => x.a);

  if (!options?.skipSeenFilter) {
    ordered = await filterUnseen(storageScope, ordered);
  }

  return ordered.slice(0, limit);
}

/**
 * Load more personalized items for infinite scroll — blends a broader mixed
 * digest and keeps matching against the user's interest terms so the feed
 * stays on-topic for pages 2+.
 */
export async function loadMoreMyFeedArticles(
  storageScope: string,
  supabaseUserId: string | null | undefined,
  alreadyShownIds: Set<string>,
  options?: { limit?: number }
): Promise<NewsArticle[]> {
  const limit = options?.limit ?? 20;

  const liked = await listLikedNewsForProfile(storageScope, supabaseUserId);
  const terms = interestTermsFromLiked(liked);
  const likedLinks = new Set(liked.map((l) => l.link.trim()).filter(Boolean));

  const digest = await fetchMixedDigestArticles(6);
  const pool = new Map<string, NewsArticle>();
  for (const a of digest) {
    if (!alreadyShownIds.has(a.id) && !likedLinks.has(a.link.trim())) {
      pool.set(a.id, a);
    }
  }

  if (terms.length > 0) {
    const more = await fetchArticlesMatchingKeywords(terms, limit * 2);
    for (const a of more) {
      if (!alreadyShownIds.has(a.id) && !likedLinks.has(a.link.trim())) {
        if (!pool.has(a.id)) pool.set(a.id, a);
      }
    }
  }

  const termSet = new Set(terms);
  const ranked = [...pool.values()]
    .map((a) => ({ a, r: rankScore(a, termSet) }))
    .sort((x, y) => y.r - x.r)
    .map((x) => x.a);

  const unseen = await filterUnseen(storageScope, ranked);
  return unseen.slice(0, limit);
}

function rankScore(a: NewsArticle, terms: Set<string>): number {
  const urgency = urgencyScore(a);
  let keywordHits = 0;
  if (Array.isArray(a.keywords)) {
    for (const k of a.keywords) {
      if (terms.has(String(k).toLowerCase().trim())) keywordHits += 1;
    }
  }
  const pubMs = new Date(a.publishedAt).getTime();
  const recency = Number.isNaN(pubMs) ? 0 : pubMs / 1e12;
  const breakingBoost = isBreakingArticle(a) ? 5 : 0;
  return urgency * 3 + keywordHits * 2 + recency + breakingBoost;
}

function likedToSeed(like: LikedNewsStored): NewsArticle {
  return {
    id: like.article_id,
    title: like.title,
    description: like.description,
    link: like.link,
    imageUrl: like.image_url,
    source: like.source,
    publishedAt: like.published_at,
    category: like.category,
    keywords: undefined,
  };
}
