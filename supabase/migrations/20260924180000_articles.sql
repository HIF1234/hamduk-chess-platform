-- Articles, news and event write-ups (spec: content). Written by admins/editors,
-- read by everyone once published.
CREATE TABLE public.articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'news' CHECK (type IN ('news', 'article', 'event')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 4 AND 160),
  slug text NOT NULL UNIQUE,
  excerpt text,
  body text NOT NULL DEFAULT '',
  cover_url text,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  tags text[] NOT NULL DEFAULT '{}',
  published_at timestamptz,
  views integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX articles_published_idx ON public.articles (published_at DESC) WHERE published_at IS NOT NULL;

GRANT SELECT ON public.articles TO anon, authenticated;
GRANT ALL ON public.articles TO service_role;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published articles are public"
  ON public.articles FOR SELECT TO anon, authenticated
  USING (published_at IS NOT NULL AND published_at <= now());

CREATE OR REPLACE FUNCTION public.article_bump_views(p_slug text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.articles SET views = views + 1
  WHERE slug = p_slug AND published_at IS NOT NULL AND published_at <= now();
$$;
GRANT EXECUTE ON FUNCTION public.article_bump_views(text) TO anon, authenticated;
