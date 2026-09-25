-- Two-factor sign-in. A session that hasn't passed the code step (aal1) may not read or
-- write anything once the user has a verified authenticator. Applied as a RESTRICTIVE
-- policy on every RLS table, so it narrows existing policies without replacing them.

CREATE OR REPLACE FUNCTION public.mfa_ok()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2'
      OR auth.uid() IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM auth.mfa_factors f
        WHERE f.user_id = auth.uid() AND f.status = 'verified'
      );
$$;
REVOKE EXECUTE ON FUNCTION public.mfa_ok() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mfa_ok() TO anon, authenticated, service_role;

DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS mfa_required ON public.%I', t.relname);
    EXECUTE format(
      'CREATE POLICY mfa_required ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
         USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()))', t.relname);
  END LOOP;
END $$;
