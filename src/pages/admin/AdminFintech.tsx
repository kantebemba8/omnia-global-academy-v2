import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { ENDPOINTS } from '../../lib/config';
import { CreditCard, Eye, EyeOff, Save, AlertTriangle } from 'lucide-react';

type FintechSettings = {
  payout_minimum_xof: string;
  payout_delay_label: string;
  referral_reward_referrer_xof: string;
  referral_reward_referred_xof: string;
  canal_mobile_money: boolean;
  canal_virement_uemoa: boolean;
  canal_swift: boolean;
};

const DEFAULTS: FintechSettings = {
  payout_minimum_xof: '',
  payout_delay_label: '24 à 48 heures ouvrées',
  referral_reward_referrer_xof: '2500',
  referral_reward_referred_xof: '1000',
  canal_mobile_money: true,
  canal_virement_uemoa: true,
  canal_swift: false,
};

function asBool(value: unknown, fallback: boolean) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return fallback;
}

export default function AdminFintech() {
  const [showPubKey, setShowPubKey] = useState(false);
  const [fedaMode, setFedaMode] = useState<'test' | 'production'>('test');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [settings, setSettings] = useState<FintechSettings>(DEFAULTS);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(''), 3000);
  }

  function set<K extends keyof FintechSettings>(key: K, value: FintechSettings[K]) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  useEffect(() => {
    const token = localStorage.getItem('omnia_session_token') || '';
    fetch(ENDPOINTS.adminCmsUpdate, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async r => {
        if (!r.ok) throw new Error('Chargement impossible');
        return r.json();
      })
      .then(d => {
        const map: Record<string, unknown> = {};
        (d.settings || []).forEach((row: { key: string; value: unknown }) => {
          map[row.key] = row.value;
        });

        setSettings({
          payout_minimum_xof: String(map.payout_minimum_xof ?? DEFAULTS.payout_minimum_xof),
          payout_delay_label: String(map.payout_delay_label ?? DEFAULTS.payout_delay_label),
          referral_reward_referrer_xof: String(map.referral_reward_referrer_xof ?? DEFAULTS.referral_reward_referrer_xof),
          referral_reward_referred_xof: String(map.referral_reward_referred_xof ?? DEFAULTS.referral_reward_referred_xof),
          canal_mobile_money: asBool(map.canal_mobile_money, DEFAULTS.canal_mobile_money),
          canal_virement_uemoa: asBool(map.canal_virement_uemoa, DEFAULTS.canal_virement_uemoa),
          canal_swift: asBool(map.canal_swift, DEFAULTS.canal_swift),
        });
      })
      .catch(() => {
        showToast('Impossible de charger certains paramètres Fintech.');
      });
  }, []);

  async function save() {
    setSaving(true);
    const token = localStorage.getItem('omnia_session_token') || '';

    try {
      const res = await fetch(ENDPOINTS.adminCmsUpdate, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          updates: [
            { key: 'payout_minimum_xof', value: settings.payout_minimum_xof },
            { key: 'payout_delay_label', value: settings.payout_delay_label },
            { key: 'referral_reward_referrer_xof', value: settings.referral_reward_referrer_xof },
            { key: 'referral_reward_referred_xof', value: settings.referral_reward_referred_xof },
            { key: 'canal_mobile_money', value: String(settings.canal_mobile_money) },
            { key: 'canal_virement_uemoa', value: String(settings.canal_virement_uemoa) },
            { key: 'canal_swift', value: String(settings.canal_swift) },
          ],
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || 'Enregistrement impossible');
      }

      showToast('Paramètres Fintech enregistrés.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erreur pendant l’enregistrement.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {toast && (
          <div
            className="fixed top-4 right-4 z-50 bg-white shadow-lg rounded-xl px-5 py-3 text-sm font-medium border border-gray-200"
            style={{ color: '#002050' }}
          >
            {toast}
          </div>
        )}

        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#002050' }}>
            Configuration Fintech
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Passerelles de paiement, retraits, parrainage et paramètres financiers.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: '#002050' }}
              >
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-gray-800">FedaPay</p>
                <p className="text-xs text-gray-400">Passerelle de paiement principale</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-green-600 font-medium">Configuré</span>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Clé publique
              </label>
              <div className="flex gap-2">
                <input
                  type={showPubKey ? 'text' : 'password'}
                  defaultValue="Configurée via environnement"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-gray-50"
                  readOnly
                />
                <button
                  type="button"
                  onClick={() => setShowPubKey(!showPubKey)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50"
                >
                  {showPubKey ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Clé privée
              </label>
              <input
                type="password"
                value="••••••••••••••••"
                readOnly
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400"
              />
              <p className="text-xs text-gray-400 mt-1">
                Les secrets de paiement ne sont pas modifiés depuis cette page.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Mode</label>
              <div className="flex gap-2">
                {(['test', 'production'] as const).map(mode => (
                  <button
                    type="button"
                    key={mode}
                    onClick={() => setFedaMode(mode)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      fedaMode === mode
                        ? 'text-white border-transparent'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                    style={
                      fedaMode === mode
                        ? { backgroundColor: mode === 'production' ? '#1E7A52' : '#BF8813' }
                        : {}
                    }
                  >
                    {mode === 'production' ? 'Production' : 'Test / Sandbox'}
                  </button>
                ))}
              </div>

              {fedaMode === 'production' && (
                <div className="mt-2 p-2 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    Vérifiez les clés FedaPay avant d’activer réellement les paiements.
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Webhook URL
              </label>
              <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm font-mono text-gray-500 select-all">
                https://omniaglobalacademy.com/api/fedapay-webhook
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h3 className="font-semibold" style={{ color: '#002050' }}>
            Configuration des retraits
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Montant minimum retrait (XOF)
              </label>
              <input
                type="number"
                min="0"
                value={settings.payout_minimum_xof}
                onChange={e => set('payout_minimum_xof', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Délai de traitement affiché
              </label>
              <input
                type="text"
                value={settings.payout_delay_label}
                onChange={e => set('payout_delay_label', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                placeholder="24 à 48 heures ouvrées"
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Canaux activés</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.canal_mobile_money}
                  onChange={e => set('canal_mobile_money', e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">
                  Mobile Money (Wave, Orange, Moov, MTN)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.canal_virement_uemoa}
                  onChange={e => set('canal_virement_uemoa', e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">
                  Virement bancaire UEMOA
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.canal_swift}
                  onChange={e => set('canal_swift', e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">
                  Virement international SWIFT
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div>
            <h3 className="font-semibold" style={{ color: '#002050' }}>
              Parrainage
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Les paramètres financiers du parrainage sont centralisés ici.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Récompense du parrain (XOF)
              </label>
              <input
                type="number"
                min="0"
                value={settings.referral_reward_referrer_xof}
                onChange={e => set('referral_reward_referrer_xof', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Récompense du filleul (XOF)
              </label>
              <input
                type="number"
                min="0"
                value={settings.referral_reward_referred_xof}
                onChange={e => set('referral_reward_referred_xof', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3">
            <p className="text-xs text-gray-600">
              La gestion des jetons Omnia Career n’est plus dupliquée ici. Elle est centralisée dans
              <strong> Omnia Career → Jetons & Packs</strong>.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-60"
            style={{ backgroundColor: '#002050' }}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Enregistrement…' : 'Enregistrer les paramètres Fintech'}
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
