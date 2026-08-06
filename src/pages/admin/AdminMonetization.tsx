import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { CheckCircle2, CreditCard, Edit3, Gift, Loader2, Plus, RefreshCw, Save, Smartphone, Users, Wallet, X, XCircle } from 'lucide-react';
import { CommerceBenefitDefinition, CommerceCreatorOffer, CommercePlan, commerceRequest, formatXof } from '../../lib/commerceApi';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

type DashboardData = {
  plans: CommercePlan[];
  benefits: CommerceBenefitDefinition[];
  creator_offers: CommerceCreatorOffer[];
  subscriptions: any[];
  orders: any[];
  payouts: any[];
  commission_rules: any[];
  promotions: any[];
  store_products: any[];
};

type PlanDraft = {
  id?: string; code: string; name: string; subtitle: string; description: string; audience: string;
  commercial_type: string; billing_interval: string; interval_count: string; custom_duration_days: string;
  price_xof: string; trial_days: string; auto_renew: boolean; visibility: string; badge_label: string;
  starts_at: string; ends_at: string; max_subscribers: string; country_codes: string; access_code: string; terms_text: string;
  benefits: Array<{ benefit_definition_id: string; value: string; display_label: string; scope: string; selected_ids: string }>;
};

const emptyPlan: PlanDraft = {
  code: '', name: '', subtitle: '', description: '', audience: 'learner', commercial_type: 'subscription',
  billing_interval: 'month', interval_count: '1', custom_duration_days: '', price_xof: '', trial_days: '0',
  auto_renew: false, visibility: 'public', badge_label: '', starts_at: '', ends_at: '', max_subscribers: '', country_codes: '', access_code: '', terms_text: '', benefits: [],
};

const audienceLabels: Record<string, string> = {
  learner: 'Apprenants', coach: 'Coachs', organizer: 'Organisateurs Omnia Live', recruiter: 'Recruteurs indépendants',
  structure: 'Structures', professor: 'Professeurs', global: 'Global / multi-services',
};
const statusLabels: Record<string, string> = {
  draft: 'Brouillon', active: 'Actif', scheduled: 'Planifié', paused: 'Suspendu', retired: 'Retiré', archived: 'Archivé',
  submitted: 'Soumis', under_review: 'En contrôle', changes_requested: 'Modifications demandées', counterproposal: 'Contre-proposition',
  approved: 'Validé', published: 'Publié', rejected: 'Refusé', pending: 'En attente', processing: 'En traitement', completed: 'Payé', failed: 'Échoué', paid: 'Versé',
};

