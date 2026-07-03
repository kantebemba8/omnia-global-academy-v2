import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const RESOURCE_POINTS: Record<string, { pts: number; max: number }> = {
  pdf_fiche:          { pts: 0.5, max: 4 },
  url_externe:        { pts: 0.3, max: 5 },
  glossaire:          { pts: 1.0, max: 1 },
  exercice_pratique:  { pts: 0.5, max: 3 },
  audio:              { pts: 0.5, max: 2 },
  template:           { pts: 0.7, max: 3 },
  etude_de_cas:       { pts: 1.0, max: 2 },
};
const NIVEAU_POINTS: Record<string, number> = { Débutant: 2, Intermédiaire: 5, Avancé: 8, Expert: 12 };
const VALIDATION_POINTS: Record<string, number> = { qcm: 3, projet_soumettre: 8, projet_corriger: 12 };

function getPalier(score: number): string {
  if (score <= 15) return "Découverte";
  if (score <= 30) return "Fondamentaux";
  if (score <= 50) return "Compétence";
  return "Expert";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: {
    modules_count?: number; lessons_count?: number; cpd_hours?: number;
    level?: string; final_validation_type?: string; category?: string;
    resources?: Array<{ type: string; count: number }>;
    requested_cpd?: boolean; has_oral_exam?: boolean;
  };
  try { body = await req.json(); } catch { return json({ error: "Invalid body" }, 400); }

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    let score = 0;
    score += (body.modules_count ?? 0) * 2;
    score += (body.lessons_count ?? 0) * 0.5;
    score += (body.cpd_hours ?? 0) * 1;
    score += NIVEAU_POINTS[body.level ?? ""] ?? 0;
    score += VALIDATION_POINTS[body.final_validation_type ?? ""] ?? 0;
    if (body.has_oral_exam) score += 6;

    let bonusTotal = 0;
    for (const r of body.resources ?? []) {
      const cfg = RESOURCE_POINTS[r.type];
      if (!cfg) continue;
      bonusTotal += Math.min(r.count, cfg.max) * cfg.pts;
    }
    score += Math.min(bonusTotal, 5.0);

    // Fetch category multiplier
    const { data: multRow } = await sb.from("category_multipliers").select("multiplier").eq("category_name", body.category ?? "").maybeSingle();
    const multiplier = parseFloat(String(multRow?.multiplier ?? 1.0));
    score *= multiplier;
    score = Math.round(score * 10) / 10;

    let price_xof = 5000;
    if (score > 15 && score <= 30) price_xof = 15000;
    else if (score > 30 && score <= 50) price_xof = 25000;
    else if (score > 50) price_xof = 35000;

    // CPD premium override
    if (body.requested_cpd) {
      const { data: cpdSetting } = await sb.from("site_settings").select("value").eq("key", "cpd_premium_price_xof").maybeSingle();
      price_xof = parseInt(String(cpdSetting?.value ?? "50000"));
    }

    // Commission info
    const commKey = body.requested_cpd ? "commission_normal_avec_cpd" : "commission_normal_sans_cpd";
    const { data: commSetting } = await sb.from("site_settings").select("value").eq("key", commKey).maybeSingle();
    let commission = { professeur: 70, plateforme: 30 };
    try { if (commSetting?.value) commission = JSON.parse(commSetting.value as string); } catch { /* ignore */ }

    const bonusBreakdown = Math.min(bonusTotal, 5.0);

    return json({
      score,
      price_xof,
      palier: getPalier(score),
      multiplier,
      commission,
      breakdown: {
        modules: (body.modules_count ?? 0) * 2,
        lessons: (body.lessons_count ?? 0) * 0.5,
        cpd_hours: (body.cpd_hours ?? 0) * 1,
        level: NIVEAU_POINTS[body.level ?? ""] ?? 0,
        validation: VALIDATION_POINTS[body.final_validation_type ?? ""] ?? 0,
        oral_exam: body.has_oral_exam ? 6 : 0,
        resources_bonus: bonusBreakdown,
        multiplier_applied: multiplier,
      },
    });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
