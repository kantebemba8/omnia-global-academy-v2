import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/DashboardLayout';

import {
  Wallet, TrendingUp, Users, Star, PlusCircle, AlertCircle,
  ChevronRight, Clock, CheckCircle, XCircle, AlertTriangle, Eye
} from 'lucide-react';

interface Formation {
  id: string; title: string; status: string; score_calcule: number;
  price_xof: number | null; prix_provisoire_xof: number | null;
  cover_image_url: string | null; category: string | null;
  total_students: number; average_rating: number;
  admin_comment: string | null; rejection_reason: string | null;
  projets_a_corriger: number; created_at: string;
}

interface DashData {
  user: { full_name: string; email: string };
  kpis: { solde_retirable_xof: number; gains_cumules_xof: number; total_eleves: number; note_globale: number };
  formations: Formation[];
  payout_requests: Array<{ id: string; amount_xof: number; channel: string; status: string; requested_at: string }>;
  wallet: { balance_xof: number; total_earned_xof: number; total_withdrawn_xof: number };
  forum_questions_unanswered: number;
}

function getApiBase() {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  return url ? `${url}/functions/v1` : '/api';
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  brouillon:                       { label: 'Brouillon', color: '#9CA3AF', bg: '#F3F4F6' },
  soumise:                         { label: 'Soumise', color: '#3B82F6', bg: '#EFF6FF' },
  en_attente_validation_manuelle:  { label: 'En vérification', color: '#F59E0B', bg: '#FFFBEB' },
  validee:                         { label: 'Validée', color: '#16A34A', bg: '#F0FDF4' },
  publiee:                         { label: 'Publiée', color: '#1E7A52', bg: '#ECFDF5' },
  rejetee:                         { label: 'Rejetée', color: '#DC2626', bg: '#FEF2F2' },
  modification_demandee:           { label: 'Modifications demandées', color: '#EA580C', bg: '#FFF7ED' },
  suspendue:                       { label: 'Suspendue', color: '#6B7280', bg: '#F9FAFB' },
};

const FILTER_TABS = [
  { key: '', label: 'Toutes' },
  { key: 'publiee', label: 'Publiées' },
  { key: 'en_attente_validation_manuelle', label: 'En attente' },
  { key: 'brouillon', label: 'Brouillons' },
  { key: 'rejetee', label: 'Rejetées' },
  { key: 'modification_demandee', label: 'À modifier' },
];

const PAYOUT_STATUS: Record<string, { label: string; color: string }> = {
  pending:                  { label: 'En attente', color: '#F59E0B' },
  waiting_final_verification: { label: 'Vérification finale', color: '#3B82F6' },
  approved:                 { label: 'Approuvé', color: '#1E7A52' },
  rejected:                 { label: 'Rejeté', color: '#DC2626' },
};

