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
  requested_environment?: string;
  provider_api_authenticated?: boolean;
  components?: Array<{ id: string; label: string; configured: boolean; note?: string }>;
  balance_mode?: 'provider_not_exposed' | 'provider_credits' | 'not_applicable_postpaid' | 'merchant_balance_provider_units' | 'provider_console_only' | 'not_applicable' | string;
  balance_note?: string;
  provider_balances?: any[];
  provider_credit_plans?: any[];
  provider_credit_verticals?: any[];
  technical_usage_30d?: Record<string, number>;
  technical_usage_by_model_30d?: Record<string, Record<string, number>>;
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

type ServiceLevel = 'operational' | 'partial' | 'development' | 'error' | 'missing';

function hasLastSyncSuccess(provider: Provider) {
  return Boolean(provider.sync?.last_success_at && !provider.sync?.last_error);
}

function serviceStatus(provider: Provider): { level: ServiceLevel; text: string; detail: string } {
  const syncError = String(provider.sync?.last_error || provider.sync_attempt?.error || '').trim();
  const synced = hasLastSyncSuccess(provider);

  if (provider.id === 'sentry') {
    const dsnConfigured = Boolean(import.meta.env.VITE_SENTRY_DSN);
    if (dsnConfigured && provider.admin_billing_configured && synced) return { level: 'operational', text: 'Collecte & suivi actifs', detail: 'DSN Web/Capacitor et API Stats Sentry opérationnels.' };
    if (dsnConfigured && syncError) return { level: 'partial', text: 'Collecte active · suivi en erreur', detail: 'Les erreurs peuvent être envoyées à Sentry, mais l’import des volumes doit être corrigé.' };
    if (dsnConfigured) return { level: 'partial', text: 'Collecte active · stats non connectées', detail: 'Le DSN est intégré au build ; l’API Stats n’est pas encore entièrement opérationnelle.' };
    if (provider.admin_billing_configured) return { level: 'partial', text: 'Stats connectées · DSN build absent', detail: 'Le suivi serveur est configuré, mais le DSN de collecte n’est pas présent dans ce build.' };
    return { level: 'missing', text: 'À configurer', detail: 'Aucun DSN de collecte détecté dans ce build et aucune API Stats configurée.' };
  }

  if (provider.id === 'jaas') {
    if (provider.production_ready) return { level: 'operational', text: 'JaaS production prêt', detail: 'Infrastructure visioconférence prête pour Omnia Live.' };
    if (provider.environment === 'development_fallback') return { level: 'development', text: 'Fallback développement actif', detail: 'Les tests peuvent utiliser Jitsi public, mais JaaS production n’est pas encore prêt.' };
    return { level: 'missing', text: 'JaaS production à configurer', detail: 'Aucune infrastructure JaaS de production complète détectée.' };
  }

  if (provider.id === 'fcm') {
    return provider.configured
      ? { level: 'operational', text: 'Prêt Android', detail: 'Identifiants Firebase disponibles ; les livraisons sont suivies par OGA.' }
      : { level: 'missing', text: 'À configurer avant publication Android', detail: 'Les identifiants Firebase requis ne sont pas tous présents.' };
  }

  if (provider.id === 'apns') {
    if (!provider.configured) return { level: 'missing', text: 'À configurer avant publication iOS', detail: 'Les identifiants APNs requis ne sont pas tous présents.' };
    if (provider.environment === 'production') return { level: 'operational', text: 'Prêt iOS', detail: 'APNs est configuré pour la production.' };
    return { level: 'development', text: 'APNs Sandbox configuré', detail: 'La configuration Push iOS existe mais reste en environnement Sandbox.' };
  }

  if (provider.id === 'fedapay') {
    if (!provider.configured) return { level: 'missing', text: 'Clé FedaPay absente', detail: 'La clé de l’environnement actif doit être configurée.' };
    if (syncError) return { level: 'error', text: 'Clé présente · authentification en échec', detail: syncError };
    if (synced) {
      return provider.environment === 'sandbox'
        ? { level: 'operational', text: 'Sandbox opérationnel', detail: 'Authentification fournisseur validée en Sandbox. Le passage Production reste volontairement bloqué.' }
        : { level: 'operational', text: 'Production opérationnelle', detail: 'Authentification fournisseur validée sur l’environnement actif.' };
    }
    return { level: 'partial', text: 'Clé présente · test requis', detail: 'La configuration est détectée mais aucune synchronisation fournisseur réussie ne la valide encore.' };
  }

  if (provider.id === 'cloudflare') {
    const configuredParts = [provider.r2_configured, provider.stream_configured, provider.admin_billing_configured].filter(Boolean).length;
    if (configuredParts === 0) return { level: 'missing', text: 'À configurer', detail: 'R2, Stream et Billing sont actuellement non configurés.' };
    if (syncError && provider.admin_billing_configured) return { level: 'partial', text: 'Services actifs · Billing en erreur', detail: syncError };
    if (configuredParts === 3 && synced) return { level: 'operational', text: 'R2 · Stream · Billing actifs', detail: 'Les trois composantes Cloudflare nécessaires sont détectées et la facturation est synchronisée.' };
    return { level: 'partial', text: 'Partiellement configuré', detail: `${configuredParts}/3 composantes Cloudflare détectées. R2, Stream et Billing sont contrôlés séparément.` };
  }

  if (provider.id === 'openai' || provider.id === 'anthropic') {
    if (!provider.configured && !provider.admin_billing_configured) return { level: 'missing', text: 'Non configuré', detail: 'API applicative et suivi Admin absents.' };
    if (provider.configured && provider.admin_billing_configured && syncError) return { level: 'partial', text: 'Service actif · suivi en erreur', detail: syncError };
    if (provider.configured && provider.admin_billing_configured && synced) {
      const usageStatus = String(provider.sync?.metadata?.usage_status || '');
      return usageStatus === 'partial' || usageStatus === 'unavailable'
        ? { level: 'partial', text: 'Service actif · usage partiel', detail: 'Les coûts sont synchronisés mais certaines métriques d’usage ne sont pas encore disponibles.' }
        : { level: 'operational', text: 'Service & suivi opérationnels', detail: 'API applicative, coûts et usage technique sont suivis.' };
    }
    if (provider.configured) return { level: 'partial', text: 'Service actif · suivi à compléter', detail: 'L’API applicative est présente, mais le suivi Admin n’est pas entièrement opérationnel.' };
    return { level: 'partial', text: 'Suivi configuré · API applicative absente', detail: 'Le suivi Admin est détecté sans clé applicative OGA.' };
  }

  if (provider.id === 'brevo') {
    if (!provider.configured) return { level: 'missing', text: 'Non configuré', detail: 'La clé API Brevo est absente.' };
    if (syncError) return { level: 'error', text: 'Clé présente · API en erreur', detail: syncError };
    return synced
      ? { level: 'operational', text: 'Compte synchronisé', detail: 'Compte, plan/crédits et activité OGA sont suivis.' }
      : { level: 'partial', text: 'Clé présente · test requis', detail: 'La clé est détectée mais aucune synchronisation réussie récente ne la valide.' };
  }

  if (provider.configured) return { level: 'operational', text: 'Configuré', detail: 'Service configuré.' };
  return { level: 'missing', text: 'Non configuré', detail: 'Configuration requise.' };
}

