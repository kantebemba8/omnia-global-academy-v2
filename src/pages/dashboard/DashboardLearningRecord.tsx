import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Award, BadgeCheck, BookOpen, Briefcase, CheckCircle2, ClipboardCheck, Copy, Download,
  Eye, EyeOff, FileCheck2, FolderOpen, GraduationCap, Link2, MessageSquare, Pencil, Plus, Radio,
  RefreshCw, Save, Settings2, ShieldCheck, Star, Trash2, Upload, Users, X,
} from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import {
  ClrAchievement, ClrExportResponse, ClrImport, ClrRecord, ClrShare, ClrVisibility, LearnerClrResponse,
  credentialStatusLabel, credentialsRequest, visibilityLabel,
} from '../../lib/credentialsApi';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

const SECTION_META: Record<string, { label: string; description: string; icon: typeof FileCheck2 }> = {
  formations: { label: 'Formations', description: 'Formations terminées et parcours validés.', icon: BookOpen },
  certificats: { label: 'Certificats', description: 'Certificats Omnia et credentials externes.', icon: GraduationCap },
  competences_verifiees: { label: 'Compétences', description: 'Compétences issues de preuves, évaluations ou projets.', icon: ShieldCheck },
  evaluations: { label: 'Évaluations', description: 'Examens, études de cas et résultats vérifiés.', icon: ClipboardCheck },
  badges: { label: 'Badges', description: 'Open Badges et reconnaissances Omnia.', icon: BadgeCheck },
  coaching: { label: 'Coaching', description: 'Sessions individuelles, collectives et plans d’action.', icon: Users },
  omnia_live: { label: 'Omnia Live', description: 'Événements, ateliers, conférences et attestations.', icon: Radio },
  projets: { label: 'Projets', description: 'Livrables évalués et projets déclarés.', icon: FolderOpen },
  experiences: { label: 'Expériences', description: 'Expériences professionnelles ou associatives déclarées.', icon: Briefcase },
  recommandations: { label: 'Recommandations', description: 'Recommandations de coachs et références externes.', icon: MessageSquare },
  engagement_communautaire: { label: 'Engagement communautaire', description: 'Contributions utiles, distinctes des compétences professionnelles.', icon: Award },
};

const MANUAL_SECTIONS = ['experiences', 'projets', 'recommandations', 'certificats'];
const VISIBILITIES: ClrVisibility[] = ['private', 'oga', 'recruiters', 'structure', 'public'];

type EntryDraft = {
  id?: string;
  section: string;
  title: string;
  description: string;
  issuer_name: string;
  external_url: string;
  started_at: string;
  ended_at: string;
  result_label: string;
  skills_text: string;
  visibility: ClrVisibility;
  is_featured: boolean;
};

const emptyDraft = (): EntryDraft => ({
  section: 'experiences', title: '', description: '', issuer_name: '', external_url: '', started_at: '', ended_at: '',
  result_label: '', skills_text: '', visibility: 'private', is_featured: false,
});

