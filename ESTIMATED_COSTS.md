# Uniflow — estimated operating costs (scaling)

This document maps **where money can be spent** as the app grows (roughly **100 → 1,000 → 10,000+** monthly active users, **MAU**). Numbers are **order-of-magnitude estimates** for planning — always confirm with each vendor’s **current** pricing, free tiers, and your **actual** usage in Google Cloud / OpenAI / Supabase dashboards.

**Assumptions used below**

- **“Active user”** opens the app on a typical day; not every user hits every paid API every day.
- **Guest users** avoid Supabase DB sync but still use the same third-party APIs when they use those features.
- Weather/AQI in the current app use **caching**: roughly **one successful weather + AQI fetch per user per local day** when they stay within ~12 km of the last fetch (see `HeaderHero.tsx`). Adjust multipliers if you change that logic.

---

## 1. Feature → what can cost money

| Feature / area | Paid or variable cost? | What drives cost |
|------------------|------------------------|-------------------|
| **Auth & cloud sync** | Yes (at scale) | Supabase Auth MAU, DB rows, egress, Storage (avatars) |
| **Weather (home header)** | Yes | Google Maps Platform — **Weather** (Current Conditions lookup) |
| **AQI (home header)** | No (today) | **CPCB** public RSS-style feed — no API key in app path |
| **Nearby places** | Yes | Google **Places** (Nearby/Text Search, **Place Photos** if used) |
| **Daily quote (OpenAI)** | Yes | **OpenAI** `gpt-4o-mini` (cached per day + fingerprint — not every app open) |
| **Tasks — AI** (if enabled) | Yes | OpenAI calls from `useDayTasks` when key present |
| **News** | Usually no | Public RSS — bandwidth only (negligible) |
| **Habits / routines / meditation / manifest** (local) | No API fee | Device + AsyncStorage; **Supabase** only if user is signed in and sync runs |
| **Calendar** | No | Device calendars |
| **Builds & distribution** | Yes | **Expo EAS** build minutes, optional paid plan |
| **App stores** | Fixed | Apple Developer Program; Google Play one-time fee |
| **Optional legacy env** | Maybe | `EXPO_PUBLIC_AQICN_TOKEN` (WAQI) — free tier / limits if you wire it again |

---

## 2. By vendor (what to watch)

### Supabase

- **Free tier** fits early development and small MAU; limits on database size, Auth MAUs, Storage, and egress.
- **Pro** (order of **~$25/month** region-dependent) is the common step up, plus **overage** (storage, MAU, bandwidth).
- **Scales with**: number of **signed-in** users, sync frequency, profile/avatar storage, row growth (tasks, habits, routines, liked quotes, etc.).

**Rough mindset**

- **100 MAU**, half signed in, light sync: often **$0–25/mo** (free or Pro).
- **1,000 MAU**, heavy sync + avatars: commonly **$25–100+/mo** depending on egress and storage.
- **10,000+ MAU**: plan for **Pro + overages** or enterprise conversation; **$100s+/mo** is plausible if data and media grow.

### Google Cloud (Weather + Places)

- Billed as **Google Maps Platform** SKUs (pay-as-you-go, often monthly **$200 free credit** for Maps on many accounts — verify eligibility).
- **Weather**: billed per **billable request** (see [Weather usage and billing](https://developers.google.com/maps/documentation/weather/usage-and-billing)).
- **Places**: **Nearby Search**, **Text Search**, **Place Details**, **Place Photos** each have **per-request** prices (see [pricing sheet](https://developers.google.com/maps/billing-and-pricing/pricing)).

**Order-of-magnitude illustration** (not a quote from Google)

- Suppose **weather** is ~**$X per 1,000** requests (X varies by SKU and region — use the calculator).
- With **daily cache per user**, **1,000 MAU** each triggering **~30 weather calls/month** ≈ **30,000 calls/month** → plug **30** into “per 1,000” pricing in your calculator.

Places is often **more expensive per call** than a single weather lookup if users open Nearby often; a **heavy** Nearby user could dominate the bill.

### OpenAI

- **Daily quote**: one `gpt-4o-mini` generation per user per day **when cache misses** (tone/favorites change, new day, etc.). Typical **sub-cent to a few cents** per successful generation depending on prompt size.
- **100 MAU**, ~30% hit API daily → ~30 calls/day → often **~$1–15/mo** at mini pricing if prompts stay moderate.
- **1,000 MAU** at similar rates → **~$10–150/mo** ballpark; **10,000 MAU** → **$100–1,500/mo** if most users need a fresh quote daily (wide range — measure tokens).

**Tasks AI** (`useDayTasks`): any extra OpenAI calls **multiply** this — gate behind a flag or quota if you need cost control.

### Expo Application Services (EAS)

- **Free tier** includes limited build minutes; production teams often use a **paid plan** (order of **~$29–99+/mo** depending on team size and build volume).
- **Scales with**: number of **builds**, **submit** frequency, team seats — not linearly with MAU.

### Infrastructure (optional self-hosted APIs)

- Small **Node** service: **$5–25/mo** on a modest PaaS (or $0 on free tiers with cold starts) — depends on uptime and region.

### Apple & Google (distribution)

- **Apple Developer Program**: **~$99/year** (flat).
- **Google Play**: **one-time registration fee** (check current Google Play Console pricing).

---

## 3. Example monthly scenarios (illustrative only)

These are **not** guarantees — they show **how to think** about stacking components.

| Scenario | MAU | Supabase (signed-in heavy use) | Google (Weather + light Places) | OpenAI (quotes + light task AI) | EAS | Other |
|----------|-----|----------------------------------|----------------------------------|----------------------------------|-----|--------|
| **Small** | ~100 | $0–25 | $0–30 (often offset partly by Maps credit) | $1–20 | $0–29 | Stores: amortized |
| **Medium** | ~1,000 | $25–80 | $30–200+ | $15–150 | $29–99 | — |
| **Large** | ~10,000 | $80–400+ | $200–2,000+ if Places is popular | $100–1,500+ | $99+ | Plan capacity reviews |

**Cheapest knobs**

- Keep **weather/AQI caching** aggressive (already partially done).
- **Throttle Places** (debounce, cache results, avoid photo loads until needed).
- **Quote**: stronger client cache, fewer tone changes, or cheaper/smaller models for secondary features.
- Prefer **guest** or **minimal sync** for users who don’t need cloud backup to reduce Supabase load.

---

## 4. What is effectively “free” in the current codebase path

- **CPCB AQI** feed used for Indian AQI in `realtimeaqi` / header (public data; availability and terms are up to CPCB).
- **RSS news** (subject to publisher rate limits; usually negligible cost).
- **On-device** storage for guests (no Supabase row growth from those users for synced tables).

---

## 5. Action items before you scale

1. Enable **billing alerts** on **Google Cloud**, **OpenAI**, and **Supabase**.
2. Use **one dashboard per environment** (dev/staging/prod) to avoid accidental production spend.
3. Re-read **`.env.example`** — never commit real keys; rotate any key that was ever committed to git.
4. Reconcile this document with **Expo EAS**, **Supabase**, and **Maps Platform** pricing pages **quarterly**.

---

*Last updated: April 2026 — replace figures with vendor pages when budgeting for production.*
