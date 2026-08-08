import { getSessionToken } from '../../lib/session';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/DashboardLayout';
import { RoleDashboardPanel, RoleDashboardStatCard } from '../../components/dashboard/RoleDashboardCards';
import { dashboardGreeting } from '../../lib/dashboardGreeting';
import CoachOpportunityNotice from '../../components/coaching/CoachOpportunityNotice';

import {
  BookOpen, Users, Star, PlusCircle, AlertCircle,
  ChevronRight, Clock, CheckCircle, XCircle, AlertTriangle, Eye,
  ClipboardCheck
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


const PREVIEW_DASHBOARD: DashData = {
  user: { full_name: '', email: '' },
  kpis: { solde_retirable_xof: 0, gains_cumules_xof: 0, total_eleves: 0, note_globale: 0 },
  formations: [],
  payout_requests: [],
  wallet: { balance_xof: 0, total_earned_xof: 0, total_withdrawn_xof: 0 },
  forum_questions_unanswered: 0,
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:             { label: 'Brouillon', color: '#9CA3AF', bg: '#F3F4F6' },
  pending_validation:{ label: 'En vérification', color: '#F59E0B', bg: '#FFFBEB' },
  validated:         { label: 'Validée', color: '#16A34A', bg: '#F0FDF4' },
  published:         { label: 'Publiée', color: '#1E7A52', bg: '#ECFDF5' },
  rejected:          { label: 'Rejetée', color: '#DC2626', bg: '#FEF2F2' },
  changes_requested: { label: 'Modifications demandées', color: '#EA580C', bg: '#FFF7ED' },
  archived:          { label: 'Archivée', color: '#6B7280', bg: '#F9FAFB' },
  // Compatibilité des anciennes données uniquement.
  brouillon: { label: 'Brouillon', color: '#9CA3AF', bg: '#F3F4F6' },
  soumise: { label: 'En vérification', color: '#F59E0B', bg: '#FFFBEB' },
  en_attente_validation_manuelle: { label: 'En vérification', color: '#F59E0B', bg: '#FFFBEB' },
  validee: { label: 'Validée', color: '#16A34A', bg: '#F0FDF4' },
  publiee: { label: 'Publiée', color: '#1E7A52', bg: '#ECFDF5' },
  rejetee: { label: 'Rejetée', color: '#DC2626', bg: '#FEF2F2' },
  modification_demandee: { label: 'Modifications demandées', color: '#EA580C', bg: '#FFF7ED' },
  suspendue: { label: 'Archivée', color: '#6B7280', bg: '#F9FAFB' },
};

const FILTER_TABS = [
  { key: '', label: 'Toutes' },
  { key: 'published', label: 'Publiées' },
  { key: 'pending_validation', label: 'En attente' },
  { key: 'draft', label: 'Brouillons' },
  { key: 'rejected', label: 'Rejetées' },
  { key: 'changes_requested', label: 'À modifier' },
];

const STATUS_ALIASES: Record<string, string[]> = {
  published: ['published', 'publiee'],
  pending_validation: ['pending_validation', 'soumise', 'en_attente_validation_manuelle'],
  draft: ['draft', 'brouillon'],
  rejected: ['rejected', 'rejetee'],
  changes_requested: ['changes_requested', 'modification_demandee'],
};

export function DashboardProfesseur() {
  const queryPreview = new URLSearchParams(window.location.search).get('preview') === 'true';
  const storedPreview = sessionStorage.getItem('omnia_admin_role_preview') === 'professeur';
  const isSuperAdmin = (() => {
    try { return JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false; }
    catch { return false; }
  })();
  const bypassAuth = isSuperAdmin && (queryPreview || storedPreview);

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
    if (bypassAuth) { setData(PREVIEW_DASHBOARD); setLoading(false); return; }
    const token = getSessionToken();
    if (!token) { if (!bypassAuth) navigate('/connexion'); setLoading(false); return; }
    try {
      const res = await fetch(`${getApiBase()}/dashboard-professeur`, {
        headers: edgeAuthHeaders(),
      });
      if (res.status === 401) { if (!bypassAuth) navigate('/connexion'); setLoading(false); return; }
      const json = await res.json();
      if (res.ok) setData(json);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [navigate, bypassAuth]);

  useEffect(() => { load(); }, [load]);

  const formations = (data?.formations ?? []).filter((f) => !statusFilter || (STATUS_ALIASES[statusFilter] || [statusFilter]).includes(f.status));

  const publishedCount = (data?.formations ?? []).filter(f => ['published', 'publiee'].includes(f.status)).length;
  const projectsToReview = (data?.formations ?? []).reduce((sum, formation) => sum + (formation.projets_a_corriger || 0), 0);

  function actionButton(f: Formation) {
    if (['draft', 'brouillon'].includes(f.status)) return (
      <Link to={`/professeur/courses/${f.id}/edit`}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: '#002050' }}>
        Continuer la rédaction
      </Link>
    );
    if (['rejected', 'rejetee'].includes(f.status)) return (
      <Link to={`/professeur/courses/${f.id}/edit`}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: '#DC2626' }}>
        Corriger et resoumettre
      </Link>
    );
    if (['changes_requested', 'modification_demandee'].includes(f.status)) return (
      <Link to={`/professeur/courses/${f.id}/edit`}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: '#EA580C' }}>
        Apporter les modifications
      </Link>
    );
    if (['published', 'publiee'].includes(f.status)) return (
      <Link to={`/professeur/analytics`}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg border flex items-center gap-1" style={{ borderColor: '#002050', color: '#002050' }}>
        <Eye className="w-3.5 h-3.5" /> Statistiques
      </Link>
    );
    if (['pending_validation', 'soumise', 'en_attente_validation_manuelle', 'validated', 'validee'].includes(f.status)) return (
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
            <h1 className="text-2xl font-bold text-[#002050]">{dashboardGreeting(data?.user.full_name)}</h1>
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

        <CoachOpportunityNotice disabled={bypassAuth} />

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <>
            <div className="mb-8 grid grid-cols-2 border-t border-slate-200 lg:grid-cols-4">
              <RoleDashboardStatCard label="Formations publiées" value={publishedCount} icon={BookOpen} accent="#002050" to="/professeur/courses" />
              <RoleDashboardStatCard label="Élèves accompagnés" value={data?.kpis.total_eleves ?? 0} icon={Users} accent="#1E7A52" to="/professeur/analytics" />
              <RoleDashboardStatCard label="Projets à corriger" value={projectsToReview} icon={ClipboardCheck} accent="#DC2626" to="/professeur/courses" />
              <RoleDashboardStatCard label="Note globale" value={`${data?.kpis.note_globale ?? 0}/5`} icon={Star} accent="#BF8813" to="/professeur/analytics" />
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
                    <div className="border-y border-slate-200 bg-white py-10 text-center">
                      <PlusCircle className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                      <p className="text-gray-500 text-sm">Aucune formation</p>
                      {bypassAuth ? (
                        <button type="button" onClick={handlePreviewAction} className="mt-3 text-sm font-medium" style={{ color: '#002050' }}>
                          Créer votre première formation
                        </button>
                      ) : (
                        <Link to="/professeur/courses/new" className="mt-3 inline-block text-sm font-medium" style={{ color: '#002050' }}>
                          Créer votre première formation
                        </Link>
                      )}
                    </div>
                  ) : (
                    formations.slice(0, 6).map((f) => {
                      const sc = STATUS_CONFIG[f.status] ?? STATUS_CONFIG.brouillon;
                      return (
                        <div key={f.id} className="border-b border-slate-200 bg-white py-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-12 w-16 flex-shrink-0 items-center justify-center overflow-hidden border border-slate-200 bg-slate-50"
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
                <RoleDashboardPanel>
                  <h2 className="font-semibold text-gray-900 mb-3 text-sm">Questions forum</h2>
                  {(data?.forum_questions_unanswered ?? 0) > 0 ? (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <p className="text-orange-700 text-xs font-medium">
                        {data!.forum_questions_unanswered} question(s) sans réponse depuis 24h
                      </p>
                      <Link to="/forum" className="mt-1 text-xs font-semibold text-orange-600 hover:underline">
                        Voir les questions
                      </Link>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-green-600">
                      <CheckCircle className="w-4 h-4" /> Toutes les questions sont répondues
                    </div>
                  )}
                </RoleDashboardPanel>

                <RoleDashboardPanel>
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4" style={{ color: '#002050' }} />
                    <p className="text-xs font-semibold" style={{ color: '#002050' }}>Délai de validation</p>
                  </div>
                  <p className="text-xs text-gray-500">Les formations soumises sont examinées par l’équipe Omnia avant publication.</p>
                </RoleDashboardPanel>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
