import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Edit3, Loader2, Plus, Power, RefreshCw, Settings2, Video, X } from 'lucide-react';
import CoachingHeader from '../../components/coaching/CoachingHeader';
import CoachWorkspaceNav from '../../components/coaching/CoachWorkspaceNav';
import { CoachOffer, CoachProfile, CoachingDomain, coachingRequest, formatXof } from '../../lib/coachingApi';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

type OffersData = {
  success: true;
  offers: CoachOffer[];
  domains: CoachingDomain[];
  profile: CoachProfile;
  limits: { minimum: number; maximum: number | null; commission: number };
};

type OfferForm = {
  offer_id?: string;
  offer_type: 'fixed' | 'custom';
  title: string;
  description: string;
  domain_id: string;
  duration_minutes: string;
  price_xof: string;
  hourly_price_xof: string;
  custom_min_minutes: string;
  custom_max_minutes: string;
  custom_step_minutes: string;
  session_modes: Array<'jitsi' | 'external'>;
};

const emptyForm: OfferForm = {
  offer_type: 'fixed',
  title: '',
  description: '',
  domain_id: '',
  duration_minutes: '60',
  price_xof: '',
  hourly_price_xof: '',
  custom_min_minutes: '30',
  custom_max_minutes: '180',
  custom_step_minutes: '15',
  session_modes: ['jitsi'],
};

const statusLabels: Record<string, string> = {
  active: 'Active', pending: 'En validation', rejected: 'Refusée', inactive: 'Désactivée', archived: 'Archivée',
};

