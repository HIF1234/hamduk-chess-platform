CREATE TABLE public.clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  visibility text NOT NULL DEFAULT 'public',
  min_tier public.subscription_tier_enum NOT NULL DEFAULT 'free',
  is_official boolean NOT NULL DEFAULT false,
  member_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.club_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'approved',
  muted_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, user_id)
);

CREATE TABLE public.club_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.club_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text,
  banned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  appeal_text text,
  appeal_status text NOT NULL DEFAULT 'none',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, user_id)
);

ALTER TABLE public.tournaments
  ADD CONSTRAINT tournaments_club_fk FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.is_club_member(_club_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members m
    WHERE m.club_id = _club_id AND m.user_id = _user_id AND m.status = 'approved'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_club_admin(_club_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clubs c WHERE c.id = _club_id AND c.owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.club_members m
    WHERE m.club_id = _club_id AND m.user_id = _user_id
      AND m.status = 'approved' AND m.role IN ('owner','admin')
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_club_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_club_admin(uuid, uuid) FROM PUBLIC, anon;

GRANT SELECT ON public.clubs TO anon;
GRANT SELECT, INSERT, UPDATE ON public.clubs TO authenticated;
GRANT ALL ON public.clubs TO service_role;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public clubs are viewable"
  ON public.clubs FOR SELECT TO anon, authenticated
  USING (visibility = 'public');
CREATE POLICY "Members and admins can view private clubs"
  ON public.clubs FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_club_member(id, auth.uid()) OR public.is_admin('moderator'));
CREATE POLICY "Authenticated users can create clubs"
  ON public.clubs FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Club admins can update their club"
  ON public.clubs FOR UPDATE TO authenticated
  USING (public.is_club_admin(id, auth.uid()) OR public.is_admin('moderator'))
  WITH CHECK (public.is_club_admin(id, auth.uid()) OR public.is_admin('moderator'));

CREATE TRIGGER clubs_touch BEFORE UPDATE ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

GRANT SELECT ON public.club_members TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_members TO authenticated;
GRANT ALL ON public.club_members TO service_role;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members of public clubs are viewable"
  ON public.club_members FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_id AND c.visibility = 'public'));
CREATE POLICY "Members can view own club roster"
  ON public.club_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_club_member(club_id, auth.uid()) OR public.is_admin('moderator'));
CREATE POLICY "Users can request to join"
  ON public.club_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Club admins can manage members"
  ON public.club_members FOR UPDATE TO authenticated
  USING (public.is_club_admin(club_id, auth.uid()) OR public.is_admin('moderator'))
  WITH CHECK (public.is_club_admin(club_id, auth.uid()) OR public.is_admin('moderator'));
CREATE POLICY "Users can leave and admins can remove"
  ON public.club_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_club_admin(club_id, auth.uid()) OR public.is_admin('moderator'));

CREATE TRIGGER club_members_touch BEFORE UPDATE ON public.club_members
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

GRANT SELECT ON public.club_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_posts TO authenticated;
GRANT ALL ON public.club_posts TO service_role;
ALTER TABLE public.club_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Posts in public clubs are viewable"
  ON public.club_posts FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_id AND c.visibility = 'public'));
CREATE POLICY "Members can read their club forum"
  ON public.club_posts FOR SELECT TO authenticated
  USING (public.is_club_member(club_id, auth.uid()) OR public.is_admin('moderator'));
CREATE POLICY "Members can post"
  ON public.club_posts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_club_member(club_id, auth.uid()));
CREATE POLICY "Authors and club admins can edit posts"
  ON public.club_posts FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_club_admin(club_id, auth.uid()) OR public.is_admin('moderator'))
  WITH CHECK (user_id = auth.uid() OR public.is_club_admin(club_id, auth.uid()) OR public.is_admin('moderator'));
CREATE POLICY "Authors and club admins can delete posts"
  ON public.club_posts FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_club_admin(club_id, auth.uid()) OR public.is_admin('moderator'));

CREATE TRIGGER club_posts_touch BEFORE UPDATE ON public.club_posts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_bans TO authenticated;
GRANT ALL ON public.club_bans TO service_role;
ALTER TABLE public.club_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bans visible to the banned member and club admins"
  ON public.club_bans FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_club_admin(club_id, auth.uid()) OR public.is_admin('moderator'));
CREATE POLICY "Club admins can ban"
  ON public.club_bans FOR INSERT TO authenticated
  WITH CHECK (public.is_club_admin(club_id, auth.uid()) OR public.is_admin('moderator'));
CREATE POLICY "Appeals and ban decisions"
  ON public.club_bans FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_club_admin(club_id, auth.uid()) OR public.is_admin('moderator'))
  WITH CHECK (user_id = auth.uid() OR public.is_club_admin(club_id, auth.uid()) OR public.is_admin('moderator'));
CREATE POLICY "Club admins can lift bans"
  ON public.club_bans FOR DELETE TO authenticated
  USING (public.is_club_admin(club_id, auth.uid()) OR public.is_admin('moderator'));

CREATE TRIGGER club_bans_touch BEFORE UPDATE ON public.club_bans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "Club members can view club tournaments"
  ON public.tournaments FOR SELECT TO authenticated
  USING (club_id IS NOT NULL AND public.is_club_member(club_id, auth.uid()));

INSERT INTO public.clubs (slug, name, description, visibility, is_official)
VALUES (
  'hamdukchessclub',
  'HamdukChessClub',
  'The official club of Hamduk Chess. Home of club events, study boards and the Gold members'' badge.',
  'public',
  true
);
