import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '../../components/AdminLayout';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { Archive, ArrowRight, BookOpen, ExternalLink, Pencil, Plus, RefreshCw, Save, Search, X } from 'lucide-react';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/studio-unified`;
const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

type Tab = 'ready' | 'published' | 'all' | 'assisted' | 'external';
type Course = {
  id: string;
  title: string;
  category?: string;
  level?: string;
  studio_status?: string;
  is_published?: boolean;
  creator_context?: string;
  updated_at?: string;
  submitted_at?: string;
  assisted_status?: string;
  certification_requested?: boolean;
  current_version?: string;
};
type DeliveryMethod = 'private_link' | 'access_code' | 'manual_registration';
type ExternalTextKey = 'title' | 'provider_name' | 'external_url' | 'cover_image_url' | 'category' | 'level' | 'language' | 'duration_label';
type ExternalBooleanKey = 'certificate_available' | 'is_featured' | 'content_usage_confirmed';
type ExternalCourse = {
  id?: string;
  title: string;
  short_description: string;
  provider_name: string;
  external_url: string;
  cover_image_url: string;
  category: string;
  level: string;
  language: string;
  duration_label: string;
  total_duration_seconds: number;
  certificate_available: boolean;
  is_free: boolean;
  access_mode: 'public' | 'registered' | 'premium' | 'paid';
  status: 'draft' | 'published' | 'archived';
  is_featured: boolean;
  display_order: number;
  admin_notes: string;
  content_usage_confirmed: boolean;
  last_verified_at?: string | null;
  registration_deadline: string;
  registration_url: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  contact_address: string;
  price_xof: number;
  delivery_methods: DeliveryMethod[];
  private_access_url: string;
  access_code_mode: 'none' | 'provider' | 'personal';
  provider_access_code: string;
};
type ExternalGrant = {
  id: string;
  user_id: string;
  external_course_id: string;
  status: 'registration_in_progress' | 'access_ready' | 'revoked';
  private_access_url?: string | null;
  access_code?: string | null;
  admin_note?: string | null;
  created_at?: string;
  updated_at?: string;
  user?: { id: string; full_name?: string | null; email?: string | null } | null;
  course?: { id: string; title?: string; provider_name?: string; delivery_methods?: DeliveryMethod[]; access_code_mode?: string } | null;
};

const EMPTY_EXTERNAL: ExternalCourse = {
  title: '', short_description: '', provider_name: '', external_url: '', cover_image_url: '', category: '', level: 'Débutant', language: 'fr', duration_label: '', total_duration_seconds: 0,
  certificate_available: false, is_free: true, access_mode: 'public', status: 'draft', is_featured: false, display_order: 0, admin_notes: '', content_usage_confirmed: false,
  registration_deadline: '', registration_url: '', contact_name: '', contact_email: '', contact_phone: '', contact_address: '', price_xof: 0, delivery_methods: [], private_access_url: '', access_code_mode: 'none', provider_access_code: '',
};
const STATUS: Record<string, string> = { draft: 'Brouillon', pending_validation: 'En validation', changes_requested: 'Modifications demandées', rejected: 'Refusée', validated: 'Validée', published: 'Publiée', archived: 'Archivée' };

async function call(action: string, payload: Record<string, unknown> = {}) {
  const response = await fetch(API, { method: 'POST', headers: edgeAuthHeaders(), body: JSON.stringify({ action, ...payload }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) throw new Error(data.message || data.error || 'Action impossible');
  return data;
}

function normalizedExternal(course?: Partial<ExternalCourse>): ExternalCourse {
  return {
    ...EMPTY_EXTERNAL,
    ...(course || {}),
    delivery_methods: Array.isArray(course?.delivery_methods) ? course!.delivery_methods.filter((value): value is DeliveryMethod => ['private_link', 'access_code', 'manual_registration'].includes(String(value))) : [],
    registration_deadline: String(course?.registration_deadline || '').slice(0, 10),
    registration_url: String(course?.registration_url || ''),
    contact_name: String(course?.contact_name || ''),
    contact_email: String(course?.contact_email || ''),
    contact_phone: String(course?.contact_phone || ''),
    contact_address: String(course?.contact_address || ''),
    price_xof: Number(course?.price_xof || 0),
    private_access_url: String(course?.private_access_url || ''),
    provider_access_code: String(course?.provider_access_code || ''),
  };
}

function accessLabel(course: ExternalCourse) {
  if (course.access_mode === 'paid') return `Payante · ${Number(course.price_xof || 0).toLocaleString('fr-FR')} XOF`;
  if (course.access_mode === 'registered') return 'Après inscription';
  if (course.access_mode === 'premium') return 'Accès Premium';
  return 'Accès public';
}

export default function AdminCatalogue() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('ready');
  const [rows, setRows] = useState<Course[]>([]);
  const [externalRows, setExternalRows] = useState<ExternalCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<ExternalCourse | null>(null);
  const [saving, setSaving] = useState(false);
  const [managingCourse, setManagingCourse] = useState<ExternalCourse | null>(null);
  const [grants, setGrants] = useState<ExternalGrant[]>([]);
  const [loadingGrants, setLoadingGrants] = useState(false);
  const [savingGrant, setSavingGrant] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError('');
    try {
      const [internal, external] = await Promise.all([call('admin_catalogue'), call('admin_list_external_courses')]);
      setRows(internal.courses || []);
      setExternalRows((external.courses || []).map((row: ExternalCourse) => normalizedExternal(row)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  async function saveExternal() {
    if (!editing) return;
    if (!editing.title.trim() || !editing.provider_name.trim() || !editing.external_url.trim()) {
      setError('Titre, fournisseur et URL HTTPS sont obligatoires.'); return;
    }
    if (editing.status === 'published' && !editing.registration_deadline) {
      setError("La date limite d'inscription est obligatoire avant publication."); return;
    }
    if (editing.status === 'published' && !editing.registration_url.trim() && !editing.contact_email.trim() && !editing.contact_phone.trim()) {
      setError("Ajoutez un lien d'inscription ou au moins un contact avant publication."); return;
    }
    if (editing.access_mode === 'paid') {
      if (Number(editing.price_xof || 0) <= 0) { setError('Le prix Omnia doit être supérieur à 0 XOF.'); return; }
      if (editing.delivery_methods.length === 0) { setError("Choisissez au moins un mode de délivrance de l'accès."); return; }
      if (editing.delivery_methods.includes('private_link') && !editing.private_access_url.trim()) { setError("Le lien privé d'accès est obligatoire pour ce mode."); return; }
      if (editing.delivery_methods.includes('access_code') && editing.access_code_mode === 'none') { setError('Choisissez si le code est fournisseur ou personnel.'); return; }
      if (editing.delivery_methods.includes('access_code') && editing.access_code_mode === 'provider' && !editing.provider_access_code.trim()) { setError('Le code fournisseur est obligatoire.'); return; }
    }
    setSaving(true); setError(''); setSuccess('');
    try {
      await call('admin_save_external_course', { course: editing });
      setSuccess('La formation externe a été enregistrée.'); setEditing(null); await load(); setTab('external');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  }

  async function archiveExternal(id?: string) {
    if (!id || !confirm('Archiver cette formation externe ?')) return;
    try { await call('admin_archive_external_course', { external_course_id: id }); setSuccess('Formation externe archivée.'); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Archivage impossible'); }
  }

  async function openAccessManagement(course: ExternalCourse) {
    if (!course.id) return;
    setManagingCourse(course); setLoadingGrants(true); setError('');
    try {
      const data = await call('admin_list_external_access_grants', { external_course_id: course.id });
      setGrants(data.grants || []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Chargement des accès impossible'); setManagingCourse(null);
    } finally { setLoadingGrants(false); }
  }

  function patchGrant(id: string, patch: Partial<ExternalGrant>) {
    setGrants(current => current.map(grant => grant.id === id ? { ...grant, ...patch } : grant));
  }

  async function updateGrant(grant: ExternalGrant, status: ExternalGrant['status']) {
    setSavingGrant(grant.id); setError(''); setSuccess('');
    try {
      await call('admin_update_external_access_grant', {
        grant_id: grant.id,
        status,
        private_access_url: grant.private_access_url || '',
        access_code: grant.access_code || '',
        admin_note: grant.admin_note || '',
      });
      setSuccess(status === 'access_ready' ? 'Accès externe marqué comme prêt.' : status === 'registration_in_progress' ? 'Inscription maintenue en cours.' : 'Accès révoqué.');
      if (managingCourse?.id) {
        const data = await call('admin_list_external_access_grants', { external_course_id: managingCourse.id });
        setGrants(data.grants || []);
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Mise à jour de l'accès impossible"); }
    finally { setSavingGrant(null); }
  }

  function toggleDelivery(method: DeliveryMethod) {
    if (!editing) return;
    const current = editing.delivery_methods;
    const next = current.includes(method) ? current.filter(item => item !== method) : [...current, method];
    setEditing({ ...editing, delivery_methods: next });
  }

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (tab === 'external') return externalRows.filter(x => !query || `${x.title} ${x.provider_name} ${x.category}`.toLowerCase().includes(query));
    let list = rows;
    if (tab === 'ready') list = list.filter(x => x.studio_status === 'validated' && !x.is_published);
    else if (tab === 'published') list = list.filter(x => x.is_published || x.studio_status === 'published');
    else if (tab === 'assisted') list = list.filter(x => x.assisted_status || x.certification_requested);
    if (query) list = list.filter(x => `${x.title} ${x.category || ''} ${x.level || ''}`.toLowerCase().includes(query));
    return list;
  }, [rows, externalRows, tab, q]);

  const counts = {
    ready: rows.filter(x => x.studio_status === 'validated' && !x.is_published).length,
    published: rows.filter(x => x.is_published || x.studio_status === 'published').length,
    all: rows.length,
    assisted: rows.filter(x => x.assisted_status || x.certification_requested).length,
    external: externalRows.length,
  };

  return <AdminLayout><div className="mx-auto max-w-7xl space-y-6 px-6 py-6">
    <div className="flex flex-col gap-4 border-b border-gray-200 pb-5 md:flex-row md:items-end md:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-[.14em]" style={{ color: GOLD }}>Formations & reconnaissances</p><h1 className="mt-1 text-2xl font-black" style={{ color: BLUE }}>Catalogue & reconnaissances</h1><p className="mt-1 text-sm text-gray-500">Gérez les formations Omnia et les formations externes vérifiées proposées à votre communauté.</p></div>
      <div className="flex flex-wrap gap-2"><button onClick={() => setEditing(normalizedExternal())} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: GOLD }}><Plus size={15} />Formation externe</button><button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600"><RefreshCw size={15} />Actualiser</button></div>
    </div>
    <div className="flex flex-wrap gap-6 border-b border-gray-200">{([['ready', 'À publier'], ['published', 'Publiées'], ['all', 'Toutes'], ['assisted', 'Saisie assistée / certifications'], ['external', 'Formations externes']] as [Tab, string][]).map(([key, label]) => <button key={key} onClick={() => setTab(key)} className="border-b-2 pb-3 text-sm font-semibold" style={{ color: tab === key ? BLUE : '#667085', borderColor: tab === key ? GOLD : 'transparent' }}>{label} ({counts[key]})</button>)}</div>
    <div className="relative max-w-lg"><Search size={17} className="absolute left-3 top-2.5 text-gray-400" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher une formation…" className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-3 text-sm outline-none" /></div>
    {error && <div className="border-l-4 border-red-500 py-2 pl-4 text-sm text-red-700">{error}</div>}{success && <div className="border-l-4 border-green-600 py-2 pl-4 text-sm text-green-700">{success}</div>}
    {loading ? <div className="py-16 text-center text-sm text-gray-400">Chargement…</div> : filtered.length === 0 ? <div className="border-y border-gray-200 py-14 text-center"><BookOpen size={30} className="mx-auto mb-2 text-gray-300" /><p className="text-sm text-gray-500">Aucune formation dans cette vue.</p></div> : tab === 'external' ? <div className="grid gap-4 lg:grid-cols-2">{(filtered as ExternalCourse[]).map(c => <article key={c.id} className="rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}>
      <div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">{c.provider_name}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{accessLabel(c)}</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${c.status === 'published' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{STATUS[c.status] || c.status}</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${c.content_usage_confirmed ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{c.content_usage_confirmed ? 'Lien vérifié' : 'Vérification requise'}</span></div><h2 className="mt-3 font-bold" style={{ color: BLUE }}>{c.title}</h2><p className="mt-1 text-xs text-gray-500">{c.category || 'Sans catégorie'} · {c.level || 'Niveau non renseigné'} · {c.duration_label || 'Durée non renseignée'}</p>{c.registration_deadline && <p className="mt-1 text-xs text-gray-500">Inscriptions jusqu’au {new Date(`${c.registration_deadline}T12:00:00`).toLocaleDateString('fr-FR')}</p>}</div><ExternalLink size={18} color={GOLD} /></div>
      <p className="mt-3 line-clamp-2 text-sm text-gray-600">{c.short_description || 'Aucune description.'}</p><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => setEditing(normalizedExternal(c))} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold" style={{ borderColor: BORDER, color: BLUE }}><Pencil size={13} />Modifier</button>{c.access_mode === 'paid' && <button onClick={() => void openAccessManagement(c)} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold" style={{ borderColor: BORDER, color: BLUE }}>Gérer les accès <ArrowRight size={13} /></button>}<button onClick={() => void archiveExternal(c.id)} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold text-red-700" style={{ borderColor: '#FECACA' }}><Archive size={13} />Archiver</button><a href={c.external_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-white" style={{ background: BLUE }}>Tester<ExternalLink size={13} /></a></div>
    </article>)}</div> : <div className="border-t border-gray-200">{(filtered as Course[]).map(c => <div key={c.id} className="grid grid-cols-1 items-center gap-3 border-b border-gray-100 py-4 md:grid-cols-[1.4fr_.7fr_.7fr_auto]"><div className="min-w-0"><p className="truncate text-sm font-semibold" style={{ color: BLUE }}>{c.title}</p><p className="mt-1 text-xs text-gray-400">{c.category || 'Sans catégorie'} · {c.level || 'Niveau non renseigné'}</p></div><div><p className="text-xs text-gray-400">Statut</p><p className="text-sm text-gray-700">{c.is_published ? 'Publiée' : STATUS[c.studio_status || ''] || c.studio_status || '—'}</p></div><div><p className="text-xs text-gray-400">Version</p><p className="text-sm text-gray-700">{c.current_version || '1.0'}</p></div><button onClick={() => navigate(`/admin/courses/${c.id}/edit`)} className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: GOLD }}>Examiner <ArrowRight size={13} /></button></div>)}</div>}

    {editing && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"><div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
      <div className="flex items-center justify-between"><div><h2 className="text-xl font-black" style={{ color: BLUE }}>{editing.id ? 'Modifier' : 'Ajouter'} une formation externe</h2><p className="mt-1 text-xs text-gray-500">Renseignez les informations pratiques, les contacts et les conditions d’accès réelles de cette formation.</p></div><button onClick={() => setEditing(null)} className="rounded-lg p-2 hover:bg-gray-100"><X size={20} /></button></div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {([['title', 'Titre *', 'text'], ['provider_name', 'Fournisseur *', 'text'], ['external_url', 'URL HTTPS de la formation *', 'url'], ['cover_image_url', 'URL de couverture', 'url'], ['category', 'Catégorie', 'text'], ['level', 'Niveau', 'text'], ['language', 'Langue', 'text'], ['duration_label', 'Durée affichée', 'text']] as [ExternalTextKey, string, string][]).map(([key, label, type]) => <label key={key} className={key === 'title' || key === 'external_url' ? 'md:col-span-2' : ''}><span className="text-xs font-semibold text-gray-600">{label}</span><input type={type} value={String(editing[key] || '')} onChange={e => setEditing({ ...editing, [key]: e.target.value })} className="mt-1 h-11 w-full rounded-xl border px-3 text-sm" style={{ borderColor: BORDER }} /></label>)}
        <label className="md:col-span-2"><span className="text-xs font-semibold text-gray-600">Description courte</span><textarea rows={3} value={editing.short_description} onChange={e => setEditing({ ...editing, short_description: e.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" style={{ borderColor: BORDER }} /></label>

        <div className="md:col-span-2 border-t pt-4"><h3 className="text-sm font-black" style={{ color: BLUE }}>Inscription et contact</h3><p className="mt-1 text-xs text-gray-500">La date limite est obligatoire avant publication. Ajoutez un lien d’inscription ou un contact.</p></div>
        <label><span className="text-xs font-semibold text-gray-600">Date limite d’inscription *</span><input type="date" value={editing.registration_deadline} onChange={e => setEditing({ ...editing, registration_deadline: e.target.value })} className="mt-1 h-11 w-full rounded-xl border px-3 text-sm" style={{ borderColor: BORDER }} /></label>
        <label><span className="text-xs font-semibold text-gray-600">Lien d’inscription</span><input type="url" value={editing.registration_url} onChange={e => setEditing({ ...editing, registration_url: e.target.value })} className="mt-1 h-11 w-full rounded-xl border px-3 text-sm" style={{ borderColor: BORDER }} /></label>
        <label><span className="text-xs font-semibold text-gray-600">Nom du contact</span><input value={editing.contact_name} onChange={e => setEditing({ ...editing, contact_name: e.target.value })} className="mt-1 h-11 w-full rounded-xl border px-3 text-sm" style={{ borderColor: BORDER }} /></label>
        <label><span className="text-xs font-semibold text-gray-600">Email du contact</span><input type="email" value={editing.contact_email} onChange={e => setEditing({ ...editing, contact_email: e.target.value })} className="mt-1 h-11 w-full rounded-xl border px-3 text-sm" style={{ borderColor: BORDER }} /></label>
        <label><span className="text-xs font-semibold text-gray-600">Téléphone du contact</span><input type="tel" value={editing.contact_phone} onChange={e => setEditing({ ...editing, contact_phone: e.target.value })} className="mt-1 h-11 w-full rounded-xl border px-3 text-sm" style={{ borderColor: BORDER }} /></label>
        <label><span className="text-xs font-semibold text-gray-600">Adresse</span><input value={editing.contact_address} onChange={e => setEditing({ ...editing, contact_address: e.target.value })} className="mt-1 h-11 w-full rounded-xl border px-3 text-sm" style={{ borderColor: BORDER }} /></label>

        <label><span className="text-xs font-semibold text-gray-600">Mode d’accès</span><select value={editing.access_mode} onChange={e => setEditing({ ...editing, access_mode: e.target.value as ExternalCourse['access_mode'], is_free: e.target.value === 'paid' ? false : editing.is_free })} className="mt-1 h-11 w-full rounded-xl border px-3 text-sm" style={{ borderColor: BORDER }}><option value="public">Accès public</option><option value="registered">Après inscription</option><option value="premium">Accès Premium</option><option value="paid">Payante sur Omnia</option></select></label>
        <label><span className="text-xs font-semibold text-gray-600">Statut</span><select value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value as ExternalCourse['status'] })} className="mt-1 h-11 w-full rounded-xl border px-3 text-sm" style={{ borderColor: BORDER }}><option value="draft">Brouillon</option><option value="published">Publiée</option><option value="archived">Archivée</option></select></label>

        {editing.access_mode === 'paid' && <div className="md:col-span-2 rounded-2xl border p-4" style={{ borderColor: '#E7D3A3', background: '#FFFCF5' }}>
          <h3 className="text-sm font-black" style={{ color: BLUE }}>Paiement Omnia et délivrance de l’accès</h3><p className="mt-1 text-xs text-gray-600">Le paiement est encaissé sur Omnia. Choisissez un ou plusieurs modes réellement fournis pour cette formation.</p>
          <label className="mt-4 block max-w-xs"><span className="text-xs font-semibold text-gray-600">Prix sur Omnia (XOF) *</span><input type="number" min={1} value={editing.price_xof} onChange={e => setEditing({ ...editing, price_xof: Number(e.target.value || 0) })} className="mt-1 h-11 w-full rounded-xl border bg-white px-3 text-sm" style={{ borderColor: BORDER }} /></label>
          <div className="mt-4 flex flex-wrap gap-5">{([['private_link', 'Lien privé'], ['access_code', 'Code / coupon'], ['manual_registration', 'Inscription manuelle']] as [DeliveryMethod, string][]).map(([method, label]) => <label key={method} className="flex items-center gap-2 text-sm font-semibold text-gray-700"><input type="checkbox" checked={editing.delivery_methods.includes(method)} onChange={() => toggleDelivery(method)} />{label}</label>)}</div>
          {editing.delivery_methods.includes('private_link') && <label className="mt-4 block"><span className="text-xs font-semibold text-gray-600">Lien privé d’accès *</span><input type="url" value={editing.private_access_url} onChange={e => setEditing({ ...editing, private_access_url: e.target.value })} className="mt-1 h-11 w-full rounded-xl border bg-white px-3 text-sm" style={{ borderColor: BORDER }} /></label>}
          {editing.delivery_methods.includes('access_code') && <div className="mt-4 grid gap-4 md:grid-cols-2"><label><span className="text-xs font-semibold text-gray-600">Type de code *</span><select value={editing.access_code_mode} onChange={e => setEditing({ ...editing, access_code_mode: e.target.value as ExternalCourse['access_code_mode'], provider_access_code: e.target.value === 'provider' ? editing.provider_access_code : '' })} className="mt-1 h-11 w-full rounded-xl border bg-white px-3 text-sm" style={{ borderColor: BORDER }}><option value="none">Choisir</option><option value="provider">Code fournisseur commun</option><option value="personal">Code personnel par apprenant</option></select></label>{editing.access_code_mode === 'provider' && <label><span className="text-xs font-semibold text-gray-600">Code fournisseur *</span><input value={editing.provider_access_code} onChange={e => setEditing({ ...editing, provider_access_code: e.target.value })} className="mt-1 h-11 w-full rounded-xl border bg-white px-3 text-sm" style={{ borderColor: BORDER }} /></label>}</div>}
          {editing.delivery_methods.includes('manual_registration') && <p className="mt-4 text-xs font-semibold text-gray-700">Après paiement, l’apprenant verra « Inscription en cours ». Le Super-admin pourra ensuite passer son accès à « Accès prêt ».</p>}
        </div>}

        <label><span className="text-xs font-semibold text-gray-600">Durée en secondes</span><input type="number" min={0} value={editing.total_duration_seconds} onChange={e => setEditing({ ...editing, total_duration_seconds: Number(e.target.value || 0) })} className="mt-1 h-11 w-full rounded-xl border px-3 text-sm" style={{ borderColor: BORDER }} /></label>
        <label><span className="text-xs font-semibold text-gray-600">Ordre d’affichage</span><input type="number" value={editing.display_order} onChange={e => setEditing({ ...editing, display_order: Number(e.target.value || 0) })} className="mt-1 h-11 w-full rounded-xl border px-3 text-sm" style={{ borderColor: BORDER }} /></label>
        <div className="md:col-span-2 flex flex-wrap gap-5">{([['certificate_available', 'Certificat disponible'], ['is_featured', 'Mise en avant'], ['content_usage_confirmed', 'Lien, accès et droits vérifiés']] as [ExternalBooleanKey, string][]).map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm font-semibold text-gray-700"><input type="checkbox" checked={Boolean(editing[key])} onChange={e => setEditing({ ...editing, [key]: e.target.checked })} />{label}</label>)}{editing.access_mode !== 'paid' && <label className="flex items-center gap-2 text-sm font-semibold text-gray-700"><input type="checkbox" checked={editing.is_free} onChange={e => setEditing({ ...editing, is_free: e.target.checked })} />Formation gratuite</label>}</div>
        <label className="md:col-span-2"><span className="text-xs font-semibold text-gray-600">Notes internes</span><textarea rows={2} value={editing.admin_notes} onChange={e => setEditing({ ...editing, admin_notes: e.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" style={{ borderColor: BORDER }} /></label>
      </div>
      <div className="mt-6 flex justify-end gap-2"><button onClick={() => setEditing(null)} className="rounded-xl border px-4 py-2.5 text-sm font-semibold" style={{ borderColor: BORDER, color: BLUE }}>Annuler</button><button disabled={saving} onClick={() => void saveExternal()} className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50" style={{ background: BLUE }}><Save size={15} />{saving ? 'Enregistrement…' : 'Enregistrer'}</button></div>
    </div></div>}

    {managingCourse && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4"><div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.14em]" style={{ color: GOLD }}>Accès externes payants</p><h2 className="mt-1 text-xl font-black" style={{ color: BLUE }}>{managingCourse.title}</h2><p className="mt-1 text-sm text-gray-500">Finalisez individuellement le lien ou le code lorsque la formation nécessite une inscription manuelle ou un code personnel.</p></div><button onClick={() => { setManagingCourse(null); setGrants([]); }} className="rounded-lg p-2 hover:bg-gray-100"><X size={20} /></button></div>
      {loadingGrants ? <div className="py-12 text-center text-sm text-gray-400">Chargement des accès…</div> : grants.length === 0 ? <div className="mt-6 border-y border-gray-200 py-10 text-center text-sm text-gray-500">Aucun paiement donnant accès à cette formation pour le moment.</div> : <div className="mt-6 space-y-4">{grants.map(grant => <div key={grant.id} className="rounded-2xl border p-4" style={{ borderColor: BORDER }}>
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between"><div><p className="font-bold" style={{ color: BLUE }}>{grant.user?.full_name || 'Apprenant'}</p><p className="text-xs text-gray-500">{grant.user?.email || grant.user_id}</p></div><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${grant.status === 'access_ready' ? 'bg-green-50 text-green-700' : grant.status === 'revoked' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>{grant.status === 'access_ready' ? 'Accès prêt' : grant.status === 'revoked' ? 'Accès révoqué' : 'Inscription en cours'}</span></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2"><label><span className="text-xs font-semibold text-gray-600">Lien privé individuel</span><input type="url" value={grant.private_access_url || ''} onChange={e => patchGrant(grant.id, { private_access_url: e.target.value })} className="mt-1 h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} /></label><label><span className="text-xs font-semibold text-gray-600">Code / coupon individuel</span><input value={grant.access_code || ''} onChange={e => patchGrant(grant.id, { access_code: e.target.value })} className="mt-1 h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} /></label><label className="md:col-span-2"><span className="text-xs font-semibold text-gray-600">Note interne</span><textarea rows={2} value={grant.admin_note || ''} onChange={e => patchGrant(grant.id, { admin_note: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: BORDER }} /></label></div>
        <div className="mt-4 flex flex-wrap gap-2"><button disabled={savingGrant === grant.id} onClick={() => void updateGrant(grant, 'registration_in_progress')} className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50" style={{ borderColor: BORDER, color: BLUE }}>Inscription en cours</button><button disabled={savingGrant === grant.id} onClick={() => void updateGrant(grant, 'access_ready')} className="rounded-lg px-3 py-2 text-xs font-bold text-white disabled:opacity-50" style={{ background: BLUE }}>Accès prêt</button>{grant.status !== 'revoked' && <button disabled={savingGrant === grant.id} onClick={() => void updateGrant(grant, 'revoked')} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">Révoquer</button>}</div>
      </div>)}</div>}
    </div></div>}
  </div></AdminLayout>;
}