export default function DashboardLearningRecord() {
  const [record, setRecord] = useState<ClrRecord | null>(null);
  const [achievements, setAchievements] = useState<ClrAchievement[]>([]);
  const [shares, setShares] = useState<ClrShare[]>([]);
  const [imports, setImports] = useState<ClrImport[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [newShareUrl, setNewShareUrl] = useState('');
  const [entryDraft, setEntryDraft] = useState<EntryDraft | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedShareSections, setSelectedShareSections] = useState<string[]>([]);

  async function load(action = 'learner_clr', successMessage = '') {
    setLoading(true); setError('');
    try {
      const response = await credentialsRequest<LearnerClrResponse>(action);
      setRecord(response.record);
      setAchievements(response.achievements || []);
      setShares(response.shares || []);
      setImports(response.imports || []);
      const visibleSections = (response.record.section_order || response.sections || []).filter(section => !(response.record.hidden_sections || []).includes(section));
      setSelectedShareSections(current => current.length ? current.filter(section => visibleSections.includes(section)) : visibleSections);
      if (successMessage) setNotice(successMessage);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Learning Record indisponible.');
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const orderedSections = useMemo(() => {
    const grouped = new Map<string, ClrAchievement[]>();
    for (const achievement of achievements) grouped.set(achievement.section, [...(grouped.get(achievement.section) || []), achievement]);
    const order = record?.section_order?.length ? record.section_order : Object.keys(SECTION_META);
    const keys = [...order, ...[...grouped.keys()].filter(section => !order.includes(section))];
    return keys
      .filter(section => !(record?.hidden_sections || []).includes(section))
      .map(section => [section, grouped.get(section) || []] as const)
      .filter(([, items]) => items.length > 0);
  }, [achievements, record]);

  const metrics = useMemo(() => ({
    total: achievements.filter(item => item.status !== 'hidden').length,
    verified: achievements.filter(item => item.status !== 'hidden' && item.verification_status === 'verified').length,
    skills: new Set(achievements.flatMap(item => item.skills || [])).size,
    pending: achievements.filter(item => item.verification_status === 'pending_review').length,
  }), [achievements]);

  async function run(label: string, action: string, payload: Record<string, unknown>, success: string, reload = true) {
    setWorking(label); setError(''); setNotice('');
    try {
      await credentialsRequest(action, payload);
      if (reload) await load('learner_clr');
      setNotice(success);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Opération impossible.'); }
    finally { setWorking(''); }
  }

  async function createShare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setWorking('share'); setError(''); setNewShareUrl('');
    const form = new FormData(event.currentTarget);
    try {
      const response = await credentialsRequest<{ success: true; share: ClrShare & { url: string } }>('learner_create_clr_share', {
        label: String(form.get('label') || ''),
        validity_days: Number(form.get('validity_days') || 30),
        visibility_filter: String(form.get('visibility_filter') || 'public'),
        include_sections: selectedShareSections,
      });
      setNewShareUrl(response.share.url || '');
      setShares(current => [response.share, ...current]);
      event.currentTarget.reset();
      setNotice('Lien de partage créé.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Création du partage impossible.'); }
    finally { setWorking(''); }
  }

  async function exportRecord(format: 'clr_json' | 'vc_jwt') {
    setWorking(`export-${format}`); setError(''); setNotice('');
    try {
      const response = await credentialsRequest<ClrExportResponse>('learner_export_clr', { format });
      const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content, null, 2);
      const blob = new Blob([content], { type: response.media_type });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = response.file_name; link.click();
      URL.revokeObjectURL(url);
      setRecord(response.record);
      setNotice(format === 'vc_jwt' ? 'CLR 2.0 signé et exporté.' : 'Learning Record exporté en JSON-LD.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Export impossible.'); }
    finally { setWorking(''); }
  }

  function editEntry(item: ClrAchievement) {
    setEntryDraft({
      id: item.id,
      section: item.section,
      title: item.title,
      description: item.description || '',
      issuer_name: item.issuer_name || '',
      external_url: item.external_url || '',
      started_at: toDateInput(item.started_at),
      ended_at: toDateInput(item.ended_at),
      result_label: item.result_label || '',
      skills_text: (item.skills || []).join(', '),
      visibility: item.visibility,
      is_featured: item.is_featured,
    });
  }

  return <DashboardLayout><div className="mx-auto max-w-7xl px-4 py-7 md:px-6">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-5" style={{ borderColor: BORDER }}>
      <div>
        <span className="text-xs font-semibold uppercase tracking-[.16em]" style={{ color: GOLD }}>CLR 2.0</span>
        <h1 className="mt-1 text-2xl font-semibold" style={{ color: BLUE }}>Omnia Learning Record</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">Votre dossier portable de formations, compétences, badges, certificats, coaching, projets, expériences et recommandations.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button disabled={Boolean(working)} onClick={() => void load('learner_sync_clr', 'Toutes les sources Omnia ont été synchronisées.')} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50" style={{ borderColor: BORDER, color: BLUE }}><RefreshCw size={15} className={working ? 'animate-spin' : ''} /> Synchroniser</button>
        <button disabled={Boolean(working)} onClick={() => void exportRecord('clr_json')} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50" style={{ borderColor: GOLD, color: GOLD }}><Download size={15} /> JSON-LD</button>
        <button disabled={Boolean(working)} onClick={() => void exportRecord('vc_jwt')} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BLUE }}><ShieldCheck size={15} /> Export signé</button>
      </div>
    </header>

    {error && <Message kind="error" text={humanError(error)} />}
    {notice && <Message kind="success" text={notice} onClose={() => setNotice('')} />}

    {loading ? <div className="py-24 text-center text-sm text-slate-500">Chargement du Learning Record…</div> : <>
      <section className="mt-6 overflow-hidden rounded-2xl border bg-white" style={{ borderColor: BORDER }}>
        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex items-start gap-4">
            <span className="rounded-xl bg-amber-50 p-3" style={{ color: GOLD }}><FileCheck2 size={25} /></span>
            <div>
              <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold" style={{ color: BLUE }}>{record?.title || 'Omnia Learning Record'}</h2><StandardStatus record={record} /></div>
              <p className="mt-1 text-sm font-medium text-slate-700">{record?.profile_headline || 'Votre parcours vérifié, sous votre contrôle.'}</p>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">{record?.summary || record?.description || 'Le dossier se complète automatiquement avec vos réalisations Omnia.'}</p>
              <p className="mt-3 text-xs text-slate-400">Version {record?.version || 1} · dernière synchronisation {record?.last_synced_at ? new Date(record.last_synced_at).toLocaleString('fr-FR') : 'non effectuée'}</p>
            </div>
          </div>
          <button onClick={() => setProfileOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold" style={{ borderColor: BORDER, color: BLUE }}><Settings2 size={15} /> Personnaliser</button>
        </div>
        <div className="grid grid-cols-2 border-t md:grid-cols-4" style={{ borderColor: BORDER }}>
          <Metric label="Éléments" value={metrics.total} />
          <Metric label="Vérifiés" value={metrics.verified} />
          <Metric label="Compétences" value={metrics.skills} />
          <Metric label="À contrôler" value={metrics.pending} warning={metrics.pending > 0} />
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-lg font-semibold" style={{ color: BLUE }}>Mon parcours</h2><p className="text-sm text-slate-500">Les données Omnia sont vérifiées. Les ajouts personnels restent clairement identifiés comme déclarés.</p></div>
            <button onClick={() => setEntryDraft(emptyDraft())} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ background: BLUE }}><Plus size={15} /> Ajouter une expérience</button>
          </div>

          {orderedSections.map(([section, items]) => <ClrSection key={section} section={section} items={items} working={working} onEdit={editEntry} onAction={(label, action, payload, success) => void run(label, action, payload, success)} />)}

          {orderedSections.length === 0 && <div className="rounded-2xl border bg-white p-12 text-center" style={{ borderColor: BORDER }}><FileCheck2 className="mx-auto h-12 w-12 text-slate-200" /><p className="mt-4 font-semibold" style={{ color: BLUE }}>Votre dossier est prêt</p><p className="mt-1 text-sm text-slate-500">Terminez une formation ou ajoutez une expérience pour commencer.</p></div>}
        </main>

        <aside className="space-y-6">
          <section className="rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}>
            <div className="flex items-center justify-between"><div><h2 className="font-semibold" style={{ color: BLUE }}>Partager mon CLR</h2><p className="mt-1 text-xs text-slate-500">Choisissez précisément les sections visibles.</p></div><Link2 color={GOLD} /></div>
            <form onSubmit={createShare} className="mt-4 space-y-3">
              <input name="label" className={inputClass} placeholder="Ex. Candidature entreprise" />
              <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border p-2" style={{ borderColor: BORDER }}>
                {(record?.section_order || Object.keys(SECTION_META)).filter(section => !(record?.hidden_sections || []).includes(section)).map(section => <label key={section} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"><input type="checkbox" checked={selectedShareSections.includes(section)} onChange={event => setSelectedShareSections(current => event.target.checked ? [...new Set([...current, section])] : current.filter(item => item !== section))} /><span>{SECTION_META[section]?.label || section}</span></label>)}
              </div>
              <select name="visibility_filter" className={inputClass} defaultValue="public"><option value="public">Uniquement les éléments publics</option><option value="recruiters">Publics + recruteurs</option><option value="oga">Publics + OGA</option><option value="structure">Publics + Structure</option></select>
              <select name="validity_days" defaultValue="30" className={inputClass}><option value="7">7 jours</option><option value="30">30 jours</option><option value="90">90 jours</option><option value="365">1 an</option></select>
              <button disabled={working === 'share' || selectedShareSections.length === 0} className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BLUE }}><Link2 size={15} /> {working === 'share' ? 'Création…' : 'Créer le lien'}</button>
            </form>
            {newShareUrl && <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-700"><p className="font-semibold">Lien créé</p><button onClick={() => void navigator.clipboard?.writeText(newShareUrl)} className="mt-2 inline-flex items-start gap-2 break-all text-left underline"><Copy size={14} className="mt-0.5 shrink-0" />{newShareUrl}</button></div>}
          </section>

          <section className="rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}>
            <div className="flex items-center justify-between"><div><h2 className="font-semibold" style={{ color: BLUE }}>Importer un credential</h2><p className="mt-1 text-xs text-slate-500">CLR 2.0, Open Badge ou VC-JWT.</p></div><Upload color={GOLD} /></div>
            <button onClick={() => setImportOpen(true)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold" style={{ borderColor: GOLD, color: GOLD }}><Upload size={15} /> Importer</button>
            <div className="mt-4 space-y-3">{imports.slice(0, 5).map(item => <div key={item.id} className="rounded-xl border p-3" style={{ borderColor: BORDER }}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold" style={{ color: BLUE }}>{item.source_file_name || item.source_issuer || 'Credential importé'}</p><p className="mt-1 text-xs text-slate-500">{item.imported_entries_count} élément(s) · {new Date(item.created_at).toLocaleDateString('fr-FR')}</p></div><SmallStatus value={item.status} /></div>{item.review_note && <p className="mt-2 text-xs text-slate-500">{item.review_note}</p>}</div>)}{imports.length === 0 && <p className="text-sm text-slate-500">Aucun import.</p>}</div>
          </section>

          <section className="rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}><h2 className="font-semibold" style={{ color: BLUE }}>Liens actifs</h2><div className="mt-3 space-y-3">{shares.map(share => <div key={share.id} className="rounded-xl border p-3" style={{ borderColor: BORDER }}><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold" style={{ color: BLUE }}>{share.label || 'Partage CLR'}</p><p className="mt-1 text-xs text-slate-500">{share.revoked_at ? 'Révoqué' : share.expires_at ? `Expire le ${new Date(share.expires_at).toLocaleDateString('fr-FR')}` : 'Sans expiration'}</p><p className="mt-1 text-xs text-slate-400">{share.include_sections.length} section(s)</p></div>{!share.revoked_at && <button title="Révoquer" onClick={() => void run(`revoke-${share.id}`, 'learner_revoke_clr_share', { share_id: share.id }, 'Lien révoqué.')} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 size={15} /></button>}</div></div>)}{shares.length === 0 && <p className="text-sm text-slate-500">Aucun lien créé.</p>}</div></section>
        </aside>
      </div>
    </>}

    {entryDraft && <EntryModal draft={entryDraft} onClose={() => setEntryDraft(null)} onSaved={async () => { setEntryDraft(null); await load(); setNotice('Élément enregistré dans votre Learning Record.'); }} />}
    {profileOpen && record && <ProfileModal record={record} onClose={() => setProfileOpen(false)} onSaved={async () => { setProfileOpen(false); await load(); setNotice('Présentation du Learning Record mise à jour.'); }} />}
    {importOpen && <ImportModal onClose={() => setImportOpen(false)} onImported={async () => { setImportOpen(false); await load(); setNotice('Credential importé. Les sources externes non vérifiables restent en attente de contrôle.'); }} />}
  </div></DashboardLayout>;
}

