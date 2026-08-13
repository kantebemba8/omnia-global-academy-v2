import { getSessionToken } from '../../lib/session';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, FileCheck2, Loader2, Send, Upload, UserRoundCheck } from 'lucide-react';
import CoachingHeader from '../../components/coaching/CoachingHeader';
import { CoachApplication as CoachApplicationType, CoachProfile, CoachingDomain, CoachingLevel, coachingRequest, fileToBase64 } from '../../lib/coachingApi';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

type Bootstrap = { success: true; domains: CoachingDomain[]; levels: CoachingLevel[] };
type SelfStatus = { success: true; application: CoachApplicationType | null; profile: CoachProfile | null; roles: string[]; eligibility: { eligible: boolean; source: string; organization_id?: string | null; message: string } };
type UploadedAsset = { path: string; public_url?: string | null; size_bytes: number; file_name: string; mime_type: string };

type FormState = {
  full_name: string; professional_title: string; country: string; timezone: string; biography: string;
  experience_summary: string; motivation: string; languages: string; specialties: string; domain_ids: string[];
  preferred_session_modes: string[]; price_30_xof: string; price_60_xof: string; price_90_xof: string;
  custom_duration_enabled: boolean; custom_hourly_price_xof: string; linkedin_url: string; website_url: string;
  presentation_video_url: string; professional_references: string;
};

const empty: FormState = {
  full_name: '', professional_title: '', country: '', timezone: '', biography: '', experience_summary: '', motivation: '', languages: 'Français', specialties: '', domain_ids: [], preferred_session_modes: ['jitsi'], price_30_xof: '', price_60_xof: '', price_90_xof: '', custom_duration_enabled: false, custom_hourly_price_xof: '', linkedin_url: '', website_url: '', presentation_video_url: '', professional_references: '',
};

const statusLabels: Record<string, string> = { pending: 'Candidature en attente', under_review: 'Candidature en cours d’examen', changes_requested: 'Modifications demandées', approved: 'Profil coach validé', rejected: 'Candidature refusée', suspended: 'Activité coach suspendue', draft: 'Brouillon' };

function splitValues(value: string) { return value.split(',').map(item => item.trim()).filter(Boolean); }
function valueOrNull(value: string) { return value.trim() ? Number(value) : null; }

