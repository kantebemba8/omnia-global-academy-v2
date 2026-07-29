import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const COUNTRY_NAMES: Record<string, string> = {
  ML: "Mali",
  SN: "Sénégal",
  CI: "Côte d'Ivoire",
  BF: "Burkina Faso",
  GN: "Guinée",
  NE: "Niger",
  MR: "Mauritanie",
  TG: "Togo",
  BJ: "Bénin",
  GH: "Ghana",
  NG: "Nigeria",
  GM: "Gambie",
  GW: "Guinée-Bissau",
  SL: "Sierra Leone",
  LR: "Libéria",
  CV: "Cap-Vert",
  CM: "Cameroun",
  CG: "Congo",
  CD: "RD Congo",
  GA: "Gabon",
  MA: "Maroc",
  DZ: "Algérie",
  TN: "Tunisie",
  LY: "Libye",
  EG: "Égypte",
  KE: "Kenya",
  TZ: "Tanzanie",
  ET: "Éthiopie",
  ZA: "Afrique du Sud",
  AO: "Angola",
  MZ: "Mozambique",
  MG: "Madagascar",
  RW: "Rwanda",
  UG: "Ouganda",
  SD: "Soudan",
  TD: "Tchad",
  CF: "Centrafrique",
  KM: "Comores",
  FR: "France",
  BE: "Belgique",
  CH: "Suisse",
  LU: "Luxembourg",
  DE: "Allemagne",
  GB: "Royaume-Uni",
  ES: "Espagne",
  PT: "Portugal",
  CA: "Canada",
  US: "États-Unis",
  AE: "Émirats Arabes Unis",
  SA: "Arabie Saoudite",
};

function safeFilterValue(value: string, maxLength = 100) {
  return value.replace(/[,%()]/g, " ").trim().slice(0, maxLength);
}

type OrganizationInfo = { name: string; logo: string };
type EstablishmentInfo = { name: string; logo: string };

async function organizationMap(
  sb: ReturnType<typeof createClient>,
  ids: string[],
) {
  const map: Record<string, OrganizationInfo> = {};
  if (!ids.length) return map;

  const { data, error } = await sb
    .from("partner_organizations")
    .select("id,org_name,logo_url")
    .in("id", ids);

  if (error) {
    console.error("jobs-list partner_organizations", error);
    return map;
  }

  for (const row of data || []) {
    map[String(row.id)] = {
      name: String(row.org_name || ""),
      logo: String(row.logo_url || ""),
    };
  }
  return map;
}

