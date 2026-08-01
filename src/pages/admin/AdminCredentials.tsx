import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlertTriangle, Award, BadgeCheck, Building2, CheckCircle2, ExternalLink, FileCheck2, Image as ImageIcon, KeyRound, Plus, RefreshCw, Search, ShieldCheck, Sparkles, Upload, X } from 'lucide-react';
import AdminCredentialsManagementLayout from '../../components/admin/AdminCredentialsManagementLayout';
import {
  BadgeAward, BadgeCategory, BadgeLevel, BadgeTemplate, ClrImport, ClrRecord, CredentialIssuer, CredentialSigningStatus, CredentialVerification, SkillsPassport,
  credentialStatusLabel, credentialsRequest,
} from '../../lib/credentialsApi';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';
type Section = 'overview' | 'templates' | 'awards' | 'issuers' | 'signatures' | 'taxonomy' | 'clr' | 'passports' | 'revocations';
type Metrics = { templates: number; awards: number; pending_reviews: number; active_issuers: number; clr_records: number; signed_awards: number };

type TemplateDraft = Partial<BadgeTemplate> & { source_types_text?: string };
type IssuerDraft = Partial<CredentialIssuer>;
type CategoryDraft = Partial<BadgeCategory>;
type LevelDraft = Partial<BadgeLevel>;

function sectionFromPath(path: string): Section {
  if (path.includes('/modeles')) return 'templates';
  if (path.includes('/attributions')) return 'awards';
  if (path.includes('/emetteurs')) return 'issuers';
  if (path.includes('/signatures')) return 'signatures';
  if (path.includes('/categories')) return 'taxonomy';
  if (path.includes('/passports')) return 'passports';
  if (path.includes('/clr')) return 'clr';
  if (path.includes('/revocations')) return 'revocations';
  return 'overview';
}

export default function AdminCredentials() {
  const location = useLocation();
  const section = sectionFromPath(location.pathname);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [templates, setTemplates] = useState<BadgeTemplate[]>([]);
  const [awards, setAwards] = useState<BadgeAward[]>([]);
  const [issuers, setIssuers] = useState<CredentialIssuer[]>([]);
  const [categories, setCategories] = useState<BadgeCategory[]>([]);
  const [levels, setLevels] = useState<BadgeLevel[]>([]);
  const [records, setRecords] = useState<ClrRecord[]>([]);
  const [clrImports, setClrImports] = useState<ClrImport[]>([]);
  const [passports, setPassports] = useState<SkillsPassport[]>([]);
  const [signing, setSigning] = useState<CredentialSigningStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft | null>(null);
  const [issuerDraft, setIssuerDraft] = useState<IssuerDraft | null>(null);
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft | null>(null);
  const [levelDraft, setLevelDraft] = useState<LevelDraft | null>(null);
  const [issueOpen, setIssueOpen] = useState(false);
  const [revokeAward, setRevokeAward] = useState<BadgeAward | null>(null);

  async function load() {
    setLoading(true); setError('');
    try {
      const [overview, templateData, awardData, issuerData, recordData, importData, signingData, passportData] = await Promise.all([
        credentialsRequest<{ success: true; metrics: Metrics }>('admin_overview'),
        credentialsRequest<{ success: true; templates: BadgeTemplate[]; categories: BadgeCategory[]; levels: BadgeLevel[]; issuers: CredentialIssuer[] }>('admin_templates'),
        credentialsRequest<{ success: true; awards: BadgeAward[] }>('admin_awards'),
        credentialsRequest<{ success: true; issuers: CredentialIssuer[] }>('admin_issuers'),
        credentialsRequest<{ success: true; records: ClrRecord[] }>('admin_clr_records'),
        credentialsRequest<{ success: true; imports: ClrImport[] }>('admin_clr_imports'),
        credentialsRequest<{ success: true; signing: CredentialSigningStatus }>('admin_signing_status'),
        credentialsRequest<{ success: true; passports: SkillsPassport[] }>('admin_skills_passports'),
      ]);
      setMetrics(overview.metrics); setTemplates(templateData.templates); setCategories(templateData.categories); setLevels(templateData.levels);
      setIssuers(issuerData.issuers.length ? issuerData.issuers : templateData.issuers); setAwards(awardData.awards); setRecords(recordData.records); setClrImports(importData.imports); setSigning(signingData.signing); setPassports(passportData.passports);
    } catch (cause) { setError(humanCredentialsError(cause instanceof Error ? cause.message : 'Gestion des credentials indisponible.')); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  return <AdminCredentialsManagementLayout><div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-5" style={{ borderColor: BORDER }}>
      <div><span className="text-xs font-semibold uppercase tracking-[.16em]" style={{ color: GOLD }}>Omnia Credentials</span><h1 className="mt-1 text-2xl font-semibold" style={{ color: BLUE }}>Badges & Learning Records</h1><p className="mt-2 text-sm text-slate-500">Fondation Open Badges 3.0 et CLR 2.0, preuves, visibilité et vérification.</p></div>
      <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ background: BLUE }}><RefreshCw size={15} /> Actualiser</button>
    </header>
    {error && <Message kind="error" text={error} />}{notice && <Message kind="success" text={notice} />}
    {loading ? <div className="py-24 text-center text-sm text-slate-500">Chargement…</div> : <>
      {section === 'overview' && <Overview metrics={metrics} templates={templates} awards={awards} />}
      {section === 'templates' && <Templates templates={templates} query={query} setQuery={setQuery} onCreate={() => setTemplateDraft({ status: 'draft', achievement_type: 'Achievement', default_visibility: 'oga', source_types_text: 'manual' })} onEdit={template => setTemplateDraft({ ...template, source_types_text: template.source_types.join(', ') })} />}
      {section === 'awards' && <Awards awards={awards} query={query} setQuery={setQuery} onIssue={() => setIssueOpen(true)} onRevoke={setRevokeAward} />}
      {section === 'issuers' && <Issuers issuers={issuers} onCreate={() => setIssuerDraft({ issuer_type: 'external', status: 'draft' })} onEdit={setIssuerDraft} />}
      {section === 'signatures' && <SigningPanel signing={signing} awards={awards} onNotice={setNotice} onReload={load} />}
      {section === 'taxonomy' && <Taxonomy categories={categories} levels={levels} onCategory={() => setCategoryDraft({ category_type: 'achievement', is_active: true })} onLevel={() => setLevelDraft({ is_active: true, color: BLUE })} onEditCategory={setCategoryDraft} onEditLevel={setLevelDraft} />}
      {section === 'clr' && <ClrRecords records={records} imports={clrImports} signingConfigured={Boolean(signing?.configured)} onNotice={setNotice} onReload={load} />}
      {section === 'passports' && <PassportsPanel passports={passports} onNotice={setNotice} onReload={load} />}
      {section === 'revocations' && <Awards awards={awards.filter(award => award.status === 'revoked')} query={query} setQuery={setQuery} onIssue={() => setIssueOpen(true)} onRevoke={setRevokeAward} hideIssue />}
    </>}
    {templateDraft && <TemplateModal draft={templateDraft} issuers={issuers} categories={categories} levels={levels} onClose={() => setTemplateDraft(null)} onDone={async message => { setTemplateDraft(null); setNotice(message); await load(); }} />}
    {issuerDraft && <IssuerModal draft={issuerDraft} onClose={() => setIssuerDraft(null)} onDone={async message => { setIssuerDraft(null); setNotice(message); await load(); }} />}
    {categoryDraft && <CategoryModal draft={categoryDraft} onClose={() => setCategoryDraft(null)} onDone={async message => { setCategoryDraft(null); setNotice(message); await load(); }} />}
    {levelDraft && <LevelModal draft={levelDraft} onClose={() => setLevelDraft(null)} onDone={async message => { setLevelDraft(null); setNotice(message); await load(); }} />}
    {issueOpen && <IssueModal templates={templates.filter(template => template.status === 'active')} onClose={() => setIssueOpen(false)} onDone={async message => { setIssueOpen(false); setNotice(message); await load(); }} />}
    {revokeAward && <RevokeModal award={revokeAward} onClose={() => setRevokeAward(null)} onDone={async message => { setRevokeAward(null); setNotice(message); await load(); }} />}
  </div></AdminCredentialsManagementLayout>;
}

