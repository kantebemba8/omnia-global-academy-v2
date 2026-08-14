import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendOmniaEmail } from "../_shared/brevo-mail.ts";

import { getActiveOmniaSessionResult } from "../_shared/omnia-auth.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-omnia-session-token",
};

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const token = (
    req.headers.get("x-omnia-session-token")
    ?? req.headers.get("Authorization")
    ?? ""
  ).replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  const { data: sess } = await getActiveOmniaSessionResult(sb, token);
  if (!sess) return json({ error: "SESSION_INVALID" }, 401);
  const userId = sess.user_id;

  const { job_id, cover_letter, cv_url } = await req.json() as { job_id: string; cover_letter?: string; cv_url?: string };
  if (!job_id) return json({ error: "MISSING_JOB_ID" }, 400);

  const { data: job } = await sb.from("job_offers")
    .select("id,title,status,deadline,applications_count,recruiter_email,application_mode,external_apply_url,external_apply_email")
    .eq("id", job_id).maybeSingle();
  if (!job || job.status !== "approved") return json({ error: "JOB_NOT_FOUND" }, 404);
  if (job.deadline && new Date(job.deadline) < new Date()) return json({ error: "DEADLINE_PASSED" }, 422);

  const { data: existing } = await sb.from("job_applications").select("id")
    .eq("job_id", job_id).eq("applicant_id", userId).maybeSingle();
  if (existing) return json({ error: "ALREADY_APPLIED" }, 409);

  await sb.from("job_applications").insert({ job_id, applicant_id: userId, cover_letter: cover_letter || null, cv_url: cv_url || null });
  await sb.from("job_offers").update({ applications_count: (job.applications_count || 0) + 1 }).eq("id", job_id);

  // Notification recruteur via le service transactionnel Omnia/Brevo.
  if (job.recruiter_email) {
    await sendOmniaEmail({
      sb,
      to: { email: String(job.recruiter_email) },
      templateKey: "status_update",
      params: {
        FORMATION_TITRE: String(job.title || "Offre d’emploi"),
        STATUT: "Nouvelle candidature",
        MESSAGE_SPECIFIQUE: "Une nouvelle candidature a été reçue. Connectez-vous à votre espace pour consulter les détails.",
        ACTION_URL: `${(Deno.env.get("APP_URL") || "https://omniaglobalacademy.com").replace(/\/$/, "")}/talent/recruteur`,
      },
    });
  }

  return json({
    success: true,
    application_mode: job.application_mode || "omnia_managed",
    external_url: job.application_mode === "external_link" ? job.external_apply_url : null,
    external_email: job.application_mode === "external_email" ? (job.external_apply_email || job.recruiter_email) : null,
  });
});
