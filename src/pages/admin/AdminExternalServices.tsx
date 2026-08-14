import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, AlertTriangle, BellRing, Bot, CheckCircle2, Clock3, Coins,
  CreditCard, Gauge, KeyRound, RefreshCw, Save, Server, ShieldCheck,
  Wallet, XCircle, Pencil, Trash2,
} from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import { edgeAuthHeaders } from '../../lib/edgeAuth';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dashboard-admin`;
const BLUE = '#002050';
const GOLD = '#BF8813';

type Tab = 'services' | 'finance' | 'automations' | 'governance';

type Provider = {
  id: string;
  label: string;
  configured: boolean | null;
  environment?: string;
  billing_model?: string;
  role?: string;
  usage_note?: string;
  management_path?: string;
  provider_balance_available?: boolean;
  admin_billing_configured?: boolean;
  sync?: {
    auto_sync_enabled?: boolean;
    last_attempt_at?: string | null;
    last_success_at?: string | null;
    last_error?: string | null;
    last_project_id?: string | null;
    last_project_name?: string | null;
    last_rows_synced?: number | null;
    metadata?: Record<string, any>;
  } | null;
  sync_attempt?: {
    success?: boolean;
    skipped?: boolean;
    reason?: string;
    rows_synced?: number;
    error?: string;
  } | null;
  recharge_automation?: {
    provider_managed?: boolean;
    provider_name?: string;
    auto_reload_supported?: boolean;
    transaction_sync_supported?: boolean;
    manual_fallback?: boolean;
    mode?: string;
    note?: string;
  };
  finance?: {
    tracked_balance?: Record<string, number>;
    recharges?: Record<string, number>;
    consumption?: Record<string, number>;
    quantities?: Record<string, number>;
  };
  budget?: any;
  finance_30d?: { consumption?: Record<string, number> };
  budget_status?: {
    currency?: string | null; monthly_budget?: number | null; consumption_30d?: number | null;
    remaining_budget?: number | null; low_balance_threshold?: number | null; tracked_balance?: number | null;
    low_balance_alert?: boolean; budget_exceeded?: boolean;
  };
  observed_usage_30d?: Record<string, unknown>;
  stream_configured?: boolean;
  r2_configured?: boolean;
  webhook_configured?: boolean;
  production_enabled?: boolean;
  production_ready?: boolean;
  configuration_scope?: string;
};

type GovernancePayload = {
  providers: Provider[];
  ledger: any[];
  budgets: any[];
  admin_audit: any[];
  automations: any[];
  notifications: Record<string, number | null>;
  security: Record<string, unknown>;
  admin_surfaces: Array<{ id: string; label: string; path: string; description: string }>;
  generated_at?: string;
};

const EMPTY: GovernancePayload = {
  providers: [], ledger: [], budgets: [], admin_audit: [], automations: [],
  notifications: {}, security: {}, admin_surfaces: [],
};

function formatNumber(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 4 }).format(number);
}

function dateTimeLocalValue(value: unknown) {
  if (!value) return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function statusLabel(provider: Provider) {
  if (provider.id === 'sentry' && provider.configured === null) {
    const localConfigured = Boolean(import.meta.env.VITE_SENTRY_DSN);
    return { ok: localConfigured, text: localConfigured ? 'Configuré au build' : 'DSN non configuré au build' };
  }
  if (provider.id === 'cloudflare') {
    const anyCloudflareService = provider.configured === true || provider.r2_configured === true || provider.stream_configured === true || provider.admin_billing_configured === true;
    return { ok: anyCloudflareService, text: anyCloudflareService ? 'Configuré' : 'Non configuré' };
  }
  if (provider.configured) return { ok: true, text: 'Configuré' };
  return { ok: false, text: 'Non configuré' };
}

function automaticStatus(provider: Provider) {
  const liveTelemetry = provider.sync_attempt?.reason === 'LIVE_PLATFORM_TELEMETRY';
  const providerApiReady = Boolean(provider.admin_billing_configured) || (provider.id === 'fedapay' && provider.configured === true);
  const ready = liveTelemetry || providerApiReady;
  const syncable = !['jaas', 'fcm', 'apns'].includes(provider.id);
  const lastSuccess = provider.sync?.last_success_at || null;
  return { liveTelemetry, providerApiReady, ready, syncable, lastSuccess };
}

function FinanceSummary({ provider }: { provider: Provider }) {
  const recharges = Object.entries(provider.finance?.recharges || {});
  const usage = Object.entries(provider.finance?.consumption || {});
  const auto = automaticStatus(provider);
  const observed = Object.keys(provider.observed_usage_30d || {}).length > 0;
  const rechargeText = recharges.length
    ? recharges.map(([c, v]) => `${formatNumber(v)} ${c}`).join(' · ')
    : provider.recharge_automation?.provider_managed
      ? 'Gérées par le fournisseur'
      : 'Non applicable';
  const usageText = usage.length
    ? usage.map(([c, v]) => `${formatNumber(v)} ${c}`).join(' · ')
    : (auto.ready || observed)
      ? 'Suivi automatique'
      : 'À configurer';
  const statusText = auto.liveTelemetry
    ? 'Temps réel OGA'
    : auto.lastSuccess
      ? `Synchronisé ${new Date(auto.lastSuccess).toLocaleDateString('fr-FR')}`
      : auto.ready
        ? 'Prêt à synchroniser'
        : 'Configuration requise';
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
      <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
        <p className="text-gray-500 font-semibold">Recharges / facturation</p>
        <p className="font-black mt-1" style={{ color: BLUE }}>{rechargeText}</p>
      </div>
      <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
        <p className="text-gray-500 font-semibold">Consommations / usage</p>
        <p className="font-black mt-1" style={{ color: BLUE }}>{usageText}</p>
      </div>
      <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
        <p className="text-gray-500 font-semibold">Synchronisation</p>
        <p className="font-black mt-1" style={{ color: BLUE }}>{statusText}</p>
      </div>
    </div>
  );
}

export default function AdminExternalServices() {
  const [tab, setTab] = useState<Tab>('services');
  const [data, setData] = useState<GovernancePayload>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [entryForm, setEntryForm] = useState<any>(null);
  const [budgetForm, setBudgetForm] = useState<any>(null);

  async function call(method: 'GET' | 'POST', body?: Record<string, unknown>) {
    const response = await fetch(
      method === 'GET' ? `${API}?action=external_services_governance` : API,
      {
        method,
        headers: edgeAuthHeaders(),
        body: method === 'POST' ? JSON.stringify(body || {}) : undefined,
      },
    );
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.success === false) throw new Error(result?.message || result?.error || 'Erreur de gouvernance');
    return result;
  }

  async function load() {
    setLoading(true); setError('');
    try { setData(await call('GET')); }
    catch (e) { setError(e instanceof Error ? e.message : 'Chargement impossible'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function saveLedger() {
    if (!entryForm?.provider || !entryForm?.entry_type) return;
    const editing = Boolean(entryForm?.id);
    setBusy('ledger'); setError(''); setMessage('');
    try {
      const result = await call('POST', { action: editing ? 'external_service_ledger_update' : 'external_service_ledger_add', ...entryForm });
      if (!result?.entry?.id) throw new Error(editing ? 'La modification n’a pas été confirmée par le serveur.' : 'La création n’a pas été confirmée par le serveur.');
      setEntryForm(null); setMessage(editing ? 'Saisie manuelle modifiée et auditée.' : 'Écriture enregistrée et auditée.'); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Enregistrement impossible'); }
    finally { setBusy(''); }
  }

  function editLedger(row: any) {
    if (row?.source !== 'manual') return;
    setTab('finance');
    setEntryForm({
      id: row.id, provider: row.provider, entry_type: row.entry_type, occurred_at: row.occurred_at,
      amount: row.amount ?? '', currency: row.currency || '', quantity: row.quantity ?? '', unit: row.unit || '',
      reference: row.reference || '', description: row.description || '', evidence: row.metadata?.evidence || '',
    });
  }

  async function deleteLedger(row: any) {
    if (row?.source !== 'manual' || !row?.id) return;
    const providerLabel = data.providers.find(p => p.id === row.provider)?.label || row.provider;
    if (!window.confirm(`Supprimer définitivement cette saisie manuelle ${providerLabel} ? Cette action sera journalisée.`)) return;
    setBusy(`ledger-delete:${row.id}`); setError(''); setMessage('');
    try {
      const result = await call('POST', { action: 'external_service_ledger_delete', id: row.id });
      if (result?.deleted_id !== row.id) throw new Error('La suppression n’a pas été confirmée par le serveur.');
      if (entryForm?.id === row.id) setEntryForm(null);
      setMessage('Saisie manuelle supprimée et auditée.');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Suppression impossible'); }
    finally { setBusy(''); }
  }

  async function syncProvider(provider: string) {
    setBusy(`sync:${provider}`); setError(''); setMessage('');
    try {
      const result = await call('POST', { action: 'external_service_provider_sync', provider });
      const sync = result?.sync || {};
      if (sync?.skipped === true) {
        const reason = String(sync?.reason || 'SYNC_SKIPPED');
        const labels: Record<string, string> = {
          CLOUDFLARE_BILLING_TOKEN_OR_ACCOUNT_MISSING: 'token Billing ou Account ID Cloudflare manquant',
          OPENAI_ADMIN_KEY_MISSING: 'clé Admin OpenAI manquante',
          ANTHROPIC_ADMIN_KEY_MISSING: 'clé Admin Anthropic manquante',
          BREVO_API_KEY_MISSING: 'clé API Brevo manquante',
          SENTRY_CONFIGURATION_MISSING: 'configuration Sentry incomplète',
          AUTO_SYNC_DISABLED: 'synchronisation automatique désactivée',
        };
        throw new Error(`Synchronisation non exécutée : ${labels[reason] || reason}.`);
      }
      const count = Number(sync?.rows_synced || 0);
      setMessage(`Synchronisation ${provider === 'openai' ? 'OpenAI' : provider} réussie · ${count} ligne(s) fournisseur traitée(s).`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Synchronisation impossible'); }
    finally { setBusy(''); }
  }

  async function saveBudget() {
    if (!budgetForm?.provider) return;
    setBusy('budget'); setError('');
    try {
      const result = await call('POST', { action: 'external_service_budget_save', ...budgetForm });
      if (!result?.budget || result.budget.provider !== budgetForm.provider) throw new Error('La sauvegarde du budget n’a pas été confirmée par le serveur.');
      setBudgetForm(null); setMessage('Budget et seuil enregistrés et confirmés par le serveur.'); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Enregistrement impossible'); }
    finally { setBusy(''); }
  }

  async function toggleCron(job: any) {
    const next = !job.enabled;
    const warning = next
      ? `Activer ${job.job_key} ? Cette tâche restera soumise au verrouillage, au temps maximal et au seuil d’échecs configurés.`
      : `Désactiver ${job.job_key} ?`;
    if (!window.confirm(warning)) return;
    setBusy(`cron:${job.job_key}`); setError('');
    try {
      await call('POST', {
        action: 'cron_control_update', job_key: job.job_key, enabled: next, confirmed: true,
        max_runtime_seconds: job.max_runtime_seconds, failure_threshold: job.failure_threshold,
      });
      setMessage(next ? 'Automatisation activée explicitement.' : 'Automatisation désactivée.'); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Modification impossible'); }
    finally { setBusy(''); }
  }

  const configuredCount = useMemo(() => data.providers.filter(p => statusLabel(p).ok).length, [data.providers]);
  const failedPush = Number(data.notifications?.fcm_failed_30d || 0) + Number(data.notifications?.apns_failed_30d || 0);

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-5 py-6 space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between border-b border-gray-200 pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em]" style={{ color: GOLD }}>Plateforme & gouvernance</p>
            <h1 className="text-2xl font-black mt-1" style={{ color: BLUE }}>Moteurs externes</h1>
            <p className="text-sm text-gray-500 mt-1 max-w-3xl">
              Supervision centrale des moteurs externes, consommations, recharges, quotas, automatisations et notifications. Les secrets restent exclusivement côté serveur.
            </p>
          </div>
          <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''}/> Actualiser
          </button>
        </div>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><strong>Erreur :</strong> {error}</div>}
        {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center justify-between"><span>{message}</span><button onClick={() => setMessage('')}><XCircle size={16}/></button></div>}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4"><Server size={20} style={{ color: GOLD }}/><p className="text-2xl font-black mt-2" style={{ color: BLUE }}>{configuredCount}/{data.providers.length || 9}</p><p className="text-xs text-gray-500">services configurés</p></div>
          <div className="rounded-xl border border-gray-200 bg-white p-4"><Clock3 size={20} style={{ color: GOLD }}/><p className="text-2xl font-black mt-2" style={{ color: BLUE }}>{data.automations.filter(j => j.enabled).length}</p><p className="text-xs text-gray-500">automatisations actives</p></div>
          <div className="rounded-xl border border-gray-200 bg-white p-4"><BellRing size={20} style={{ color: GOLD }}/><p className="text-2xl font-black mt-2" style={{ color: BLUE }}>{formatNumber(data.notifications?.queued || 0)}</p><p className="text-xs text-gray-500">notifications en file</p></div>
          <div className="rounded-xl border border-gray-200 bg-white p-4"><AlertTriangle size={20} style={{ color: failedPush ? '#B45309' : GOLD }}/><p className="text-2xl font-black mt-2" style={{ color: BLUE }}>{failedPush}</p><p className="text-xs text-gray-500">échecs push sur 30 j</p></div>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-gray-200">
          {([
            ['services', 'Moteurs externes', Server],
            ['finance', 'Recharges & consommations', Coins],
            ['automations', 'Automatisations & notifications', BellRing],
            ['governance', 'Administration & sécurité', ShieldCheck],
          ] as const).map(([key, label, Icon]) => (
            <button key={key} onClick={() => setTab(key)} className={`inline-flex items-center gap-2 px-3 py-2.5 text-sm font-bold border-b-2 ${tab === key ? 'border-current' : 'border-transparent text-gray-500'}`} style={tab === key ? { color: BLUE } : undefined}>
              <Icon size={16}/>{label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-gray-500">Chargement de la gouvernance…</div>
        ) : tab === 'services' ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {data.providers.map(provider => {
              const status = statusLabel(provider);
              return (
                <div key={provider.id} className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2"><h2 className="font-black" style={{ color: BLUE }}>{provider.label}</h2><span className={`text-[11px] font-bold px-2 py-1 rounded-full ${status.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{status.text}</span></div>
                      <p className="text-xs text-gray-500 mt-1">{provider.role}</p>
                    </div>
                    {status.ok ? <CheckCircle2 className="text-emerald-600" size={20}/> : <AlertTriangle className="text-amber-600" size={20}/>} 
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-gray-50 p-3"><p className="text-gray-500">Environnement</p><p className="font-bold mt-1" style={{ color: BLUE }}>{provider.environment || '—'}</p></div>
                    <div className="rounded-lg bg-gray-50 p-3"><p className="text-gray-500">Facturation</p><p className="font-bold mt-1" style={{ color: BLUE }}>{provider.billing_model || '—'}</p></div>
                  </div>
                  {provider.observed_usage_30d && <div className="rounded-lg border border-gray-100 p-3"><p className="text-xs font-bold text-gray-600 mb-2">Activité observée par OGA · 30 jours</p><div className="flex flex-wrap gap-2">{Object.entries(provider.observed_usage_30d).map(([key, value]) => <span key={key} className="text-xs rounded-md bg-gray-50 px-2 py-1 text-gray-600">{key.replaceAll('_',' ')} : <strong>{formatNumber(value)}</strong></span>)}</div></div>}
                  <FinanceSummary provider={provider}/>
                  {(() => {
                    const auto = automaticStatus(provider);
                    const syncError = provider.sync?.last_error || provider.sync_attempt?.error;
                    return (
                      <div className={`rounded-lg border p-3 text-xs ${auto.ready ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className={`font-black ${auto.ready ? 'text-emerald-900' : 'text-amber-900'}`}>
                              Suivi automatique prioritaire
                            </p>
                            {auto.liveTelemetry ? (
                              <p className="mt-1 text-emerald-800">Usage suivi automatiquement par la télémétrie OGA. Aucune saisie quotidienne n’est nécessaire.</p>
                            ) : auto.ready ? (
                              <p className="mt-1 text-emerald-800">
                                Synchronisation fournisseur prête.
                                {' '}Dernier succès : {provider.sync?.last_success_at ? new Date(provider.sync.last_success_at).toLocaleString('fr-FR') : 'pas encore exécuté'}.
                              </p>
                            ) : (
                              <p className="mt-1 text-amber-800">{provider.usage_note || 'La synchronisation automatique nécessite encore la configuration serveur du fournisseur.'}</p>
                            )}
                            {syncError && <p className="mt-1 text-red-700">Dernière erreur : {syncError}</p>}
                          </div>
                          {auto.syncable && (
                            <button
                              onClick={() => void syncProvider(provider.id)}
                              disabled={busy === `sync:${provider.id}`}
                              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-current px-3 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <RefreshCw size={14} className={busy === `sync:${provider.id}` ? 'animate-spin' : ''}/>Synchroniser maintenant
                            </button>
                          )}
                        </div>
                        <div className="mt-3 border-t border-current/10 pt-3">
                          <p className="font-bold">Facturation / recharges</p>
                          <p className="mt-1 leading-relaxed">{provider.recharge_automation?.note || 'Le fournisseur reste la source prioritaire. La saisie manuelle n’est utilisée qu’en secours.'}</p>
                          {provider.recharge_automation?.manual_fallback !== false && (
                            <p className="mt-1 font-semibold">Saisie manuelle disponible uniquement en secours ou pour un rapprochement exceptionnel.</p>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  {(provider.budget_status?.budget_exceeded || provider.budget_status?.low_balance_alert) && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-start gap-2">
                      <AlertTriangle size={15} className="shrink-0 mt-0.5"/>
                      <span>
                        {provider.budget_status?.budget_exceeded
                          ? `Budget mensuel dépassé${provider.budget_status.currency ? ` (${provider.budget_status.currency})` : ''}.`
                          : `Solde comptable de secours au niveau ou sous le seuil d’alerte${provider.budget_status?.currency ? ` (${provider.budget_status.currency})` : ''}.`}
                        {' '}Le fournisseur reste la source de vérité ; vérifiez sa console avant toute action.
                      </span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {provider.recharge_automation?.manual_fallback !== false && <button onClick={() => { setTab('finance'); setEntryForm({ provider: provider.id, entry_type: 'recharge', currency: provider.budget?.currency || 'EUR' }); }} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700"><Wallet size={14}/>Saisie de secours</button>}
                    <button onClick={() => { setTab('finance'); setBudgetForm({ provider: provider.id, monthly_budget: provider.budget?.monthly_budget ?? '', currency: provider.budget?.currency || 'EUR', low_balance_threshold: provider.budget?.low_balance_threshold ?? '', notes: provider.budget?.notes || '', enabled: provider.budget?.enabled !== false }); }} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700"><Gauge size={14}/>Budget & seuil</button>
                    {provider.management_path && provider.management_path !== '/admin/moteurs-services' && <Link to={provider.management_path} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700"><Activity size={14}/>Ouvrir l’espace métier</Link>}
                  </div>
                  {provider.usage_note && <p className="text-[11px] leading-relaxed text-gray-500">{provider.usage_note}</p>}
                </div>
              );
            })}
          </div>
        ) : tab === 'finance' ? (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4">
              <div><h2 className="font-black" style={{ color: BLUE }}>Suivi automatique des moteurs externes</h2><p className="text-xs text-gray-500 mt-1">Automatique par défaut : OGA synchronise les coûts, crédits, balances ou volumes via les API officielles disponibles et sa propre télémétrie. La saisie manuelle n’est qu’un secours si une synchronisation fournisseur est indisponible ou pour un rapprochement exceptionnel.</p></div>
              <button onClick={() => setEntryForm({ provider: data.providers[0]?.id || 'openai', entry_type: 'recharge', currency: 'EUR' })} className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold text-gray-700"><CreditCard size={15}/>Saisie de secours</button>
            </div>

            {entryForm && <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between"><div><h3 className="font-black" style={{ color: BLUE }}>{entryForm.id ? 'Modifier la saisie manuelle' : 'Saisie manuelle de secours'}</h3><p className="mt-1 text-xs text-amber-700">À utiliser uniquement si la synchronisation automatique du fournisseur ne permet pas de récupérer l’opération ou pour un rapprochement exceptionnel.</p></div><button onClick={() => setEntryForm(null)}><XCircle size={18} className="text-gray-400"/></button></div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <label className="text-xs font-semibold text-gray-600">Service<select value={entryForm.provider || ''} onChange={e => setEntryForm({ ...entryForm, provider: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 p-2.5 text-sm">{data.providers.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
                <label className="text-xs font-semibold text-gray-600">Type<select value={entryForm.entry_type || 'recharge'} onChange={e => setEntryForm({ ...entryForm, entry_type: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 p-2.5 text-sm"><option value="recharge">Recharge</option><option value="usage">Consommation</option><option value="refund">Remboursement</option><option value="adjustment">Ajustement</option></select></label>
                <label className="text-xs font-semibold text-gray-600">Montant<input type="number" min="0" step="0.000001" value={entryForm.amount ?? ''} onChange={e => setEntryForm({ ...entryForm, amount: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 p-2.5 text-sm" placeholder="ex. 50"/></label>
                <label className="text-xs font-semibold text-gray-600">Devise<input value={entryForm.currency || ''} onChange={e => setEntryForm({ ...entryForm, currency: e.target.value.toUpperCase() })} className="mt-1 w-full rounded-lg border border-gray-200 p-2.5 text-sm" placeholder="EUR"/></label>
                <label className="text-xs font-semibold text-gray-600">Quantité<input type="number" min="0" step="0.000001" value={entryForm.quantity ?? ''} onChange={e => setEntryForm({ ...entryForm, quantity: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 p-2.5 text-sm" placeholder="optionnel"/></label>
                <label className="text-xs font-semibold text-gray-600">Unité<input value={entryForm.unit || ''} onChange={e => setEntryForm({ ...entryForm, unit: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 p-2.5 text-sm" placeholder="tokens, emails, minutes…"/></label>
                <label className="text-xs font-semibold text-gray-600">Référence<input value={entryForm.reference || ''} onChange={e => setEntryForm({ ...entryForm, reference: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 p-2.5 text-sm" placeholder="facture / transaction"/></label>
                <label className="text-xs font-semibold text-gray-600">Date<input type="datetime-local" value={dateTimeLocalValue(entryForm.occurred_at)} onChange={e => setEntryForm({ ...entryForm, occurred_at: e.target.value ? new Date(e.target.value).toISOString() : '' })} className="mt-1 w-full rounded-lg border border-gray-200 p-2.5 text-sm"/></label>
              </div>
              <label className="text-xs font-semibold text-gray-600 block">Description / preuve<textarea value={entryForm.description || ''} onChange={e => setEntryForm({ ...entryForm, description: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 p-2.5 text-sm min-h-20" placeholder="Ex. opération confirmée par facture fournisseur, saisie car la synchronisation automatique était indisponible…"/></label>
              <button onClick={() => void saveLedger()} disabled={busy === 'ledger'} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-50" style={{ background: BLUE }}><Save size={15}/>{entryForm.id ? 'Enregistrer les modifications' : 'Enregistrer'}</button>
            </div>}

            {budgetForm && <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between"><h3 className="font-black" style={{ color: BLUE }}>Budget & alerte · {data.providers.find(p => p.id === budgetForm.provider)?.label}</h3><button onClick={() => setBudgetForm(null)}><XCircle size={18} className="text-gray-400"/></button></div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <label className="text-xs font-semibold text-gray-600">Budget mensuel<input type="number" min="0" step="0.01" value={budgetForm.monthly_budget ?? ''} onChange={e => setBudgetForm({ ...budgetForm, monthly_budget: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 p-2.5 text-sm"/></label>
                <label className="text-xs font-semibold text-gray-600">Devise<input value={budgetForm.currency || ''} onChange={e => setBudgetForm({ ...budgetForm, currency: e.target.value.toUpperCase() })} className="mt-1 w-full rounded-lg border border-gray-200 p-2.5 text-sm"/></label>
                <label className="text-xs font-semibold text-gray-600">Seuil solde bas<input type="number" min="0" step="0.01" value={budgetForm.low_balance_threshold ?? ''} onChange={e => setBudgetForm({ ...budgetForm, low_balance_threshold: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 p-2.5 text-sm"/></label>
                <label className="text-xs font-semibold text-gray-600">Notes<input value={budgetForm.notes || ''} onChange={e => setBudgetForm({ ...budgetForm, notes: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 p-2.5 text-sm"/></label>
              </div>
              <button onClick={() => void saveBudget()} disabled={busy === 'budget'} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-50" style={{ background: BLUE }}><Save size={15}/>Enregistrer le budget</button>
            </div>}

            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100"><h3 className="font-black" style={{ color: BLUE }}>Historique</h3></div>
              <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50 text-xs text-gray-500"><tr><th className="text-left px-4 py-3">Date</th><th className="text-left px-4 py-3">Service</th><th className="text-left px-4 py-3">Type</th><th className="text-left px-4 py-3">Source</th><th className="text-right px-4 py-3">Montant</th><th className="text-right px-4 py-3">Quantité</th><th className="text-left px-4 py-3">Référence</th><th className="text-right px-4 py-3">Actions</th></tr></thead><tbody>{data.ledger.length ? data.ledger.map(row => <tr key={row.id} className="border-t border-gray-100"><td className="px-4 py-3 whitespace-nowrap">{new Date(row.occurred_at).toLocaleString('fr-FR')}</td><td className="px-4 py-3 font-semibold">{data.providers.find(p => p.id === row.provider)?.label || row.provider}</td><td className="px-4 py-3">{row.entry_type}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${row.source === 'provider' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{row.source === 'provider' ? 'Fournisseur' : row.source === 'platform' ? 'OGA' : 'Manuel'}</span></td><td className="px-4 py-3 text-right">{row.amount == null ? '—' : `${formatNumber(row.amount)} ${row.currency}`}</td><td className="px-4 py-3 text-right">{row.quantity == null ? '—' : `${formatNumber(row.quantity)} ${row.unit || ''}`}</td><td className="px-4 py-3 text-gray-500">{row.reference || row.description || '—'}</td><td className="px-4 py-3"><div className="flex justify-end gap-1">{row.source === 'manual' ? <><button type="button" onClick={() => editLedger(row)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-bold text-gray-700" title="Modifier cette saisie manuelle"><Pencil size={13}/>Modifier</button><button type="button" onClick={() => void deleteLedger(row)} disabled={busy === `ledger-delete:${row.id}`} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1.5 text-xs font-bold text-red-700 disabled:opacity-50" title="Supprimer cette saisie manuelle"><Trash2 size={13}/>Supprimer</button></> : <span className="text-[11px] text-gray-400">Source externe</span>}</div></td></tr>) : <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-500">Aucune recharge ou consommation enregistrée.</td></tr>}</tbody></table></div>
            </div>
          </div>
        ) : tab === 'automations' ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
              <div><h2 className="font-black" style={{ color: BLUE }}>Tâches planifiées</h2><p className="text-xs text-gray-500 mt-1">Désactivées tant qu’elles ne sont pas activées explicitement. Le seuil d’échecs peut les couper automatiquement.</p></div>
              {data.automations.map(job => <div key={job.job_key} className="rounded-lg border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="font-bold" style={{ color: BLUE }}>{job.job_key}</p><p className="text-xs text-gray-500 mt-1">Durée max {job.max_runtime_seconds}s · arrêt après {job.failure_threshold} échec(s) consécutif(s)</p></div><button onClick={() => void toggleCron(job)} disabled={busy === `cron:${job.job_key}`} className={`rounded-full px-3 py-1 text-xs font-bold ${job.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{job.enabled ? 'Actif' : 'Désactivé'}</button></div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs"><span>Dernier succès : <strong>{job.last_success_at ? new Date(job.last_success_at).toLocaleString('fr-FR') : 'Jamais'}</strong></span><span>Échecs consécutifs : <strong>{job.consecutive_failures || 0}</strong></span></div>
                {job.last_error && <p className="mt-2 text-xs text-red-600">Dernière erreur : {job.last_error}</p>}
              </div>)}
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
              <div><h2 className="font-black" style={{ color: BLUE }}>Notifications</h2><p className="text-xs text-gray-500 mt-1">État réel de la file et livraisons enregistrées sur les 30 derniers jours.</p></div>
              <div className="grid grid-cols-2 gap-3">
                {[['File en attente', data.notifications.queued], ['E-mails', data.notifications.email_30d], ['SMS', data.notifications.sms_30d], ['Échecs e-mail/SMS', data.notifications.failures_30d], ['FCM envoyées', data.notifications.fcm_sent_30d], ['FCM échouées', data.notifications.fcm_failed_30d], ['APNs envoyées', data.notifications.apns_sent_30d], ['APNs échouées', data.notifications.apns_failed_30d]].map(([label, value]) => <div key={String(label)} className="rounded-lg bg-gray-50 border border-gray-100 p-3"><p className="text-xs text-gray-500">{label}</p><p className="text-xl font-black mt-1" style={{ color: BLUE }}>{formatNumber(value)}</p></div>)}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex gap-3"><ShieldCheck className="text-emerald-700 shrink-0"/><div><p className="font-black text-emerald-900">Secrets protégés</p><p className="text-xs text-emerald-800 mt-1">Cette console ne reçoit jamais les clés API, tokens, clés privées ni secrets webhook. Elle ne présente que leur état de configuration côté serveur.</p></div></div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {data.admin_surfaces.map(surface => <Link key={surface.id} to={surface.path} className="rounded-xl border border-gray-200 bg-white p-5 hover:shadow-sm transition-shadow"><div className="flex items-center gap-2"><KeyRound size={17} style={{ color: GOLD }}/><h3 className="font-black" style={{ color: BLUE }}>{surface.label}</h3></div><p className="text-xs text-gray-500 mt-2 leading-relaxed">{surface.description}</p></Link>)}
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="font-black" style={{ color: BLUE }}>Principes appliqués par le Lot 4</h2>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600">
                <p className="flex gap-2"><ShieldCheck size={16} className="text-emerald-600 shrink-0 mt-0.5"/>Aucun secret technique n’est exposé au navigateur.</p>
                <p className="flex gap-2"><Clock3 size={16} className="text-emerald-600 shrink-0 mt-0.5"/>Les Cron Jobs restent désactivés jusqu’à activation explicite.</p>
                <p className="flex gap-2"><CreditCard size={16} className="text-emerald-600 shrink-0 mt-0.5"/>FedaPay ne passe pas automatiquement en Production.</p>
                <p className="flex gap-2"><Bot size={16} className="text-emerald-600 shrink-0 mt-0.5"/>Les moteurs IA obsolètes ne doivent pas être réintroduits.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
