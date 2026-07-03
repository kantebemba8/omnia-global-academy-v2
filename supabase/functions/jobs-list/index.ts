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
  const url = new URL(req.url);

  const jobId = url.searchParams.get("job_id");

  // Single job detail
  if (jobId) {
    const { data: job } = await sb.from("job_offers")
      .select("*, establishment_id")
      .eq("id", jobId).eq("status", "approved").maybeSingle();
    if (!job) return json({ error: "NOT_FOUND" }, 404);

    // Increment views
    await sb.from("job_offers").update({ views_count: (job.views_count || 0) + 1 }).eq("id", jobId);

    let estName = "", estLogo = "";
    if (job.establishment_id) {
      const { data: est } = await sb.from("etablissement_profiles")
        .select("school_name, logo_url").eq("id", job.establishment_id).maybeSingle();
      if (est) { estName = est.school_name; estLogo = est.logo_url; }
    }

    return json({ ...job, establishment_name: estName || job.recruiter_company, establishment_logo_url: estLogo });
  }

  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));
  const search = url.searchParams.get("search") || "";
  const category = url.searchParams.get("category") || "";
  const contractType = url.searchParams.get("contract_type") || "";
  const location = url.searchParams.get("location") || "";
  const requiredLevel = url.searchParams.get("required_level") || "";

  let query = sb.from("job_offers")
    .select("id, title, description, location, contract_type, category, salary_range, deadline, is_external_recruiter, recruiter_company, establishment_id, views_count, applications_count, created_at, required_level", { count: "exact" })
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
  if (category) query = query.eq("category", category);
  if (contractType) query = query.eq("contract_type", contractType);
  if (location) query = query.ilike("location", `%${location}%`);
  if (requiredLevel) query = query.eq("required_level", requiredLevel);

  query = query.range((page - 1) * limit, page * limit - 1);

  const { data: rawJobs, count } = await query;

  // Enrich with establishment names
  const estIds = [...new Set((rawJobs || []).map((j: Record<string, unknown>) => j.establishment_id as string).filter(Boolean))];
  const estMap: Record<string, { name: string; logo: string }> = {};
  if (estIds.length > 0) {
    const { data: ests } = await sb.from("etablissement_profiles").select("id, school_name, logo_url").in("id", estIds);
    (ests || []).forEach((e: { id: string; school_name: string; logo_url: string }) => {
      estMap[e.id] = { name: e.school_name, logo: e.logo_url };
    });
  }

  const jobs = (rawJobs || []).map((j: Record<string, unknown>) => {
    const est = estMap[j.establishment_id as string];
    return {
      ...j,
      description: (j.description as string)?.substring(0, 300),
      posted_by_type: j.is_external_recruiter ? "external" : j.establishment_id ? "establishment" : "platform",
      establishment_name: est?.name || j.recruiter_company || "",
      establishment_logo_url: est?.logo || "",
    };
  });

  return json({ jobs, total: count || 0, page, total_pages: Math.ceil((count || 0) / limit) });
});
