import { getSessionToken } from '../../lib/session';
import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { ENDPOINTS } from '../../lib/config';
import { CreditCard, Save, ShieldCheck, RefreshCw, Gift, Power } from 'lucide-react';
import { invalidatePublicSiteSettingsCache } from '../../lib/siteSettingsCache';

type Settings = {
  payout_minimum_xof: string;
  payout_delay_label: string;
  referral_enabled: boolean;
  referral_reward_referrer_xof: string;
  referral_reward_referred_xof: string;
  canal_mobile_money: boolean;
  canal_virement_uemoa: boolean;
  canal_swift: boolean;
};

const DEFAULTS: Settings = {
  payout_minimum_xof: '5000',
  payout_delay_label: '24 à 48 heures ouvrées',
  referral_enabled: false,
  referral_reward_referrer_xof: '0',
  referral_reward_referred_xof: '0',
  canal_mobile_money: true,
  canal_virement_uemoa: true,
  canal_swift: false,
};

const asBool = (value: unknown, fallback: boolean) =>
  value === true || value === 'true' ? true : value === false || value === 'false' ? false : fallback;

export default function AdminFintech() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [provider, setProvider] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const token = () => getSessionToken() || '';
  const headers = () => ({
    Authorization: `Bearer ${token()}`,
    'x-omnia-session-token': token(),
  });

  function notify(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 3500);
  }

  async function load() {
    try {
      const [settingsResponse, providerResponse] = await Promise.all([
        fetch(ENDPOINTS.adminCmsUpdate, { headers: headers() }),
        fetch(ENDPOINTS.paymentProviderStatus, { headers: headers() }),
      ]);

      if (settingsResponse.ok) {
        const data = await settingsResponse.json();
        const map: Record<string, unknown> = {};
        (data.settings || []).forEach((row: { key: string; value: unknown }) => {
          map[row.key] = row.value;
        });

        setSettings({
          payout_minimum_xof: String(map.payout_minimum_xof ?? DEFAULTS.payout_minimum_xof),
          payout_delay_label: String(map.payout_delay_label ?? DEFAULTS.payout_delay_label),
          referral_enabled: asBool(map.referral_enabled, false),
          referral_reward_referrer_xof: String(map.referral_reward_referrer_xof ?? '0'),
          referral_reward_referred_xof: String(map.referral_reward_referred_xof ?? '0'),
          canal_mobile_money: asBool(map.canal_mobile_money, true),
          canal_virement_uemoa: asBool(map.canal_virement_uemoa, true),
          canal_swift: asBool(map.canal_swift, false),
        });
      }

      if (providerResponse.ok) setProvider(await providerResponse.json());
    } catch {
      notify('Impossible de charger certains paramètres financiers.');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    const referrerReward = Number(settings.referral_reward_referrer_xof);
    const referredReward = Number(settings.referral_reward_referred_xof);

    if (!Number.isFinite(referrerReward) || referrerReward < 0 || !Number.isInteger(referrerReward)) {
      notify('La récompense du parrain doit être un montant entier positif ou nul.');
      return;
    }
    if (!Number.isFinite(referredReward) || referredReward < 0 || !Number.isInteger(referredReward)) {
      notify("L'avantage du filleul doit être un montant entier positif ou nul.");
      return;
    }
    if (settings.referral_enabled && referrerReward === 0 && referredReward === 0) {
      notify('Définissez au moins un montant avant d’activer le parrainage.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(ENDPOINTS.adminCmsUpdate, {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: Object.entries(settings).map(([key, value]) => ({
            key,
            value: String(value),
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Enregistrement impossible');

      invalidatePublicSiteSettingsCache();
      notify(settings.referral_enabled
        ? 'Paramètres enregistrés. Le parrainage est activé.'
        : 'Paramètres enregistrés. Le parrainage reste désactivé.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  const activeProvider = provider?.providers?.find((item: any) => item.id === provider?.active_provider);

  return (
    <AdminLayout>
      <div className="mx-auto max-w-6xl space-y-7 px-6 py-6">
        {toast && <div className="fixed right-4 top-4 z-50 rounded-lg border bg-white px-4 py-3 text-sm shadow-lg">{toast}</div>}

        <header className="border-b border-gray-200 pb-5">
          <p className="text-xs font-semibold uppercase tracking-[.14em]" style={{ color: '#BF8813' }}>Finance & Commercial</p>
          <h1 className="mt-1 text-2xl font-black" style={{ color: '#002050' }}>Configuration Fintech</h1>
          <p className="mt-1 text-sm text-gray-500">Prestataire de paiement, retraits et programmes financiers contrôlés par le Super-admin.</p>
        </header>

        <section className="border-y border-gray-200 py-4">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <CreditCard size={20} style={{ color: '#002050' }} />
              <div>
                <p className="font-bold" style={{ color: '#002050' }}>Prestataire de paiement actif : {activeProvider?.label || 'FedaPay'}</p>
                <p className="text-sm text-gray-500">Les clés secrètes ne sont jamais affichées ni modifiées depuis le navigateur.</p>
              </div>
            </div>
            <div className="text-sm">
              <span className="font-semibold" style={{ color: activeProvider?.configured ? '#1E7A52' : '#B42318' }}>
                {activeProvider?.configured ? 'Configuré' : 'Configuration serveur incomplète'}
              </span>
              {activeProvider && <span className="text-gray-400"> · webhook {activeProvider.webhook_configured ? 'configuré' : 'à vérifier'}</span>}
            </div>
          </div>
          <div className="mt-4 flex gap-3 text-xs text-gray-500">
            <ShieldCheck size={15} />
            <p>Le mode de production FedaPay reste géré côté serveur et n’est pas activé depuis cette page.</p>
          </div>
        </section>

        <section className="border-b border-gray-200 pb-6">
          <h2 className="font-black" style={{ color: '#002050' }}>Configuration des retraits</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm">
              Montant minimum (XOF)
              <input type="number" min="0" value={settings.payout_minimum_xof} onChange={event => setSettings({ ...settings, payout_minimum_xof: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" />
            </label>
            <label className="text-sm">
              Délai affiché
              <input value={settings.payout_delay_label} onChange={event => setSettings({ ...settings, payout_delay_label: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" />
            </label>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              ['canal_mobile_money', 'Mobile Money'],
              ['canal_virement_uemoa', 'Virement bancaire UEMOA'],
              ['canal_swift', 'SWIFT / International'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center justify-between border-b py-3 text-sm">
                <span>{label}</span>
                <input type="checkbox" checked={settings[key as keyof Settings] as boolean} onChange={event => setSettings({ ...settings, [key]: event.target.checked })} />
              </label>
            ))}
          </div>
        </section>

        <section className="border-b border-gray-200 pb-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div className="flex items-start gap-3">
              <Gift size={20} style={{ color: '#BF8813' }} />
              <div>
                <h2 className="font-black" style={{ color: '#002050' }}>Programme de parrainage</h2>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  Désactivé par défaut. Lorsqu’il est coupé, aucun nouveau parrainage n’est créé et les dossiers encore en attente sont neutralisés.
                </p>
              </div>
            </div>
            <label className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold" style={{ borderColor: settings.referral_enabled ? '#1E7A52' : '#D0D5DD', color: '#002050' }}>
              <Power size={17} style={{ color: settings.referral_enabled ? '#1E7A52' : '#667085' }} />
              <span>{settings.referral_enabled ? 'Activé' : 'Désactivé'}</span>
              <input
                type="checkbox"
                checked={settings.referral_enabled}
                onChange={event => setSettings({ ...settings, referral_enabled: event.target.checked })}
              />
            </label>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm">
              Récompense du parrain (XOF)
              <input
                type="number"
                min="0"
                step="1"
                disabled={!settings.referral_enabled}
                value={settings.referral_reward_referrer_xof}
                onChange={event => setSettings({ ...settings, referral_reward_referrer_xof: event.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2 disabled:bg-gray-100 disabled:text-gray-400"
              />
            </label>
            <label className="text-sm">
              Avantage du filleul (XOF)
              <input
                type="number"
                min="0"
                step="1"
                disabled={!settings.referral_enabled}
                value={settings.referral_reward_referred_xof}
                onChange={event => setSettings({ ...settings, referral_reward_referred_xof: event.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2 disabled:bg-gray-100 disabled:text-gray-400"
              />
            </label>
          </div>

          <p className="mt-4 text-xs leading-5 text-gray-500">
            La récompense est déclenchée uniquement après le premier achat confirmé du filleul. Les montants restent modifiables avant l’activation.
          </p>
        </section>

        <div className="flex justify-end gap-3">
          <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm">
            <RefreshCw size={14} /> Actualiser
          </button>
          <button onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: '#002050' }}>
            <Save size={14} />{saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
