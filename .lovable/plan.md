# Tournaments & Clubs

Two large features. Built in two phases so you can try each one as it lands.

Note on payments: the app uses Paystack (not Stripe), so entry fees will go through the same Paystack checkout already used for subscriptions.

## Phase 1 — Tournaments

### Creating
A create form asking for name, type, time control, variant, rated/unrated, rounds, start time, max players, minimum membership tier, and entry fee.
- Free members: can join free tournaments only, cannot create.
- Plus: create up to 64 players. Gold: up to 256 players.
- Paid entry: player pays through Paystack before their spot is confirmed.

### Four formats
- Swiss — players sorted by rating and paired down the list each round; standings tie-broken by Buchholz.
- Arena — continuous pairing for the whole duration; ranked by points.
- Round-Robin — everyone plays everyone; ties broken head-to-head.
- Knockout — seeded single-elimination bracket.

Round one is paired when the tournament starts. As games finish, results are recorded automatically and standings update. When every game in a round is done, the next round is paired.

### Tournament page (`/tournaments/{id}`)
- Up to four live boards at once, cycling through the round's games, with the top game featured larger.
- Standings table that updates live as results come in.
- Spectator chat.
- Round progress (e.g. "6 / 12 games complete").
- A tournaments list page with upcoming, live and finished sections.

### Admin
Admins can force-close a tournament, edit its settings, and override a result.

## Phase 2 — Clubs

- Public clubs anyone can join (subject to the club's minimum tier); private clubs need an invite or owner approval.
- Club page with Members, Forum, Study Boards, Tournament History, Club Games Feed, and Events.
- Club events: tournaments visible only to members, any format.
- Moderation: pin posts, mute, ban, with an appeal request members can file.
- Analytics for owners/admins: member activity, games played, tournament participation.
- HamdukChessClub pre-created as the official club; Gold members get its badge automatically and can use the existing class-session tools inside it.

## Technical notes

- New tables: `tournaments`, `tournament_players`, `tournament_rounds` (pairings JSONB), `tournament_chat`; `clubs`, `club_members`, `club_posts`, `club_bans`. RLS scoped to membership/ownership plus admin override, GRANTs alongside each table.
- Existing `org_tournaments` (B2B API) stays untouched; the new player-facing system is separate.
- Pairing, standings and tie-break logic in `src/lib/tournaments.server.ts`, exposed via `createServerFn` in `tournaments.functions.ts`; a public sweep route advances rounds and closes arenas.
- Game completion hooks in `game-webhooks.server.ts` / `matchmaking.functions.ts` gain a tournament result recorder.
- Realtime: `tournaments` + `tournament_players` added to the realtime publication for live standings; chat via broadcast channel like spectate.
- Entry fees reuse `initializePaystackCheckout` patterns with a tournament reference; verification confirms registration.
