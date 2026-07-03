import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/DashboardLayout';
import { PlusCircle, BookOpen, AlertCircle, CheckCircle, Eye, Edit2 } from 'lucide-react';

interface Formation {
  id: string; title: string; status: string;
  cover_image_url: string | null; category: string | null;
  total_students: number; average_rating: number;
  projets_a_corriger: number; created_at: string;
  prix_provisoire_xof: number | null; price_xof: number | null;
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
  suspendue:                      { label: 'Suspendue', color: '#6B7280', bg: '#F9FAFB' },
};

export function ProfesseurMesFormations() {
  const [formations, setFormations] = useState<Formation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const navigate = useNavigate();

  const bypassAuth = new URLSearchParams(window.location.search).get('preview') === 'true' &&
    (() => { try { return JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false; } catch { return false; } })();

  const load = useCallback(async () => {
    if (bypassAuth) { setLoading(false); return; }
    const token = localStorage.getItem('omnia_session_token');
    if (!token && !bypassAuth) { navigate('/connexion'); return; }
    try {
      const res = await fetch(`${getApiBase()}/dashboard-professeur`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 403 && !bypassAuth) { navigate('/connexion'); return; }
      const json = await res.json();
      if (res.ok) setFormations(json.formations ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [navigate, bypassAuth]);

  useEffect(() => { load(); }, [load]);

  const filtered = filter ? formations.filter((f) => f.status === filter) : formations;

  const FILTERS = [
    { key: '', label: `Toutes (${formations.length})` },
    { key: 'publiee', label: 'Publiées' },
    { key: 'en_attente_validation_manuelle', label: 'En attente' },
    { key: 'brouillon', label: 'Brouillons' },
    { key: 'rejetee', label: 'Rejetées' },
    { key: 'modification_demandee', label: 'À modifier' },
  ];

  return (
    <DashboardLayout role="professeur">
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mes formations</h1>
            <p className="text-gray-500 text-sm mt-1">{formations.length} formation{formations.length !== 1 ? 's' : ''}</p>
          </div>
          <Link to="/professeur/courses/new"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90"
            style={{ backgroundColor: '#002050' }}>
            <PlusCircle className="w-4 h-4" /> Nouvelle formation
          </Link>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap mb-5">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className="text-sm px-3 py-1.5 rounded-lg font-medium transition-all"
              style={filter === f.key ? { backgroundColor: '#002050', color: 'white' } : { backgroundColor: 'white', color: '#374151', border: '1px solid #e5e7eb' }}>
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-12 border border-gray-100 text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-200" />
            <p className="text-gray-500">Aucune formation</p>
            <Link to="/professeur/courses/new"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg text-white"
              style={{ backgroundColor: '#002050' }}>
              <PlusCircle className="w-4 h-4" /> Créer une formation
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((f) => {
              const sc = STATUS_CONFIG[f.status] ?? STATUS_CONFIG.brouillon;
              const price = f.status === 'publiee' ? f.price_xof : f.prix_provisoire_xof;
              return (
                <div key={f.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                  <div className="h-28 relative flex items-center justify-center" style={{ backgroundColor: '#002050' + '10' }}>
                    {f.cover_image_url
                      ? <img src={f.cover_image_url} alt="" className="w-full h-full object-cover" />
                      : <BookOpen className="w-10 h-10" style={{ color: '#002050' + '60' }} />}
                    <span className="absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: sc.bg, color: sc.color }}>{sc.label}</span>
                    {f.projets_a_corriger > 0 && (
                      <span className="absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full bg-red-500 text-white flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {f.projets_a_corriger}
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="font-semibold text-gray-900 text-sm line-clamp-2 mb-2">{f.title}</p>
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                      <span>{f.total_students} élève{f.total_students !== 1 ? 's' : ''}</span>
                      {f.average_rating > 0 && <span>★ {f.average_rating}/5</span>}
                      {price && <span className="font-semibold" style={{ color: '#BF8813' }}>{price.toLocaleString()} XOF</span>}
                    </div>
                    <div className="flex gap-2">
                      {['brouillon', 'rejetee', 'modification_demandee'].includes(f.status) && (
                        <Link to={`/professeur/courses/${f.id}/edit`}
                          className="flex-1 py-2 text-xs font-semibold text-center rounded-lg border flex items-center justify-center gap-1"
                          style={{ borderColor: '#002050', color: '#002050' }}>
                          <Edit2 className="w-3.5 h-3.5" /> Modifier
                        </Link>
                      )}
                      {f.status === 'publiee' && (
                        <Link to="/professeur/analytics"
                          className="flex-1 py-2 text-xs font-semibold text-center rounded-lg flex items-center justify-center gap-1 text-white"
                          style={{ backgroundColor: '#002050' }}>
                          <Eye className="w-3.5 h-3.5" /> Analytique
                        </Link>
                      )}
                      {['soumise', 'en_attente_validation_manuelle', 'validee'].includes(f.status) && (
                        <div className="flex-1 py-2 text-xs text-center rounded-lg" style={{ backgroundColor: '#f9fafb', color: '#9ca3af' }}>
                          <CheckCircle className="w-3.5 h-3.5 inline mr-1" /> En attente
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
