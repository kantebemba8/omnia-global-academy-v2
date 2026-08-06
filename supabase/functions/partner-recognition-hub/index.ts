import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-omnia-session-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STRUCTURE_MANAGER_ROLES = new Set([
  "gestionnaire_partenaire",
  "gestionnaire_structure",
  "responsable_structure",
  "structure_admin",
  "directeur",
  "etablissement_directeur",
]);

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

async function session(sb: any, token: string) {
  const { data: activeSession, error: sessionError } = await sb
    .from("user_sessions")
    .select("user_id")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (sessionError || !activeSession) return null;

  const { data: roles, error: rolesError } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", activeSession.user_id);
  if (rolesError) throw rolesError;

  return {
    userId: String(activeSession.user_id),
    roles: (roles || []).map((row: any) => String(row.role).toLowerCase()),
  };
}

const clean = (source: Record<string, unknown>, keys: string[]) => Object.fromEntries(
  keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]),
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const token = (req.headers.get("x-omnia-session-token") || req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const me = await session(sb, token);
    if (!me) return json({ error: "SESSION_INVALID" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const admin = me.roles.includes("super_admin");
    const structureManager = me.roles.some((role: string) => STRUCTURE_MANAGER_ROLES.has(role));

    async function managerOrganizationId() {
      if (!structureManager) return null;
      const { data, error } = await sb
        .from("partner_managers")
        .select("organization_id")
        .eq("user_id", me.userId)
        .in("status", ["actif", "active"])
        .order("is_primary", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error("partner_managers lookup failed", error);
        return null;
      }
      return data?.organization_id ? String(data.organization_id) : null;
    }

    async function partnerAccess(partnerId: string) {
      if (admin) return true;
      if (!structureManager || !partnerId) return false;

      const organizationId = await managerOrganizationId();
      if (!organizationId) return false;

      const { data: partner, error } = await sb
        .from("recognition_partners")
        .select("linked_organization_id")
        .eq("id", partnerId)
        .maybeSingle();
      if (error || !partner?.linked_organization_id) return false;
      return String(partner.linked_organization_id) === organizationId;
    }

    async function audit(
      partnerId: string | null,
      entityType: string,
      entityId: string | null,
      auditAction: string,
      details: Record<string, unknown> = {},
    ) {
      const { error } = await sb.from("recognition_audit_log").insert({
        partner_id: partnerId,
        entity_type: entityType,
        entity_id: entityId,
        action: auditAction,
        actor_id: me.userId,
        details,
      });
      if (error) console.error("recognition audit failed", error);
    }

    if (action === "dashboard") {
      if (!admin) return json({ error: "FORBIDDEN" }, 403);
      const [partnersR, agreementsR, programsR, logosR, submissionsR, coursesR, orgsR] = await Promise.all([
        sb.from("recognition_partners").select("*").order("created_at", { ascending: false }),
        sb.from("recognition_agreements").select("*").order("created_at", { ascending: false }),
        sb.from("recognition_programs").select("*,courses(title)").order("created_at", { ascending: false }),
        sb.from("recognition_logo_permissions").select("*").order("created_at", { ascending: false }),
        sb.from("recognition_submissions").select("*").order("created_at", { ascending: false }),
        sb.from("courses").select("id,title,status").order("title").limit(500),
        sb.from("partner_organizations").select("id,org_name,status").order("org_name").limit(500),
      ]);
      const fatal = [partnersR, agreementsR, programsR, logosR, submissionsR, coursesR].find((r) => r.error);
      if (fatal?.error) throw fatal.error;
      return json({
        success: true,
        partners: partnersR.data || [], agreements: agreementsR.data || [], programs: programsR.data || [],
        logo_permissions: logosR.data || [], submissions: submissionsR.data || [], courses: coursesR.data || [],
        organizations: orgsR.data || [],
        warnings: orgsR.error ? ["STRUCTURE_DIRECTORY_UNAVAILABLE"] : [],
      });
    }

    if (action === "my_workspace") {
      if (!structureManager && !admin) return json({ error: "FORBIDDEN" }, 403);
      let partnerId = body.partner_id ? String(body.partner_id) : "";

      if (!partnerId && !admin) {
        const organizationId = await managerOrganizationId();
        if (!organizationId) return json({ success: true, partner: null });
        const { data: partner, error } = await sb
          .from("recognition_partners")
          .select("id")
          .eq("linked_organization_id", organizationId)
          .maybeSingle();
        if (error) throw error;
        if (!partner) return json({ success: true, partner: null });
        partnerId = String(partner.id);
      }

      if (!partnerId || !(await partnerAccess(partnerId))) return json({ error: "FORBIDDEN" }, 403);
      const [partnerR, agreementsR, programsR, logosR, submissionsR] = await Promise.all([
        sb.from("recognition_partners").select("*").eq("id", partnerId).single(),
        sb.from("recognition_agreements").select("*").eq("partner_id", partnerId),
        sb.from("recognition_programs").select("*,courses(title)").eq("partner_id", partnerId),
        sb.from("recognition_logo_permissions").select("*").eq("partner_id", partnerId),
        sb.from("recognition_submissions").select("*").eq("partner_id", partnerId).order("created_at", { ascending: false }),
      ]);
      const fatal = [partnerR, agreementsR, programsR, logosR, submissionsR].find((r) => r.error);
      if (fatal?.error) throw fatal.error;
      return json({ success: true, partner: partnerR.data, agreements: agreementsR.data || [], programs: programsR.data || [], logo_permissions: logosR.data || [], submissions: submissionsR.data || [] });
    }

    if (action === "save_partner") {
      if (!admin) return json({ error: "FORBIDDEN" }, 403);
      const fields: any = clean(body, ["linked_organization_id", "name", "slug", "partner_type", "description", "logo_url", "website", "country_code", "territories", "contact_name", "contact_title", "contact_email", "contact_phone", "status", "publication_status", "start_date", "end_date", "renewal_date", "fee_amount", "fee_currency", "validation_process", "audit_process", "required_documents", "metadata"]);
      fields.name = String(fields.name || "").trim();
      fields.slug = String(fields.slug || "").trim().toLowerCase();
      if (!fields.name || !fields.slug || !fields.partner_type) return json({ error: "MISSING_REQUIRED_FIELDS" }, 400);
      const query = body.id
        ? sb.from("recognition_partners").update(fields).eq("id", body.id)
        : sb.from("recognition_partners").insert({ ...fields, created_by: me.userId });
      const { data, error } = await query.select("*").single();
      if (error) throw error;
      await audit(data.id, "partner", data.id, body.id ? "updated" : "created");
      return json({ success: true, partner: data });
    }

    if (action === "set_partner_status") {
      if (!admin) return json({ error: "FORBIDDEN" }, 403);
      const allowed = ["preparation", "pending", "active", "suspended", "expired", "ended", "rejected"];
      if (!allowed.includes(body.status)) return json({ error: "INVALID_STATUS" }, 400);
      const patch: any = { status: body.status };
      if (body.status === "active") {
        patch.approved_by = me.userId;
        patch.approved_at = new Date().toISOString();
      }
      const { error } = await sb.from("recognition_partners").update(patch).eq("id", body.partner_id);
      if (error) throw error;
      await audit(body.partner_id, "partner", body.partner_id, "status_changed", { status: body.status, reason: body.reason });
      return json({ success: true });
    }

    if (action === "save_agreement") {
      const partnerId = String(body.partner_id || "");
      if (!(await partnerAccess(partnerId))) return json({ error: "FORBIDDEN" }, 403);
      const fields: any = clean(body, ["partner_id", "agreement_type", "reference", "title", "status", "document_url", "signed_at", "start_date", "end_date", "renewal_terms", "notes"]);
      if (!fields.title) return json({ error: "TITLE_REQUIRED" }, 400);
      const query = body.id
        ? sb.from("recognition_agreements").update(fields).eq("id", body.id).eq("partner_id", partnerId)
        : sb.from("recognition_agreements").insert({ ...fields, created_by: me.userId });
      const { data, error } = await query.select("*").single();
      if (error) throw error;
      await audit(partnerId, "agreement", data.id, body.id ? "updated" : "created");
      return json({ success: true, item: data });
    }

    if (action === "save_program") {
      if (!admin) return json({ error: "FORBIDDEN" }, 403);
      const fields: any = clean(body, ["partner_id", "course_id", "title", "recognition_type", "status", "certificate_label", "credit_value", "credit_unit", "validity_months", "effective_from", "effective_until", "renewal_date", "validation_rules", "required_evidence", "decision_notes"]);
      if (!fields.partner_id || !fields.title || !fields.recognition_type) return json({ error: "MISSING_REQUIRED_FIELDS" }, 400);
      if (fields.status === "approved") {
        fields.approved_by = me.userId;
        fields.approved_at = new Date().toISOString();
      }
      const query = body.id
        ? sb.from("recognition_programs").update(fields).eq("id", body.id)
        : sb.from("recognition_programs").insert({ ...fields, created_by: me.userId });
      const { data, error } = await query.select("*").single();
      if (error) throw error;
      await audit(body.partner_id, "program", data.id, body.id ? "updated" : "created");
      return json({ success: true, item: data });
    }

    if (action === "save_logo_permission") {
      if (!admin) return json({ error: "FORBIDDEN" }, 403);
      const fields: any = clean(body, ["partner_id", "program_id", "scope", "status", "permitted_uses", "prohibited_uses", "brand_guidelines_url", "valid_from", "valid_until", "conditions"]);
      if (fields.status === "authorized") {
        fields.approved_by = me.userId;
        fields.approved_at = new Date().toISOString();
      }
      const query = body.id
        ? sb.from("recognition_logo_permissions").update(fields).eq("id", body.id)
        : sb.from("recognition_logo_permissions").insert(fields);
      const { data, error } = await query.select("*").single();
      if (error) throw error;
      await audit(body.partner_id, "logo_permission", data.id, body.id ? "updated" : "created");
      return json({ success: true, item: data });
    }

    if (action === "submit_evidence") {
      const partnerId = String(body.partner_id || "");
      if (!(await partnerAccess(partnerId))) return json({ error: "FORBIDDEN" }, 403);
      const { data, error } = await sb.from("recognition_submissions").insert({
        partner_id: partnerId,
        program_id: body.program_id || null,
        submission_type: body.submission_type || "evidence",
        status: "submitted",
        submitted_documents: body.submitted_documents || [],
        message: body.message || null,
        submitted_by: me.userId,
        submitted_at: new Date().toISOString(),
      }).select("*").single();
      if (error) throw error;
      await audit(partnerId, "submission", data.id, "submitted");
      return json({ success: true, item: data });
    }

    if (action === "review_submission") {
      if (!admin) return json({ error: "FORBIDDEN" }, 403);
      const status = body.status;
      if (!["under_review", "changes_requested", "accepted", "rejected"].includes(status)) return json({ error: "INVALID_STATUS" }, 400);
      const { data, error } = await sb.from("recognition_submissions").update({
        status,
        response_message: body.response_message || null,
        reviewed_by: me.userId,
        reviewed_at: new Date().toISOString(),
      }).eq("id", body.id).select("*").single();
      if (error) throw error;
      await audit(data.partner_id, "submission", data.id, "reviewed", { status });
      return json({ success: true, item: data });
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: "SERVER_ERROR", message: error instanceof Error ? error.message : "Erreur serveur" }, 500);
  }
});
