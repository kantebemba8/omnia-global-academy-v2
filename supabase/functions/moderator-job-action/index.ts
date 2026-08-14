import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { getModeratorAccess, hasModeratorConflict } from "../_shared/moderator-access.ts";

import { getActiveOmniaSessionResult } from "../_shared/omnia-auth.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Omnia-Session-Token, X-Client-Info, Apikey",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sessionToken(req: Request) {
  return (
    req.headers.get("x-omnia-session-token") ??
    (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "")
  ).trim();
}

async function verifyModerator(sb: ReturnType<typeof createClient>, token: string) {
  const { data: session, error: sessionError } = await getActiveOmniaSessionResult(sb, token);
  if (sessionError) throw sessionError;
  if (!session) return null;

  const { data: role, error: roleError } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user_id)
    .eq("role", "moderateur")
    .maybeSingle();
  if (roleError) throw roleError;
  return role ? String(session.user_id) : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const token = sessionToken(req);
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const moderatorId = await verifyModerator(sb, token);
    if (!moderatorId) return json({ error: "FORBIDDEN" }, 403);

    const access = await getModeratorAccess(sb, moderatorId);
    if (!access.active) return json({ error: "TEAM_ACCESS_SUSPENDED", message: "Votre accès interne est suspendu ou terminé." }, 403);
    if (!access.permissions.can_moderate_jobs) {
      return json({ error: "FORBIDDEN", message: "Permission de modération des offres requise." }, 403);
    }

    if (req.method === "GET") {
      const [{ data: pending, error: pendingError }, { data: approved, error: approvedError }, { data: rejected, error: rejectedError }] = await Promise.all([
        sb.from("job_offers").select("*").eq("status", "pending_moderation").order("created_at", { ascending: true }),
        sb.from("job_offers").select("id,title,contract_type,category,status,moderated_at").eq("status", "approved").order("moderated_at", { ascending: false }).limit(20),
        sb.from("job_offers").select("id,title,status,moderated_at,rejection_reason").eq("status", "rejected").order("moderated_at", { ascending: false }).limit(20),
      ]);
      if (pendingError) throw pendingError;
      if (approvedError) throw approvedError;
      if (rejectedError) throw rejectedError;

      const organizationIds = [...new Set((pending ?? []).map((job) => job.organization_id).filter(Boolean))] as string[];
      const establishmentIds = [...new Set((pending ?? []).map((job) => job.establishment_id).filter(Boolean))] as string[];

      const organizationMap = new Map<string, { name: string | null; logo: string | null }>();
      if (organizationIds.length) {
        const { data: organizations, error: organizationsError } = await sb
          .from("partner_organizations")
          .select("id,org_name,logo_url")
          .in("id", organizationIds);
        if (organizationsError) throw organizationsError;
        for (const organization of organizations ?? []) {
          organizationMap.set(String(organization.id), {
            name: organization.org_name ? String(organization.org_name) : null,
            logo: organization.logo_url ? String(organization.logo_url) : null,
          });
        }
      }

      const legacyMap = new Map<string, { name: string | null; logo: string | null }>();
      if (establishmentIds.length) {
        const { data: establishments, error: establishmentsError } = await sb
          .from("etablissement_profiles")
          .select("id,school_name,logo_url")
          .in("id", establishmentIds);
        if (establishmentsError) {
          console.warn("[moderator-job-action] legacy establishments unavailable:", establishmentsError.message);
        } else {
          for (const establishment of establishments ?? []) {
            legacyMap.set(String(establishment.id), {
              name: establishment.school_name ? String(establishment.school_name) : null,
              logo: establishment.logo_url ? String(establishment.logo_url) : null,
            });
          }
        }
      }

      const pendingJobs = (pending ?? []).map((job) => {
        const organization = job.organization_id ? organizationMap.get(String(job.organization_id)) : undefined;
        const legacy = job.establishment_id ? legacyMap.get(String(job.establishment_id)) : undefined;
        return {
          ...job,
          issuer_name: organization?.name ?? legacy?.name ?? job.recruiter_company ?? null,
          issuer_logo_url: organization?.logo ?? legacy?.logo ?? null,
        };
      });

      return json({
        pending_jobs: pendingJobs,
        approved_jobs: approved ?? [],
        rejected_jobs: rejected ?? [],
      });
    }

    if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

    const body = await req.json().catch(() => ({}));
    const jobId = String(body.job_id || "").trim();
    const action = String(body.action || "");
    const reason = String(body.reason || "").trim();
    if (!jobId || !["approve", "reject"].includes(action)) {
      return json({ error: "INVALID_PARAMS", message: "Action ou offre invalide." }, 400);
    }
    if (action === "reject" && !reason) {
      return json({ error: "REASON_REQUIRED", message: "Le motif du rejet est obligatoire." }, 400);
    }

    const { data: targetJob, error: targetJobError } = await sb.from("job_offers").select("id,posted_by_id,status").eq("id", jobId).maybeSingle();
    if (targetJobError) throw targetJobError;
    if (!targetJob) return json({ error: "JOB_NOT_FOUND", message: "Offre introuvable." }, 404);
    if (await hasModeratorConflict(sb, moderatorId, "job_offer", jobId, [String(targetJob.posted_by_id)])) {
      return json({ error: "CONFLICT_OF_INTEREST", message: "Cette offre doit être réattribuée à un autre membre de l’équipe." }, 403);
    }

    const now = new Date().toISOString();
    const { data: job, error: updateError } = await sb
      .from("job_offers")
      .update({
        status: action === "approve" ? "approved" : "rejected",
        moderated_by: moderatorId,
        moderated_at: now,
        updated_at: now,
        rejection_reason: action === "reject" ? reason : null,
      })
      .eq("id", jobId)
      .eq("status", "pending_moderation")
      .select("id")
      .maybeSingle();
    if (updateError) throw updateError;
    if (!job) return json({ error: "JOB_NOT_FOUND", message: "Offre introuvable ou déjà traitée." }, 404);

    const { error: logError } = await sb.from("moderation_log").insert({
      moderator_id: moderatorId,
      action_type: action === "approve" ? "job_approved" : "job_rejected",
      target_type: "job_offer",
      target_id: jobId,
      comment: action === "reject" ? reason : null,
    });
    if (logError) console.error("[moderator-job-action] moderation log:", logError.message);

    return json({ success: true });
  } catch (error) {
    console.error("[moderator-job-action]", error);
    return json({ error: "SERVER_ERROR", message: error instanceof Error ? error.message : String(error) }, 500);
  }
});
