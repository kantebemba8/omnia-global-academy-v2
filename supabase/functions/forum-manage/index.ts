import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handler as h_create } from "../_shared/merged/forum-post-create.ts";
import { handler as h_like } from "../_shared/merged/forum-post-like.ts";
import { handler as h_pin } from "../_shared/merged/forum-post-pin.ts";
import { handler as h_reply } from "../_shared/merged/forum-post-reply.ts";
import { handler as h_report } from "../_shared/merged/forum-post-report.ts";
import { handler as h_solve } from "../_shared/merged/forum-post-solve.ts";
import { handler as h_list } from "../_shared/merged/forum-posts-list.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-omnia-session-token",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const action = new URL(req.url).searchParams.get("action") || "";
  switch (action) {
    case "create": return h_create(req);
    case "like": return h_like(req);
    case "pin": return h_pin(req);
    case "reply": return h_reply(req);
    case "report": return h_report(req);
    case "solve": return h_solve(req);
    case "list": return h_list(req);
    default: return new Response(JSON.stringify({ error: "UNKNOWN_ACTION", action }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