function humanCredentialsError(value: string) {
  return ({
    CREDENTIALS_SIGNING_PRIVATE_JWK_INVALID_JSON: 'La clé privée de signature enregistrée dans Supabase n’est pas un JWK JSON valide. Remplacez la valeur du secret CREDENTIALS_SIGNING_PRIVATE_JWK par l’objet JSON complet, sans guillemets supplémentaires ni retour à la ligne autour.',
    SIGNING_NOT_CONFIGURED: 'La signature cryptographique n’est pas encore configurée dans Supabase.',
    BADGE_IMAGE_INVALID: 'Le fichier doit être une image PNG, JPEG ou WEBP.',
    BADGE_IMAGE_TOO_LARGE: 'L’image dépasse la taille maximale autorisée de 5 Mo.',
    BADGE_IMAGE_EMPTY: 'Le fichier image est vide.',
    LEARNER_ROLE_REQUIRED: 'Cette action est réservée à un véritable compte apprenant et ne peut pas être exécutée depuis une prévisualisation Super Admin.',
  } as Record<string, string>)[value] || value;
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',').pop() || '');
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.readAsDataURL(file);
  });
}

function Message({ kind, text }: { kind: 'error' | 'success'; text: string }) { return <div className={`mt-5 rounded-xl border p-4 text-sm ${kind === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>{text}</div>; }

function Overview({ metrics, templates, awards }: { metrics: Metrics | null; templates: BadgeTemplate[]; awards: BadgeAward[] }) {
  const cards = [
    ['Modèles', metrics?.templates || 0, Award], ['Badges attribués', metrics?.awards || 0, BadgeCheck], ['Émetteurs actifs', metrics?.active_issuers || 0, Building2], ['Learning Records', metrics?.clr_records || 0, FileCheck2],
  ] as const;
  return <div className="mt-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value, Icon]) => <div key={label} className="rounded-xl border bg-white p-5" style={{ borderColor: BORDER }}><Icon color={GOLD} /><p className="mt-4 text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-semibold" style={{ color: BLUE }}>{value}</p></div>)}</div>
    <div className="mt-6 grid gap-6 lg:grid-cols-2"><section className="rounded-xl border bg-white p-5" style={{ borderColor: BORDER }}><h2 className="font-semibold" style={{ color: BLUE }}>Modèles récents</h2><div className="mt-4 divide-y">{templates.slice(0, 6).map(template => <div key={template.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-semibold" style={{ color: BLUE }}>{template.name}</p><p className="text-xs text-slate-500">{template.category?.name || 'Sans catégorie'}</p></div><Status value={template.status} /></div>)}{templates.length === 0 && <Empty text="Aucun modèle." />}</div></section>
    <section className="rounded-xl border bg-white p-5" style={{ borderColor: BORDER }}><h2 className="font-semibold" style={{ color: BLUE }}>Attributions récentes</h2><div className="mt-4 divide-y">{awards.slice(0, 6).map(award => <div key={award.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-semibold" style={{ color: BLUE }}>{award.template?.name || 'Badge'}</p><p className="text-xs text-slate-500">{award.recipient?.full_name || 'Bénéficiaire'}</p></div><Status value={award.status} /></div>)}{awards.length === 0 && <Empty text="Aucune attribution." />}</div></section></div>
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      <Link to="/admin/credentials/clr" className="rounded-xl border bg-white p-5 transition hover:border-slate-400" style={{ borderColor: BORDER }}><div className="flex items-center gap-3"><FileCheck2 color={GOLD} /><div><p className="font-semibold" style={{ color: BLUE }}>Gérer les Learning Records</p><p className="mt-1 text-xs text-slate-500">Synchronisation, imports, signature et vérification CLR 2.0.</p></div></div></Link>
      <Link to="/admin/credentials/passports" className="rounded-xl border bg-white p-5 transition hover:border-slate-400" style={{ borderColor: BORDER }}><div className="flex items-center gap-3"><Sparkles color={GOLD} /><div><p className="font-semibold" style={{ color: BLUE }}>Gérer les Skills Passports</p><p className="mt-1 text-xs text-slate-500">Contrôle des passeports professionnels publiés et signés.</p></div></div></Link>
    </div>
    <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"><strong>Interopérabilité active :</strong> Open Badges 3.0, CLR 2.0, JSON-LD, VC-JWT, signatures et vérifications sont gérés depuis cet espace.</div>
  </div>;
}

function Templates({ templates, query, setQuery, onCreate, onEdit }: { templates: BadgeTemplate[]; query: string; setQuery: (value: string) => void; onCreate: () => void; onEdit: (template: BadgeTemplate) => void }) {
  const filtered = useMemo(() => { const q = query.trim().toLowerCase(); return templates.filter(template => !q || [template.name, template.code, template.category?.name, template.level?.name].filter(Boolean).join(' ').toLowerCase().includes(q)); }, [query, templates]);
  return <section className="mt-6 rounded-xl border bg-white" style={{ borderColor: BORDER }}><Toolbar query={query} setQuery={setQuery} button="Nouveau modèle" onClick={onCreate} /><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Badge</th><th className="px-4 py-3">Catégorie</th><th className="px-4 py-3">Niveau</th><th className="px-4 py-3">Sources</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3"></th></tr></thead><tbody className="divide-y">{filtered.map(template => <tr key={template.id}><td className="px-4 py-4"><p className="font-semibold" style={{ color: BLUE }}>{template.name}</p><p className="text-xs text-slate-500">{template.code}</p></td><td className="px-4 py-4">{template.category?.name || '—'}</td><td className="px-4 py-4">{template.level?.name || '—'}</td><td className="px-4 py-4 text-xs text-slate-500">{template.source_types.join(', ')}</td><td className="px-4 py-4"><Status value={template.status} /></td><td className="px-4 py-4 text-right"><button onClick={() => onEdit(template)} className="text-sm font-semibold" style={{ color: GOLD }}>Modifier</button></td></tr>)}{filtered.length === 0 && <tr><td colSpan={6}><Empty text="Aucun modèle trouvé." /></td></tr>}</tbody></table></div></section>;
}

function Awards({ awards, query, setQuery, onIssue, onRevoke, hideIssue = false }: { awards: BadgeAward[]; query: string; setQuery: (value: string) => void; onIssue: () => void; onRevoke: (award: BadgeAward) => void; hideIssue?: boolean }) {
  const filtered = useMemo(() => { const q = query.trim().toLowerCase(); return awards.filter(award => !q || [award.template?.name, award.recipient?.full_name, award.recipient?.email, award.verification_code].filter(Boolean).join(' ').toLowerCase().includes(q)); }, [awards, query]);
  return <section className="mt-6 rounded-xl border bg-white" style={{ borderColor: BORDER }}><Toolbar query={query} setQuery={setQuery} button={hideIssue ? undefined : 'Attribuer un badge'} onClick={onIssue} /><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Badge</th><th className="px-4 py-3">Bénéficiaire</th><th className="px-4 py-3">Émission</th><th className="px-4 py-3">Visibilité</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3"></th></tr></thead><tbody className="divide-y">{filtered.map(award => <tr key={award.id}><td className="px-4 py-4"><p className="font-semibold" style={{ color: BLUE }}>{award.template?.name || 'Badge'}</p><p className="font-mono text-xs text-slate-500">{award.verification_code}</p></td><td className="px-4 py-4"><p>{award.recipient?.full_name || '—'}</p><p className="text-xs text-slate-500">{award.recipient?.email || ''}</p></td><td className="px-4 py-4">{new Date(award.issued_at).toLocaleDateString('fr-FR')}</td><td className="px-4 py-4">{award.visibility}</td><td className="px-4 py-4"><Status value={award.status} /></td><td className="px-4 py-4 text-right"><div className="flex justify-end gap-3">{award.visibility === 'public' && <Link to={`/credentials/badges/${award.verification_code}`} target="_blank" className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: BLUE }}><ExternalLink size={13} /> Vérifier</Link>}{award.status !== 'revoked' && <button onClick={() => onRevoke(award)} className="text-xs font-semibold text-red-600">Révoquer</button>}</div></td></tr>)}{filtered.length === 0 && <tr><td colSpan={6}><Empty text="Aucune attribution." /></td></tr>}</tbody></table></div></section>;
}

function Issuers({ issuers, onCreate, onEdit }: { issuers: CredentialIssuer[]; onCreate: () => void; onEdit: (issuer: CredentialIssuer) => void }) { return <section className="mt-6 rounded-xl border bg-white" style={{ borderColor: BORDER }}><div className="flex items-center justify-between border-b p-4"><div><h2 className="font-semibold" style={{ color: BLUE }}>Émetteurs autorisés</h2><p className="text-xs text-slate-500">OGA, Structures et organismes externes.</p></div><button onClick={onCreate} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ background: BLUE }}><Plus size={15} /> Nouvel émetteur</button></div><div className="grid gap-4 p-4 md:grid-cols-2">{issuers.map(issuer => <button key={issuer.id} onClick={() => onEdit(issuer)} className="rounded-xl border p-4 text-left hover:border-slate-400" style={{ borderColor: BORDER }}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold" style={{ color: BLUE }}>{issuer.name}</p><p className="mt-1 text-xs text-slate-500">{issuer.issuer_type} · {issuer.issuer_uri}</p></div><Status value={issuer.status} /></div>{issuer.did && <p className="mt-3 break-all font-mono text-xs text-slate-500">{issuer.did}</p>}</button>)}{issuers.length === 0 && <Empty text="Aucun émetteur." />}</div></section>; }

function Taxonomy({ categories, levels, onCategory, onLevel, onEditCategory, onEditLevel }: { categories: BadgeCategory[]; levels: BadgeLevel[]; onCategory: () => void; onLevel: () => void; onEditCategory: (category: BadgeCategory) => void; onEditLevel: (level: BadgeLevel) => void }) { return <div className="mt-6 grid gap-6 lg:grid-cols-2"><section className="rounded-xl border bg-white" style={{ borderColor: BORDER }}><div className="flex items-center justify-between border-b p-4"><h2 className="font-semibold" style={{ color: BLUE }}>Catégories</h2><button onClick={onCategory} className="text-sm font-semibold" style={{ color: GOLD }}>Ajouter</button></div><div className="divide-y">{categories.map(category => <button key={category.id} onClick={() => onEditCategory(category)} className="flex w-full items-center justify-between gap-3 p-4 text-left"><div><p className="font-semibold" style={{ color: BLUE }}>{category.name}</p><p className="text-xs text-slate-500">{category.category_type}</p></div><Status value={category.is_active ? 'active' : 'inactive'} /></button>)}</div></section><section className="rounded-xl border bg-white" style={{ borderColor: BORDER }}><div className="flex items-center justify-between border-b p-4"><h2 className="font-semibold" style={{ color: BLUE }}>Niveaux</h2><button onClick={onLevel} className="text-sm font-semibold" style={{ color: GOLD }}>Ajouter</button></div><div className="divide-y">{levels.map(level => <button key={level.id} onClick={() => onEditLevel(level)} className="flex w-full items-center justify-between gap-3 p-4 text-left"><div className="flex items-center gap-3"><span className="h-4 w-4 rounded-full" style={{ background: level.color }} /><div><p className="font-semibold" style={{ color: BLUE }}>{level.name}</p><p className="text-xs text-slate-500">Rang {level.rank}</p></div></div><Status value={level.is_active ? 'active' : 'inactive'} /></button>)}</div></section></div>; }

function ClrRecords({ records, imports, signingConfigured, onNotice, onReload }: { records: ClrRecord[]; imports: ClrImport[]; signingConfigured: boolean; onNotice: (message: string) => void; onReload: () => Promise<void> }) {
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const [verification, setVerification] = useState<{ recordId: string; result: CredentialVerification } | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{ item: ClrImport; decision: 'approve' | 'reject' } | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const pendingImports = imports.filter(item => item.status === 'pending');
  const metrics = {
    records: records.length,
    signed: records.filter(record => record.standards_status === 'clr2_signed').length,
    verifiedEntries: records.reduce((sum, record) => sum + (record.entry_counts?.verified || 0), 0),
    pendingImports: pendingImports.length,
  };

  async function execute(label: string, action: string, payload: Record<string, unknown>, success: string) {
    setWorking(label); setError(''); setVerification(null);
    try {
      const response = await credentialsRequest<{ success: true; verification?: CredentialVerification }>(action, payload);
      if (response.verification) setVerification({ recordId: String(payload.record_id || ''), result: response.verification });
      onNotice(success);
      await onReload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Opération CLR impossible.'); }
    finally { setWorking(''); }
  }

  async function review(event: FormEvent) {
    event.preventDefault();
    if (!reviewTarget || (reviewTarget.decision === 'reject' && !reviewNote.trim())) return;
    const target = reviewTarget;
    setReviewTarget(null);
    await execute(`import-${target.item.id}`, 'admin_review_clr_import', { import_id: target.item.id, decision: target.decision, review_note: reviewNote }, target.decision === 'approve' ? 'Import CLR validé.' : 'Import CLR refusé.');
    setReviewNote('');
  }

  return <div className="mt-6 space-y-6">
    {error && <Message kind="error" text={humanClrError(error)} />}
    <section className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: BORDER }}>
      <div className="border-b p-4" style={{ borderColor: BORDER }}><h2 className="font-semibold" style={{ color: BLUE }}>Omnia Learning Records</h2><p className="text-xs text-slate-500">Synchronisation, signature, vérification et contrôle des imports CLR.</p></div>
      <div className="grid grid-cols-2 border-b md:grid-cols-4" style={{ borderColor: BORDER }}>
        <ClrMetric label="Dossiers" value={metrics.records} />
        <ClrMetric label="CLR signés" value={metrics.signed} />
        <ClrMetric label="Éléments vérifiés" value={metrics.verifiedEntries} />
        <ClrMetric label="Imports à contrôler" value={metrics.pendingImports} warning={metrics.pendingImports > 0} />
      </div>
      <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Utilisateur</th><th className="px-4 py-3">Contenu</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3">Dernière génération</th><th className="px-4 py-3">Actions</th></tr></thead><tbody className="divide-y">{records.map(record => <tr key={record.id}><td className="px-4 py-4"><p className="font-semibold" style={{ color: BLUE }}>{record.user?.full_name || 'Utilisateur'}</p><p className="text-xs text-slate-500">{record.user?.email || record.record_uuid}</p></td><td className="px-4 py-4"><p>{record.entry_counts?.total || 0} élément(s)</p><p className="text-xs text-slate-500">{record.entry_counts?.verified || 0} vérifié(s) · {record.entry_counts?.pending || 0} à contrôler</p></td><td className="px-4 py-4"><Status value={record.standards_status} /></td><td className="px-4 py-4 text-xs text-slate-500">{record.last_built_at ? new Date(record.last_built_at).toLocaleString('fr-FR') : '—'}</td><td className="px-4 py-4"><div className="flex flex-wrap gap-2"><button disabled={Boolean(working)} onClick={() => void execute(`sync-${record.id}`, 'admin_sync_clr', { user_id: record.user_id }, 'CLR synchronisé.')} className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50" style={{ borderColor: BORDER, color: BLUE }}><RefreshCw size={13} className="mr-1 inline" />Synchroniser</button><button disabled={Boolean(working) || !signingConfigured} title={!signingConfigured ? 'La clé de signature doit être configurée.' : undefined} onClick={() => void execute(`sign-${record.id}`, 'admin_sign_clr', { user_id: record.user_id }, 'CLR signé.')} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50" style={{ background: BLUE }}><ShieldCheck size={13} className="mr-1 inline" />Signer</button>{record.standards_status === 'clr2_signed' && <button disabled={Boolean(working)} onClick={() => void execute(`verify-${record.id}`, 'admin_verify_clr', { record_id: record.id }, 'Vérification terminée.')} className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-green-700 disabled:opacity-50" style={{ borderColor: '#BBF7D0' }}><CheckCircle2 size={13} className="mr-1 inline" />Vérifier</button>}</div>{verification?.recordId === record.id && <p className={`mt-2 text-xs font-semibold ${verification.result.overall_valid ? 'text-green-700' : 'text-red-600'}`}>{verification.result.overall_valid ? 'Signature et structure valides.' : `Vérification échouée : ${verification.result.error_code || 'credential invalide'}`}</p>}</td></tr>)}{records.length === 0 && <tr><td colSpan={5}><Empty text="Aucun Learning Record généré." /></td></tr>}</tbody></table></div>
    </section>

    <section className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: BORDER }}>
      <div className="border-b p-4" style={{ borderColor: BORDER }}><h2 className="font-semibold" style={{ color: BLUE }}>Imports externes</h2><p className="text-xs text-slate-500">Les credentials externes non vérifiables automatiquement restent en attente d’une décision Super Admin.</p></div>
      <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Apprenant</th><th className="px-4 py-3">Fichier / émetteur</th><th className="px-4 py-3">Format</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Décision</th></tr></thead><tbody className="divide-y">{imports.map(item => <tr key={item.id}><td className="px-4 py-4"><p className="font-semibold" style={{ color: BLUE }}>{item.user?.full_name || 'Apprenant'}</p><p className="text-xs text-slate-500">{item.user?.email || item.record?.title || ''}</p></td><td className="px-4 py-4"><p>{item.source_file_name || item.credential_type || 'Credential externe'}</p><p className="text-xs text-slate-500">{item.source_issuer || 'Émetteur non renseigné'} · {item.imported_entries_count} entrée(s)</p></td><td className="px-4 py-4 font-mono text-xs">{item.source_format}</td><td className="px-4 py-4"><Status value={item.status} /></td><td className="px-4 py-4 text-xs text-slate-500">{new Date(item.created_at).toLocaleString('fr-FR')}</td><td className="px-4 py-4">{item.status === 'pending' ? <div className="flex gap-2"><button disabled={Boolean(working)} onClick={() => { setReviewNote(''); setReviewTarget({ item, decision: 'approve' }); }} className="rounded-lg bg-green-50 px-2.5 py-1.5 text-xs font-semibold text-green-700 disabled:opacity-50">Valider</button><button disabled={Boolean(working)} onClick={() => { setReviewNote(''); setReviewTarget({ item, decision: 'reject' }); }} className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50">Refuser</button></div> : <p className="max-w-xs text-xs text-slate-500">{item.review_note || 'Décision enregistrée.'}</p>}</td></tr>)}{imports.length === 0 && <tr><td colSpan={6}><Empty text="Aucun import externe." /></td></tr>}</tbody></table></div>
    </section>
    {reviewTarget && <Modal title={reviewTarget.decision === 'approve' ? 'Valider l’import CLR' : 'Refuser l’import CLR'} onClose={() => { setReviewTarget(null); setReviewNote(''); }}><form onSubmit={review} className="space-y-4 p-5"><p className="text-sm text-slate-600"><span className="font-semibold" style={{ color: BLUE }}>{reviewTarget.item.source_file_name || reviewTarget.item.credential_type || 'Credential externe'}</span><br />{reviewTarget.item.user?.full_name || reviewTarget.item.user?.email || 'Apprenant'}</p><Field label={reviewTarget.decision === 'approve' ? 'Note de validation (facultative)' : 'Motif du refus'}><textarea required={reviewTarget.decision === 'reject'} rows={4} className={inputClass} value={reviewNote} onChange={event => setReviewNote(event.target.value)} /></Field><div className="flex justify-end gap-2"><button type="button" onClick={() => { setReviewTarget(null); setReviewNote(''); }} className="rounded-lg border px-4 py-2 text-sm font-semibold" style={{ borderColor: BORDER, color: BLUE }}>Annuler</button><button disabled={Boolean(working) || (reviewTarget.decision === 'reject' && !reviewNote.trim())} className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${reviewTarget.decision === 'reject' ? 'bg-red-600' : ''}`} style={reviewTarget.decision === 'approve' ? { background: BLUE } : undefined}>{reviewTarget.decision === 'approve' ? 'Valider l’import' : 'Confirmer le refus'}</button></div></form></Modal>}
  </div>;
}

