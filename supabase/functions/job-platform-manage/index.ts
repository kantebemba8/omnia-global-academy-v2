import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-omnia-session-token",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Session = {
  userId: string;
  roles: string[];
  organizationId: string | null;
  isPrimaryManager: boolean;
  permissions: Record<string, boolean>;
  recruiterApproved: boolean;
};

async function authenticate(sb: ReturnType<typeof createClient>, req: Request): Promise<Session | null> {
  const token = (req.headers.get("x-omnia-session-token") || req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const { data: session } = await sb
    .from("user_sessions")
    .select("user_id")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!session) return null;

  const userId = String(session.user_id);
  const [{ data: roles }, { data: manager }, { data: recruiter }] = await Promise.all([
    sb.from("user_roles").select("role").eq("user_id", userId),
    sb.from("partner_managers").select("organization_id,is_primary,permissions,status").eq("user_id", userId).eq("status", "actif").maybeSingle(),
    sb.from("talent_recruiter_profiles").select("recruiter_type,status").eq("user_id", userId).maybeSingle(),
  ]);

  const organizationId = manager?.organization_id ? String(manager.organization_id) : null;
  let permissions: Record<string, boolean> = (manager?.permissions as Record<string, boolean>) || {};
  if (organizationId) {
    const { data: explicit } = await sb
      .from("talent_structure_permissions")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (explicit) permissions = { ...permissions, ...explicit };
  }

  return {
    userId,
    roles: (roles || []).map((row: any) => String(row.role)),
    organizationId,
    isPrimaryManager: !!manager?.is_primary,
    permissions,
    recruiterApproved: recruiter?.recruiter_type === "independent" && recruiter?.status === "approved",
  };
}

function isSuperAdmin(session: Session) {
  return session.roles.includes("super_admin");
}

function isIndependentRecruiter(session: Session) {
  return session.recruiterApproved && session.roles.some((role) => ["recruteur_independant", "recruteur"].includes(role));
}

function canRecruit(session: Session) {
  if (isSuperAdmin(session) || isIndependentRecruiter(session) || session.isPrimaryManager) return true;
  return !!session.organizationId && ["can_post_job", "can_manage_jobs", "can_view_applications"]
    .some((permission) => session.permissions[permission] === true);
}

function can(session: Session, permission: string) {
  if (isSuperAdmin(session) || session.isPrimaryManager) return true;
  if (isIndependentRecruiter(session)) return true;
  return session.permissions[permission] === true;
}


async function commerceEntitlementOwner(sb: ReturnType<typeof createClient>, userId: string, organizationId: string | null) {
  if (!organizationId) return userId;
  const { data } = await sb.from("partner_managers").select("user_id").eq("organization_id", organizationId).eq("is_primary", true).eq("status", "actif").maybeSingle();
  return data?.user_id ? String(data.user_id) : userId;
}

async function consumeCommerceBenefit(sb: ReturnType<typeof createClient>, userId: string, organizationId: string | null, benefitKey: string, referenceType: string, referenceId: string | null = null) {
  const ownerId = await commerceEntitlementOwner(sb, userId, organizationId);
  const { data: definition } = await sb.from("commerce_benefit_definitions").select("id").eq("benefit_key", benefitKey).eq("is_active", true).maybeSingle();
  if (!definition) return { allowed: false, reason: "MONETIZATION_NOT_CONFIGURED" };
  const now = new Date().toISOString();
  const { data: rights } = await sb.from("commerce_entitlements").select("id,remaining_quantity")
    .eq("user_id", ownerId).eq("benefit_definition_id", definition.id).eq("status", "active").lte("valid_from", now)
    .or(`valid_until.is.null,valid_until.gte.${now}`).order("valid_until", { ascending: true, nullsFirst: false });
  const right = (rights || []).find((row: any) => row.remaining_quantity === null || Number(row.remaining_quantity) >= 1);
  if (!right) return { allowed: false, reason: "SUBSCRIPTION_OR_PACK_REQUIRED" };
  if (right.remaining_quantity !== null) {
    const remaining = Number(right.remaining_quantity) - 1;
    await sb.from("commerce_entitlements").update({ remaining_quantity: remaining, status: remaining <= 0 ? "exhausted" : "active" }).eq("id", right.id);
  }
  await sb.from("commerce_usage_ledger").insert({ entitlement_id: right.id, user_id: ownerId, quantity: 1, module_key: "talent", action_key: benefitKey, reference_type: referenceType, reference_id: referenceId });
  return { allowed: true };
}

function validApplicationMode(value: unknown) {
  const mode = String(value || "omnia_managed");
  return ["omnia_managed", "external_link", "external_email"].includes(mode) ? mode : "omnia_managed";
}

