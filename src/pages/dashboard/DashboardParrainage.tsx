import { openExternalUrl } from '../../lib/mobile';
import { getSessionToken } from '../../lib/session';
import { useEffect, useState, useCallback } from 'react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { Users, Copy, CheckCircle, Share2, Clock, Gift } from 'lucide-react';
import { getPublicSiteSettings } from '../../lib/siteSettingsCache';

interface Filleul {
  id: string;
  anonymized_name: string;
  country_code: string;
  status: string;
  reward_xof: number;
  joined_at: string;
}

interface ReferralData {
  enabled: boolean;
  referral_link: string | null;
  total_filleuls: number;
  total_recompenses_xof: number;
  reward_referrer_xof: number;
  reward_referred_xof: number;
  referral_code?: string | null;
  trigger_mode?: 'any' | 'all';
  triggers?: string[];
  filleuls: Filleul[];
}

function getApiBase() {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  return url ? `${url}/functions/v1` : '/api';
}

function formatXof(value: number) {
  return `${Math.max(0, value || 0).toLocaleString('fr-FR')} XOF`;
}

export function DashboardParrainage() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const bypassAuth = new URLSearchParams(window.location.search).get('preview') === 'true' &&
    (() => {
      try {
        return JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false;
      } catch {
        return false;
      }
    })();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const settings = await getPublicSiteSettings({ force: true });
      const isEnabled = settings.referral_enabled === true || settings.referral_enabled === 'true';
      setEnabled(isEnabled);

      if (!isEnabled || bypassAuth) {
        setData(null);
        return;
      }

      const token = getSessionToken();
      if (!token) return;

      const response = await fetch(`${getApiBase()}/referral-info`, {
        headers: edgeAuthHeaders(),
      });
      const payload = await response.json().catch(() => ({}));

      if (response.ok && payload.enabled === true) {
        setData(payload as ReferralData);
      } else {
        setEnabled(false);
        setData(null);
      }
    } catch {
      setEnabled(false);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [bypassAuth]);

  useEffect(() => {
    void load();
  }, [load]);

  function copyLink() {
    if (!data?.referral_link) return;
    navigator.clipboard.writeText(data.referral_link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function shareWhatsApp() {
    if (!data?.referral_link) return;
    const benefit = data.reward_referred_xof > 0 ? ` et bénéficiez de ${formatXof(data.reward_referred_xof)} lorsque les conditions du programme sont remplies` : '';
    const message = encodeURIComponent(`Rejoignez Omnia Global Academy avec mon lien${benefit} : ${data.referral_link}`);
    void openExternalUrl(`https://wa.me/?text=${message}`);
  }

  const statusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: '#FEF3C7', text: '#92400E', label: 'En attente' },
      rewarded: { bg: '#D1FAE5', text: '#065F46', label: 'Récompensé' },
    };
    const style = styles[status] ?? styles.pending;
    return <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: style.bg, color: style.text }}>{style.label}</span>;
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl p-6 lg:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Programme de parrainage</h1>
          <p className="mt-1 text-sm text-gray-500">Le programme est entièrement piloté par l’Administration Omnia.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
          </div>
        ) : !enabled || !data ? (
          <div className="rounded-2xl border bg-white p-8 text-center" style={{ borderColor: '#E4E7EC' }}>
            <Gift className="mx-auto h-10 w-10 text-gray-300" />
            <h2 className="mt-4 text-lg font-bold" style={{ color: '#002050' }}>Parrainage actuellement désactivé</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-gray-500">
              Aucun lien, bonus ou récompense n’est actif pour le moment. Le programme apparaîtra automatiquement lorsque l’Administration Omnia l’activera et définira ses montants.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-5 rounded-xl border p-5" style={{ backgroundColor: '#002050', borderColor: '#002050' }}>
              <h2 className="mb-4 flex items-center gap-2 font-semibold text-white">
                <Gift className="h-4 w-4" style={{ color: '#BF8813' }} /> Fonctionnement
              </h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  'Partagez votre lien personnel et votre code généré par Omnia.',
                  `La récompense est déclenchée lorsque ${((data.triggers||[]).map(key=>({account_verified:'le compte est vérifié',first_purchase:'le premier achat est payé',first_subscription:'le premier abonnement est payé',certificate_earned:'un premier certificat est obtenu',purchase_amount_reached:'le montant cumulé d’achats requis est atteint',course_completed:'une première formation est terminée',live_participation:'une première participation à un Live est enregistrée'} as Record<string,string>)[key]||key).join(data.trigger_mode==='all'?' ET ':' OU ')) || 'les conditions configurées sont remplies'}.`,
                  `Le parrain reçoit ${formatXof(data.reward_referrer_xof)} et le filleul ${formatXof(data.reward_referred_xof)}.`,
                ].map((text, index) => (
                  <div key={text} className="flex items-start gap-3 rounded-lg bg-white/10 p-3">
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ backgroundColor: '#BF8813', color: '#002050' }}>
                      {index + 1}
                    </div>
                    <p className="text-xs leading-relaxed text-white/80">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-4">
              <div className="rounded-xl border bg-white p-5 shadow-sm" style={{ borderColor: '#E4E7EC' }}>
                <div className="mb-1 flex items-center gap-2">
                  <Users className="h-4 w-4" style={{ color: '#002050' }} />
                  <span className="text-xs text-gray-500">Filleuls invités</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">{data.total_filleuls}</p>
              </div>
              <div className="rounded-xl border bg-white p-5 shadow-sm" style={{ borderColor: '#E4E7EC' }}>
                <div className="mb-1 flex items-center gap-2">
                  <Gift className="h-4 w-4" style={{ color: '#BF8813' }} />
                  <span className="text-xs text-gray-500">Récompenses gagnées</span>
                </div>
                <p className="text-2xl font-bold" style={{ color: '#BF8813' }}>{formatXof(data.total_recompenses_xof)}</p>
              </div>
            </div>

            <div className="mb-5 rounded-xl border bg-white p-5 shadow-sm" style={{ borderColor: '#E4E7EC' }}>
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-gray-900">
                <Share2 className="h-4 w-4 text-gray-400" /> Votre lien de parrainage
              </h2>
              {data.referral_code && <p className="mb-3 text-sm text-gray-600">Votre code : <strong className="font-mono" style={{color:'#002050'}}>{data.referral_code}</strong></p>}
              <div className="flex items-center gap-2">
                <div className="flex-1 truncate rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-xs text-gray-600">
                  {data.referral_link}
                </div>
                <button onClick={copyLink} className="flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium text-white" style={{ backgroundColor: copied ? '#1E7A52' : '#002050' }}>
                  {copied ? <><CheckCircle className="h-4 w-4" /> Copié</> : <><Copy className="h-4 w-4" /> Copier</>}
                </button>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={shareWhatsApp} className="flex-1 rounded-lg py-2.5 text-sm font-medium text-white" style={{ backgroundColor: '#25D366' }}>WhatsApp</button>
                <button
                  onClick={() => {
                    if (!data.referral_link) return;
                    window.location.href = `sms:?body=${encodeURIComponent(`Rejoignez Omnia Global Academy : ${data.referral_link}`)}`;
                  }}
                  className="flex-1 rounded-lg py-2.5 text-sm font-medium text-white"
                  style={{ backgroundColor: '#002050' }}
                >
                  SMS
                </button>
              </div>
            </div>

            <div className="rounded-xl border bg-white shadow-sm" style={{ borderColor: '#E4E7EC' }}>
              <div className="border-b border-gray-100 px-5 py-4">
                <h2 className="font-semibold text-gray-900">Historique de vos filleuls</h2>
              </div>
              {data.filleuls.length === 0 ? (
                <div className="p-8 text-center">
                  <Users className="mx-auto mb-3 h-10 w-10 text-gray-200" />
                  <p className="text-sm text-gray-500">Aucun filleul pour le moment</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {data.filleuls.map(filleul => (
                    <div key={filleul.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ backgroundColor: '#00205015', color: '#002050' }}>
                          {filleul.anonymized_name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{filleul.anonymized_name}</p>
                          <p className="flex items-center gap-1 text-xs text-gray-400">
                            <Clock className="h-3 w-3" />
                            {new Date(filleul.joined_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {filleul.reward_xof > 0 && <span className="text-sm font-semibold" style={{ color: '#BF8813' }}>+{formatXof(filleul.reward_xof)}</span>}
                        {statusBadge(filleul.status)}
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
