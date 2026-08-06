import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ChevronLeft, ChevronRight, Filter, RefreshCw, Search, ShieldCheck, UserRound, Users } from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import { AdminUserDirectoryRow, AdminUsersListResponse, DELEGATION_LABELS, PRIMARY_ROLE_LABELS, adminUsersGet, userStatusLabel } from '../../lib/adminUsers';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

export default function AdminUsers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<AdminUsersListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const role = searchParams.get('role') || '';
  const status = searchParams.get('status') || '';
  const delegation = searchParams.get('delegation') || '';
  const includeTest = searchParams.get('include_test') === 'true';

  async function load() {
    setLoading(true); setError('');
    try {
      const result = await adminUsersGet<AdminUsersListResponse>({ action: 'users_list', q: searchParams.get('q') || '', page, page_size: 40, role, status, delegation, include_test: includeTest });
      setData(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chargement impossible.');
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [searchParams.toString()]);

  function update(values: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(values)) value ? next.set(key, value) : next.delete(key);
    if (!('page' in values)) next.delete('page');
    setSearchParams(next);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    update({ q: query.trim() || null });
  }

  const totalPages = useMemo(() => Math.max(1, Math.ceil((data?.total || 0) / (data?.page_size || 40))), [data]);

  return <AdminLayout><main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
    <header className="border-b pb-5" style={{ borderColor: BORDER }}>
      <p className="text-xs font-bold uppercase tracking-[.16em]" style={{ color: GOLD }}>Utilisateurs, équipe & Structures</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-2xl font-bold" style={{ color: BLUE }}>Utilisateurs</h1><p className="mt-1 max-w-3xl text-sm text-slate-600">Comptes individuels, rôles principaux, délégations, statuts et dernière activité. Le compte système d’administration n’est jamais exposé.</p></div>
        <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold" style={{ borderColor: BORDER, color: BLUE }}><RefreshCw size={16}/>Actualiser</button>
      </div>
    </header>

    {error && <div className="mt-5 flex items-start gap-3 border-l-4 border-red-500 bg-red-50 p-4 text-sm text-red-800"><AlertTriangle size={18}/><span>{error}</span></div>}

    <section className="mt-6 grid gap-px overflow-hidden rounded-xl border bg-slate-200 sm:grid-cols-2 xl:grid-cols-4" style={{ borderColor: BORDER }}>
      <Kpi label="Comptes actifs" value={data?.overview.active} />
      <Kpi label="En attente de validation" value={data?.overview.pending} />
      <Kpi label="Comptes suspendus" value={data?.overview.suspended} />
      <Kpi label="Nouveaux comptes sur 30 jours" value={data?.overview.new_30d} />
    </section>

    <section className="mt-6 border-y bg-white py-4" style={{ borderColor: BORDER }}>
      <form onSubmit={submit} className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 text-slate-400" size={17}/><input value={query} onChange={event => setQuery(event.target.value)} className="h-11 w-full rounded-lg border pl-10 pr-3 text-sm outline-none focus:ring-2" style={{ borderColor: BORDER }} placeholder="Rechercher par nom, e-mail ou identifiant"/></label>
        <select value={role} onChange={event => update({ role: event.target.value || null })} className="h-11 rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }}><option value="">Tous les rôles principaux</option>{data?.available_roles.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select>
        <select value={delegation} onChange={event => update({ delegation: event.target.value || null })} className="h-11 rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }}><option value="">Toutes les délégations</option>{data?.available_delegations.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select>
        <select value={status} onChange={event => update({ status: event.target.value || null })} className="h-11 rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }}><option value="">Tous les statuts</option><option value="active">Actifs</option><option value="pending">En attente</option><option value="suspended">Suspendus</option><option value="deleted">Supprimés</option><option value="other">Autres</option></select>
        <label className="inline-flex h-11 items-center gap-2 rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }}><input type="checkbox" checked={includeTest} onChange={event => update({ include_test: event.target.checked ? 'true' : null })}/>Inclure les comptes de test</label>
        <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white" style={{ background: BLUE }}><Filter size={16}/>Appliquer</button>
      </form>
    </section>

    <section className="mt-5">
      {loading ? <div className="py-20 text-center text-sm text-slate-500">Chargement des comptes…</div> : !data?.users.length ? <div className="border-y py-16 text-center" style={{ borderColor: BORDER }}><Users className="mx-auto text-slate-300"/><p className="mt-3 text-sm text-slate-600">Aucun compte ne correspond aux filtres.</p></div> : <>
        <div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[1120px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-slate-500" style={{ borderColor: BORDER }}><tr><th className="py-3 pr-4">Utilisateur</th><th className="px-3">Rôles principaux</th><th className="px-3">Accès délégués</th><th className="px-3">Statut</th><th className="px-3">Structure ou contexte</th><th className="px-3">Dernière connexion</th><th className="px-3">Inscription</th><th className="pl-3 text-right">Action</th></tr></thead><tbody>{data.users.map(user => <DesktopRow key={user.id} user={user}/>)}</tbody></table></div>
        <div className="divide-y lg:hidden" style={{ borderColor: BORDER }}>{data.users.map(user => <MobileRow key={user.id} user={user}/>)}</div>
      </>}
    </section>

    <footer className="mt-6 flex items-center justify-between border-t pt-4 text-sm" style={{ borderColor: BORDER }}><span className="text-slate-500">{data?.total || 0} compte(s)</span><div className="flex items-center gap-2"><button disabled={page <= 1} onClick={() => update({ page: String(page - 1) })} className="rounded-lg border p-2 disabled:opacity-30" style={{ borderColor: BORDER }}><ChevronLeft size={17}/></button><span>Page {page} sur {totalPages}</span><button disabled={page >= totalPages} onClick={() => update({ page: String(page + 1) })} className="rounded-lg border p-2 disabled:opacity-30" style={{ borderColor: BORDER }}><ChevronRight size={17}/></button></div></footer>
  </main></AdminLayout>;
}

function Kpi({ label, value }: { label: string; value: number | undefined }) { return <div className="bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold" style={{ color: BLUE }}>{value ?? '—'}</p></div>; }
function date(value: string | null) { return value ? new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : 'Jamais'; }
function RoleChips({ user }: { user: AdminUserDirectoryRow }) { return <div className="flex flex-wrap gap-1.5">{user.primary_roles.length ? user.primary_roles.map(role => <span key={role} className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold" style={{ color: BLUE }}>{PRIMARY_ROLE_LABELS[role] || role}</span>) : <span className="text-xs text-slate-400">Aucun rôle principal</span>}</div>; }
function DelegationChips({ user }: { user: AdminUserDirectoryRow }) { return <div className="flex flex-wrap gap-1.5">{user.delegated_access.length ? user.delegated_access.map(role => <span key={role} className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">{DELEGATION_LABELS[role] || role}</span>) : <span className="text-xs text-slate-400">Aucune</span>}</div>; }
function Status({ user }: { user: AdminUserDirectoryRow }) { const styles = user.status_group === 'active' ? 'bg-emerald-50 text-emerald-700' : user.status_group === 'pending' ? 'bg-amber-50 text-amber-800' : user.status_group === 'suspended' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-700'; return <div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles}`}>{userStatusLabel(user.status_group)}</span>{user.force_password_change && <p className="mt-2 text-xs text-amber-700">Mot de passe à renouveler</p>}{user.signal && <p className="mt-2 text-xs text-red-700">{user.signal}</p>}</div>; }
function DesktopRow({ user }: { user: AdminUserDirectoryRow }) { return <tr className="border-b align-top" style={{ borderColor: BORDER }}><td className="py-4 pr-4"><div className="flex gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100"><UserRound size={17} style={{ color: BLUE }}/></div><div><p className="font-semibold" style={{ color: BLUE }}>{user.full_name || 'Nom non renseigné'}{user.is_test && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase text-slate-600">Test</span>}</p><p className="mt-0.5 text-xs text-slate-500">{user.email}</p></div></div></td><td className="px-3 py-4"><RoleChips user={user}/></td><td className="px-3 py-4"><DelegationChips user={user}/></td><td className="px-3 py-4"><Status user={user}/></td><td className="px-3 py-4 text-xs text-slate-600">{user.organizations.length ? user.organizations.map(item => <p key={`${item.id}-${item.access}`}>{item.name}<br/><span className="text-slate-400">{item.access}</span></p>) : '—'}</td><td className="px-3 py-4 text-xs text-slate-600">{date(user.last_login_at)}</td><td className="px-3 py-4 text-xs text-slate-600">{date(user.created_at)}</td><td className="py-4 pl-3 text-right"><Link to={`/admin/utilisateurs/${user.id}`} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: GOLD, color: BLUE }}><ShieldCheck size={14}/>Ouvrir</Link></td></tr>; }
function MobileRow({ user }: { user: AdminUserDirectoryRow }) { return <article className="py-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold" style={{ color: BLUE }}>{user.full_name || 'Nom non renseigné'}</h2><p className="text-xs text-slate-500">{user.email}</p></div><Status user={user}/></div><div className="mt-3"><RoleChips user={user}/></div><div className="mt-2"><DelegationChips user={user}/></div><p className="mt-3 text-xs text-slate-500">Dernière connexion : {date(user.last_login_at)}</p><Link to={`/admin/utilisateurs/${user.id}`} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold" style={{ color: BLUE }}><ShieldCheck size={15}/>Ouvrir la fiche administrative</Link></article>; }
