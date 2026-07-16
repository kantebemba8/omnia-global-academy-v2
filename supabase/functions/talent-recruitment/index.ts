import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Session = { userId: string; roles: string[]; organizationId: string | null; isPrimaryManager: boolean; permissions: Record<string, boolean> };

async function authenticate(sb: ReturnType<typeof createClient>, req: Request): Promise<Session | null> {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data: session } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!session) return null;
  const userId = String(session.user_id);
  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", userId);
  const { data: manager } = await sb.from("partner_managers").select("organization_id,is_primary,permissions,status").eq("user_id", userId).eq("status", "actif").maybeSingle();
  const organizationId = manager?.organization_id ? String(manager.organization_id) : null;
  let permissions: Record<string, boolean> = (manager?.permissions as Record<string, boolean>) || {};
  if (organizationId) {
    const { data: explicit } = await sb.from("talent_structure_permissions").select("*").eq("organization_id", organizationId).eq("user_id", userId).maybeSingle();
    if (explicit) permissions = { ...permissions, ...explicit };
  }
  return { userId, roles: (roles || []).map((r: any) => String(r.role)), organizationId, isPrimaryManager: !!manager?.is_primary, permissions };
}

function hasRole(s: Session, ...roles: string[]) { return roles.some(r => s.roles.includes(r)); }
function canUseRecruiter(s: Session) { return hasRole(s, "recruteur", "super_admin") || !!s.organizationId; }
function can(s: Session, permission: string) {
  if (hasRole(s, "super_admin") || s.isPrimaryManager) return true;
  if (hasRole(s, "recruteur") && ["can_search_talent","can_contact_talent","can_schedule_interview","can_post_job","can_manage_jobs"].includes(permission)) return true;
  return s.permissions[permission] === true;
}
function scopeOrg(s: Session, scope: string) { return scope === "structure" ? s.organizationId : null; }

async function profilesByIds(sb: ReturnType<typeof createClient>, ids: string[]) {
  if (!ids.length) return new Map<string, any>();
  const { data } = await sb.from("career_public_profiles").select("user_id,full_name,professional_title,location,photo_url,visibility").in("user_id", ids);
  return new Map((data || []).map((p: any) => [String(p.user_id), { ...p, id: p.user_id }]));
}

async function logActivity(sb: ReturnType<typeof createClient>, s: Session, organizationId: string | null, talentUserId: string | null, action: string, entityType?: string, entityId?: string, metadata: Record<string, unknown> = {}) {
  await sb.from("talent_activity_log").insert({ actor_user_id: s.userId, organization_id: organizationId, talent_user_id: talentUserId, action, entity_type: entityType || null, entity_id: entityId || null, metadata }).catch(() => {});
}

