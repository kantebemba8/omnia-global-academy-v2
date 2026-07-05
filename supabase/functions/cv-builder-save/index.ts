import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://omniaglobalacademy.com",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), {
    status: s, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: sess } = await sb.from("user_sessions")
    .select("user_id")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!sess) return json({ error: "SESSION_INVALID" }, 401);

  const body = await req.json();
  const { cv_id, title, template_id, with_photo, cv_data } = body;

  if (!cv_data) return json({ error: "cv_data requis" }, 400);
  if (!template_id) return json({ error: "template_id requis" }, 400);

  // Calculer le hash du contenu
  const contentHash = await sha256(JSON.stringify(cv_data));

  if (cv_id) {
    // Mettre à jour un CV existant
    const { data: existing } = await sb
      .from("cv_profiles")
      .select("user_id, content_hash, last_pdf_hash")
      .eq("id", cv_id)
      .maybeSingle();

    if (!existing || existing.user_id !== sess.user_id) {
      return json({ error: "CV non trouvé ou accès refusé" }, 404);
    }

    const { data: updated, error } = await sb
      .from("cv_profiles")
      .update({
        title: title || "Mon CV",
        template_id,
        with_photo: with_photo || false,
        cv_data,
        content_hash: contentHash,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cv_id)
      .eq("user_id", sess.user_id)
      .select()
      .single();

    if (error) return json({ error: error.message }, 500);

    return json({
      success: true,
      cv_id: cv_id,
      content_unchanged: existing.content_hash === contentHash,
      action: "updated",
    });
  } else {
    // Créer un nouveau CV
    const { data: created, error } = await sb
      .from("cv_profiles")
      .insert({
        user_id: sess.user_id,
        title: title || "Mon CV",
        template_id,
        with_photo: with_photo || false,
        cv_data,
        content_hash: contentHash,
      })
      .select()
      .single();

    if (error) return json({ error: error.message }, 500);

    return json({
      success: true,
      cv_id: created.id,
      action: "created",
    });
  }
});