function statusClasses(level: ServiceLevel) {
  if (level === 'operational') return { pill: 'bg-emerald-50 text-emerald-700', icon: 'text-emerald-600', panel: 'border-emerald-200 bg-emerald-50', panelText: 'text-emerald-900' };
  if (level === 'error') return { pill: 'bg-red-50 text-red-700', icon: 'text-red-600', panel: 'border-red-200 bg-red-50', panelText: 'text-red-900' };
  if (level === 'development') return { pill: 'bg-sky-50 text-sky-700', icon: 'text-sky-600', panel: 'border-sky-200 bg-sky-50', panelText: 'text-sky-900' };
  if (level === 'partial') return { pill: 'bg-amber-50 text-amber-700', icon: 'text-amber-600', panel: 'border-amber-200 bg-amber-50', panelText: 'text-amber-900' };
  return { pill: 'bg-gray-100 text-gray-600', icon: 'text-gray-400', panel: 'border-gray-200 bg-gray-50', panelText: 'text-gray-700' };
}

function automaticStatus(provider: Provider) {
  const liveTelemetry = provider.sync_attempt?.reason === 'LIVE_PLATFORM_TELEMETRY';
  const providerApiReady = Boolean(provider.admin_billing_configured) || (provider.id === 'fedapay' && provider.configured === true);
  const status = serviceStatus(provider);
  const ready = status.level !== 'missing' && status.level !== 'error';
  const syncable = !['jaas', 'fcm', 'apns'].includes(provider.id);
  const lastSuccess = provider.sync?.last_success_at || null;
  return { liveTelemetry, providerApiReady, ready, syncable, lastSuccess, status };
}