async function queueNotification(sb: ReturnType<typeof createClient>, userId: string, type: string, payload: Record<string, unknown>) {
  await sb.from("notification_queue").insert({ notification_type: type, user_id: userId, payload }).catch(() => {});
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const session = await authenticate(sb, req);
    if (!session) return json({ error: "SESSION_INVALID" }, 401);
    if (!canUseRecruiter(session)) return json({ error: "FORBIDDEN" }, 403);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const scope = body.scope === "structure" ? "structure" : "recruiter";
    const organizationId = scopeOrg(session, scope);
    if (scope === "structure" && !organizationId && !hasRole(session, "super_admin")) return json({ error: "NO_STRUCTURE" }, 403);

    if (action === "dashboard") {
      const favoriteQuery = organizationId ? sb.from("talent_favorites").select("id", { count: "exact", head: true }).eq("organization_id", organizationId) : sb.from("talent_favorites").select("id", { count: "exact", head: true }).eq("actor_user_id", session.userId).is("organization_id", null);
      const contactQuery = organizationId ? sb.from("talent_contacts").select("id", { count: "exact", head: true }).eq("organization_id", organizationId) : sb.from("talent_contacts").select("id", { count: "exact", head: true }).eq("actor_user_id", session.userId).is("organization_id", null);
      const interviewQuery = organizationId ? sb.from("talent_interviews").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).gte("scheduled_at", new Date().toISOString()).in("status", ["pending","accepted"]) : sb.from("talent_interviews").select("id", { count: "exact", head: true }).eq("requested_by", session.userId).is("organization_id", null).gte("scheduled_at", new Date().toISOString()).in("status", ["pending","accepted"]);
      const [favorites, contacts, interviews] = await Promise.all([favoriteQuery, contactQuery, interviewQuery]);
      return json({ success: true, metrics: { favorites: favorites.count || 0, contacts: contacts.count || 0, upcoming_interviews: interviews.count || 0 } });
    }

    if (action === "list_favorites") {
      const q = organizationId ? sb.from("talent_favorites").select("id,talent_user_id,created_at").eq("organization_id", organizationId) : sb.from("talent_favorites").select("id,talent_user_id,created_at").eq("actor_user_id", session.userId).is("organization_id", null);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      const map = await profilesByIds(sb, (data || []).map((r: any) => String(r.talent_user_id)));
      return json({ success: true, favorites: (data || []).map((r: any) => map.get(String(r.talent_user_id))).filter(Boolean) });
    }

    if (action === "toggle_favorite") {
      if (!can(session, "can_search_talent")) return json({ error: "PERMISSION_DENIED" }, 403);
      const talentId = String(body.talent_user_id || "");
      if (!talentId) return json({ error: "TALENT_REQUIRED" }, 400);
      let find = sb.from("talent_favorites").select("id").eq("talent_user_id", talentId);
      find = organizationId ? find.eq("organization_id", organizationId) : find.eq("actor_user_id", session.userId).is("organization_id", null);
      const { data: existing } = await find.maybeSingle();
      if (existing) {
        await sb.from("talent_favorites").delete().eq("id", existing.id);
        await logActivity(sb, session, organizationId, talentId, "favorite_removed", "talent", talentId);
        return json({ success: true, favorite: false });
      }
      await sb.from("talent_favorites").insert({ actor_user_id: session.userId, organization_id: organizationId, talent_user_id: talentId });
      await logActivity(sb, session, organizationId, talentId, "favorite_added", "talent", talentId);
      return json({ success: true, favorite: true });
    }

    if (action === "contact_talent") {
      if (!can(session, "can_contact_talent")) return json({ error: "PERMISSION_DENIED" }, 403);
      const talentId = String(body.talent_user_id || "");
      const message = String(body.message || "").trim();
      if (!talentId || message.length < 5) return json({ error: "INVALID_CONTACT" }, 400);
      const { data: contact, error } = await sb.from("talent_contacts").insert({ actor_user_id: session.userId, organization_id: organizationId, talent_user_id: talentId, subject: body.subject || null, message, status: "sent" }).select().single();
      if (error) throw error;
      let convQuery = sb.from("talent_conversations").select("id").eq("talent_user_id", talentId).is("closed_at", null);
      convQuery = organizationId ? convQuery.eq("organization_id", organizationId) : convQuery.eq("created_by", session.userId).is("organization_id", null);
      let { data: conversation } = await convQuery.maybeSingle();
      if (!conversation) {
        const created = await sb.from("talent_conversations").insert({ created_by: session.userId, organization_id: organizationId, talent_user_id: talentId, subject: body.subject || "Prise de contact" }).select("id").single();
        if (created.error) throw created.error;
        conversation = created.data;
      }
      await sb.from("talent_messages").insert({ conversation_id: conversation.id, sender_user_id: session.userId, recipient_user_id: talentId, body: message });
      await sb.from("talent_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversation.id);
      await queueNotification(sb, talentId, "talent_recruiter_contact", { contact_id: contact.id, conversation_id: conversation.id, organization_id: organizationId, recruiter_user_id: session.userId });
      const { data: admins } = await sb.from("user_roles").select("user_id").eq("role", "super_admin");
      for (const admin of admins || []) await queueNotification(sb, String(admin.user_id), "talent_contact_admin_alert", { contact_id: contact.id, talent_user_id: talentId, recruiter_user_id: session.userId, organization_id: organizationId });
      await logActivity(sb, session, organizationId, talentId, "talent_contacted", "contact", contact.id);
      return json({ success: true, contact, conversation_id: conversation.id });
    }

    if (action === "list_contacts") {
      let q = sb.from("talent_contacts").select("*");
      q = organizationId ? q.eq("organization_id", organizationId) : q.eq("actor_user_id", session.userId).is("organization_id", null);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      const map = await profilesByIds(sb, (data || []).map((r: any) => String(r.talent_user_id)));
      return json({ success: true, contacts: (data || []).map((r: any) => ({ ...r, talent: map.get(String(r.talent_user_id)) || null })) });
    }

    if (action === "create_interview") {
      if (!can(session, "can_schedule_interview")) return json({ error: "PERMISSION_DENIED" }, 403);
      const talentId = String(body.talent_user_id || "");
      const scheduledAt = String(body.scheduled_at || "");
      if (!talentId || !scheduledAt || Number.isNaN(Date.parse(scheduledAt))) return json({ error: "INVALID_INTERVIEW" }, 400);
      const { data, error } = await sb.from("talent_interviews").insert({ requested_by: session.userId, organization_id: organizationId, talent_user_id: talentId, job_id: body.job_id || null, title: body.title || "Entretien de recrutement", interview_mode: body.interview_mode || "video", scheduled_at: scheduledAt, duration_minutes: Number(body.duration_minutes || 30), meeting_url: body.meeting_url || null, location: body.location || null, notes: body.notes || null }).select().single();
      if (error) throw error;
      await queueNotification(sb, talentId, "talent_interview_requested", { interview_id: data.id, scheduled_at: data.scheduled_at, title: data.title });
      await logActivity(sb, session, organizationId, talentId, "interview_requested", "interview", data.id);
      return json({ success: true, interview: data });
    }

    if (action === "list_interviews") {
      let q = sb.from("talent_interviews").select("*");
      q = organizationId ? q.eq("organization_id", organizationId) : q.eq("requested_by", session.userId).is("organization_id", null);
      const { data, error } = await q.order("scheduled_at", { ascending: true });
      if (error) throw error;
      const map = await profilesByIds(sb, (data || []).map((r: any) => String(r.talent_user_id)));
      return json({ success: true, interviews: (data || []).map((r: any) => ({ ...r, talent: map.get(String(r.talent_user_id)) || null })) });
    }

    if (action === "list_conversations") {
      let q = sb.from("talent_conversations").select("id,talent_user_id,subject,last_message_at,created_at").is("closed_at", null);
      q = organizationId ? q.eq("organization_id", organizationId) : q.eq("created_by", session.userId).is("organization_id", null);
      const { data, error } = await q.order("last_message_at", { ascending: false });
      if (error) throw error;
      const map = await profilesByIds(sb, (data || []).map((r: any) => String(r.talent_user_id)));
      const result = [];
      for (const conversation of data || []) {
        const { data: last } = await sb.from("talent_messages").select("body,created_at,read_at,sender_user_id").eq("conversation_id", conversation.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
        result.push({ ...conversation, talent: map.get(String(conversation.talent_user_id)) || null, last_message: last || null });
      }
      return json({ success: true, conversations: result });
    }

    if (action === "send_message") {
      if (!can(session, "can_contact_talent")) return json({ error: "PERMISSION_DENIED" }, 403);
      const conversationId = String(body.conversation_id || "");
      const text = String(body.message || "").trim();
      if (!conversationId || !text) return json({ error: "INVALID_MESSAGE" }, 400);
      let q = sb.from("talent_conversations").select("id,talent_user_id,organization_id,created_by").eq("id", conversationId);
      const { data: conversation } = await q.maybeSingle();
      if (!conversation) return json({ error: "CONVERSATION_NOT_FOUND" }, 404);
      const owns = organizationId ? String(conversation.organization_id || "") === organizationId : String(conversation.created_by) === session.userId && !conversation.organization_id;
      if (!owns && !hasRole(session, "super_admin")) return json({ error: "FORBIDDEN" }, 403);
      const { data, error } = await sb.from("talent_messages").insert({ conversation_id: conversationId, sender_user_id: session.userId, recipient_user_id: conversation.talent_user_id, body: text }).select().single();
      if (error) throw error;
      await sb.from("talent_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId);
      await queueNotification(sb, String(conversation.talent_user_id), "talent_new_message", { conversation_id: conversationId, message_id: data.id });
      return json({ success: true, message: data });
    }

    if (action === "list_team_permissions") {
      if (!organizationId) return json({ error: "NO_STRUCTURE" }, 403);
      const { data: members, error } = await sb.from("partner_managers").select("user_id,role_in_org,is_primary,status,users(full_name,email)").eq("organization_id", organizationId).eq("status", "actif");
      if (error) throw error;
      const { data: permissions } = await sb.from("talent_structure_permissions").select("*").eq("organization_id", organizationId);
      const byUser = new Map((permissions || []).map((p: any) => [String(p.user_id), p]));
      return json({ success: true, members: (members || []).map((m: any) => ({ ...m, recruitment_permissions: byUser.get(String(m.user_id)) || null })) });
    }

    if (action === "update_team_permissions") {
      if (!organizationId || !can(session, "can_manage_team")) return json({ error: "PERMISSION_DENIED" }, 403);
      const targetUserId = String(body.user_id || "");
      if (!targetUserId) return json({ error: "USER_REQUIRED" }, 400);
      const keys = ["can_post_job","can_search_talent","can_contact_talent","can_manage_jobs","can_view_applications","can_schedule_interview","can_manage_team"];
      const row: Record<string, unknown> = { organization_id: organizationId, user_id: targetUserId, updated_at: new Date().toISOString() };
      for (const key of keys) if (body.permissions?.[key] !== undefined) row[key] = !!body.permissions[key];
      const { data, error } = await sb.from("talent_structure_permissions").upsert(row, { onConflict: "organization_id,user_id" }).select().single();
      if (error) throw error;
      await logActivity(sb, session, organizationId, targetUserId, "recruitment_permissions_updated", "user", targetUserId, row);
      return json({ success: true, permissions: data });
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    console.error("talent-recruitment", error);
    return json({ error: "SERVER_ERROR", message: error instanceof Error ? error.message : String(error) }, 500);
  }
});
