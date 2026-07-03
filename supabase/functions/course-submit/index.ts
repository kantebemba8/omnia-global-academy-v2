import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import Anthropic from "npm:@anthropic-ai/sdk@0.40.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const RESOURCE_POINTS: Record<string, { pts: number; max: number }> = {
  pdf_fiche: { pts: 0.5, max: 4 }, url_externe: { pts: 0.3, max: 5 },
  glossaire: { pts: 1.0, max: 1 }, exercice_pratique: { pts: 0.5, max: 3 },
  audio: { pts: 0.5, max: 2 }, template: { pts: 0.7, max: 3 }, etude_de_cas: { pts: 1.0, max: 2 },
};
const NIVEAU_POINTS: Record<string, number> = { Débutant: 2, Intermédiaire: 5, Avancé: 8, Expert: 12 };
const VALIDATION_POINTS: Record<string, number> = { qcm: 3, projet_soumettre: 8, projet_corriger: 12 };

async function wordCount(text: string): Promise<number> {
  return (text ?? "").trim().split(/\s+/).filter(Boolean).length;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  let body: { course_id?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid body" }, 400); }
  const { course_id } = body;
  if (!course_id) return json({ error: "course_id requis" }, 400);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: sess } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!sess) return json({ error: "SESSION_INVALID" }, 401);
    const userId = sess.user_id;

    // Verify ownership
    const { data: course } = await sb.from("courses").select("id,title,category,level,final_validation_type,instructor_id,requested_cpd,description,cover_image_url,objectives").eq("id", course_id).maybeSingle();
    if (!course || (course as unknown as { instructor_id: string }).instructor_id !== userId) return json({ error: "FORBIDDEN" }, 403);

    const courseTyped = course as unknown as Record<string, unknown>;

    // Load full structure
    const { data: modules } = await sb.from("course_modules").select("id,title,objective,position").eq("course_id", course_id).order("position");
    const moduleIds = (modules ?? []).map((m) => (m as unknown as { id: string }).id);

    const { data: lessons } = moduleIds.length > 0
      ? await sb.from("course_lessons").select("id,title,text_content,module_id,lesson_summary,audio_url").in("module_id", moduleIds)
      : { data: [] };
    const lessonIds = (lessons ?? []).map((l) => (l as unknown as { id: string }).id);

    const { data: questions } = lessonIds.length > 0
      ? await sb.from("course_questions").select("id,lesson_id,question_text,options,correct_answer").in("lesson_id", lessonIds)
      : { data: [] };

    const { data: resources } = lessonIds.length > 0
      ? await sb.from("lesson_resources").select("id,lesson_id,resource_type").in("lesson_id", lessonIds)
      : { data: [] };

    // ── Validation checks ──
    const errors: string[] = [];

    // Module count
    if ((modules?.length ?? 0) < 3) errors.push(`Minimum 3 modules requis (actuellement ${modules?.length ?? 0})`);
    if ((modules?.length ?? 0) > 8) errors.push(`Maximum 8 modules autorisés`);

    // Lessons per module
    for (const m of modules ?? []) {
      const mod = m as unknown as { id: string; title: string };
      const modLessons = (lessons ?? []).filter((l) => (l as unknown as { module_id: string }).module_id === mod.id);
      if (modLessons.length < 2) errors.push(`Module "${mod.title}" : minimum 2 leçons (actuellement ${modLessons.length})`);
      if (modLessons.length > 6) errors.push(`Module "${mod.title}" : maximum 6 leçons`);
    }

    // Lesson content + questions
    const qByLesson: Record<string, number> = {};
    (questions ?? []).forEach((q) => {
      const qt = q as unknown as { lesson_id: string };
      qByLesson[qt.lesson_id] = (qByLesson[qt.lesson_id] ?? 0) + 1;
    });

    for (const l of lessons ?? []) {
      const lesson = l as unknown as { id: string; title: string; text_content: string | null };
      const wc = await wordCount(lesson.text_content ?? "");
      if (wc < 100) errors.push(`Leçon "${lesson.title}" : contenu < 100 mots (${wc} mots)`);
      const qCount = qByLesson[lesson.id] ?? 0;
      if (qCount < 5) errors.push(`Leçon "${lesson.title}" : minimum 5 questions (${qCount})`);
      if (qCount > 20) errors.push(`Leçon "${lesson.title}" : maximum 20 questions`);
    }

    // Required course fields
    if (!courseTyped.title || String(courseTyped.title).trim().length < 5) errors.push("Titre de la formation trop court");
    if (!courseTyped.description) errors.push("Description longue manquante");
    if (!courseTyped.category) errors.push("Catégorie manquante");
    if (!courseTyped.level) errors.push("Niveau manquant");
    if (!courseTyped.cover_image_url) errors.push("Visuel de couverture manquant");
    if (!courseTyped.final_validation_type) errors.push("Type de validation finale manquant");
    const objectivesArr = (courseTyped.objectives as string[] | null) ?? [];
    if (objectivesArr.length < 3) errors.push("Minimum 3 objectifs pédagogiques requis");

    if (errors.length > 0) return json({ success: false, errors });

    // ── Calculate final score ──
    const cpd_hours = (lessons ?? []).reduce((sum, l) => {
      const lesson = l as unknown as { duration_seconds?: number };
      return sum + ((lesson.duration_seconds ?? 0) / 3600);
    }, 0);

    const resourcesByType: Record<string, number> = {};
    (resources ?? []).forEach((r) => {
      const res = r as unknown as { resource_type: string };
      resourcesByType[res.resource_type] = (resourcesByType[res.resource_type] ?? 0) + 1;
    });
    const resourcesArr = Object.entries(resourcesByType).map(([type, count]) => ({ type, count }));

    let score = 0;
    score += (modules?.length ?? 0) * 2;
    score += (lessons?.length ?? 0) * 0.5;
    score += cpd_hours;
    score += NIVEAU_POINTS[String(courseTyped.level ?? "")] ?? 0;
    score += VALIDATION_POINTS[String(courseTyped.final_validation_type ?? "")] ?? 0;

    let bonusTotal = 0;
    for (const r of resourcesArr) {
      const cfg = RESOURCE_POINTS[r.type];
      if (!cfg) continue;
      bonusTotal += Math.min(r.count, cfg.max) * cfg.pts;
    }
    score += Math.min(bonusTotal, 5.0);

    const { data: multRow } = await sb.from("category_multipliers").select("multiplier").eq("category_name", String(courseTyped.category ?? "")).maybeSingle();
    const multiplier = parseFloat(String(multRow?.multiplier ?? 1.0));
    score *= multiplier;
    score = Math.round(score * 10) / 10;

    let price_xof = 5000;
    if (score > 15 && score <= 30) price_xof = 15000;
    else if (score > 30 && score <= 50) price_xof = 25000;
    else if (score > 50) price_xof = 35000;

    if (courseTyped.requested_cpd) {
      const { data: cpdSetting } = await sb.from("site_settings").select("value").eq("key", "cpd_premium_price_xof").maybeSingle();
      price_xof = parseInt(String(cpdSetting?.value ?? "50000"));
    }

    // ── Generate MCQ answers via Claude ──
    const questionsToGenerate = (questions ?? []).filter((q) => {
      const qt = q as unknown as { options: unknown; question_text: string };
      return !qt.options || (Array.isArray(qt.options) && (qt.options as unknown[]).length === 0);
    });

    if (questionsToGenerate.length > 0) {
      const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") ?? "" });
      const questionsJson = questionsToGenerate.map((q) => {
        const qt = q as unknown as { id: string; question_text: string };
        return { id: qt.id, question: qt.question_text };
      });

      const msg = await anthropic.messages.create({
        model: "claude-opus-4-7",
        max_tokens: 4096,
        thinking: { type: "adaptive" },
        system: [
          {
            type: "text",
            text: "Tu es un expert pédagogique. Pour chaque question fournie, génère 1 réponse correcte et 3 distracteurs plausibles. Réponds UNIQUEMENT en JSON valide, sans commentaires. Format: [{\"id\":\"...\",\"correct\":\"...\",\"options\":[\"correct\",\"distractor1\",\"distractor2\",\"distractor3\"]}]",
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: `Génère les réponses pour ces questions:\n${JSON.stringify(questionsJson, null, 2)}` }],
      });

      const textBlock = msg.content.find((b) => b.type === "text") as { type: "text"; text: string } | undefined;
      if (textBlock) {
        try {
          const jsonMatch = textBlock.text.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const generatedAnswers = JSON.parse(jsonMatch[0]) as Array<{ id: string; correct: string; options: string[] }>;
            for (const ans of generatedAnswers) {
              await sb.from("course_questions").update({
                options: ans.options,
                correct_answer: ans.correct,
              }).eq("id", ans.id);
            }
          }
        } catch (parseErr) { console.error("JSON parse error for MCQ answers:", parseErr); }
      }
    }

    // Update course status
    await sb.from("courses").update({
      status: "en_attente_validation_manuelle",
      score_calcule: score,
      prix_provisoire_xof: price_xof,
      updated_at: new Date().toISOString(),
    }).eq("id", course_id);

    return json({ success: true, score, prix_provisoire: price_xof });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
