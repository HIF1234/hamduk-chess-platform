import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { TermsPage } from "./terms";

// Refunds live in the Terms of Service; this path opens that section directly.
export const Route = createFileRoute("/refund-policy")({
  head: () => ({
    meta: [{ title: "Refund Policy — Hamduk Chess" }],
    links: [{ rel: "canonical", href: "https://play.chess.hamduk.com.ng/terms#refunds" }],
  }),
  component: RefundPolicy,
});

function RefundPolicy() {
  useEffect(() => {
    document.getElementById("refunds")?.scrollIntoView();
  }, []);
  return <TermsPage />;
}
