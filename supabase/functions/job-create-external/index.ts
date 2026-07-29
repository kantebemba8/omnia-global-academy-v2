import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const body = await req.json() as {
    company_name: string; contact_name: string; contact_email: string; contact_phone?: string;
    job_title: string; job_description: string; location: string; contract_type: string;
    category: string; salary_range?: string; deadline?: string; skills_required?: string[];
    required_level?: string;
  };

  const { company_name, contact_name, contact_email, job_title, job_description, location, contract_type, category } = body;
  if (!company_name || !contact_name || !contact_email || !job_title || !job_description) {
    return json({ error: "MISSING_REQUIRED_FIELDS" }, 400);
  }
  if (job_description.length < 100) return json({ error: "DESCRIPTION_TOO_SHORT", min: 100 }, 422);

  // Enregistrer le contact recruteur s’il n’existe pas encore.
  const { data: existing, error: recruiterLookupError } = await sb.from("external_recruiters").select("id").eq("contact_email", contact_email).maybeSingle();
  if (recruiterLookupError) return json({ error: "RECRUITER_LOOKUP_FAILED", message: recruiterLookupError.message }, 500);
  if (!existing) {
    const { error: recruiterError } = await sb.from("external_recruiters").insert({
      company_name, contact_name, contact_email, contact_phone: body.contact_phone || null,
    });
    if (recruiterError) return json({ error: "RECRUITER_CREATION_FAILED", message: recruiterError.message }, 500);
  }

  const { error: jobError } = await sb.from("job_offers").insert({
    posted_by_id: null,
    title: job_title,
    description: job_description,
    location: location || "",
    contract_type: contract_type || "CDI",
    category: category || "",
    salary_range: body.salary_range || null,
    deadline: body.deadline || null,
    skills_required: body.skills_required || null,
    required_level: body.required_level || null,
    status: "pending_moderation",
    is_external_recruiter: true,
    recruiter_company: company_name,
    recruiter_name: contact_name,
    recruiter_email: contact_email,
    application_mode: "external_email",
    external_apply_email: contact_email,
    application_instructions: "Candidature transmise au contact recruteur après validation de l’offre.",
    created_by_role: "recruteur_externe",
    updated_at: new Date().toISOString(),
    views_count: 0,
    applications_count: 0,
  });
  if (jobError) {
    console.error("job-create-external", jobError);
    return json({ error: "JOB_CREATION_FAILED", message: jobError.message }, 500);
  }

  // Notify moderators ayant la permission, ancienne colonne ou matrice JSON.
  const { data: permissionRows } = await sb.from("moderator_permissions").select("moderator_user_id,can_moderate_jobs,permissions");
  const moderatorIds = (permissionRows || [])
    .filter((row: any) => row.can_moderate_jobs === true || row.permissions?.can_moderate_jobs === true)
    .map((row: any) => String(row.moderator_user_id));
  if (moderatorIds.length) {
    const brevoKey = Deno.env.get("BREVO_API_KEY") ?? "";
    if (brevoKey) {
      const { data: modUsers } = await sb.from("users").select("email").in("id", moderatorIds);
      for (const mu of modUsers ?? []) {
        fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": brevoKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            sender: { email: "contact@omniaglobalacademy.com", name: "Omnia Global Academy" },
            to: [{ email: mu.email }],
            subject: `Nouvelle offre d'emploi externe à modérer — ${job_title}`,
            htmlContent: `<p>Une nouvelle offre d'emploi externe de <strong>${company_name}</strong> attend validation : <strong>${job_title}</strong>.</p>`,
          }),
        }).catch(() => {});
      }
    }
  }

  return json({ success: true, message: "Votre offre est en cours de validation (24-48h ouvrées)." });
});