function cleanJob(input: any) {
  const mode = validApplicationMode(input?.application_mode);
  return {
    title: String(input?.title || "").trim(),
    description: String(input?.description || "").trim(),
    location: String(input?.location || "").trim() || null,
    contract_type: String(input?.contract_type || "").trim() || null,
    category: String(input?.category || "").trim() || null,
    deadline: input?.deadline || null,
    salary_range: String(input?.salary_range || "").trim() || null,
    required_level: String(input?.required_level || "").trim() || null,
    skills_required: Array.isArray(input?.skills_required)
      ? input.skills_required.map((value: unknown) => String(value).trim()).filter(Boolean)
      : [],
    recruiter_name: String(input?.recruiter_name || "").trim() || null,
    recruiter_email: String(input?.recruiter_email || "").trim().toLowerCase() || null,
    recruiter_company: String(input?.recruiter_company || "").trim() || null,
    application_mode: mode,
    external_apply_url: mode === "external_link" ? String(input?.external_apply_url || "").trim() || null : null,
    external_apply_email: mode === "external_email" ? String(input?.external_apply_email || "").trim().toLowerCase() || null : null,
    application_instructions: String(input?.application_instructions || "").trim() || null,
  };
}

async function ownedJobIds(sb: ReturnType<typeof createClient>, session: Session) {
  let query = sb.from("job_offers").select("id");
  if (session.organizationId) query = query.eq("organization_id", session.organizationId);
  else query = query.eq("posted_by_id", session.userId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row: any) => String(row.id));
}

