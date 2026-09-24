import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, Mail } from "@/components/LegalPage";

export const Route = createFileRoute("/fair-play")({
  head: () => ({
    meta: [
      { title: "Fair Play — Hamduk Chess" },
      {
        name: "description",
        content: "How Hamduk Chess keeps games fair, and what happens if someone cheats.",
      },
    ],
  }),
  component: FairPlay,
});

function FairPlay() {
  return (
    <LegalPage
      title="Fair Play"
      intro={
        <p>
          Chess is only fun when both players are playing honestly. This page explains what counts
          as cheating on Hamduk Chess, how we detect it, and what happens next. It is part of our{" "}
          <Link to="/terms" className="text-primary hover:underline">
            Terms of Service
          </Link>
          .
        </p>
      }
      sections={[
        {
          id: "not-allowed",
          heading: "What is not allowed",
          body: (
            <ul>
              <li>
                Using an engine, app, tablebase, book or another person during a rated, tournament,
                friend or correspondence game.
              </li>
              <li>
                Using our own analysis board, AI coach or Coach Verbal Review on a game that is
                still being played.
              </li>
              <li>
                Deliberately losing (sandbagging) or arranging results to raise or lower a rating.
              </li>
              <li>Sharing an account, or letting someone else play for you.</li>
              <li>
                Creating extra accounts to get around a ban, farm referral rewards or manipulate
                ratings.
              </li>
            </ul>
          ),
        },
        {
          id: "allowed",
          heading: "What is allowed",
          body: (
            <ul>
              <li>Analysing any game with the engine after it has finished.</li>
              <li>Asking the AI assistant or a coach for advice on your own finished games.</li>
              <li>Studying openings, puzzles and lessons between games as much as you like.</li>
            </ul>
          ),
        },
        {
          id: "detection",
          heading: "How we detect cheating",
          body: (
            <>
              <p>
                We record the time taken for every move on our servers and compare moves with engine
                choices after the game. Unusual patterns — for example very high engine agreement
                combined with fast, steady move times — raise an automatic flag.
              </p>
              <p>
                <strong>A flag is never a ban.</strong> Every flagged account is reviewed by a
                person on our moderation team, who looks at many games before deciding anything.
              </p>
            </>
          ),
        },
        {
          id: "outcomes",
          heading: "What happens if someone cheats",
          body: (
            <>
              <p>Depending on how serious it is, we may:</p>
              <ul>
                <li>void the affected results and restore opponents' rating points;</li>
                <li>remove the player from tournaments and withhold prizes;</li>
                <li>restrict rated play, or close the account.</li>
              </ul>
            </>
          ),
        },
        {
          id: "report",
          heading: "Reporting a player",
          body: (
            <p>
              If you think an opponent cheated, use the report option on their profile or game.
              Reports go to the same review queue. Please don't accuse players publicly in chat or
              forums.
            </p>
          ),
        },
        {
          id: "appeal",
          heading: "Appeals",
          body: (
            <p>
              If you believe we got it wrong, email <Mail /> with your username. A different
              moderator will look at your case.
            </p>
          ),
        },
      ]}
    />
  );
}
