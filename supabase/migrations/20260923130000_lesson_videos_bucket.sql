-- Private bucket for cloud-hosted video lessons. It existed on the previously hosted
-- project but was never captured as a migration. No storage.objects policies are
-- added on purpose: playback URLs are signed server-side after the tier check.
INSERT INTO storage.buckets (id, name, public)
VALUES ('lesson-videos', 'lesson-videos', false)
ON CONFLICT (id) DO NOTHING;
