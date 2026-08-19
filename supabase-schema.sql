-- ============================================================
-- Uniflow — reset + create (profiles, habits, likes)
-- ============================================================
--
-- WHAT THIS DOES
-- 1) DROP (deletes all rows in) these app tables only — not auth.users
-- 2) CREATE them again with RLS + policies + indexes
-- 3) Re-attach signup trigger → auto row in profiles for new signups
--
-- TABLES: profiles, habits, habit_logs, liked_quotes, liked_news, news_articles
-- Routine DB: commented out below — re-enable when the routine feature ships (see block comment).
--
-- STEP-BY-STEP
-- 1) Supabase Dashboard → same project as EXPO_PUBLIC_SUPABASE_URL
-- 2) SQL Editor → paste this file → Run
-- 3) Confirm “Success” — Table Editor should list all tables above
-- 4) Wait ~30s or reload project so PostgREST picks up tables (fixes PGRST205)
-- 5) Fully quit and reopen the app (or Expo reload)
--
-- Supabase will warn about destructive DROP — intentional here.
--
-- ============================================================

-- Must drop trigger before dropping public objects that function touches (profiles).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Children first (foreign keys)
-- Routine drops deferred (routine DDL is commented out below).
-- DROP TABLE IF EXISTS public.routine_day_log CASCADE;
-- DROP TABLE IF EXISTS public.routine_bundle CASCADE;
DROP TABLE IF EXISTS public.habit_logs CASCADE;
DROP TABLE IF EXISTS public.habits CASCADE;
DROP TABLE IF EXISTS public.liked_news CASCADE;
DROP TABLE IF EXISTS public.liked_quotes CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ── profiles ─────────────────────────────────────────────────
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  phone TEXT,
  photo_url TEXT,
  trial_started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.phone, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── habits + habit_logs ───────────────────────────────────────
CREATE TABLE public.habits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'fitness',
  color TEXT DEFAULT '#6366f1',
  archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can CRUD own habits" ON public.habits;
CREATE POLICY "Users can CRUD own habits" ON public.habits
  FOR ALL USING (auth.uid() = user_id);

CREATE TABLE public.habit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  habit_id UUID REFERENCES public.habits ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  UNIQUE (habit_id, date)
);

ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can CRUD own habit_logs" ON public.habit_logs;
CREATE POLICY "Users can CRUD own habit_logs" ON public.habit_logs
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_habits_user ON public.habits (user_id);
CREATE INDEX idx_habit_logs_habit ON public.habit_logs (habit_id, date);
CREATE INDEX idx_habit_logs_user ON public.habit_logs (user_id);

-- ── liked_quotes + liked_news ───────────────────────────────
CREATE TABLE public.liked_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  text TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  mood TEXT,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, content_hash)
);

ALTER TABLE public.liked_quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can CRUD own liked_quotes" ON public.liked_quotes;
CREATE POLICY "Users can CRUD own liked_quotes" ON public.liked_quotes
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_liked_quotes_user ON public.liked_quotes (user_id);

CREATE TABLE public.liked_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  content_hash TEXT NOT NULL,
  article_id TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  link TEXT NOT NULL,
  description TEXT DEFAULT '',
  image_url TEXT,
  source TEXT DEFAULT '',
  published_at TEXT DEFAULT '',
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, content_hash)
);

ALTER TABLE public.liked_news ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can CRUD own liked_news" ON public.liked_news;
CREATE POLICY "Users can CRUD own liked_news" ON public.liked_news
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_liked_news_user ON public.liked_news (user_id);

-- ── news_articles (shared across all users) ───────────────────────
DROP TABLE IF EXISTS public.news_articles CASCADE;

CREATE TABLE public.news_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,            -- 'india','entertaining','tech','science','global' (legacy rows may still say 'business')
  title TEXT NOT NULL,                -- AI-rewritten headline
  description TEXT NOT NULL,          -- AI summary (longer copy for detail)
  original_title TEXT NOT NULL,
  link TEXT NOT NULL,
  image_url TEXT,
  source TEXT NOT NULL,               -- 'BBC', 'NDTV', etc.
  published_at TIMESTAMPTZ,
  keywords TEXT[] NOT NULL DEFAULT '{}',  -- for personalization / overlap with user interests
  feed_order INT NOT NULL DEFAULT 99,     -- 1=india … 5=global for stable tab ordering
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read news" ON public.news_articles;
CREATE POLICY "Anyone can read news" ON public.news_articles
  FOR SELECT USING (true);

-- Cron / server: writes must use service_role API key (JWT claim role = service_role).
DROP POLICY IF EXISTS "Service role writes news_articles" ON public.news_articles;
CREATE POLICY "Service role writes news_articles" ON public.news_articles
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE UNIQUE INDEX idx_news_articles_link ON public.news_articles (link);
CREATE INDEX idx_news_articles_category ON public.news_articles (category, created_at DESC);
CREATE INDEX idx_news_articles_feed_order ON public.news_articles (feed_order, published_at DESC);
CREATE INDEX idx_news_articles_keywords ON public.news_articles USING GIN (keywords);

