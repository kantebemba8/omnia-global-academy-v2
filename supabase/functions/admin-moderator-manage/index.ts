import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handler as h_create } from "../_shared/merged/admin-moderator-create.ts";
import { handler as h_update } from "../_shared/merged/admin-moderator-update.ts";
import { handler as h_delete } from "../_shared/merged/admin-moderator-delete.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "";
  switch (action) {
    case "create": return h_create(req);
    case "update": return h_update(req);
    case "delete": return h_delete(req);
    default:
      return new Response(JSON.stringify({ error: "UNKNOWN_ACTION", action }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