function kpiCard(label: string, value: string, icon: React.ReactNode, color: string) {
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color + '18' }}>
        <div style={{ color }}>{icon}</div>
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export function DashboardProfesseur() {
  const isPreview = new URLSearchParams(window.location.search).get('preview') === 'true';
  const isSuperAdmin = (() => {
    try { return JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false; }
    catch { return false; }
  })();
  const bypassAuth = isPreview && isSuperAdmin;

  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [previewToast, setPreviewToast] = useState(false);
  const navigate = useNavigate();

  function handlePreviewAction() {
    if (!bypassAuth) return;
    setPreviewToast(true);
    setTimeout(() => setPreviewToast(false), 3000);
  }

  const load = useCallback(async () => {
    if (bypassAuth) { setLoading(false); return; }
    const token = localStorage.getItem('omnia_session_token');
    if (!token) { if (!bypassAuth) navigate('/connexion'); setLoading(false); return; }
    try {
      const res = await fetch(`${getApiBase()}/dashboard-professeur`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 403) { if (!bypassAuth) navigate('/connexion'); setLoading(false); return; }
      const json = await res.json();
      if (res.ok) setData(json);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [navigate, bypassAuth]);

  useEffect(() => { load(); }, [load]);

  const formations = (data?.formations ?? []).filter((f) => !statusFilter || f.status === statusFilter);

  function actionButton(f: Formation) {
    if (f.status === 'brouillon') return (
      <Link to={`/professeur/courses/${f.id}/edit`}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: '#002050' }}>
        Continuer la rédaction
      </Link>
    );
    if (f.status === 'rejetee') return (
      <Link to={`/professeur/courses/${f.id}/edit`}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: '#DC2626' }}>
        Corriger et resoumettre
      </Link>
    );
    if (f.status === 'modification_demandee') return (
      <Link to={`/professeur/courses/${f.id}/edit`}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: '#EA580C' }}>
        Apporter les modifications
      </Link>
    );
    if (f.status === 'publiee') return (
      <Link to={`/professeur/analytics`}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg border flex items-center gap-1" style={{ borderColor: '#002050', color: '#002050' }}>
        <Eye className="w-3.5 h-3.5" /> Statistiques
      </Link>
    );
    if (['soumise', 'en_attente_validation_manuelle'].includes(f.status)) return (
      <span className="text-xs text-gray-400 italic">En cours de vérification...</span>
    );
    return null;
  }

  return (
    <DashboardLayout role="professeur">
      {previewToast && (
        <div className="fixed top-16 right-4 z-50 bg-gray-800 text-white text-xs font-medium px-4 py-2 rounded-lg shadow-lg">
          Mode aperçu — Action désactivée
        </div>
      )}
      <div className="p-6 lg:p-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Bonjour{data ? `, ${data.user.full_name.split(' ')[0]}` : ''} 👋
            </h1>
            <p className="text-gray-500 text-sm mt-1">Espace professeur</p>
          </div>
          {bypassAuth ? (
            <button onClick={handlePreviewAction}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white opacity-50 cursor-not-allowed"
              style={{ backgroundColor: '#002050' }}>
              <PlusCircle className="w-4 h-4" /> Nouvelle formation
            </button>
          ) : (
            <Link to="/professeur/courses/new"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#002050' }}>
              <PlusCircle className="w-4 h-4" /> Nouvelle formation
            </Link>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {kpiCard('Solde retirable', `${(data?.kpis.solde_retirable_xof ?? 0).toLocaleString()} XOF`, <Wallet className="w-5 h-5" />, '#1E7A52')}
              {kpiCard('Gains cumulés', `${(data?.kpis.gains_cumules_xof ?? 0).toLocaleString()} XOF`, <TrendingUp className="w-5 h-5" />, '#BF8813')}
              {kpiCard('Total élèves', String(data?.kpis.total_eleves ?? 0), <Users className="w-5 h-5" />, '#002050')}
              {kpiCard('Note globale', `★ ${data?.kpis.note_globale ?? 0}/5`, <Star className="w-5 h-5" />, '#BF8813')}
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              {/* Formations — 65% */}
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-gray-900">Mes formations actives</h2>
                  <Link to="/professeur/courses" className="text-xs font-medium" style={{ color: '#002050' }}>
                    Voir tout <ChevronRight className="w-3.5 h-3.5 inline" />
                  </Link>
                </div>

                {/* Filter pills */}
                <div className="flex gap-1.5 flex-wrap mb-4">
                  {FILTER_TABS.map((t) => (
                    <button key={t.key} onClick={() => setStatusFilter(t.key)}
                      className="text-xs px-3 py-1 rounded-full font-medium transition-all"
                      style={statusFilter === t.key ? { backgroundColor: '#002050', color: 'white' } : { backgroundColor: '#f3f4f6', color: '#374151' }}>
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  {formations.length === 0 ? (
                    <div className="bg-white rounded-xl p-8 border border-gray-100 text-center">
                      <PlusCircle className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                      <p className="text-gray-500 text-sm">Aucune formation</p>
                      <Link to="/professeur/courses/new"
                        className="mt-3 inline-block text-sm font-medium" style={{ color: '#002050' }}>
                        Créer votre première formation
                      </Link>
                    </div>
                  ) : (
                    formations.slice(0, 6).map((f) => {
                      const sc = STATUS_CONFIG[f.status] ?? STATUS_CONFIG.brouillon;
                      return (
                        <div key={f.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                          <div className="flex items-start gap-3">
                            <div className="w-16 h-12 rounded-lg flex-shrink-0 overflow-hidden bg-gray-100 flex items-center justify-center"
                              style={{ backgroundColor: '#002050' + '15' }}>
                              {f.cover_image_url
                                ? <img src={f.cover_image_url} alt="" className="w-full h-full object-cover" />
                                : <span className="text-lg font-bold" style={{ color: '#002050' }}>{f.title[0]}</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-semibold text-sm text-gray-900 truncate">{f.title}</p>
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: sc.bg, color: sc.color }}>{sc.label}</span>
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {f.total_students} élève{f.total_students !== 1 ? 's' : ''}
                                {f.average_rating > 0 && ` · ★ ${f.average_rating}`}
                              </p>
                              {f.projets_a_corriger > 0 && (
                                <Link to={`/professeur/courses`}
                                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                                  style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}>
                                  <AlertCircle className="w-3 h-3" /> {f.projets_a_corriger} projet(s) à corriger
                                </Link>
                              )}
                              {/* Comment / rejection cards */}
                              {f.rejection_reason && (
                                <div className="mt-2 bg-red-50 border border-red-100 rounded-lg p-2">
                                  <button onClick={() => setExpandedComments((p) => ({ ...p, [f.id + '_rej']: !p[f.id + '_rej'] }))}
                                    className="flex items-center gap-1 text-xs font-medium text-red-600">
                                    <XCircle className="w-3 h-3" /> Motif de rejet
                                    <ChevronRight className={`w-3 h-3 transition-transform ${expandedComments[f.id + '_rej'] ? 'rotate-90' : ''}`} />
                                  </button>
                                  {expandedComments[f.id + '_rej'] && <p className="mt-1 text-xs text-red-700">{f.rejection_reason}</p>}
                                </div>
                              )}
                              {f.admin_comment && (
                                <div className="mt-2 bg-blue-50 border border-blue-100 rounded-lg p-2">
                                  <button onClick={() => setExpandedComments((p) => ({ ...p, [f.id + '_cmt']: !p[f.id + '_cmt'] }))}
                                    className="flex items-center gap-1 text-xs font-medium text-blue-600">
                                    <AlertTriangle className="w-3 h-3" /> Note admin
                                    <ChevronRight className={`w-3 h-3 transition-transform ${expandedComments[f.id + '_cmt'] ? 'rotate-90' : ''}`} />
                                  </button>
                                  {expandedComments[f.id + '_cmt'] && <p className="mt-1 text-xs text-blue-700">{f.admin_comment}</p>}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="mt-3 flex justify-end">{actionButton(f)}</div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right — 35% */}
              <div className="space-y-4">
                {/* Forum alert */}
                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                  <h2 className="font-semibold text-gray-900 mb-3 text-sm">Questions forum</h2>
                  {(data?.forum_questions_unanswered ?? 0) > 0 ? (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <p className="text-orange-700 text-xs font-medium">
                        {data!.forum_questions_unanswered} question(s) sans réponse depuis 24h
                      </p>
                      <Link to="/professeur/forum" className="mt-1 text-xs font-semibold text-orange-600 hover:underline">
                        Voir les questions
                      </Link>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-green-600">
                      <CheckCircle className="w-4 h-4" /> Toutes les questions sont répondues
                    </div>
                  )}
                </div>

                {/* Recent payouts */}
                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-semibold text-gray-900 text-sm">Derniers retraits</h2>
                    <Link to="/professeur/payouts" className="text-xs" style={{ color: '#BF8813' }}>
                      Gérer
                    </Link>
                  </div>
                  {(data?.payout_requests ?? []).length === 0 ? (
                    <p className="text-xs text-gray-400">Aucun retrait effectué</p>
                  ) : (
                    <div className="space-y-2">
                      {data!.payout_requests.slice(0, 3).map((p) => {
                        const ps = PAYOUT_STATUS[p.status] ?? PAYOUT_STATUS.pending;
                        return (
                          <div key={p.id} className="flex items-center justify-between text-xs">
                            <span className="text-gray-700 font-medium">{p.amount_xof.toLocaleString()} XOF</span>
                            <div className="flex items-center gap-2">
                              <span className="font-medium" style={{ color: ps.color }}>{ps.label}</span>
                              <span className="text-gray-400">
                                {new Date(p.requested_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Wallet summary */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Solde retirable</span>
                      <span className="font-bold text-sm" style={{ color: '#1E7A52' }}>
                        {(data?.wallet.balance_xof ?? 0).toLocaleString()} XOF
                      </span>
                    </div>
                    <Link to="/professeur/payouts"
                      className="mt-2 block text-center text-xs font-semibold py-2 rounded-lg text-white transition-opacity hover:opacity-90"
                      style={{ backgroundColor: '#BF8813' }}>
                      Demander un retrait
                    </Link>
                  </div>
                </div>

                {/* Clock / tips */}
                <div className="rounded-xl p-4 border" style={{ backgroundColor: '#002050' + '08', borderColor: '#002050' + '20' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4" style={{ color: '#002050' }} />
                    <p className="text-xs font-semibold" style={{ color: '#002050' }}>Délai de validation</p>
                  </div>
                  <p className="text-xs text-gray-500">Les formations soumises sont examinées sous 24 à 48 heures ouvrables.</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
