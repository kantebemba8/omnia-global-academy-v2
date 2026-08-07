import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../../components/AdminLayout';
import { ENDPOINTS } from '../../lib/config';
import { getSessionToken } from '../../lib/session';
import {
  BookOpen,
  Building2,
  CheckCircle,
  Clock,
  Copy,
  FileText,
  Monitor,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from 'lucide-react';

type TabKey = 'overview' | 'demo' | 'temporary' | 'inherited' | 'audit';
type ActionSource = 'demo' | 'invitation' | 'delegation' | 'jury';

type ModalState = {
  mode: 'extend' | 'revoke';
  source: ActionSource;
  id: string;
  title: string;
  currentExpiry?: string | null;
} | null;

const BLUE = '#002050';
const GOLD = '#BF8813';

const ROLE_OPTIONS = [
  { key: 'apprenant', label: 'Apprenant' },
  { key: 'professeur', label: 'Professeur' },
  { key: 'responsable_structure', label: 'Responsable de structure' },
  { key: 'moderateur', label: 'Modérateur' },
];

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Vue d’ensemble' },
  { key: 'demo', label: 'Démonstration' },
  { key: 'temporary', label: 'Accès temporaires' },
  { key: 'inherited', label: 'Structure & B2B' },
  { key: 'audit', label: 'Audit' },
];

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  return Array.from({ length: 14 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function fmt(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

function dateInputValue(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function isFuture(value?: string | null) {
  return Boolean(value && new Date(value).getTime() > Date.now());
}

function badge(status?: string | null) {
  const active = ['active', 'actif', 'accepted', 'invited', 'pending', 'validated'].includes(String(status || '').toLowerCase());
  return active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600';
}

function errorLabel(code: string) {
  const labels: Record<string, string> = {
    REASON_REQUIRED: 'Un motif administratif est obligatoire.',
    EXPIRY_IN_PAST: 'La nouvelle expiration doit être dans le futur.',
    EXPIRY_NOT_EXTENDED: 'La nouvelle expiration doit être postérieure à l’expiration actuelle.',
    INVITATION_NOT_EXTENDABLE: 'Cette invitation ne peut plus être prolongée.',
    DELEGATION_REVOKED: 'Cette délégation a déjà été révoquée.',
    JURY_ACCESS_NOT_EXTENDABLE: 'Cet accès jury ne peut plus être prolongé.',
    PASSWORD_TOO_SHORT: 'Le mot de passe est trop court.',
    PASSWORD_TOO_LONG: 'Le mot de passe est trop long.',
  };
  return labels[code] || code || 'Une erreur est survenue.';
}

export default function AdminDemoAccess() {
  const [tab, setTab] = useState<TabKey>('overview');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState<ModalState>(null);
  const [modalReason, setModalReason] = useState('');
  const [modalExpiry, setModalExpiry] = useState('');
  const [form, setForm] = useState({
    password: '',
    expires_at: '',
    demo_roles: ['apprenant'] as string[],
    demo_course_ids: [] as string[],
  });

  async function call(body?: Record<string, unknown>) {
    const token = getSessionToken();
    const response = await fetch(ENDPOINTS.adminDemoConfigure, {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success === false) throw new Error(result.message || result.error || 'SERVER_ERROR');
    return result;
  }

  async function load() {
    try {
      setLoading(true);
      setData(await call());
    } catch (caught) {
      setToast(errorLabel(caught instanceof Error ? caught.message : 'SERVER_ERROR'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 4500);
  }

  function toggleRole(role: string) {
    setForm((current) => ({
      ...current,
      demo_roles: current.demo_roles.includes(role)
        ? current.demo_roles.filter((item) => item !== role)
        : [...current.demo_roles, role],
    }));
  }

  function toggleCourse(id: string) {
    setForm((current) => ({
      ...current,
      demo_course_ids: current.demo_course_ids.includes(id)
        ? current.demo_course_ids.filter((item) => item !== id)
        : [...current.demo_course_ids, id],
    }));
  }

  async function configureDemo() {
    if (!form.password || !form.expires_at || !form.demo_roles.length) {
      showToast('Mot de passe, expiration et au moins un rôle sont obligatoires.');
      return;
    }
    setBusy('demo');
    try {
      await call({
        action: 'configure_demo',
        new_password: form.password,
        expires_at: new Date(form.expires_at).toISOString(),
        demo_roles: form.demo_roles,
        demo_course_ids: form.demo_course_ids,
      });
      setForm({ password: '', expires_at: '', demo_roles: ['apprenant'], demo_course_ids: [] });
      showToast('Accès de démonstration configuré. Les anciennes sessions ont été invalidées.');
      await load();
    } catch (caught) {
      showToast(errorLabel(caught instanceof Error ? caught.message : 'SERVER_ERROR'));
    } finally {
      setBusy('');
    }
  }

  async function copyPassword() {
    if (!form.password) return;
    try {
      await navigator.clipboard.writeText(form.password);
      showToast('Mot de passe copié.');
    } catch {
      showToast('Copie automatique impossible.');
    }
  }

  function openAction(next: NonNullable<ModalState>) {
    setModal(next);
    setModalReason('');
    setModalExpiry(next.mode === 'extend' ? dateInputValue(next.currentExpiry) : '');
  }

  async function submitAction() {
    if (!modal || !modalReason.trim()) {
      showToast('Le motif administratif est obligatoire.');
      return;
    }
    if (modal.mode === 'extend' && !modalExpiry) {
      showToast('La nouvelle expiration est obligatoire.');
      return;
    }

    const actionMap: Record<ActionSource, { revoke?: string; extend?: string; idKey?: string }> = {
      demo: { revoke: 'revoke_demo' },
      invitation: { revoke: 'revoke_invitation', extend: 'extend_invitation', idKey: 'invitation_id' },
      delegation: { revoke: 'revoke_delegation', extend: 'extend_delegation', idKey: 'delegation_id' },
      jury: { revoke: 'revoke_jury_access', extend: 'extend_jury_access', idKey: 'member_id' },
    };
    const config = actionMap[modal.source];
    const action = modal.mode === 'revoke' ? config.revoke : config.extend;
    if (!action) return;

    setBusy(`action:${modal.source}:${modal.id}`);
    try {
      const payload: Record<string, unknown> = { action, reason: modalReason.trim() };
      if (config.idKey) payload[config.idKey] = modal.id;
      if (modal.mode === 'extend') payload.expires_at = new Date(modalExpiry).toISOString();
      await call(payload);
      setModal(null);
      showToast(modal.mode === 'extend' ? 'Expiration mise à jour et exception auditée.' : 'Accès révoqué et audit enregistré.');
      await load();
    } catch (caught) {
      showToast(errorLabel(caught instanceof Error ? caught.message : 'SERVER_ERROR'));
    } finally {
      setBusy('');
    }
  }

  const latestDemo = data?.configs?.[0] || null;
  const activeInvitations = useMemo(() => (data?.invitations || []).filter((row: any) => row.status === 'pending' && isFuture(row.expires_at)), [data]);
  const activeDelegations = useMemo(() => (data?.delegations || []).filter((row: any) => row.status === 'active' && isFuture(row.expires_at)), [data]);
  const activeJuries = useMemo(() => (data?.jury_accesses || []).filter((row: any) => ['invited', 'accepted'].includes(row.status) && isFuture(row.invite_expires_at)), [data]);

  return (
    <AdminLayout>
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        {toast && <div className="fixed right-4 top-4 z-[70] max-w-sm rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold shadow-xl" style={{ color: BLUE }}>{toast}</div>}

        <header className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl text-white" style={{ background: BLUE }}><ShieldCheck size={21} /></div>
            <div>
              <h1 className="text-2xl font-black" style={{ color: BLUE }}>Accès spéciaux</h1>
              <p className="text-sm text-gray-500">Accès temporaires, dérogations bornées et droits hérités, sans création de rôle global supplémentaire.</p>
            </div>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            Le Super-admin supervise et audite ces accès. Les droits Structure et B2B restent gouvernés par leur source métier ; cette page ne contourne jamais un contrat, une validation Structure ou une règle de jury.
          </div>
        </header>

        <nav className="flex flex-wrap gap-2 rounded-xl border border-gray-100 bg-white p-2 shadow-sm">
          {TABS.map((item) => (
            <button key={item.key} onClick={() => setTab(item.key)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${tab === item.key ? 'text-white' : 'text-gray-600 hover:bg-gray-50'}`} style={tab === item.key ? { background: BLUE } : undefined}>{item.label}</button>
          ))}
        </nav>

        {loading && !data ? <div className="rounded-2xl bg-white p-12 text-center text-sm text-gray-500">Chargement des accès spéciaux…</div> : null}

        {data && tab === 'overview' && (
          <div className="space-y-5">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              {[
                ['Total actifs', data.summary?.total_active || 0, ShieldCheck],
                ['Démo', data.summary?.demo || 0, Monitor],
                ['Invitations', data.summary?.invitations || 0, UserCheck],
                ['Délégations', data.summary?.delegations || 0, Users],
                ['Jurys externes', data.summary?.jury || 0, FileText],
                ['Structure / B2B', Number(data.summary?.structure || 0) + Number(data.summary?.b2b || 0), Building2],
              ].map(([label, value, Icon]: any) => <div key={label} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"><Icon size={18} color={GOLD} /><p className="mt-3 text-2xl font-black" style={{ color: BLUE }}>{value}</p><p className="text-xs text-gray-500">{label}</p></div>)}
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <InfoCard icon={<Monitor size={19} />} title="Démonstration" text={data.status?.is_configured ? `Actif jusqu’au ${fmt(latestDemo?.expires_at)}` : 'Aucun accès démo actif.'} />
              <InfoCard icon={<Clock size={19} />} title="Accès temporaires" text={`${activeInvitations.length} invitation(s), ${activeDelegations.length} délégation(s), ${activeJuries.length} accès jury actif(s).`} />
              <InfoCard icon={<Building2 size={19} />} title="Accès hérités" text={`${data.summary?.structure || 0} délégation(s) Structure et ${data.summary?.b2b || 0} droit(s) B2B actifs. Leur source métier reste prioritaire.`} />
            </section>

            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="font-black" style={{ color: BLUE }}>Règles de gouvernance</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {[
                  'Aucun accès spécial ne crée le rôle Super-admin ni un nouveau rôle public.',
                  'Toute prolongation exceptionnelle exige une nouvelle date d’expiration et un motif.',
                  'La révocation coupe l’accès au niveau du moteur métier concerné.',
                  'Les droits Structure/B2B ne peuvent pas être prolongés ici au-delà de leur validation ou contrat.',
                ].map((text) => <div key={text} className="flex gap-2 rounded-xl bg-gray-50 p-3 text-sm text-gray-600"><CheckCircle className="mt-0.5 shrink-0 text-emerald-600" size={16} />{text}</div>)}
              </div>
            </section>
          </div>
        )}

        {data && tab === 'demo' && (
          <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div><h2 className="font-black" style={{ color: BLUE }}>Compte de démonstration</h2><p className="mt-1 text-sm text-gray-500">test@omniaglobalacademy.com</p></div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${data.status?.is_configured ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{data.status?.is_configured ? 'Configuré' : 'Inactif'}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <Metric label="Expiration" value={fmt(latestDemo?.expires_at)} />
                <Metric label="Dernière activité" value={fmt(data.status?.last_activity)} />
              </div>
              {data.status?.is_configured && <button onClick={() => openAction({ mode: 'revoke', source: 'demo', id: String(latestDemo?.id || 'demo'), title: 'Révoquer immédiatement l’accès démo' })} className="mt-4 w-full rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50">Révoquer l’accès démo</button>}
            </section>

            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="font-black" style={{ color: BLUE }}>Nouvelle configuration</h2>
              <p className="mt-1 text-xs text-gray-500">Une nouvelle configuration invalide immédiatement toutes les sessions démo précédentes.</p>
              <div className="mt-5 space-y-4">
                <label className="block text-xs font-semibold text-gray-600">Mot de passe
                  <div className="mt-1 flex gap-2"><input type="text" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono" /><button type="button" onClick={() => setForm((current) => ({ ...current, password: generatePassword() }))} className="rounded-lg border border-gray-200 px-3 text-gray-600"><RefreshCw size={15} /></button><button type="button" onClick={() => void copyPassword()} className="rounded-lg border border-gray-200 px-3 text-gray-600"><Copy size={15} /></button></div>
                </label>
                <label className="block text-xs font-semibold text-gray-600">Expiration obligatoire<input type="datetime-local" value={form.expires_at} onChange={(event) => setForm((current) => ({ ...current, expires_at: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></label>
                <div><p className="text-xs font-semibold text-gray-600">Rôles visibles en démonstration</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{ROLE_OPTIONS.map((role) => <label key={role.key} className="flex items-center gap-2 rounded-lg border border-gray-200 p-3 text-sm"><input type="checkbox" checked={form.demo_roles.includes(role.key)} onChange={() => toggleRole(role.key)} style={{ accentColor: GOLD }} />{role.label}</label>)}</div></div>
                <div><p className="text-xs font-semibold text-gray-600">Formations accessibles</p><div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2">{(data.published_courses || []).length ? (data.published_courses || []).map((course: any) => <label key={course.id} className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-50"><input type="checkbox" checked={form.demo_course_ids.includes(course.id)} onChange={() => toggleCourse(course.id)} style={{ accentColor: GOLD }} /><BookOpen size={15} className="mt-0.5 shrink-0 text-gray-400" /><span>{course.title}</span></label>) : <p className="p-2 text-xs text-gray-400">Aucune formation publiée.</p>}</div></div>
                <button disabled={busy === 'demo'} onClick={() => void configureDemo()} className="w-full rounded-lg px-4 py-2.5 text-sm font-black text-white disabled:opacity-50" style={{ background: BLUE }}>{busy === 'demo' ? 'Application…' : 'Appliquer la configuration'}</button>
              </div>
            </section>
          </div>
        )}

        {data && tab === 'temporary' && (
          <div className="space-y-5">
            <AccessSection title="Invitations professionnelles" subtitle="Liens personnels d’onboarding : modération, équipe Structure et recrutement Structure." count={data.invitations?.length || 0}>
              {(data.invitations || []).slice(0, 100).map((row: any) => <AccessRow key={row.id} title={row.full_name || row.email} subtitle={`${row.invitation_type} · ${row.organization_name || 'Omnia'} · ${row.email}`} status={row.status} expiry={row.expires_at} actions={['pending', 'expired'].includes(row.status) ? <><SmallButton onClick={() => openAction({ mode: 'extend', source: 'invitation', id: row.id, title: `Prolonger l’invitation de ${row.email}`, currentExpiry: row.expires_at })}>Prolonger</SmallButton><SmallButton danger onClick={() => openAction({ mode: 'revoke', source: 'invitation', id: row.id, title: `Révoquer l’invitation de ${row.email}` })}>Révoquer</SmallButton></> : null} />)}
            </AccessSection>

            <AccessSection title="Délégations temporaires des modérateurs" subtitle="Permissions additionnelles bornées dans le temps ; le rôle permanent n’est jamais transféré." count={data.delegations?.length || 0}>
              {(data.delegations || []).slice(0, 100).map((row: any) => <AccessRow key={row.id} title={row.moderator?.full_name || row.moderator?.email || 'Modérateur'} subtitle={`${Object.values(row.permissions || {}).filter(Boolean).length} permission(s) · ${row.reason || 'Sans motif'}`} status={row.status === 'active' && !isFuture(row.expires_at) ? 'expired' : row.status} expiry={row.expires_at} actions={row.status === 'active' ? <><SmallButton onClick={() => openAction({ mode: 'extend', source: 'delegation', id: row.id, title: 'Prolonger cette délégation', currentExpiry: row.expires_at })}>Prolonger</SmallButton><SmallButton danger onClick={() => openAction({ mode: 'revoke', source: 'delegation', id: row.id, title: 'Révoquer cette délégation' })}>Révoquer</SmallButton></> : null} />)}
            </AccessSection>

            <AccessSection title="Jurys externes" subtitle="Accès limité au jury et aux dossiers attribués. Aucun rôle Jury global n’existe." count={data.jury_accesses?.length || 0}>
              {(data.jury_accesses || []).slice(0, 100).map((row: any) => <AccessRow key={row.id} title={row.external_name || row.external_email || 'Membre externe'} subtitle={`${row.panel?.name || 'Jury'} · ${row.member_role} · ${row.external_email || ''}`} status={row.status} expiry={row.invite_expires_at} actions={['invited', 'accepted'].includes(row.status) ? <><SmallButton onClick={() => openAction({ mode: 'extend', source: 'jury', id: row.id, title: `Prolonger l’accès jury de ${row.external_name || row.external_email}`, currentExpiry: row.invite_expires_at })}>Prolonger</SmallButton><SmallButton danger onClick={() => openAction({ mode: 'revoke', source: 'jury', id: row.id, title: `Retirer ${row.external_name || row.external_email} du jury` })}>Révoquer</SmallButton></> : null} />)}
            </AccessSection>
          </div>
        )}

        {data && tab === 'inherited' && (
          <div className="space-y-5">
            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><Building2 color={GOLD} /><h2 className="mt-3 font-black" style={{ color: BLUE }}>Délégations Structure</h2><p className="mt-1 text-sm text-gray-500">{data.summary?.structure || 0} accès interne(s) actif(s). Leur validité dépend de la Structure et du rattachement interne.</p><Link to="/admin/structures" className="mt-4 inline-flex rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold" style={{ color: BLUE }}>Gérer les Structures</Link></div>
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><FileText color={GOLD} /><h2 className="mt-3 font-black" style={{ color: BLUE }}>Droits issus des contrats B2B</h2><p className="mt-1 text-sm text-gray-500">{data.summary?.b2b || 0} droit(s) actif(s). Ils expirent ou sont révoqués avec leur contrat et ne sont jamais prolongés depuis cette page.</p><Link to="/admin/structures/b2b" className="mt-4 inline-flex rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold" style={{ color: BLUE }}>Gérer B2B & contrats</Link></div>
            </section>

            <AccessSection title="Accès Structure récents" subtitle="Délégations techniques internes ; le responsable principal n’est pas compté ici." count={data.structure_accesses?.length || 0}>
              {(data.structure_accesses || []).slice(0, 80).map((row: any, index: number) => <AccessRow key={`${row.organization_id}:${row.user_id}:${index}`} title={row.user?.full_name || row.user?.email || 'Collaborateur'} subtitle={`${row.organization?.org_name || 'Structure'} · ${row.role_in_org || 'collaborateur'}`} status={row.status} />)}
            </AccessSection>

            <AccessSection title="Droits B2B récents" subtitle="Avantages collectifs matérialisés par Commerce central et synchronisés depuis le contrat actif." count={data.b2b_accesses?.length || 0}>
              {(data.b2b_accesses || []).slice(0, 80).map((row: any) => <AccessRow key={row.id} title={row.user?.full_name || row.user?.email || 'Membre'} subtitle={`${row.organization?.org_name || 'Structure'} · ${row.contract?.contract_number || 'Contrat'} · ${row.contract?.title || ''}`} status={row.status} expiry={row.contract?.ends_on ? `${row.contract.ends_on}T23:59:59Z` : null} />)}
            </AccessSection>
          </div>
        )}

        {data && tab === 'audit' && (
          <div className="space-y-5">
            <AccessSection title="Exceptions administratives bornées" subtitle="Uniquement des prolongations/réactivations documentées d’un accès déjà existant." count={data.exceptions?.length || 0}>
              {(data.exceptions || []).map((row: any) => <AccessRow key={row.id} title={`${row.source_type} · ${row.action}`} subtitle={`${row.reason} · par ${row.created_by_name || '—'}`} status={isFuture(row.new_expires_at) ? 'active' : 'expired'} expiry={row.new_expires_at} />)}
            </AccessSection>
            <AccessSection title="Journal transversal" subtitle="Historique append-only des créations, prolongations et révocations d’accès spéciaux." count={data.audit?.length || 0}>
              {(data.audit || []).map((row: any) => <AccessRow key={row.id} title={`${row.access_type} · ${row.action}`} subtitle={`${row.actor_name || '—'}${row.target_user?.full_name ? ` → ${row.target_user.full_name}` : ''}${row.organization_name ? ` · ${row.organization_name}` : ''}${row.reason ? ` · ${row.reason}` : ''}`} status="audit" expiry={row.created_at} />)}
            </AccessSection>
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><h2 className="font-black" style={{ color: BLUE }}>{modal.title}</h2><p className="mt-1 text-xs text-gray-500">Cette action sera inscrite dans le journal des accès spéciaux.</p></div><button onClick={() => setModal(null)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={18} /></button></div>
            <div className="mt-5 space-y-4">
              {modal.mode === 'extend' && <label className="block text-xs font-semibold text-gray-600">Nouvelle expiration<input type="datetime-local" value={modalExpiry} onChange={(event) => setModalExpiry(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></label>}
              <label className="block text-xs font-semibold text-gray-600">Motif administratif obligatoire<textarea rows={3} value={modalReason} onChange={(event) => setModalReason(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="Expliquez pourquoi cet accès doit être modifié." /></label>
              <div className="flex justify-end gap-2"><button onClick={() => setModal(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600">Annuler</button><button disabled={busy.startsWith('action:')} onClick={() => void submitAction()} className={`rounded-lg px-4 py-2 text-sm font-black text-white disabled:opacity-50 ${modal.mode === 'revoke' ? 'bg-red-600' : ''}`} style={modal.mode === 'extend' ? { background: BLUE } : undefined}>{modal.mode === 'extend' ? 'Confirmer la prolongation' : 'Confirmer la révocation'}</button></div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function InfoCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50" style={{ color: GOLD }}>{icon}</div><h3 className="mt-3 font-black" style={{ color: BLUE }}>{title}</h3><p className="mt-1 text-sm text-gray-500">{text}</p></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-sm font-bold text-gray-700">{value}</p></div>;
}

function AccessSection({ title, subtitle, count, children }: { title: string; subtitle: string; count: number; children: ReactNode }) {
  return <section className="rounded-2xl border border-gray-100 bg-white shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 p-5"><div><h2 className="font-black" style={{ color: BLUE }}>{title}</h2><p className="mt-1 text-xs text-gray-500">{subtitle}</p></div><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600">{count}</span></div><div className="divide-y divide-gray-100">{count ? children : <p className="p-5 text-sm text-gray-400">Aucun élément.</p>}</div></section>;
}

function AccessRow({ title, subtitle, status, expiry, actions }: { title: string; subtitle: string; status?: string | null; expiry?: string | null; actions?: ReactNode }) {
  return <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-bold text-gray-800">{title}</p>{status && <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${status === 'audit' ? 'bg-blue-50 text-blue-700' : badge(status)}`}>{status}</span>}</div><p className="mt-1 break-words text-xs text-gray-500">{subtitle}</p>{expiry && <p className="mt-1 flex items-center gap-1 text-xs text-gray-400"><Clock size={12} />{status === 'audit' ? 'Le ' : 'Expiration : '}{fmt(expiry)}</p>}</div>{actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}</div>;
}

function SmallButton({ children, onClick, danger = false }: { children: ReactNode; onClick: () => void; danger?: boolean }) {
  return <button onClick={onClick} className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${danger ? 'border-red-200 text-red-700 hover:bg-red-50' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>{children}</button>;
}
