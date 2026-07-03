import React, { useState, useEffect } from 'react';
import { Award, Plus, RefreshCw, AlertCircle, CreditCard } from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';

const PRIMARY_COLOR = '#002050';
const ACCENT_COLOR = '#BF8813';
const SUCCESS_COLOR = '#1E7A52';
const DANGER_COLOR = '#DC2626';
const WARNING_COLOR = '#F97316';

interface CreditData {
  total_credits: number;
  used_credits: number;
}

interface Certificate {
  id: string;
  student_full_name: string;
  course_title: string;
  issued_at: string;
}

interface RechargeHistory {
  id: string;
  amount: number;
  recharged_at: string;
  operator_name: string;
}

export default function AdminCpdCredits() {
  const [credits, setCredits] = useState<CreditData>({
    total_credits: 0,
    used_credits: 0,
  });
  const [pendingCerts, setPendingCerts] = useState<Certificate[]>([]);
  const [rechargeHistory, setRechargeHistory] = useState<RechargeHistory[]>([]);
  const [rechargeAmount, setRechargeAmount] = useState('');

  const [loadingCredits, setLoadingCredits] = useState(true);
  const [loadingPending, setLoadingPending] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingRecharge, setLoadingRecharge] = useState(false);

  const [errorCredits, setErrorCredits] = useState<string | null>(null);
  const [errorPending, setErrorPending] = useState<string | null>(null);
  const [errorHistory, setErrorHistory] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const sessionToken = localStorage.getItem('omnia_session_token');
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${sessionToken}`,
    'apikey': supabaseKey,
  };

  // Fetch current credits balance
  useEffect(() => {
    const fetchCredits = async () => {
      setLoadingCredits(true);
      setErrorCredits(null);
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/cpd_credits?select=*&order=recharged_at.desc&limit=1`,
          { headers }
        );
        if (!response.ok) throw new Error('Failed to fetch credits');
        const data = await response.json();
        if (data.length > 0) {
          setCredits(data[0]);
        }
      } catch (error) {
        setErrorCredits(error instanceof Error ? error.message : 'Error fetching credits');
      } finally {
        setLoadingCredits(false);
      }
    };
    if (supabaseUrl && supabaseKey) {
      fetchCredits();
    }
  }, [supabaseUrl, supabaseKey]);

  // Fetch pending certificates
  useEffect(() => {
    const fetchPending = async () => {
      setLoadingPending(true);
      setErrorPending(null);
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/certificates?select=id,student_full_name,course_title,issued_at&eq.cpd_badge_url=is.null&eq.cpd_accredited=true&order=issued_at.desc`,
          { headers }
        );
        if (!response.ok) throw new Error('Failed to fetch certificates');
        const data = await response.json();
        setPendingCerts(data || []);
      } catch (error) {
        setErrorPending(error instanceof Error ? error.message : 'Error fetching certificates');
      } finally {
        setLoadingPending(false);
      }
    };
    if (supabaseUrl && supabaseKey) {
      fetchPending();
    }
  }, [supabaseUrl, supabaseKey]);

  // Fetch recharge history
  useEffect(() => {
    const fetchHistory = async () => {
      setLoadingHistory(true);
      setErrorHistory(null);
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/cpd_recharge_history?select=*&order=recharged_at.desc&limit=10`,
          { headers }
        );
        if (!response.ok) throw new Error('Failed to fetch history');
        const data = await response.json();
        setRechargeHistory(data || []);
      } catch (error) {
        setErrorHistory(error instanceof Error ? error.message : 'Error fetching history');
      } finally {
        setLoadingHistory(false);
      }
    };
    if (supabaseUrl && supabaseKey) {
      fetchHistory();
    }
  }, [supabaseUrl, supabaseKey]);

  const handleRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rechargeAmount || parseInt(rechargeAmount) <= 0) {
      setErrorCredits('Please enter a valid amount');
      return;
    }

    setLoadingRecharge(true);
    setErrorCredits(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/cpd-credits-recharge`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ amount: parseInt(rechargeAmount) }),
        }
      );

      if (!response.ok) throw new Error('Failed to recharge credits');

      setSuccessMessage(`Recharge successful: +${rechargeAmount} credits`);
      setRechargeAmount('');

      // Refresh credits and history
      const creditsResponse = await fetch(
        `${supabaseUrl}/rest/v1/cpd_credits?select=*&order=recharged_at.desc&limit=1`,
        { headers }
      );
      if (creditsResponse.ok) {
        const creditsData = await creditsResponse.json();
        if (creditsData.length > 0) {
          setCredits(creditsData[0]);
        }
      }

      const historyResponse = await fetch(
        `${supabaseUrl}/rest/v1/cpd_recharge_history?select=*&order=recharged_at.desc&limit=10`,
        { headers }
      );
      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        setRechargeHistory(historyData || []);
      }
    } catch (error) {
      setErrorCredits(error instanceof Error ? error.message : 'Error during recharge');
    } finally {
      setLoadingRecharge(false);
    }
  };

  const availableCredits = credits.total_credits - credits.used_credits;
  const percentageUsed =
    credits.total_credits > 0 ? (credits.used_credits / credits.total_credits) * 100 : 0;

  const getProgressBarColor = () => {
    if (percentageUsed > 80) return DANGER_COLOR;
    if (percentageUsed > 50) return ACCENT_COLOR;
    return SUCCESS_COLOR;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-8">
          <Award size={32} style={{ color: PRIMARY_COLOR }} />
          <h1 className="text-3xl font-bold" style={{ color: PRIMARY_COLOR }}>
            Gestion des Crédits CPD
          </h1>
        </div>

        {/* Section 1: Current Balance */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-6" style={{ color: PRIMARY_COLOR }}>
            Solde Actuel
          </h2>

          {loadingCredits ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw size={24} className="animate-spin" style={{ color: PRIMARY_COLOR }} />
            </div>
          ) : errorCredits ? (
            <div className="bg-red-50 border border-red-200 rounded p-4 flex items-center gap-2">
              <AlertCircle size={20} style={{ color: DANGER_COLOR }} />
              <p style={{ color: DANGER_COLOR }}>{errorCredits}</p>
            </div>
          ) : (
            <div>
              {/* Three column stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 rounded p-4 border-l-4" style={{ borderLeftColor: PRIMARY_COLOR }}>
                  <p className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>
                    Crédits achetés
                  </p>
                  <p className="text-3xl font-bold mt-2" style={{ color: PRIMARY_COLOR }}>
                    {credits.total_credits}
                  </p>
                </div>
                <div className="bg-yellow-50 rounded p-4 border-l-4" style={{ borderLeftColor: ACCENT_COLOR }}>
                  <p className="text-sm font-semibold" style={{ color: ACCENT_COLOR }}>
                    Crédits utilisés
                  </p>
                  <p className="text-3xl font-bold mt-2" style={{ color: ACCENT_COLOR }}>
                    {credits.used_credits}
                  </p>
                </div>
                <div className="bg-green-50 rounded p-4 border-l-4" style={{ borderLeftColor: SUCCESS_COLOR }}>
                  <p className="text-sm font-semibold" style={{ color: SUCCESS_COLOR }}>
                    Disponibles
                  </p>
                  <p className="text-3xl font-bold mt-2" style={{ color: SUCCESS_COLOR }}>
                    {availableCredits}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-2">
                <p className="text-sm font-semibold text-gray-700">Utilisation</p>
                <div className="bg-gray-200 rounded-full h-4 overflow-hidden mt-2">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${percentageUsed}%`,
                      backgroundColor: getProgressBarColor(),
                    }}
                  />
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  {percentageUsed.toFixed(1)}% utilisés
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Recharge Form */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-6" style={{ color: PRIMARY_COLOR }}>
            Recharger les Crédits
          </h2>

          {successMessage && (
            <div className="bg-green-50 border border-green-200 rounded p-4 mb-4 flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: SUCCESS_COLOR }}
              />
              <p style={{ color: SUCCESS_COLOR }}>{successMessage}</p>
            </div>
          )}

          <form onSubmit={handleRecharge} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Montant à recharger
              </label>
              <div className="flex gap-3">
                <input
                  type="number"
                  value={rechargeAmount}
                  onChange={(e) => setRechargeAmount(e.target.value)}
                  placeholder="Nombre de crédits"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2"
                  style={{ focusRingColor: PRIMARY_COLOR }}
                  disabled={loadingRecharge}
                  min="1"
                />
                <button
                  type="submit"
                  disabled={loadingRecharge || !rechargeAmount}
                  className="px-6 py-2 rounded font-semibold text-white flex items-center gap-2 transition-opacity disabled:opacity-50"
                  style={{ backgroundColor: PRIMARY_COLOR }}
                >
                  {loadingRecharge ? (
                    <RefreshCw size={18} className="animate-spin" />
                  ) : (
                    <Plus size={18} />
                  )}
                  Recharger
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                1 crédit = 1 badge CPD Open émis
              </p>
            </div>
          </form>
        </div>

        {/* Section 3: Pending Certificates */}
        {pendingCerts.length > 0 && (
          <div
            className="bg-white rounded-lg shadow p-6 border-l-4"
            style={{ borderLeftColor: WARNING_COLOR }}
          >
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <span style={{ color: WARNING_COLOR }}>⏳</span>
              <span style={{ color: WARNING_COLOR }}>
                Badges en attente ({pendingCerts.length})
              </span>
            </h2>

            {loadingPending ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw size={24} className="animate-spin" style={{ color: PRIMARY_COLOR }} />
              </div>
            ) : errorPending ? (
              <div className="bg-red-50 border border-red-200 rounded p-4 flex items-center gap-2">
                <AlertCircle size={20} style={{ color: DANGER_COLOR }} />
                <p style={{ color: DANGER_COLOR }}>{errorPending}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderBottomColor: WARNING_COLOR }}>
                      <th className="text-left py-3 px-4 font-semibold" style={{ color: WARNING_COLOR }}>
                        Apprenant
                      </th>
                      <th className="text-left py-3 px-4 font-semibold" style={{ color: WARNING_COLOR }}>
                        Formation
                      </th>
                      <th className="text-left py-3 px-4 font-semibold" style={{ color: WARNING_COLOR }}>
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingCerts.map((cert) => (
                      <tr key={cert.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="py-3 px-4">{cert.student_full_name}</td>
                        <td className="py-3 px-4">{cert.course_title}</td>
                        <td className="py-3 px-4">{formatDate(cert.issued_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Section 4: Recent Recharge History */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <CreditCard size={24} style={{ color: PRIMARY_COLOR }} />
            <span style={{ color: PRIMARY_COLOR }}>Historique des Recharges</span>
          </h2>

          {loadingHistory ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw size={24} className="animate-spin" style={{ color: PRIMARY_COLOR }} />
            </div>
          ) : errorHistory ? (
            <div className="bg-red-50 border border-red-200 rounded p-4 flex items-center gap-2">
              <AlertCircle size={20} style={{ color: DANGER_COLOR }} />
              <p style={{ color: DANGER_COLOR }}>{errorHistory}</p>
            </div>
          ) : rechargeHistory.length === 0 ? (
            <p className="text-gray-500 text-center py-6">Aucune recharge enregistrée</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderBottomColor: PRIMARY_COLOR }}>
                    <th className="text-left py-3 px-4 font-semibold" style={{ color: PRIMARY_COLOR }}>
                      Date
                    </th>
                    <th className="text-left py-3 px-4 font-semibold" style={{ color: PRIMARY_COLOR }}>
                      Montant
                    </th>
                    <th className="text-left py-3 px-4 font-semibold" style={{ color: PRIMARY_COLOR }}>
                      Opérateur
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rechargeHistory.map((record) => (
                    <tr key={record.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-3 px-4">{formatDate(record.recharged_at)}</td>
                      <td className="py-3 px-4">
                        <span className="font-semibold" style={{ color: SUCCESS_COLOR }}>
                          +{record.amount}
                        </span>
                      </td>
                      <td className="py-3 px-4">{record.operator_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
