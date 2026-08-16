import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, BadgeCheck, Briefcase, CheckCircle2, Copy, Download,
  Globe2, Languages, Link2, MapPin, RefreshCw, Save, ShieldCheck, Sparkles, Star, Target,
  Trash2, UploadCloud, X,
} from 'lucide-react';
import { LearnerFormationsLayout } from '../../components/formations/FormationsRoleLayout';
import { isLearnerPreviewMode, previewSkillsPassport, withLearnerPreview } from '../../lib/learnerPreview';
import {
  ClrAchievement, CredentialVerification, LearnerSkillsPassportResponse, SkillsPassport,
  SkillsPassportExportResponse, SkillsPassportShare, credentialStatusLabel,
  credentialsRequest,
} from '../../lib/credentialsApi';
import { isNativeApp, saveOrShareText } from '../../lib/mobile';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

const SECTION_LABELS: Record<string, string> = {
  competences_verifiees: 'Compétences',
  certificats: 'Certificats',
  badges: 'Badges',
  evaluations: 'Évaluations',
  projets: 'Projets',
  experiences: 'Expériences',
  recommandations: 'Recommandations',
};

type SelectionDraft = {
  achievement_id: string;
  display_order: number;
  is_featured: boolean;
};

export default function DashboardSkillsPassport() {
  const [passport, setPassport] = useState<SkillsPassport | null>(null);
  const [candidates, setCandidates] = useState<ClrAchievement[]>([]);
  const [shares, setShares] = useState<SkillsPassportShare[]>([]);
  const [selected, setSelected] = useState<Map<string, SelectionDraft>>(new Map());
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [newShareUrl, setNewShareUrl] = useState('');
  const [verification, setVerification] = useState<CredentialVerification | null>(null);
  const previewMode = isLearnerPreviewMode();

  async function load(message = '') {
    setLoading(true); setError('');
    if (previewMode) {
      setPassport(previewSkillsPassport()); setCandidates([]); setShares([]); setSelected(new Map()); setVerification(null);
      setLoading(false); if (message) setNotice(message); return;
    }
    try {
      const response = await credentialsRequest<LearnerSkillsPassportResponse>('learner_skills_passport');
      setPassport(response.passport);
      setCandidates(response.candidates || []);
      setShares(response.shares || []);
      setSelected(new Map((response.items || []).map((item, index) => [item.clr_achievement_id, {
        achievement_id: item.clr_achievement_id,
        display_order: item.display_order ?? index,
        is_featured: Boolean(item.is_featured),
      }])));
      const currentVerification = response.passport.verification_result as CredentialVerification | undefined;
      setVerification(currentVerification?.checked_at ? currentVerification : null);
      if (message) setNotice(message);
    } catch (cause) {
      setError(cause instanceof Error ? humanError(cause.message) : 'Skills Passport indisponible.');
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const groupedCandidates = useMemo(() => {
    const groups = new Map<string, ClrAchievement[]>();
    for (const candidate of candidates) groups.set(candidate.section, [...(groups.get(candidate.section) || []), candidate]);
    return Object.entries(SECTION_LABELS).map(([section, label]) => ({ section, label, items: groups.get(section) || [] })).filter(group => group.items.length);
  }, [candidates]);

  const metrics = useMemo(() => ({
    selected: selected.size,
    verified: candidates.filter(item => selected.has(item.id) && item.verification_status === 'verified').length,
    skills: new Set(candidates.filter(item => selected.has(item.id)).flatMap(item => item.skills || [])).size,
    shares: shares.filter(share => !share.revoked_at && (!share.expires_at || new Date(share.expires_at) > new Date())).length,
  }), [candidates, selected, shares]);

  function toggleCandidate(candidate: ClrAchievement) {
    setSelected(current => {
      const next = new Map(current);
      if (next.has(candidate.id)) next.delete(candidate.id);
      else next.set(candidate.id, { achievement_id: candidate.id, display_order: next.size, is_featured: false });
      return next;
    });
  }

  function toggleFeatured(id: string) {
    setSelected(current => {
      const next = new Map(current);
      const item = next.get(id);
      if (item) next.set(id, { ...item, is_featured: !item.is_featured });
      return next;
    });
  }

  async function saveSelection() {
    setWorking('items'); setError(''); setNotice('');
    if (previewMode) { setNotice('Aperçu uniquement : aucune sélection n’a été enregistrée.'); setWorking(''); return; }
    try {
      await credentialsRequest('learner_update_skills_passport_items', { items: [...selected.values()] });
      await load('Sélection du Skills Passport enregistrée.');
    } catch (cause) { setError(humanError(cause instanceof Error ? cause.message : 'Enregistrement impossible.')); }
    finally { setWorking(''); }
  }

  async function publish() {
    setWorking('publish'); setError(''); setNotice('');
    if (previewMode) { setNotice('Aperçu uniquement : aucun passeport n’a été publié.'); setWorking(''); return; }
    try {
      const response = await credentialsRequest<{ success: true; passport: SkillsPassport; jwt: string }>('learner_publish_skills_passport');
      setPassport(response.passport);
      setVerification(response.passport.verification_result as CredentialVerification);
      setNotice('Skills Passport publié et signé.');
    } catch (cause) { setError(humanError(cause instanceof Error ? cause.message : 'Publication impossible.')); }
    finally { setWorking(''); }
  }

  async function verifyPassport() {
    setWorking('verify'); setError(''); setNotice('');
    if (previewMode) { setNotice('Aperçu uniquement : aucun passeport réel n’est disponible à vérifier.'); setWorking(''); return; }
    try {
      const response = await credentialsRequest<{ success: true; verification: CredentialVerification }>('learner_verify_skills_passport');
      setVerification(response.verification);
      setNotice(response.verification.overall_valid ? 'Signature et contenu vérifiés.' : 'La vérification a détecté une anomalie.');
    } catch (cause) { setError(humanError(cause instanceof Error ? cause.message : 'Vérification impossible.')); }
    finally { setWorking(''); }
  }

  async function exportPassport(format: 'passport_json' | 'vc_jwt') {
    setWorking(`export-${format}`); setError(''); setNotice('');
    if (previewMode) { setNotice('Aperçu uniquement : aucun fichier n’a été généré.'); setWorking(''); return; }
    try {
      const response = await credentialsRequest<SkillsPassportExportResponse>('learner_export_skills_passport', { format });
      const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content, null, 2);
      await saveOrShareText(content, {
        fileName: response.file_name,
        mimeType: response.media_type,
        title: format === 'vc_jwt' ? 'Skills Passport signé' : 'Skills Passport JSON-LD',
      });
      setPassport(response.passport);
      setNotice(isNativeApp()
        ? 'Skills Passport prêt à enregistrer ou partager.'
        : format === 'vc_jwt' ? 'Passeport signé exporté.' : 'Passeport JSON-LD exporté.');
    } catch (cause) { setError(humanError(cause instanceof Error ? cause.message : 'Export impossible.')); }
    finally { setWorking(''); }
  }

  async function createShare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setWorking('share'); setError(''); setNotice(''); setNewShareUrl('');
    if (previewMode) { setNotice('Aperçu uniquement : aucun lien n’a été créé.'); setWorking(''); return; }
    const form = new FormData(event.currentTarget);
    try {
      const response = await credentialsRequest<{ success: true; share: SkillsPassportShare & { url: string } }>('learner_create_skills_passport_share', {
        label: String(form.get('label') || ''),
        validity_days: Number(form.get('validity_days') || 30),
        max_views: Number(form.get('max_views') || 0) || null,
      });
      setNewShareUrl(response.share.url || '');
      setShares(current => [response.share, ...current]);
      event.currentTarget.reset();
      setNotice('Lien professionnel créé.');
    } catch (cause) { setError(humanError(cause instanceof Error ? cause.message : 'Création du lien impossible.')); }
    finally { setWorking(''); }
  }

  async function revokeShare(id: string) {
    setWorking(`revoke-${id}`); setError('');
    if (previewMode) { setNotice('Aperçu uniquement : aucun lien n’a été modifié.'); setWorking(''); return; }
    try {
      await credentialsRequest('learner_revoke_skills_passport_share', { share_id: id });
      await load('Lien révoqué.');
    } catch (cause) { setError(humanError(cause instanceof Error ? cause.message : 'Révocation impossible.')); }
    finally { setWorking(''); }
  }

  return <LearnerFormationsLayout><div className="mx-auto max-w-7xl px-4 py-7 md:px-6">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-5" style={{ borderColor: BORDER }}>
      <div>
        <Link to={withLearnerPreview('/dashboard/learning-record')} className="mb-3 inline-flex items-center gap-2 text-sm font-semibold" style={{ color: BLUE }}><ArrowLeft size={16} /> Learning Record</Link>
        <div className="text-xs font-semibold uppercase tracking-[.18em]" style={{ color: GOLD }}>Omnia Skills Passport</div>
        <h1 className="mt-1 text-2xl font-semibold" style={{ color: BLUE }}>{passport?.title || 'Passeport professionnel'}</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">Sélectionnez les preuves de compétences que vous souhaitez présenter aux recruteurs et Structures.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => void load()} className={secondaryButton}><RefreshCw size={15} /> Actualiser</button>
        <Link to={withLearnerPreview('/home?section=profil&tab=professionnel')} className={secondaryButton}><Briefcase size={15} /> Profil professionnel</Link>
        <button disabled={working === 'publish' || selected.size === 0} onClick={() => void publish()} className={primaryButton}><UploadCloud size={15} /> {working === 'publish' ? 'Publication…' : 'Publier et signer'}</button>
      </div>
    </header>

    {error && <Message kind="error" text={error} onClose={() => setError('')} />}
    {notice && <Message kind="success" text={notice} onClose={() => setNotice('')} />}

    {loading ? <div className="py-24 text-center text-sm text-slate-500">Chargement du Skills Passport…</div> : <>
      <section className="mt-6 grid overflow-hidden rounded-xl border bg-white sm:grid-cols-4" style={{ borderColor: BORDER }}>
        <Metric label="Éléments sélectionnés" value={metrics.selected} />
        <Metric label="Éléments vérifiés" value={metrics.verified} />
        <Metric label="Compétences distinctes" value={metrics.skills} />
        <Metric label="Liens actifs" value={metrics.shares} />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-xl border bg-white p-5" style={{ borderColor: BORDER }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="font-semibold" style={{ color: BLUE }}>Présentation professionnelle</h2><p className="mt-1 text-sm text-slate-500">Version {passport?.version || 1} · {credentialStatusLabel(passport?.status || 'draft')}</p></div>
            <PassportStatus passport={passport} verification={verification} />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Info icon={Target} label="Objectifs" value={(passport?.target_roles || []).join(' · ') || 'Non renseignés'} />
            <Info icon={Languages} label="Langues" value={(passport?.languages || []).join(' · ') || 'Non renseignées'} />
            <Info icon={MapPin} label="Localisation" value={passport?.location_text || 'Non renseignée'} />
            <Info icon={Globe2} label="Disponibilité" value={passport?.availability_text || 'Non renseignée'} />
          </div>
          {passport?.professional_headline && <p className="mt-5 text-lg font-semibold" style={{ color: BLUE }}>{passport.professional_headline}</p>}
          {passport?.professional_summary && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{passport.professional_summary}</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={() => void exportPassport('passport_json')} disabled={Boolean(working)} className={secondaryButton}><Download size={15} /> Télécharger JSON-LD</button>
            <button onClick={() => void exportPassport('vc_jwt')} disabled={Boolean(working) || selected.size === 0} className={secondaryButton}><ShieldCheck size={15} /> Télécharger la preuve signée</button>
            <button onClick={() => void verifyPassport()} disabled={Boolean(working) || !passport?.presentation_jwt} className={secondaryButton}><BadgeCheck size={15} /> Vérifier</button>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">Le fichier JSON-LD est un document portable lisible par les plateformes compatibles. La preuve signée VC-JWT permet de vérifier cryptographiquement que le passeport a été émis par Omnia et n’a pas été modifié.</p>
        </div>

        <form onSubmit={createShare} className="rounded-xl border bg-white p-5" style={{ borderColor: BORDER }}>
          <h2 className="font-semibold" style={{ color: BLUE }}>Partager avec un recruteur</h2>
          <p className="mt-1 text-sm text-slate-500">Le lien ne montre que les éléments sélectionnés et devient inutilisable après révocation.</p>
          <div className="mt-4 space-y-3">
            <Field label="Nom du lien"><input name="label" className={inputClass} placeholder="Ex. Candidature Responsable QSE" /></Field>
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Validité"><select name="validity_days" className={inputClass} defaultValue="30"><option value="7">7 jours</option><option value="30">30 jours</option><option value="90">90 jours</option><option value="365">1 an</option></select></Field><Field label="Consultations maximum"><input name="max_views" type="number" min="1" className={inputClass} placeholder="Illimité" /></Field></div>
          </div>
          <button disabled={working === 'share' || passport?.status !== 'published'} className={`mt-4 w-full justify-center ${primaryButton}`}><Link2 size={15} /> {working === 'share' ? 'Création…' : 'Créer le lien'}</button>
          {passport?.status !== 'published' && <p className="mt-2 text-xs text-amber-700">Publiez et signez le passeport avant de créer un lien.</p>}
          {newShareUrl && <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3"><p className="break-all text-xs text-green-800">{newShareUrl}</p><button type="button" onClick={() => void navigator.clipboard.writeText(newShareUrl)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-green-800"><Copy size={13} /> Copier</button></div>}
        </form>
      </section>

      <section className="mt-6 rounded-xl border bg-white p-5" style={{ borderColor: BORDER }}>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold" style={{ color: BLUE }}>Contenu du passeport</h2><p className="mt-1 text-sm text-slate-500">Les contributions communautaires restent exclues de ce passeport professionnel.</p></div><button onClick={() => void saveSelection()} disabled={working === 'items'} className={primaryButton}><Save size={15} /> {working === 'items' ? 'Enregistrement…' : 'Enregistrer la sélection'}</button></div>
        <div className="mt-5 space-y-6">{groupedCandidates.map(group => <div key={group.section}><h3 className="mb-3 text-sm font-semibold" style={{ color: GOLD }}>{group.label}</h3><div className="grid gap-3 lg:grid-cols-2">{group.items.map(candidate => { const active = selected.has(candidate.id); const draft = selected.get(candidate.id); return <div key={candidate.id} className={`rounded-xl border p-4 transition ${active ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200 bg-white'}`}><div className="flex items-start gap-3"><input type="checkbox" checked={active} onChange={() => toggleCandidate(candidate)} className="mt-1" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><p className="font-semibold" style={{ color: BLUE }}>{candidate.title}</p><VerificationBadge value={candidate.verification_status} /></div><p className="mt-1 line-clamp-2 text-sm text-slate-500">{candidate.description || candidate.issuer_name || SECTION_LABELS[candidate.section]}</p>{candidate.skills?.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{candidate.skills.slice(0, 5).map(skill => <span key={skill} className="rounded-full bg-white px-2 py-1 text-[11px] text-slate-600">{skill}</span>)}</div>}{active && <button type="button" onClick={() => toggleFeatured(candidate.id)} className={`mt-3 inline-flex items-center gap-1 text-xs font-semibold ${draft?.is_featured ? 'text-amber-700' : 'text-slate-500'}`}><Star size={14} fill={draft?.is_featured ? 'currentColor' : 'none'} /> {draft?.is_featured ? 'Mis en avant' : 'Mettre en avant'}</button>}</div></div></div>; })}</div></div>)}{groupedCandidates.length === 0 && <Empty text="Aucun élément professionnel n’est encore disponible dans votre CLR." />}</div>
      </section>

      <section className="mt-6 rounded-xl border bg-white p-5" style={{ borderColor: BORDER }}>
        <h2 className="font-semibold" style={{ color: BLUE }}>Liens de partage</h2>
        <div className="mt-4 divide-y">{shares.map(share => <div key={share.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="text-sm font-semibold" style={{ color: BLUE }}>{share.label || 'Lien Skills Passport'}</p><p className="mt-1 text-xs text-slate-500">{share.expires_at ? `Expire le ${new Date(share.expires_at).toLocaleDateString('fr-FR')}` : 'Sans expiration'} · {share.view_count || 0} consultation(s){share.max_views ? ` / ${share.max_views}` : ''}</p></div><div className="flex items-center gap-2">{share.revoked_at ? <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">Révoqué</span> : <button onClick={() => void revokeShare(share.id)} disabled={working === `revoke-${share.id}`} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700"><Trash2 size={13} /> Révoquer</button>}</div></div>)}{shares.length === 0 && <Empty text="Aucun lien de partage créé." />}</div>
      </section>
    </>}

  </div></LearnerFormationsLayout>;
}

function PassportStatus({ passport, verification }: { passport: SkillsPassport | null; verification: CredentialVerification | null }) {
  if (passport?.status === 'suspended') return <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">Suspendu</span>;
  if (passport?.status === 'published' && verification?.overall_valid) return <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700"><CheckCircle2 size={13} /> Publié et vérifié</span>;
  if (passport?.status === 'published') return <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700"><ShieldCheck size={13} /> Publié et signé</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"><Sparkles size={13} /> Brouillon</span>;
}
function VerificationBadge({ value }: { value: ClrAchievement['verification_status'] }) { return value === 'verified' ? <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-[11px] font-semibold text-green-700"><CheckCircle2 size={11} /> Vérifié</span> : <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">{credentialStatusLabel(value)}</span>; }
function Info({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string }) { return <div className="rounded-xl border p-3" style={{ borderColor: BORDER }}><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400"><Icon size={14} /> {label}</div><p className="mt-2 text-sm text-slate-700">{value}</p></div>; }
function Metric({ label, value }: { label: string; value: number }) { return <div className="border-r p-4 last:border-r-0" style={{ borderColor: BORDER }}><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold" style={{ color: BLUE }}>{value}</p></div>; }
function Empty({ text }: { text: string }) { return <div className="py-8 text-center text-sm text-slate-500">{text}</div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>{children}</label>; }
function Message({ kind, text, onClose }: { kind: 'error' | 'success'; text: string; onClose?: () => void }) { return <div className={`mt-5 flex items-start justify-between gap-3 rounded-xl border p-4 text-sm ${kind === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}><span>{text}</span>{onClose && <button onClick={onClose}><X size={15} /></button>}</div>; }


function humanError(value: string) { return ({ SKILLS_PASSPORT_EMPTY: 'Sélectionnez au moins un élément avant de publier.', SKILLS_PASSPORT_NOT_PUBLISHED: 'Publiez et signez d’abord le Skills Passport.', SKILLS_PASSPORT_NOT_SIGNED: 'Le Skills Passport n’est pas encore signé.', SKILLS_PASSPORT_ITEM_INVALID: 'Un élément sélectionné ne peut pas être présenté.', SIGNING_NOT_CONFIGURED: 'La clé de signature Supabase n’est pas configurée.', CREDENTIALS_SIGNING_PRIVATE_JWK_INVALID_JSON: 'La clé privée enregistrée dans Supabase n’est pas un JSON valide. Remplacez uniquement la valeur du secret par le contenu JWK complet, sans nom de variable ni guillemets supplémentaires.' } as Record<string, string>)[value] || value; }
const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400';
const primaryButton = 'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 bg-[#002050]';
const secondaryButton = 'inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-[#002050] disabled:cursor-not-allowed disabled:opacity-50';
