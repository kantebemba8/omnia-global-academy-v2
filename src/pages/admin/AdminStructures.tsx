import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '../../components/AdminLayout';
import {
  Building2, Search, RefreshCw, CheckCircle, XCircle,
  AlertCircle, Clock, Eye, Filter, ChevronDown, Users,
  QrCode, Gift, BarChart2, Archive
} from 'lucide-react';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/structure-manage`;

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  pending_validation: { label: 'En attente',          color: '#92400E', bg: '#FEF3C7', dot: '#D97706' },
  changes_requested:  { label: 'Modif. demandée',     color: '#1D4ED8', bg: '#EFF6FF', dot: '#3B82F6' },
  validated:          { label: 'Validée',              color: '#065F46', bg: '#D1FAE5', dot: '#10B981' },
  rejected:           { label: 'Refusée',              color: '#991B1B', bg: '#FEE2E2', dot: '#DC2626' },
  suspended:          { label: 'Suspendue',            color: '#374151', bg: '#F3F4F6', dot: '#9CA3AF' },
  draft:              { label: 'Brouillon',            color: '#6B7280', bg: '#F3F4F6', dot: '#9CA3AF' },
  archived:           { label: 'Archivée',             color: '#374151', bg: '#F3F4F6', dot: '#6B7280' },
};

const STRUCTURE_TYPES: Record<string, string> = {
  ministere: 'Ministère', etablissement: 'Établissement',
  universite: 'Université', ecole: 'École',
  centre_formation: 'Centre de formation', entreprise: 'Entreprise',
  ong: 'ONG', association: 'Association',
  institution_publique: 'Institution publique',
  organisation_internationale: 'Organisation internationale',
  cabinet_formation: 'Cabinet de formation', autre: 'Autre',
};

const DISPLAY_NAMES: Record<string, string> = {
  ministere: 'Espace Ministère', etablissement: 'Espace Établissement',
  universite: 'Espace Université', ecole: 'Espace École',
  centre_formation: 'Espace Centre de formation', entreprise: 'Espace Entreprise',
  ong: 'Espace ONG', association: 'Espace Association',
  institution_publique: 'Espace Institution publique',
  organisation_internationale: 'Espace Organisation internationale',
  cabinet_formation: 'Espace Cabinet de formation', autre: 'Espace Structure professionnelle',
};

interface Structure {
  id: string; name: string; structure_type: string; status: string;
  country: string; city: string; professional_email: string;
  responsible_name: string; created_at: string; validated_at?: string;
  display_name: string; status_label: string;
}

interface DetailModal {
  structure: Structure & Record<string, any>;
  loading: boolean;
}

export default function AdminStructures() {
  const [structures, setStructures] = useState<Structure[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending_validation');
  const [typeFilter, setTypeFilter] = useState('');
  const [detail, setDetail] = useState<DetailModal | null>(null);
  const [actionLoading, setActionLoading] = useState('');
  const [toast, setToast] = useState('');
  const [adminComment, setAdminComment] = useState('');
  const [showPending, setShowPending] = useState<{ structures: number; codes: number; benefits: number } | null>(null);

  const token = () => localStorage.getItem('omnia_session_token') || '';
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  async function load() {
    setLoading(true);
    const [listRes, pendingRes] = await Promise.all([
      fetch(API, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'admin_list_structures', status_filter: statusFilter || undefined, type_filter: typeFilter || undefined, search: search || undefined }),
      }),
      fetch(API, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'admin_pending_overview' }),
      }),
    ]);
    const listData = await listRes.json();
    const pendingData = await pendingRes.json();
    if (listData.success) setStructures(listData.structures ?? []);
    if (pendingData.success) setShowPending({
      structures: pendingData.pending.structures.length,
      codes: pendingData.pending.codes.length,
      benefits: pendingData.pending.benefits.length,
    });
    setLoading(false);
  }

  useEffect(() => { load(); }, [statusFilter, typeFilter]);

  async function loadDetail(structure: Structure) {
    setDetail({ structure: structure as any, loading: true });
    const res = await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_structure', structure_id: structure.id }),
    });
    const data = await res.json();
    if (data.success) setDetail({ structure: data.structure, loading: false });
  }

  async function handleDecision(structureId: string, decision: string) {
    if (!adminComment && ['reject', 'request_changes'].includes(decision)) {
      showToast('Un commentaire est requis pour ce type de décision');
      return;
    }
    setActionLoading(decision);
    const res = await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'admin_validate_structure',
        structure_id: structureId,
        decision,
        admin_comment: adminComment,
        rejection_reason: decision === 'reject' ? adminComment : undefined,
      }),
    });
    const data = await res.json();
    if (data.success) {
      const labels: Record<string, string> = {
        validate: ' Structure validée', reject: ' Structure refusée',
        request_changes: ' Modification demandée', suspend: ' Structure suspendue',
        archive: '📦 Structure archivée', restore: ' Structure restaurée',
      };
      showToast(labels[decision] ?? 'Action effectuée');
      setDetail(null);
      setAdminComment('');
      load();
    } else showToast(data.error ?? 'Erreur');
    setActionLoading('');
  }

  const stats = {
    total: structures.length,
    validated: structures.filter(s => s.status === 'validated').length,
    pending: structures.filter(s => s.status === 'pending_validation').length,
    suspended: structures.filter(s => s.status === 'suspended').length,
  };

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {toast && (
          <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border"
            style={{ background: 'white', borderColor: '#E4E7EC', color: '#002050' }}>{toast}</div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-black" style={{ color: '#002050' }}>Structures</h1>
            <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
              Gérez et validez les structures inscrites sur Omnia Global Academy
            </p>
          </div>
          <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm border"
            style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>
            <RefreshCw size={13} /> Actualiser
          </button>
        </div>

        {/* Alertes en attente */}
        {showPending && (showPending.structures > 0 || showPending.codes > 0 || showPending.benefits > 0) && (
          <div className="grid grid-cols-3 gap-3">
            {showPending.structures > 0 && (
              <button onClick={() => setStatusFilter('pending_validation')}
                className="flex items-center gap-3 p-3 rounded-xl border-2 transition-all hover:shadow-sm"
                style={{ borderColor: '#FDE68A', background: '#FFFBEB' }}>
                <Clock size={18} style={{ color: '#D97706' }} />
                <div className="text-left">
                  <p className="font-bold text-sm" style={{ color: '#92400E' }}>{showPending.structures} structure{showPending.structures > 1 ? 's' : ''}</p>
                  <p className="text-xs" style={{ color: '#B45309' }}>En attente de validation</p>
                </div>
              </button>
            )}
            {showPending.codes > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-xl border-2" style={{ borderColor: '#BFDBFE', background: '#EFF6FF' }}>
                <QrCode size={18} style={{ color: '#3B82F6' }} />
                <div>
                  <p className="font-bold text-sm" style={{ color: '#1D4ED8' }}>{showPending.codes} code{showPending.codes > 1 ? 's' : ''}</p>
                  <p className="text-xs" style={{ color: '#1E40AF' }}>Codes à valider</p>
                </div>
              </div>
            )}
            {showPending.benefits > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-xl border-2" style={{ borderColor: '#A7F3D0', background: '#ECFDF5' }}>
                <Gift size={18} style={{ color: '#10B981' }} />
                <div>
                  <p className="font-bold text-sm" style={{ color: '#065F46' }}>{showPending.benefits} avantage{showPending.benefits > 1 ? 's' : ''}</p>
                  <p className="text-xs" style={{ color: '#047857' }}>Avantages à valider</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: stats.total, color: '#002050', bg: '#EEF2FF' },
            { label: 'Validées', value: stats.validated, color: '#065F46', bg: '#D1FAE5' },
            { label: 'En attente', value: stats.pending, color: '#92400E', bg: '#FEF3C7' },
            { label: 'Suspendues', value: stats.suspended, color: '#374151', bg: '#F3F4F6' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl border p-4" style={{ borderColor: '#E4E7EC', background: s.bg }}>
              <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs mt-1" style={{ color: '#6B7280' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-3 text-gray-400" />
            <input className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#002050]"
              placeholder="Rechercher une structure..."
              value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && load()} />
          </div>
          <select className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#002050]"
            value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">Tous les statuts</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <select className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#002050]"
            value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">Tous les types</option>
            {Object.entries(STRUCTURE_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {/* Liste */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
          </div>
        ) : structures.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed p-16 text-center" style={{ borderColor: '#E4E7EC' }}>
            <Building2 size={40} className="mx-auto mb-3 opacity-10" style={{ color: '#002050' }} />
            <p className="font-bold" style={{ color: '#002050' }}>Aucune structure trouvée</p>
            <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>Modifiez vos filtres</p>
          </div>
        ) : (
          <div className="space-y-3">
            {structures.map(s => {
              const sc = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.draft;
              return (
                <div key={s.id} className="bg-white rounded-2xl border p-5 hover:shadow-sm transition-all"
                  style={{ borderColor: '#E4E7EC' }}>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: '#EEF2FF' }}>
                      <Building2 size={22} style={{ color: '#002050' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold" style={{ color: '#002050' }}>{s.name}</h3>
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: sc.bg, color: sc.color }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc.dot }} />
                          {sc.label}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: '#F3F4F6', color: '#6B7280' }}>
                          {STRUCTURE_TYPES[s.structure_type] ?? s.structure_type}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap text-xs" style={{ color: '#9CA3AF' }}>
                        {s.responsible_name && <span>👤 {s.responsible_name}</span>}
                        {s.professional_email && <span>✉️ {s.professional_email}</span>}
                        {s.city && <span>📍 {s.city}, {s.country}</span>}
                        <span>📅 {new Date(s.created_at).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </div>
                    <button onClick={() => loadDetail(s)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white flex-shrink-0"
                      style={{ background: '#002050' }}>
                      <Eye size={14} /> Gérer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal détail / actions */}
        {detail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
            style={{ background: 'rgba(0,0,0,0.6)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4">
              {/* Header modal */}
              <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: '#E4E7EC' }}>
                <div>
                  <h2 className="text-lg font-black" style={{ color: '#002050' }}>
                    {detail.structure.name}
                  </h2>
                  <p className="text-sm" style={{ color: '#6B7280' }}>
                    {DISPLAY_NAMES[detail.structure.structure_type] ?? 'Espace Structure'}
                  </p>
                </div>
                <button onClick={() => { setDetail(null); setAdminComment(''); }}
                  className="p-2 rounded-xl hover:bg-gray-100">
                  <XCircle size={20} style={{ color: '#9CA3AF' }} />
                </button>
              </div>

              {detail.loading ? (
                <div className="flex justify-center py-16">
                  <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                    style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
                </div>
              ) : (
                <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                  {/* Statut actuel */}
                  {(() => {
                    const sc = STATUS_CONFIG[detail.structure.status] ?? STATUS_CONFIG.draft;
                    return (
                      <div className="flex items-center gap-2 p-3 rounded-xl"
                        style={{ background: sc.bg }}>
                        <span className="w-2 h-2 rounded-full" style={{ background: sc.dot }} />
                        <span className="text-sm font-bold" style={{ color: sc.color }}>
                          Statut actuel : {sc.label}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Infos structure */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      { label: 'Type', value: STRUCTURE_TYPES[detail.structure.structure_type] },
                      { label: 'Pays', value: detail.structure.country },
                      { label: 'Ville', value: detail.structure.city },
                      { label: 'Adresse', value: detail.structure.address },
                      { label: 'Email pro', value: detail.structure.professional_email },
                      { label: 'Téléphone', value: detail.structure.phone },
                      { label: 'Site web', value: detail.structure.website },
                      { label: 'Responsable', value: detail.structure.responsible_name },
                      { label: 'Fonction', value: detail.structure.responsible_function },
                      { label: 'Email responsable', value: detail.structure.responsible_email },
                    ].filter(i => i.value).map(item => (
                      <div key={item.label} className="p-2 rounded-lg" style={{ background: '#F8F9FA' }}>
                        <p className="text-xs font-semibold" style={{ color: '#9CA3AF' }}>{item.label}</p>
                        <p className="font-medium mt-0.5" style={{ color: '#002050' }}>{item.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Description */}
                  {detail.structure.description && (
                    <div>
                      <p className="text-xs font-semibold mb-1" style={{ color: '#9CA3AF' }}>Description</p>
                      <p className="text-sm p-3 rounded-xl" style={{ background: '#F8F9FA', color: '#374151' }}>
                        {detail.structure.description}
                      </p>
                    </div>
                  )}

                  {/* Objectif */}
                  {detail.structure.objective && (
                    <div>
                      <p className="text-xs font-semibold mb-1" style={{ color: '#9CA3AF' }}>Objectif de présence</p>
                      <p className="text-sm p-3 rounded-xl" style={{ background: '#F8F9FA', color: '#374151' }}>
                        {detail.structure.objective}
                      </p>
                    </div>
                  )}

                  {/* Documents */}
                  <div className="flex gap-3">
                    {detail.structure.logo_url && (
                      <a href={detail.structure.logo_url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border"
                        style={{ borderColor: '#E4E7EC', color: '#374151' }}>
                        🖼️ Voir le logo
                      </a>
                    )}
                    {detail.structure.justificatif_url && (
                      <a href={detail.structure.justificatif_url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border"
                        style={{ borderColor: '#E4E7EC', color: '#374151' }}>
                        📄 Document justificatif
                      </a>
                    )}
                  </div>

                  {/* Commentaire admin */}
                  <div>
                    <label className="block text-xs font-semibold mb-2" style={{ color: '#374151' }}>
                      Commentaire / Motif de décision
                      <span className="font-normal text-gray-400 ml-1">(requis pour refus ou modification)</span>
                    </label>
                    <textarea
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#002050] resize-none"
                      rows={3} placeholder="Entrez votre commentaire..."
                      value={adminComment} onChange={e => setAdminComment(e.target.value)} />
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {[
                      { decision: 'validate',        label: 'Valider',             bg: '#1E7A52', show: ['pending_validation', 'changes_requested', 'draft'] },
                      { decision: 'request_changes', label: 'Demander modif.',     bg: '#1D4ED8', show: ['pending_validation', 'validated'] },
                      { decision: 'reject',          label: 'Refuser',             bg: '#DC2626', show: ['pending_validation', 'changes_requested'] },
                      { decision: 'suspend',         label: 'Suspendre',           bg: '#6B7280', show: ['validated'] },
                      { decision: 'restore',         label: 'Restaurer',           bg: '#1E7A52', show: ['suspended', 'rejected'] },
                      { decision: 'archive',         label: 'Archiver',            bg: '#374151', show: ['rejected', 'suspended'] },
                    ].filter(a => a.show.includes(detail.structure.status)).map(a => (
                      <button key={a.decision}
                        onClick={() => handleDecision(detail.structure.id, a.decision)}
                        disabled={actionLoading === a.decision}
                        className="py-2.5 rounded-xl text-xs font-bold text-white transition-all"
                        style={{ background: actionLoading === a.decision ? '#9CA3AF' : a.bg }}>
                        {actionLoading === a.decision ? '...' : a.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
