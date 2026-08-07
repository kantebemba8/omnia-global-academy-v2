import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { getModeratorAccess, hasModeratorConflict } from "../_shared/moderator-access.ts";

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

    const access = await getModeratorAccess(sb, modId);
    if (!access.active) return json({ error: "TEAM_ACCESS_SUSPENDED", message: "Votre accès interne est suspendu ou terminé." }, 403);
    if (!access.permissions.can_manage_support) return json({ error: "FORBIDDEN", message: "Permission can_manage_support requise." }, 403);

    // GET — list tickets
    if (req.method === "GET") {
      const { data: tickets } = await sb.from("support_tickets").select("id,user_id,subject,message,status,assigned_to,resolution,created_at,updated_at").order("created_at", { ascending: false }).limit(100);

      const enriched = await Promise.all((tickets ?? []).map(async (t) => {
        const tt = t as unknown as { id: string; user_id: string; subject: string; message: string; status: string; assigned_to: string | null; resolution: string | null; created_at: string; updated_at: string };
        const { data: u } = await sb.from("users").select("full_name,email").eq("id", tt.user_id).maybeSingle();
        let assigned_name = null;
        if (tt.assigned_to) {
          const { data: au } = await sb.from("users").select("full_name").eq("id", tt.assigned_to).maybeSingle();
          assigned_name = (au as unknown as { full_name: string } | null)?.full_name;
        }
        return { ...tt, user_name: (u as unknown as { full_name: string } | null)?.full_name ?? "—", user_email: (u as unknown as { email: string } | null)?.email ?? "—", assigned_name };
      }));

      return json({ tickets: enriched });
    }

    // POST — take_charge / resolve / reply
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const body = await req.json();
    const { ticket_id, action, resolution } = body as { ticket_id: string; action: "take_charge" | "resolve" | "keep_open"; resolution?: string };
    if (!ticket_id || !["take_charge", "resolve", "keep_open"].includes(action)) return json({ error: "INVALID_PARAMS" }, 400);

    const { data: targetTicket, error: targetTicketError } = await sb.from("support_tickets").select("id,user_id,assigned_to").eq("id", ticket_id).maybeSingle();
    if (targetTicketError) throw targetTicketError;
    if (!targetTicket) return json({ error: "TICKET_NOT_FOUND" }, 404);
    if (await hasModeratorConflict(sb, modId, "support_ticket", ticket_id, [String(targetTicket.user_id)])) {
      return json({ error: "CONFLICT_OF_INTEREST", message: "Ce ticket doit être réattribué à un autre membre de l’équipe." }, 403);
    }

    const now = new Date().toISOString();
    if (action === "take_charge") {
      await sb.from("support_tickets").update({ assigned_to: modId, status: "in_progress", updated_at: now }).eq("id", ticket_id);
    } else if (action === "resolve") {
      await sb.from("support_tickets").update({ status: "resolved", resolution: resolution ?? null, updated_at: now }).eq("id", ticket_id);
    } else if (action === "keep_open") {
      await sb.from("support_tickets").update({ resolution: resolution ?? null, updated_at: now }).eq("id", ticket_id);
    }

    return json({ success: true });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
