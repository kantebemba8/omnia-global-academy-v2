import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handler as h_list } from "../_shared/merged/career-studio-list.ts";
import { handler as h_save } from "../_shared/merged/career-studio-save.ts";
import { handler as h_ai } from "../_shared/merged/career-studio-ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const action = new URL(req.url).searchParams.get("action") || "";
  switch (action) {
    case "list": return h_list(req);
    case "save": return h_save(req);
    case "ai": return h_ai(req);
    default: return new Response(JSON.stringify({ error: "UNKNOWN_ACTION", action }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
