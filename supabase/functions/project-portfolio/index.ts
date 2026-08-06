import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-omnia-session-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const text = (value: unknown, max = 5000) => String(value ?? "").trim().slice(0, max);
const textArray = (value: unknown, max = 100, itemMax = 160) => Array.isArray(value)
  ? [...new Set(value.map((item) => text(item, itemMax)).filter(Boolean))].slice(0, max)
  : [];

type Session = { userId: string; user: any; roles: string[]; isAdmin: boolean; isRecruiter: boolean; organizationId: string | null };
function tokenFrom(req: Request, bodyToken = "") {
  return (bodyToken || req.headers.get("x-omnia-session-token") || req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
}
async function sessionFrom(req: Request, sb: any, bodyToken = ""): Promise<Session> {
  const token = tokenFrom(req, bodyToken);
  if (!token) throw new Error("AUTH_REQUIRED");
  const { data: active } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!active?.user_id) throw new Error("AUTH_REQUIRED");
  const userId = String(active.user_id);
  const [{ data: user }, { data: roleRows }, { data: manager }] = await Promise.all([
    sb.from("users").select("id,full_name,email,status,avatar_url").eq("id", userId).maybeSingle(),
    sb.from("user_roles").select("role").eq("user_id", userId),
    sb.from("partner_managers").select("organization_id,status,is_primary").eq("user_id", userId).eq("status", "actif").order("is_primary", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const roles = (roleRows || []).map((row: any) => text(row.role, 80).toLowerCase());
  return {
    userId,
    user: user || {},
    roles,
    isAdmin: roles.some((role: string) => ["super_admin", "admin"].includes(role)),
    isRecruiter: roles.some((role: string) => ["recruteur", "recruteur_independant", "recruiter"].includes(role)) || (roles.includes("recruteur_structure") && !!manager?.organization_id),
    organizationId: manager?.organization_id ? String(manager.organization_id) : null,
  };
}
async function ensureProfile(sb: any, userId: string) {
  const { data: existing } = await sb.from("project_portfolio_profiles").select("*").eq("user_id", userId).maybeSingle();
  if (existing) return existing;
  const { data, error } = await sb.from("project_portfolio_profiles").insert({ user_id: userId }).select("*").single();
  if (error) throw error;
  return data;
}
async function canManageProject(sb: any, session: Session, projectId: string) {
  if (session.isAdmin) return true;
  const { data: project } = await sb.from("omnia_projects").select("creator_user_id,organization_id").eq("id", projectId).maybeSingle();
  return Boolean(project && (String(project.creator_user_id) === session.userId || (session.organizationId && String(project.organization_id) === session.organizationId)));
}
async function selectedProjectUsers(sb: any, projectId: string) {
  const [{ data: applications }, { data: teams }] = await Promise.all([
    sb.from("omnia_project_applications").select("applicant_user_id,status,user:users!omnia_project_applications_applicant_user_id_fkey(id,full_name,email)").eq("project_id", projectId).eq("status", "selected"),
    sb.from("omnia_project_teams").select("id,status,members:omnia_project_team_members(user_id,invitation_status,user:users!omnia_project_team_members_user_id_fkey(id,full_name,email))").eq("project_id", projectId).in("status", ["selected", "active", "completed"]),
  ]);
  const users = new Map<string, any>();
  for (const row of applications || []) if (row.user?.id) users.set(String(row.user.id), row.user);
  for (const team of teams || []) for (const member of team.members || []) if (member.invitation_status === "accepted" && member.user?.id) users.set(String(member.user.id), member.user);
  return users;
}
function safeEvidenceItem(item: any) {
  const evidence = item.evidence || {};
  return {
    ...item,
    evidence: {
      ...evidence,
      user_id: undefined,
      validated_by: undefined,
      evidence_url: item.show_deliverable_link ? evidence.evidence_url : null,
      project: item.show_organization ? evidence.project : { ...(evidence.project || {}), organization_name: null },
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const body = await req.json().catch(() => ({}));
    const action = text(body.action, 80);

    if (action === "public_portfolio") {
      const userId = text(body.user_id, 80);
      const { data: profile } = await sb.from("project_portfolio_profiles").select("*").eq("user_id", userId).eq("status", "published").eq("default_visibility", "public").maybeSingle();
      if (!profile) return json({ error: "PORTFOLIO_NOT_FOUND" }, 404);
      const { data: items, error } = await sb.from("project_portfolio_items")
        .select("*,evidence:omnia_project_verified_evidence(*,project:omnia_projects(id,slug,title,organization_name,project_type))")
        .eq("profile_id", profile.id).eq("visibility", "public").order("display_order");
      if (error) throw error;
      return json({ success: true, profile: { headline: profile.headline, professional_summary: profile.professional_summary, target_roles: profile.target_roles, featured_skill_codes: profile.featured_skill_codes, show_identity_publicly: profile.show_identity_publicly }, items: (items || []).map(safeEvidenceItem) });
    }

    const session = await sessionFrom(req, sb, text(body.session_token, 400));

    if (action === "recruiter_portfolio") {
      if (!session.isRecruiter && !session.isAdmin) return json({ error: "FORBIDDEN" }, 403);
      const userId = text(body.user_id, 80);
      const [{ data: consent }, { data: profile }] = await Promise.all([
        sb.from("employability_profiles").select("status,talent_visibility,use_project_evidence").eq("user_id", userId).maybeSingle(),
        sb.from("project_portfolio_profiles").select("*").eq("user_id", userId).eq("status", "published").maybeSingle(),
      ]);
      if (!consent || consent.status !== "active" || !consent.use_project_evidence || !["recruiters", "public"].includes(consent.talent_visibility) || !profile) return json({ error: "PORTFOLIO_NOT_AUTHORIZED" }, 403);
      const { data: items, error } = await sb.from("project_portfolio_items")
        .select("*,evidence:omnia_project_verified_evidence(*,project:omnia_projects(id,slug,title,organization_name,project_type))")
        .eq("profile_id", profile.id).in("visibility", ["recruiters", "public"]).order("display_order");
      if (error) throw error;
      await sb.from("employability_recruiter_access_log").insert({ recruiter_user_id: session.userId, talent_user_id: userId, organization_id: session.organizationId, action: "portfolio_view", purpose: text(body.purpose, 500) || "Consultation du portfolio autorisé" });
      return json({ success: true, profile, items: (items || []).map(safeEvidenceItem) });
    }

    if (action === "dashboard") {
      const profile = await ensureProfile(sb, session.userId);
      const [{ data: evidence }, { data: items }, { data: recommendations }] = await Promise.all([
        sb.from("omnia_project_verified_evidence").select("*,project:omnia_projects(id,slug,title,organization_name,project_type,status),deliverable:omnia_project_deliverables(id,title,evaluation_score,evaluation_feedback,evaluated_at)").eq("user_id", session.userId).in("validation_status", ["validated", "revoked"]).order("validated_at", { ascending: false }),
        sb.from("project_portfolio_items").select("*").eq("profile_id", profile.id).order("display_order"),
        sb.from("project_recommendations").select("*,project:omnia_projects(id,slug,title,organization_name)").eq("recipient_user_id", session.userId).order("created_at", { ascending: false }),
      ]);
      return json({ success: true, profile, evidence: evidence || [], items: items || [], recommendations: recommendations || [] });
    }

    if (action === "update_profile") {
      const profile = await ensureProfile(sb, session.userId);
      const status = ["draft", "published", "archived"].includes(text(body.status, 20)) ? text(body.status, 20) : profile.status;
      const patch = {
        headline: text(body.headline, 180) || null,
        professional_summary: text(body.professional_summary, 5000) || null,
        target_roles: textArray(body.target_roles, 20, 120),
        featured_skill_codes: textArray(body.featured_skill_codes, 40, 160),
        default_visibility: ["private", "recruiters", "public"].includes(text(body.default_visibility, 20)) ? text(body.default_visibility, 20) : "private",
        allow_recruiter_contact: body.allow_recruiter_contact === true,
        show_identity_publicly: body.show_identity_publicly === true,
        status,
        published_at: status === "published" ? (profile.published_at || new Date().toISOString()) : profile.published_at,
      };
      const { data, error } = await sb.from("project_portfolio_profiles").update(patch).eq("id", profile.id).select("*").single();
      if (error) throw error;
      return json({ success: true, profile: data });
    }

    if (action === "save_items") {
      const profile = await ensureProfile(sb, session.userId);
      const requested = Array.isArray(body.items) ? body.items.slice(0, 100) : [];
      const ids = requested.map((item: any) => text(item.evidence_id, 80)).filter(Boolean);
      const { data: owned } = ids.length ? await sb.from("omnia_project_verified_evidence").select("id,validation_status").eq("user_id", session.userId).in("id", ids) : { data: [] };
      const valid = new Set((owned || []).filter((row: any) => row.validation_status === "validated").map((row: any) => String(row.id)));
      const rows = requested.filter((item: any) => valid.has(text(item.evidence_id, 80))).map((item: any, index: number) => ({
        profile_id: profile.id,
        evidence_id: text(item.evidence_id, 80),
        display_title: text(item.display_title, 180) || null,
        display_summary: text(item.display_summary, 3000) || null,
        visibility: ["private", "anonymized", "recruiters", "public"].includes(text(item.visibility, 20)) ? text(item.visibility, 20) : "private",
        is_featured: item.is_featured === true,
        display_order: Number.isFinite(Number(item.display_order)) ? Math.max(0, Number(item.display_order)) : index,
        show_score: item.show_score === true,
        show_organization: item.show_organization !== false,
        show_deliverable_link: item.show_deliverable_link === true,
        consented_at: new Date().toISOString(),
      }));
      await sb.from("project_portfolio_items").delete().eq("profile_id", profile.id);
      if (rows.length) { const { error } = await sb.from("project_portfolio_items").insert(rows); if (error) throw error; }
      for (const row of rows) await sb.from("omnia_project_verified_evidence").update({ portfolio_permission: row.visibility, visibility_updated_at: new Date().toISOString() }).eq("id", row.evidence_id).eq("user_id", session.userId);
      return json({ success: true, count: rows.length });
    }

    if (action === "respond_recommendation") {
      const id = text(body.recommendation_id, 80);
      const decision = text(body.decision, 20);
      if (!["accept", "decline"].includes(decision)) return json({ error: "INVALID_DECISION" }, 400);
      const visibility = ["private", "anonymized", "recruiters", "public"].includes(text(body.visibility, 20)) ? text(body.visibility, 20) : "private";
      const { data: recommendation } = await sb.from("project_recommendations").select("*").eq("id", id).eq("recipient_user_id", session.userId).maybeSingle();
      if (!recommendation || recommendation.status !== "submitted") return json({ error: "RECOMMENDATION_NOT_AVAILABLE" }, 404);
      const status = decision === "accept" ? "accepted" : "declined";
      const { data, error } = await sb.from("project_recommendations").update({ status, recipient_visibility: visibility, responded_at: new Date().toISOString() }).eq("id", id).select("*").single();
      if (error) throw error;
      if (status === "accepted") {
        const sourceReference = `recommendation:${recommendation.id}`;
        const { error: evidenceError } = await sb.from("omnia_project_verified_evidence").upsert({
          project_id: recommendation.project_id,
          user_id: session.userId,
          evidence_type: "recommendation",
          title: `Recommandation — ${recommendation.author_name_snapshot}`,
          summary: recommendation.recommendation_text,
          skill_codes: recommendation.skill_codes || [],
          validation_status: "validated",
          portfolio_permission: visibility,
          validated_by: recommendation.author_user_id,
          validated_at: recommendation.submitted_at || recommendation.created_at,
          source_reference: sourceReference,
          evidence_payload: { recommendation_id: recommendation.id, rating: recommendation.rating, author_role: recommendation.author_role_snapshot, organization: recommendation.organization_name_snapshot },
        }, { onConflict: "user_id,source_reference" });
        if (evidenceError) throw evidenceError;
      }
      return json({ success: true, recommendation: data });
    }

    if (action === "admin_list_recommendations") {
      if (!session.isAdmin) return json({ error: "FORBIDDEN" }, 403);
      const { data: rows, error } = await sb.from("project_recommendations")
        .select("*")
        .order("created_at", { ascending: false }).limit(500);
      if (error) throw error;

      const recommendations = rows || [];
      const projectIds = [...new Set(recommendations.map((row: any) => String(row.project_id || "")).filter(Boolean))];
      const recipientIds = [...new Set(recommendations.map((row: any) => String(row.recipient_user_id || "")).filter(Boolean))];
      const [{ data: projects }, { data: recipients }] = await Promise.all([
        projectIds.length ? sb.from("omnia_projects").select("id,slug,title,organization_name").in("id", projectIds) : Promise.resolve({ data: [] }),
        recipientIds.length ? sb.from("users").select("id,full_name,email").in("id", recipientIds) : Promise.resolve({ data: [] }),
      ]);
      const projectMap = new Map((projects || []).map((item: any) => [String(item.id), item]));
      const recipientMap = new Map((recipients || []).map((item: any) => [String(item.id), item]));
      return json({
        success: true,
        recommendations: recommendations.map((row: any) => ({
          ...row,
          project: projectMap.get(String(row.project_id)) || null,
          recipient: recipientMap.get(String(row.recipient_user_id)) || null,
        })),
      });
    }

    if (action === "admin_revoke_recommendation") {
      if (!session.isAdmin) return json({ error: "FORBIDDEN" }, 403);
      const id = text(body.recommendation_id, 80);
      const reason = text(body.reason, 1000);
      if (!id || !reason) return json({ error: "REASON_REQUIRED" }, 400);
      const { data, error } = await sb.from("project_recommendations")
        .update({ status: "revoked", revocation_reason: reason, revoked_at: new Date().toISOString() })
        .eq("id", id).select("*").single();
      if (error) throw error;
      await sb.from("omnia_project_verified_evidence")
        .update({ validation_status: "revoked", revoked_at: new Date().toISOString(), revocation_reason: reason })
        .eq("source_reference", `recommendation:${id}`);
      return json({ success: true, recommendation: data });
    }

    if (action === "project_candidates") {
      const projectId = text(body.project_id, 80);
      if (!(await canManageProject(sb, session, projectId))) return json({ error: "FORBIDDEN" }, 403);
      return json({ success: true, users: [...(await selectedProjectUsers(sb, projectId)).values()] });
    }

    if (action === "create_recommendation") {
      if (session.isAdmin) return json({ error: "ADMIN_CANNOT_CREATE_RECOMMENDATION" }, 403);
      const projectId = text(body.project_id, 80);
      const recipient = text(body.recipient_user_id, 80);
      if (!(await canManageProject(sb, session, projectId))) return json({ error: "FORBIDDEN" }, 403);
      if (!text(body.recommendation_text, 5000)) return json({ error: "RECOMMENDATION_REQUIRED" }, 400);
      const participants = await selectedProjectUsers(sb, projectId);
      if (!participants.has(recipient)) return json({ error: "RECIPIENT_NOT_PROJECT_PARTICIPANT" }, 409);
      const { data: project } = await sb.from("omnia_projects").select("id,organization_name").eq("id", projectId).maybeSingle();
      const payload = {
        project_id: projectId,
        recipient_user_id: recipient,
        author_user_id: session.userId,
        author_name_snapshot: text(session.user.full_name || session.user.email, 180) || "Responsable de projet",
        author_role_snapshot: session.roles[0] || "responsable",
        organization_name_snapshot: project?.organization_name || null,
        recommendation_text: text(body.recommendation_text, 5000),
        skill_codes: textArray(body.skill_codes, 60, 160),
        rating: body.rating == null ? null : Math.max(1, Math.min(5, Number(body.rating))),
        status: "submitted",
        submitted_at: new Date().toISOString(),
      };
      const { data: existing } = await sb.from("project_recommendations").select("id").eq("project_id", projectId).eq("recipient_user_id", recipient).eq("author_user_id", session.userId).neq("status", "revoked").maybeSingle();
      const query = existing ? sb.from("project_recommendations").update(payload).eq("id", existing.id) : sb.from("project_recommendations").insert(payload);
      const { data, error } = await query.select("*").single();
      if (error) throw error;
      return json({ success: true, recommendation: data }, 201);
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "INTERNAL_ERROR";
    return json({ error: message }, message === "AUTH_REQUIRED" ? 401 : message === "FORBIDDEN" ? 403 : 500);
  }
});
