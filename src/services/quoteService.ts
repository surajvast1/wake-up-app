import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  isAuthorFromFavoriteList,
} from "../lib/quoteAuthorMatch";

/** Prefer the spelling from the user’s source list when the model matched loosely. */
function canonicalAuthorFromSources(
  author: string,
  favorites: string[]
): string {
  const hit = favorites.find((f) => isAuthorFromFavoriteList(author, [f]));
  return hit ?? author;
}

export type QuoteMood =
  | "warm"
  | "calm"
  | "joy"
  | "energy"
  | "growth"
  | "dream"
  | "grit"
  | "default";

export interface Quote {
  text: string;
  author: string;
  mood?: QuoteMood;
}

const QUOTE_CACHE_KEY = "@daily_quote_v3";
const QUOTE_TONE_KEY = "@quote_tone";
const RECENT_QUOTES_KEY = "@quote_recent_v1";
const MAX_RECENT = 10;
const MAX_SNIPPET_LEN = 110;

const today = () => new Date().toISOString().split("T")[0];

const MOODS: QuoteMood[] = [
  "warm",
  "calm",
  "joy",
  "energy",
  "growth",
  "dream",
  "grit",
  "default",
];

export function resolveQuoteMood(m?: string): QuoteMood {
  const v = (m || "").toLowerCase().trim();
  return MOODS.includes(v as QuoteMood) ? (v as QuoteMood) : "default";
}

export type QuoteVisualTheme = {
  gradient: [string, string, string];
  borderColor: string;
  quoteColor: string;
  authorColor: string;
  loaderColor: string;
  shadowColor: string;
};

/**
 * Light quote card — warm paper + sage accents (matches app primary / soft surfaces).
 */
const QUOTE_VISUAL_LIGHT: QuoteVisualTheme = {
  gradient: ["#FDFCFA", "#F4F7F2", "#E8EDE6"],
  borderColor: "rgba(91, 117, 83, 0.22)",
  quoteColor: "#2A3328",
  authorColor: "#4A6344",
  loaderColor: "#5B7553",
  shadowColor: "#7A9972",
};

/**
 * Dark quote card — deep neutral with muted sage lift (aligned with dark surfaces).
 */
const QUOTE_VISUAL_DARK: QuoteVisualTheme = {
  gradient: ["#171917", "#1C211C", "#232A24"],
  borderColor: "rgba(139, 175, 131, 0.28)",
  quoteColor: "#ECEAE4",
  authorColor: "#A3C39B",
  loaderColor: "#8BAF83",
  shadowColor: "#6E8566",
};

/** Card gradient + text colors for QuoteSection — one palette; ignores quote mood. */
export function getQuoteVisualTheme(
  _mood: QuoteMood | undefined,
  isDark: boolean
): QuoteVisualTheme {
  return isDark ? QUOTE_VISUAL_DARK : QUOTE_VISUAL_LIGHT;
}

function extractResponseText(root: unknown): string {
  const r = root as Record<string, unknown>;
  if (r && typeof r.output_text === "string" && r.output_text.trim()) {
    return r.output_text;
  }
  if (r && Array.isArray(r.output)) {
    const parts: string[] = [];
    for (const msg of r.output as { content?: unknown }[]) {
      const content = msg?.content;
      if (Array.isArray(content)) {
        for (const c of content as Record<string, unknown>[]) {
          if (typeof c?.text === "string" && c.text.trim()) parts.push(c.text);
          else if (
            typeof (c?.text as { value?: string })?.value === "string" &&
            (c.text as { value: string }).value.trim()
          )
            parts.push((c.text as { value: string }).value);
          else if (typeof c?.value === "string" && c.value.trim())
            parts.push(c.value);
          else if (typeof c?.content === "string" && c.content.trim())
            parts.push(c.content);
        }
      }
    }
    if (parts.length > 0) return parts.join("\n");
  }
  if (r && Array.isArray(r.choices) && r.choices.length > 0) {
    const ch = r.choices[0] as {
      message?: { content?: string };
      text?: string;
    };
    const t = ch?.message?.content ?? ch?.text;
    if (typeof t === "string" && t.trim()) return t;
  }
  return "";
}

