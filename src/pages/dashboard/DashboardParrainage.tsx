import { useEffect, useState, useCallback } from 'react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { Users, Copy, CheckCircle, Share2, Clock, Gift } from 'lucide-react';

interface Filleul {
  id: string; anonymized_name: string; country_code: string;
  status: string; reward_xof: number; joined_at: string;
}

interface ReferralData {
  referral_link: string; total_filleuls: number;
  total_recompenses_xof: number; filleuls: Filleul[];
}

function getApiBase() {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  return url ? `${url}/functions/v1` : '/api';
}

export function DashboardParrainage() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const bypassAuth = new URLSearchParams(window.location.search).get('preview') === 'true' &&
    (() => { try { return JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false; } catch { return false; } })();

  const load = useCallback(async () => {
    if (bypassAuth) { setLoading(false); return; }
    const token = localStorage.getItem('omnia_session_token');
    if (!token) return;
    try {
      const res = await fetch(`${getApiBase()}/referral-info`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok) setData(json);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function copyLink() {
    if (!data) return;
    navigator.clipboard.writeText(data.referral_link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function shareWhatsApp() {
    if (!data) return;
    const msg = encodeURIComponent(`Rejoignez Omnia Global Academy avec mon lien de parrainage et obtenez 1 000 XOF de réduction : ${data.referral_link}`);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  }

  const statusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: '#FEF3C7', text: '#92400E', label: 'En attente' },
      rewarded: { bg: '#D1FAE5', text: '#065F46', label: 'Récompensé' },
    };
    const s = styles[status] ?? styles.pending;
    return (
      <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: s.bg, color: s.text }}>{s.label}</span>
    );
  };

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Programme de parrainage</h1>
          <p className="text-gray-500 text-sm mt-1">Invitez vos amis et gagnez des récompenses</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <>
            {/* How it works */}
            <div className="rounded-xl p-5 mb-5 border" style={{ backgroundColor: '#002050' }}>
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Gift className="w-4 h-4" style={{ color: '#BF8813' }} /> Comment ça marche
              </h2>
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  { step: '1', text: 'Partagez votre lien de parrainage' },
                  { step: '2', text: 'Votre filleul s\'inscrit et achète une formation' },
                  { step: '3', text: 'Vous gagnez 2 500 XOF, lui 1 000 XOF' },
                ].map((s) => (
                  <div key={s.step} className="bg-white/10 rounded-lg p-3 flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold" style={{ backgroundColor: '#BF8813', color: '#002050' }}>{s.step}</div>
                    <p className="text-white/80 text-xs leading-relaxed">{s.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4" style={{ color: '#002050' }} />
                  <span className="text-xs text-gray-500">Filleuls invités</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">{data?.total_filleuls ?? 0}</p>
              </div>
              <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Gift className="w-4 h-4" style={{ color: '#BF8813' }} />
                  <span className="text-xs text-gray-500">Récompenses gagnées</span>
                </div>
                <p className="text-3xl font-bold" style={{ color: '#BF8813' }}>{(data?.total_recompenses_xof ?? 0).toLocaleString()} <span className="text-base font-normal text-gray-400">XOF</span></p>
              </div>
            </div>

            {/* Referral link */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm mb-5">
              <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Share2 className="w-4 h-4 text-gray-400" /> Votre lien de parrainage
              </h2>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-xs text-gray-600 font-mono truncate">
                  {data?.referral_link}
                </div>
                <button onClick={copyLink} className="flex-shrink-0 px-3 py-2.5 rounded-lg flex items-center gap-1.5 text-sm font-medium transition-all"
                  style={{ backgroundColor: copied ? '#1E7A52' : '#002050', color: 'white' }}>
                  {copied ? <><CheckCircle className="w-4 h-4" /> Copié</> : <><Copy className="w-4 h-4" /> Copier</>}
                </button>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={shareWhatsApp}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: '#25D366' }}>
                  WhatsApp
                </button>
                <button onClick={() => {
                  if (!data) return;
                  const sms = `sms:?body=${encodeURIComponent(`Rejoignez Omnia Academy : ${data.referral_link}`)}`;
                  window.location.href = sms;
                }}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: '#002050' }}>
                  SMS
                </button>
              </div>
            </div>

            {/* Filleul history */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Historique de vos filleuls</h2>
              </div>
              {(data?.filleuls ?? []).length === 0 ? (
                <div className="p-8 text-center">
                  <Users className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                  <p className="text-gray-500 text-sm">Aucun filleul pour l'instant</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {data!.filleuls.map((f) => (
                    <div key={f.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: '#002050' + '15', color: '#002050' }}>
                          {f.anonymized_name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{f.anonymized_name}</p>
                          <p className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(f.joined_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {f.reward_xof > 0 && (
                          <span className="text-sm font-semibold" style={{ color: '#BF8813' }}>+{f.reward_xof.toLocaleString()} XOF</span>
                        )}
                        {statusBadge(f.status)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
