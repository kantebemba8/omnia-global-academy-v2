import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";

function json(data: unknown, status = 410) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  return json({
    error: "LEGACY_ENDPOINT_DISABLED",
    message: "Ce point d'entrée historique a été retiré. La gestion des Codes Structure passe désormais exclusivement par structure-manage.",
    canonical_function: "structure-manage",
  });
});