const USAGE_LABELS: Record<string, string> = {
  input_tokens: 'Tokens entrée',
  output_tokens: 'Tokens sortie',
  cached_input_tokens: 'Tokens cache lus',
  cache_read_input_tokens: 'Tokens cache lus',
  cache_write_tokens: 'Tokens cache écrits',
  cache_creation_input_tokens: 'Tokens cache créés',
  uncached_input_tokens: 'Tokens entrée hors cache',
  model_requests: 'Requêtes modèle',
  images: 'Images',
  tts_characters: 'Caractères TTS',
  audio_seconds: 'Secondes audio',
  storage_bytes: 'Octets stockage',
  sessions: 'Sessions',
  tool_requests: 'Appels outils',
  server_tool_web_search_requests: 'Recherches Web serveur',
  server_tool_web_fetch_requests: 'Récupérations Web serveur',
  emails_sent_or_logged: 'E-mails',
  sms_sent_or_logged: 'SMS',
  failures: 'Échecs',
  sent: 'Envoyées',
  failed: 'Échouées',
  rooms_created: 'Salles créées',
  stream_media_created: 'Médias Stream créés',
  course_orders: 'Commandes formations',
  live_orders: 'Commandes Live',
};

function usageLabel(key: string) {
  if (key === 'events_total') return 'Événements Sentry';
  if (key.startsWith('events_')) return `Sentry · ${key.slice('events_'.length).replaceAll('_', ' ')}`;
  return USAGE_LABELS[key] || key.replaceAll('_', ' ');
}

function usageValue(key: string, value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  if (key.includes('tokens') || key.startsWith('events_') || key.startsWith('server_tool_') || ['model_requests', 'images', 'tts_characters', 'audio_seconds', 'storage_bytes', 'sessions', 'tool_requests', 'sent', 'failed', 'failures', 'rooms_created', 'course_orders', 'live_orders'].includes(key)) {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(number);
  }
  return formatNumber(number);
}

function trackedBalanceText(provider: Provider) {
  const tracked = Object.entries(provider.finance?.tracked_balance || {});
  const recharges = Object.entries(provider.finance?.recharges || {});
  if (provider.balance_mode === 'not_applicable' || provider.balance_mode === 'not_applicable_postpaid') return 'Pas de recharge';
  if (provider.balance_mode === 'provider_console_only') return tracked.length ? tracked.map(([c, v]) => `Suivi OGA ${formatNumber(v)} ${c}`).join(' · ') : 'Voir console fournisseur';
  if (provider.balance_mode === 'provider_credits') {
    const credits = [...(provider.provider_credit_plans || []), ...(provider.provider_credit_verticals || [])]
      .filter(item => item?.credits != null)
      .map(item => `${formatNumber(item.credits)}${item.credits_type ? ` ${item.credits_type}` : ' crédits'}`);
    return credits.length ? credits.join(' · ') : 'Plan synchronisé';
  }
  if (provider.balance_mode === 'merchant_balance_provider_units') {
    return provider.provider_balances?.length ? `${provider.provider_balances.length} solde(s) marchand synchronisé(s)` : 'Solde marchand à synchroniser';
  }
  if (recharges.length || tracked.length) {
    const values = tracked.length ? tracked : recharges;
    return values.map(([c, v]) => `Suivi OGA ${formatNumber(v)} ${c}`).join(' · ');
  }
  return 'Solde fournisseur non exposé par l’API';
}