/*
-- ── DEFERRED: Routines (Supabase) — uncomment when feature ships ──
-- ── Routines: why 4 tables ───────────────────────────────────
-- routines        = your routine (name, type, icon) — one row per routine
-- routine_items   = the checklist steps (titles, order) — many per routine
-- routine_logs    = one row per day you opened that routine (progress %)
-- routine_item_logs = each step checked/unchecked for that day
-- The app needs items + item_logs; merging into 2 tables would require a big app rewrite.

-- ── routines (template + steps + daily log + per-step completion) ──
CREATE TABLE public.routines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  routine_type TEXT NOT NULL DEFAULT 'custom'
    CHECK (routine_type IN ('morning', 'afternoon', 'evening', 'night', 'custom')),
  icon TEXT DEFAULT 'sunny-outline',
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can CRUD own routines" ON public.routines;
DROP POLICY IF EXISTS "routines_select" ON public.routines;
DROP POLICY IF EXISTS "routines_insert" ON public.routines;
DROP POLICY IF EXISTS "routines_update" ON public.routines;
DROP POLICY IF EXISTS "routines_delete" ON public.routines;
CREATE POLICY "routines_select" ON public.routines
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "routines_insert" ON public.routines
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "routines_update" ON public.routines
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "routines_delete" ON public.routines
  FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.routine_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  routine_id UUID REFERENCES public.routines ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  order_index INTEGER NOT NULL DEFAULT 0,
  estimated_time INTEGER NOT NULL DEFAULT 5 CHECK (estimated_time >= 1),
  is_mandatory BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE public.routine_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage items of own routines" ON public.routine_items;
DROP POLICY IF EXISTS "routine_items_select" ON public.routine_items;
DROP POLICY IF EXISTS "routine_items_insert" ON public.routine_items;
DROP POLICY IF EXISTS "routine_items_update" ON public.routine_items;
DROP POLICY IF EXISTS "routine_items_delete" ON public.routine_items;
-- INSERT needs explicit WITH CHECK; unqualified routine_id = new row value
CREATE POLICY "routine_items_select" ON public.routine_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.routines r
      WHERE r.id = routine_items.routine_id AND r.user_id = auth.uid()
    )
  );
CREATE POLICY "routine_items_insert" ON public.routine_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.routines r
      WHERE r.id = routine_id AND r.user_id = auth.uid()
    )
  );
CREATE POLICY "routine_items_update" ON public.routine_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.routines r
      WHERE r.id = routine_items.routine_id AND r.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.routines r
      WHERE r.id = routine_id AND r.user_id = auth.uid()
    )
  );
CREATE POLICY "routine_items_delete" ON public.routine_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.routines r
      WHERE r.id = routine_items.routine_id AND r.user_id = auth.uid()
    )
  );

CREATE TABLE public.routine_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  routine_id UUID REFERENCES public.routines ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completion_percentage INTEGER NOT NULL DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE (user_id, routine_id, date)
);

ALTER TABLE public.routine_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can CRUD own routine_logs" ON public.routine_logs;
DROP POLICY IF EXISTS "routine_logs_select" ON public.routine_logs;
DROP POLICY IF EXISTS "routine_logs_insert" ON public.routine_logs;
DROP POLICY IF EXISTS "routine_logs_update" ON public.routine_logs;
DROP POLICY IF EXISTS "routine_logs_delete" ON public.routine_logs;
CREATE POLICY "routine_logs_select" ON public.routine_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "routine_logs_insert" ON public.routine_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "routine_logs_update" ON public.routine_logs
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "routine_logs_delete" ON public.routine_logs
  FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.routine_item_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  routine_log_id UUID REFERENCES public.routine_logs ON DELETE CASCADE NOT NULL,
  routine_item_id UUID REFERENCES public.routine_items ON DELETE CASCADE NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  UNIQUE (routine_log_id, routine_item_id)
);

ALTER TABLE public.routine_item_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage item_logs via own routine_logs" ON public.routine_item_logs;
DROP POLICY IF EXISTS "routine_item_logs_select" ON public.routine_item_logs;
DROP POLICY IF EXISTS "routine_item_logs_insert" ON public.routine_item_logs;
DROP POLICY IF EXISTS "routine_item_logs_update" ON public.routine_item_logs;
DROP POLICY IF EXISTS "routine_item_logs_delete" ON public.routine_item_logs;
CREATE POLICY "routine_item_logs_select" ON public.routine_item_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.routine_logs rl
      WHERE rl.id = routine_item_logs.routine_log_id AND rl.user_id = auth.uid()
    )
  );
CREATE POLICY "routine_item_logs_insert" ON public.routine_item_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.routine_logs rl
      WHERE rl.id = routine_log_id AND rl.user_id = auth.uid()
    )
  );
CREATE POLICY "routine_item_logs_update" ON public.routine_item_logs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.routine_logs rl
      WHERE rl.id = routine_item_logs.routine_log_id AND rl.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.routine_logs rl
      WHERE rl.id = routine_log_id AND rl.user_id = auth.uid()
    )
  );
CREATE POLICY "routine_item_logs_delete" ON public.routine_item_logs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.routine_logs rl
      WHERE rl.id = routine_item_logs.routine_log_id AND rl.user_id = auth.uid()
    )
  );

CREATE INDEX idx_routines_user ON public.routines (user_id);
CREATE INDEX idx_routine_items_routine ON public.routine_items (routine_id, order_index);
CREATE INDEX idx_routine_logs_user_date ON public.routine_logs (user_id, date DESC);
CREATE INDEX idx_routine_logs_routine ON public.routine_logs (routine_id, date);
CREATE INDEX idx_routine_item_logs_log ON public.routine_item_logs (routine_log_id);
*/

-- Expose to PostgREST (usually default). If tables still missing in API:
-- Dashboard → Settings → API → ensure "public" is in Exposed schemas.
