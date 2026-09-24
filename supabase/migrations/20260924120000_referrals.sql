-- Referral programme: every registered player gets a code; a referrer is rewarded
-- once per referred player, on that player's first paid membership.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE TABLE public.referral_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  converted_tier public.subscription_tier_enum NOT NULL,
  reward_days integer NOT NULL,
  payment_reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX referral_events_referrer_idx ON public.referral_events (referrer_id, created_at DESC);

GRANT SELECT ON public.referral_events TO authenticated;
GRANT ALL ON public.referral_events TO service_role;
ALTER TABLE public.referral_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Referrers see their rewards"
  ON public.referral_events FOR SELECT TO authenticated USING (referrer_id = auth.uid());

-- Make each Paystack reference apply at most once (webhook and manual verify race).
CREATE UNIQUE INDEX IF NOT EXISTS payment_events_activation_once
  ON public.payment_events (reference) WHERE event = 'subscription.activated';
