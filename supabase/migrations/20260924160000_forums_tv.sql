-- Global forums (club_id reserved for club forums later) and HamdukChess TV commentary.

CREATE TABLE public.forum_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE,
  category text NOT NULL,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 4 AND 140),
  pinned boolean NOT NULL DEFAULT false,
  locked boolean NOT NULL DEFAULT false,
  views integer NOT NULL DEFAULT 0,
  reply_count integer NOT NULL DEFAULT 0,
  last_reply_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX forum_threads_list_idx
  ON public.forum_threads (category, pinned DESC, last_reply_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE public.forum_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_post_id uuid REFERENCES public.forum_posts(id) ON DELETE SET NULL,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 5000),
  likes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX forum_posts_thread_idx ON public.forum_posts (thread_id, created_at);

CREATE TABLE public.forum_post_likes (
  post_id uuid NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

-- Reads are public; every write goes through server functions (service role).
GRANT SELECT ON public.forum_threads, public.forum_posts TO anon, authenticated;
GRANT SELECT ON public.forum_post_likes TO authenticated;
GRANT ALL ON public.forum_threads, public.forum_posts, public.forum_post_likes TO service_role;
ALTER TABLE public.forum_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public threads are readable"
  ON public.forum_threads FOR SELECT TO anon, authenticated
  USING (deleted_at IS NULL AND club_id IS NULL);
CREATE POLICY "Posts in public threads are readable"
  ON public.forum_posts FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.forum_threads t
    WHERE t.id = thread_id AND t.deleted_at IS NULL AND t.club_id IS NULL
  ));
CREATE POLICY "Users see their own likes"
  ON public.forum_post_likes FOR SELECT TO authenticated USING (user_id = auth.uid());

-- View counter anyone may bump (at most once per call).
CREATE OR REPLACE FUNCTION public.forum_bump_views(p_thread uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.forum_threads SET views = views + 1 WHERE id = p_thread AND deleted_at IS NULL;
$$;
GRANT EXECUTE ON FUNCTION public.forum_bump_views(uuid) TO anon, authenticated;

-- HamdukChess TV
CREATE TABLE public.tv_commentators (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tv_commentary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES public.games(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  ply integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tv_commentary_game_idx ON public.tv_commentary (game_id, created_at);
CREATE INDEX tv_commentary_recent_idx ON public.tv_commentary (created_at DESC);

GRANT SELECT ON public.tv_commentators, public.tv_commentary TO anon, authenticated;
GRANT ALL ON public.tv_commentators, public.tv_commentary TO service_role;
ALTER TABLE public.tv_commentators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tv_commentary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Commentators are public" ON public.tv_commentators FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Commentary is public" ON public.tv_commentary FOR SELECT TO anon, authenticated USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.tv_commentary;
