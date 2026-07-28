import { createClient } from 'npm:@supabase/supabase-js@2.49.8';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const txt = (v: unknown, n = 5000) => String(v ?? '').trim().slice(0, n);
const arr = (v: unknown, max = 100, itemMax = 160) => Array.isArray(v) ? [...new Set(v.map(x => txt(x, itemMax)).filter(Boolean))].slice(0, max) : [];

type Session = { userId: string; user: Record<string, unknown>; roles: string[]; isAdmin: boolean };
async function sessionFrom(req: Request, sb: ReturnType<typeof createClient>): Promise<Session> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('AUTH_REQUIRED');
  const { data: auth, error } = await sb.auth.getUser(token);
  if (error || !auth.user) throw new Error('AUTH_REQUIRED');
  const { data: user } = await sb.from('users').select('*').eq('id', auth.user.id).maybeSingle();
  const role = txt(user?.role || auth.user.user_metadata?.role, 80).toLowerCase();
  const roles = [role, ...(Array.isArray(user?.roles) ? user.roles : [])].map(x => txt(x, 80).toLowerCase());
  return { userId: auth.user.id, user: user || {}, roles, isAdmin: roles.some(r => ['admin','super_admin','super-admin'].includes(r)) };
}
async function ensureProfile(sb: ReturnType<typeof createClient>, userId: string) {
  const { data: existing } = await sb.from('project_portfolio_profiles').select('*').eq('user_id', userId).maybeSingle();
  if (existing) return existing;
  const { data, error } = await sb.from('project_portfolio_profiles').insert({ user_id: userId }).select('*').single();
  if (error) throw error;
  return data;
}
async function canManageProject(sb: ReturnType<typeof createClient>, s: Session, projectId: string) {
  if (s.isAdmin) return true;
  const { data: project } = await sb.from('omnia_projects').select('creator_user_id,organization_id').eq('id', projectId).maybeSingle();
  if (!project) return false;
  if (project.creator_user_id === s.userId) return true;
  const organizationId = txt((s.user as any).organization_id || (s.user as any).structure_id, 80);
  return Boolean(organizationId && project.organization_id === organizationId);
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json().catch(() => ({}));
    const action = txt(body.action, 80);

    if (action === 'public_portfolio') {
      const userId = txt(body.user_id, 80);
      const { data: profile } = await sb.from('project_portfolio_profiles').select('*').eq('user_id', userId).eq('status', 'published').maybeSingle();
      if (!profile) return json({ error: 'PORTFOLIO_NOT_FOUND' }, 404);
      const { data: items } = await sb.from('project_portfolio_items').select('*,evidence:omnia_project_verified_evidence(*,project:omnia_projects(id,slug,title,organization_name,project_type))').eq('profile_id', profile.id).eq('visibility', 'public').order('display_order');
      const safe = (items || []).map((item: any) => ({ ...item, evidence: { ...item.evidence, user_id: undefined, validated_by: undefined, evidence_url: item.show_deliverable_link ? item.evidence?.evidence_url : null, project: item.show_organization ? item.evidence?.project : { ...item.evidence?.project, organization_name: null } } }));
      return json({ success: true, profile: { headline: profile.headline, professional_summary: profile.professional_summary, target_roles: profile.target_roles, featured_skill_codes: profile.featured_skill_codes, show_identity_publicly: profile.show_identity_publicly }, items: safe });
    }

    const s = await sessionFrom(req, sb);

    if (action === 'dashboard') {
      const profile = await ensureProfile(sb, s.userId);
      const [{ data: evidence }, { data: items }, { data: recommendations }] = await Promise.all([
        sb.from('omnia_project_verified_evidence').select('*,project:omnia_projects(id,slug,title,organization_name,project_type,status),deliverable:omnia_project_deliverables(id,title,evaluation_score,evaluation_feedback,evaluated_at)').eq('user_id', s.userId).in('validation_status', ['validated','revoked']).order('validated_at', { ascending: false }),
        sb.from('project_portfolio_items').select('*').eq('profile_id', profile.id).order('display_order'),
        sb.from('project_recommendations').select('*,project:omnia_projects(id,slug,title,organization_name)').eq('recipient_user_id', s.userId).order('created_at', { ascending: false }),
      ]);
      return json({ success: true, profile, evidence: evidence || [], items: items || [], recommendations: recommendations || [] });
    }

    if (action === 'update_profile') {
      const profile = await ensureProfile(sb, s.userId);
      const status = ['draft','published','archived'].includes(txt(body.status, 20)) ? txt(body.status, 20) : profile.status;
      const patch = {
        headline: txt(body.headline, 180) || null,
        professional_summary: txt(body.professional_summary, 5000) || null,
        target_roles: arr(body.target_roles, 20, 120),
        featured_skill_codes: arr(body.featured_skill_codes, 40, 160),
        default_visibility: ['private','recruiters','public'].includes(txt(body.default_visibility, 20)) ? txt(body.default_visibility, 20) : 'private',
        allow_recruiter_contact: body.allow_recruiter_contact === true,
        show_identity_publicly: body.show_identity_publicly === true,
        status,
        published_at: status === 'published' ? (profile.published_at || new Date().toISOString()) : profile.published_at,
      };
      const { data, error } = await sb.from('project_portfolio_profiles').update(patch).eq('id', profile.id).select('*').single();
      if (error) throw error;
      return json({ success: true, profile: data });
    }

    if (action === 'save_items') {
      const profile = await ensureProfile(sb, s.userId);
      const requested = Array.isArray(body.items) ? body.items.slice(0, 100) : [];
      const ids = requested.map((i: any) => txt(i.evidence_id, 80)).filter(Boolean);
      const { data: owned } = ids.length ? await sb.from('omnia_project_verified_evidence').select('id,validation_status').eq('user_id', s.userId).in('id', ids) : { data: [] } as any;
      const valid = new Set((owned || []).filter((e: any) => e.validation_status === 'validated').map((e: any) => e.id));
      const rows = requested.filter((i: any) => valid.has(txt(i.evidence_id, 80))).map((i: any, index: number) => ({
        profile_id: profile.id,
        evidence_id: txt(i.evidence_id, 80),
        display_title: txt(i.display_title, 180) || null,
        display_summary: txt(i.display_summary, 3000) || null,
        visibility: ['private','anonymized','recruiters','public'].includes(txt(i.visibility, 20)) ? txt(i.visibility, 20) : 'private',
        is_featured: i.is_featured === true,
        display_order: Number.isFinite(Number(i.display_order)) ? Math.max(0, Number(i.display_order)) : index,
        show_score: i.show_score === true,
        show_organization: i.show_organization !== false,
        show_deliverable_link: i.show_deliverable_link === true,
        consented_at: new Date().toISOString(),
      }));
      await sb.from('project_portfolio_items').delete().eq('profile_id', profile.id);
      if (rows.length) { const { error } = await sb.from('project_portfolio_items').insert(rows); if (error) throw error; }
      for (const row of rows) await sb.from('omnia_project_verified_evidence').update({ portfolio_permission: row.visibility, visibility_updated_at: new Date().toISOString() }).eq('id', row.evidence_id).eq('user_id', s.userId);
      return json({ success: true, count: rows.length });
    }

    if (action === 'respond_recommendation') {
      const id = txt(body.recommendation_id, 80);
      const decision = txt(body.decision, 20);
      if (!['accept','decline'].includes(decision)) return json({ error: 'INVALID_DECISION' }, 400);
      const visibility = ['private','anonymized','recruiters','public'].includes(txt(body.visibility, 20)) ? txt(body.visibility, 20) : 'private';
      const { data: rec } = await sb.from('project_recommendations').select('*').eq('id', id).eq('recipient_user_id', s.userId).maybeSingle();
      if (!rec || rec.status !== 'submitted') return json({ error: 'RECOMMENDATION_NOT_AVAILABLE' }, 404);
      const status = decision === 'accept' ? 'accepted' : 'declined';
      const { data, error } = await sb.from('project_recommendations').update({ status, recipient_visibility: visibility, responded_at: new Date().toISOString() }).eq('id', id).select('*').single();
      if (error) throw error;
      if (status === 'accepted') {
        await sb.from('omnia_project_verified_evidence').insert({
          project_id: rec.project_id, user_id: s.userId, evidence_type: 'recommendation', title: `Recommandation — ${rec.author_name_snapshot}`,
          summary: rec.recommendation_text, skill_codes: rec.skill_codes || [], validation_status: 'validated', portfolio_permission: visibility,
          validated_by: rec.author_user_id, validated_at: rec.submitted_at || rec.created_at,
          evidence_payload: { recommendation_id: rec.id, rating: rec.rating, author_role: rec.author_role_snapshot, organization: rec.organization_name_snapshot },
        });
      }
      return json({ success: true, recommendation: data });
    }

    if (action === 'project_candidates') {
      const projectId = txt(body.project_id, 80);
      if (!(await canManageProject(sb, s, projectId))) return json({ error: 'FORBIDDEN' }, 403);
      const { data: applications } = await sb.from('omnia_project_applications').select('id,user_id,status,user:users!omnia_project_applications_user_id_fkey(id,full_name,email)').eq('project_id', projectId).eq('status', 'selected');
      const { data: members } = await sb.from('omnia_project_team_members').select('user_id,invitation_status,user:users!omnia_project_team_members_user_id_fkey(id,full_name,email),team:omnia_project_teams!inner(project_id)').eq('team.project_id', projectId).eq('invitation_status', 'accepted');
      const map = new Map<string, any>();
      for (const x of [...(applications || []), ...(members || [])] as any[]) { const u = x.user; if (u?.id) map.set(u.id, u); }
      return json({ success: true, users: [...map.values()] });
    }

    if (action === 'create_recommendation') {
      const projectId = txt(body.project_id, 80);
      const recipient = txt(body.recipient_user_id, 80);
      if (!(await canManageProject(sb, s, projectId))) return json({ error: 'FORBIDDEN' }, 403);
      if (!txt(body.recommendation_text, 5000)) return json({ error: 'RECOMMENDATION_REQUIRED' }, 400);
      const { data: project } = await sb.from('omnia_projects').select('id,organization_name').eq('id', projectId).maybeSingle();
      const fullName = txt((s.user as any).full_name || (s.user as any).email, 180) || 'Responsable de projet';
      const payload = {
        project_id: projectId, recipient_user_id: recipient, author_user_id: s.userId,
        author_name_snapshot: fullName, author_role_snapshot: s.roles[0] || 'responsable', organization_name_snapshot: project?.organization_name || null,
        recommendation_text: txt(body.recommendation_text, 5000), skill_codes: arr(body.skill_codes, 60, 160),
        rating: body.rating == null ? null : Math.max(1, Math.min(5, Number(body.rating))), status: 'submitted', submitted_at: new Date().toISOString(),
      };
      const { data: existing } = await sb.from('project_recommendations').select('id').eq('project_id', projectId).eq('recipient_user_id', recipient).eq('author_user_id', s.userId).neq('status','revoked').maybeSingle();
      const query = existing ? sb.from('project_recommendations').update(payload).eq('id', existing.id) : sb.from('project_recommendations').insert(payload);
      const { data, error } = await query.select('*').single();
      if (error) throw error;
      return json({ success: true, recommendation: data }, 201);
    }


    return json({ error: 'UNKNOWN_ACTION' }, 400);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'INTERNAL_ERROR';
    return json({ error: message }, message === 'AUTH_REQUIRED' ? 401 : 500);
  }
});
