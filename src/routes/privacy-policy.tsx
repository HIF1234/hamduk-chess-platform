import { createFileRoute } from "@tanstack/react-router";
import { PrivacyPage } from "./privacy";

// Alias of /privacy: payment providers and app stores often look for this path.
export const Route = createFileRoute("/privacy-policy")({
  head: () => ({
    meta: [{ title: "Privacy Policy — Hamduk Chess" }],
    links: [{ rel: "canonical", href: "https://play.chess.hamduk.com.ng/privacy" }],
  }),
  component: PrivacyPage,
});
