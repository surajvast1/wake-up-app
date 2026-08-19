-- ============================================================
-- ROUTINE DATABASE — DEFERRED (do not run until routines ship)
-- ============================================================
-- Previously: routine_bundle + routine_day_log (or legacy 4-table model).
-- Uncomment and apply when you re-enable cloud sync for routines.
-- ============================================================

/*
-- ============================================================
-- Routine sync v2 — TWO tables only (replaces 4-table model)
-- Run once in Supabase SQL Editor (destructive for old routine tables)
-- ============================================================
-- 1) Drops: routines, routine_items, routine_logs, routine_item_logs
-- 2) Creates:
--    routine_bundle  — one row per user: JSON { routines[], items[] }
--    routine_day_log — one row per user + routine + date (last 7 days kept by app)
-- 3) RLS: auth.uid() = user_id only (no nested EXISTS)
-- ============================================================

DROP TABLE IF EXISTS public.routine_item_logs CASCADE;
DROP TABLE IF EXISTS public.routine_logs CASCADE;
DROP TABLE IF EXISTS public.routine_items CASCADE;
DROP TABLE IF EXISTS public.routines CASCADE;

CREATE TABLE public.routine_bundle (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{"routines":[],"items":[]}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.routine_bundle ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "routine_bundle_select" ON public.routine_bundle;
DROP POLICY IF EXISTS "routine_bundle_insert" ON public.routine_bundle;
DROP POLICY IF EXISTS "routine_bundle_update" ON public.routine_bundle;
DROP POLICY IF EXISTS "routine_bundle_delete" ON public.routine_bundle;

CREATE POLICY "routine_bundle_select" ON public.routine_bundle
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "routine_bundle_insert" ON public.routine_bundle
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "routine_bundle_update" ON public.routine_bundle
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "routine_bundle_delete" ON public.routine_bundle
  FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.routine_day_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  routine_id UUID NOT NULL,
  log_date DATE NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, routine_id, log_date)
);

ALTER TABLE public.routine_day_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "routine_day_log_select" ON public.routine_day_log;
DROP POLICY IF EXISTS "routine_day_log_insert" ON public.routine_day_log;
DROP POLICY IF EXISTS "routine_day_log_update" ON public.routine_day_log;
DROP POLICY IF EXISTS "routine_day_log_delete" ON public.routine_day_log;

CREATE POLICY "routine_day_log_select" ON public.routine_day_log
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "routine_day_log_insert" ON public.routine_day_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "routine_day_log_update" ON public.routine_day_log
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "routine_day_log_delete" ON public.routine_day_log
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_routine_day_log_user_date ON public.routine_day_log (user_id, log_date DESC);
CREATE INDEX idx_routine_day_log_routine ON public.routine_day_log (user_id, routine_id);
*/
