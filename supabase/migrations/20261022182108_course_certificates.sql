-- Certificates: "a PDF certificate for each level completed, with a QR code that verifies
-- it." The PDF itself is rendered on-device (mobile); this table is the server-authoritative
-- record a QR code's verification URL (/certificate/{id}) points at. Name/level are snapshot
-- at issue time so a later profile rename or curriculum edit doesn't change an already-issued
-- certificate's wording.

CREATE TABLE public.certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  unit_id text NOT NULL,
  piece_name text NOT NULL,
  unit_title text NOT NULL,
  full_name text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, unit_id)
);

-- No public SELECT grant/policy: the verification page reads this with the service role
-- after an explicit id lookup, not via a broad public policy on the table.
GRANT SELECT, INSERT ON public.certificates TO authenticated;
GRANT ALL ON public.certificates TO service_role;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own certificates"
  ON public.certificates FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY mfa_required ON public.certificates AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
