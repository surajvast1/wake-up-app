# Changelog

All notable changes to **Uniflow** are documented here. Versions match Git tags and `app.json` → `expo.version`.

## [1.1.1] — 2026-04-30

### Links

- **Expo project (dashboard):**  
  https://expo.dev/accounts/sssurajvast1s-organization/projects/uniflow  
- **EAS builds (APK / AAB / iOS):**  
  https://expo.dev/accounts/sssurajvast1s-organization/projects/uniflow/builds  
- **GitHub repository:**  
  https://github.com/surajvast1/Uniflow  

### Added

- **News reel personalization:** on-device taste model from **likes** and **dwell time** (~4s+) on a card; every few vertical swipes, injects one story similar to your profile (via `fetchSimilarArticles` / `newsEngagementService` + `useNewsReelEngagement`).
- **`CHANGELOG.md`** for release notes.

### Changed

- **README:** badges, quick start (`clone` / `yarn` / `.env`), repo table, news personalization bullet, generic EAS account wording.
- **`.env.example`:** trimmed after payment removal; aligned with current app env vars.

### Removed

- **Razorpay** checkout UI, `paymentsApi`, subscription context/service, localized pricing, and **My Feed** subscription screen code paths.
- **`payments-server`** sample backend and Compose service (optional billing must be hosted separately if you add it back).

### Dev / repo hygiene

- **`topicTabToDbCategory`** and engagement seed fallback for mixed feeds.

---

## [1.0.0] — earlier

Initial public-style baseline: Expo 54, dashboard, news (My Feed + categories), habits, tasks, nearby places, Supabase optional sync, guest mode, EAS config. See git history for full detail.
