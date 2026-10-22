import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, XCircle } from "lucide-react";
import { getCertificate } from "@/lib/certificates.functions";

export const Route = createFileRoute("/certificate/$id")({
  loader: ({ params }) => getCertificate({ data: { id: params.id } }),
  head: () => ({
    meta: [
      { title: "Certificate verification — Hamduk Chess" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CertificatePage,
});

function CertificatePage() {
  const result = Route.useLoaderData();

  if ("error" in result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <XCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
          <h1 className="font-display text-2xl">Certificate not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This certificate ID doesn't match any issued by Hamduk Chess.
          </p>
        </div>
      </div>
    );
  }

  const cert = result.certificate;
  const date = new Date(cert.issued_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="max-w-lg text-center">
        <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-primary" />
        <p className="text-xs uppercase tracking-widest text-primary">Verified certificate</p>
        <h1 className="mt-2 font-display text-3xl">Hamduk Chess Course Path</h1>
        <p className="mt-6 text-lg">
          This certifies that <span className="font-semibold">{cert.player_name}</span> completed
          the <span className="font-semibold">{cert.piece_name}</span> level ({cert.unit_title}) of
          Hamduk Chess's Course path.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">Issued {date}</p>
        <p className="mt-8 font-mono text-xs text-muted-foreground">Certificate ID: {cert.id}</p>
      </div>
    </div>
  );
}
