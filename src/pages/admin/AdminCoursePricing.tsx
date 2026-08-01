import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Calculator, CheckCircle2, Loader2, RefreshCw, Save, Scale, UserRound } from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import { ENDPOINTS } from '../../lib/config';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

type PricingCourse = {
  id: string;
  title: string;
  score_calcule: number;
  prix_provisoire_xof: number;
  desired_price_amount: number | null;
  pricing_status: string;
  pricing_snapshot?: {
    palier?: string;
    multiplier?: number;
    multiplier_category?: string;
    breakdown?: Record<string, number>;
  } | null;
};

type Choice = 'automatic' | 'professor' | 'custom';

function sessionToken() { return localStorage.getItem('omnia_session_token') || ''; }
function money(value: number | null | undefined) { return `${Number(value || 0).toLocaleString('fr-FR')} XOF`; }

async function requestPricing<T>(method: 'GET' | 'POST', body?: unknown): Promise<T> {
  const response = await fetch(ENDPOINTS.coursePricingWorkflow, {
    method,
    headers: { Authorization: `Bearer ${sessionToken()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error(data.message || data.error || 'Opération tarifaire impossible.');
  return data as T;
}

export default function AdminCoursePricing() {
  const [items, setItems] = useState<PricingCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [choice, setChoice] = useState<Record<string, Choice>>({});
  const [customPrice, setCustomPrice] = useState<Record<string, string>>({});
  const [comment, setComment] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await requestPricing<{ courses: PricingCourse[] }>('GET');
      setItems(result.courses || []);
      setChoice(current => {
        const next = { ...current };
        for (const course of result.courses || []) if (!next[course.id]) next[course.id] = 'automatic';
        return next;
      });
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Chargement impossible.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function decide(course: PricingCourse) {
    const selected = choice[course.id] || 'automatic';
    const custom = Number(customPrice[course.id] || 0);
    if (selected === 'custom' && (!Number.isFinite(custom) || custom <= 0)) {
      setError('Indiquez un prix personnalisé supérieur à zéro.'); return;
    }
    setWorking(course.id); setError(''); setSuccess('');
    try {
      await requestPricing('POST', {
        course_id: course.id,
        action: 'admin_decide',
        source: selected,
        custom_price_xof: selected === 'custom' ? custom : undefined,
        comment: comment[course.id]?.trim() || undefined,
      });
      setSuccess(`Le prix de « ${course.title} » a été transmis au professeur pour acceptation.`);
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Décision impossible.'); }
    finally { setWorking(''); }
  }

  const totals = useMemo(() => ({
    pending: items.length,
    averageScore: items.length ? Math.round(items.reduce((sum, item) => sum + Number(item.score_calcule || 0), 0) / items.length * 10) / 10 : 0,
  }), [items]);

  return <AdminLayout><div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold" style={{ color: BLUE }}>Validation tarifaire des formations</h1><p className="mt-1 max-w-3xl text-sm text-gray-500">Comparez le calcul automatique, la proposition du professeur et votre propre ajustement. Le professeur doit ensuite accepter le prix avant la validation pédagogique.</p></div><button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold" style={{ borderColor: BORDER, color: BLUE }}><RefreshCw size={16} />Actualiser</button></div>

    <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}><p className="text-xs text-gray-500">Décisions en attente</p><p className="mt-1 text-2xl font-bold" style={{ color: BLUE }}>{totals.pending}</p></div><div className="rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}><p className="text-xs text-gray-500">Score pédagogique moyen</p><p className="mt-1 text-2xl font-bold" style={{ color: GOLD }}>{totals.averageScore}</p></div></div>

    {error && <p className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={16} />{error}</p>}
    {success && <p className="flex items-center gap-2 rounded-xl bg-green-50 p-3 text-sm text-green-700"><CheckCircle2 size={16} />{success}</p>}

    {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div> : items.length === 0 ? <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-sm text-gray-500" style={{ borderColor: BORDER }}>Aucune proposition tarifaire en attente.</div> : <div className="space-y-5">{items.map(course => {
      const selected = choice[course.id] || 'automatic';
      const breakdown = course.pricing_snapshot?.breakdown || {};
      return <section key={course.id} className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: BORDER }}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold" style={{ color: BLUE }}>{course.title}</h2><p className="mt-1 text-xs text-gray-500">Score {course.score_calcule || 0} · palier {course.pricing_snapshot?.palier || 'non renseigné'} · multiplicateur {course.pricing_snapshot?.multiplier || 1} ({course.pricing_snapshot?.multiplier_category || 'catégorie standard'})</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{course.pricing_status.replaceAll('_', ' ')}</span></div>

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          <PriceChoice active={selected === 'automatic'} icon={Calculator} title="Prix automatique" amount={money(course.prix_provisoire_xof)} text="Calculé depuis la structure, la durée, le niveau, les évaluations, les ressources et le multiplicateur de catégorie." onClick={() => setChoice(current => ({ ...current, [course.id]: 'automatic' }))} />
          <PriceChoice active={selected === 'professor'} icon={UserRound} title="Proposition du professeur" amount={money(course.desired_price_amount)} text={course.desired_price_amount ? 'Montant souhaité lors de la commercialisation.' : 'Aucune proposition exploitable.'} disabled={!course.desired_price_amount} onClick={() => setChoice(current => ({ ...current, [course.id]: 'professor' }))} />
          <PriceChoice active={selected === 'custom'} icon={Scale} title="Prix personnalisé Omnia" amount="Décision manuelle" text="Utilisez cette option pour corriger un cas particulier tout en conservant la trace de la justification." onClick={() => setChoice(current => ({ ...current, [course.id]: 'custom' }))} />
        </div>

        {selected === 'custom' && <label className="mt-4 block"><span className="mb-1.5 block text-xs font-semibold text-gray-600">Prix personnalisé (XOF)</span><input type="number" min="1" value={customPrice[course.id] || ''} onChange={event => setCustomPrice(current => ({ ...current, [course.id]: event.target.value }))} className="h-11 w-full rounded-xl border px-3 text-sm md:max-w-sm" style={{ borderColor: BORDER }} placeholder="Ex. 15000" /></label>}

        {Object.keys(breakdown).length > 0 && <details className="mt-4 rounded-xl bg-gray-50 p-4"><summary className="cursor-pointer text-sm font-semibold" style={{ color: BLUE }}>Voir le détail du calcul automatique</summary><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(breakdown).map(([key, value]) => <div key={key} className="rounded-lg bg-white p-3 text-xs"><p className="text-gray-500">{key.replaceAll('_', ' ')}</p><p className="mt-1 font-semibold" style={{ color: BLUE }}>{Number(value).toLocaleString('fr-FR')}</p></div>)}</div></details>}

        <label className="mt-4 block"><span className="mb-1.5 block text-xs font-semibold text-gray-600">Commentaire ou justification</span><textarea value={comment[course.id] || ''} onChange={event => setComment(current => ({ ...current, [course.id]: event.target.value }))} rows={3} className="w-full rounded-xl border px-3 py-2 text-sm" style={{ borderColor: BORDER }} placeholder="Expliquez un ajustement manuel ou donnez un contexte au professeur." /></label>
        <div className="mt-4 flex justify-end"><button disabled={working === course.id} onClick={() => void decide(course)} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40" style={{ background: BLUE }}>{working === course.id ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}Valider ce prix</button></div>
      </section>;
    })}</div>}
  </div></AdminLayout>;
}

function PriceChoice({ active, icon: Icon, title, amount, text, onClick, disabled = false }: { active: boolean; icon: typeof Calculator; title: string; amount: string; text: string; onClick: () => void; disabled?: boolean }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="rounded-2xl border-2 p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-40" style={{ borderColor: active ? GOLD : BORDER, background: active ? '#FFF9EA' : 'white' }}><div className="flex items-center gap-2"><Icon size={17} style={{ color: active ? GOLD : BLUE }} /><p className="text-xs font-semibold text-gray-600">{title}</p></div><p className="mt-2 text-xl font-bold" style={{ color: active ? GOLD : BLUE }}>{amount}</p><p className="mt-2 text-xs leading-5 text-gray-500">{text}</p></button>;
}
