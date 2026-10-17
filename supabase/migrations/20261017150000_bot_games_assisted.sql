-- Assisted mode (takebacks, hints, hanging-piece highlights): a win played with it on
-- doesn't count toward the bot ladder.
ALTER TABLE public.bot_games ADD COLUMN IF NOT EXISTS assisted boolean NOT NULL DEFAULT false;
