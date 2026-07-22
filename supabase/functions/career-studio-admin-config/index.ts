import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/cors.ts";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

async function superAdminId(sb: any, token: string) {
  const { data: session } = await sb.from("user_sessions").select("user_id")
    .eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!session) return null;
  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", session.user_id);
  return (roles || []).some((r: any) => r.role === "super_admin") ? session.user_id : null;
}

async function safeRows(promise: PromiseLike<any>) {
  try {
    const result = await promise;
    return { data: result.data || [], error: result.error || null };
  } catch (error) {
    console.error(error);
    return { data: [], error };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    const adminId = token ? await superAdminId(sb, token) : null;
    if (!adminId) return json({ error: "FORBIDDEN" }, 403);
    const body = await req.json().catch(() => ({}));

    if (body.action === "get_config") {
      const [rules, tokenConfig, packs, ai, templates, questions, exports, transactions, documents, paidOrders] = await Promise.all([
        safeRows(sb.from("career_admin_rules").select("*").order("group_key").order("display_order")),
        safeRows(sb.from("career_token_config").select("*").order("display_order")),
        safeRows(sb.from("career_token_packs").select("*").order("display_order")),
        safeRows(sb.from("career_ai_config").select("*").order("config_key")),
        safeRows(sb.from("career_templates").select("*").order("template_type").order("display_order")),
        safeRows(sb.from("career_interview_questions").select("*").order("created_at", { ascending: false }).limit(500)),
        safeRows(sb.from("career_export_logs").select("*").order("created_at", { ascending: false }).limit(1000)),
        safeRows(sb.from("career_token_transactions").select("*").order("created_at", { ascending: false }).limit(1000)),
        safeRows(sb.from("career_documents").select("id,user_id,doc_type,status,created_at,updated_at")),
        safeRows(sb.from("orders").select("id,final_price_xof,payment_status,order_type,created_at").eq("order_type", "cv_tokens").eq("payment_status", "paid")),
      ]);

      const docs = documents.data || [];
      const exp = exports.data || [];
      const tx = transactions.data || [];
      const orderRows = paidOrders.data || [];
      const cvDocs = docs.filter((d: any) => d.doc_type === "cv");
      const lmDocs = docs.filter((d: any) => d.doc_type === "lm");
      const completed = (rows: any[]) => rows.filter((d: any) => ["completed", "final", "exported"].includes(String(d.status || "").toLowerCase())).length;
      const exportType = (e: any) => String(e.doc_type || e.document_type || e.export_type || "").toLowerCase();

      const stats = {
        total_cv: cvDocs.length,
        total_lm: lmDocs.length,
        completed_cv: completed(cvDocs),
        completed_lm: completed(lmDocs),
        unique_creators: new Set(docs.map((d: any) => d.user_id).filter(Boolean)).size,
        total_exports: exp.length,
        cv_exports: exp.filter((e: any) => exportType(e).includes("cv")).length,
        lm_exports: exp.filter((e: any) => exportType(e).includes("lm") || exportType(e).includes("letter")).length,
        tokens_consumed: tx.filter((x: any) => Number(x.amount) < 0).reduce((a: number, x: any) => a + Math.abs(Number(x.amount) || 0), 0),
        tokens_credited: tx.filter((x: any) => Number(x.amount) > 0).reduce((a: number, x: any) => a + (Number(x.amount) || 0), 0),
        paid_token_orders: orderRows.length,
        token_revenue_xof: orderRows.reduce((a: number, x: any) => a + (Number(x.final_price_xof) || 0), 0),
        active_templates: (templates.data || []).filter((x: any) => x.is_active).length,
        active_packs: (packs.data || []).filter((x: any) => x.is_active).length,
        active_questions: (questions.data || []).filter((x: any) => x.is_active).length,
      };

      return json({
        rules: rules.data, token_config: tokenConfig.data, token_packs: packs.data,
        ai_config: ai.data, templates: templates.data, questions: questions.data,
        exports: exports.data, transactions: transactions.data, stats,
      });
    }

    if (body.action === "save_rules") {
      for (const rule of body.rules || []) {
        const { error } = await sb.from("career_admin_rules").upsert({ ...rule, updated_at: new Date().toISOString() }, { onConflict: "rule_key" });
        if (error) throw error;
      }
      return json({ success: true, updated: (body.rules || []).length });
    }
    if (body.action === "save_ai_config") {
      for (const cfg of body.configs || []) {
        const { error } = await sb.from("career_ai_config").upsert({ ...cfg, updated_at: new Date().toISOString() }, { onConflict: "config_key" });
        if (error) throw error;
      }
      return json({ success: true, updated: (body.configs || []).length });
    }
    if (body.action === "save_template") {
      const { error } = await sb.from("career_templates").upsert({ ...(body.template || {}), updated_at: new Date().toISOString() }, { onConflict: "template_key" });
      if (error) throw error;
      return json({ success: true });
    }
    if (body.action === "question_create") {
      const { data, error } = await sb.from("career_interview_questions").insert({ ...body.question, created_by: adminId }).select("*").single();
      if (error) throw error;
      return json({ question: data });
    }
    if (body.action === "question_toggle") {
      const { data, error } = await sb.from("career_interview_questions").update({ is_active: body.is_active, updated_at: new Date().toISOString() }).eq("id", body.id).select("*").single();
      if (error) throw error;
      return json({ question: data });
    }
    if (body.action === "question_delete") {
      const { error } = await sb.from("career_interview_questions").delete().eq("id", body.id);
      if (error) throw error;
      return json({ success: true });
    }
    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    console.error("career-studio-admin-config", error);
    return json({ error: "SERVER_ERROR", message: error instanceof Error ? error.message : String(error) }, 500);
  }
});