async function establishmentMap(
  sb: ReturnType<typeof createClient>,
  ids: string[],
) {
  const map: Record<string, EstablishmentInfo> = {};
  if (!ids.length) return map;

  const { data, error } = await sb
    .from("etablissement_profiles")
    .select("id,school_name,logo_url")
    .in("id", ids);

  if (error) {
    console.error("jobs-list etablissement_profiles", error);
    return map;
  }

  for (const row of data || []) {
    map[String(row.id)] = {
      name: String(row.school_name || ""),
      logo: String(row.logo_url || ""),
    };
  }
  return map;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const url = new URL(req.url);
  const jobId = url.searchParams.get("job_id");

  if (jobId) {
    const { data: job, error } = await sb
      .from("job_offers")
      .select("*")
      .eq("id", jobId)
      .eq("status", "approved")
      .maybeSingle();

    if (error) {
      console.error("jobs-list detail", error);
      return json({ error: "JOB_READ_FAILED", message: error.message }, 500);
    }
    if (!job) return json({ error: "NOT_FOUND" }, 404);

    await sb
      .from("job_offers")
      .update({ views_count: Number(job.views_count || 0) + 1 })
      .eq("id", jobId);

    const organizationId = job.organization_id ? String(job.organization_id) : "";
    const establishmentId = job.establishment_id ? String(job.establishment_id) : "";

    const [organizations, establishments] = await Promise.all([
      organizationMap(sb, organizationId ? [organizationId] : []),
      establishmentMap(sb, establishmentId ? [establishmentId] : []),
    ]);

    const organization = organizations[organizationId];
    const establishment = establishments[establishmentId];
    const publisherName = organization?.name
      || establishment?.name
      || String(job.recruiter_company || "");
    const publisherLogo = organization?.logo || establishment?.logo || "";

    return json({
      ...job,
      recruiter_company: publisherName,
      organization_name: organization?.name || "",
      organization_logo_url: organization?.logo || "",
      establishment_name: establishment?.name || publisherName,
      establishment_logo_url: establishment?.logo || publisherLogo,
    });
  }

  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "20", 10)));
  const search = safeFilterValue(url.searchParams.get("search") || "");
  const category = safeFilterValue(url.searchParams.get("category") || "");
  const contractType = safeFilterValue(url.searchParams.get("contract_type") || "");
  const location = safeFilterValue(url.searchParams.get("location") || "");
  const requiredLevel = safeFilterValue(url.searchParams.get("required_level") || "");
  const countryCode = safeFilterValue(url.searchParams.get("country_code") || "", 12).toUpperCase();

  let query = sb
    .from("job_offers")
    .select(
      "id,title,description,location,contract_type,category,salary_range,deadline,is_external_recruiter,recruiter_company,establishment_id,organization_id,views_count,applications_count,created_at,required_level,application_mode",
      { count: "exact" },
    )
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,recruiter_company.ilike.%${search}%`);
  }
  if (category) query = query.eq("category", category);
  if (contractType) query = query.eq("contract_type", contractType);
  if (location) query = query.ilike("location", `%${location}%`);
  if (requiredLevel) query = query.eq("required_level", requiredLevel);

  if (countryCode === "REMOTE") {
    query = query.or("location.ilike.%remote%,location.ilike.%télétravail%,location.ilike.%teletravail%");
  } else if (countryCode && COUNTRY_NAMES[countryCode]) {
    const countryName = safeFilterValue(COUNTRY_NAMES[countryCode]);
    query = query.or(`location.ilike.%${countryName}%,location.ilike.%${countryCode}%`);
  }

  query = query.range((page - 1) * limit, page * limit - 1);

  const { data: rawJobs, count, error } = await query;
  if (error) {
    console.error("jobs-list list", error);
    return json({ error: "JOBS_LIST_FAILED", message: error.message }, 500);
  }

  const organizationIds = [
    ...new Set(
      (rawJobs || [])
        .map((job: Record<string, unknown>) => String(job.organization_id || ""))
        .filter(Boolean),
    ),
  ];
  const establishmentIds = [
    ...new Set(
      (rawJobs || [])
        .map((job: Record<string, unknown>) => String(job.establishment_id || ""))
        .filter(Boolean),
    ),
  ];

  const [organizations, establishments] = await Promise.all([
    organizationMap(sb, organizationIds),
    establishmentMap(sb, establishmentIds),
  ]);

  const jobs = (rawJobs || []).map((job: Record<string, unknown>) => {
    const organizationId = String(job.organization_id || "");
    const establishmentId = String(job.establishment_id || "");
    const organization = organizations[organizationId];
    const establishment = establishments[establishmentId];
    const publisherName = organization?.name
      || establishment?.name
      || String(job.recruiter_company || "");
    const publisherLogo = organization?.logo || establishment?.logo || "";

    return {
      ...job,
      description: String(job.description || "").substring(0, 300),
      recruiter_company: publisherName,
      posted_by_type: job.is_external_recruiter
        ? "external"
        : organizationId
          ? "structure"
          : establishmentId
            ? "establishment"
            : "platform",
      organization_name: organization?.name || "",
      organization_logo_url: organization?.logo || "",
      establishment_name: establishment?.name || publisherName,
      establishment_logo_url: establishment?.logo || publisherLogo,
    };
  });

  return json({
    jobs,
    total: count || 0,
    page,
    total_pages: Math.ceil((count || 0) / limit),
  });
});