function parseLegacyQuoteLine(raw: string): { text: string; author: string } {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()
    .replace(/^"(.*)"$/s, "$1");

  const separators = [" \u2014 ", " -- ", " \u2013 ", "\n\u2014", "\n--", "\n\u2013"];
  for (const sep of separators) {
    const idx = cleaned.lastIndexOf(sep);
    if (idx > 10) {
      const text = cleaned
        .slice(0, idx)
        .replace(/^[\u201C\u201D]|[\u201C\u201D]$/g, "")
        .trim();
      const author = cleaned
        .slice(idx + sep.length)
        .replace(/^[-\u2013\u2014\s]+/, "")
        .trim();
      if (text && author) return { text, author };
    }
  }

  return {
    text: cleaned.replace(/^[\u201C\u201D]|[\u201C\u201D]$/g, "").trim(),
    author: "",
  };
}

function parseQuoteFromApi(raw: string): Quote | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const j = JSON.parse(cleaned) as {
      text?: string;
      author?: string;
      mood?: string;
    };
    if (j.text && typeof j.text === "string") {
      const text = j.text.trim().slice(0, 420);
      if (text.length < 4) return null;
      const author =
        typeof j.author === "string" ? j.author.trim().slice(0, 80) : "";
      return {
        text,
        author,
        mood: resolveQuoteMood(j.mood),
      };
    }
  } catch {
    /* try legacy line format */
  }

  const legacy = parseLegacyQuoteLine(cleaned);
  if (legacy.text.length > 4) {
    return { ...legacy, mood: "default" };
  }
  return null;
}

async function getRecentForPrompt(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_QUOTES_KEY);
    if (!raw) return "";
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr) || arr.length === 0) return "";
    const lines = arr
      .filter((x): x is string => typeof x === "string")
      .slice(0, MAX_RECENT)
      .map((s, i) => `${i + 1}. ${s.slice(0, MAX_SNIPPET_LEN)}`);
    if (lines.length === 0) return "";
    return `\nAvoid repeating or closely paraphrasing these recent lines (ideas must feel fresh):\n${lines.join("\n")}\n`;
  } catch {
    return "";
  }
}

