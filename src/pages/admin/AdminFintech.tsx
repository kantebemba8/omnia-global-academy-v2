import { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { ENDPOINTS } from '../../lib/config';
import { CreditCard, Eye, EyeOff, Save, AlertTriangle, Lock, Plus, Trash2 } from 'lucide-react';

interface PricingTier {
  id: string; label: string; score_min: number; score_max: number;
  price_xof: number; is_base_tier: boolean; is_protected: boolean;
}

export default function AdminFintech() {
  const [showPubKey, setShowPubKey] = useState(false);
  const [fedaMode, setFedaMode] = useState<'test' | 'production'>('test');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [tierToast, setTierToast] = useState('');

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000); }
  function showTierToast(msg: string) { setTierToast(msg); setTimeout(() => setTierToast(''), 3000); }

  useEffect(() => {
    const token = localStorage.getItem('omnia_session_token');
    fetch(ENDPOINTS.adminCmsUpdate, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.pricing_tiers) setPricingTiers(d.pricing_tiers); })
      .catch(() => {});
  }, []);
  const [settings, setSettings] = useState({
    payout_minimum_xof: '',
    payout_delay_label: '24 à 48 heures ouvrées',
    ai_token_per_registration: '10',
    ai_token_per_purchase: '5',
    canal_mobile_money: true,
    canal_virement_uemoa: true,
    canal_swift: false,
  });

  function set<K extends keyof typeof settings>(k: K, v: (typeof settings)[K]) {
    setSettings((prev) => ({ ...prev, [k]: v }));
  }

  async function save() {
    setSaving(true);
    const token = localStorage.getItem('omnia_session_token');
    await fetch(ENDPOINTS.adminCmsUpdate, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updates: [
          { key: 'payout_minimum_xof', value: settings.payout_minimum_xof },
          { key: 'payout_delay_label', value: settings.payout_delay_label },
          { key: 'ai_token_per_registration', value: settings.ai_token_per_registration },
          { key: 'ai_token_per_purchase', value: settings.ai_token_per_purchase },
        ],
      }),
    });
    setSaving(false);
    showToast('Paramètres enregistrés.');
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {toast && (
          <div className="fixed top-4 right-4 z-50 bg-white shadow-lg rounded-xl px-5 py-3 text-sm font-medium border border-gray-200"
            style={{ color: '#002050' }}>{toast}</div>
        )}
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#002050' }}>Configuration Fintech</h1>
          <p className="text-gray-500 text-sm mt-0.5">Passerelles de paiement, retraits et jetons IA</p>
        </div>

        {/* FedaPay card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#002050' }}>
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-gray-800">FedaPay</p>
                <p className="text-xs text-gray-400">Passerelle de paiement principale</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-green-600 font-medium">Connecté</span>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Clé publique</label>
              <div className="flex gap-2">
                <input type={showPubKey ? 'text' : 'password'} defaultValue="pk_sandbox_xxxxxxxx"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" readOnly />
                <button onClick={() => setShowPubKey(!showPubKey)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">
                  {showPubKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Clé privée</label>
              <input type="password" defaultValue="sk_sandbox_xxxxxxxx" readOnly
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-gray-50 text-gray-400" />
              <p className="text-xs text-gray-400 mt-1">La clé privée n'est jamais affichée en clair.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Mode</label>
              <div className="flex gap-2">
                {(['test', 'production'] as const).map((m) => (
                  <button key={m} onClick={() => setFedaMode(m)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${fedaMode === m ? 'text-white border-transparent' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    style={fedaMode === m ? { backgroundColor: m === 'production' ? '#1E7A52' : '#BF8813' } : {}}>
                    {m === 'production' ? 'Production' : 'Test / Sandbox'}
                  </button>
                ))}
              </div>
              {fedaMode === 'production' && (
                <div className="mt-2 p-2 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">Mode Production actif — les paiements sont réels.</p>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Webhook URL</label>
              <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm font-mono text-gray-500 select-all">
                https://omniaglobalacademy.com/api/fedapay-webhook
              </div>
            </div>
          </div>
        </div>

        {/* Withdrawal config */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h3 className="font-semibold" style={{ color: '#002050' }}>Configuration des retraits</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Montant minimum retrait (XOF)</label>
              <input type="number" value={settings.payout_minimum_xof} onChange={(e) => set('payout_minimum_xof', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Délai de traitement affiché</label>
              <input type="text" value={settings.payout_delay_label} onChange={(e) => set('payout_delay_label', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                placeholder="ex: 24 à 48 heures ouvrées" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Canaux activés</p>
            <div className="space-y-2">
              {[
                { key: 'canal_mobile_money', label: 'Mobile Money (Wave, Orange, Moov, MTN)' },
                { key: 'canal_virement_uemoa', label: 'Virement bancaire UEMOA' },
                { key: 'canal_swift', label: 'Virement international SWIFT' },
              ].map((c) => (
                <label key={c.key} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox"
                    checked={settings[c.key as keyof typeof settings] as boolean}
                    onChange={(e) => set(c.key as keyof typeof settings, e.target.checked as never)}
                    className="rounded" />
                  <span className="text-sm text-gray-700">{c.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* AI tokens */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h3 className="font-semibold" style={{ color: '#002050' }}>Jetons IA</h3>
          <p className="text-xs text-gray-500">Les jetons permettent de générer des CV depuis le CV Builder.</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Jetons offerts à l'inscription</label>
              <input type="number" value={settings.ai_token_per_registration} onChange={(e) => set('ai_token_per_registration', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Jetons offerts par achat confirmé</label>
              <input type="number" value={settings.ai_token_per_purchase} onChange={(e) => set('ai_token_per_purchase', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
          </div>
        </div>

        {/* Pricing tiers */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold" style={{ color: '#002050' }}>Paliers de prix</h3>
              <p className="text-xs text-gray-500 mt-0.5">Les paliers de base sont protégés contre la suppression.</p>
            </div>
            <button
              onClick={async () => {
                const token = localStorage.getItem('omnia_session_token');
                await fetch(ENDPOINTS.adminCmsUpdate, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'upsert_pricing_tier', tier: { label: 'Nouveau palier', score_min: 0, score_max: 10, price_xof: 5000 } }),
                });
                const r = await fetch(ENDPOINTS.adminCmsUpdate, { headers: { Authorization: `Bearer ${token}` } });
                const d = await r.json();
                if (d.pricing_tiers) setPricingTiers(d.pricing_tiers);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
              style={{ backgroundColor: '#002050' }}>
              <Plus className="w-3 h-3" /> Ajouter un palier
            </button>
          </div>
          {tierToast && (
            <div className="p-2 rounded-lg text-xs font-medium" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>{tierToast}</div>
          )}
          <div className="space-y-2">
            {pricingTiers.map((tier) => (
              <div key={tier.id} className="flex items-center gap-3 p-3 rounded-lg border" style={{ borderColor: tier.is_protected ? '#BF881330' : '#E4E7EC', backgroundColor: tier.is_protected ? '#FFFBEB' : '#FAFAFA' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-800">{tier.label}</span>
                    {tier.is_protected && (
                      <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#BF881320', color: '#BF8813' }}>
                        <Lock className="w-2.5 h-2.5" /> Protégé
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">Score {tier.score_min}–{tier.score_max} · {tier.price_xof.toLocaleString()} XOF</p>
                </div>
                <button
                  disabled={tier.is_protected}
                  title={tier.is_protected ? 'Ce palier est protégé — modifiable uniquement' : 'Supprimer ce palier'}
                  onClick={async () => {
                    const token = localStorage.getItem('omnia_session_token');
                    const res = await fetch(ENDPOINTS.adminCmsUpdate, {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'delete_pricing_tier', tier_id: tier.id }),
                    });
                    const d = await res.json();
                    if (d.error === 'PALIER_PROTECTED') { showTierToast(d.message); return; }
                    setPricingTiers(prev => prev.filter(t => t.id !== tier.id));
                  }}
                  className="p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ color: '#DC2626' }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {pricingTiers.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">Aucun palier configuré.</p>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-60"
            style={{ backgroundColor: '#002050' }}>
            <Save className="w-4 h-4" />
            {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
