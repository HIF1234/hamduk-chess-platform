import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useServerFn } from "@tanstack/react-start";
import { Chess } from "chess.js";
import { Loader2, Mic, MicOff, Sparkles, Square, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { coachMyThinking } from "@/lib/coach.functions";
import { extractMentionedMoves } from "@/lib/think-aloud";
import { CLASSIFICATION_META, type MoveReview, type ReviewAnalyzer } from "@/lib/game-review";

export type Reflection = { thought: string; reply: string };

type Props = {
  move: MoveReview;
  gameId?: string;
  getAnalyzer: () => ReviewAnalyzer | null;
  saved?: Reflection;
  onSaved: (r: Reflection) => void;
};

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult:
    | ((e: {
        resultIndex: number;
        results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
      }) => void)
    | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

function getRecognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const PROMPTS = [
  "I played this because…",
  "I was also considering…",
  "I was worried that my opponent…",
];

/** Coach Verbal Review: the player says what they were thinking, the coach answers the reasoning. */
export function ThinkAloudPanel({ move, gameId, getAnalyzer, saved, onSaved }: Props) {
  const coach = useServerFn(coachMyThinking);
  const [thought, setThought] = useState(saved?.thought ?? "");
  const [language, setLanguage] = useState<"en" | "pcm">("en");
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const canListen = useMemo(() => getRecognitionCtor() !== null, []);

  useEffect(() => {
    setThought(saved?.thought ?? "");
  }, [move.ply, saved?.thought]);

  useEffect(
    () => () => {
      recRef.current?.stop();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    },
    [],
  );

  const mentioned = useMemo(
    () => extractMentionedMoves(thought, move.fenBefore).filter((m) => m.lan !== move.uci),
    [thought, move.fenBefore, move.uci],
  );

  const moveLabel = `${Math.ceil(move.ply / 2)}${move.color === "w" ? "." : "..."} ${move.san}`;
  const meta = CLASSIFICATION_META[move.classification];

  function toggleMic() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "en-NG";
    rec.continuous = true;
    rec.interimResults = false;
    const base = thought ? thought.trimEnd() + " " : "";
    let spoken = "";
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) spoken += e.results[i][0].transcript + " ";
      }
      setThought(base + spoken.trim());
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed") toast.error("Microphone permission was denied.");
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  async function submit() {
    const analyzer = getAnalyzer();
    setBusy(true);
    try {
      // Mover's point of view makes the numbers read naturally to the coach.
      const sign = move.color === "w" ? 1 : -1;
      const clampCp = (cp: number) => Math.round(Math.max(-100000, Math.min(100000, cp)));
      const candidates: { san: string; evalCp: number }[] = [];
      for (const m of mentioned) {
        const cp = analyzer ? await analyzer.evaluateAfter(move.fenBefore, m.lan, 12) : null;
        if (cp !== null) candidates.push({ san: m.san, evalCp: clampCp(cp * sign) });
      }
      let bestMoveSan: string | null = null;
      if (move.bestMove) {
        try {
          bestMoveSan = new Chess(move.fenBefore).move({
            from: move.bestMove.slice(0, 2),
            to: move.bestMove.slice(2, 4),
            promotion: move.bestMove[4],
          }).san;
        } catch {
          bestMoveSan = null;
        }
      }
      const res = await coach({
        data: {
          gameId,
          ply: move.ply,
          fenBefore: move.fenBefore,
          moveSan: move.san,
          classification: move.classification,
          cpLoss: clampCp(move.cpLoss),
          evalBefore: clampCp(move.evalBefore * sign),
          evalAfter: clampCp(move.evalAfter * sign),
          bestMoveSan,
          thought: thought.trim(),
          candidates,
          language,
        },
      });
      if (res.error !== undefined) {
        toast.error(res.error);
        return;
      }
      onSaved({ thought: thought.trim(), reply: res.markdown });
      if (res.remaining <= 3)
        toast.info(`${res.remaining} coach review${res.remaining === 1 ? "" : "s"} left today`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function speak(text: string) {
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const plain = text.replace(/[*_#>`]/g, "").replace(/\n+/g, ". ");
    const u = new SpeechSynthesisUtterance(plain);
    u.lang = "en-NG";
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    synth.speak(u);
    setSpeaking(true);
  }

  return (
    <div className="mt-4 rounded-xl border border-gold/40 bg-gradient-to-br from-gold/10 via-card to-primary/5 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 font-serif text-lg font-bold">
          <Sparkles className="h-4 w-4 text-gold" /> Coach Verbal Review
        </h3>
        <span className={`font-mono text-sm ${meta.color}`}>
          {moveLabel} {meta.symbol}
        </span>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Tell the coach what you were thinking on this move. Mention the moves you were considering.
        The coach checks them with the engine and responds to your reasoning.
      </p>

      <div className="mb-2 flex flex-wrap gap-1.5">
        {PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => setThought((t) => (t ? `${t.trimEnd()} ${p}` : p))}
            className="rounded-full border border-border bg-background px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
          >
            {p}
          </button>
        ))}
      </div>

      <div className="relative">
        <textarea
          value={thought}
          onChange={(e) => setThought(e.target.value)}
          rows={4}
          maxLength={1500}
          placeholder="e.g. I played knight to f5 because it attacks the queen. I also thought about Qd2 but was scared of Bg4."
          className="w-full rounded-md border border-border bg-background px-3 py-2 pr-12 text-sm"
        />
        {canListen && (
          <button
            onClick={toggleMic}
            aria-label={listening ? "Stop recording" : "Speak your thoughts"}
            className={`absolute right-2 top-2 rounded-full p-2 ${
              listening
                ? "animate-pulse bg-destructive text-white motion-reduce:animate-none"
                : "bg-primary text-primary-foreground"
            }`}
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
        )}
      </div>

      {mentioned.length > 0 && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Coach will check:{" "}
          <span className="font-mono text-foreground">
            {mentioned.map((m) => m.san).join(", ")}
          </span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex overflow-hidden rounded-md border border-border text-xs">
          {(["en", "pcm"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLanguage(l)}
              className={`px-2.5 py-1 ${language === l ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
            >
              {l === "en" ? "English" : "Pidgin"}
            </button>
          ))}
        </div>
        <button
          onClick={() => void submit()}
          disabled={busy || thought.trim().length < 3}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Ask the coach
        </button>
      </div>

      {saved?.reply && (
        <div className="mt-4 border-t border-border pt-3">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Coach says
            </p>
            <button
              onClick={() => speak(saved.reply)}
              className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {speaking ? <Square className="h-3 w-3" /> : <Volume2 className="h-3.5 w-3.5" />}
              {speaking ? "Stop" : "Listen"}
            </button>
          </div>
          <div className="prose prose-sm max-w-none text-sm leading-relaxed dark:prose-invert">
            <ReactMarkdown>{saved.reply}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
