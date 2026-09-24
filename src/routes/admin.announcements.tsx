import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, PageHeader } from "@/components/admin/AdminUi";
import { sendAnnouncement } from "@/lib/admin-extra.functions";

export const Route = createFileRoute("/admin/announcements")({
  head: () => ({
    meta: [
      { title: "Announcements | Hamduk Chess staff" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Announcements,
  errorComponent: ({ error }) => (
    <div className="p-4 text-sm text-destructive">{error.message}</div>
  ),
});

const AUDIENCES = [
  { id: "all", label: "Everyone (registered players)" },
  { id: "free", label: "Free players" },
  { id: "paid", label: "All paying members" },
  { id: "plus", label: "Hamduk Plus" },
  { id: "gold", label: "Hamduk Gold" },
] as const;

function Announcements() {
  const [audience, setAudience] = useState<(typeof AUDIENCES)[number]["id"]>("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const send = useMutation({
    mutationFn: () =>
      sendAnnouncement({
        data: { audience, title: title.trim(), body: body.trim() || undefined, link: link.trim() },
      }),
    onSuccess: (r) => {
      toast.success(`Sent to ${r.recipients.toLocaleString()} players`);
      setTitle("");
      setBody("");
      setLink("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        subtitle="Send an in-app notification. It appears in the bell and as a live pop-up."
      />
      <Card>
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Who gets it</span>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value as typeof audience)}
              className={field}
            >
              {AUDIENCES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="Title, e.g. Lagos Open starts Saturday!"
            className={field}
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Details (optional)"
            className={field}
          />
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Link inside the site (optional), e.g. /tournaments"
            className={field}
          />
          <button
            disabled={send.isPending || title.trim().length < 4}
            onClick={() => {
              if (confirm(`Send "${title}" to ${AUDIENCES.find((a) => a.id === audience)?.label}?`))
                send.mutate();
            }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            {send.isPending ? "Sending…" : "Send announcement"}
          </button>
          <p className="text-xs text-muted-foreground">
            Guests don't receive announcements. Every send is recorded in the audit log.
          </p>
        </div>
      </Card>
    </div>
  );
}
