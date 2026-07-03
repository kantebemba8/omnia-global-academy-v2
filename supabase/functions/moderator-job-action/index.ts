import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function verifyModerator(sb: ReturnType<typeof createClient>, token: string) {
  const { data: sess } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!sess) return null;
  const { data: role } = await sb.from("user_roles").select("role").eq("user_id", (sess as unknown as { user_id: string }).user_id).eq("role", "moderateur").maybeSingle();
  if (!role) return null;
  return (sess as unknown as { user_id: string }).user_id;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const modId = await verifyModerator(sb, token);
    if (!modId) return json({ error: "FORBIDDEN" }, 403);

    const { data: permsRow } = await sb.from("moderator_permissions").select("can_moderate_jobs").eq("moderator_user_id", modId).maybeSingle();
    const perms = permsRow as unknown as Record<string, boolean> | null ?? {};
    if (!perms.can_moderate_jobs) return json({ error: "FORBIDDEN", message: "Permission can_moderate_jobs requise." }, 403);

    // GET — list job offers
    if (req.method === "GET") {
      const { data: pending } = await sb.from("job_offers").select("id,title,description,location,contract_type,category,deadline,status,posted_by_id,establishment_id,created_at").eq("status", "pending_moderation").order("created_at", { ascending: true });
      const { data: approved } = await sb.from("job_offers").select("id,title,contract_type,category,status,moderated_at").eq("status", "approved").order("moderated_at", { ascending: false }).limit(20);
      const { data: rejected } = await sb.from("job_offers").select("id,title,status,moderated_at").eq("status", "rejected").order("moderated_at", { ascending: false }).limit(20);

      // Enrich pending with establishment info
      const enrichedPending = await Promise.all((pending ?? []).map(async (j) => {
        const jj = j as unknown as { id: string; title: string; description: string; location: string; contract_type: string; category: string; deadline: string; status: string; posted_by_id: string; establishment_id: string | null; created_at: string };
        let school_name = null;
        if (jj.establishment_id) {
          const { data: etab } = await sb.from("etablissement_profiles").select("school_name,logo_url").eq("id", jj.establishment_id).maybeSingle();
          school_name = (etab as unknown as { school_name: string } | null)?.school_name;
        }
        return { ...jj, school_name };
      }));

      return json({ pending_jobs: enrichedPending, approved_jobs: approved ?? [], rejected_jobs: rejected ?? [] });
    }

    // POST — approve / reject
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const body = await req.json();
    const { job_id, action, reason } = body as { job_id: string; action: "approve" | "reject"; reason?: string };
    if (!job_id || !["approve", "reject"].includes(action)) return json({ error: "INVALID_PARAMS" }, 400);

    const now = new Date().toISOString();
    await sb.from("job_offers").update({ status: action === "approve" ? "approved" : "rejected", moderated_by: modId, moderated_at: now }).eq("id", job_id);
    await sb.from("moderation_log").insert({ moderator_id: modId, action_type: action === "approve" ? "job_approved" : "job_rejected", target_type: "job_offer", target_id: job_id, comment: reason ?? null });

    return json({ success: true });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
