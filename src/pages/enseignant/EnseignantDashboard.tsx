import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { DashboardLayout } from '../../components/DashboardLayout';
import { Users, Clock, Star, MessageSquare, PlusCircle, BookOpen, Info, AlertCircle } from 'lucide-react';

interface Course {
  id: string; title: string; status: string;
  total_students: number; average_rating: number; pending_school_validation: boolean;
  cover_image_url?: string;
}
interface ProjetACorriger {
  id: string; course_id: string; course_title: string; student_name: string; submitted_at: string;
}
interface DashData {
  etablissement: { school_name: string; logo_url: string | null } | null;
  kpis: { eleves_actifs: number; heures_dispensees: number; note_moyenne: number; questions_forum_en_attente: number };
  mes_cours: Course[];
  projets_a_corriger: ProjetACorriger[];
}

function getApiBase() {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  return url ? `${url}/functions/v1` : '/api';
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  brouillon:                      { label: 'Brouillon', color: '#9CA3AF', bg: '#F3F4F6' },
  soumise:                        { label: 'Soumise', color: '#3B82F6', bg: '#EFF6FF' },
  en_attente_validation_manuelle: { label: 'En vérification', color: '#F59E0B', bg: '#FFFBEB' },
  validee:                        { label: 'Validée', color: '#16A34A', bg: '#F0FDF4' },
  publiee:                        { label: 'Publiée', color: '#1E7A52', bg: '#ECFDF5' },
  rejetee:                        { label: 'Rejetée', color: '#DC2626', bg: '#FEF2F2' },
  modification_demandee:          { label: 'À modifier', color: '#EA580C', bg: '#FFF7ED' },
};

export function EnseignantDashboard() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    const token = localStorage.getItem('omnia_session_token');
    if (!token) { navigate('/connexion'); return; }
    try {
      const res = await fetch(`${getApiBase()}/dashboard-enseignant`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 403) { navigate('/connexion'); return; }
      const json = await res.json();
      if (res.ok) setData(json);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [navigate]);

  useEffect(() => { load(); }, [load]);

  const KPIS = [
    { label: 'Élèves actifs', value: data?.kpis.eleves_actifs ?? 0, icon: Users, color: '#002050' },
    { label: 'Heures dispensées', value: data?.kpis.heures_dispensees ?? 0, icon: Clock, color: '#BF8813' },
    { label: 'Note moyenne', value: data?.kpis.note_moyenne ? `${data.kpis.note_moyenne}/5` : '—', icon: Star, color: '#BF8813' },
    { label: 'Questions en attente', value: data?.kpis.questions_forum_en_attente ?? 0, icon: MessageSquare, color: '#DC2626' },
  ];

  return (
    <DashboardLayout role="enseignant">
      <div className="p-6 lg:p-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mon espace enseignant</h1>
            {data?.etablissement && (
              <p className="text-gray-500 text-sm mt-0.5">{data.etablissement.school_name}</p>
            )}
          </div>
          <Link to="/staff/courses/new"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90"
            style={{ backgroundColor: '#002050' }}>
            <PlusCircle className="w-4 h-4" /> Nouvelle formation
          </Link>
        </div>

        {/* School ownership banner */}
        {data?.etablissement && (
          <div className="flex items-start gap-3 p-4 rounded-xl mb-5 text-sm" style={{ backgroundColor: '#F8F9FA', border: '1px solid #e5e7eb' }}>
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-400" />
            <p className="text-gray-600">
              Vos formations appartiennent à <strong>{data.etablissement.school_name}</strong>.
              Elles sont soumises à votre directeur avant d'être examinées par l'équipe Omnia.
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {KPIS.map((k) => (
                <div key={k.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-xs text-gray-500">{k.label}</span>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: k.color + '15' }}>
                      <k.icon className="w-4 h-4" style={{ color: k.color }} />
                    </div>
                  </div>
                  <p className="text-xl font-bold text-gray-900">{k.value}</p>
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-[1fr_340px] gap-6">
              {/* Left — My courses */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900 text-sm">Mes formations ({data?.mes_cours.length ?? 0})</h2>
                  <Link to="/staff/courses" className="text-xs font-medium" style={{ color: '#002050' }}>Voir tout →</Link>
                </div>
                {(data?.mes_cours ?? []).length === 0 ? (
                  <div className="p-10 text-center">
                    <BookOpen className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                    <p className="text-gray-500 text-sm">Vous n'avez pas encore de formation</p>
                    <Link to="/staff/courses/new"
                      className="mt-3 inline-flex items-center gap-1 text-sm font-semibold" style={{ color: '#002050' }}>
                      <PlusCircle className="w-4 h-4" /> Créer ma première formation
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {(data?.mes_cours ?? []).slice(0, 6).map((c) => {
                      const sc = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.brouillon;
                      return (
                        <div key={c.id} className="px-5 py-3.5 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: '#002050' + '10' }}>
                            <BookOpen className="w-4 h-4" style={{ color: '#002050' + '60' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{c.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                                style={{ backgroundColor: sc.bg, color: sc.color }}>{sc.label}</span>
                              {c.pending_school_validation && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-orange-100 text-orange-600">
                                  En attente directeur
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-gray-400 flex-shrink-0">{c.total_students} élèves</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right — Projects to correct + forum */}
              <div className="space-y-5">
                {/* Projects to correct */}
                {(data?.projets_a_corriger ?? []).length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      <h2 className="font-semibold text-gray-900 text-sm">Projets à corriger</h2>
                      <span className="ml-auto text-xs font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{data!.projets_a_corriger.length}</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {data!.projets_a_corriger.map((p) => (
                        <div key={p.id} className="px-5 py-3.5">
                          <p className="text-sm font-medium text-gray-900 truncate">{p.course_title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{p.student_name} · {new Date(p.submitted_at).toLocaleDateString('fr-FR')}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Forum */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-900 text-sm">Questions forum</h2>
                  </div>
                  <div className="p-5 text-center text-sm text-gray-400">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                    Aucune question en attente
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
