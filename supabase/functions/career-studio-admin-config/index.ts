import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

import { getActiveOmniaSessionResult } from "../_shared/omnia-auth.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-omnia-session-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function requireSuperAdmin(sb: any, req: Request): Promise<string | null> {
  const token = (
    req.headers.get("x-omnia-session-token") ||
    req.headers.get("Authorization") ||
    ""
  )
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) return null;

  const { data: session } = await getActiveOmniaSessionResult(sb, token);
  if (!session) return null;

  const { data: role } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user_id)
    .eq("role", "super_admin")
    .maybeSingle();

  return role ? session.user_id : null;
}

async function safeRows(sb: any, table: string, select = "*") {
  try {
    const { data, error } = await sb.from(table).select(select);
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

const OFFICIAL_TEMPLATE_KEYS = new Set([
  "cv_horizon",
  "cv_sahara",
  "cv_atlas",
  "cv_kora",
  "cv_nile",
  "cv_executive",
  "cv_baobab",
  "cv_digital",
  "cv_academia",
  "cv_hospitality",
  "cv_qhse",
  "cv_impact",
  "lm_horizon",
  "lm_sahara",
  "lm_atlas",
  "lm_kora",
  "lm_digital",
  "lm_executive",
]);

const LEGACY_TEMPLATE_KEYS = new Set([
  "academic",
  "academic_cv",
  "academic_lm",
  "africa_gold",
  "business_manager",
  "classic",
  "classic_lm",
  "classic_pro",
  "corporate_blue",
  "creative",
  "creative_digital",
  "creative_lm",
  "cyber_security",
  "cyber_security_cv",
  "data_analyst",
  "data_analyst_cv",
  "dynamic_lm",
  "executive_one_page",
  "freelancer",
  "freelancer_portfolio",
  "hospitality",
  "hospitality_premium",
  "international_cv",
  "internship_ready",
  "lm_academic",
  "lm_administration",
  "lm_africa_gold",
  "lm_alternance",
  "lm_business_manager",
  "lm_classic_pro",
  "lm_corporate_blue",
  "lm_courte_premium",
  "lm_creative_digital",
  "lm_cyber_security",
  "lm_data_analyst",
  "lm_finance_banque",
  "lm_freelancer",
  "lm_hospitality",
  "lm_hotellerie",
  "lm_international",
  "lm_internationale",
  "lm_internship_ready",
  "lm_minimal_luxe",
  "lm_modern_student",
  "lm_no_photo_ats",
  "lm_photo_elegant",
  "lm_premier_emploi",
  "lm_pro_classique",
  "lm_qhse",
  "lm_qhse_rse",
  "lm_spontanee",
  "lm_stage_simple",
  "lm_tech_data",
  "lm_tech_future",
  "lm_young_graduate",
  "minimal_luxe",
  "modern",
  "modern_lm",
  "modern_student",
  "no_photo_ats",
  "photo_elegant",
  "professional",
  "professional_lm",
  "qhse",
  "qhse_professional",
  "simple",
  "simple_lm",
  "student",
  "tech_future",
  "young_graduate",
]);

function dateValue(value: unknown): number {
  const time = value ? new Date(String(value)).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function visibleTemplates(rows: any[]) {
  return (rows || []).filter((row: any) =>
    ["official", "custom"].includes(String(row.catalog_status || ""))
    && !LEGACY_TEMPLATE_KEYS.has(String(row.template_key || "").trim().toLowerCase())
  );
}

function safeTemplatePatch(template: any, existing: any) {
  const templateType = String(template?.template_type || existing?.template_type || "");
  if (!["cv", "lm"].includes(templateType)) throw new Error("INVALID_TEMPLATE_TYPE");
  return {
    template_type: templateType,
    name_fr: String(template?.name_fr || existing?.name_fr || template?.template_key || "Modèle").trim(),
    description_fr: String(template?.description_fr ?? existing?.description_fr ?? "").trim(),
    category: String(template?.category || existing?.category || "professional"),
    is_free: template?.is_free !== false,
    is_active: template?.is_active !== false,
    is_ats_compatible: template?.is_ats_compatible !== false,
    display_order: Math.max(1, Number(template?.display_order || existing?.display_order || 999)),
    thumbnail_url: template?.thumbnail_url ?? existing?.thumbnail_url ?? null,
    layout_config: template?.layout_config && typeof template.layout_config === "object"
      ? template.layout_config
      : (existing?.layout_config || {}),
    default_colors: template?.default_colors && typeof template.default_colors === "object"
      ? template.default_colors
      : (existing?.default_colors || {}),
    is_custom: existing?.catalog_status === "custom" || existing?.is_custom === true,
    catalog_status: existing?.catalog_status === "official" ? "official" : "custom",
    canonical_template_key: String(existing?.canonical_template_key || template?.template_key || ""),
    updated_at: new Date().toISOString(),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return json({ error: "SERVER_CONFIG_ERROR", message: "Configuration Supabase incomplète." }, 500);
    }

    const sb = createClient(supabaseUrl, serviceKey);
    const adminId = await requireSuperAdmin(sb, req);
    if (!adminId) return json({ error: "FORBIDDEN" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "get_config");

    if (action === "get_detail") {
      const metric = String(body?.metric || "");
      const allowedMetrics = ["cv", "lm", "creators", "active-30d", "exports", "tokens"];
      if (!allowedMetrics.includes(metric)) {
        return json({ error: "INVALID_METRIC", message: "Indicateur Career Studio invalide." }, 400);
      }

      const [documents, exportLogs, transactions, userRoles] = await Promise.all([
        safeRows(sb, "career_documents", "id,user_id,title,doc_type,template_key,status,created_at,updated_at"),
        safeRows(sb, "career_export_logs"),
        safeRows(sb, "career_token_transactions"),
        safeRows(sb, "user_roles", "user_id,role"),
      ]);

      const learnerIds = new Set(
        userRoles.filter((row: any) => row.role === "apprenant").map((row: any) => String(row.user_id)),
      );
      const learnerDocuments = documents.filter((doc: any) => doc.user_id && learnerIds.has(String(doc.user_id)));
      const documentMap = new Map(learnerDocuments.map((doc: any) => [String(doc.id), doc]));
      const learnerTransactions = transactions.filter((tx: any) => tx.user_id && learnerIds.has(String(tx.user_id)));

      const detailUserIds = new Set<string>();
      for (const doc of learnerDocuments) if (doc.user_id) detailUserIds.add(String(doc.user_id));
      for (const tx of learnerTransactions) if (tx.user_id) detailUserIds.add(String(tx.user_id));
      for (const row of exportLogs) {
        const linked = documentMap.get(String(row.document_id || row.career_document_id || ""));
        const userId = row.user_id || linked?.user_id;
        if (userId && learnerIds.has(String(userId))) detailUserIds.add(String(userId));
      }

      let users: any[] = [];
      if (detailUserIds.size) {
        const { data, error } = await sb.from("users").select("id,full_name").in("id", [...detailUserIds]);
        if (error) throw error;
        users = data || [];
      }
      const userMap = new Map(users.map((user: any) => [String(user.id), user.full_name || "Apprenant"]));
      const nameFor = (userId: unknown) => userMap.get(String(userId || "")) || "Apprenant";

      let rows: any[] = [];

      if (metric === "cv" || metric === "lm") {
        rows = learnerDocuments
          .filter((doc: any) => doc.doc_type === metric)
          .map((doc: any) => ({
            id: doc.id,
            user_name: nameFor(doc.user_id),
            document_title: doc.title || (metric === "cv" ? "CV sans titre" : "Lettre sans titre"),
            template_key: doc.template_key || "—",
            status: doc.status || "brouillon",
            created_at: doc.created_at,
            updated_at: doc.updated_at,
          }))
          .sort((a: any, b: any) => dateValue(b.updated_at || b.created_at) - dateValue(a.updated_at || a.created_at));
      }

      if (metric === "creators") {
        const grouped = new Map<string, any>();
        for (const doc of learnerDocuments) {
          const userId = String(doc.user_id);
          const current = grouped.get(userId) || {
            id: userId,
            user_name: nameFor(userId),
            cv_count: 0,
            lm_count: 0,
            total_documents: 0,
            last_activity: null,
          };
          if (doc.doc_type === "cv") current.cv_count += 1;
          if (doc.doc_type === "lm") current.lm_count += 1;
          current.total_documents += 1;
          const activity = doc.updated_at || doc.created_at;
          if (dateValue(activity) > dateValue(current.last_activity)) current.last_activity = activity;
          grouped.set(userId, current);
        }
        rows = [...grouped.values()].sort((a: any, b: any) => dateValue(b.last_activity) - dateValue(a.last_activity));
      }

      if (metric === "active-30d") {
        const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const grouped = new Map<string, any>();
        const ensure = (userId: string) => {
          const current = grouped.get(userId) || {
            id: userId,
            user_name: nameFor(userId),
            documents_count: 0,
            transactions_count: 0,
            last_activity: null,
          };
          grouped.set(userId, current);
          return current;
        };
        for (const doc of learnerDocuments) {
          const activity = doc.updated_at || doc.created_at;
          if (dateValue(activity) < since) continue;
          const current = ensure(String(doc.user_id));
          current.documents_count += 1;
          if (dateValue(activity) > dateValue(current.last_activity)) current.last_activity = activity;
        }
        for (const tx of learnerTransactions) {
          if (dateValue(tx.created_at) < since) continue;
          const current = ensure(String(tx.user_id));
          current.transactions_count += 1;
          if (dateValue(tx.created_at) > dateValue(current.last_activity)) current.last_activity = tx.created_at;
        }
        rows = [...grouped.values()].sort((a: any, b: any) => dateValue(b.last_activity) - dateValue(a.last_activity));
      }

      if (metric === "exports") {
        rows = exportLogs
          .map((row: any) => {
            const documentId = row.document_id || row.career_document_id || null;
            const document = documentId ? documentMap.get(String(documentId)) : null;
            const userId = row.user_id || document?.user_id || null;
            if (!userId || !learnerIds.has(String(userId))) return null;
            return {
              id: row.id,
              user_name: nameFor(userId),
              doc_type: row.doc_type || document?.doc_type || row.export_type || "document",
              document_title: row.document_title || document?.title || "Document",
              tokens_consumed: row.tokens_consumed ?? row.token_cost ?? null,
              status: row.status || "success",
              created_at: row.created_at,
            };
          })
          .filter(Boolean)
          .sort((a: any, b: any) => dateValue(b.created_at) - dateValue(a.created_at));
      }

      if (metric === "tokens") {
        rows = learnerTransactions
          .filter((tx: any) => Number(tx.amount || 0) < 0)
          .map((tx: any) => ({
            id: tx.id,
            user_name: nameFor(tx.user_id),
            reason: tx.reason || tx.transaction_type || "Consommation de jetons",
            tokens: Math.abs(Number(tx.amount || 0)),
            created_at: tx.created_at,
          }))
          .sort((a: any, b: any) => dateValue(b.created_at) - dateValue(a.created_at));
      }

      return json({ metric, total: rows.length, rows: rows.slice(0, 500) });
    }

    if (action === "get_config") {
      const [rules, tokenConfig, packs, aiConfig, templates, questions, exportLogs, transactions, documents, orders, userRoles] = await Promise.all([
        safeRows(sb, "career_admin_rules"),
        safeRows(sb, "career_token_config"),
        Promise.resolve([]),
        safeRows(sb, "career_ai_config"),
        safeRows(sb, "career_templates"),
        safeRows(sb, "career_interview_questions"),
        safeRows(sb, "career_export_logs"),
        safeRows(sb, "career_token_transactions"),
        safeRows(sb, "career_documents", "id,user_id,title,doc_type,template_key,status,created_at,updated_at"),
        safeRows(sb, "orders", "id,user_id,order_type,payment_status,final_price_xof,cv_tokens_pack,career_pack_key,created_at,paid_at"),
        safeRows(sb, "user_roles", "user_id,role"),
      ]);

      const catalogTemplates = visibleTemplates(templates);
      const learnerIds = new Set(
        userRoles.filter((row: any) => row.role === "apprenant").map((row: any) => row.user_id),
      );
      const learnerDocuments = documents.filter((doc: any) => doc.user_id && learnerIds.has(doc.user_id));

      const learnerUserIds = [...new Set(learnerDocuments.map((doc: any) => doc.user_id).filter(Boolean))];
      let learnerUsers: any[] = [];
      if (learnerUserIds.length) {
        const { data } = await sb.from("users").select("id,full_name,email").in("id", learnerUserIds);
        learnerUsers = data || [];
      }
      const userMap = new Map(learnerUsers.map((user: any) => [user.id, user]));
      const documentMap = new Map(learnerDocuments.map((doc: any) => [doc.id, doc]));

      const enrichedExports = (exportLogs || []).map((row: any) => {
        const documentId = row.document_id || row.career_document_id || null;
        const document = documentId ? documentMap.get(documentId) : null;
        const userId = row.user_id || document?.user_id || null;
        const user = userId ? userMap.get(userId) : null;
        return {
          ...row,
          document_title: row.document_title || document?.title || "Document",
          doc_type: row.doc_type || document?.doc_type || row.export_type || "document",
          user_name: user?.full_name || row.user_name || "—",
          user_email: user?.email || row.user_email || "",
        };
      });

      const now = Date.now();
      const since30 = now - 30 * 24 * 60 * 60 * 1000;
      const active30Ids = new Set<string>();
      for (const doc of learnerDocuments) {
        if (dateValue(doc.updated_at || doc.created_at) >= since30 && doc.user_id) active30Ids.add(doc.user_id);
      }
      for (const tx of transactions) {
        if (dateValue(tx.created_at) >= since30 && tx.user_id && learnerIds.has(tx.user_id)) active30Ids.add(tx.user_id);
      }

      const completedTokenOrders = orders.filter((order: any) =>
        order.user_id && learnerIds.has(order.user_id) && order.order_type === "cv_tokens" && ["completed", "paid", "success"].includes(String(order.payment_status || "").toLowerCase()),
      );
      const tokenRevenueXof = completedTokenOrders.reduce((sum: number, order: any) => sum + Number(order.final_price_xof || 0), 0);
      const tokensSold = completedTokenOrders.reduce((sum: number, order: any) => sum + Number(order.cv_tokens_pack || 0), 0);

      const learnerTransactions = transactions.filter((tx: any) => tx.user_id && learnerIds.has(tx.user_id));
      const tokensConsumed = learnerTransactions
        .filter((tx: any) => Number(tx.amount || 0) < 0)
        .reduce((sum: number, tx: any) => sum + Math.abs(Number(tx.amount || 0)), 0);
      const tokensCredited = learnerTransactions
        .filter((tx: any) => Number(tx.amount || 0) > 0)
        .reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0);
      const aiActions = learnerTransactions.filter((tx: any) => {
        const text = `${tx.reason || ""} ${tx.transaction_type || ""}`.toLowerCase();
        return /ai|ia|ats|translation|traduction|reformulation|suggestion/.test(text);
      }).length;

      const templateUsage = new Map<string, number>();
      for (const doc of learnerDocuments) {
        if (doc.template_key) templateUsage.set(doc.template_key, (templateUsage.get(doc.template_key) || 0) + 1);
      }
      const topTemplates = [...templateUsage.entries()]
        .map(([template_key, usage_count]) => ({
          template_key,
          usage_count,
          name_fr: catalogTemplates.find((t: any) => t.template_key === template_key)?.name_fr || template_key,
          template_type: catalogTemplates.find((t: any) => t.template_key === template_key)?.template_type || "",
        }))
        .sort((a, b) => b.usage_count - a.usage_count)
        .slice(0, 10);

      const exportSuccess = enrichedExports.filter((row: any) => !["failed", "error"].includes(String(row.status || "success").toLowerCase())).length;
      const exportFailed = enrichedExports.filter((row: any) => ["failed", "error"].includes(String(row.status || "").toLowerCase())).length;

      const stats = {
        total_cv: learnerDocuments.filter((doc: any) => doc.doc_type === "cv").length,
        total_lm: learnerDocuments.filter((doc: any) => doc.doc_type === "lm").length,
        unique_creators: new Set(learnerDocuments.map((doc: any) => doc.user_id).filter(Boolean)).size,
        active_users_30d: active30Ids.size,
        total_exports: enrichedExports.length,
        export_success: exportSuccess,
        export_failed: exportFailed,
        tokens_consumed: tokensConsumed,
        tokens_credited: tokensCredited,
        tokens_sold: tokensSold,
        token_sales_count: completedTokenOrders.length,
        token_revenue_xof: tokenRevenueXof,
        ai_actions: aiActions,
        active_templates: catalogTemplates.filter((row: any) => row.is_active).length,
        active_cv_templates: catalogTemplates.filter((row: any) => row.is_active && row.template_type === "cv").length,
        active_lm_templates: catalogTemplates.filter((row: any) => row.is_active && row.template_type === "lm").length,
        active_packs: 0,
        active_questions: questions.filter((row: any) => row.is_active).length,
        top_templates: topTemplates,
      };

      return json({
        rules: rules.sort((a: any, b: any) => String(a.group_key).localeCompare(String(b.group_key)) || Number(a.display_order || 0) - Number(b.display_order || 0)),
        token_config: tokenConfig.sort((a: any, b: any) => Number(a.display_order || 0) - Number(b.display_order || 0)),
        token_packs: [],
        ai_config: aiConfig.sort((a: any, b: any) => String(a.config_key).localeCompare(String(b.config_key))),
        templates: catalogTemplates.sort((a: any, b: any) => String(a.template_type).localeCompare(String(b.template_type)) || Number(a.display_order || 0) - Number(b.display_order || 0) || String(a.template_key).localeCompare(String(b.template_key))),
        questions: questions.sort((a: any, b: any) => dateValue(b.created_at) - dateValue(a.created_at)),
        exports: enrichedExports.sort((a: any, b: any) => dateValue(b.created_at) - dateValue(a.created_at)).slice(0, 500),
        transactions: learnerTransactions.sort((a: any, b: any) => dateValue(b.created_at) - dateValue(a.created_at)).slice(0, 500),
        stats,
      });
    }

    if (action === "save_rules") {
      const items = Array.isArray(body.rules) ? body.rules : [];
      for (const rule of items) {
        const safeRule = rule?.rule_key === "token_sales_enabled"
          ? { ...rule, value_json: { value: false }, is_active: false }
          : rule;
        const { error } = await sb.from("career_admin_rules").upsert(
          { ...safeRule, updated_at: new Date().toISOString() },
          { onConflict: "rule_key" },
        );
        if (error) throw error;
      }
      return json({ success: true, updated: items.length });
    }

    if (action === "save_ai_config") {
      const items = Array.isArray(body.configs) ? body.configs : [];
      for (const config of items) {
        const { error } = await sb.from("career_ai_config").upsert(
          { ...config, updated_at: new Date().toISOString() },
          { onConflict: "config_key" },
        );
        if (error) throw error;
      }
      return json({ success: true, updated: items.length });
    }

    if (action === "save_template") {
      const template = body.template || {};
      const key = String(template.template_key || "").trim();
      if (!key) return json({ error: "TEMPLATE_KEY_REQUIRED" }, 400);

      const { data: existing, error: existingError } = await sb
        .from("career_templates")
        .select("*")
        .eq("template_key", key)
        .maybeSingle();
      if (existingError) throw existingError;
      if (
        !existing
        || !["official", "custom"].includes(String(existing.catalog_status || ""))
        || LEGACY_TEMPLATE_KEYS.has(key.toLowerCase())
      ) {
        return json({ error: "TEMPLATE_NOT_EDITABLE", message: "Ce modèle n'appartient pas au catalogue actif." }, 409);
      }
      if (existing.catalog_status === "official" && !OFFICIAL_TEMPLATE_KEYS.has(key.toLowerCase())) {
        return json({ error: "TEMPLATE_NOT_EDITABLE", message: "Cette ancienne clé de modèle a été retirée." }, 409);
      }

      const patch = safeTemplatePatch(template, existing);
      const { data, error } = await sb.from("career_templates")
        .update(patch)
        .eq("template_key", key)
        .select("*")
        .single();
      if (error) throw error;

      const { error: orderError } = await sb.rpc("career_normalize_template_order", { p_template_type: patch.template_type });
      if (orderError) throw orderError;
      return json({ success: true, template: data });
    }

    if (action === "question_create") {
      const question = body.question || {};
      if (!String(question.question || "").trim()) return json({ error: "QUESTION_REQUIRED" }, 400);
      const { data, error } = await sb
        .from("career_interview_questions")
        .insert({
          ...question,
          question: String(question.question).trim(),
          created_by: adminId,
          updated_at: new Date().toISOString(),
        })
        .select("*")
        .single();
      if (error) throw error;
      return json({ question: data });
    }

    if (action === "question_toggle") {
      const { data, error } = await sb
        .from("career_interview_questions")
        .update({ is_active: Boolean(body.is_active), updated_at: new Date().toISOString() })
        .eq("id", body.id)
        .select("*")
        .single();
      if (error) throw error;
      return json({ question: data });
    }

    if (action === "question_delete") {
      const { error } = await sb.from("career_interview_questions").delete().eq("id", body.id);
      if (error) throw error;
      return json({ success: true });
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    console.error("career-studio-admin-config error:", error);
    return json({
      error: "SERVER_ERROR",
      message: error instanceof Error ? error.message : "Erreur inconnue",
    }, 500);
  }
});