async function pushRecentQuote(text: string): Promise<void> {
  const snippet = text.slice(0, MAX_SNIPPET_LEN).replace(/\s+/g, " ").trim();
  if (snippet.length < 8) return;
  try {
    const raw = await AsyncStorage.getItem(RECENT_QUOTES_KEY);
    let arr: string[] = [];
    if (raw) {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) arr = p.filter((x) => typeof x === "string");
    }
    arr = [snippet, ...arr.filter((s) => s !== snippet)].slice(0, MAX_RECENT);
    await AsyncStorage.setItem(RECENT_QUOTES_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

function quoteLoadError(text: string): Quote {
  return { text, author: "", mood: "default" };
}

const MSG_NO_QUOTE_API =
  "Quotes are unavailable right now because the quote service isn’t configured for this build.";

const MSG_QUOTE_NETWORK =
  "We couldn’t load your quote. Check your connection and try again.";

const MSG_QUOTE_UNAUTHORIZED =
  "The quote service rejected the API key. Set EXPO_PUBLIC_OPENROUTER_API_KEY and rebuild, or check OpenRouter.";

const MSG_QUOTE_PAYMENT =
  "The quote service account has no available credits. Add balance on openrouter.ai and try again.";

const MSG_QUOTE_RATE_LIMIT =
  "The quote service is rate-limiting right now. Try again in a minute.";

const MSG_QUOTE_SERVER =
  "The quote service returned an error. Try again later or check OpenRouter status.";

type OpenRouterErrorBody = {
  error?: { message?: string; code?: number; metadata?: { raw?: string } };
};

function pickHttpQuoteMessage(status: number, msg: string | undefined): string {
  if (status === 401 || status === 403) {
    return MSG_QUOTE_UNAUTHORIZED;
  }
  if (status === 402 || /balance|insufficient|payment|credit/i.test(msg ?? "")) {
    return MSG_QUOTE_PAYMENT;
  }
  if (status === 429) {
    return MSG_QUOTE_RATE_LIMIT;
  }
  if (status >= 500) {
    return MSG_QUOTE_SERVER;
  }
  if (msg && msg.trim().length > 0 && msg.length < 180) {
    return `Quote service: ${msg.trim()}`;
  }
  return MSG_QUOTE_SERVER;
}

const MSG_QUOTE_PARSE =
  "We couldn’t read today’s quote from the service. Please try again.";

const MSG_QUOTE_SOURCES =
  "No quote matched your selected sources. Try again or change your sources in the menu.";

export async function setQuoteTone(tone: string): Promise<void> {
  await AsyncStorage.setItem(QUOTE_TONE_KEY, tone.trim());
}

export async function getQuoteTone(): Promise<string | null> {
  const t = await AsyncStorage.getItem(QUOTE_TONE_KEY);
  return t || null;
}

export async function clearDailyQuoteCache(): Promise<void> {
  await AsyncStorage.removeItem(QUOTE_CACHE_KEY);
}

export type QuoteFetchContext = {
  storageScope: string;
  supabaseUserId?: string | null;
};

export async function fetchDailyQuote(
  force = false,
  ctx?: QuoteFetchContext
): Promise<Quote> {
  void ctx;

  const savedTone = (await getQuoteTone()) || "";

  let favoritePeople: string[] = [];
  try {
    const { getFavoritePeople } = await import("./favoritePeopleService");
    favoritePeople = await getFavoritePeople();
  } catch { /* ignore */ }

  const cacheFingerprint = `${savedTone}|${[...favoritePeople].sort().join(",")}`;

  if (!force) {
    const raw = await AsyncStorage.getItem(QUOTE_CACHE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as {
          date: string;
          text: string;
          author: string;
          tone?: string;
          mood?: string;
          fingerprint?: string;
        };
        const cachedFp = parsed.fingerprint ?? `${parsed.tone || ""}|`;
        if (parsed.date === today() && cachedFp === cacheFingerprint) {
          return {
            text: parsed.text,
            author: parsed.author || "",
            mood: resolveQuoteMood(parsed.mood),
          };
        }
      } catch {
        /* fetch fresh */
      }
    }
  }

  const recentBlock = await getRecentForPrompt();
  const toneHint = savedTone ? `\nUser tone preference: ${savedTone}.` : "";
  const diversify = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const sourcesOnly = favoritePeople.length > 0;
  const sourceListLine = favoritePeople.map((n) => `"${n}"`).join(", ");

  const prompt = sourcesOnly
    ? [
        "You output ONE daily quote JSON for Uniflow. STRICT SOURCE MODE.",
        "",
        "The user chose ONLY these people as quote sources. You MUST NOT cite anyone else:",
        `[${sourceListLine}]`,
        "",
        "RULES:",
        "- Pick exactly ONE person from the list above. Output a REAL quote they said or wrote (verifiable).",
        `- The JSON "author" field MUST be spelled exactly as one of: ${sourceListLine}`,
        "- Do NOT cite Warren Buffett, Steve Jobs, or any name not in the list above.",
        "- Never invent quotes. The author field must never be empty.",
        "- Keep the quote concise: max ~200 characters.",
        toneHint,
        recentBlock,
        "",
        'Output ONLY valid JSON (no markdown, no backticks):',
        '{"text":"the quote text","author":"Full Name","mood":"warm|calm|joy|energy|growth|dream|grit|default"}',
        "",
        "mood guide: warm (care/mentorship), calm (peace/wisdom), joy (optimism), energy (drive/action), growth (learning/discipline), dream (vision/ambition), grit (resilience/toughness), default (neutral).",
        "",
        `Diversify token (ignore semantically): ${diversify}`,
      ].join("\n")
    : [
        "You provide the daily quote for Uniflow, a life-improvement app.",
        "The user wants powerful, motivating, meaningful quotes that hit hard and push you to take action, build discipline, and become better.",
        "",
        "RULES:",
        "- ALWAYS provide a REAL quote from a REAL person. Never make up quotes. The author field must NEVER be empty.",
        "- Source quotes from people who changed the world: entrepreneurs, billionaires, philosophers, athletes, leaders, scientists, writers, visionaries.",
        "- Examples: Warren Buffett, Steve Jobs, Naval Ravikant, Marcus Aurelius, Seneca, Alex Hormozi, David Goggins, Elon Musk, Oprah, Kobe Bryant, Einstein, Nikola Tesla, Bruce Lee, Rumi, Vince Lombardi, Theodore Roosevelt, Denzel Washington, Jeff Bezos, Charlie Munger, etc.",
        "- The quote must feel like it was said by someone who BUILT something, OVERCAME something, or UNDERSTOOD something deep about life and success.",
        "- No generic fluff. Every quote must carry weight and real-world wisdom.",
        "- Avoid overused cliches. Pick lesser-known but powerful quotes when possible.",
        "- Keep it concise: max ~200 characters.",
        toneHint,
        recentBlock,
        "",
        'Output ONLY valid JSON (no markdown, no backticks):',
        '{"text":"the quote text","author":"Full Name","mood":"warm|calm|joy|energy|growth|dream|grit|default"}',
        "",
        "mood guide: warm (care/mentorship), calm (peace/wisdom), joy (optimism), energy (drive/action), growth (learning/discipline), dream (vision/ambition), grit (resilience/toughness), default (neutral).",
        "",
        `Diversify token (ignore semantically): ${diversify}`,
      ].join("\n");

  const openRouterKey = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY?.trim();
  if (!openRouterKey) {
    return quoteLoadError(MSG_NO_QUOTE_API);
  }

  let fromApi = false;
  let quote: Quote = quoteLoadError(MSG_QUOTE_NETWORK);

  try {
    const openRouterModel =
      process.env.EXPO_PUBLIC_OPENROUTER_QUOTE_MODEL?.trim() ||
      "openai/gpt-4o-mini";

    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openRouterKey}`,
        ...(process.env.EXPO_PUBLIC_OPENROUTER_HTTP_REFERER
          ? {
              "HTTP-Referer": process.env.EXPO_PUBLIC_OPENROUTER_HTTP_REFERER,
            }
          : {}),
        "X-Title": "Uniflow",
      },
      body: JSON.stringify({
        model: openRouterModel,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 260,
        temperature: sourcesOnly ? 0.35 : 1,
      }),
    });

    const text = await resp.text();
    let data: unknown;
    try {
      data = text && text.length > 0 ? JSON.parse(text) : null;
    } catch {
      data = null;
      if (__DEV__) {
        console.warn(
          "[Quote] OpenRouter non-JSON body, status=",
          resp.status,
          text?.slice(0, 500)
        );
      }
    }

    if (!resp.ok) {
      const errObj = (data && typeof data === "object" ? data : null) as
        | OpenRouterErrorBody
        | null;
      const apiMsg =
        typeof errObj?.error?.message === "string" ? errObj.error.message : undefined;
      if (__DEV__) {
        console.warn(
          "[Quote] OpenRouter HTTP",
          resp.status,
          apiMsg,
          text?.slice(0, 400)
        );
      }
      quote = quoteLoadError(pickHttpQuoteMessage(resp.status, apiMsg));
    } else if (data) {
      const messageText = extractResponseText(data);
      if (messageText) {
        const parsed = parseQuoteFromApi(messageText);
        if (parsed && parsed.text.length > 4) {
          if (!parsed.author || parsed.author.trim().length === 0) {
            parsed.author = "Unknown";
          }
          if (
            sourcesOnly &&
            !isAuthorFromFavoriteList(parsed.author, favoritePeople)
          ) {
            quote = quoteLoadError(MSG_QUOTE_SOURCES);
          } else {
            if (sourcesOnly) {
              parsed.author = canonicalAuthorFromSources(
                parsed.author,
                favoritePeople
              );
            }
            quote = parsed;
            fromApi = true;
          }
        } else {
          if (__DEV__) {
            console.warn("[Quote] Unparsed model output (first 500):", messageText?.slice(0, 500));
          }
          quote = quoteLoadError(MSG_QUOTE_PARSE);
        }
      } else {
        if (__DEV__) {
          console.warn("[Quote] No assistant text in response", data);
        }
        quote = quoteLoadError(MSG_QUOTE_PARSE);
      }
    } else {
      quote = quoteLoadError(MSG_QUOTE_PARSE);
    }
  } catch (e) {
    if (__DEV__) {
      console.warn("[Quote] fetch or processing failed", e);
    }
    quote = quoteLoadError(MSG_QUOTE_NETWORK);
  }

  if (fromApi) {
    await pushRecentQuote(quote.text);
    await AsyncStorage.setItem(
      QUOTE_CACHE_KEY,
      JSON.stringify({
        date: today(),
        text: quote.text,
        author: quote.author,
        tone: savedTone,
        mood: quote.mood ?? "default",
        fingerprint: cacheFingerprint,
      })
    );
  }

  return quote;
}
