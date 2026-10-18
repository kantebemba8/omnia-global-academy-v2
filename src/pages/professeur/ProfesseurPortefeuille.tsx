import { getSessionToken } from '../../lib/session';
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/DashboardLayout';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { Wallet, ArrowDownCircle, X, AlertTriangle, CheckCircle } from 'lucide-react';

interface WalletData {
  balance_xof: number; reserved_xof: number; total_earned_xof: number; total_withdrawn_xof: number;
}

interface Transaction {
  id: string; type: string; amount_xof: number; description: string | null; created_at: string;
}

interface PayoutReq {
  id: string; amount_xof: number; channel: string; status: string; requested_at: string;
}

interface DashData {
  wallet: WalletData;
  payout_requests: PayoutReq[];
}

function getApiBase() {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  return url ? `${url}/functions/v1` : '/api';
}

const OPERATORS = ['Wave', 'Orange Money', 'Moov', 'MTN'];
const PAYOUT_STATUS: Record<string, { label: string; color: string }> = {
  pending:                    { label: 'En attente', color: '#F59E0B' },
  waiting_final_verification: { label: 'Vérification finale', color: '#3B82F6' },
  approved:                   { label: 'Approuvé', color: '#1E7A52' },
  rejected:                   { label: 'Rejeté', color: '#DC2626' },
  paid:                       { label: 'Payé', color: '#1E7A52' },
  failed:                     { label: 'Échec', color: '#DC2626' },
};

type PayoutForm = {
  amount_xof: string; channel: 'mobile_money' | 'bank_transfer';
  mm_operator: string; mm_phone: string;
  bank_name: string; account_holder: string; bank_code: string;
  branch_code: string; account_number: string; rib_key: string;
  iban: string; swift: string;
};