async function getOwnedJob(sb: ReturnType<typeof createClient>, session: Session, jobId: string) {
  let query = sb.from("job_offers").select("*").eq("id", jobId);
  if (session.organizationId) query = query.eq("organization_id", session.organizationId);
  else if (!isSuperAdmin(session)) query = query.eq("posted_by_id", session.userId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data || null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!url || !serviceKey) return json({ error: "SERVER_CONFIG_ERROR" }, 500);

    const sb = createClient(url, serviceKey);
    const session = await authenticate(sb, req);
    if (!session) return json({ error: "SESSION_INVALID", message: "Session requise." }, 401);
    if (!canRecruit(session)) return json({ error: "FORBIDDEN", message: "Accès recrutement non autorisé." }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    if (action === "admin_list_jobs") {
      if (!isSuperAdmin(session)) return json({ error: "FORBIDDEN" }, 403);
      const { data, error } = await sb.from("job_offers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const jobs = (data || []).map((job: any) => ({
        ...job,
        created_by_role: job.created_by_role || (job.organization_id ? "structure" : job.is_external_recruiter ? "recruteur_externe" : "plateforme"),
      }));
      return json({ success: true, jobs });
    }

    if (action === "admin_decide_job") {
      if (!isSuperAdmin(session)) return json({ error: "FORBIDDEN" }, 403);
      const jobId = String(body.job_id || "");
      const decision = String(body.decision || "");
      const reason = String(body.reason || "").trim();
      const statusByDecision: Record<string, string> = {
        approve: "approved",
        reject: "rejected",
        changes_requested: "changes_requested",
        suspend: "suspended",
        archive: "archived",
      };
      if (!jobId || !statusByDecision[decision]) return json({ error: "INVALID_DECISION" }, 400);
      if (["reject", "changes_requested"].includes(decision) && !reason) {
        return json({ error: "REASON_REQUIRED", message: "Un commentaire est requis pour cette décision." }, 400);
      }
      const now = new Date().toISOString();
      const { data: job, error } = await sb.from("job_offers").update({
        status: statusByDecision[decision],
        moderated_by: session.userId,
        moderated_at: now,
        updated_at: now,
        rejection_reason: ["reject", "changes_requested"].includes(decision) ? reason : null,
      }).eq("id", jobId).select("*").maybeSingle();
      if (error) throw error;
      if (!job) return json({ error: "JOB_NOT_FOUND" }, 404);
      const { error: logError } = await sb.from("moderation_log").insert({
        moderator_id: session.userId,
        action_type: `job_${decision}`,
        target_type: "job_offer",
        target_id: jobId,
        comment: reason || null,
      });
      if (logError) console.error("job-platform-manage: moderation log failed", logError.message);
      return json({ success: true, job });
    }

    if (action === "list_my_jobs") {
      let query = sb.from("job_offers").select("*").order("created_at", { ascending: false });
      if (session.organizationId) query = query.eq("organization_id", session.organizationId);
      else if (!isSuperAdmin(session)) query = query.eq("posted_by_id", session.userId);
      else query = query.eq("posted_by_id", session.userId);
      const { data, error } = await query;
      if (error) throw error;
      return json({ success: true, jobs: data || [] });
    }

    if (action === "create_job") {
      if (!can(session, "can_post_job")) return json({ error: "PERMISSION_DENIED" }, 403);
      const job = cleanJob(body.job || body);
      if (job.title.length < 3 || job.description.length < 20) {
        return json({ error: "INVALID_JOB", message: "Le titre et une description détaillée sont requis." }, 400);
      }
      if (job.application_mode === "external_link" && !job.external_apply_url) {
        return json({ error: "EXTERNAL_URL_REQUIRED", message: "Le lien externe est requis." }, 400);
      }
      if (job.application_mode === "external_email" && !job.external_apply_email) {
        return json({ error: "EXTERNAL_EMAIL_REQUIRED", message: "L’email externe est requis." }, 400);
      }
      if (!isSuperAdmin(session)) {
        const commercial = await consumeCommerceBenefit(sb, session.userId, session.organizationId, "recruiter_job_posts", "job_offer");
        if (!commercial.allowed) return json({ error: commercial.reason, message: "Un droit de publication recruteur est requis." }, 402);
      }

      const { data, error } = await sb.from("job_offers").insert({
        ...job,
        posted_by_id: session.userId,
        organization_id: session.organizationId,
        is_external_recruiter: isIndependentRecruiter(session),
        created_by_role: isSuperAdmin(session) ? "super_admin" : session.organizationId ? "structure" : "recruteur_independant",
        status: "pending_moderation",
        updated_at: new Date().toISOString(),
      }).select("*").single();
      if (error) throw error;
      return json({ success: true, job: data, message: "Offre transmise au Super-admin pour validation." });
    }

    if (action === "update_job") {
      if (!can(session, "can_manage_jobs")) return json({ error: "PERMISSION_DENIED" }, 403);
      const jobId = String(body.job_id || "");
      if (!jobId) return json({ error: "JOB_REQUIRED" }, 400);
      const existing = await getOwnedJob(sb, session, jobId);
      if (!existing) return json({ error: "JOB_NOT_FOUND" }, 404);
      const job = cleanJob(body.job || body);
      if (job.title.length < 3 || job.description.length < 20) return json({ error: "INVALID_JOB" }, 400);
      const { data, error } = await sb.from("job_offers").update({
        ...job,
        status: existing.status === "approved" ? "pending_moderation" : existing.status,
        updated_at: new Date().toISOString(),
      }).eq("id", jobId).select("*").single();
      if (error) throw error;
      return json({ success: true, job: data });
    }

    if (action === "archive_job") {
      if (!can(session, "can_manage_jobs")) return json({ error: "PERMISSION_DENIED" }, 403);
      const jobId = String(body.job_id || "");
      const existing = await getOwnedJob(sb, session, jobId);
      if (!existing) return json({ error: "JOB_NOT_FOUND" }, 404);
      const { error } = await sb.from("job_offers").update({ status: "archived", updated_at: new Date().toISOString() }).eq("id", jobId);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "list_applications") {
      if (!can(session, "can_view_applications")) return json({ error: "PERMISSION_DENIED" }, 403);
      const jobIds = await ownedJobIds(sb, session);
      if (!jobIds.length) return json({ success: true, applications: [] });
      const { data: applications, error } = await sb
        .from("job_applications")
        .select("*")
        .in("job_id", jobIds)
        .order("submitted_at", { ascending: false });
      if (error) throw error;

      const userIds = [...new Set((applications || []).map((row: any) => row.applicant_id).filter(Boolean))];
      const [{ data: users }, { data: jobs }] = await Promise.all([
        userIds.length ? sb.from("users").select("id,full_name").in("id", userIds) : Promise.resolve({ data: [] as any[] }),
        sb.from("job_offers").select("id,title,application_mode").in("id", jobIds),
      ]);
      const userMap = new Map((users || []).map((row: any) => [String(row.id), row]));
      const jobMap = new Map((jobs || []).map((row: any) => [String(row.id), row]));
      return json({
        success: true,
        applications: (applications || []).map((row: any) => ({
          ...row,
          users: userMap.get(String(row.applicant_id)) || null,
          job_offers: jobMap.get(String(row.job_id)) || null,
        })),
      });
    }

    if (action === "update_application_status") {
      if (!can(session, "can_view_applications")) return json({ error: "PERMISSION_DENIED" }, 403);
      const applicationId = String(body.application_id || "");
      const status = String(body.status || "");
      const allowed = ["received", "viewed", "under_review", "shortlisted", "interview", "accepted", "rejected", "archived"];
      if (!applicationId || !allowed.includes(status)) return json({ error: "INVALID_STATUS" }, 400);
      const { data: application } = await sb.from("job_applications").select("id,job_id").eq("id", applicationId).maybeSingle();
      if (!application) return json({ error: "APPLICATION_NOT_FOUND" }, 404);
      const job = await getOwnedJob(sb, session, String(application.job_id));
      if (!job) return json({ error: "FORBIDDEN" }, 403);
      const { data, error } = await sb.from("job_applications").update({
        tracking_status: status,
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: session.userId,
      }).eq("id", applicationId).select("*").single();
      if (error) throw error;
      return json({ success: true, application: data });
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    console.error("job-platform-manage", error);
    return json({ error: "SERVER_ERROR", message: error instanceof Error ? error.message : String(error) }, 500);
  }
});
