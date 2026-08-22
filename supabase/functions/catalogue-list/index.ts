import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/cors.ts";

import { getActiveOmniaSessionResult } from "../_shared/omnia-auth.ts";
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clean(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function authToken(req: Request) {
  return (req.headers.get("x-omnia-session-token") ?? req.headers.get("Authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

async function resolveSession(sb: any, req: Request) {
  const token = authToken(req);
  if (!token) return null;
  const { data } = await getActiveOmniaSessionResult(sb, token);
  return data?.user_id ? { userId: String(data.user_id), token } : null;
}

async function hasPremiumExternalAccess(sb: any, userId: string, benefitKey: string) {
  const { data: definition } = await sb
    .from("commerce_benefit_definitions")
    .select("id")
    .eq("benefit_key", benefitKey)
    .eq("is_active", true)
    .maybeSingle();
  if (!definition?.id) return false;
  const now = new Date().toISOString();
  const { data: rights } = await sb
    .from("commerce_entitlements")
    .select("id,remaining_quantity,value_json")
    .eq("user_id", userId)
    .eq("benefit_definition_id", definition.id)
    .eq("status", "active")
    .lte("valid_from", now)
    .or(`valid_until.is.null,valid_until.gte.${now}`)
    .limit(20);
  return (rights ?? []).some((right: any) =>
    right.remaining_quantity == null || Number(right.remaining_quantity) > 0 || right.value_json?.value === true
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "GET") return json({ success: false, message: "Method not allowed" }, 405);

  const url = new URL(req.url);
  const p = (key: string) => url.searchParams.get(key) ?? "";
  const mode = p("mode") || "list";

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    if (mode === "external_access") {
      const id = clean(p("id"), 100);
      if (!id) return json({ success: false, error: "EXTERNAL_COURSE_ID_REQUIRED" }, 400);
      const { data: course, error } = await sb
        .from("external_courses")
        .select("id,title,short_description,provider_name,external_url,cover_image_url,category,level,language,duration_label,total_duration_seconds,certificate_available,is_free,access_mode,premium_benefit_key,status,registration_deadline,registration_url,contact_name,contact_email,contact_phone,contact_address,price_xof,delivery_methods")
        .eq("id", id)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw error;
      if (!course) return json({ success: false, error: "EXTERNAL_COURSE_NOT_FOUND" }, 404);

      const session = await resolveSession(sb, req);
      if (course.access_mode === "registered" && !session) {
        return json({ success: false, error: "AUTH_REQUIRED", course: { ...course, external_url: undefined } }, 401);
      }
      if (course.access_mode === "premium") {
        if (!session) return json({ success: false, error: "AUTH_REQUIRED", course: { ...course, external_url: undefined } }, 401);
        const allowed = await hasPremiumExternalAccess(sb, session.userId, course.premium_benefit_key || "external_course_premium_access");
        if (!allowed) return json({ success: false, error: "PREMIUM_REQUIRED", course: { ...course, external_url: undefined } }, 403);
      }
      if (course.access_mode === "paid") {
        const safePaidCourse = { ...course, external_url: undefined, registration_url: undefined };
        if (!session) return json({ success: false, error: "AUTH_REQUIRED", course: safePaidCourse }, 401);
        const { data: grant, error: grantError } = await sb.from("external_course_access_grants")
          .select("id,status,delivery_methods,private_access_url,access_code,ready_at")
          .eq("user_id", session.userId).eq("external_course_id", course.id).maybeSingle();
        if (grantError) throw grantError;
        if (!grant) {
          if (course.registration_deadline && new Date(`${course.registration_deadline}T23:59:59`).getTime() < Date.now()) {
            return json({ success: false, error: "REGISTRATION_CLOSED", course: safePaidCourse }, 409);
          }
          return json({ success: false, error: "PAYMENT_REQUIRED", access_state: "payment_required", course: safePaidCourse }, 402);
        }
        if (grant.status === "revoked") return json({ success: false, error: "ACCESS_REVOKED", course: safePaidCourse }, 403);
        if (grant.status === "registration_in_progress") {
          return json({ success: true, allowed: false, access_state: "registration_in_progress", course: safePaidCourse });
        }
        const access = {
          status: "access_ready",
          delivery_methods: grant.delivery_methods || [],
          private_access_url: grant.private_access_url || null,
          access_code: grant.access_code || null,
          ready_at: grant.ready_at || null,
        };
        return json({ success: true, allowed: true, access_state: "access_ready", course, access });
      }

      if (p("track") === "1") {
        await Promise.allSettled([
          sb.from("external_course_clicks").insert({
            external_course_id: course.id,
            user_id: session?.userId || null,
            session_fingerprint: null,
            access_mode: course.access_mode,
            provider_name: course.provider_name,
          }),
          sb.rpc("increment_external_course_click", { p_course_id: course.id }),
        ]);
      }

      return json({ success: true, allowed: true, access_state: "ready", course });
    }

    const q = p("q");
    const category = p("categorie");
    const language = p("langue");
    const level = p("niveau");
    const price = p("prix");
    const duration = p("duree");
    const minRating = p("note_min");
    const cpdOnly = p("cpd_only");
    const creatorType = p("creator_type");
    const deliveryMode = p("mode_formation");
    const subtitles = p("sous_titres");
    const groupLicense = p("groupe_license");
    const sort = p("tri") || "pertinence";
    const page = Math.max(1, parseInt(p("page") || "1"));
    const limit = Math.min(40, Math.max(1, parseInt(p("limit") || "20")));

    let internalQuery = sb
      .from("courses")
      .select(
        "id,title,short_description,cover_image_url,category,level,price_xof,is_free,cpd_hours,cpd_accredited,average_rating,total_reviews,total_students,creator_type,language,subtitles_available,total_duration_seconds,creator_id,establishment_id,creator_context,created_at,training_delivery_mode",
      )
      .eq("is_published", true)
      .eq("is_catalog_active", true)
      .eq("is_current_catalog_version", true)
      .limit(500);

    if (q) internalQuery = internalQuery.ilike("title", `%${q}%`);
    if (category) internalQuery = internalQuery.eq("category", category);
    if (language) internalQuery = internalQuery.eq("language", language);
    if (level) internalQuery = internalQuery.eq("level", level);
    if (cpdOnly === "true") internalQuery = internalQuery.eq("cpd_accredited", true);
    if (creatorType && creatorType !== "external") internalQuery = internalQuery.eq("creator_type", creatorType);
    if (deliveryMode && ["online","in_person","hybrid"].includes(deliveryMode)) internalQuery = internalQuery.eq("training_delivery_mode", deliveryMode);
    if (subtitles === "true") internalQuery = internalQuery.eq("subtitles_available", true);
    if (groupLicense === "true") internalQuery = internalQuery.eq("has_group_license", true);
    if (minRating) internalQuery = internalQuery.gte("average_rating", parseFloat(minRating));
    if (price === "gratuit") internalQuery = internalQuery.eq("is_free", true);
    else if (price === "0-5000") internalQuery = internalQuery.eq("is_free", false).gte("price_xof", 0).lte("price_xof", 5000);
    else if (price === "5001-15000") internalQuery = internalQuery.eq("is_free", false).gte("price_xof", 5001).lte("price_xof", 15000);
    else if (price === "15001-25000") internalQuery = internalQuery.eq("is_free", false).gte("price_xof", 15001).lte("price_xof", 25000);
    else if (price === "25001+") internalQuery = internalQuery.eq("is_free", false).gte("price_xof", 25001);
    if (duration === "courte") internalQuery = internalQuery.lt("total_duration_seconds", 7200);
    else if (duration === "moyenne") internalQuery = internalQuery.gte("total_duration_seconds", 7200).lte("total_duration_seconds", 18000);
    else if (duration === "longue") internalQuery = internalQuery.gt("total_duration_seconds", 18000);

    let externalQuery = sb
      .from("external_courses")
      .select("id,title,short_description,provider_name,cover_image_url,category,level,language,duration_label,total_duration_seconds,certificate_available,is_free,access_mode,status,is_featured,display_order,click_count,created_at,price_xof,registration_deadline")
      .eq("status", "published")
      .limit(500);
    if (q) externalQuery = externalQuery.or(`title.ilike.%${q}%,provider_name.ilike.%${q}%`);
    if (category) externalQuery = externalQuery.eq("category", category);
    if (language) externalQuery = externalQuery.eq("language", language);
    if (level) externalQuery = externalQuery.eq("level", level);
    if (price === "gratuit") externalQuery = externalQuery.eq("is_free", true);
    else if (price === "0-5000") externalQuery = externalQuery.eq("is_free", false).gte("price_xof", 0).lte("price_xof", 5000);
    else if (price === "5001-15000") externalQuery = externalQuery.eq("is_free", false).gte("price_xof", 5001).lte("price_xof", 15000);
    else if (price === "15001-25000") externalQuery = externalQuery.eq("is_free", false).gte("price_xof", 15001).lte("price_xof", 25000);
    else if (price === "25001+") externalQuery = externalQuery.eq("is_free", false).gte("price_xof", 25001);
    if (duration === "courte") externalQuery = externalQuery.lt("total_duration_seconds", 7200);
    else if (duration === "moyenne") externalQuery = externalQuery.gte("total_duration_seconds", 7200).lte("total_duration_seconds", 18000);
    else if (duration === "longue") externalQuery = externalQuery.gt("total_duration_seconds", 18000);

    const includeInternal = creatorType !== "external";
    const includeExternal = !cpdOnly && !subtitles && !groupLicense && (!creatorType || creatorType === "external");
    const [internalResult, externalResult] = await Promise.all([
      includeInternal ? internalQuery : Promise.resolve({ data: [], error: null }),
      includeExternal ? externalQuery : Promise.resolve({ data: [], error: null }),
    ]);
    if (internalResult.error) throw internalResult.error;
    if (externalResult.error) throw externalResult.error;

    const internalCourses = internalResult.data ?? [];
    const professorIds = internalCourses.filter((item: any) => item.creator_type === "professeur" && item.creator_id).map((item: any) => item.creator_id);
    const establishmentIds = internalCourses.filter((item: any) => (item.creator_type === "etablissement" || item.creator_type === "structure") && item.establishment_id).map((item: any) => item.establishment_id);
    const [usersResult, establishmentsResult, visibilityResult] = await Promise.all([
      professorIds.length ? sb.from("users").select("id,full_name,avatar_url").in("id", professorIds) : Promise.resolve({ data: [] }),
      establishmentIds.length ? sb.from("etablissement_profiles").select("id,school_name,logo_url").in("id", establishmentIds) : Promise.resolve({ data: [] }),
      professorIds.length ? sb.from("user_profiles").select("user_id,field_visibility").in("user_id", professorIds) : Promise.resolve({ data: [] }),
    ]);
    const userMap = Object.fromEntries((usersResult.data ?? []).map((item: any) => [item.id, item]));
    const establishmentMap = Object.fromEntries((establishmentsResult.data ?? []).map((item: any) => [item.id, item]));
    const visibilityMap = Object.fromEntries((visibilityResult.data ?? []).map((item: any) => [item.user_id, item.field_visibility && typeof item.field_visibility === "object" ? item.field_visibility : {}]));

    const combined = [
      ...internalCourses.map((course: any) => ({
        ...course,
        content_origin: "internal",
        public_creator_type: (course.creator_type === "plateforme" || String(course.creator_context || "") === "super_admin") ? "plateforme" : (course.creator_type === "etablissement" || course.creator_type === "structure") ? "structure" : "professeur",
        creator_logo_url: (course.creator_type === "plateforme" || String(course.creator_context || "") === "super_admin")
          ? "/omnia-sidebar-logo.png"
          : (course.creator_type === "etablissement" || course.creator_type === "structure")
          ? establishmentMap[course.establishment_id]?.logo_url ?? null
          : (visibilityMap[course.creator_id]?.avatar_url !== false ? userMap[course.creator_id]?.avatar_url ?? null : null),
        creator_name: (course.creator_type === "plateforme" || String(course.creator_context || "") === "super_admin")
          ? "Omnia Global Academy"
          : (course.creator_type === "etablissement" || course.creator_type === "structure")
          ? establishmentMap[course.establishment_id]?.school_name ?? null
          : userMap[course.creator_id]?.full_name ?? null,
      })),
      ...(externalResult.data ?? []).map((course: any) => ({
        ...course,
        content_origin: "external",
        creator_type: "external",
        creator_name: course.provider_name,
        price_xof: Number(course.price_xof || 0),
        cpd_hours: 0,
        cpd_accredited: false,
        average_rating: 0,
        total_reviews: 0,
        total_students: 0,
        external_click_count: Number(course.click_count || 0),
        level: course.level || "Niveau non renseigné",
        subtitles_available: false,
      })),
    ];

    combined.sort((a: any, b: any) => {
      if (sort === "prix_asc") return Number(a.price_xof || 0) - Number(b.price_xof || 0);
      if (sort === "prix_desc") return Number(b.price_xof || 0) - Number(a.price_xof || 0);
      if (sort === "recence") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sort === "note") return Number(b.average_rating || 0) - Number(a.average_rating || 0);
      if (sort === "popularite") return Number(b.total_students || 0) - Number(a.total_students || 0);
      const featured = Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured));
      if (featured) return featured;
      const order = Number(a.display_order || 0) - Number(b.display_order || 0);
      if (order) return order;
      return Number(b.total_students || 0) - Number(a.total_students || 0);
    });

    const offset = (page - 1) * limit;
    const total = combined.length;
    return json({ courses: combined.slice(offset, offset + limit), total, page, total_pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("catalogue-list error:", error);
    return json({ success: false, message: "Erreur serveur", detail: error instanceof Error ? error.message : String(error) }, 500);
  }
});
