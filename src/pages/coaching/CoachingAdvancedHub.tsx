import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CheckCircle2, Save, Sparkles, Users } from 'lucide-react';
import CoachingHeader from '../../components/coaching/CoachingHeader';
import {
  CoachingDomain,
  CoachingActionPlan,
  CoachingGroupProgram,
  CoachingGroupRegistration,
  CoachingRecommendation,
  LearnerCoachingPreferences,
  coachingRequest,
  formatCoachingDate,
  formatXof,
} from '../../lib/coachingApi';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

type Catalogue = { groups: CoachingGroupProgram[]; domains: CoachingDomain[] };
type Dashboard = { preferences: LearnerCoachingPreferences; groups: CoachingGroupRegistration[]; action_plans: CoachingActionPlan[] };
type Recommendations = { recommendations: CoachingRecommendation[]; preferences: LearnerCoachingPreferences };

const defaults: LearnerCoachingPreferences = { domain_ids: [], languages: ['Français'], goals: [], budget_min_xof: 0, budget_max_xof: null, meeting_modes: ['jitsi', 'external'], preferred_formats: ['individual'] };

export default function CoachingAdvancedHub() {
  const loggedIn = Boolean(localStorage.getItem('omnia_session_token'));
  const [catalogue, setCatalogue] = useState<Catalogue>({ groups: [], domains: [] });
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [recommendations, setRecommendations] = useState<CoachingRecommendation[]>([]);
  const [preferences, setPreferences] = useState<LearnerCoachingPreferences>(defaults);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try {
      const publicData = await coachingRequest<Catalogue & { success: true }>('public_advanced_catalogue');
      setCatalogue({ groups: publicData.groups || [], domains: publicData.domains || [] });
      if (loggedIn) {
        const [own, match] = await Promise.all([
          coachingRequest<Dashboard & { success: true }>('learner_advanced_dashboard'),
          coachingRequest<Recommendations & { success: true }>('learner_recommendations'),
        ]);
        setDashboard(own);
        setPreferences(own.preferences || defaults);
        setRecommendations(match.recommendations || []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible.');
    }
  }

  useEffect(() => { void load(); }, []);

  async function checkoutGroup(productId: string) {
    if (!loggedIn) {
      window.location.href = `/connexion?redirect=${encodeURIComponent('/coaching/solutions')}`;
      return;
    }
    setBusy(`group:${productId}`);
    setError('');
    try {
      const result = await coachingRequest<{ success: true; order: { id: string }; payment_url?: string | null }>('advanced_checkout', { product_type: 'group', product_id: productId });
      if (result.payment_url) window.location.assign(result.payment_url);
      else window.location.assign(`/coaching/avance/paiement/${result.order.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Paiement impossible.');
    } finally {
      setBusy('');
    }
  }

  async function savePreferences() {
    setBusy('preferences');
    setMessage('');
    setError('');
    try {
      await coachingRequest('learner_preferences_save', preferences as unknown as Record<string, unknown>);
      setMessage('Vos préférences ont été enregistrées et les recommandations recalculées.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible.');
    } finally {
      setBusy('');
    }
  }

  const goalsText = useMemo(() => preferences.goals.join(', '), [preferences.goals]);
  const languagesText = useMemo(() => preferences.languages.join(', '), [preferences.languages]);

  return <div className="min-h-screen bg-slate-50"><CoachingHeader /><main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
    <div className="mb-7"><p className="text-xs font-semibold uppercase tracking-[.18em]" style={{ color: GOLD }}>Accompagnement</p><h1 className="mt-2 text-3xl font-bold" style={{ color: BLUE }}>Recommandations et coaching collectif</h1><p className="mt-2 max-w-3xl text-slate-600">Retrouvez les recommandations, les groupes et les plans d’action disponibles.</p></div>
    {(error || message) && <div className={`mb-5 rounded-xl border p-4 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{error || message}</div>}

    {loggedIn && <section className="mb-8 rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-semibold" style={{ color: BLUE }}><Sparkles size={20} color={GOLD}/>Mes préférences</h2><p className="mt-1 text-sm text-slate-500">Elles servent uniquement au matching Omnia Coaching.</p></div><button onClick={savePreferences} disabled={busy === 'preferences'} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BLUE }}><Save size={16}/>Enregistrer</button></div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4"><Field label="Objectifs (séparés par des virgules)"><input value={goalsText} onChange={e=>setPreferences(v=>({...v,goals:e.target.value.split(',').map(x=>x.trim()).filter(Boolean)}))} className="input"/></Field><Field label="Langues"><input value={languagesText} onChange={e=>setPreferences(v=>({...v,languages:e.target.value.split(',').map(x=>x.trim()).filter(Boolean)}))} className="input"/></Field><Field label="Budget minimum"><input type="number" min={0} value={preferences.budget_min_xof} onChange={e=>setPreferences(v=>({...v,budget_min_xof:Number(e.target.value)}))} className="input"/></Field><Field label="Budget maximum"><input type="number" min={0} value={preferences.budget_max_xof ?? ''} onChange={e=>setPreferences(v=>({...v,budget_max_xof:e.target.value?Number(e.target.value):null}))} className="input"/></Field></div>
      {catalogue.domains.length > 0 && <div className="mt-4"><p className="text-sm font-medium text-slate-700">Domaines recherchés</p><div className="mt-2 flex flex-wrap gap-2">{catalogue.domains.map(domain => { const active = preferences.domain_ids.includes(domain.id); return <button type="button" key={domain.id} onClick={() => setPreferences(value => ({ ...value, domain_ids: active ? value.domain_ids.filter(id => id !== domain.id) : [...value.domain_ids, domain.id] }))} className="rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: active ? GOLD : BORDER, background: active ? '#FFF7E6' : 'white', color: active ? '#8A5B00' : BLUE }}>{domain.name}</button>; })}</div></div>}
      <div className="mt-4 flex flex-wrap gap-4 text-sm"><Check label="Jitsi intégré" checked={preferences.meeting_modes.includes('jitsi')} onChange={on=>setPreferences(v=>({...v,meeting_modes:on?[...new Set([...v.meeting_modes,'jitsi'])]:v.meeting_modes.filter(x=>x!=='jitsi')}))}/><Check label="Zoom / Meet" checked={preferences.meeting_modes.includes('external')} onChange={on=>setPreferences(v=>({...v,meeting_modes:on?[...new Set([...v.meeting_modes,'external'])]:v.meeting_modes.filter(x=>x!=='external')}))}/><Check label="Coaching individuel" checked={preferences.preferred_formats.includes('individual')} onChange={on=>setPreferences(v=>({...v,preferred_formats:on?[...new Set([...v.preferred_formats,'individual'])]:v.preferred_formats.filter(x=>x!=='individual')}))}/><Check label="Coaching collectif" checked={preferences.preferred_formats.includes('group')} onChange={on=>setPreferences(v=>({...v,preferred_formats:on?[...new Set([...v.preferred_formats,'group'])]:v.preferred_formats.filter(x=>x!=='group')}))}/></div>
    </section>}

    {loggedIn && recommendations.length > 0 && <Section title="Coachs recommandés" icon={Sparkles}><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{recommendations.map(item=><article key={item.coach.id} className="rounded-2xl border p-4" style={{borderColor:BORDER}}><div className="flex items-center gap-3"><img src={item.coach.photo_url || '/omnia-sidebar-logo.png'} className="h-12 w-12 rounded-xl object-cover" alt=""/><div><h3 className="font-semibold" style={{color:BLUE}}>{item.coach.full_name}</h3><p className="text-xs text-slate-500">Compatibilité {item.score}%</p></div></div><div className="mt-3 flex flex-wrap gap-1">{item.reasons.map(reason=><span key={reason} className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800">{reason}</span>)}</div><Link to={`/coaching/coachs/${item.coach.public_slug}`} className="mt-4 block rounded-xl border px-3 py-2 text-center text-sm font-semibold" style={{color:BLUE,borderColor:BORDER}}>Voir le profil</Link></article>)}</div></Section>}

    <Section title="Coaching collectif" icon={Users}><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{catalogue.groups.length ? catalogue.groups.map(group=><ProductCard key={group.id} title={group.title} subtitle={`${group.confirmed_count || 0}/${group.capacity} participants`} description={group.description} price={formatXof(group.price_per_participant_xof)} footer={formatCoachingDate(group.scheduled_start)} busy={busy===`group:${group.id}`} onAction={()=>checkoutGroup(group.id)} action={group.status==='full'?'Complet':'Réserver ma place'} disabled={group.status==='full'}/>):<Empty text="Aucune session collective programmée."/>}</div></Section>

    {dashboard && <Section title="Mes groupes" icon={CalendarDays}>{dashboard.groups.length ? <div className="space-y-3">{dashboard.groups.map(r=><div key={r.id} className="rounded-xl border p-4" style={{borderColor:BORDER}}><p className="font-semibold" style={{color:BLUE}}>{r.program?.title || 'Coaching collectif'}</p><p className="mt-1 text-sm text-slate-500">{r.program ? formatCoachingDate(r.program.scheduled_start) : r.status}</p>{['confirmed','attended'].includes(r.status)&&r.program&&<Link to={`/coaching/groupes/${r.program.id}/room`} className="mt-3 inline-flex rounded-lg border px-3 py-2 text-xs font-semibold" style={{color:BLUE,borderColor:BORDER}}>Accéder à la salle</Link>}</div>)}</div>:<Empty text="Aucune inscription collective."/>}</Section>}

    {dashboard?.action_plans?.length ? <Section title="Mes plans d’action" icon={CheckCircle2}><div className="space-y-3">{dashboard.action_plans.map(plan=><Link key={plan.id} to={`/dashboard/coaching/sessions/${plan.session_id}/suivi`} className="block rounded-xl border p-4" style={{borderColor:BORDER}}><div className="flex justify-between"><p className="font-semibold" style={{color:BLUE}}>{plan.title}</p><span className="text-xs text-slate-500">{plan.items?.filter(i=>i.status==='done').length || 0}/{plan.items?.length || 0}</span></div><p className="mt-1 line-clamp-2 text-sm text-slate-500">{plan.summary}</p></Link>)}</div></Section>:null}
  </main><style>{`.input{margin-top:.25rem;height:2.75rem;width:100%;border:1px solid ${BORDER};border-radius:.75rem;padding:0 .75rem;font-size:.875rem}`}</style></div>;
}

function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="text-sm font-medium text-slate-700">{label}{children}</label>}
function Check({label,checked,onChange}:{label:string;checked:boolean;onChange:(value:boolean)=>void}){return <label className="flex items-center gap-2"><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/>{label}</label>}
function Section({title,icon:Icon,children}:{title:string;icon:any;children:React.ReactNode}){return <section className="mb-8 rounded-2xl border bg-white p-5" style={{borderColor:BORDER}}><h2 className="mb-4 flex items-center gap-2 text-lg font-semibold" style={{color:BLUE}}><Icon size={20} color={GOLD}/>{title}</h2>{children}</section>}
function Empty({text}:{text:string}){return <p className="text-sm text-slate-500">{text}</p>}
function ProductCard({title,subtitle,description,price,footer,action,onAction,busy,disabled}:{title:string;subtitle:string;description:string;price:string;footer:string;action:string;onAction:()=>void;busy:boolean;disabled?:boolean}){return <article className="flex h-full flex-col rounded-2xl border p-4" style={{borderColor:BORDER}}><p className="text-xs font-semibold uppercase tracking-wide" style={{color:GOLD}}>{subtitle}</p><h3 className="mt-1 text-lg font-semibold" style={{color:BLUE}}>{title}</h3><p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{description}</p><p className="mt-4 text-xl font-bold" style={{color:BLUE}}>{price}</p><p className="mt-1 text-xs text-slate-500">{footer}</p><button onClick={onAction} disabled={busy||disabled} className="mt-4 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" style={{background:BLUE}}>{busy?'Préparation…':action}</button></article>}
