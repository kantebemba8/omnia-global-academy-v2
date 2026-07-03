import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/cors.ts";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "GET") return json({ success: false, message: "Method not allowed" }, 405);

  const url = new URL(req.url);
  const p = (k: string) => url.searchParams.get(k) ?? "";

  const q            = p("q");
  const categorie    = p("categorie");
  const langue       = p("langue");
  const niveau       = p("niveau");
  const prix         = p("prix");
  const duree        = p("duree");
  const note_min     = p("note_min");
  const cpd_only     = p("cpd_only");
  const creator_type = p("creator_type");
  const sous_titres  = p("sous_titres");
  const groupe_lic   = p("groupe_license");
  const tri          = p("tri") || "pertinence";
  const page         = Math.max(1, parseInt(p("page") || "1"));
  const limit        = Math.min(40, parseInt(p("limit") || "20"));

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let query = supabase
      .from("courses")
      .select(
        "id, title, short_description, cover_image_url, category, level, " +
        "price_xof, is_free, cpd_hours, cpd_accredited, average_rating, " +
        "total_reviews, total_students, creator_type, language, " +
        "subtitles_available, total_duration_seconds, creator_id, establishment_id",
        { count: "exact" }
      )
      .eq("is_published", true);

    if (q)            query = query.ilike("title", `%${q}%`);
    if (categorie)    query = query.eq("category", categorie);
    if (langue)       query = query.eq("language", langue);
    if (niveau)       query = query.eq("level", niveau);
    if (cpd_only === "true")     query = query.eq("cpd_accredited", true);
    if (creator_type) query = query.eq("creator_type", creator_type);
    if (sous_titres === "true")  query = query.eq("subtitles_available", true);
    if (groupe_lic === "true")   query = query.eq("has_group_license", true);
    if (note_min)     query = query.gte("average_rating", parseFloat(note_min));

    // Prix
    if (prix === "gratuit")  query = query.eq("is_free", true);
    else if (prix === "0-5000")      query = query.eq("is_free", false).gte("price_xof", 0).lte("price_xof", 5000);
    else if (prix === "5001-15000")  query = query.eq("is_free", false).gte("price_xof", 5001).lte("price_xof", 15000);
    else if (prix === "15001-25000") query = query.eq("is_free", false).gte("price_xof", 15001).lte("price_xof", 25000);
    else if (prix === "25001+")      query = query.eq("is_free", false).gte("price_xof", 25001);

    // Durée
    if (duree === "courte")  query = query.lt("total_duration_seconds", 7200);
    else if (duree === "moyenne") query = query.gte("total_duration_seconds", 7200).lte("total_duration_seconds", 18000);
    else if (duree === "longue")  query = query.gt("total_duration_seconds", 18000);

    // Tri
    if (tri === "prix_asc")    query = query.order("price_xof", { ascending: true });
    else if (tri === "prix_desc")   query = query.order("price_xof", { ascending: false });
    else if (tri === "recence")     query = query.order("created_at", { ascending: false });
    else if (tri === "popularite")  query = query.order("total_students", { ascending: false });
    else if (tri === "note")        query = query.order("average_rating", { ascending: false });
    else                            query = query.order("total_students", { ascending: false });

    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: courses, count, error } = await query;
    if (error) throw error;

    // Batch-fetch creator names
    const profIds = (courses ?? []).filter(c => c.creator_type === "professeur" && c.creator_id).map(c => c.creator_id);
    const etabIds = (courses ?? []).filter(c => c.creator_type === "etablissement" && c.establishment_id).map(c => c.establishment_id);

    const [usersResult, etabsResult] = await Promise.all([
      profIds.length > 0
        ? supabase.from("users").select("id, full_name").in("id", profIds)
        : Promise.resolve({ data: [] }),
      etabIds.length > 0
        ? supabase.from("etablissement_profiles").select("id, school_name").in("id", etabIds)
        : Promise.resolve({ data: [] }),
    ]);

    const userMap: Record<string, string> = {};
    for (const u of usersResult.data ?? []) userMap[u.id] = u.full_name;

    const etabMap: Record<string, string> = {};
    for (const e of etabsResult.data ?? []) etabMap[e.id] = e.school_name;

    const enriched = (courses ?? []).map(c => ({
      ...c,
      creator_name:
        c.creator_type === "plateforme"
          ? "Omnia Global Academy"
          : c.creator_type === "etablissement"
          ? (etabMap[c.establishment_id] ?? null)
          : (userMap[c.creator_id] ?? null),
    }));

    const total = count ?? 0;
    return json({
      courses: enriched,
      total,
      page,
      total_pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("catalogue-list error:", err);
    return json({ success: false, message: "Erreur serveur" }, 500);
  }
});
