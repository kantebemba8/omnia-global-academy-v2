import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/cors.ts";

type TrackAction =
  | "list"
  | "get"
  | "prepare_job"
  | "create_manual"
  | "update_status";

const ALLOWED_STATUSES = new Set([
  "draft",
  "prepared",
  "applied",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
  "closed",
]);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function tokenFrom(req: Request) {
  return (
    req.headers.get("x-omnia-session-token") ||
    req.headers.get("Authorization") ||
    ""
  )
    .replace(/^Bearer\s+/i, "")
    .trim();
}

async function getUserId(
  sb: ReturnType<typeof createClient>,
  req: Request,
) {
  const token = tokenFrom(req);
  if (!token) return null;

  const { data: session, error } = await sb
    .from("user_sessions")
    .select("user_id")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !session) return null;

  const { data: user } = await sb
    .from("users")
    .select("id,status")
    .eq("id", session.user_id)
    .maybeSingle();

  if (!user || user.status !== "actif") return null;
  return String(user.id);
}

function relatedJob(row: Record<string, unknown>) {
  const relation = row.job_offers;
  if (Array.isArray(relation)) return relation[0] || {};
  return (relation || {}) as Record<string, unknown>;
}

function normalizeManual(row: Record<string, unknown>) {
  return {
    id: `manual-${row.id}`,
    source: "manual",
    source_id: row.id,
    editable: true,
    company_name: row.company_name,
    job_title: row.job_title,
    job_url: row.job_url,
    location: row.location,
    contract_type: row.contract_type,
    application_mode: row.application_mode,
    status: row.status || "draft",
    tracking_status: row.status || "draft",
    applied_at: row.applied_at,
    interview_at: row.interview_at,
    next_follow_up_at: row.next_follow_up_at,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizePlatform(row: Record<string, unknown>) {
  const job = relatedJob(row);
  return {
    id: `platform-${row.id}`,
    source: "platform",
    source_id: row.id,
    editable: true,
    job_id: row.job_id,
    company_name: job.recruiter_company || "Entreprise",
    job_title: job.title || "Poste",
    job_url: job.external_apply_url || null,
    location: job.location || null,
    contract_type: job.contract_type || null,
    application_mode: row.application_mode || job.application_mode || "omnia_managed",
    status: row.status || "submitted",
    tracking_status: row.tracking_status || row.status || "applied",
    applied_at: row.submitted_at,
    notes: row.applicant_notes || row.notes || null,
    created_at: row.submitted_at || row.prepared_at,
    updated_at: row.last_status_at || row.submitted_at || row.prepared_at,
  };
}

async function listApplications(
  sb: ReturnType<typeof createClient>,
  userId: string,
) {
  const [platformResult, manualResult] = await Promise.all([
    sb
      .from("job_applications")
      .select(
        "id,job_id,status,tracking_status,application_mode,submitted_at,prepared_at,last_status_at,applicant_notes,notes,job_offers(id,title,recruiter_company,location,contract_type,application_mode,external_apply_url)",
      )
      .eq("applicant_id", userId)
      .order("submitted_at", { ascending: false, nullsFirst: false }),
    sb
      .from("career_manual_applications")
      .select(
        "id,company_name,job_title,job_url,location,contract_type,application_mode,status,applied_at,interview_at,next_follow_up_at,notes,created_at,updated_at",
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }),
  ]);

  if (platformResult.error) throw platformResult.error;
  if (manualResult.error) throw manualResult.error;

  const applications = [
    ...(platformResult.data || []).map((row) =>
      normalizePlatform(row as Record<string, unknown>)
    ),
    ...(manualResult.data || []).map((row) =>
      normalizeManual(row as Record<string, unknown>)
    ),
  ].sort((a, b) =>
    String(b.updated_at || b.created_at || "").localeCompare(
      String(a.updated_at || a.created_at || ""),
    )
  );

  return applications;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  }

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const userId = await getUserId(sb, req);
    if (!userId) return json({ error: "AUTH_REQUIRED" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "list") as TrackAction;

    if (action === "list") {
      const applications = await listApplications(sb, userId);
      return json({ success: true, applications });
    }

    if (action === "get") {
      const jobId = String(body.job_id || "").trim();
      if (!jobId) return json({ error: "MISSING_JOB_ID" }, 400);

      const { data: job, error } = await sb
        .from("job_offers")
        .select(
          "id,title,description,location,contract_type,category,salary_range,required_level,skills_required,recruiter_company,recruiter_name,recruiter_email,deadline,created_at,status,application_mode,external_apply_url,external_apply_email,application_instructions",
        )
        .eq("id", jobId)
        .maybeSingle();

      if (error) throw error;

      const { data: platform } = await sb
        .from("job_applications")
        .select(
          "id,job_id,status,tracking_status,application_mode,submitted_at,prepared_at,last_status_at,applicant_notes,notes,job_offers(id,title,recruiter_company,location,contract_type,application_mode,external_apply_url)",
        )
        .eq("applicant_id", userId)
        .eq("job_id", jobId)
        .maybeSingle();

      return json({
        success: true,
        job,
        tracked: platform
          ? normalizePlatform(platform as Record<string, unknown>)
          : null,
      });
    }

    if (action === "prepare_job") {
      const jobId = String(body.job_id || "").trim();
      if (!jobId) return json({ error: "MISSING_JOB_ID" }, 400);

      const { data: job, error: jobError } = await sb
        .from("job_offers")
        .select(
          "id,title,location,contract_type,recruiter_company,application_mode,external_apply_url",
        )
        .eq("id", jobId)
        .maybeSingle();

      if (jobError) throw jobError;
      if (!job) return json({ error: "JOB_NOT_FOUND" }, 404);

      const { data: existing } = await sb
        .from("career_manual_applications")
        .select("*")
        .eq("user_id", userId)
        .eq("company_name", job.recruiter_company || "Entreprise")
        .eq("job_title", job.title)
        .limit(1)
        .maybeSingle();

      if (existing) {
        return json({
          success: true,
          application: normalizeManual(existing as Record<string, unknown>),
          job,
        });
      }

      const { data, error } = await sb
        .from("career_manual_applications")
        .insert({
          user_id: userId,
          company_name: job.recruiter_company || "Entreprise",
          job_title: job.title,
          job_url: job.external_apply_url || null,
          location: job.location || null,
          contract_type: job.contract_type || null,
          application_mode: job.application_mode || "omnia_managed",
          status: "prepared",
          notes: `Préparée depuis l'offre Omnia ${job.id}`,
        })
        .select("*")
        .single();

      if (error) throw error;

      return json({
        success: true,
        application: normalizeManual(data as Record<string, unknown>),
        job,
      });
    }

    if (action === "create_manual") {
      const companyName = String(body.company_name || "").trim();
      const jobTitle = String(body.job_title || "").trim();
      const requestedStatus = String(body.status || "draft").trim();
      const status = ALLOWED_STATUSES.has(requestedStatus)
        ? requestedStatus
        : "draft";

      if (!companyName || !jobTitle) {
        return json({
          error: "MISSING_FIELDS",
          message: "L'entreprise et le poste sont obligatoires.",
        }, 400);
      }

      const now = new Date().toISOString();
      const { data, error } = await sb
        .from("career_manual_applications")
        .insert({
          user_id: userId,
          company_name: companyName,
          job_title: jobTitle,
          job_url: body.job_url ? String(body.job_url).trim() : null,
          location: body.location ? String(body.location).trim() : null,
          contract_type: body.contract_type
            ? String(body.contract_type).trim()
            : null,
          application_mode: body.application_mode
            ? String(body.application_mode).trim()
            : "external_link",
          status,
          applied_at: status === "applied" ? now : null,
          interview_at: status === "interview" ? now : null,
          next_follow_up_at: body.next_follow_up_at || null,
          notes: body.notes ? String(body.notes).trim() : null,
        })
        .select("*")
        .single();

      if (error) throw error;

      return json({
        success: true,
        application: normalizeManual(data as Record<string, unknown>),
      });
    }

    if (action === "update_status") {
      const rawId = String(body.id || "").trim();
      const requestedStatus = String(body.status || "").trim();

      if (!rawId || !ALLOWED_STATUSES.has(requestedStatus)) {
        return json({ error: "MISSING_OR_INVALID_FIELDS" }, 400);
      }

      const now = new Date().toISOString();

      if (rawId.startsWith("platform-")) {
        const id = rawId.replace(/^platform-/, "");
        const { data, error } = await sb
          .from("job_applications")
          .update({
            tracking_status: requestedStatus,
            last_status_at: now,
          })
          .eq("id", id)
          .eq("applicant_id", userId)
          .select(
            "id,job_id,status,tracking_status,application_mode,submitted_at,prepared_at,last_status_at,applicant_notes,notes,job_offers(id,title,recruiter_company,location,contract_type,application_mode,external_apply_url)",
          )
          .single();

        if (error) throw error;

        return json({
          success: true,
          application: normalizePlatform(data as Record<string, unknown>),
        });
      }

      const id = rawId.replace(/^manual-/, "");
      const updatePayload: Record<string, unknown> = {
        status: requestedStatus,
        updated_at: now,
      };

      if (requestedStatus === "applied") updatePayload.applied_at = now;
      if (requestedStatus === "interview") updatePayload.interview_at = now;

      const { data, error } = await sb
        .from("career_manual_applications")
        .update(updatePayload)
        .eq("id", id)
        .eq("user_id", userId)
        .select("*")
        .single();

      if (error) throw error;

      return json({
        success: true,
        application: normalizeManual(data as Record<string, unknown>),
      });
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    console.error("career-application-track error", error);
    return json({
      error: "SERVER_ERROR",
      message: "Impossible de traiter le suivi des candidatures.",
    }, 500);
  }
});
