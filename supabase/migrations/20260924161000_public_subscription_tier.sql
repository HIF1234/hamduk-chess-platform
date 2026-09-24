-- The membership tier is public by design (Gold badge/flair on profiles, members
-- lists, forums). Billing columns (Paystack codes, status, renewal date) stay private.
GRANT SELECT (subscription_tier) ON public.profiles TO anon, authenticated;
