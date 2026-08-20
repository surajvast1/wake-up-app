-- Run once in the Supabase SQL Editor when upgrading an existing database.
-- The app now keeps publisher-fetched news in Supabase for richer summaries/images.
DROP TABLE IF EXISTS public.liked_news CASCADE;
DROP TABLE IF EXISTS public.liked_quotes CASCADE;

CREATE TABLE IF NOT EXISTS public.news_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  original_title TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL,
  image_url TEXT,
  source TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  feed_order INT NOT NULL DEFAULT 99,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read news" ON public.news_articles;
CREATE POLICY "Anyone can read news" ON public.news_articles
  FOR SELECT USING (true);

CREATE UNIQUE INDEX IF NOT EXISTS idx_news_articles_link ON public.news_articles (link);
CREATE INDEX IF NOT EXISTS idx_news_articles_category ON public.news_articles (category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_articles_feed_order ON public.news_articles (feed_order, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_articles_keywords ON public.news_articles USING GIN (keywords);
