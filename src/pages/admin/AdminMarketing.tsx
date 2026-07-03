import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { ENDPOINTS } from '../../lib/config';
import { CATEGORY_LABELS } from '../../lib/categories';
import { Tag, Plus, XCircle, RefreshCw } from 'lucide-react';

interface Coupon {
  id: string; code: string; discount_type: string; discount_value: number;
  max_uses: number | null; used_count: number; applicable_to: string;
  expires_at: string | null; is_active: boolean; created_at: string;
}

type DiscountType = 'percentage' | 'fixed_xof';
type ApplicableTo = 'all' | 'category' | 'course';

function randomCode() {
  return 'OMNIA' + Math.random().toString(36).substring(2, 7).toUpperCase();
}

export default function AdminMarketing() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'coupons' | 'licences'>('coupons');
  const [modal, setModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  const [form, setForm] = useState({
    code: '', discount_type: 'percentage' as DiscountType, discount_value: '',
    max_uses: '', applicable_to: 'all' as ApplicableTo, applicable_id: '', expires_at: '',
  });

  function loadCoupons() {
    const token = localStorage.getItem('omnia_session_token');
    fetch(ENDPOINTS.adminCouponManage, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setCoupons(d.coupons ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }
  useEffect(() => { loadCoupons(); }, []);

  function setF<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function createCoupon() {
    if (!form.code || !form.discount_value) return;
    setSubmitting(true);
    const token = localStorage.getItem('omnia_session_token');
    const res = await fetch(ENDPOINTS.adminCouponManage, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        coupon_data: {
          code: form.code, discount_type: form.discount_type, discount_value: parseInt(form.discount_value),
          max_uses: form.max_uses ? parseInt(form.max_uses) : null,
          applicable_to: form.applicable_to,
          applicable_id: form.applicable_id || null,
          expires_at: form.expires_at || null,
        },
      }),
    });
    const d = await res.json();
    setSubmitting(false);
    if (d.success) {
      setToast('Coupon créé.'); setModal(false);
      setForm({ code: '', discount_type: 'percentage', discount_value: '', max_uses: '', applicable_to: 'all', applicable_id: '', expires_at: '' });
      loadCoupons();
    } else { setToast(d.error === 'CODE_EXISTS' ? 'Ce code existe déjà.' : d.message ?? 'Erreur.'); }
    setTimeout(() => setToast(''), 4000);
  }

  async function couponAction(id: string, action: 'deactivate' | 'delete') {
    const token = localStorage.getItem('omnia_session_token');
    const res = await fetch(ENDPOINTS.adminCouponManage, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, coupon_id: id }),
    });
    const d = await res.json();
    if (d.success) { setToast(action === 'delete' ? 'Coupon supprimé.' : 'Coupon désactivé.'); loadCoupons(); }
    else setToast(d.message ?? 'Erreur.');
    setTimeout(() => setToast(''), 3000);
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {toast && (
          <div className="fixed top-4 right-4 z-50 bg-white shadow-lg rounded-xl px-5 py-3 text-sm font-medium border border-gray-200"
            style={{ color: '#002050' }}>{toast}</div>
        )}
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#002050' }}>Offres & Licences B2B</h1>
          <p className="text-gray-500 text-sm mt-0.5">Coupons promotionnels et licences de groupe</p>
        </div>

        <div className="flex gap-2">
          {(['coupons', 'licences'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${tab === t ? 'text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              style={tab === t ? { backgroundColor: '#002050' } : {}}>
              {t === 'coupons' ? 'Coupons' : 'Licences de Groupe'}
            </button>
          ))}
        </div>

        {tab === 'coupons' && (
          <>
            <div className="flex justify-end">
              <button onClick={() => setModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ backgroundColor: '#002050' }}>
                <Plus className="w-4 h-4" /> Créer un coupon
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
              </div>
            ) : coupons.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center border border-gray-100 shadow-sm">
                <Tag className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: '#BF8813' }} />
                <p className="text-gray-400 text-sm">Aucun coupon créé</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Code', 'Type', 'Valeur', 'Utilisé / Max', 'Expiration', 'Statut', ''].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {coupons.map((c) => (
                      <tr key={c.id} className={`hover:bg-gray-50 transition-colors ${!c.is_active ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-3 font-mono text-sm font-semibold text-gray-800">{c.code}</td>
                        <td className="px-4 py-3 text-xs text-gray-600">{c.discount_type === 'percentage' ? '% de réduction' : 'Montant fixe'}</td>
                        <td className="px-4 py-3 text-sm font-medium" style={{ color: '#BF8813' }}>
                          {c.discount_type === 'percentage' ? `${c.discount_value}%` : `${c.discount_value.toLocaleString('fr-FR')} XOF`}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">{c.used_count} / {c.max_uses ?? '∞'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{c.expires_at ? new Date(c.expires_at).toLocaleDateString('fr-FR') : '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                            {c.is_active ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            {c.is_active && (
                              <button onClick={() => couponAction(c.id, 'deactivate')}
                                className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                                Désactiver
                              </button>
                            )}
                            {c.used_count === 0 && (
                              <button onClick={() => couponAction(c.id, 'delete')}
                                className="text-xs px-2 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
                                Supprimer
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === 'licences' && (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-100 shadow-sm">
            <Tag className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: '#002050' }} />
            <p className="text-gray-600 font-medium">Licences de Groupe</p>
            <p className="text-gray-400 text-sm mt-1">Les licences sont créées par le Super-admin et assignées aux établissements partenaires.</p>
            <button className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white mx-auto"
              style={{ backgroundColor: '#002050' }}>
              <Plus className="w-4 h-4" /> Créer une licence
            </button>
          </div>
        )}

        {/* Create coupon modal */}
        {modal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <h3 className="font-bold text-lg" style={{ color: '#002050' }}>Créer un coupon</h3>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Code promo</label>
                  <input value={form.code} onChange={(e) => setF('code', e.target.value.toUpperCase())}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none"
                    placeholder="PROMO2026" />
                </div>
                <div className="flex items-end">
                  <button onClick={() => setF('code', randomCode())}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Générer
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                  <select value={form.discount_type} onChange={(e) => setF('discount_type', e.target.value as DiscountType)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="percentage">% de réduction</option>
                    <option value="fixed_xof">Montant fixe XOF</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {form.discount_type === 'percentage' ? 'Valeur (%)' : 'Montant (XOF)'}
                  </label>
                  <input type="number" value={form.discount_value} onChange={(e) => setF('discount_value', e.target.value)}
                    max={form.discount_type === 'percentage' ? 100 : undefined}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Applicable à</label>
                <select value={form.applicable_to} onChange={(e) => setF('applicable_to', e.target.value as ApplicableTo)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                  <option value="all">Toutes les formations</option>
                  <option value="category">Une catégorie</option>
                  <option value="course">Une formation spécifique</option>
                </select>
              </div>

              {form.applicable_to === 'category' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Catégorie</label>
                  <select value={form.applicable_id} onChange={(e) => setF('applicable_id', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="">Sélectionner…</option>
                    {CATEGORY_LABELS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Utilisations max (vide = illimité)</label>
                  <input type="number" value={form.max_uses} onChange={(e) => setF('max_uses', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Expiration (optionnel)</label>
                  <input type="date" value={form.expires_at} onChange={(e) => setF('expires_at', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button onClick={() => setModal(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Annuler</button>
                <button onClick={createCoupon} disabled={submitting || !form.code || !form.discount_value}
                  className="px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-60"
                  style={{ backgroundColor: '#002050' }}>
                  {submitting ? 'Création…' : 'Créer le coupon'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