function technicalUsageEntries(provider: Provider) {
  return Object.entries(provider.technical_usage_30d || {}).filter(([, value]) => Number.isFinite(Number(value)) && Number(value) !== 0);
}

function FinanceSummary({ provider }: { provider: Provider }) {
  const usage = Object.entries(provider.finance_30d?.consumption || {});
  const technical = technicalUsageEntries(provider);
  const auto = automaticStatus(provider);
  const costText = usage.length
    ? usage.map(([c, v]) => `${formatNumber(v)} ${c}`).join(' · ')
    : auto.ready ? '0 coût synchronisé sur 30 j' : 'À synchroniser';
  const technicalText = technical.length
    ? technical.slice(0, 2).map(([key, value]) => `${usageLabel(key)} : ${usageValue(key, value)}`).join(' · ')
    : (provider.id === 'openai' || provider.id === 'anthropic') && provider.admin_billing_configured
      ? 'Aucun usage technique sur 30 j'
      : 'Selon disponibilité fournisseur';
  const statusText = provider.sync?.last_error
    ? 'Dernière synchro en erreur'
    : auto.liveTelemetry
      ? 'Télémétrie OGA'
      : auto.lastSuccess
        ? `Succès ${new Date(auto.lastSuccess).toLocaleDateString('fr-FR')}`
        : auto.providerApiReady
          ? 'Prêt à tester'
          : 'Configuration requise';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 text-xs">
      <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
        <p className="text-gray-500 font-semibold">Solde / crédits / quota</p>
        <p className="font-black mt-1" style={{ color: BLUE }}>{trackedBalanceText(provider)}</p>
      </div>
      <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
        <p className="text-gray-500 font-semibold">Coûts · 30 jours</p>
        <p className="font-black mt-1" style={{ color: BLUE }}>{costText}</p>
      </div>
      <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
        <p className="text-gray-500 font-semibold">Usage technique · 30 jours</p>
        <p className="font-black mt-1" style={{ color: BLUE }}>{technicalText}</p>
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
  const [aiDiagnostics, setAiDiagnostics] = useState<Record<string, any>>({});
  const [aiDiagnosticRunning, setAiDiagnosticRunning] = useState('');

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

  async function testAiCapability(capability: string) {
    setAiDiagnosticRunning(capability); setError('');
    try {
      const result = await call('POST', { action: 'application_ai_diagnostic', capability });
      setAiDiagnostics(previous => ({ ...previous, [capability]: result }));
    } catch (e) { setError(e instanceof Error ? e.message : 'Diagnostic IA impossible'); }
    finally { setAiDiagnosticRunning(''); }
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
          OPENAI_ADMIN_KEY_NOT_CONFIGURED: 'clé Admin OpenAI manquante',
          ANTHROPIC_ADMIN_KEY_NOT_CONFIGURED: 'clé Admin Anthropic manquante',
          BREVO_API_KEY_NOT_CONFIGURED: 'clé API Brevo manquante',
          FEDAPAY_SECRET_KEY_NOT_CONFIGURED: 'clé FedaPay de l’environnement actif manquante',
          SENTRY_TOKEN_OR_ORG_NOT_CONFIGURED: 'token Sentry ou organisation Sentry manquant',
          AUTO_SYNC_DISABLED: 'synchronisation automatique désactivée',
          RECENT_SYNC: 'une synchronisation récente existe déjà',
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

  const configuredCount = useMemo(() => data.providers.filter(p => serviceStatus(p).level !== 'missing').length, [data.providers]);
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

        <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3" aria-label="Diagnostic des clés IA applicatives">
          <div>
            <h2 className="font-black" style={{ color: BLUE }}>Diagnostic IA applicatif</h2>
            <p className="text-xs text-gray-600">Vérification des clés utilisées par les Edge Functions, indépendamment des clés administratives de facturation. Les tests actifs consomment potentiellement des crédits. Aucune clé n’est affichée.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {([
              ['anthropic_fast','Anthropic rapide'], ['anthropic_quality','Anthropic qualité'],
              ['openai_text','OpenAI texte'], ['openai_embeddings','OpenAI embeddings'],
              ['openai_images','OpenAI images'], ['openai_tts','OpenAI synthèse vocale'],
              ['openai_transcription','OpenAI transcription'],
            ] as const).map(([id,label]) => {
              const result=aiDiagnostics[id];
              return <div key={id} className="rounded-lg border border-gray-200 p-3 space-y-2">
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-xs text-gray-500">{!result ? 'Non vérifié' : !result.configured ? 'Clé applicative absente' : result.verified ? 'Test API réussi' : result.note ? 'Clé présente — appel non testé' : `Échec : ${result.error || 'réponse invalide'}`}</p>
                {result && <p className="text-[11px] text-gray-500">{result.model} · {result.elapsed_ms} ms · {result.checked_at}</p>}
                <button type="button" className="rounded-md border border-gray-300 px-2 py-1 text-xs font-bold disabled:opacity-50" disabled={Boolean(aiDiagnosticRunning)} onClick={() => void testAiCapability(id)}>{aiDiagnosticRunning === id ? 'Vérification…' : 'Vérifier'}</button>
              </div>;
            })}
          </div>
        </section>

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
              const status = serviceStatus(provider);
              const statusStyle = statusClasses(status.level);
              const technical = technicalUsageEntries(provider);
              const modelUsage = Object.entries(provider.technical_usage_by_model_30d || {})
                .filter(([, metrics]) => Object.values(metrics || {}).some(value => Number(value) > 0))
                .sort((a, b) => Number(b[1]?.input_tokens || 0) + Number(b[1]?.output_tokens || 0) - Number(a[1]?.input_tokens || 0) - Number(a[1]?.output_tokens || 0))
                .slice(0, 6);
              const auto = automaticStatus(provider);
              const syncError = provider.sync?.last_error || provider.sync_attempt?.error;
              return (
                <div key={provider.id} className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-black" style={{ color: BLUE }}>{provider.label}</h2>
                        <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${statusStyle.pill}`}>{status.text}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{provider.role}</p>
                      <p className="text-[11px] font-semibold mt-1 text-gray-500">{status.detail}</p>
                    </div>
                    {status.level === 'operational'
                      ? <CheckCircle2 className={statusStyle.icon} size={20}/>
                      : status.level === 'error'
                        ? <XCircle className={statusStyle.icon} size={20}/>
                        : <AlertTriangle className={statusStyle.icon} size={20}/>}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-gray-50 p-3">
                      <p className="text-gray-500">Environnement</p>
                      <p className="font-bold mt-1" style={{ color: BLUE }}>{provider.environment || '—'}</p>
                      {provider.requested_environment && provider.requested_environment !== provider.environment && <p className="mt-1 text-[10px] text-amber-700">Demandé : {provider.requested_environment}</p>}
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3">
                      <p className="text-gray-500">Facturation</p>
                      <p className="font-bold mt-1" style={{ color: BLUE }}>{provider.billing_model || '—'}</p>
                    </div>
                  </div>

                  {provider.components?.length ? (
                    <div className="rounded-lg border border-gray-100 p-3">
                      <p className="text-xs font-bold text-gray-600 mb-2">Configuration détaillée</p>
                      <div className="flex flex-wrap gap-2">
                        {provider.components.map(component => (
                          <span key={component.id} className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-bold ${component.configured ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                            {component.configured ? <CheckCircle2 size={12}/> : <XCircle size={12}/>}
                            {component.label}
                          </span>
                        ))}
                        {provider.id === 'sentry' && (
                          <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-bold ${import.meta.env.VITE_SENTRY_DSN ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                            {import.meta.env.VITE_SENTRY_DSN ? <CheckCircle2 size={12}/> : <XCircle size={12}/>}
                            DSN collecte Web/Capacitor
                          </span>
                        )}
                      </div>
                    </div>
                  ) : null}

                  <FinanceSummary provider={provider}/>

                  {technical.length > 0 && (
                    <div className="rounded-lg border border-gray-100 p-3">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <p className="text-xs font-bold text-gray-600">Consommation technique réelle · 30 jours</p>
                        {(provider.id === 'openai' || provider.id === 'anthropic') && provider.sync?.metadata?.usage_status && (
                          <span className={`text-[10px] font-black rounded-full px-2 py-1 ${provider.sync.metadata.usage_status === 'complete' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                            Usage {provider.sync.metadata.usage_status === 'complete' ? 'complet' : 'partiel'}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {technical.map(([key, value]) => (
                          <span key={key} className="text-xs rounded-md bg-gray-50 px-2 py-1 text-gray-600">
                            {usageLabel(key)} : <strong>{usageValue(key, value)}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {modelUsage.length > 0 && (
                    <div className="rounded-lg border border-gray-100 p-3">
                      <p className="text-xs font-bold text-gray-600 mb-2">Usage par modèle · 30 jours</p>
                      <div className="space-y-1.5">
                        {modelUsage.map(([model, metrics]) => (
                          <div key={model} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-gray-50 px-2.5 py-2 text-[11px]">
                            <span className="font-bold text-gray-700">{model}</span>
                            <span className="text-gray-500">
                              {Number(metrics.input_tokens || 0) > 0 ? `Entrée ${usageValue('input_tokens', metrics.input_tokens)}` : ''}
                              {Number(metrics.output_tokens || 0) > 0 ? `${Number(metrics.input_tokens || 0) > 0 ? ' · ' : ''}Sortie ${usageValue('output_tokens', metrics.output_tokens)}` : ''}
                              {Number(metrics.model_requests || 0) > 0 ? ` · ${usageValue('model_requests', metrics.model_requests)} requête(s)` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {provider.observed_usage_30d && Object.keys(provider.observed_usage_30d).length > 0 && (
                    <div className="rounded-lg border border-gray-100 p-3">
                      <p className="text-xs font-bold text-gray-600 mb-2">Activité observée par OGA · 30 jours</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(provider.observed_usage_30d).map(([key, value]) => (
                          <span key={key} className="text-xs rounded-md bg-gray-50 px-2 py-1 text-gray-600">{usageLabel(key)} : <strong>{formatNumber(value)}</strong></span>
                        ))}
                      </div>
                    </div>
                  )}

                  {provider.balance_note && (
                    <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2 text-[11px] leading-relaxed text-blue-900">
                      <strong>Solde :</strong> {provider.balance_note}
                    </div>
                  )}

                  <div className={`rounded-lg border p-3 text-xs ${statusStyle.panel}`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className={`font-black ${statusStyle.panelText}`}>Suivi automatique prioritaire</p>
                        {auto.liveTelemetry ? (
                          <p className="mt-1 text-gray-700">Usage suivi par la télémétrie OGA. Aucune saisie quotidienne n’est nécessaire.</p>
                        ) : (
                          <p className="mt-1 text-gray-700">
                            {provider.sync?.last_success_at
                              ? `Dernier succès fournisseur : ${new Date(provider.sync.last_success_at).toLocaleString('fr-FR')}.`
                              : provider.admin_billing_configured || provider.configured
                                ? 'Configuration détectée. Lancez la synchronisation pour valider l’accès fournisseur.'
                                : provider.usage_note || 'La synchronisation automatique nécessite encore une configuration serveur.'}
                          </p>
                        )}
                        {syncError && <p className="mt-1 font-semibold text-red-700">Dernière erreur : {syncError}</p>}
                        {provider.sync?.metadata?.usage_error && <p className="mt-1 font-semibold text-amber-700">Usage technique : {String(provider.sync.metadata.usage_error)}</p>}
                        {Array.isArray(provider.sync?.metadata?.usage_errors) && provider.sync.metadata.usage_errors.length > 0 && (
                          <p className="mt-1 font-semibold text-amber-700">{provider.sync.metadata.usage_errors.length} surface(s) d’usage n’ont pas pu être lues ; les métriques disponibles restent affichées.</p>
                        )}
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
