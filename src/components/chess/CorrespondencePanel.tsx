import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarClock, Bell, BellOff, GitBranch } from "lucide-react";
import {
  saveConditionalMove,
  clearConditionalMove,
  getConditionalMove,
  setGameEmailNotify,
} from "@/lib/correspondence.functions";

function timeLeft(deadline: string | null): string {
  if (!deadline) return "no deadline";
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "overdue";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return d > 0 ? `${d}d ${h}h left` : h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

export function CorrespondencePanel({
  gameId,
  daysPerMove,
  moveDeadline,
  notifyByEmail,
  myTurn,
  active,
}: {
  gameId: string;
  daysPerMove: number | null;
  moveDeadline: string | null;
  notifyByEmail: boolean;
  myTurn: boolean;
  active: boolean;
}) {
  const save = useServerFn(saveConditionalMove);
  const clear = useServerFn(clearConditionalMove);
  const read = useServerFn(getConditionalMove);
  const setNotify = useServerFn(setGameEmailNotify);

  const [expected, setExpected] = useState("");
  const [reply, setReply] = useState("");
  const [stored, setStored] = useState<{ expected: string; reply: string } | null>(null);
  const [notify, setNotifyState] = useState(notifyByEmail);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!active) return;
    void read({ data: { gameId } })
      .then((r) => setStored(r.conditional ?? null))
      .catch(() => undefined);
  }, [gameId, active, read]);

  async function handleSave() {
    try {
      await save({ data: { gameId, expected: expected.trim().toLowerCase(), reply: reply.trim().toLowerCase() } });
      setStored({ expected: expected.trim().toLowerCase(), reply: reply.trim().toLowerCase() });
      setExpected("");
      setReply("");
      toast.success("Conditional move saved — it plays automatically if that move comes.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-border bg-muted/30 p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-semibold">
          <CalendarClock className="h-4 w-4 text-primary" />
          {daysPerMove ?? 1} day{(daysPerMove ?? 1) > 1 ? "s" : ""} per move
        </span>
        <span
          key={tick}
          className={`font-mono text-xs ${timeLeft(moveDeadline) === "overdue" ? "text-destructive" : "text-muted-foreground"}`}
        >
          {active ? timeLeft(moveDeadline) : "finished"}
        </span>
      </div>

      <button
        onClick={async () => {
          const next = !notify;
          setNotifyState(next);
          try {
            await setNotify({ data: { gameId, enabled: next } });
          } catch {
            setNotifyState(!next);
            toast.error("Could not change notifications");
          }
        }}
        className="flex w-full items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-accent"
      >
        {notify ? <Bell className="h-3.5 w-3.5 text-primary" /> : <BellOff className="h-3.5 w-3.5" />}
        {notify ? "Email me when it's my move" : "Email reminders off"}
      </button>

      {active && !myTurn && (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <GitBranch className="h-3.5 w-3.5" /> Conditional move
          </p>
          {stored ? (
            <div className="flex items-center justify-between rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-xs">
              <span>
                If <span className="font-mono font-semibold">{stored.expected}</span> → reply{" "}
                <span className="font-mono font-semibold">{stored.reply}</span>
              </span>
              <button
                onClick={async () => {
                  await clear({ data: { gameId } }).catch(() => undefined);
                  setStored(null);
                }}
                className="underline hover:text-foreground"
              >
                clear
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                value={expected}
                onChange={(e) => setExpected(e.target.value)}
                placeholder="e2e4"
                className="w-20 rounded-md border border-border bg-background px-2 py-1 font-mono text-xs"
              />
              <span className="text-xs text-muted-foreground">→</span>
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="e7e5"
                className="w-20 rounded-md border border-border bg-background px-2 py-1 font-mono text-xs"
              />
              <button
                onClick={handleSave}
                disabled={expected.length < 4 || reply.length < 4}
                className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-40"
              >
                Save
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