export default function CoachOffers() {
  const [data, setData] = useState<OffersData | null>(null);
  const [editing, setEditing] = useState<OfferForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setLoading(true); setError('');
    try { setData(await coachingRequest<OffersData>('coach_offers')); }
    catch (e) { setError(e instanceof Error ? e.message : 'Impossible de charger vos offres.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function editOffer(offer: CoachOffer) {
    setEditing({
      offer_id: offer.id,
      offer_type: offer.offer_type,
      title: offer.title,
      description: offer.description || '',
      domain_id: offer.domain_id || '',
      duration_minutes: offer.duration_minutes?.toString() || '60',
      price_xof: offer.price_xof?.toString() || '',
      hourly_price_xof: offer.hourly_price_xof?.toString() || '',
      custom_min_minutes: offer.custom_min_minutes?.toString() || '30',
      custom_max_minutes: offer.custom_max_minutes?.toString() || '180',
      custom_step_minutes: offer.custom_step_minutes?.toString() || '15',
      session_modes: offer.session_modes || ['jitsi'],
    });
  }

  async function toggle(offer: CoachOffer) {
    setBusyId(offer.id); setError(''); setNotice('');
    try {
      await coachingRequest('coach_offer_toggle', { offer_id: offer.id, active: offer.status !== 'active' });
      setNotice(offer.status === 'active' ? 'Offre désactivée.' : 'Offre réactivée.');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Modification impossible.'); }
    finally { setBusyId(''); }
  }

  const activeCount = useMemo(() => data?.offers.filter(item => item.status === 'active').length || 0, [data]);

  return <div className="min-h-screen bg-[#F8FAFC]">
    <CoachingHeader />
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <CoachWorkspaceNav />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[.16em]" style={{ color: GOLD }}>Espace coach</span>
          <h1 className="mt-2 text-3xl font-semibold" style={{ color: BLUE }}>Mes offres de coaching</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Créez vos formats de session. Toute nouvelle offre ou modification tarifaire est soumise au Super Admin avant publication.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold" style={{ borderColor: BORDER, color: BLUE }}><RefreshCw size={16}/>Actualiser</button>
          <button onClick={() => setEditing({ ...emptyForm })} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: BLUE }}><Plus size={16}/>Nouvelle offre</button>
        </div>
      </header>

      {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {notice && <div className="mt-5 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700"><CheckCircle2 size={18}/>{notice}</div>}

      {data && <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <Metric label="Offres actives" value={String(activeCount)} />
        <Metric label="En validation" value={String(data.offers.filter(item => item.status === 'pending').length)} />
        <Metric label="Commission actuelle" value={`${data.limits.commission}%`} />
      </section>}

      {loading ? <div className="py-20 text-center text-sm text-slate-500">Chargement des offres…</div> : data?.offers.length ? <section className="mt-6 space-y-4">
        {data.offers.map(offer => <article key={offer.id} className="rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold" style={{ color: BLUE }}>{offer.title}</h2>
                <Status value={offer.status} />
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{offer.offer_type === 'fixed' ? `${offer.duration_minutes} min` : 'Durée personnalisée'}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{offer.description || 'Aucune description.'}</p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1.5"><Clock3 size={15}/>{offer.offer_type === 'fixed' ? formatXof(offer.price_xof) : `${formatXof(offer.hourly_price_xof)} / heure`}</span>
                <span className="inline-flex items-center gap-1.5"><Video size={15}/>{offer.session_modes.map(mode => mode === 'jitsi' ? 'Salle OGA' : 'Lien externe').join(' · ')}</span>
                {offer.domain?.name && <span>{offer.domain.name}</span>}
              </div>
              {offer.offer_type === 'custom' && <p className="mt-3 text-xs text-slate-500">Durée autorisée : {offer.custom_min_minutes} à {offer.custom_max_minutes} minutes, par pas de {offer.custom_step_minutes} minutes.</p>}
              {offer.admin_message && <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Message du Super Admin : {offer.admin_message}</div>}
              {offer.status === 'active' && offer.supersedes_offer_id && <p className="mt-3 text-xs text-slate-500">Cette version a remplacé une ancienne offre validée.</p>}
            </div>
            <div className="flex shrink-0 gap-2">
              <button onClick={() => editOffer(offer)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold" style={{ borderColor: BORDER, color: BLUE }}><Edit3 size={15}/>Modifier</button>
              {['active', 'inactive'].includes(offer.status) && <button disabled={busyId === offer.id} onClick={() => toggle(offer)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50" style={{ borderColor: BORDER, color: offer.status === 'active' ? '#B42318' : '#027A48' }}><Power size={15}/>{offer.status === 'active' ? 'Désactiver' : 'Réactiver'}</button>}
            </div>
          </div>
        </article>)}
      </section> : <div className="mt-6 rounded-2xl border bg-white py-16 text-center" style={{ borderColor: BORDER }}><Settings2 className="mx-auto" color={GOLD}/><h2 className="mt-4 font-semibold" style={{ color: BLUE }}>Aucune offre configurée</h2><p className="mt-2 text-sm text-slate-500">Créez votre première offre pour pouvoir recevoir des réservations.</p></div>}

      {editing && data && <OfferModal form={editing} domains={data.domains} profile={data.profile} limits={data.limits} onClose={() => setEditing(null)} onDone={async message => { setEditing(null); setNotice(message); await load(); }} />}
    </main>
  </div>;
}

function OfferModal({ form: initial, domains, profile, limits, onClose, onDone }: { form: OfferForm; domains: CoachingDomain[]; profile: CoachProfile; limits: OffersData['limits']; onClose: () => void; onDone: (message: string) => void }) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const allowedModes = profile.preferred_session_modes || ['jitsi'];
  const customMinDuration = Math.max(15, Number(form.custom_min_minutes || 30));
  const customMaxDuration = Math.max(customMinDuration, Number(form.custom_max_minutes || customMinDuration));
  const customHourlyMinimum = Math.ceil(limits.minimum * 60 / customMinDuration);
  const customHourlyMaximum = limits.maximum === null ? null : Math.floor(limits.maximum * 60 / customMaxDuration);
  const set = <K extends keyof OfferForm>(key: K, value: OfferForm[K]) => setForm(prev => ({ ...prev, [key]: value }));

  function toggleMode(mode: 'jitsi' | 'external') {
    set('session_modes', form.session_modes.includes(mode) ? form.session_modes.filter(item => item !== mode) : [...form.session_modes, mode]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await coachingRequest('coach_offer_save', {
        ...form,
        domain_id: form.domain_id || null,
        duration_minutes: form.offer_type === 'fixed' ? Number(form.duration_minutes) : null,
        price_xof: form.offer_type === 'fixed' ? Number(form.price_xof) : null,
        hourly_price_xof: form.offer_type === 'custom' ? Number(form.hourly_price_xof) : null,
        custom_min_minutes: form.offer_type === 'custom' ? Number(form.custom_min_minutes) : null,
        custom_max_minutes: form.offer_type === 'custom' ? Number(form.custom_max_minutes) : null,
        custom_step_minutes: form.offer_type === 'custom' ? Number(form.custom_step_minutes) : null,
      });
      onDone(initial.offer_id ? 'La nouvelle version de l’offre a été envoyée au Super Admin.' : 'L’offre a été envoyée au Super Admin.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Enregistrement impossible.'); }
    finally { setBusy(false); }
  }

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4">
    <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
      <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: BORDER }}><div><h2 className="text-lg font-semibold" style={{ color: BLUE }}>{initial.offer_id ? 'Modifier l’offre' : 'Nouvelle offre'}</h2><p className="mt-1 text-xs text-slate-500">Fourchette autorisée : {formatXof(limits.minimum)} à {limits.maximum === null ? 'sans maximum' : formatXof(limits.maximum)}</p></div><button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100"><X size={18}/></button></div>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type d’offre"><select value={form.offer_type} onChange={e => set('offer_type', e.target.value as OfferForm['offer_type'])} className="input"><option value="fixed">Durée fixe</option><option value="custom">Durée personnalisée</option></select></Field>
          <Field label="Domaine"><select value={form.domain_id} onChange={e => set('domain_id', e.target.value)} className="input"><option value="">Sans domaine spécifique</option>{domains.map(domain => <option key={domain.id} value={domain.id}>{domain.name}</option>)}</select></Field>
        </div>
        <Field label="Titre *"><input required maxLength={160} value={form.title} onChange={e => set('title', e.target.value)} className="input" placeholder="Ex. Préparation à un entretien" /></Field>
        <Field label="Description"><textarea rows={4} value={form.description} onChange={e => set('description', e.target.value)} className="textarea" placeholder="Objectifs et contenu de la séance" /></Field>
        {form.offer_type === 'fixed' ? <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Durée"><select value={form.duration_minutes} onChange={e => set('duration_minutes', e.target.value)} className="input"><option value="30">30 minutes</option><option value="60">60 minutes</option><option value="90">90 minutes</option></select></Field>
          <Field label="Prix en FCFA *"><input required type="number" min={limits.minimum} max={limits.maximum ?? undefined} value={form.price_xof} onChange={e => set('price_xof', e.target.value)} className="input" /></Field>
        </div> : <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tarif horaire FCFA *"><input required type="number" min={customHourlyMinimum} max={customHourlyMaximum ?? undefined} value={form.hourly_price_xof} onChange={e => set('hourly_price_xof', e.target.value)} className="input" /><span className="mt-1 block text-xs font-normal text-slate-500">Pour cette plage de durées : minimum {formatXof(customHourlyMinimum)} / h{customHourlyMaximum === null ? '' : `, maximum ${formatXof(customHourlyMaximum)} / h`}.</span></Field>
          <Field label="Pas de durée"><select value={form.custom_step_minutes} onChange={e => set('custom_step_minutes', e.target.value)} className="input"><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">60 minutes</option></select></Field>
          <Field label="Durée minimale"><input required type="number" min="15" value={form.custom_min_minutes} onChange={e => set('custom_min_minutes', e.target.value)} className="input" /></Field>
          <Field label="Durée maximale"><input required type="number" min={form.custom_min_minutes || '15'} max="480" value={form.custom_max_minutes} onChange={e => set('custom_max_minutes', e.target.value)} className="input" /></Field>
        </div>}
        <fieldset><legend className="text-sm font-medium text-slate-700">Formats proposés *</legend><div className="mt-2 flex flex-wrap gap-3">{(['jitsi', 'external'] as const).filter(mode => allowedModes.includes(mode)).map(mode => <label key={mode} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: BORDER }}><input type="checkbox" checked={form.session_modes.includes(mode)} onChange={() => toggleMode(mode)} />{mode === 'jitsi' ? 'Salle intégrée OGA' : 'Zoom / Google Meet'}</label>)}</div></fieldset>
        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <div className="flex justify-end gap-3 border-t pt-4" style={{ borderColor: BORDER }}><button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm" style={{ borderColor: BORDER }}>Annuler</button><button disabled={busy || !form.session_modes.length} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BLUE }}>{busy && <Loader2 className="animate-spin" size={15}/>}Envoyer pour validation</button></div>
      </form>
      <style>{`.input{margin-top:.35rem;height:2.65rem;width:100%;border:1px solid ${BORDER};border-radius:.7rem;padding:0 .75rem;font-size:.875rem;outline:none}.textarea{margin-top:.35rem;width:100%;border:1px solid ${BORDER};border-radius:.7rem;padding:.7rem;font-size:.875rem;outline:none}.input:focus,.textarea:focus{border-color:${GOLD}}`}</style>
    </div>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold" style={{ color: BLUE }}>{value}</p></div>; }
function Status({ value }: { value: string }) { const map: Record<string, [string, string]> = { active: ['#ECFDF3', '#027A48'], pending: ['#FFF7E6', '#9A6700'], rejected: ['#FEF2F2', '#B42318'], inactive: ['#F2F4F7', '#475467'], archived: ['#F2F4F7', '#475467'] }; const [background, color] = map[value] || map.inactive; return <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background, color }}>{statusLabels[value] || value}</span>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-medium text-slate-700">{label}{children}</label>; }
