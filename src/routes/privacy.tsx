import { createFileRoute, Link } from "@tanstack/react-router";
import { LEGAL, LegalPage, Mail } from "@/components/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Hamduk Chess" },
      {
        name: "description",
        content:
          "What personal data Hamduk Chess collects, why, who we share it with, and your rights under the Nigeria Data Protection Act.",
      },
    ],
  }),
  component: PrivacyPage,
});

export function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={
        <>
          <p>
            This policy explains how {LEGAL.name} ("Hamduk Chess", "we", "us") collects and uses
            personal data when you use {LEGAL.site} and our related apps (the "Service"). We are the
            data controller, and we process personal data in line with the Nigeria Data Protection
            Act 2023 (NDPA) and the rules of the Nigeria Data Protection Commission.
          </p>
          <p>
            In short: we collect what we need to run a chess platform, we don't sell your data, and
            we don't use advertising trackers.
          </p>
        </>
      }
      sections={[
        {
          id: "collect",
          heading: "What we collect",
          body: (
            <>
              <ul>
                <li>
                  <strong>Account details</strong> — email address, username, password (stored
                  hashed by our authentication provider), country, and whether you signed in with
                  Google. Guests get an anonymous account with no email.
                </li>
                <li>
                  <strong>Chess activity</strong> — your games and moves, ratings, time spent per
                  move, puzzles, lessons and training progress, tournament and club participation.
                </li>
                <li>
                  <strong>Things you write</strong> — chat and direct messages, club posts, study
                  annotations, reports you file, and the reasoning you type or speak into Coach
                  Verbal Review.
                </li>
                <li>
                  <strong>Payments</strong> — your membership tier, payment references, amounts and
                  dates. Card and bank details are handled by Paystack; we never receive them.
                </li>
                <li>
                  <strong>Technical data</strong> — basic logs (such as IP address, device and
                  browser type, and errors) kept by our hosting providers to keep the Service secure
                  and working, and online/offline presence while you play.
                </li>
              </ul>
              <p>
                Voice input in Coach Verbal Review is turned into text by your own browser's speech
                recognition; we receive only the text, never audio recordings.
              </p>
            </>
          ),
        },
        {
          id: "use",
          heading: "How and why we use it",
          body: (
            <>
              <ul>
                <li>
                  <strong>To provide the Service</strong> (performance of our contract with you):
                  running games, ratings, matchmaking, tournaments, clubs, messaging, training and
                  memberships.
                </li>
                <li>
                  <strong>Fair play and safety</strong> (legitimate interests): detecting cheating
                  and abuse, moderating content, and keeping accounts secure.
                </li>
                <li>
                  <strong>Payments and records</strong> (legal obligation and contract): processing
                  payments, refunds and keeping financial records.
                </li>
                <li>
                  <strong>Improving the Service</strong> (legitimate interests): understanding which
                  features are used and fixing problems.
                </li>
                <li>
                  <strong>Emails you ask for</strong> (consent): for example correspondence-move
                  alerts. You can turn these off at any time.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "ai",
          heading: "AI coaching features",
          body: (
            <>
              <p>
                When you use an AI coaching feature, we send the relevant chess information (such as
                a position, your game moves and engine evaluations) and any text you wrote for the
                coach to our AI provider, Google (Gemini), to generate the explanation. We do not
                send your name or email with these requests. Google may process this data under its
                own terms, including to improve its services, so please don't include personal
                information in what you write to the coach. Using these features is optional.
              </p>
            </>
          ),
        },
        {
          id: "share",
          heading: "Who we share it with",
          body: (
            <>
              <p>We don't sell personal data. We share it only with:</p>
              <ul>
                <li>
                  <strong>Other players</strong> — your username, ratings, public games, profile and
                  club posts are visible to others as part of the Service.
                </li>
                <li>
                  <strong>Service providers</strong> who process data for us: Supabase (database and
                  authentication, hosted in the United Kingdom), Vercel (website hosting), Paystack
                  (payments, Nigeria), Google (AI explanations and, if you choose it, Google
                  sign-in), and Upstash (short-lived data such as online presence and rate limits).
                </li>
                <li>
                  <strong>Coaches and clubs</strong> you choose to book or join, who see what they
                  need to work with you.
                </li>
                <li>
                  <strong>Authorities</strong> when the law requires it, or to protect the safety of
                  our users.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "transfers",
          heading: "International transfers",
          body: (
            <>
              <p>
                Some of our providers store or process data outside Nigeria, mainly in the United
                Kingdom, the European Union and the United States. Where we do this, we rely on the
                safeguards permitted by the NDPA, such as contractual protections and the providers'
                security commitments.
              </p>
            </>
          ),
        },
        {
          id: "retention",
          heading: "How long we keep it",
          body: (
            <>
              <ul>
                <li>Account and game data: while your account is open.</li>
                <li>Guest accounts: deleted after 30 days of inactivity.</li>
                <li>
                  Payment records: kept for as long as Nigerian tax and accounting law requires,
                  even after you close your account.
                </li>
                <li>
                  Fair-play records: kept as long as needed to protect the integrity of ratings and
                  tournaments.
                </li>
              </ul>
              <p>
                When you delete your account we remove or anonymise your personal data. Games you
                played may remain in anonymised form so your opponents' histories stay intact.
              </p>
            </>
          ),
        },
        {
          id: "rights",
          heading: "Your rights",
          body: (
            <>
              <p>Under the NDPA you can ask us to:</p>
              <ul>
                <li>give you a copy of your personal data, including in a portable format;</li>
                <li>correct data that is wrong;</li>
                <li>delete your data or your account;</li>
                <li>restrict or object to some processing;</li>
                <li>withdraw consent you have given, at any time.</li>
              </ul>
              <p>
                Email <Mail /> and we will respond within 30 days. If you are unhappy with our
                answer you can complain to the Nigeria Data Protection Commission (ndpc.gov.ng).
              </p>
            </>
          ),
        },
        {
          id: "children",
          heading: "Children",
          body: (
            <>
              <p>
                Many of our players are young. Anyone under 18 needs the consent of a parent or
                guardian to use the Service, and schools that register students must obtain that
                consent. Parents can contact <Mail /> to review or delete their child's data. We do
                not knowingly use children's data for marketing.
              </p>
            </>
          ),
        },
        {
          id: "storage",
          heading: "Cookies and local storage",
          body: (
            <>
              <p>
                We use your browser's local storage to keep you signed in and to remember settings
                such as your theme and puzzle progress. We don't use advertising or cross-site
                tracking cookies.
              </p>
            </>
          ),
        },
        {
          id: "security",
          heading: "Security",
          body: (
            <>
              <p>
                We protect data with encrypted connections (HTTPS), access controls on every
                database table, and hashed passwords and API keys. No system is perfectly secure; if
                a breach affects your data, we will notify you and the regulator as the NDPA
                requires.
              </p>
            </>
          ),
        },
        {
          id: "changes",
          heading: "Changes to this policy",
          body: (
            <>
              <p>
                We will post any changes here and update the date above. If a change is significant,
                we will also tell you in the app or by email. See also our{" "}
                <Link to="/terms" className="text-primary hover:underline">
                  Terms of Service
                </Link>
                .
              </p>
            </>
          ),
        },
        {
          id: "contact",
          heading: "Contact us",
          body: (
            <>
              <p>
                {LEGAL.name}, {LEGAL.location}. Email <Mail /> or call {LEGAL.phone}.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
