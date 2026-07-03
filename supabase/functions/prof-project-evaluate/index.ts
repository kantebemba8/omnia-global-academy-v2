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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  let body: { final_validation_id?: string; passed?: boolean; score?: number; corrector_notes?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid body" }, 400); }
  const { final_validation_id, passed, score, corrector_notes } = body;
  if (!final_validation_id || passed === undefined || score === undefined) {
    return json({ error: "final_validation_id, passed, score requis" }, 400);
  }

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: sess } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!sess) return json({ error: "SESSION_INVALID" }, 401);
    const userId = sess.user_id;

    // Verify role
    const { data: roleRow } = await sb.from("user_roles").select("role").eq("user_id", userId).eq("role", "professeur").maybeSingle();
    if (!roleRow) return json({ error: "FORBIDDEN" }, 403);

    // Load the final validation
    const { data: fv } = await sb.from("user_final_validation").select("id,course_id,user_id,status,type").eq("id", final_validation_id).maybeSingle();
    if (!fv) return json({ error: "VALIDATION_NOT_FOUND" }, 404);
    const fvTyped = fv as unknown as { id: string; course_id: string; user_id: string; status: string; type: string };

    // Verify the professor owns this course
    const { data: courseRow } = await sb.from("courses").select("instructor_id,final_validation_type,title").eq("id", fvTyped.course_id).maybeSingle();
    if (!courseRow) return json({ error: "COURSE_NOT_FOUND" }, 404);
    const cTyped = courseRow as unknown as { instructor_id: string; final_validation_type: string; title: string };
    if (cTyped.instructor_id !== userId) return json({ error: "FORBIDDEN", message: "Vous n'êtes pas le créateur de ce cours." }, 403);
    if (cTyped.final_validation_type !== "projet_corriger") return json({ error: "NOT_PROJECT_CORRIGER" }, 400);

    // Update final validation
    await sb.from("user_final_validation").update({
      status: passed ? "passed" : "failed",
      score,
      corrector_notes: corrector_notes ?? null,
      evaluated_at: new Date().toISOString(),
    }).eq("id", final_validation_id);

    // Notify student via Brevo if passed
    if (passed) {
      const { data: studentUser } = await sb.from("users").select("email,full_name,allow_email").eq("id", fvTyped.user_id).maybeSingle();
      const student = studentUser as unknown as { email: string; full_name: string; allow_email: boolean } | null;
      if (student?.allow_email) {
        const brevoApiKey = Deno.env.get("BREVO_API_KEY");
        if (brevoApiKey) {
          try {
            await fetch("https://api.brevo.com/v3/smtp/email", {
              method: "POST",
              headers: { accept: "application/json", "content-type": "application/json", "api-key": brevoApiKey },
              body: JSON.stringify({
                sender: { name: "Omnia Global Academy", email: "admission@omniaglobalacademy.com" },
                to: [{ email: student.email, name: student.full_name }],
                subject: `Projet validé — ${cTyped.title}`,
                htmlContent: `<p>Bonjour ${student.full_name},</p><p>Félicitations ! Votre projet pour la formation <strong>${cTyped.title}</strong> a été évalué et validé avec un score de ${score}%.</p>${corrector_notes ? `<p><strong>Notes du correcteur :</strong> ${corrector_notes}</p>` : ''}<p>Votre certificat est maintenant disponible dans votre tableau de bord.</p>`,
              }),
            });
          } catch (e) { console.error("Brevo email error:", e); }
        }
      }
    }

    return json({ success: true });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