function ClrSection({ section, items, working, onEdit, onAction }: { section: string; items: ClrAchievement[]; working: string; onEdit: (item: ClrAchievement) => void; onAction: (label: string, action: string, payload: Record<string, unknown>, success: string) => void }) {
  const meta = SECTION_META[section] || { label: section.replaceAll('_', ' '), description: '', icon: FileCheck2 };
  const Icon = meta.icon;
  return <section className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: BORDER }}>
    <div className="flex items-start gap-3 border-b p-4" style={{ borderColor: BORDER }}><span className="rounded-lg bg-slate-50 p-2" style={{ color: GOLD }}><Icon size={19} /></span><div><h3 className="font-semibold" style={{ color: BLUE }}>{meta.label}</h3><p className="text-xs text-slate-500">{meta.description}</p></div><span className="ml-auto rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{items.length}</span></div>
    <div className="divide-y" style={{ borderColor: BORDER }}>{items.map(item => <article key={item.id} className={`p-4 ${item.status === 'hidden' ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold" style={{ color: BLUE }}>{item.title}</h4>{item.is_featured && <Star size={15} fill={GOLD} color={GOLD} />}<VerificationStatus value={item.verification_status} /></div>
          <p className="mt-1 text-sm text-slate-500">{item.description || item.result_label || item.achievement_type}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
            {item.issuer_name && <span>{item.issuer_name}</span>}
            {(item.started_at || item.ended_at || item.issued_at) && <span>{dateRange(item)}</span>}
            {item.score !== null && item.score !== undefined && <span>Résultat : {item.score}{item.score_max ? `/${item.score_max}` : ''}</span>}
            {item.result_label && <span>{item.result_label}</span>}
          </div>
          {item.skills?.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{item.skills.slice(0, 8).map(skill => <span key={skill} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium" style={{ color: BLUE }}>{skill}</span>)}</div>}
        </div>
        <div className="flex items-center gap-1">
          <select aria-label="Visibilité" value={item.visibility} disabled={Boolean(working)} onChange={event => onAction(`visibility-${item.id}`, 'learner_update_clr_entry', { entry_id: item.id, visibility: event.target.value }, 'Visibilité mise à jour.')} className="max-w-[150px] rounded-lg border px-2 py-1.5 text-xs" style={{ borderColor: BORDER }}>{VISIBILITIES.map(value => <option key={value} value={value}>{visibilityLabel[value]}</option>)}</select>
          <button title={item.is_featured ? 'Retirer de la sélection' : 'Mettre en avant'} disabled={Boolean(working)} onClick={() => onAction(`feature-${item.id}`, 'learner_update_clr_entry', { entry_id: item.id, is_featured: !item.is_featured }, item.is_featured ? 'Élément retiré de la sélection.' : 'Élément mis en avant.')} className="rounded-lg p-2 hover:bg-slate-100"><Star size={15} color={item.is_featured ? GOLD : '#64748B'} fill={item.is_featured ? GOLD : 'none'} /></button>
          <button title={item.status === 'hidden' ? 'Afficher' : 'Masquer'} disabled={Boolean(working)} onClick={() => onAction(`hide-${item.id}`, 'learner_update_clr_entry', { entry_id: item.id, hidden: item.status !== 'hidden' }, item.status === 'hidden' ? 'Élément affiché.' : 'Élément masqué.')} className="rounded-lg p-2 hover:bg-slate-100">{item.status === 'hidden' ? <Eye size={15} /> : <EyeOff size={15} />}</button>
          {item.learner_editable && item.entry_origin === 'manual' && <button title="Modifier" onClick={() => onEdit(item)} className="rounded-lg p-2 hover:bg-slate-100"><Pencil size={15} /></button>}
          {item.learner_editable && <button title="Supprimer" disabled={Boolean(working)} onClick={() => onAction(`delete-${item.id}`, 'learner_delete_clr_entry', { entry_id: item.id }, 'Élément supprimé.')} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 size={15} /></button>}
        </div>
      </div>
    </article>)}</div>
  </section>;
}

function EntryModal({ draft, onClose, onSaved }: { draft: EntryDraft; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(draft); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(''); try { await credentialsRequest('learner_save_clr_entry', { ...form, skills: form.skills_text.split(',').map(value => value.trim()).filter(Boolean), started_at: form.started_at || null, ended_at: form.ended_at || null }); onSaved(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Enregistrement impossible.'); } finally { setSaving(false); } }
  return <Modal title={form.id ? 'Modifier l’élément' : 'Ajouter au Learning Record'} onClose={onClose}><form onSubmit={submit} className="space-y-4 p-5">
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Les éléments ajoutés manuellement sont marqués « Déclaré ». Ils ne deviennent pas automatiquement des compétences vérifiées.</div>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Section"><select className={inputClass} value={form.section} onChange={event => setForm(current => ({ ...current, section: event.target.value }))}>{MANUAL_SECTIONS.map(value => <option key={value} value={value}>{SECTION_META[value]?.label}</option>)}</select></Field><Field label="Visibilité"><select className={inputClass} value={form.visibility} onChange={event => setForm(current => ({ ...current, visibility: event.target.value as ClrVisibility }))}>{VISIBILITIES.map(value => <option key={value} value={value}>{visibilityLabel[value]}</option>)}</select></Field></div>
    <Field label="Titre"><input required className={inputClass} value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} /></Field>
    <Field label="Description"><textarea rows={4} className={inputClass} value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} /></Field>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Organisation ou émetteur"><input className={inputClass} value={form.issuer_name} onChange={event => setForm(current => ({ ...current, issuer_name: event.target.value }))} /></Field><Field label="Lien de preuve"><input type="url" className={inputClass} value={form.external_url} onChange={event => setForm(current => ({ ...current, external_url: event.target.value }))} placeholder="https://…" /></Field><Field label="Début"><input type="date" className={inputClass} value={form.started_at} onChange={event => setForm(current => ({ ...current, started_at: event.target.value }))} /></Field><Field label="Fin"><input type="date" className={inputClass} value={form.ended_at} onChange={event => setForm(current => ({ ...current, ended_at: event.target.value }))} /></Field></div>
    <Field label="Résultat ou contexte"><input className={inputClass} value={form.result_label} onChange={event => setForm(current => ({ ...current, result_label: event.target.value }))} placeholder="Ex. Stage de 6 mois, projet livré…" /></Field>
    <Field label="Compétences associées"><input className={inputClass} value={form.skills_text} onChange={event => setForm(current => ({ ...current, skills_text: event.target.value }))} placeholder="Gestion de projet, analyse, communication" /></Field>
    <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_featured} onChange={event => setForm(current => ({ ...current, is_featured: event.target.checked }))} /> Mettre cet élément en avant</label>
    {error && <Message kind="error" text={humanError(error)} />}<div className="flex justify-end"><button disabled={saving} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BLUE }}><Save size={15} />{saving ? 'Enregistrement…' : 'Enregistrer'}</button></div>
  </form></Modal>;
}

function ProfileModal({ record, onClose, onSaved }: { record: ClrRecord; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ title: record.title, description: record.description || '', profile_headline: record.profile_headline || '', summary: record.summary || '', language_code: record.language_code || 'fr', default_visibility: record.default_visibility, hidden_sections: record.hidden_sections || [] });
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(''); try { await credentialsRequest('learner_update_clr_profile', { ...form, section_order: record.section_order }); onSaved(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Mise à jour impossible.'); } finally { setSaving(false); } }
  return <Modal title="Personnaliser mon Learning Record" onClose={onClose}><form onSubmit={submit} className="space-y-4 p-5"><Field label="Titre du dossier"><input required className={inputClass} value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} /></Field><Field label="Accroche professionnelle"><input className={inputClass} value={form.profile_headline} onChange={event => setForm(current => ({ ...current, profile_headline: event.target.value }))} placeholder="Ex. Professionnel QSE orienté développement durable" /></Field><Field label="Présentation"><textarea rows={5} className={inputClass} value={form.summary} onChange={event => setForm(current => ({ ...current, summary: event.target.value }))} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Langue"><select className={inputClass} value={form.language_code} onChange={event => setForm(current => ({ ...current, language_code: event.target.value }))}><option value="fr">Français</option><option value="en">English</option><option value="es">Español</option></select></Field><Field label="Visibilité par défaut"><select className={inputClass} value={form.default_visibility} onChange={event => setForm(current => ({ ...current, default_visibility: event.target.value as ClrVisibility }))}>{VISIBILITIES.map(value => <option key={value} value={value}>{visibilityLabel[value]}</option>)}</select></Field></div><Field label="Sections affichées"><div className="grid gap-2 rounded-xl border p-3 sm:grid-cols-2" style={{ borderColor: BORDER }}>{record.section_order.map(section => { const hidden = form.hidden_sections.includes(section); return <label key={section} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!hidden} onChange={event => setForm(current => ({ ...current, hidden_sections: event.target.checked ? current.hidden_sections.filter(item => item !== section) : [...current.hidden_sections, section] }))} />{SECTION_META[section]?.label || section}</label>; })}</div></Field>{error && <Message kind="error" text={humanError(error)} />}<div className="flex justify-end"><button disabled={saving} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BLUE }}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button></div></form></Modal>;
}

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [format, setFormat] = useState<'json' | 'json_ld' | 'vc_jwt'>('json_ld'); const [content, setContent] = useState(''); const [fileName, setFileName] = useState(''); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  async function fileChanged(file?: File) { if (!file) return; setFileName(file.name); setContent(await file.text()); if (file.name.endsWith('.jwt') || file.name.endsWith('.jws')) setFormat('vc_jwt'); else setFormat('json_ld'); }
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(''); try { await credentialsRequest('learner_import_clr', { source_format: format, source_file_name: fileName || null, content }); onImported(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Import impossible.'); } finally { setSaving(false); } }
  return <Modal title="Importer un CLR ou un Open Badge" onClose={onClose}><form onSubmit={submit} className="space-y-4 p-5"><div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs" style={{ color: BLUE }}>Le payload original est conservé. Un credential signé avec une clé inconnue est importé en attente de validation Super Admin.</div><div className="grid gap-4 sm:grid-cols-2"><Field label="Format"><select className={inputClass} value={format} onChange={event => setFormat(event.target.value as typeof format)}><option value="json_ld">JSON-LD</option><option value="json">JSON</option><option value="vc_jwt">VC-JWT/JWS</option></select></Field><Field label="Fichier"><input type="file" accept=".json,.jsonld,.jwt,.jws,application/json,text/plain" className={inputClass} onChange={event => void fileChanged(event.target.files?.[0])} /></Field></div><Field label="Contenu"><textarea required rows={12} className={`${inputClass} font-mono text-xs`} value={content} onChange={event => setContent(event.target.value)} placeholder="Collez ici le JSON-LD ou le VC-JWT…" /></Field>{error && <Message kind="error" text={humanError(error)} />}<div className="flex justify-end"><button disabled={saving || !content.trim()} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BLUE }}><Upload size={15} />{saving ? 'Import…' : 'Importer'}</button></div></form></Modal>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-4"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-5" style={{ borderColor: BORDER }}><h2 className="font-semibold" style={{ color: BLUE }}>{title}</h2><button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100"><X size={18} /></button></div>{children}</div></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>{children}</label>; }
function Message({ kind, text, onClose }: { kind: 'error' | 'success'; text: string; onClose?: () => void }) { return <div className={`mt-5 flex items-start justify-between gap-3 rounded-xl border p-4 text-sm ${kind === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}><span>{text}</span>{onClose && <button onClick={onClose}><X size={15} /></button>}</div>; }
function Metric({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) { return <div className="border-r p-4 last:border-r-0" style={{ borderColor: BORDER }}><p className="text-xs text-slate-500">{label}</p><p className={`mt-1 text-xl font-semibold ${warning ? 'text-amber-700' : ''}`} style={warning ? undefined : { color: BLUE }}>{value}</p></div>; }
function SmallStatus({ value }: { value: string }) { const good = ['imported', 'verified', 'active'].includes(value); const bad = ['rejected', 'failed', 'revoked'].includes(value); return <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${good ? 'bg-green-50 text-green-700' : bad ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{credentialStatusLabel(value)}</span>; }
function VerificationStatus({ value }: { value: ClrAchievement['verification_status'] }) { return value === 'verified' ? <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-[11px] font-semibold text-green-700"><CheckCircle2 size={12} /> Vérifié</span> : value === 'pending_review' ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700"><AlertTriangle size={12} /> À vérifier</span> : <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">{credentialStatusLabel(value)}</span>; }
function StandardStatus({ record }: { record: ClrRecord | null }) { const signed = record?.standards_status === 'clr2_signed'; return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${signed ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>{signed ? <ShieldCheck size={13} /> : <FileCheck2 size={13} />}{signed ? 'CLR 2.0 signé' : 'CLR 2.0 prêt'}</span>; }
function dateRange(item: ClrAchievement) { const start = item.started_at || item.issued_at; const end = item.ended_at; if (!start) return ''; const startLabel = new Date(start).toLocaleDateString('fr-FR'); if (!end || end === start) return startLabel; return `${startLabel} – ${new Date(end).toLocaleDateString('fr-FR')}`; }
function toDateInput(value?: string | null) { return value ? String(value).slice(0, 10) : ''; }
function humanError(value: string) { return ({ CLR_NOT_SIGNED: 'Le Learning Record doit d’abord être signé.', SIGNING_NOT_CONFIGURED: 'La clé de signature Supabase n’est pas configurée.', CLR_IMPORT_ALREADY_EXISTS: 'Ce credential a déjà été importé.', CLR_IMPORT_INVALID_JSON: 'Le contenu JSON est invalide.', CLR_IMPORT_CREDENTIAL_TYPE_UNSUPPORTED: 'Ce type de credential n’est pas pris en charge.', CLR_ENTRY_NOT_DELETABLE: 'Cet élément vérifié ne peut pas être supprimé.', CLR_SECTION_NOT_EDITABLE: 'Cette section est alimentée automatiquement par Omnia.' } as Record<string, string>)[value] || value; }
const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400';
