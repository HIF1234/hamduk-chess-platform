import { toast } from "sonner";
import { Copy, MessageCircle } from "lucide-react";
import { SITE_URL, copyText, whatsappUrl, xUrl } from "@/lib/share";

/** Share any page: WhatsApp, X, copy link. */
export function ShareLinks({ text, path }: { text: string; path: string }) {
  const url = `${SITE_URL}${path}`;
  const btn =
    "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent";
  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={whatsappUrl(`${text}\n${url}`)}
        target="_blank"
        rel="noreferrer"
        className={`${btn} text-[#128C7E] dark:text-[#25D366]`}
      >
        <MessageCircle className="h-4 w-4" /> WhatsApp
      </a>
      <a href={xUrl(text, url)} target="_blank" rel="noreferrer" className={btn}>
        𝕏
      </a>
      <button
        onClick={async () => toast[(await copyText(url)) ? "success" : "error"]("Link copied")}
        className={btn}
      >
        <Copy className="h-4 w-4" /> Copy link
      </button>
    </div>
  );
}
