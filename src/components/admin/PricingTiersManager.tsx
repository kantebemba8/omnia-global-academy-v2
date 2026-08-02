import { getSessionToken } from '../../lib/session';
import { useEffect, useState } from 'react';
import { ENDPOINTS } from '../../lib/config';
import { Save, Lock } from 'lucide-react';

type Tier = {
  id: string;
  label: string;
  score_min: number;
  score_max: number | null;
  price_xof: number;
  is_protected?: boolean;
};

export function PricingTiersManager() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const token = () => getSessionToken() || '';

  async function load() {
    const r = await fetch(ENDPOINTS.adminCmsUpdate, { headers: { Authorization: `Bearer ${token()}` } });
    const d = await r.json();
    setTiers((d.pricing_tiers || []).sort((a: Tier, b: Tier) => Number(a.score_min) - Number(b.score_min)));
  }

  useEffect(() => { load(); }, []);

  async function savePrice(tier: Tier) {
    setSaving(tier.id);
    setMessage('');
    const r = await fetch(ENDPOINTS.adminCmsUpdate, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'upsert_pricing_tier',
        tier: {
          id: tier.id,
          label: tier.label,
          score_min: tier.score_min,
          score_max: tier.score_max,
          price_xof: tier.price_xof,
        },
      }),
    });
    setSaving(null);
    setMessage(r.ok ? 'Prix du palier enregistré.' : 'Erreur pendant l’enregistrement.');
    if (r.ok) await load();
    setTimeout(() => setMessage(''), 2500);
  }

  return <div className="space-y-4">
    <div>
      <h3 className="font-semibold" style={{ color: '#002050' }}>Paliers de prix du score</h3>
      <p className="text-xs text-gray-500 mt-1">
        Les tranches de score définies dans le cahier des charges sont fixes et protégées. Seul le prix peut être modifié.
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {tiers.map(tier => (
        <div key={tier.id} className="rounded-xl border border-gray-200 p-4 bg-white">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">{tier.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Score {tier.score_min} à {tier.score_max == null ? '∞' : tier.score_max}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700">
              <Lock className="w-3 h-3" /> Score protégé
            </span>
          </div>
          <label className="block text-xs text-gray-600">
            Prix (XOF) — modifiable
            <input
              type="number" min="0" step="500"
              value={tier.price_xof}
              onChange={e => setTiers(prev => prev.map(x => x.id === tier.id ? { ...x, price_xof: Number(e.target.value) } : x))}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => savePrice(tier)}
              disabled={saving === tier.id}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: '#002050' }}
            >
              <Save className="w-3.5 h-3.5" />
              {saving === tier.id ? 'Enregistrement…' : 'Enregistrer le prix'}
            </button>
          </div>
        </div>
      ))}
    </div>
    {tiers.length === 0 && (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
        Les paliers de base ne sont pas disponibles. Vérifiez la configuration tarifaire avant de continuer.
      </div>
    )}
    {message && <p className="text-xs text-gray-500 text-right">{message}</p>}
  </div>;
}
