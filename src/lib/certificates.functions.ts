import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Public verification lookup for a course-path certificate -- the page a QR code on the
 * mobile-rendered PDF points at. Reads with the service role (no public RLS policy exists
 * on certificates); a random UUID is the only way in, so this never lists or enumerates. */
export const getCertificate = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("certificates")
      .select("id, piece_name, unit_title, player_name, issued_at")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) return { error: "not_found" as const };
    return { certificate: row };
  });
