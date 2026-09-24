import { useState } from "react";
import { toast } from "sonner";
import {
  Clapperboard,
  Copy,
  Download,
  FileText,
  Loader2,
  MessageCircle,
  Share2,
} from "lucide-react";
import { BOARD_THEMES, usePreferences } from "@/lib/preferences";
import {
  SITE_URL,
  copyText,
  gameGif,
  nativeShare,
  positionImage,
  whatsappUrl,
  xUrl,
} from "@/lib/share";

/** Share a finished (or live) game: link, WhatsApp, X, PGN and a position image. */
export function ShareGame({
  gameId,
  fen,
  pgn,
  headline,
  orientation = "white",
}: {
  gameId: string;
  fen: string;
  pgn?: string;
  /** e.g. "tunde (1340) beat ada (1290) by checkmate" */
  headline: string;
  orientation?: "white" | "black";
}) {
  const { boardTheme } = usePreferences();
  const [busy, setBusy] = useState(false);
  const [gifBusy, setGifBusy] = useState(false);
  const url = `${SITE_URL}/spectate/${gameId}`;
  const text = `${headline} on Hamduk Chess ♟️`;

  async function image() {
    setBusy(true);
    try {
      const t = BOARD_THEMES[boardTheme];
      const blob = await positionImage({
        fen,
        light: t.light,
        dark: t.dark,
        orientation,
        title: headline,
      });
      const file = new File([blob], `hamduk-${gameId.slice(0, 8)}.png`, { type: "image/png" });
      if (await nativeShare({ title: "Hamduk Chess", text, url, files: [file] })) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deliver(blob: Blob, name: string) {
    const file = new File([blob], name, { type: blob.type });
    if (await nativeShare({ title: "Hamduk Chess", text, url, files: [file] })) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  async function gif() {
    if (!pgn) return;
    setGifBusy(true);
    try {
      const t = BOARD_THEMES[boardTheme];
      const blob = await gameGif({
        pgn,
        light: t.light,
        dark: t.dark,
        orientation,
        title: headline,
      });
      await deliver(blob, `hamduk-${gameId.slice(0, 8)}.gif`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGifBusy(false);
    }
  }

  const btn =
    "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent";

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={whatsappUrl(`${text}\n${url}`)}
        target="_blank"
        rel="noreferrer"
        className={`${btn} border-[#25D366]/50 text-[#128C7E] dark:text-[#25D366]`}
      >
        <MessageCircle className="h-4 w-4" /> WhatsApp
      </a>
      <button onClick={() => void image()} disabled={busy} className={btn}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{" "}
        Image
      </button>
      {pgn && (
        <button onClick={() => void gif()} disabled={gifBusy} className={btn}>
          {gifBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Clapperboard className="h-4 w-4" />
          )}{" "}
          GIF
        </button>
      )}
      <button
        onClick={async () => {
          if (!(await nativeShare({ title: "Hamduk Chess", text, url }))) {
            toast[(await copyText(url)) ? "success" : "error"]("Link copied");
          }
        }}
        className={btn}
      >
        <Share2 className="h-4 w-4" /> Share
      </button>
      <a href={xUrl(text, url)} target="_blank" rel="noreferrer" className={btn}>
        𝕏
      </a>
      <button
        onClick={async () => toast[(await copyText(url)) ? "success" : "error"]("Link copied")}
        className={btn}
      >
        <Copy className="h-4 w-4" /> Link
      </button>
      {pgn && (
        <button
          onClick={async () => toast[(await copyText(pgn)) ? "success" : "error"]("PGN copied")}
          className={btn}
        >
          <FileText className="h-4 w-4" /> PGN
        </button>
      )}
    </div>
  );
}