function ClrMetric({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) { return <div className="border-r p-4 last:border-r-0" style={{ borderColor: BORDER }}><p className="text-xs text-slate-500">{label}</p><p className={`mt-1 text-xl font-semibold ${warning ? 'text-amber-700' : ''}`} style={warning ? undefined : { color: BLUE }}>{value}</p></div>; }
function humanClrError(value: string) { return ({ SIGNING_NOT_CONFIGURED: 'La clé de signature Supabase n’est pas configurée.', CLR_NOT_SIGNED: 'Ce Learning Record doit d’abord être signé.', CLR_IMPORT_NOT_FOUND: 'Cet import est introuvable.', CLR_IMPORT_DECISION_INVALID: 'La décision de contrôle est invalide.' } as Record<string, string>)[value] || value; }

function PassportsPanel({ passports, onNotice, onReload }: { passports: SkillsPassport[]; onNotice: (message: string) => void; onReload: () => Promise<void> }) {
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const [verification, setVerification] = useState<{ id: string; result: CredentialVerification } | null>(null);

  async function verify(passport: SkillsPassport) {
    setWorking(passport.id); setError('');
    try {
      const response = await credentialsRequest<{ success: true; verification: CredentialVerification }>('admin_verify_skills_passport', { passport_id: passport.id });
      setVerification({ id: passport.id, result: response.verification });
      onNotice(response.verification.overall_valid ? 'Skills Passport vérifié.' : 'La vérification a détecté une anomalie.');
      await onReload();
    } catch (cause) { setError(humanCredentialsError(cause instanceof Error ? cause.message : 'Vérification impossible.')); }
    finally { setWorking(''); }
  }

  return <div className="mt-6 space-y-6">
    <section className="rounded-xl border bg-white p-5" style={{ borderColor: BORDER }}>
      <div className="flex items-start gap-3"><span className="rounded-xl bg-amber-50 p-3" style={{ color: GOLD }}><Sparkles size={22} /></span><div><h2 className="font-semibold" style={{ color: BLUE }}>Omnia Skills Passport</h2><p className="mt-1 max-w-3xl text-sm text-slate-500">Contrôle des passeports professionnels publiés à partir des Learning Records. Le Super Admin vérifie la signature sans modifier la sélection de l’apprenant.</p></div></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3"><Metric label="Passeports" value={passports.length} /><Metric label="Publiés" value={passports.filter(item => item.status === 'published').length} /><Metric label="Liens actifs" value={passports.reduce((sum, item) => sum + Number(item.active_share_count || 0), 0)} /></div>
      {error && <Message kind="error" text={error} />}
    </section>
    <section className="rounded-xl border bg-white" style={{ borderColor: BORDER }}>
      <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Titulaire</th><th className="px-4 py-3">Passeport</th><th className="px-4 py-3">Contenu</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3">Vérification</th><th className="px-4 py-3"></th></tr></thead><tbody className="divide-y">
        {passports.map(passport => { const result = verification?.id === passport.id ? verification.result : passport.verification_result as CredentialVerification | undefined; return <tr key={passport.id}><td className="px-4 py-4"><p className="font-semibold" style={{ color: BLUE }}>{passport.user?.full_name || 'Apprenant'}</p><p className="text-xs text-slate-500">Données personnelles protégées</p></td><td className="px-4 py-4"><p className="font-semibold" style={{ color: BLUE }}>{passport.title}</p><p className="text-xs text-slate-500">Version {passport.version}{passport.published_at ? ` · ${new Date(passport.published_at).toLocaleDateString('fr-FR')}` : ''}</p></td><td className="px-4 py-4 text-xs text-slate-600">{passport.item_count || 0} élément(s)<br />{passport.active_share_count || 0} lien(s) actif(s)</td><td className="px-4 py-4"><Status value={passport.status} /></td><td className="px-4 py-4 text-xs">{result?.checked_at ? <span className={result.overall_valid ? 'text-green-700' : 'text-red-700'}>{result.overall_valid ? 'Valide' : result.error_code || 'Invalide'}<br />{new Date(result.checked_at).toLocaleString('fr-FR')}</span> : 'Jamais vérifié'}</td><td className="px-4 py-4 text-right"><button disabled={working === passport.id || !passport.presentation_jwt} onClick={() => void verify(passport)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold disabled:opacity-50" style={{ color: BLUE }}>Vérifier</button></td></tr>; })}
        {passports.length === 0 && <tr><td colSpan={6}><Empty text="Aucun Skills Passport créé." /></td></tr>}
      </tbody></table></div>
    </section>
  </div>;
}

function SigningPanel({ signing, awards, onNotice, onReload }: { signing: CredentialSigningStatus | null; awards: BadgeAward[]; onNotice: (message: string) => void; onReload: () => Promise<void> }) {
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const [verification, setVerification] = useState<{ awardId: string; result: CredentialVerification } | null>(null);
  const unsigned = awards.filter(award => award.status === 'awarded' && award.standards_status !== 'ob3_signed' && award.template?.internal_only !== true);
  const signed = awards.filter(award => award.standards_status === 'ob3_signed');

  async function execute(label: string, action: string, payload: Record<string, unknown> = {}, success = 'Opération terminée.') {
    setWorking(label); setError(''); setVerification(null);
    try {
      const response = await credentialsRequest<{ success: true; verification?: CredentialVerification }>(action, payload);
      if (response.verification) setVerification({ awardId: String(payload.award_id || ''), result: response.verification });
      onNotice(success);
      await onReload();
    } catch (cause) {
      setError(humanCredentialsError(cause instanceof Error ? cause.message : 'Opération de signature impossible.'));
    } finally { setWorking(''); }
  }

  return <div className="mt-6 space-y-6">
    <section className="rounded-xl border bg-white p-5" style={{ borderColor: BORDER }}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-amber-50 p-3" style={{ color: GOLD }}><KeyRound size={22} /></span>
          <div><h2 className="font-semibold" style={{ color: BLUE }}>Signature Open Badges 3.0</h2><p className="mt-1 max-w-2xl text-sm text-slate-500">Signature VC-JWT en RS256, publication de la clé publique et vérification cryptographique des badges.</p></div>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${signing?.configured ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
          {signing?.configured ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {signing?.configured ? 'Signature configurée' : 'Configuration requise'}
        </span>
      </div>
      {!signing?.configured && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><p className="font-semibold">Clé privée absente ou invalide</p><p className="mt-1">Ajoutez le secret Supabase <code>CREDENTIALS_SIGNING_PRIVATE_JWK</code>, puis redéployez la fonction <code>credentials</code>. La clé privée ne doit jamais être enregistrée en base ni copiée dans le frontend.</p>{signing?.configuration_error && <p className="mt-2 text-xs">{humanCredentialsError(signing.configuration_error)}</p>}</div>}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Badges signés" value={signing?.signed_awards || signed.length} />
        <Metric label="À signer" value={signing?.unsigned_awards || unsigned.length} />
        <Metric label="Clés publiques" value={signing?.keys.length || 0} />
        <Metric label="Vérifications" value={signing?.verification_events || 0} />
      </div>
      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <p className="font-semibold" style={{ color: BLUE }}>Point public des clés</p>
        <p className="mt-1 break-all font-mono text-xs text-slate-600">{signing?.public_key_endpoint || 'À déterminer après déploiement'}</p>
        {signing?.current_key && <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2"><p><strong>Algorithme :</strong> {signing.current_key.algorithm}</p><p><strong>Empreinte :</strong> <span className="font-mono">{signing.current_key.jwk_thumbprint}</span></p><p className="sm:col-span-2"><strong>Key ID :</strong> <span className="break-all font-mono">{signing.current_key.key_id_uri}</span></p></div>}
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button disabled={!signing?.configured || Boolean(working)} onClick={() => void execute('sync', 'admin_sync_signing_key', {}, 'Clé publique synchronisée avec l’émetteur OGA.')} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" style={{ background: BLUE }}><RefreshCw size={15} className={working === 'sync' ? 'animate-spin' : ''} /> Synchroniser la clé publique</button>
        <button disabled={!signing?.configured || unsigned.length === 0 || Boolean(working)} onClick={() => void execute('bulk', 'admin_sign_unsigned', { limit: 100 }, 'Badges non signés traités.')} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50" style={{ borderColor: GOLD, color: GOLD }}><KeyRound size={15} /> Signer les badges existants</button>
      </div>
      {error && <Message kind="error" text={error} />}
    </section>

    <section className="rounded-xl border bg-white" style={{ borderColor: BORDER }}>
      <div className="border-b p-4"><h2 className="font-semibold" style={{ color: BLUE }}>Contrôle des attributions</h2><p className="text-xs text-slate-500">La signature n’est proposée que pour les badges actifs et non internes.</p></div>
      <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Badge</th><th className="px-4 py-3">Bénéficiaire</th><th className="px-4 py-3">Standard</th><th className="px-4 py-3">Dernière vérification</th><th className="px-4 py-3"></th></tr></thead><tbody className="divide-y">
        {awards.filter(award => award.status === 'awarded').map(award => {
          const isSigned = award.standards_status === 'ob3_signed';
          const result = verification?.awardId === award.id ? verification.result : award.verification_result;
          return <tr key={award.id}><td className="px-4 py-4"><p className="font-semibold" style={{ color: BLUE }}>{award.template?.name || 'Badge'}</p><p className="font-mono text-xs text-slate-500">{award.verification_code}</p></td><td className="px-4 py-4">{award.recipient?.full_name || '—'}</td><td className="px-4 py-4"><Status value={award.standards_status} /></td><td className="px-4 py-4 text-xs text-slate-500">{result ? <span className={result.overall_valid ? 'text-green-700' : 'text-red-700'}>{result.overall_valid ? 'Valide' : result.error_code || 'Invalide'} · {new Date(result.checked_at).toLocaleString('fr-FR')}</span> : 'Jamais vérifié'}</td><td className="px-4 py-4 text-right"><div className="flex justify-end gap-2">{isSigned ? <button disabled={Boolean(working)} onClick={() => void execute(`verify-${award.id}`, 'admin_verify_award', { award_id: award.id }, 'Signature vérifiée.')} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold" style={{ color: BLUE }}>Vérifier</button> : <button disabled={!signing?.configured || award.template?.internal_only === true || Boolean(working)} onClick={() => void execute(`sign-${award.id}`, 'admin_sign_award', { award_id: award.id }, 'Badge signé en Open Badges 3.0.')} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50" style={{ background: BLUE }}>Signer</button>}</div></td></tr>;
        })}
        {awards.filter(award => award.status === 'awarded').length === 0 && <tr><td colSpan={5}><Empty text="Aucun badge actif à signer." /></td></tr>}
      </tbody></table></div>
    </section>
  </div>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-semibold" style={{ color: BLUE }}>{value}</p></div>; }

function Toolbar({ query, setQuery, button, onClick }: { query: string; setQuery: (value: string) => void; button?: string; onClick: () => void }) { return <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><label className="flex min-w-[240px] flex-1 items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: BORDER }}><Search size={16} className="text-slate-400" /><input value={query} onChange={event => setQuery(event.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="Rechercher…" /></label>{button && <button onClick={onClick} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ background: BLUE }}><Plus size={15} /> {button}</button>}</div>; }
function Empty({ text }: { text: string }) { return <div className="p-8 text-center text-sm text-slate-500">{text}</div>; }
function Status({ value }: { value: string }) { const good = ['active','awarded','ob3_signed','clr2_signed'].includes(value); const bad = ['revoked','suspended','rejected'].includes(value); return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${good ? 'bg-green-50 text-green-700' : bad ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{credentialStatusLabel(value)}</span>; }

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><div className="sticky top-0 flex items-center justify-between border-b bg-white p-5"><h2 className="font-semibold" style={{ color: BLUE }}>{title}</h2><button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100"><X size={18} /></button></div>{children}</div></div>; }
const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400';

function TemplateModal({ draft, issuers, categories, levels, onClose, onDone }: { draft: TemplateDraft; issuers: CredentialIssuer[]; categories: BadgeCategory[]; levels: BadgeLevel[]; onClose: () => void; onDone: (message: string) => void }) {
  const initialMetadata = (draft.metadata || {}) as Record<string, unknown>;
  const [form, setForm] = useState<TemplateDraft>({ ...draft, metadata: { design_mode: 'upload', primary_color: BLUE, accent_color: GOLD, symbol: '✓', ...initialMetadata } });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const metadata = (form.metadata || {}) as Record<string, unknown>;
  const designMode = String(metadata.design_mode || 'upload');
  const updateMeta = (patch: Record<string, unknown>) => setForm(current => ({ ...current, metadata: { ...((current.metadata || {}) as Record<string, unknown>), ...patch } }));

  async function uploadImage(file?: File) {
    if (!file) return;
    setError('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setError(humanCredentialsError('BADGE_IMAGE_INVALID')); return; }
    if (file.size > 5 * 1024 * 1024) { setError(humanCredentialsError('BADGE_IMAGE_TOO_LARGE')); return; }
    setUploading(true);
    try {
      const response = await credentialsRequest<{ success: true; url: string }>('admin_upload_badge_image', { file_name: file.name, mime_type: file.type, base64: await fileToBase64(file) });
      setForm(current => ({ ...current, image_url: response.url, metadata: { ...((current.metadata || {}) as Record<string, unknown>), design_mode: 'upload' } }));
    } catch (cause) { setError(humanCredentialsError(cause instanceof Error ? cause.message : 'Téléversement impossible.')); }
    finally { setUploading(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const sourceTypes = String(form.source_types_text || '').split(',').map(value => value.trim()).filter(Boolean);
      const cleanMetadata = { ...metadata,
        course_ids: String(metadata.course_ids_text || '').split(',').map(value => value.trim()).filter(Boolean),
        categories: String(metadata.categories_text || '').split(',').map(value => value.trim()).filter(Boolean),
        levels: String(metadata.levels_text || '').split(',').map(value => value.trim()).filter(Boolean),
        certification_types: String(metadata.certification_types_text || '').split(',').map(value => value.trim()).filter(Boolean),
      };
      delete cleanMetadata['course_ids_text']; delete cleanMetadata['categories_text']; delete cleanMetadata['levels_text']; delete cleanMetadata['certification_types_text'];
      await credentialsRequest('admin_save_template', { ...form, source_types: sourceTypes, metadata: cleanMetadata, image_url: designMode === 'automatic' ? null : form.image_url });
      onDone(form.id ? 'Modèle modifié.' : 'Modèle créé.');
    } catch (cause) { setError(humanCredentialsError(cause instanceof Error ? cause.message : 'Enregistrement impossible.')); }
    finally { setSaving(false); }
  }

  const automaticPreview = <div className="relative flex h-full w-full items-center justify-center rounded-full" style={{ background: String(metadata.primary_color || BLUE), border: `5px solid ${String(metadata.accent_color || GOLD)}` }}><span className="text-4xl font-black text-white">{String(metadata.symbol || '✓').slice(0, 2)}</span><span className="absolute bottom-2 left-2 right-2 truncate rounded-full bg-white px-2 py-1 text-center text-[9px] font-bold" style={{ color: String(metadata.primary_color || BLUE) }}>{form.name || 'Badge OGA'}</span></div>;

  return <Modal title={form.id ? 'Modifier le modèle' : 'Nouveau modèle de badge'} onClose={onClose}><form onSubmit={submit} className="space-y-4 p-5">
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Nom"><input required className={inputClass} value={form.name || ''} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} /></Field>
      <Field label="Code"><input className={inputClass} value={form.code || ''} onChange={event => setForm(current => ({ ...current, code: event.target.value }))} placeholder="généré automatiquement" /></Field>
      <Field label="Émetteur"><select required className={inputClass} value={form.issuer_id || ''} onChange={event => setForm(current => ({ ...current, issuer_id: event.target.value }))}><option value="">Sélectionner</option>{issuers.filter(issuer => issuer.status === 'active').map(issuer => <option key={issuer.id} value={issuer.id}>{issuer.name}</option>)}</select></Field>
      <Field label="Catégorie"><select required className={inputClass} value={form.category_id || ''} onChange={event => setForm(current => ({ ...current, category_id: event.target.value }))}><option value="">Sélectionner</option>{categories.filter(category => category.is_active).map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field>
      <Field label="Niveau"><select className={inputClass} value={form.level_id || ''} onChange={event => setForm(current => ({ ...current, level_id: event.target.value || null }))}><option value="">Sans niveau</option>{levels.filter(level => level.is_active).map(level => <option key={level.id} value={level.id}>{level.name}</option>)}</select></Field>
      <Field label="Type de réalisation"><input className={inputClass} value={form.achievement_type || ''} onChange={event => setForm(current => ({ ...current, achievement_type: event.target.value }))} placeholder="Achievement, Competency…" /></Field>
    </div>
    <Field label="Description"><textarea required rows={3} className={inputClass} value={form.description || ''} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} /></Field>
    <Field label="Critères d’obtention"><textarea required rows={3} className={inputClass} value={form.criteria_narrative || ''} onChange={event => setForm(current => ({ ...current, criteria_narrative: event.target.value }))} /></Field>

    <div className="rounded-xl border border-slate-200 p-4">
      <div className="mb-4 flex gap-3"><button type="button" onClick={() => updateMeta({ design_mode: 'automatic' })} className={`rounded-lg px-3 py-2 text-sm font-semibold ${designMode === 'automatic' ? 'text-white' : 'border'}`} style={designMode === 'automatic' ? { background: BLUE } : undefined}><Sparkles size={14} className="mr-1 inline" />Génération OGA</button><button type="button" onClick={() => updateMeta({ design_mode: 'upload' })} className={`rounded-lg px-3 py-2 text-sm font-semibold ${designMode === 'upload' ? 'text-white' : 'border'}`} style={designMode === 'upload' ? { background: BLUE } : undefined}><Upload size={14} className="mr-1 inline" />Design personnalisé</button></div>
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">{designMode === 'automatic' ? automaticPreview : form.image_url ? <img src={form.image_url} alt="Aperçu du badge" className="h-full w-full object-contain" /> : <ImageIcon className="text-slate-400" />}</div>
        <div className="min-w-0 flex-1 space-y-3">
          {designMode === 'automatic' ? <div className="grid gap-3 sm:grid-cols-3"><Field label="Couleur principale"><input type="color" className="h-10 w-full rounded-lg border" value={String(metadata.primary_color || BLUE)} onChange={event => updateMeta({ primary_color: event.target.value })} /></Field><Field label="Couleur accent"><input type="color" className="h-10 w-full rounded-lg border" value={String(metadata.accent_color || GOLD)} onChange={event => updateMeta({ accent_color: event.target.value })} /></Field><Field label="Symbole"><input className={inputClass} maxLength={2} value={String(metadata.symbol || '✓')} onChange={event => updateMeta({ symbol: event.target.value })} /></Field><p className="sm:col-span-3 text-xs text-slate-500">Le visuel SVG est généré automatiquement et conservé dans les assets du badge.</p></div> : <><Field label="URL de l’image"><input className={inputClass} value={form.image_url || ''} onChange={event => setForm(current => ({ ...current, image_url: event.target.value }))} placeholder="https://…" /></Field><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold" style={{ borderColor: GOLD, color: GOLD }}><Upload size={15} />{uploading ? 'Téléversement…' : 'Joindre une image'}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} className="hidden" onChange={event => { void uploadImage(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label><p className="text-xs text-slate-500">PNG, JPEG ou WEBP · 5 Mo maximum.</p></>}
        </div>
      </div>
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Sources autorisées"><input className={inputClass} value={form.source_types_text || ''} onChange={event => setForm(current => ({ ...current, source_types_text: event.target.value }))} placeholder="manual, course_certificate" /></Field>
      <Field label="Visibilité par défaut"><select className={inputClass} value={form.default_visibility || 'oga'} onChange={event => setForm(current => ({ ...current, default_visibility: event.target.value as BadgeTemplate['default_visibility'] }))}>{['private','oga','recruiters','structure','public'].map(value => <option key={value}>{value}</option>)}</select></Field>
      <Field label="Statut"><select className={inputClass} value={form.status || 'draft'} onChange={event => setForm(current => ({ ...current, status: event.target.value as BadgeTemplate['status'] }))}>{['draft','pending_validation','active','inactive','archived'].map(value => <option key={value}>{value}</option>)}</select></Field>
      <Field label="Validité en jours"><input type="number" min="1" className={inputClass} value={form.validity_days || ''} onChange={event => setForm(current => ({ ...current, validity_days: event.target.value ? Number(event.target.value) : null }))} /></Field>
    </div>
    {form.automatic_enabled && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-900">Conditions de l’attribution automatique</p><p className="mt-1 text-xs text-amber-800">Laissez un filtre vide pour accepter toutes les formations correspondantes.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="IDs de formations"><input className={inputClass} value={String(metadata.course_ids_text ?? (Array.isArray(metadata.course_ids) ? metadata.course_ids.join(', ') : ''))} onChange={event => updateMeta({ course_ids_text: event.target.value })} placeholder="uuid1, uuid2" /></Field><Field label="Catégories"><input className={inputClass} value={String(metadata.categories_text ?? (Array.isArray(metadata.categories) ? metadata.categories.join(', ') : ''))} onChange={event => updateMeta({ categories_text: event.target.value })} placeholder="Finance, Management" /></Field><Field label="Niveaux"><input className={inputClass} value={String(metadata.levels_text ?? (Array.isArray(metadata.levels) ? metadata.levels.join(', ') : ''))} onChange={event => updateMeta({ levels_text: event.target.value })} placeholder="debutant, avance" /></Field><Field label="Types de certification"><input className={inputClass} value={String(metadata.certification_types_text ?? (Array.isArray(metadata.certification_types) ? metadata.certification_types.join(', ') : ''))} onChange={event => updateMeta({ certification_types_text: event.target.value })} placeholder="cpd, partner" /></Field></div></div>}
    <div className="flex flex-wrap gap-5 text-sm"><Check label="Preuve obligatoire" checked={Boolean(form.evidence_required)} onChange={value => setForm(current => ({ ...current, evidence_required: value }))} /><Check label="Badge interne" checked={Boolean(form.internal_only)} onChange={value => setForm(current => ({ ...current, internal_only: value }))} /><Check label="Attribution automatique après certificat" checked={Boolean(form.automatic_enabled)} onChange={value => setForm(current => ({ ...current, automatic_enabled: value, source_types_text: value && !String(current.source_types_text || '').includes('course_certificate') ? `${current.source_types_text || ''}, course_certificate`.replace(/^,\s*/, '') : current.source_types_text }))} /></div>
    {error && <Message kind="error" text={error} />}<Submit saving={saving || uploading} />
  </form></Modal>;
}

function IssueModal({ templates, onClose, onDone }: { templates: BadgeTemplate[]; onClose: () => void; onDone: (message: string) => void }) { const [form, setForm] = useState({ template_id: '', recipient_email: '', source_type: 'manual', evidence_summary: '', visibility: 'oga', evidence_title: '', evidence_url: '', evidence_public: false }); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(''); try { const evidence = form.evidence_title ? [{ evidence_type: 'other', title: form.evidence_title, url: form.evidence_url || null, is_public: form.evidence_public }] : []; await credentialsRequest('admin_issue_badge', { ...form, evidence }); onDone('Badge attribué et ajouté au Learning Record.'); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Attribution impossible.'); } finally { setSaving(false); } } return <Modal title="Attribuer un badge" onClose={onClose}><form onSubmit={submit} className="space-y-4 p-5"><Field label="Modèle"><select required className={inputClass} value={form.template_id} onChange={event => setForm(current => ({ ...current, template_id: event.target.value }))}><option value="">Sélectionner</option>{templates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}</select></Field><Field label="Email du bénéficiaire"><input required type="email" className={inputClass} value={form.recipient_email} onChange={event => setForm(current => ({ ...current, recipient_email: event.target.value }))} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Source"><select className={inputClass} value={form.source_type} onChange={event => setForm(current => ({ ...current, source_type: event.target.value }))}>{['manual','course','assessment','project','live','coaching','forum','community','structure'].map(value => <option key={value}>{value}</option>)}</select></Field><Field label="Visibilité"><select className={inputClass} value={form.visibility} onChange={event => setForm(current => ({ ...current, visibility: event.target.value }))}>{['private','oga','recruiters','structure','public'].map(value => <option key={value}>{value}</option>)}</select></Field></div><Field label="Résumé de la preuve"><textarea rows={3} className={inputClass} value={form.evidence_summary} onChange={event => setForm(current => ({ ...current, evidence_summary: event.target.value }))} /></Field><div className="rounded-xl border border-slate-200 p-4"><p className="mb-3 text-sm font-semibold" style={{ color: BLUE }}>Preuve détaillée facultative</p><div className="space-y-3"><input className={inputClass} value={form.evidence_title} onChange={event => setForm(current => ({ ...current, evidence_title: event.target.value }))} placeholder="Titre de la preuve" /><input className={inputClass} value={form.evidence_url} onChange={event => setForm(current => ({ ...current, evidence_url: event.target.value }))} placeholder="URL de la preuve" /><Check label="Preuve visible publiquement" checked={form.evidence_public} onChange={value => setForm(current => ({ ...current, evidence_public: value }))} /></div></div>{error && <Message kind="error" text={error} />}<Submit saving={saving} /></form></Modal>; }

function RevokeModal({ award, onClose, onDone }: { award: BadgeAward; onClose: () => void; onDone: (message: string) => void }) { const [reason, setReason] = useState(''); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(''); try { await credentialsRequest('admin_revoke_badge', { award_id: award.id, reason }); onDone('Badge révoqué.'); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Révocation impossible.'); } finally { setSaving(false); } } return <Modal title="Révoquer le badge" onClose={onClose}><form onSubmit={submit} className="space-y-4 p-5"><p className="text-sm text-slate-600">{award.template?.name} — {award.recipient?.full_name}</p><Field label="Motif"><textarea required rows={4} className={inputClass} value={reason} onChange={event => setReason(event.target.value)} /></Field>{error && <Message kind="error" text={error} />}<Submit saving={saving} danger /></form></Modal>; }

function IssuerModal({ draft, onClose, onDone }: { draft: IssuerDraft; onClose: () => void; onDone: (message: string) => void }) { const [form, setForm] = useState(draft); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(''); try { await credentialsRequest('admin_save_issuer', form as Record<string, unknown>); onDone(form.id ? 'Émetteur modifié.' : 'Émetteur créé.'); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Enregistrement impossible.'); } finally { setSaving(false); } } return <Modal title={form.id ? 'Modifier l’émetteur' : 'Nouvel émetteur'} onClose={onClose}><form onSubmit={submit} className="space-y-4 p-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Nom"><input required className={inputClass} value={form.name || ''} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} /></Field><Field label="Type"><select className={inputClass} value={form.issuer_type || 'external'} onChange={event => setForm(current => ({ ...current, issuer_type: event.target.value as CredentialIssuer['issuer_type'] }))}>{['platform','structure','external'].map(value => <option key={value}>{value}</option>)}</select></Field></div><Field label="URI publique de l’émetteur"><input required className={inputClass} value={form.issuer_uri || ''} onChange={event => setForm(current => ({ ...current, issuer_uri: event.target.value }))} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Site web"><input className={inputClass} value={form.website_url || ''} onChange={event => setForm(current => ({ ...current, website_url: event.target.value }))} /></Field><Field label="Email"><input type="email" className={inputClass} value={form.email || ''} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} /></Field><Field label="Logo"><input className={inputClass} value={form.logo_url || ''} onChange={event => setForm(current => ({ ...current, logo_url: event.target.value }))} /></Field><Field label="DID (module signature)"><input className={inputClass} value={form.did || ''} onChange={event => setForm(current => ({ ...current, did: event.target.value }))} /></Field><Field label="Statut"><select className={inputClass} value={form.status || 'draft'} onChange={event => setForm(current => ({ ...current, status: event.target.value as CredentialIssuer['status'] }))}>{['draft','active','suspended','archived'].map(value => <option key={value}>{value}</option>)}</select></Field></div>{error && <Message kind="error" text={error} />}<Submit saving={saving} /></form></Modal>; }

function CategoryModal({ draft, onClose, onDone }: { draft: CategoryDraft; onClose: () => void; onDone: (message: string) => void }) { const [form, setForm] = useState(draft); const [saving, setSaving] = useState(false); async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); await credentialsRequest('admin_save_category', form as Record<string, unknown>); onDone(form.id ? 'Catégorie modifiée.' : 'Catégorie créée.'); } return <Modal title="Catégorie" onClose={onClose}><form onSubmit={submit} className="space-y-4 p-5"><Field label="Nom"><input required className={inputClass} value={form.name || ''} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} /></Field><Field label="Type"><select className={inputClass} value={form.category_type || 'achievement'} onChange={event => setForm(current => ({ ...current, category_type: event.target.value as BadgeCategory['category_type'] }))}>{['skill','achievement','trust','community','internal'].map(value => <option key={value}>{value}</option>)}</select></Field><Field label="Description"><textarea className={inputClass} value={form.description || ''} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} /></Field><Submit saving={saving} /></form></Modal>; }
function LevelModal({ draft, onClose, onDone }: { draft: LevelDraft; onClose: () => void; onDone: (message: string) => void }) { const [form, setForm] = useState(draft); const [saving, setSaving] = useState(false); async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); await credentialsRequest('admin_save_level', form as Record<string, unknown>); onDone(form.id ? 'Niveau modifié.' : 'Niveau créé.'); } return <Modal title="Niveau" onClose={onClose}><form onSubmit={submit} className="space-y-4 p-5"><Field label="Nom"><input required className={inputClass} value={form.name || ''} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Rang"><input type="number" className={inputClass} value={form.rank || 0} onChange={event => setForm(current => ({ ...current, rank: Number(event.target.value) }))} /></Field><Field label="Couleur"><input type="color" className="h-10 w-full rounded-lg border border-slate-200" value={form.color || BLUE} onChange={event => setForm(current => ({ ...current, color: event.target.value }))} /></Field></div><Field label="Description"><textarea className={inputClass} value={form.description || ''} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} /></Field><Submit saving={saving} /></form></Modal>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>{children}</label>; }
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="inline-flex items-center gap-2"><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} /><span>{label}</span></label>; }
function Submit({ saving, danger = false }: { saving: boolean; danger?: boolean }) { return <div className="flex justify-end"><button disabled={saving} className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${danger ? 'bg-red-600' : ''}`} style={danger ? undefined : { background: BLUE }}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button></div>; }