export function ProfesseurPortefeuille() {
  const [data, setData] = useState<DashData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [txTab, setTxTab] = useState<'all' | 'ventes' | 'retraits'>('all');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<PayoutForm>({
    amount_xof: '', channel: 'mobile_money',
    mm_operator: 'Wave', mm_phone: '',
    bank_name: '', account_holder: '', bank_code: '', branch_code: '',
    account_number: '', rib_key: '', iban: '', swift: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const navigate = useNavigate();

  const bypassAuth = new URLSearchParams(window.location.search).get('preview') === 'true' &&
    (() => { try { return JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false; } catch { return false; } })();

  const load = useCallback(async () => {
    if (bypassAuth) { setLoading(false); return; }
    const token = getSessionToken();
    if (!token && !bypassAuth) { navigate('/connexion'); return; }
    try {
      const res = await fetch(`${getApiBase()}/dashboard-professeur`, { headers: edgeAuthHeaders() });
      if (res.status === 403 && !bypassAuth) { navigate('/connexion'); return; }
      const json = await res.json();
      if (res.ok) {
        setData({ wallet: json.wallet, payout_requests: json.payout_requests ?? [] });
        setTransactions(json.transactions ?? []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [navigate, bypassAuth]);

  useEffect(() => { load(); }, [load]);

  async function submitPayout() {
    const token = getSessionToken();
    if (!token) return;
    setSubmitting(true); setSubmitMsg(null);
    try {
      const body: Record<string, unknown> = {
        amount_xof: parseInt(form.amount_xof),
        channel: form.channel,
      };
      if (form.channel === 'mobile_money') {
        body.mm_operator = form.mm_operator;
        body.mm_phone = form.mm_phone;
      } else {
        body.bank_name = form.bank_name; body.account_holder = form.account_holder;
        body.bank_code = form.bank_code; body.branch_code = form.branch_code;
        body.account_number = form.account_number; body.rib_key = form.rib_key;
        body.iban = form.iban; body.swift = form.swift;
      }
      const res = await fetch(`${getApiBase()}/payout-request`, {
        method: 'POST',
        headers: edgeAuthHeaders(),
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) { setSubmitMsg({ text: json.message || json.error || 'Erreur', ok: false }); return; }
      setSubmitMsg({ text: 'Demande de retrait soumise avec succès.', ok: true });
      setTimeout(() => { setModal(false); load(); }, 2000);
    } catch { setSubmitMsg({ text: 'Erreur réseau', ok: false }); }
    finally { setSubmitting(false); }
  }

  const availableBalance = Math.max(0, Number(data?.wallet.balance_xof ?? 0) - Number(data?.wallet.reserved_xof ?? 0));

  const filteredTx = transactions.filter((t) => {
    if (txTab === 'ventes') return t.type === 'credit_sale';
    if (txTab === 'retraits') return t.type === 'debit_withdrawal';
    return true;
  });

  const TX_COLORS: Record<string, string> = { credit_sale: '#1E7A52', debit_withdrawal: '#DC2626', credit_compensatory: '#3B82F6', credit_referral: '#BF8813' };

  return (
    <DashboardLayout role="professeur">
      <div className="p-6 lg:p-8 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Mon portefeuille</h1>
          <p className="text-gray-500 text-sm mt-1">Gérez vos revenus et demandez des retraits</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <>
            {/* Main wallet card */}
            <div className="rounded-2xl p-6 mb-6" style={{ background: 'linear-gradient(135deg, #002050, #003580)' }}>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <p className="text-white/60 text-sm mb-1">Solde retirable</p>
                  <p className="text-white text-4xl font-bold">{availableBalance.toLocaleString()}<span className="text-2xl ml-2 font-normal opacity-70">XOF</span></p>
                </div>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                  <Wallet className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-white/60 text-xs mb-0.5">Gains cumulés</p>
                  <p className="text-white font-bold">{(data?.wallet.total_earned_xof ?? 0).toLocaleString()} XOF</p>
                </div>
                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-white/60 text-xs mb-0.5">Total retiré</p>
                  <p className="text-white font-bold">{(data?.wallet.total_withdrawn_xof ?? 0).toLocaleString()} XOF</p>
                </div>
              </div>
              <button onClick={() => setModal(true)}
                className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#BF8813', color: '#002050' }}>
                <ArrowDownCircle className="w-4 h-4" /> Demander un retrait
              </button>
            </div>

            {/* Payout history */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-5">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Historique des retraits</h2>
              </div>
              {(data?.payout_requests ?? []).length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">Aucun retrait effectué</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {data!.payout_requests.map((p) => {
                    const ps = PAYOUT_STATUS[p.status] ?? PAYOUT_STATUS.pending;
                    return (
                      <div key={p.id} className="px-5 py-3.5 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{p.amount_xof.toLocaleString()} XOF</p>
                          <p className="text-xs text-gray-400">{p.channel === 'mobile_money' ? 'Mobile Money' : 'Virement bancaire'} · {new Date(p.requested_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        </div>
                        <span className="text-xs font-semibold" style={{ color: ps.color }}>{ps.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Transactions */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">Transactions</h2>
                  <div className="flex gap-1">
                    {(['all', 'ventes', 'retraits'] as const).map((t) => (
                      <button key={t} onClick={() => setTxTab(t)}
                        className="text-xs px-3 py-1 rounded-lg font-medium transition-all"
                        style={txTab === t ? { backgroundColor: '#002050', color: 'white' } : { color: '#6b7280' }}>
                        {t === 'all' ? 'Toutes' : t === 'ventes' ? 'Ventes' : 'Retraits'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {filteredTx.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">Aucune transaction</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {filteredTx.map((tx) => (
                    <div key={tx.id} className="px-5 py-3.5 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-700">{tx.description || tx.type}</p>
                        <p className="text-xs text-gray-400">{new Date(tx.created_at).toLocaleDateString('fr-FR')}</p>
                      </div>
                      <span className="text-sm font-bold" style={{ color: TX_COLORS[tx.type] ?? '#374151' }}>
                        {tx.type.startsWith('credit') ? '+' : '-'}{tx.amount_xof.toLocaleString()} XOF
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Payout modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Demande de retrait</h2>
              <button onClick={() => setModal(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Montant (XOF)</label>
                <input type="number" value={form.amount_xof} onChange={(e) => setForm((p) => ({ ...p, amount_xof: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400"
                  placeholder="Ex: 10000" />
                <p className="text-xs text-gray-400 mt-1">Minimum : 5 000 XOF · Solde : {availableBalance.toLocaleString()} XOF</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Canal de paiement</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['mobile_money', 'bank_transfer'] as const).map((c) => (
                    <button key={c} onClick={() => setForm((p) => ({ ...p, channel: c }))}
                      className="py-2.5 rounded-lg border text-sm font-medium transition-all"
                      style={form.channel === c ? { backgroundColor: '#002050', color: 'white', borderColor: '#002050' } : { borderColor: '#e5e7eb', color: '#374151' }}>
                      {c === 'mobile_money' ? 'Mobile Money' : 'Virement bancaire'}
                    </button>
                  ))}
                </div>
              </div>

              {form.channel === 'mobile_money' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Opérateur</label>
                    <div className="flex gap-2 flex-wrap">
                      {OPERATORS.map((op) => (
                        <button key={op} onClick={() => setForm((p) => ({ ...p, mm_operator: op }))}
                          className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-all"
                          style={form.mm_operator === op ? { backgroundColor: '#002050', color: 'white', borderColor: '#002050' } : { borderColor: '#e5e7eb', color: '#374151' }}>
                          {op}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Numéro international</label>
                    <input type="tel" value={form.mm_phone} onChange={(e) => setForm((p) => ({ ...p, mm_phone: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400"
                      placeholder="+[indicatif] numéro" />
                  </div>
                </>
              )}

              {form.channel === 'bank_transfer' && (
                <div className="space-y-3">
                  {[
                    { key: 'bank_name', label: 'Banque', placeholder: 'BDM S.A.' },
                    { key: 'account_holder', label: 'Titulaire du compte', placeholder: 'Nom complet' },
                    { key: 'bank_code', label: 'Code banque', placeholder: '10025' },
                    { key: 'branch_code', label: 'Code guichet', placeholder: '00001' },
                    { key: 'account_number', label: 'Numéro de compte', placeholder: '00000000000' },
                    { key: 'rib_key', label: 'Clé RIB', placeholder: '00' },
                    { key: 'iban', label: 'IBAN (optionnel)', placeholder: 'ML...' },
                    { key: 'swift', label: 'SWIFT (optionnel)', placeholder: 'BDMXMLBA' },
                  ].map((f) => (
                    <div key={f.key}>
                      <label className="block text-xs font-medium text-gray-700 mb-1">{f.label}</label>
                      <input type="text" value={(form as Record<string, string>)[f.key] ?? ''} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                        placeholder={f.placeholder} />
                    </div>
                  ))}
                </div>
              )}

              {submitMsg && (
                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${submitMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {submitMsg.ok ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {submitMsg.text}
                </div>
              )}

              <button onClick={submitPayout} disabled={submitting || !form.amount_xof}
                className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-opacity disabled:opacity-50"
                style={{ backgroundColor: '#002050' }}>
                {submitting ? 'Soumission...' : 'Soumettre la demande'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
