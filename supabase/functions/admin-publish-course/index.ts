import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { sendOmniaEmail } from "../_shared/brevo-mail.ts";
import { dispatchOmniaInAppNotification } from "../_shared/notifications.ts";

import { getActiveOmniaSessionResult, omniaInternalHeaders } from "../_shared/omnia-auth.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function verifySuperAdmin(sb: ReturnType<typeof createClient>, token: string) {
  const { data: sess } = await getActiveOmniaSessionResult(sb, token);
  if (!sess) return null;
  const { data: role } = await sb.from("user_roles").select("role").eq("user_id", (sess as { user_id: string }).user_id).eq("role", "super_admin").maybeSingle();
  if (!role) return null;
  return (sess as { user_id: string }).user_id;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const adminId = await verifySuperAdmin(sb, token);
    if (!adminId) return json({ error: "FORBIDDEN" }, 403);

    const body = await req.json() as {
      course_id: string;
      action: "publish" | "reject" | "request_modification";
      final_price_xof?: number;
      commission_override?: { professor_percent: number; platform_percent: number };
      school_split?: { school_percent: number; platform_percent: number; school_amount_xof: number; platform_amount_xof: number };
      comment?: string;
    };

    const { course_id, action, final_price_xof, school_split, comment } = body;
    if (!course_id || !["publish", "reject", "request_modification"].includes(action)) return json({ error: "INVALID_PARAMS" }, 400);

    const { data: course } = await sb.from("courses").select("id,title,instructor_id,establishment_id,status,category").eq("id", course_id).maybeSingle();
    if (!course) return json({ error: "COURSE_NOT_FOUND" }, 404);
    const cr = course as { id: string; title: string; instructor_id: string; establishment_id: string | null; status: string; category: string | null };
    const now = new Date().toISOString();

    if (action === "publish") {
      if (cr.establishment_id) {
        // Check school_revenue_splits accepted
        const { data: split } = await sb.from("school_revenue_splits").select("accepted_by_director").eq("course_id", course_id).maybeSingle();
        const s = split as { accepted_by_director?: boolean } | null;
        if (!split) return json({ error: "SPLIT_REQUIRED", message: "Proposez d'abord une répartition financière au Directeur." }, 400);
        if (!s?.accepted_by_director) return json({ error: "SPLIT_NOT_ACCEPTED", message: "Le Directeur n'a pas encore accepté la répartition." }, 400);
      }

      await sb.from("courses").update({
        status: "publiee", is_published: true, moderated_by: adminId, moderated_at: now,
        ...(final_price_xof != null ? { price_xof: final_price_xof } : {}),
      }).eq("id", course_id);

      // Trigger RAG indexation asynchronously (fire-and-forget)
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      fetch(`${supabaseUrl}/functions/v1/rag-index-course`, {
        method: "POST",
        headers: omniaInternalHeaders(),
        body: JSON.stringify({ course_id }),
      }).catch(() => {});

      // Generate auto exercises for language courses (fire-and-forget)
      if (cr.category?.toLowerCase().includes("langue")) {
        (async () => {
          const { data: lessons } = await sb
            .from("course_lessons")
            .select("id, text_content, audio_text_to_generate")
            .eq("course_id", course_id);
          for (const lesson of lessons ?? []) {
            const l = lesson as { id: string; text_content: string | null; audio_text_to_generate: string | null };
            const texte = l.text_content || l.audio_text_to_generate || "";
            if (!texte.trim()) continue;
            const exercices: unknown[] = [];
            const mots = texte.replace(/[.,;:!?()\n]/g, " ").split(/\s+/).filter((m: string) => m.length >= 6);
            const uniqueMots = [...new Set(mots)].slice(0, 8);
            if (uniqueMots.length > 0) exercices.push({ type: "flashcards_vocabulaire", mots: uniqueMots });
            const phrases = texte.split(/[.!?]+/).map((p: string) => p.trim()).filter((p: string) => p.split(" ").length >= 4);
            if (phrases.length > 0) {
              const phrase = phrases[0];
              const words = phrase.split(" ");
              const idx = Math.min(2, words.length - 1);
              const motMasque = words[idx];
              const phraseATrou = words.map((w: string, i: number) => i === idx ? "____" : w).join(" ");
              exercices.push({ type: "texte_a_trous", phrase: phraseATrou, reponse: motMasque });
            }
            if (l.audio_text_to_generate) {
              exercices.push({ type: "dictee_audio", texteReference: l.audio_text_to_generate.slice(0, 120) });
            }
            if (exercices.length > 0) {
              await sb.from("course_lessons").update({ exercices_auto: exercices }).eq("id", l.id);
            }
          }
        })().catch(() => {});
      }

      // Notification transactionnelle centralisée via Brevo.
      const { data: u } = await sb.from("users").select("email,full_name").eq("id", cr.instructor_id).maybeSingle();
      if (u?.email) {
        await sendOmniaEmail({
          sb,
          userId: cr.instructor_id,
          to: { email: String(u.email), name: String(u.full_name || "") || undefined },
          templateKey: "status_update",
          params: {
            PRENOM: u.full_name || "",
            FORMATION_TITRE: cr.title,
            STATUT: "Formation publiée",
            MESSAGE_SPECIFIQUE: final_price_xof != null
              ? `Votre formation est publiée. Prix final : ${Number(final_price_xof).toLocaleString("fr-FR")} XOF.`
              : "Votre formation est publiée sur Omnia Global Academy.",
            ACTION_URL: `${(Deno.env.get("APP_URL") || "https://omniaglobalacademy.com").replace(/\/$/, "")}/professeur/formations`,
          },
        });
        await dispatchOmniaInAppNotification({
          userId: String(cr.instructor_id),
          notificationType: "course_published",
          title: "Formation publiée",
          message: final_price_xof != null
            ? `« ${cr.title} » est publiée au prix final de ${Number(final_price_xof).toLocaleString("fr-FR")} XOF.`
            : `« ${cr.title} » est maintenant publiée sur Omnia Global Academy.`,
          actionUrl: "/professeur/formations",
          priority: "high",
          payload: { domain: "formations", course_id: course_id || cr.id },
        });
      }
    } else if (action === "reject") {
      await sb.from("courses").update({ status: "rejetee", moderated_by: adminId, moderated_at: now, admin_comment: comment ?? null }).eq("id", course_id);
    } else if (action === "request_modification") {
      await sb.from("courses").update({ status: "modification_demandee", admin_comment: comment ?? null }).eq("id", course_id);
    }

    if (school_split && action === "publish") {
      await sb.from("school_revenue_splits").upsert({ course_id, ...school_split, created_by: adminId }, { onConflict: "course_id" });
    }

    await sb.from("moderation_log").insert({ moderator_id: adminId, action_type: `course_${action}`, target_type: "course", target_id: course_id, comment: comment ?? null });
    return json({ success: true });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
