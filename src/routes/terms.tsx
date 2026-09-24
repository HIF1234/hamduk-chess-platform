import { createFileRoute, Link } from "@tanstack/react-router";
import { LEGAL, LegalPage, Mail } from "@/components/LegalPage";
import { TIER_PRICING } from "@/lib/paystack-pricing";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Hamduk Chess" },
      {
        name: "description",
        content:
          "The rules for using Hamduk Chess: accounts, fair play, payments, refunds and more.",
      },
    ],
  }),
  component: TermsPage,
});

const ngn = (n: number) => `₦${n.toLocaleString("en-NG")}`;

export function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={
        <>
          <p>
            These terms are an agreement between you and {LEGAL.name} ("Hamduk Chess", "we", "us")
            for your use of {LEGAL.site} and our related apps and services (the "Service"). By
            creating an account, playing as a guest, or paying for a membership, you agree to these
            terms and to our{" "}
            <Link to="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
          <p>If you do not agree, please do not use the Service.</p>
        </>
      }
      sections={[
        {
          id: "eligibility",
          heading: "Who can use Hamduk Chess",
          body: (
            <>
              <p>
                Anyone can play. If you are under 18, you may only use the Service with the
                permission of a parent or guardian, who accepts these terms on your behalf and is
                responsible for any payments. Schools and clubs that register students confirm that
                they have that permission.
              </p>
            </>
          ),
        },
        {
          id: "accounts",
          heading: "Accounts and guest play",
          body: (
            <>
              <p>
                You can play as a guest without registering. Guest progress is tied to your browser
                and may be lost if you clear your data or do not create an account; guest accounts
                inactive for 30 days may be deleted.
              </p>
              <p>
                If you register, keep your login details safe and tell us at <Mail /> if you think
                someone else has used your account. You are responsible for activity on your
                account. Usernames must not impersonate others or be offensive.
              </p>
            </>
          ),
        },
        {
          id: "fair-play",
          heading: "Fair play",
          body: (
            <>
              <p>To keep games fair for everyone, you must not:</p>
              <ul>
                <li>
                  use a chess engine, tablebase, another person, or any outside help during a rated
                  or tournament game;
                </li>
                <li>
                  deliberately lose games or manipulate ratings (sandbagging, boosting, or playing
                  on shared accounts);
                </li>
                <li>use bots, scripts or automation to play or to access the Service;</li>
                <li>
                  abuse the analysis, coach or AI features to get help in games that are still in
                  progress.
                </li>
              </ul>
              <p>
                We check games using automated signals (such as engine-match rates and move timing)
                and human review. Automated checks only flag accounts; a moderator decides. If we
                find a violation we may void results, adjust ratings, remove you from tournaments,
                restrict features, or close your account. You can appeal by writing to <Mail />.
              </p>
            </>
          ),
        },
        {
          id: "conduct",
          heading: "Community rules",
          body: (
            <>
              <p>
                In chat, messages, club forums, study boards and comments, be respectful. Do not
                harass, threaten, spam, share others' personal information, post sexual, hateful or
                illegal content, or promote gambling or scams. Club owners and admins can moderate
                their clubs; we can remove content and suspend accounts that break these rules.
              </p>
            </>
          ),
        },
        {
          id: "memberships",
          heading: "Memberships and payments",
          body: (
            <>
              <p>
                The core game is free. Paid memberships unlock extra features:{" "}
                <strong>
                  {TIER_PRICING.plus.label} ({ngn(TIER_PRICING.plus.monthly_ngn)})
                </strong>{" "}
                and{" "}
                <strong>
                  {TIER_PRICING.gold.label} ({ngn(TIER_PRICING.gold.monthly_ngn)})
                </strong>
                , each for 30 days of access. Prices are in Nigerian Naira and include any fees we
                show at checkout. We may change prices; changes never affect time you have already
                paid for.
              </p>
              <p>
                Payments are processed by Paystack. We never see or store your full card details.
                Each payment gives you 30 days of access and{" "}
                <strong>does not renew automatically</strong> — you choose whether to pay again when
                your access ends.
              </p>
              <p>
                Referral rewards: when a new player joins through your invite link and buys their
                first membership, you receive 30 free days of membership, once per invited player.
                Rewards have no cash value, and we may withhold rewards obtained through fake or
                duplicate accounts.
              </p>
              <p>
                Tournament entry fees and coaching session fees are shown before you pay. Coaches on
                the marketplace are independent; they set their own rates and we keep a platform fee
                that is shown on the booking.
              </p>
            </>
          ),
        },
        {
          id: "refunds",
          heading: "Refunds and cancellations",
          body: (
            <>
              <ul>
                <li>
                  <strong>Memberships:</strong> if you were charged in error, charged twice, or
                  could not use the paid features because of a fault on our side, contact us within
                  7 days of payment and we will refund you or extend your access.
                </li>
                <li>
                  <strong>Tournaments:</strong> if we or the organiser cancel a paid tournament,
                  your entry fee is refunded in full. If you withdraw before the tournament starts,
                  your entry fee is refunded; after it starts, it is not.
                </li>
                <li>
                  <strong>Coaching:</strong> sessions cancelled by the coach, or by you at least 24
                  hours before the start time, are refunded in full.
                </li>
              </ul>
              <p>
                Approved refunds go back to your original payment method through Paystack, usually
                within 5–10 working days depending on your bank. To request one, email <Mail /> with
                your username and payment reference. This does not affect any rights you have under
                Nigerian consumer protection law.
              </p>
            </>
          ),
        },
        {
          id: "ai",
          heading: "Engine analysis and AI coaching",
          body: (
            <>
              <p>
                Engine analysis runs in your browser. AI coaching features (including Coach Verbal
                Review, position explanations and the assistant) generate text automatically. They
                can be wrong. Use them as a learning aid, not as a guarantee, and never during a
                game in progress.
              </p>
            </>
          ),
        },
        {
          id: "content",
          heading: "Your content and ours",
          body: (
            <>
              <p>
                You keep ownership of what you create — posts, studies, annotations and your written
                reflections. You give us a licence to store, display and process it to run the
                Service (for example, showing your club post to members). Games played on Hamduk
                Chess, including their moves, may be shown publicly, used in puzzles and statistics,
                and analysed to improve fair play and training features.
              </p>
              <p>
                The Hamduk Chess name, logo, bot characters, artwork and software belong to us. You
                may not copy or resell them without permission.
              </p>
            </>
          ),
        },
        {
          id: "service",
          heading: "Availability and changes",
          body: (
            <>
              <p>
                We work hard to keep the Service running, but it is provided "as is" and may
                sometimes be unavailable, for example during maintenance or because of internet
                problems. We may add, change or remove features. If we remove a paid feature during
                time you have paid for, we will extend or refund you fairly.
              </p>
            </>
          ),
        },
        {
          id: "termination",
          heading: "Closing your account",
          body: (
            <>
              <p>
                You can stop using the Service at any time and ask us to delete your account at{" "}
                <Mail />. We may suspend or close accounts that break these terms. Sections that by
                their nature should continue (such as payments owed, content licences and limits on
                liability) survive closure.
              </p>
            </>
          ),
        },
        {
          id: "liability",
          heading: "Limits on our liability",
          body: (
            <>
              <p>
                To the extent the law allows, we are not liable for indirect or consequential
                losses, or for losses caused by other players, coaches, or services outside our
                control. Our total liability to you for any claim is limited to the amount you paid
                us in the 12 months before the claim. Nothing in these terms limits liability that
                cannot be limited by law.
              </p>
            </>
          ),
        },
        {
          id: "law",
          heading: "Governing law",
          body: (
            <>
              <p>
                These terms are governed by the laws of the Federal Republic of Nigeria. We will try
                to resolve any dispute with you informally first; if we cannot, the courts of Lagos
                State have jurisdiction.
              </p>
            </>
          ),
        },
        {
          id: "changes",
          heading: "Changes to these terms",
          body: (
            <>
              <p>
                We may update these terms. If a change is significant, we will tell you in the app
                or by email before it takes effect. Continuing to use the Service after that means
                you accept the new terms.
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
