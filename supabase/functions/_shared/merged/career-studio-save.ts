import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../cors.ts";

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifySession(sb: ReturnType<typeof createClient>, token: string) {
  const { data: sess } = await sb.from("user_sessions")
    .select("user_id")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!sess) return null;
  return (sess as { user_id: string }).user_id;
}

async function hashContent(content: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

export async function handler(req: Request) {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const userId = await verifySession(sb, token);
    if (!userId) return json({ error: "SESSION_INVALID" }, 401);

    const body = await req.json();
    const {
      document_id,
      doc_type = "cv",
      title = "Mon document",
      template_key,
      language = "fr",
      doc_data = {},
      design_options = {},
      target_job,
      target_country,
      application_type,
      action = "save", // save | duplicate | delete | rename
    } = body;

    // ── Action DELETE ────────────────────────────────────────
    if (action === "delete") {
      if (!document_id) return json({ error: "DOCUMENT_ID_REQUIRED" }, 400);
      const { error } = await sb.from("career_documents")
        .delete()
        .eq("id", document_id)
        .eq("user_id", userId);
      if (error) throw error;
      return json({ success: true, action: "deleted" });
    }

    // ── Action DUPLICATE ─────────────────────────────────────
    if (action === "duplicate") {
      if (!document_id) return json({ error: "DOCUMENT_ID_REQUIRED" }, 400);
      const { data: original } = await sb.from("career_documents")
        .select("*")
        .eq("id", document_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!original) return json({ error: "DOCUMENT_NOT_FOUND" }, 404);

      const { data: copy, error } = await sb.from("career_documents")
        .insert({
          user_id: userId,
          doc_type: original.doc_type,
          title: `${original.title} (copie)`,
          template_key: original.template_key,
          language: original.language,
          doc_data: original.doc_data,
          design_options: original.design_options,
          status: "draft",
        })
        .select("id, title")
        .single();
      if (error) throw error;
      return json({ success: true, action: "duplicated", document: copy });
    }

    // ── Action RENAME ────────────────────────────────────────
    if (action === "rename") {
      if (!document_id || !title) return json({ error: "MISSING_PARAMS" }, 400);
      await sb.from("career_documents")
        .update({ title, updated_at: new Date().toISOString() })
        .eq("id", document_id)
        .eq("user_id", userId);
      return json({ success: true, action: "renamed" });
    }

    // ── Action SAVE (create ou update) ───────────────────────
    const contentHash = await hashContent(JSON.stringify(doc_data));
    const now = new Date().toISOString();

    if (document_id) {
      // Mise à jour
      const { data: updated, error } = await sb.from("career_documents")
        .update({
          title,
          template_key,
          language,
          doc_data,
          design_options,
          target_job,
          target_country,
          application_type,
          content_hash: contentHash,
          status: "draft",
          updated_at: now,
        })
        .eq("id", document_id)
        .eq("user_id", userId)
        .select("id, title, content_hash")
        .single();
      if (error) throw error;
      return json({ success: true, action: "updated", document: updated });
    } else {
      // Création
      // Vérifier limite (max 20 documents par type)
      const { count } = await sb.from("career_documents")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("doc_type", doc_type);

      if ((count ?? 0) >= 20) {
        return json({ error: "MAX_DOCUMENTS_REACHED", message: "Vous avez atteint la limite de 20 documents." }, 400);
      }

      const { data: created, error } = await sb.from("career_documents")
        .insert({
          user_id: userId,
          doc_type,
          title,
          template_key,
          language,
          doc_data,
          design_options,
          target_job,
          target_country,
          application_type,
          content_hash: contentHash,
          status: "draft",
        })
        .select("id, title, content_hash")
        .single();
      if (error) throw error;
      return json({ success: true, action: "created", document: created });
    }

  } catch (err) {
    console.error("career-studio-save error:", err);
    return json({ error: "SERVER_ERROR", message: (err as Error).message }, 500);
  }
}