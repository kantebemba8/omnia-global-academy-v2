import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/cors.ts";

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifySession(sb: ReturnType<typeof createClient>, token: string) {
  const { data: sess } = await sb.from("user_sessions")
    .select("user_id")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!sess) return null;
  const userId = (sess as { user_id: string }).user_id;
  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", userId);
  return { user_id: userId, roles: (roles ?? []).map((r: { role: string }) => r.role) };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const token = (req.headers.get("x-omnia-session-token") ?? req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const session = await verifySession(sb, token);
    if (!session) return json({ error: "SESSION_INVALID" }, 401);

    const { user_id, roles } = session;
    const isSuperAdmin = roles.includes("super_admin");
    const isManager = roles.includes("gestionnaire_partenaire");
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ── GET : liste des organisations (super-admin) ──────────
    if (req.method === "GET") {
      if (!isSuperAdmin) return json({ error: "FORBIDDEN" }, 403);
      const url = new URL(req.url);
      const status = url.searchParams.get("status");
      let query = sb.from("partner_organizations").select("*, partner_managers(user_id, is_primary, role_in_org, users(full_name, email))").order("created_at", { ascending: false });
      if (status) query = query.eq("status", status);
      const { data } = await query;
      return json({ organizations: data ?? [] });
    }

    // ── Action REGISTER : inscription organisation ───────────
    if (action === "register") {
      const {
        org_name, org_type, country, city, address, phone, email, website,
        description, main_need, logo_url, justificatif_url,
        contact_name, contact_function, contact_email, contact_phone,
      } = body;

      if (!org_name || !org_type || !contact_name || !contact_email) {
        return json({ error: "MISSING_REQUIRED_FIELDS" }, 400);
      }

      // Créer l'organisation
      const { data: org, error: orgError } = await sb.from("partner_organizations").insert({
        org_name, org_type, country: country || null, city, address,
        phone, email, website, description, main_need,
        logo_url, justificatif_url,
        contact_name, contact_function, contact_email, contact_phone,
        status: "pending",
      }).select("id, org_name").single();

      if (orgError) throw orgError;

      // Lier le créateur comme gestionnaire principal
      await sb.from("partner_managers").insert({
        organization_id: org.id,
        user_id,
        role_in_org: "gestionnaire_principal",
        is_primary: true,
        status: "actif",
      });

      // Mettre à jour le rôle utilisateur
      await sb.from("user_roles").upsert({
        user_id,
        role: "gestionnaire_partenaire",
      }, { onConflict: "user_id,role", ignoreDuplicates: true });

      // Notifier le super-admin (fire-and-forget)
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/notify-admin`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "new_partner_org", org_id: org.id, org_name: org.org_name }),
      }).catch(() => {});

      return json({ success: true, organization: org, message: "Votre demande a été envoyée au super-admin pour validation." });
    }

    // ── Action VALIDATE : super-admin valide ─────────────────
    if (action === "validate" || action === "refuse" || action === "suspend" || action === "request_modification") {
      if (!isSuperAdmin) return json({ error: "FORBIDDEN" }, 403);
      const { org_id, reason, note } = body;
      if (!org_id) return json({ error: "ORG_ID_REQUIRED" }, 400);

      const statusMap: Record<string, string> = {
        validate: "validated",
        refuse: "refused",
        suspend: "suspended",
        request_modification: "modification_requested",
      };

      await sb.from("partner_organizations").update({
        status: statusMap[action],
        validated_by: action === "validate" ? user_id : undefined,
        validated_at: action === "validate" ? new Date().toISOString() : undefined,
        rejection_reason: reason,
        modification_note: note,
        updated_at: new Date().toISOString(),
      }).eq("id", org_id);

      return json({ success: true, action, org_id });
    }

    // ── Action GET_MY_ORG : gestionnaire voit son organisation
    if (action === "get_my_org") {
      if (!isManager && !isSuperAdmin) return json({ error: "FORBIDDEN" }, 403);
      const { data: managerLink } = await sb.from("partner_managers")
        .select("organization_id, role_in_org, is_primary, permissions")
        .eq("user_id", user_id)
        .maybeSingle();
      if (!managerLink) return json({ error: "NOT_A_MANAGER" }, 403);

      const { data: org } = await sb.from("partner_organizations")
        .select("*")
        .eq("id", (managerLink as { organization_id: string }).organization_id)
        .maybeSingle();

      const { data: managers } = await sb.from("partner_managers")
        .select("*, users(full_name, email, phone_number)")
        .eq("organization_id", (managerLink as { organization_id: string }).organization_id);

      const { data: members } = await sb.from("partner_code_users")
        .select("*, users(full_name, email), partner_codes(code)")
        .eq("organization_id", (managerLink as { organization_id: string }).organization_id);

      return json({ organization: org, managers: managers ?? [], members: members ?? [], my_role: managerLink });
    }

    // ── Action UPDATE : modifier l'organisation ──────────────
    if (action === "update") {
      const { org_id, ...fields } = body;
      if (!org_id) return json({ error: "ORG_ID_REQUIRED" }, 400);

      // Vérifier que l'utilisateur est gestionnaire principal ou super-admin
      if (!isSuperAdmin) {
        const { data: managerCheck } = await sb.from("partner_managers")
          .select("is_primary")
          .eq("organization_id", org_id)
          .eq("user_id", user_id)
          .maybeSingle();
        if (!managerCheck || !(managerCheck as { is_primary: boolean }).is_primary) {
          return json({ error: "FORBIDDEN" }, 403);
        }
      }

      const allowedFields = ["org_name", "org_type", "city", "address", "phone", "email", "website", "description", "logo_url", "contact_name", "contact_function", "contact_email", "contact_phone", "main_need"];
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const key of allowedFields) {
        if (fields[key] !== undefined) updateData[key] = fields[key];
      }

      await sb.from("partner_organizations").update(updateData).eq("id", org_id);
      return json({ success: true, action: "updated" });
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);

  } catch (err) {
    console.error("partner-org-manage error:", err);
    return json({ error: "SERVER_ERROR", message: (err as Error).message }, 500);
  }
});