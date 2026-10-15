import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getGuardianApproval, approveGuardianAccount } from "@/lib/guardian.functions";

export const Route = createFileRoute("/guardian-approve/$token")({
  loader: ({ params }) => getGuardianApproval({ data: { token: params.token } }),
  head: () => ({
    meta: [{ title: "Guardian approval — Hamduk Chess" }, { name: "robots", content: "noindex" }],
  }),
  component: GuardianApprovePage,
});

function GuardianApprovePage() {
  const initial = Route.useLoaderData();
  const { token } = Route.useParams();
  const approve = useServerFn(approveGuardianAccount);
  const [status, setStatus] = useState(initial.status);
  const [username] = useState("username" in initial ? initial.username : undefined);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Hamduk Chess</CardTitle>
          <CardDescription>Guardian approval</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {status === "not_found" && (
            <p className="text-sm text-muted-foreground">
              This approval link isn't valid. It may have been copied incorrectly -- ask your child to sign up again.
            </p>
          )}
          {status === "approved" && (
            <>
              <CheckCircle2 className="mx-auto h-8 w-8 text-primary" />
              <p className="text-sm">
                {username ? `${username}'s` : "This"} account is approved. They can now play online, in addition to bots, puzzles and lessons.
              </p>
            </>
          )}
          {status === "pending" && (
            <>
              <p className="text-sm">
                Approve <span className="font-medium text-foreground">{username}</span>'s Hamduk Chess account?
              </p>
              <p className="text-xs text-muted-foreground">
                Until approved, they can already play against bots, solve puzzles and take lessons. Approving lets them play against other people online too.
              </p>
              <Button
                className="w-full"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const res = await approve({ data: { token } });
                    setStatus(res.status);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Approving…" : "Approve"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