export default function AdminMonetization() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [tab, setTab] = useState<'plans' | 'benefits' | 'offers' | 'commissions' | 'promotions' | 'stores' | 'subscriptions' | 'payouts'>('plans');
  const [planDraft, setPlanDraft] = useState<PlanDraft | null>(null);
  const [benefitDraft, setBenefitDraft] = useState({ benefit_key: '', module_key: 'platform', name: '', description: '', value_type: 'boolean', unit_label: '', reset_period: 'subscription_period', allowed_audiences: ['global'] as string[] });
  const [reviewing, setReviewing] = useState<CommerceCreatorOffer | null>(null);
  const [commissionDraft, setCommissionDraft] = useState({ module_key: 'global', platform_percent: '20', fixed_fee_xof: '0', minimum_amount_xof: '0', priority: '100', justification: '' });
  const [promotionDraft, setPromotionDraft] = useState({ code: '', name: '', discount_type: 'percentage', discount_value: '', max_uses: '', ends_at: '' });
  const [grantDraft, setGrantDraft] = useState({ email: '', plan_id: '', reason: '' });
  const [storeDraft, setStoreDraft] = useState({ id: '', platform: 'android', store_product_id: '', product_type: 'consumable', target_kind: 'price_tier', module_key: 'global', price_xof: '', commerce_plan_id: '', commerce_creator_offer_id: '', display_name: '', notes: '', status: 'draft' });
  const [reviewForm, setReviewForm] = useState({ decision: 'approve', approved_price_xof: '', approved_platform_percent: '20', reason: '' });
  const [payoutDecision, setPayoutDecision] = useState<{ payout: any; decision: 'approve' | 'reject' | 'paid' } | null>(null);
  const [payoutReason, setPayoutReason] = useState('');
  const [payoutReference, setPayoutReference] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    try { setData(await commerceRequest<DashboardData>('admin_dashboard')); }
    catch (e) { setError(e instanceof Error ? e.message : 'Chargement impossible.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  function notify(text: string) { setMessage(text); window.setTimeout(() => setMessage(''), 3500); }

  const metrics = useMemo(() => ({
    activePlans: data?.plans.filter(item => item.status === 'active').length || 0,
    pendingOffers: data?.creator_offers.filter(item => ['submitted', 'under_review'].includes(item.status)).length || 0,
    activeSubscriptions: data?.subscriptions.filter(item => ['active', 'trial'].includes(item.status)).length || 0,
    revenue: data?.orders.filter(item => item.payment_status === 'completed').reduce((sum, item) => sum + Number(item.final_amount_xof || 0), 0) || 0,
  }), [data]);

  function editPlan(plan?: CommercePlan) {
    if (!plan) { setPlanDraft({ ...emptyPlan }); return; }
    setPlanDraft({
      id: plan.id, code: plan.code, name: plan.name, subtitle: plan.subtitle || '', description: plan.description || '', audience: plan.audience,
      commercial_type: plan.commercial_type, billing_interval: plan.billing_interval, interval_count: String(plan.interval_count || 1), custom_duration_days: String(plan.custom_duration_days || ''),
      price_xof: String(plan.price_xof || ''), trial_days: String(plan.trial_days || 0), auto_renew: plan.auto_renew, visibility: plan.visibility, badge_label: plan.badge_label || '',
      starts_at: plan.starts_at ? String(plan.starts_at).slice(0,16) : '', ends_at: plan.ends_at ? String(plan.ends_at).slice(0,16) : '', max_subscribers: String(plan.max_subscribers || ''), country_codes: (plan.country_codes || []).join(','), access_code: String((plan.eligibility as any)?.access_code || ''), terms_text: plan.terms_text || '',
      benefits: (plan.commerce_plan_benefits || []).map(item => ({ benefit_definition_id: item.benefit_definition_id, value: String((item.value_json as any)?.value ?? (item.value_json as any)?.quantity ?? (item.value_json as any)?.percentage ?? ((item.value_json as any)?.enabled === false ? 0 : 1)), display_label: item.display_label || '', scope: String((item.value_json as any)?.scope || 'all'), selected_ids: [...((item.value_json as any)?.category_ids || []), ...((item.value_json as any)?.course_ids || []), ...((item.value_json as any)?.ids || [])].join(',') })),
    });
  }

  function addBenefitToPlan(id: string) {
    if (!planDraft || planDraft.benefits.some(item => item.benefit_definition_id === id)) return;
    setPlanDraft({ ...planDraft, benefits: [...planDraft.benefits, { benefit_definition_id: id, value: '1', display_label: '', scope: 'all', selected_ids: '' }] });
  }

  async function savePlan(event: FormEvent) {
    event.preventDefault(); if (!planDraft) return;
    setBusy(true); setError('');
    try {
      await commerceRequest('admin_plan_save', {
        ...planDraft,
        interval_count: Number(planDraft.interval_count || 1), custom_duration_days: planDraft.custom_duration_days ? Number(planDraft.custom_duration_days) : null,
        price_xof: Number(planDraft.price_xof || 0), trial_days: Number(planDraft.trial_days || 0),
        starts_at: planDraft.starts_at || null, ends_at: planDraft.ends_at || null, max_subscribers: planDraft.max_subscribers ? Number(planDraft.max_subscribers) : null,
        country_codes: planDraft.country_codes.split(',').map(v=>v.trim().toUpperCase()).filter(Boolean), eligibility: planDraft.access_code ? { access_code: planDraft.access_code.trim() } : {}, terms_text: planDraft.terms_text || null,
        benefits: planDraft.benefits.map(item => { const def = data?.benefits.find(b=>b.id===item.benefit_definition_id); const ids=item.selected_ids.split(',').map(v=>v.trim()).filter(Boolean); const supportsScope=def?.value_type==='content_access'||Array.isArray((def?.configuration_schema as any)?.scope); const scope_json=supportsScope?{ scope:item.scope||'all', ...(item.scope==='categories'?{category_ids:ids}:item.scope==='courses'?{course_ids:ids}:item.scope==='selected'?{ids}: {}) }:{}; const base_json=def?.value_type==='boolean'?{enabled:item.value!=='0'}:def?.value_type==='content_access'?{}:{value:Number(item.value||0)}; return { benefit_definition_id:item.benefit_definition_id, value_json:{...base_json,...scope_json}, display_label:item.display_label||null }; }),
        change_note: planDraft.id ? 'Mise à jour depuis le moteur central de monétisation' : undefined,
      });
      notify(planDraft.id ? 'Plan mis à jour.' : 'Plan créé en brouillon.'); setPlanDraft(null); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Enregistrement impossible.'); }
    finally { setBusy(false); }
  }

  async function changePlanStatus(plan: CommercePlan, status: string) {
    setBusy(true); setError('');
    try { await commerceRequest('admin_plan_status', { id: plan.id, status, reason: `Passage au statut ${status}` }); notify('Statut du plan mis à jour.'); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Modification impossible.'); }
    finally { setBusy(false); }
  }

  async function saveBenefit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await commerceRequest('admin_benefit_save', benefitDraft); notify('Avantage ajouté au catalogue central.'); setBenefitDraft({ benefit_key: '', module_key: 'platform', name: '', description: '', value_type: 'boolean', unit_label: '', reset_period: 'subscription_period', allowed_audiences: ['global'] }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Création impossible.'); }
    finally { setBusy(false); }
  }

  async function saveCommission(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await commerceRequest('admin_commission_rule_save', {
        ...commissionDraft,
        platform_percent: Number(commissionDraft.platform_percent || 0), fixed_fee_xof: Number(commissionDraft.fixed_fee_xof || 0),
        minimum_amount_xof: Number(commissionDraft.minimum_amount_xof || 0), priority: Number(commissionDraft.priority || 100),
      });
      notify('Règle de commission enregistrée.'); setCommissionDraft({ module_key: 'global', platform_percent: '20', fixed_fee_xof: '0', minimum_amount_xof: '0', priority: '100', justification: '' }); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Enregistrement impossible.'); } finally { setBusy(false); }
  }

  async function savePromotion(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await commerceRequest('admin_promotion_save', {
        ...promotionDraft, discount_value: Number(promotionDraft.discount_value || 0), max_uses: promotionDraft.max_uses ? Number(promotionDraft.max_uses) : null,
        ends_at: promotionDraft.ends_at ? new Date(promotionDraft.ends_at).toISOString() : null, is_active: true,
      });
      notify('Promotion enregistrée.'); setPromotionDraft({ code: '', name: '', discount_type: 'percentage', discount_value: '', max_uses: '', ends_at: '' }); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Création impossible.'); } finally { setBusy(false); }
  }

  function editStoreProduct(product?: any) {
    setStoreDraft(product ? {
      id: String(product.id || ''), platform: String(product.platform || 'android'), store_product_id: String(product.store_product_id || ''),
      product_type: String(product.product_type || 'consumable'), target_kind: String(product.target_kind || 'price_tier'), module_key: String(product.module_key || 'global'),
      price_xof: product.price_xof === null || product.price_xof === undefined ? '' : String(product.price_xof), commerce_plan_id: String(product.commerce_plan_id || ''), commerce_creator_offer_id: String(product.commerce_creator_offer_id || ''),
      display_name: String(product.display_name || ''), notes: String(product.notes || ''), status: String(product.status || 'draft'),
    } : { id: '', platform: 'android', store_product_id: '', product_type: 'consumable', target_kind: 'price_tier', module_key: 'global', price_xof: '', commerce_plan_id: '', commerce_creator_offer_id: '', display_name: '', notes: '', status: 'draft' });
  }

  async function saveStoreProduct(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await commerceRequest('admin_store_product_save', {
        ...storeDraft,
        id: storeDraft.id || null,
        price_xof: storeDraft.target_kind === 'price_tier' ? Number(storeDraft.price_xof || 0) : null,
        commerce_plan_id: storeDraft.target_kind === 'commerce_plan' ? storeDraft.commerce_plan_id : null,
        commerce_creator_offer_id: storeDraft.target_kind === 'creator_offer' ? storeDraft.commerce_creator_offer_id : null,
      });
      notify(storeDraft.id ? 'Produit store mis à jour.' : 'Produit store enregistré en brouillon.');
      editStoreProduct();
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Enregistrement du produit store impossible.'); }
    finally { setBusy(false); }
  }

  async function changeStoreProductStatus(id: string, status: string) {
    setBusy(true); setError('');
    try { await commerceRequest('admin_store_product_status', { id, status, reason: `Décision Super Admin : ${status}` }); notify('Statut du produit store mis à jour.'); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Modification impossible.'); }
    finally { setBusy(false); }
  }

  async function manualGrant(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await commerceRequest('admin_manual_grant', grantDraft); notify('Plan attribué manuellement.'); setGrantDraft({ email: '', plan_id: '', reason: '' }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Attribution impossible.'); } finally { setBusy(false); }
  }

  async function reviewOffer(event: FormEvent) {
    event.preventDefault(); if (!reviewing) return; setBusy(true); setError('');
    try {
      await commerceRequest('admin_offer_review', { id: reviewing.id, ...reviewForm, approved_price_xof: Number(reviewForm.approved_price_xof || reviewing.price_xof), approved_platform_percent: Number(reviewForm.approved_platform_percent || 20) });
      notify('Décision enregistrée et tracée.'); setReviewing(null); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Décision impossible.'); }
    finally { setBusy(false); }
  }

  async function changeSubscriptionStatus(id: string, status: string) {
    setBusy(true); setError('');
    try { await commerceRequest('admin_subscription_status', { id, status, reason: `Décision Super Admin : ${status}` }); notify('Souscription mise à jour.'); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Modification impossible.'); }
    finally { setBusy(false); }
  }

  function decidePayout(payout: any, decision: 'approve' | 'reject' | 'paid') {
    setPayoutDecision({ payout, decision });
    setPayoutReason('');
    setPayoutReference('');
  }

  async function confirmPayoutDecision(event: FormEvent) {
    event.preventDefault();
    if (!payoutDecision) return;
    const reason = payoutReason.trim();
    const providerReference = payoutReference.trim();
    if (payoutDecision.decision === 'reject' && !reason) {
      setError('Le motif du refus est obligatoire.');
      return;
    }
    if (payoutDecision.decision === 'paid' && !providerReference) {
      setError('La référence réelle du paiement est obligatoire.');
      return;
    }
    setBusy(true); setError('');
    try {
      await commerceRequest('admin_payout_decide', {
        id: payoutDecision.payout.id,
        decision: payoutDecision.decision,
        reason: reason || (payoutDecision.decision === 'approve' ? 'Demande vérifiée et approuvée.' : null),
        provider_payout_id: providerReference || null,
      });
      notify('Demande de retrait mise à jour.');
      setPayoutDecision(null);
      setPayoutReason('');
      setPayoutReference('');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Décision impossible.'); }
    finally { setBusy(false); }
  }

  return <AdminLayout>
    <div className="mx-auto max-w-7xl space-y-6 px-5 py-7">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div><p className="text-xs font-bold uppercase tracking-[.16em]" style={{ color: GOLD }}>Finance & Commercial</p><h1 className="mt-1 text-3xl font-black" style={{ color: BLUE }}>Abonnements & monétisation</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Moteur central unique pour les plans Omnia, les offres des créateurs, les avantages, les quotas, les commissions, les paiements et les retraits.</p></div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold" style={{ borderColor: BORDER, color: BLUE }}><RefreshCw size={16}/>Actualiser</button>
      </header>
      {message && <div className="fixed right-5 top-5 z-50 rounded-xl border border-green-200 bg-white px-4 py-3 text-sm font-semibold text-green-700 shadow-xl"><CheckCircle2 className="mr-2 inline" size={17}/>{message}</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={CreditCard} label="Plans actifs" value={String(metrics.activePlans)}/><Metric icon={Users} label="Offres à contrôler" value={String(metrics.pendingOffers)}/><Metric icon={Gift} label="Souscriptions actives" value={String(metrics.activeSubscriptions)}/><Metric icon={Wallet} label="Paiements enregistrés" value={formatXof(metrics.revenue)}/></section>
      <nav className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-2">{[
        ['plans','Plans & packs'],['benefits','Catalogue des avantages'],['offers','Offres créateurs'],['commissions','Commissions'],['promotions','Promotions'],['stores','Produits Play / App Store'],['subscriptions','Souscriptions & paiements'],['payouts','Retraits'],
      ].map(([key,label]) => <button key={key} onClick={() => setTab(key as any)} className="min-w-max rounded-lg px-4 py-2 text-sm font-bold" style={{ background: tab === key ? BLUE : '#F1F5F9', color: tab === key ? 'white' : BLUE }}>{label}</button>)}</nav>
      {loading ? <div className="py-20 text-center text-sm text-slate-500"><Loader2 className="mx-auto mb-3 animate-spin"/>Chargement…</div> : <>
        {tab === 'plans' && <section className="space-y-5">
          <div className="flex justify-end"><button onClick={() => editPlan()} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white" style={{ background: BLUE }}><Plus size={16}/>Créer un plan</button></div>
          {planDraft && <form onSubmit={savePlan} className="rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}><div className="flex items-center justify-between"><h2 className="text-lg font-black" style={{ color: BLUE }}>{planDraft.id ? 'Modifier le plan' : 'Nouveau plan'}</h2><button type="button" onClick={() => setPlanDraft(null)}><X size={20}/></button></div><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Code"><input required value={planDraft.code} onChange={e=>setPlanDraft({...planDraft,code:e.target.value})}/></Field><Field label="Nom"><input required value={planDraft.name} onChange={e=>setPlanDraft({...planDraft,name:e.target.value})}/></Field><Field label="Sous-titre"><input value={planDraft.subtitle} onChange={e=>setPlanDraft({...planDraft,subtitle:e.target.value})}/></Field>
            <Field label="Public"><select value={planDraft.audience} onChange={e=>setPlanDraft({...planDraft,audience:e.target.value})}>{Object.entries(audienceLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Field><Field label="Type"><select value={planDraft.commercial_type} onChange={e=>setPlanDraft({...planDraft,commercial_type:e.target.value})}><option value="subscription">Abonnement</option><option value="pack">Pack</option><option value="one_time">Achat unique</option><option value="trial">Essai</option></select></Field><Field label="Périodicité"><select value={planDraft.billing_interval} onChange={e=>setPlanDraft({...planDraft,billing_interval:e.target.value})}><option value="none">Aucune</option><option value="week">Hebdomadaire</option><option value="month">Mensuelle</option><option value="quarter">Trimestrielle</option><option value="semester">Semestrielle</option><option value="year">Annuelle</option><option value="custom">Personnalisée</option><option value="lifetime">À vie</option></select></Field>
            <Field label="Prix XOF"><input type="number" min="0" required value={planDraft.price_xof} onChange={e=>setPlanDraft({...planDraft,price_xof:e.target.value})}/></Field><Field label="Nombre de périodes"><input type="number" min="1" value={planDraft.interval_count} onChange={e=>setPlanDraft({...planDraft,interval_count:e.target.value})}/></Field><Field label="Jours d’essai"><input type="number" min="0" value={planDraft.trial_days} onChange={e=>setPlanDraft({...planDraft,trial_days:e.target.value})}/></Field>
            <Field label="Visibilité"><select value={planDraft.visibility} onChange={e=>setPlanDraft({...planDraft,visibility:e.target.value})}><option value="public">Publique</option><option value="private">Privée / attribution manuelle</option><option value="code">Sur code d’accès</option><option value="structure_only">Structures uniquement</option></select></Field><Field label="Badge commercial"><input value={planDraft.badge_label} onChange={e=>setPlanDraft({...planDraft,badge_label:e.target.value})}/></Field><label className="flex items-center gap-3 pt-7 text-sm font-semibold"><input type="checkbox" checked={planDraft.auto_renew} onChange={e=>setPlanDraft({...planDraft,auto_renew:e.target.checked})}/>Préparer le renouvellement automatique futur</label>
            <Field label="Début de commercialisation"><input type="datetime-local" value={planDraft.starts_at} onChange={e=>setPlanDraft({...planDraft,starts_at:e.target.value})}/></Field><Field label="Fin de commercialisation"><input type="datetime-local" value={planDraft.ends_at} onChange={e=>setPlanDraft({...planDraft,ends_at:e.target.value})}/></Field><Field label="Nombre maximal de souscripteurs"><input type="number" min="1" value={planDraft.max_subscribers} onChange={e=>setPlanDraft({...planDraft,max_subscribers:e.target.value})}/></Field>
            <Field label="Pays autorisés (codes séparés par virgule)"><input placeholder="FR,BR,JP" value={planDraft.country_codes} onChange={e=>setPlanDraft({...planDraft,country_codes:e.target.value})}/></Field>{planDraft.visibility==='code'&&<Field label="Code d’accès"><input required value={planDraft.access_code} onChange={e=>setPlanDraft({...planDraft,access_code:e.target.value})}/></Field>}<Field label="Durée personnalisée en jours"><input type="number" min="1" value={planDraft.custom_duration_days} onChange={e=>setPlanDraft({...planDraft,custom_duration_days:e.target.value})}/></Field>
          </div><Field label="Description"><textarea rows={3} value={planDraft.description} onChange={e=>setPlanDraft({...planDraft,description:e.target.value})}/></Field><Field label="Conditions de l’offre"><textarea rows={3} value={planDraft.terms_text} onChange={e=>setPlanDraft({...planDraft,terms_text:e.target.value})}/></Field>
          <div className="mt-5 border-t pt-5"><h3 className="font-black" style={{ color: BLUE }}>Avantages du plan</h3><div className="mt-3 flex flex-wrap gap-2">{data?.benefits.filter(b=>b.is_active && (b.allowed_audiences.includes(planDraft.audience) || b.allowed_audiences.includes('global'))).map(b=><button type="button" key={b.id} onClick={()=>addBenefitToPlan(b.id)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: BORDER }}>{b.name}</button>)}</div><div className="mt-4 space-y-2">{planDraft.benefits.map((item,index)=>{const def=data?.benefits.find(b=>b.id===item.benefit_definition_id);const supportsScope=def?.value_type==='content_access'||Array.isArray((def?.configuration_schema as any)?.scope);const update=(patch:Partial<(typeof planDraft.benefits)[number]>)=>{const benefits=[...planDraft.benefits];benefits[index]={...item,...patch};setPlanDraft({...planDraft,benefits})};return <div key={item.benefit_definition_id} className="grid items-start gap-3 border-b py-3 md:grid-cols-[1fr_260px_1fr_auto]"><span className="text-sm font-semibold">{def?.name}<small className="mt-1 block font-normal text-slate-400">{def?.value_type}</small></span><div className="space-y-2">{def?.value_type==='boolean'?<select className="w-full rounded-lg border px-3 py-2 text-sm" value={item.value} onChange={e=>update({value:e.target.value})}><option value="1">Activé</option><option value="0">Désactivé</option></select>:def?.value_type!=='content_access'?<input className="w-full rounded-lg border px-3 py-2 text-sm" type="number" value={item.value} onChange={e=>update({value:e.target.value})}/>:null}{supportsScope&&<><select className="w-full rounded-lg border px-3 py-2 text-sm" value={item.scope} onChange={e=>update({scope:e.target.value})}><option value="all">Tous les contenus autorisés</option><option value="categories">Catégories sélectionnées</option><option value="courses">Formations sélectionnées</option><option value="selected">Éléments sélectionnés</option></select>{item.scope!=='all'&&<input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Identifiants séparés par virgule" value={item.selected_ids} onChange={e=>update({selected_ids:e.target.value})}/>}</>}</div><input className="rounded-lg border px-3 py-2 text-sm" placeholder="Libellé public optionnel" value={item.display_label} onChange={e=>update({display_label:e.target.value})}/><button type="button" onClick={()=>setPlanDraft({...planDraft,benefits:planDraft.benefits.filter((_,i)=>i!==index)})}><XCircle size={18} className="text-red-500"/></button></div>})}</div></div>
          <div className="mt-5 flex justify-end"><button disabled={busy} className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50" style={{ background: BLUE }}><Save size={16}/>{busy?'Enregistrement…':'Enregistrer'}</button></div></form>}
          <div className="space-y-3">{data?.plans.map(plan=><article key={plan.id} className="flex flex-col gap-4 border-b border-slate-200 py-5 md:flex-row md:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-black" style={{ color: BLUE }}>{plan.name}</h3><Status value={plan.status}/><span className="text-xs text-slate-400">v{plan.version}</span></div><p className="mt-1 text-sm text-slate-600">{audienceLabels[plan.audience]} · {formatXof(plan.price_xof)} · {plan.billing_interval}</p><p className="mt-1 text-xs text-slate-500">{plan.commerce_plan_benefits?.length || 0} avantage(s)</p></div><div className="flex flex-wrap gap-2"><button onClick={()=>editPlan(plan)} className="rounded-lg border px-3 py-2 text-sm font-semibold"><Edit3 size={15} className="mr-2 inline"/>Modifier</button>{plan.status!=='active'?<button disabled={busy} onClick={()=>changePlanStatus(plan,'active')} className="rounded-lg px-3 py-2 text-sm font-bold text-white" style={{background:BLUE}}>Publier</button>:<button disabled={busy} onClick={()=>changePlanStatus(plan,'paused')} className="rounded-lg border px-3 py-2 text-sm font-semibold">Suspendre</button>}</div></article>)}</div>
        </section>}
        {tab === 'benefits' && <section className="grid gap-8 xl:grid-cols-[420px_1fr]"><form onSubmit={saveBenefit} className="rounded-2xl border bg-white p-5" style={{borderColor:BORDER}}><h2 className="text-lg font-black" style={{color:BLUE}}>Créer une option</h2><div className="mt-4 space-y-3"><Field label="Clé technique"><input required value={benefitDraft.benefit_key} onChange={e=>setBenefitDraft({...benefitDraft,benefit_key:e.target.value.replace(/\s+/g,'_').toLowerCase()})}/></Field><Field label="Nom"><input required value={benefitDraft.name} onChange={e=>setBenefitDraft({...benefitDraft,name:e.target.value})}/></Field><Field label="Module"><input value={benefitDraft.module_key} onChange={e=>setBenefitDraft({...benefitDraft,module_key:e.target.value})}/></Field><Field label="Type de valeur"><select value={benefitDraft.value_type} onChange={e=>setBenefitDraft({...benefitDraft,value_type:e.target.value})}>{['boolean','quantity','percentage','amount','duration_days','capacity','credit','content_access','priority'].map(v=><option key={v}>{v}</option>)}</select></Field><Field label="Unité"><input value={benefitDraft.unit_label} onChange={e=>setBenefitDraft({...benefitDraft,unit_label:e.target.value})}/></Field><Field label="Description"><textarea rows={3} value={benefitDraft.description} onChange={e=>setBenefitDraft({...benefitDraft,description:e.target.value})}/></Field></div><button disabled={busy} className="mt-4 w-full rounded-xl py-2.5 text-sm font-bold text-white" style={{background:BLUE}}>Créer l’avantage</button></form><div><h2 className="font-black" style={{color:BLUE}}>Catalogue disponible</h2><div className="mt-4 divide-y">{data?.benefits.map(b=><div key={b.id} className="py-3"><div className="flex items-center justify-between gap-4"><div><p className="text-sm font-bold" style={{color:BLUE}}>{b.name}</p><p className="text-xs text-slate-500">{b.module_key} · {b.value_type} · {b.benefit_key}</p></div><span className="text-xs font-semibold text-slate-500">{b.is_system?'Système':'Personnalisé'}</span></div></div>)}</div></div></section>}
        {tab === 'offers' && <section className="space-y-3">{data?.creator_offers.length ? data.creator_offers.map(offer=><article key={offer.id} className="border-b border-slate-200 py-5"><div className="flex flex-col gap-4 md:flex-row md:items-center"><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-black" style={{color:BLUE}}>{offer.title}</h3><Status value={offer.status}/></div><p className="mt-1 text-sm text-slate-600">{offer.module_key==='coaching'?'Coaching':'Omnia Live'} · {offer.offer_kind} · {formatXof(offer.price_xof)}</p><p className="mt-2 text-sm text-slate-500">{offer.justification}</p>{offer.supporting_documents?.length>0&&<div className="mt-2 flex flex-wrap gap-2">{offer.supporting_documents.map((doc,index)=><a key={`${doc.path}-${index}`} href={doc.signed_url||'#'} target="_blank" rel="noreferrer" className="text-xs font-bold underline" style={{color:GOLD}}>{doc.name||`Justificatif ${index+1}`}</a>)}</div>}</div>{['submitted','under_review'].includes(offer.status)&&<button onClick={()=>{setReviewing(offer);setReviewForm({decision:'approve',approved_price_xof:String(offer.price_xof),approved_platform_percent:String(offer.proposed_platform_percent??20),reason:''})}} className="rounded-xl px-4 py-2.5 text-sm font-bold text-white" style={{background:BLUE}}>Contrôler</button>}</div></article>):<Empty text="Aucune offre créateur soumise."/>}</section>}
        {tab === 'commissions' && <section className="grid gap-8 xl:grid-cols-[420px_1fr]"><form onSubmit={saveCommission} className="rounded-2xl border bg-white p-5" style={{borderColor:BORDER}}><h2 className="text-lg font-black" style={{color:BLUE}}>Nouvelle règle</h2><Field label="Module"><select value={commissionDraft.module_key} onChange={e=>setCommissionDraft({...commissionDraft,module_key:e.target.value})}>{['global','courses','coaching','omnia_live','talent','career','projects'].map(v=><option key={v}>{v}</option>)}</select></Field><Field label="Commission plateforme %"><input type="number" min="0" max="100" value={commissionDraft.platform_percent} onChange={e=>setCommissionDraft({...commissionDraft,platform_percent:e.target.value})}/></Field><Field label="Frais fixes XOF"><input type="number" min="0" value={commissionDraft.fixed_fee_xof} onChange={e=>setCommissionDraft({...commissionDraft,fixed_fee_xof:e.target.value})}/></Field><Field label="Montant minimum XOF"><input type="number" min="0" value={commissionDraft.minimum_amount_xof} onChange={e=>setCommissionDraft({...commissionDraft,minimum_amount_xof:e.target.value})}/></Field><Field label="Priorité"><input type="number" value={commissionDraft.priority} onChange={e=>setCommissionDraft({...commissionDraft,priority:e.target.value})}/></Field><Field label="Justification obligatoire"><textarea required rows={4} value={commissionDraft.justification} onChange={e=>setCommissionDraft({...commissionDraft,justification:e.target.value})}/></Field><button disabled={busy} className="mt-4 w-full rounded-xl py-2.5 text-sm font-bold text-white" style={{background:BLUE}}>Enregistrer</button></form><div><h2 className="font-black" style={{color:BLUE}}>Règles actives</h2><div className="mt-3 divide-y">{data?.commission_rules?.map(r=><div key={r.id} className="py-4"><div className="flex justify-between gap-4"><div><p className="font-bold" style={{color:BLUE}}>{r.module_key}</p><p className="text-sm text-slate-600">{r.platform_percent}% plateforme{r.fixed_fee_xof?` + ${formatXof(r.fixed_fee_xof)}`:''}</p><p className="mt-1 text-xs text-slate-500">{r.justification}</p></div><Status value={r.status}/></div></div>)}</div></div></section>}
        {tab === 'promotions' && <section className="grid gap-8 xl:grid-cols-[420px_1fr]"><form onSubmit={savePromotion} className="rounded-2xl border bg-white p-5" style={{borderColor:BORDER}}><h2 className="text-lg font-black" style={{color:BLUE}}>Créer une promotion</h2><Field label="Code"><input value={promotionDraft.code} onChange={e=>setPromotionDraft({...promotionDraft,code:e.target.value.toUpperCase()})}/></Field><Field label="Nom"><input required value={promotionDraft.name} onChange={e=>setPromotionDraft({...promotionDraft,name:e.target.value})}/></Field><Field label="Type"><select value={promotionDraft.discount_type} onChange={e=>setPromotionDraft({...promotionDraft,discount_type:e.target.value})}><option value="percentage">Pourcentage</option><option value="fixed">Montant fixe</option><option value="credit">Crédit</option></select></Field><Field label="Valeur"><input required type="number" min="0" value={promotionDraft.discount_value} onChange={e=>setPromotionDraft({...promotionDraft,discount_value:e.target.value})}/></Field><Field label="Nombre maximal d’utilisations"><input type="number" min="1" value={promotionDraft.max_uses} onChange={e=>setPromotionDraft({...promotionDraft,max_uses:e.target.value})}/></Field><Field label="Fin de validité"><input type="datetime-local" value={promotionDraft.ends_at} onChange={e=>setPromotionDraft({...promotionDraft,ends_at:e.target.value})}/></Field><button disabled={busy} className="mt-4 w-full rounded-xl py-2.5 text-sm font-bold text-white" style={{background:BLUE}}>Créer</button></form><div><h2 className="font-black" style={{color:BLUE}}>Promotions</h2><div className="mt-3 divide-y">{data?.promotions?.map(p=><div key={p.id} className="py-4"><p className="font-bold" style={{color:BLUE}}>{p.name} {p.code&&<span className="font-mono text-xs">({p.code})</span>}</p><p className="text-sm text-slate-600">{p.discount_value} {p.discount_type==='percentage'?'%':'XOF'} · {p.used_count||0} utilisation(s)</p></div>)}</div></div></section>}
        {tab === 'stores' && <section className="space-y-7"><div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900"><div className="flex gap-3"><Smartphone size={20} className="shrink-0"/><p>Configurez uniquement des identifiants réels créés dans Google Play Console ou App Store Connect. Aucun produit fictif n’est ajouté automatiquement. Les achats mobiles restent indisponibles tant que le produit n’est pas actif et que sa vérification serveur n’est pas configurée.</p></div></div><form onSubmit={saveStoreProduct} className="rounded-2xl border bg-white p-5" style={{borderColor:BORDER}}><div className="flex items-center justify-between gap-4"><div><h2 className="font-black" style={{color:BLUE}}>{storeDraft.id?'Modifier le produit store':'Nouveau produit store'}</h2><p className="mt-1 text-xs text-slate-500">Association entre un identifiant officiel du store et un tarif ou abonnement Omnia.</p></div>{storeDraft.id&&<button type="button" onClick={()=>editStoreProduct()} aria-label="Annuler la modification"><X size={20}/></button>}</div><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3"><Field label="Plateforme"><select value={storeDraft.platform} onChange={e=>setStoreDraft({...storeDraft,platform:e.target.value})}><option value="android">Google Play — Android</option><option value="ios">App Store — iOS</option></select></Field><Field label="Identifiant officiel du produit"><input required value={storeDraft.store_product_id} onChange={e=>setStoreDraft({...storeDraft,store_product_id:e.target.value.trim()})} placeholder="Ex. omnia.course.10000"/></Field><Field label="Nom administratif"><input required value={storeDraft.display_name} onChange={e=>setStoreDraft({...storeDraft,display_name:e.target.value})}/></Field><Field label="Cible"><select value={storeDraft.target_kind} onChange={e=>{const target=e.target.value;setStoreDraft({...storeDraft,target_kind:target,product_type:target==='commerce_plan'?'subscription':'consumable',price_xof:target==='price_tier'?storeDraft.price_xof:'',commerce_plan_id:target==='commerce_plan'?storeDraft.commerce_plan_id:'',commerce_creator_offer_id:target==='creator_offer'?storeDraft.commerce_creator_offer_id:''})}}><option value="price_tier">Palier de prix XOF</option><option value="commerce_plan">Abonnement Omnia</option><option value="creator_offer">Offre créateur validée</option></select></Field><Field label="Type store"><select value={storeDraft.product_type} disabled={storeDraft.target_kind==='commerce_plan'||storeDraft.target_kind==='price_tier'} onChange={e=>setStoreDraft({...storeDraft,product_type:e.target.value})}><option value="consumable">Consommable</option><option value="non_consumable">Non consommable</option><option value="subscription">Abonnement</option></select></Field><Field label="Module"><select value={storeDraft.module_key} disabled={storeDraft.target_kind!=='price_tier'} onChange={e=>setStoreDraft({...storeDraft,module_key:e.target.value})}>{['global','formations','commerce','omnia_live','coaching'].map(v=><option key={v} value={v}>{v}</option>)}</select></Field>{storeDraft.target_kind==='price_tier'?<Field label="Montant exact XOF"><input required type="number" min="1" value={storeDraft.price_xof} onChange={e=>setStoreDraft({...storeDraft,price_xof:e.target.value})}/></Field>:storeDraft.target_kind==='commerce_plan'?<Field label="Plan Omnia"><select required value={storeDraft.commerce_plan_id} onChange={e=>setStoreDraft({...storeDraft,commerce_plan_id:e.target.value})}><option value="">Sélectionner</option>{data?.plans.filter(p=>p.status==='active').map(p=><option key={p.id} value={p.id}>{p.name} · {formatXof(p.price_xof)}</option>)}</select></Field>:<Field label="Offre créateur"><select required value={storeDraft.commerce_creator_offer_id} onChange={e=>{const offer=data?.creator_offers.find(item=>item.id===e.target.value);setStoreDraft({...storeDraft,commerce_creator_offer_id:e.target.value,product_type:offer?.offer_kind==='subscription'?'subscription':'consumable',module_key:offer?.module_key||'commerce'})}}><option value="">Sélectionner</option>{data?.creator_offers.filter(item=>['approved','published','paused'].includes(item.status)).map(item=><option key={item.id} value={item.id}>{item.title} · {item.offer_kind} · {formatXof(item.approved_price_xof??item.price_xof)}</option>)}</select></Field>}<Field label="Statut"><select value={storeDraft.status} onChange={e=>setStoreDraft({...storeDraft,status:e.target.value})}><option value="draft">Brouillon</option><option value="active">Actif</option><option value="paused">Suspendu</option><option value="retired">Retiré</option></select></Field><Field label="Notes de configuration"><textarea rows={3} value={storeDraft.notes} onChange={e=>setStoreDraft({...storeDraft,notes:e.target.value})}/></Field></div><button disabled={busy} className="mt-5 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50" style={{background:BLUE}}>{busy?'Enregistrement…':storeDraft.id?'Mettre à jour':'Enregistrer le produit'}</button></form><div><h2 className="font-black" style={{color:BLUE}}>Produits configurés</h2><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="border-b text-xs uppercase text-slate-500"><tr><th className="py-3">Plateforme</th><th>Produit</th><th>Cible</th><th>Montant / plan</th><th>Statut</th><th>Actions</th></tr></thead><tbody>{data?.store_products?.map(product=><tr key={product.id} className="border-b"><td className="py-3 font-semibold">{product.platform==='android'?'Google Play':'App Store'}</td><td><p className="font-semibold" style={{color:BLUE}}>{product.display_name}</p><p className="font-mono text-xs text-slate-500">{product.store_product_id}</p></td><td>{product.target_kind==='commerce_plan'?'Abonnement Omnia':product.target_kind==='creator_offer'?'Offre créateur':`${product.module_key} · ${product.product_type}`}</td><td>{product.target_kind==='commerce_plan'?(product.commerce_plans?.name||'Plan supprimé'):product.target_kind==='creator_offer'?(product.commerce_creator_offers?.title||'Offre supprimée'):formatXof(product.price_xof)}</td><td><Status value={product.status}/></td><td><div className="flex flex-wrap gap-2"><button disabled={busy} onClick={()=>editStoreProduct(product)} className="text-xs font-semibold" style={{color:BLUE}}>Modifier</button>{product.status!=='active'&&product.status!=='retired'&&<button disabled={busy} onClick={()=>changeStoreProductStatus(product.id,'active')} className="text-xs font-semibold text-green-700">Activer</button>}{product.status==='active'&&<button disabled={busy} onClick={()=>changeStoreProductStatus(product.id,'paused')} className="text-xs font-semibold text-amber-700">Suspendre</button>}{product.status!=='retired'&&<button disabled={busy} onClick={()=>changeStoreProductStatus(product.id,'retired')} className="text-xs font-semibold text-red-600">Retirer</button>}</div></td></tr>)}</tbody></table>{!data?.store_products?.length&&<Empty text="Aucun identifiant de produit store configuré."/>}</div></div></section>}
        {tab === 'subscriptions' && <section className="space-y-7"><form onSubmit={manualGrant} className="rounded-2xl border bg-white p-5" style={{borderColor:BORDER}}><h2 className="font-black" style={{color:BLUE}}>Attribuer un plan manuellement</h2><div className="mt-4 grid gap-4 md:grid-cols-3"><Field label="E-mail utilisateur"><input required type="email" value={grantDraft.email} onChange={e=>setGrantDraft({...grantDraft,email:e.target.value})}/></Field><Field label="Plan"><select required value={grantDraft.plan_id} onChange={e=>setGrantDraft({...grantDraft,plan_id:e.target.value})}><option value="">Sélectionner</option>{data?.plans.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field><Field label="Motif"><input required value={grantDraft.reason} onChange={e=>setGrantDraft({...grantDraft,reason:e.target.value})}/></Field></div><button disabled={busy} className="mt-4 rounded-xl px-4 py-2.5 text-sm font-bold text-white" style={{background:BLUE}}>Attribuer</button></form><div><h2 className="font-black" style={{color:BLUE}}>Souscriptions</h2><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b text-xs uppercase text-slate-500"><tr><th className="py-3">Utilisateur</th><th>Offre</th><th>Statut</th><th>Période</th><th>Actions</th></tr></thead><tbody>{data?.subscriptions.map(s=><tr key={s.id} className="border-b"><td className="py-3">{s.users?.full_name||s.users?.email||'Utilisateur'}</td><td>{s.commerce_plans?.name||s.commerce_creator_offers?.title}</td><td><Status value={s.status}/></td><td>{s.current_period_end?new Date(s.current_period_end).toLocaleDateString('fr-FR'):'Sans expiration'}</td><td><div className="flex gap-2">{s.status==='active'&&<button disabled={busy} onClick={()=>changeSubscriptionStatus(s.id,'paused')} className="text-xs font-semibold text-amber-700">Suspendre</button>}{s.status==='paused'&&<button disabled={busy} onClick={()=>changeSubscriptionStatus(s.id,'active')} className="text-xs font-semibold text-green-700">Réactiver</button>}{!['cancelled','expired','refunded'].includes(s.status)&&<button disabled={busy} onClick={()=>changeSubscriptionStatus(s.id,'cancelled')} className="text-xs font-semibold text-red-600">Annuler</button>}</div></td></tr>)}</tbody></table></div></div><div><h2 className="font-black" style={{color:BLUE}}>Paiements</h2><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="border-b text-xs uppercase text-slate-500"><tr><th className="py-3">Commande</th><th>Acheteur</th><th>Produit</th><th>Montant</th><th>Statut</th></tr></thead><tbody>{data?.orders.map(o=><tr key={o.id} className="border-b"><td className="py-3 font-mono text-xs">{o.order_number}</td><td>{o.users?.full_name||o.users?.email}</td><td>{o.commerce_plans?.name||o.commerce_creator_offers?.title}</td><td>{formatXof(o.final_amount_xof)}</td><td><Status value={o.payment_status}/></td></tr>)}</tbody></table></div></div></section>}
        {tab === 'payouts' && <section className="space-y-3">{data?.payouts.length?data.payouts.map(p=><article key={p.id} className="flex flex-col gap-4 border-b py-5 md:flex-row md:items-center"><div className="flex-1"><p className="font-black" style={{color:BLUE}}>{p.users?.full_name||p.users?.email}</p><p className="text-sm text-slate-600">{formatXof(p.amount_xof)} · {p.payout_method}</p><Status value={p.status}/></div>{['pending','under_review'].includes(p.status)&&<div className="flex gap-2"><button disabled={busy} onClick={()=>decidePayout(p,'approve')} className="rounded-lg border px-3 py-2 text-sm font-semibold">Valider</button><button disabled={busy} onClick={()=>decidePayout(p,'reject')} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600">Refuser</button></div>}{['approved','processing'].includes(p.status)&&<button disabled={busy} onClick={()=>decidePayout(p,'paid')} className="rounded-lg px-3 py-2 text-sm font-bold text-white" style={{background:BLUE}}>Marquer payé</button>}</article>):<Empty text="Aucune demande de retrait centrale."/>}</section>}
      </>}
    </div>
    {reviewing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"><form onSubmit={reviewOffer} className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl"><div className="flex justify-between"><div><p className="text-xs font-bold uppercase" style={{color:GOLD}}>Contrôle Super Admin</p><h2 className="text-xl font-black" style={{color:BLUE}}>{reviewing.title}</h2></div><button type="button" onClick={()=>setReviewing(null)}><X/></button></div>{reviewing.supporting_documents?.length>0&&<div className="mt-4 rounded-xl border bg-slate-50 p-3"><p className="text-sm font-bold" style={{color:BLUE}}>Justificatifs du créateur</p><div className="mt-2 flex flex-wrap gap-2">{reviewing.supporting_documents.map((doc,index)=><a key={`${doc.path}-${index}`} href={doc.signed_url||'#'} target="_blank" rel="noreferrer" className="text-xs font-bold underline" style={{color:GOLD}}>{doc.name||`Justificatif ${index+1}`}</a>)}</div></div>}<div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Décision"><select value={reviewForm.decision} onChange={e=>setReviewForm({...reviewForm,decision:e.target.value})}><option value="approve">Valider / proposer</option><option value="changes_requested">Demander des modifications</option><option value="reject">Refuser</option></select></Field><Field label="Prix validé XOF"><input type="number" value={reviewForm.approved_price_xof} onChange={e=>setReviewForm({...reviewForm,approved_price_xof:e.target.value})}/></Field><Field label="Commission plateforme %"><input type="number" min="0" max="100" value={reviewForm.approved_platform_percent} onChange={e=>setReviewForm({...reviewForm,approved_platform_percent:e.target.value})}/></Field></div><Field label="Motif obligatoire"><textarea required rows={4} value={reviewForm.reason} onChange={e=>setReviewForm({...reviewForm,reason:e.target.value})}/></Field><button disabled={busy} className="mt-4 w-full rounded-xl py-2.5 font-bold text-white" style={{background:BLUE}}>{busy?'Traitement…':'Enregistrer la décision'}</button></form></div>}
    {payoutDecision && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-labelledby="commerce-payout-title"><form onSubmit={confirmPayoutDecision} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase" style={{color:GOLD}}>Retrait central</p><h2 id="commerce-payout-title" className="text-xl font-black" style={{color:BLUE}}>{payoutDecision.decision==='paid'?'Confirmer le paiement réel':payoutDecision.decision==='reject'?'Refuser la demande':'Approuver la demande'}</h2><p className="mt-1 text-sm text-slate-600">{payoutDecision.payout.users?.full_name||payoutDecision.payout.users?.email||'Créateur'} · {formatXof(payoutDecision.payout.amount_xof)}</p></div><button type="button" onClick={()=>setPayoutDecision(null)} aria-label="Fermer"><X/></button></div>{payoutDecision.decision==='paid'&&<Field label="Référence réelle du paiement *"><input required value={payoutReference} onChange={e=>setPayoutReference(e.target.value)} placeholder="Référence FedaPay, banque ou opérateur"/></Field>}<Field label={payoutDecision.decision==='reject'?'Motif du refus *':'Note administrative'}><textarea required={payoutDecision.decision==='reject'} rows={4} value={payoutReason} onChange={e=>setPayoutReason(e.target.value)}/></Field><div className="mt-5 flex justify-end gap-3"><button type="button" disabled={busy} onClick={()=>setPayoutDecision(null)} className="rounded-xl border px-4 py-2 text-sm font-semibold">Annuler</button><button disabled={busy} className="rounded-xl px-4 py-2 text-sm font-bold text-white" style={{background:BLUE}}>{busy?'Traitement…':'Confirmer'}</button></div></form></div>}
  </AdminLayout>;
}

function Metric({ icon: Icon, label, value }: { icon: any; label: string; value: string }) { return <div className="border-b border-slate-200 py-4"><Icon size={20} style={{color:GOLD}}/><p className="mt-3 text-2xl font-black" style={{color:BLUE}}>{value}</p><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p></div> }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block text-sm font-semibold text-slate-700">{label}<div className="mt-1 [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:px-3 [&_input]:py-2 [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:px-3 [&_select]:py-2 [&_textarea]:w-full [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:px-3 [&_textarea]:py-2">{children}</div></label> }
function Status({ value }: { value: string }) { const good=['active','published','completed','paid','approved','trial'].includes(value); const bad=['failed','rejected','archived','cancelled'].includes(value); return <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-bold" style={{background:good?'#EAF8F0':bad?'#FFF0F0':'#FFF7E6',color:good?'#176B45':bad?'#B42318':'#8A5B00'}}>{statusLabels[value]||value}</span> }
function Empty({ text }: { text: string }) { return <div className="py-16 text-center text-sm text-slate-500">{text}</div> }