export default function CoachApplication() {
  const loggedIn = Boolean(getSessionToken());
  const [bootstrap, setBootstrap] = useState<Bootstrap>({ success: true, domains: [], levels: [] });
  const [self, setSelf] = useState<SelfStatus | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [photo, setPhoto] = useState<File | null>(null);
  const [documents, setDocuments] = useState<File[]>([]);
  const [loading, setLoading] = useState(loggedIn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    coachingRequest<Bootstrap>('public_bootstrap').then(setBootstrap).catch(() => undefined);
    if (!loggedIn) return;
    coachingRequest<SelfStatus>('self_status').then(data => {
      setSelf(data);
      const app = data.application;
      const cachedUser = (() => { try { return JSON.parse(localStorage.getItem('omnia_user') || '{}'); } catch { return {}; } })();
      if (app) setForm({
        full_name: app.full_name || cachedUser.full_name || '', professional_title: app.professional_title || '', country: app.country || '', timezone: app.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', biography: app.biography || '', experience_summary: app.experience_summary || '', motivation: app.motivation || '', languages: (app.languages || []).join(', '), specialties: (app.specialties || []).join(', '), domain_ids: (app.domains || []).map(item => item.id), preferred_session_modes: app.preferred_session_modes || ['jitsi'], price_30_xof: app.price_30_xof?.toString() || '', price_60_xof: app.price_60_xof?.toString() || '', price_90_xof: app.price_90_xof?.toString() || '', custom_duration_enabled: Boolean(app.custom_duration_enabled), custom_hourly_price_xof: app.custom_hourly_price_xof?.toString() || '', linkedin_url: app.linkedin_url || '', website_url: app.website_url || '', presentation_video_url: app.presentation_video_url || '', professional_references: app.professional_references || '',
      });
      else setForm(current => ({ ...current, full_name: cachedUser.full_name || current.full_name }));
    }).catch(e => setError(e instanceof Error ? e.message : 'Impossible de charger votre candidature.')).finally(() => setLoading(false));
  }, [loggedIn]);

  const eligible = self?.eligibility?.eligible ?? false;
  const canEdit = eligible && (!self?.application || ['changes_requested', 'rejected', 'draft'].includes(self.application.status));
  const selectedDomains = useMemo(() => new Set(form.domain_ids), [form.domain_ids]);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(prev => ({ ...prev, [key]: value }));

  async function upload(file: File, assetType: string): Promise<UploadedAsset> {
    const base64 = await fileToBase64(file);
    const data = await coachingRequest<{ success: true; asset: UploadedAsset }>('upload_asset', { file_name: file.name, mime_type: file.type, base64, asset_type: assetType });
    return data.asset;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(''); setSuccess('');
    if (form.biography.trim().length < 80) { setError('La biographie doit contenir au moins 80 caractères.'); return; }
    if (!form.domain_ids.length) { setError('Sélectionnez au moins un domaine de coaching.'); return; }
    if (!form.preferred_session_modes.length) { setError('Sélectionnez au moins un type de session.'); return; }
    if (!documents.length && !(self?.application?.documents?.length)) { setError('Ajoutez au moins un diplôme, certificat ou justificatif professionnel.'); return; }
    setBusy(true);
    try {
      let photoUrl = self?.application?.photo_url || null;
      if (photo) photoUrl = (await upload(photo, 'photo')).public_url || null;
      const uploadedDocuments = [];
      for (const file of documents) {
        const asset = await upload(file, 'document');
        uploadedDocuments.push({ document_type: 'certificate', file_name: asset.file_name, mime_type: asset.mime_type, storage_path: asset.path, size_bytes: asset.size_bytes });
      }
      await coachingRequest('submit_application', {
        ...form,
        application_id: self?.application?.id || null,
        languages: splitValues(form.languages), specialties: splitValues(form.specialties), photo_url: photoUrl,
        price_30_xof: valueOrNull(form.price_30_xof), price_60_xof: valueOrNull(form.price_60_xof), price_90_xof: valueOrNull(form.price_90_xof), custom_hourly_price_xof: form.custom_duration_enabled ? valueOrNull(form.custom_hourly_price_xof) : null,
        documents: uploadedDocuments,
      });
      const refreshed = await coachingRequest<SelfStatus>('self_status');
      setSelf(refreshed); setPhoto(null); setDocuments([]); setSuccess('Votre candidature a été transmise à l’Administration Omnia.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Envoi impossible.'); }
    finally { setBusy(false); }
  }

  if (!loggedIn) return <div className="min-h-screen bg-[#F8FAFC]"><CoachingHeader/><main className="mx-auto max-w-2xl px-5 py-20 text-center"><UserRoundCheck className="mx-auto h-12 w-12" color={GOLD}/><h1 className="mt-5 text-3xl font-semibold" style={{ color: BLUE }}>Devenir Coach Omnia</h1><p className="mt-4 leading-7 text-slate-600">Toute personne intéressée peut créer ou utiliser son compte personnel Omnia puis déposer une candidature Coach. Le rôle Coach et l’accès à l’espace professionnel sont accordés uniquement après validation de l’Administration Omnia.</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Link to="/connexion?redirect=/coaching/devenir-coach" className="rounded-xl px-5 py-3 text-sm font-semibold text-white" style={{ background: BLUE }}>J’ai déjà un compte</Link><Link to="/inscription/apprenant?intent=coach" className="rounded-xl border px-5 py-3 text-sm font-semibold" style={{ borderColor: BORDER, color: BLUE }}>Créer mon compte candidat</Link></div></main></div>;
  if (loading) return <div className="min-h-screen bg-[#F8FAFC]"><CoachingHeader/><div className="py-24 text-center text-sm text-slate-500">Chargement de votre espace…</div></div>;
  if (!eligible && !self?.profile) return <div className="min-h-screen bg-[#F8FAFC]"><CoachingHeader/><main className="mx-auto max-w-3xl px-5 py-20"><div className="rounded-2xl border bg-white p-8 text-center" style={{ borderColor: BORDER }}><AlertCircle className="mx-auto h-11 w-11" color={GOLD}/><h1 className="mt-5 text-2xl font-semibold" style={{ color: BLUE }}>Candidature coach non disponible pour ce compte</h1><p className="mx-auto mt-3 max-w-2xl leading-7 text-slate-600">{self?.eligibility?.message || 'Ce compte ne peut pas utiliser le parcours de candidature Coach.'}</p><p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-500">Seuls les comptes protégés d’Administration restent exclus de ce parcours. Pour tous les autres utilisateurs, la candidature est possible sans créer une seconde identité.</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Link to="/coaching" className="rounded-xl px-5 py-3 text-sm font-semibold text-white" style={{ background: BLUE }}>Voir Omnia Coaching</Link></div></div></main></div>;

  return <div className="min-h-screen bg-[#F8FAFC]"><CoachingHeader/><main className="mx-auto max-w-5xl px-4 py-8 md:px-6">
    <div><span className="text-sm font-semibold uppercase tracking-[.12em]" style={{ color: GOLD }}>Candidature coach</span><h1 className="mt-2 text-3xl font-semibold" style={{ color: BLUE }}>Proposer vos compétences sur Omnia Coaching</h1><p className="mt-3 max-w-3xl leading-7 text-slate-600">L’Administration Omnia vérifie le profil, les domaines, les justificatifs, les tarifs, le niveau et la commission avant toute publication.</p></div>
    {error && <div className="mt-6 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle size={19} className="shrink-0"/>{error}</div>}
    {success && <div className="mt-6 flex gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700"><CheckCircle2 size={19} className="shrink-0"/>{success}</div>}

    {self?.application && <section className="mt-6 rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">État actuel</p><h2 className="mt-1 text-lg font-semibold" style={{ color: BLUE }}>{statusLabels[self.application.status] || self.application.status}</h2><p className="mt-1 text-sm text-slate-500">Soumise le {self.application.submitted_at ? new Date(self.application.submitted_at).toLocaleDateString('fr-FR') : '—'}</p></div>{self.profile && <Link to="/coach/dashboard" className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: BLUE }}>Ouvrir mon espace coach</Link>}</div>{self.application.admin_message && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><strong>Modifications demandées :</strong> {self.application.admin_message}</div>}{self.application.rejection_reason && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><strong>Motif :</strong> {self.application.rejection_reason}</div>}</section>}

    {!canEdit ? <div className="mt-6 rounded-2xl border bg-white p-10 text-center" style={{ borderColor: BORDER }}><FileCheck2 className="mx-auto h-10 w-10" color={GOLD}/><h2 className="mt-4 text-xl font-semibold" style={{ color: BLUE }}>{self?.application?.status === 'approved' ? 'Votre profil est validé' : 'Votre candidature est en cours de traitement'}</h2><p className="mt-2 text-sm text-slate-500">Les informations restent consultables par l’Administration Omnia jusqu’à sa décision.</p></div> : <form onSubmit={submit} className="mt-6 space-y-6">
      <section className="rounded-2xl border bg-white p-5 md:p-6" style={{ borderColor: BORDER }}><h2 className="text-lg font-semibold" style={{ color: BLUE }}>Identité professionnelle</h2><div className="mt-5 grid gap-4 md:grid-cols-2"><Field label="Nom complet *"><input required value={form.full_name} onChange={e => set('full_name', e.target.value)} className="input"/></Field><Field label="Titre professionnel *"><input required value={form.professional_title} onChange={e => set('professional_title', e.target.value)} className="input" placeholder="Ex. Consultant RH"/></Field><Field label="Pays *"><input required value={form.country} onChange={e => set('country', e.target.value)} className="input"/></Field><Field label="Fuseau horaire *"><input required value={form.timezone} onChange={e => set('timezone', e.target.value)} className="input" placeholder="Continent/Ville ou UTC"/></Field></div><Field label="Biographie professionnelle * (minimum 80 caractères)"><textarea required minLength={80} value={form.biography} onChange={e => set('biography', e.target.value)} className="textarea" rows={6}/></Field><Field label="Expérience professionnelle *"><textarea required value={form.experience_summary} onChange={e => set('experience_summary', e.target.value)} className="textarea" rows={5}/></Field><Field label="Pourquoi souhaitez-vous coacher sur OGA ? *"><textarea required value={form.motivation} onChange={e => set('motivation', e.target.value)} className="textarea" rows={4}/></Field></section>

      <section className="rounded-2xl border bg-white p-5 md:p-6" style={{ borderColor: BORDER }}><h2 className="text-lg font-semibold" style={{ color: BLUE }}>Expertises et langues</h2><p className="mt-2 text-sm text-slate-500">Sélectionnez uniquement les domaines que vous maîtrisez réellement.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{bootstrap.domains.map(domain => <label key={domain.id} className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm" style={{ borderColor: selectedDomains.has(domain.id) ? GOLD : BORDER, background: selectedDomains.has(domain.id) ? 'rgba(191,136,19,.06)' : 'white' }}><input type="checkbox" checked={selectedDomains.has(domain.id)} onChange={() => set('domain_ids', selectedDomains.has(domain.id) ? form.domain_ids.filter(id => id !== domain.id) : [...form.domain_ids, domain.id])} className="mt-1"/><span><strong style={{ color: BLUE }}>{domain.name}</strong>{domain.description && <span className="mt-1 block text-xs leading-5 text-slate-500">{domain.description}</span>}</span></label>)}</div><div className="mt-5 grid gap-4 md:grid-cols-2"><Field label="Spécialités détaillées *"><input required value={form.specialties} onChange={e => set('specialties', e.target.value)} className="input" placeholder="Séparées par des virgules"/></Field><Field label="Langues parlées *"><input required value={form.languages} onChange={e => set('languages', e.target.value)} className="input" placeholder="Français, Bambara, Anglais"/></Field></div></section>

      <section className="rounded-2xl border bg-white p-5 md:p-6" style={{ borderColor: BORDER }}><h2 className="text-lg font-semibold" style={{ color: BLUE }}>Formats et tarifs proposés</h2><div className="mt-4 flex flex-wrap gap-4">{[['jitsi','Salle vidéo OGA'],['external','Zoom / Google Meet']].map(([value,label]) => <label key={value} className="inline-flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={form.preferred_session_modes.includes(value)} onChange={() => set('preferred_session_modes', form.preferred_session_modes.includes(value) ? form.preferred_session_modes.filter(item => item !== value) : [...form.preferred_session_modes, value])}/>{label}</label>)}</div><div className="mt-5 grid gap-4 md:grid-cols-3"><Field label="30 minutes (FCFA)"><input type="number" min="0" value={form.price_30_xof} onChange={e => set('price_30_xof', e.target.value)} className="input"/></Field><Field label="60 minutes (FCFA)"><input type="number" min="0" value={form.price_60_xof} onChange={e => set('price_60_xof', e.target.value)} className="input"/></Field><Field label="90 minutes (FCFA)"><input type="number" min="0" value={form.price_90_xof} onChange={e => set('price_90_xof', e.target.value)} className="input"/></Field></div><label className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={form.custom_duration_enabled} onChange={e => set('custom_duration_enabled', e.target.checked)}/>Proposer une durée personnalisée</label>{form.custom_duration_enabled && <div className="mt-3 max-w-sm"><Field label="Tarif horaire personnalisé (FCFA)"><input type="number" min="0" value={form.custom_hourly_price_xof} onChange={e => set('custom_hourly_price_xof', e.target.value)} className="input"/></Field></div>}</section>

      <section className="rounded-2xl border bg-white p-5 md:p-6" style={{ borderColor: BORDER }}><h2 className="text-lg font-semibold" style={{ color: BLUE }}>Justificatifs et liens</h2><div className="mt-5 grid gap-4 md:grid-cols-2"><Field label="LinkedIn"><input type="url" value={form.linkedin_url} onChange={e => set('linkedin_url', e.target.value)} className="input"/></Field><Field label="Site professionnel"><input type="url" value={form.website_url} onChange={e => set('website_url', e.target.value)} className="input"/></Field><Field label="Vidéo de présentation (URL)"><input type="url" value={form.presentation_video_url} onChange={e => set('presentation_video_url', e.target.value)} className="input"/></Field><Field label="Références professionnelles"><input value={form.professional_references} onChange={e => set('professional_references', e.target.value)} className="input"/></Field></div><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="rounded-xl border border-dashed p-4" style={{ borderColor: BORDER }}><span className="flex items-center gap-2 text-sm font-semibold" style={{ color: BLUE }}><Upload size={17} color={GOLD}/>Photo professionnelle</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setPhoto(e.target.files?.[0] || null)} className="mt-3 block w-full text-xs text-slate-500"/>{photo && <span className="mt-2 block text-xs text-green-700">{photo.name}</span>}</label><label className="rounded-xl border border-dashed p-4" style={{ borderColor: BORDER }}><span className="flex items-center gap-2 text-sm font-semibold" style={{ color: BLUE }}><Upload size={17} color={GOLD}/>Diplômes et certifications</span><input type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp,.doc,.docx" onChange={e => setDocuments(Array.from(e.target.files || []).slice(0, 12))} className="mt-3 block w-full text-xs text-slate-500"/>{documents.length > 0 ? <span className="mt-2 block text-xs text-green-700">{documents.length} nouveau(x) fichier(s) sélectionné(s)</span> : self?.application?.documents?.length ? <span className="mt-2 block text-xs text-green-700">{self.application.documents.length} justificatif(s) déjà enregistré(s)</span> : <span className="mt-2 block text-xs text-slate-500">Au moins un justificatif est obligatoire.</span>}</label></div></section>

      <div className="flex justify-end"><button disabled={busy} className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-60" style={{ background: BLUE }}>{busy ? <Loader2 size={17} className="animate-spin"/> : <Send size={17}/>}Transmettre à l’Administration Omnia</button></div>
    </form>}
  </main><style>{`.input{margin-top:.4rem;height:2.75rem;width:100%;border:1px solid ${BORDER};border-radius:.75rem;padding:0 .8rem;font-size:.875rem;outline:none}.input:focus,.textarea:focus{border-color:${GOLD}}.textarea{margin-top:.4rem;width:100%;border:1px solid ${BORDER};border-radius:.75rem;padding:.75rem;font-size:.875rem;outline:none}`}</style></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-medium text-slate-700">{label}{children}</label>; }
