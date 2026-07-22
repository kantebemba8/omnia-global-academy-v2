import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { Gift, RefreshCw, CheckCircle, XCircle, AlertCircle, Zap } from 'lucide-react';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/structure-manage`;

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  draft:                    { label: 'Brouillon',          color: '#6B7280', bg: '#F3F4F6' },
  pending_admin_validation: { label: 'En attente',         color: '#92400E', bg: '#FEF3C7' },
  changes_requested:        { label: 'Modif. demandée',    color: '#1D4ED8', bg: '#EFF6FF' },
  validated:                { label: 'Validé',             color: '#065F46', bg: '#D1FAE5' },
  active:                   { label: 'Actif',            color: '#065F46', bg: '#D1FAE5' },
  rejected:                 { label: 'Refusé',             color: '#991B1B', bg: '#FEE2E2' },
  suspended:                { label: 'Suspendu',           color: '#374151', bg: '#F3F4F6' },
  expired:                  { label: 'Expiré',             color: '#6B7280', bg: '#F3F4F6' },
  archived:                 { label: 'Archivé',            color: '#374151', bg: '#F3F4F6' },
};

export default function AdminStructureAvantages() {
  const [structures, setStructures] = useState<any[]>([]);
  const [selectedStructure, setSelectedStructure] = useState<any>(null);
  const [benefits, setBenefits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [comments, setComments] = useState<Record<string, string>>({});
  const [actionId, setActionId] = useState('');

  const token = () => localStorage.getItem('omnia_session_token') || '';
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  async function loadStructures() {
    const res = await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'admin_list_structures', status_filter: 'validated' }),
    });
    const data = await res.json();
    if (data.success) setStructures(data.structures ?? []);
  }

  async function loadBenefits(structureId: string) {
    setLoading(true);
    const res = await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list_benefits', structure_id: structureId }),
    });
    const data = await res.json();
    if (data.success) setBenefits(data.benefits ?? []);
    setLoading(false);
  }

  useEffect(() => { loadStructures(); }, []);

  async function handleDecision(benefitId: string, decision: string) {
    setActionId(benefitId);
    const res = await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'admin_validate_benefit',
        benefit_id: benefitId,
        decision,
        admin_comment: comments[benefitId] ?? '',
      }),
    });
    const data = await res.json();
    const labels: Record<string, string> = {
      validate: 'Avantage validé', activate: 'Avantage activé',
      reject: 'Avantage refusé', suspend: 'Avantage suspendu',
      request_changes: 'Modification demandée',
    };
    if (data.success) {
      showToast(labels[decision] ?? 'Action effectuée');
      if (selectedStructure) loadBenefits(selectedStructure.id);
    } else showToast(data.error ?? 'Erreur');
    setActionId('');
  }

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {toast && (
          <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border"
            style={{ background: 'white', borderColor: '#E4E7EC', color: '#002050' }}>{toast}</div>
        )}

        <div>
          <h1 className="text-2xl font-black" style={{ color: '#002050' }}>Avantages structure</h1>
          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
            Validez et activez les avantages proposés par les structures
          </p>
        </div>

        {/* Sélection structure */}
        <div className="bg-white rounded-2xl border p-5" style={{ borderColor: '#E4E7EC' }}>
          <p className="text-sm font-semibold mb-3" style={{ color: '#374151' }}>Sélectionner une structure</p>
          <div className="flex gap-3 flex-wrap">
            {structures.map(s => (
              <button key={s.id}
                onClick={() => { setSelectedStructure(s); loadBenefits(s.id); }}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-all border"
                style={selectedStructure?.id === s.id
                  ? { background: '#002050', color: 'white', borderColor: '#002050' }
                  : { background: 'white', color: '#374151', borderColor: '#E4E7EC' }}>
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* Avantages */}
        {selectedStructure && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold" style={{ color: '#002050' }}>
                Avantages de {selectedStructure.name}
              </h2>
              <button onClick={() => loadBenefits(selectedStructure.id)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm border"
                style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>
                <RefreshCw size={13} />
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
              </div>
            ) : benefits.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-dashed p-12 text-center" style={{ borderColor: '#E4E7EC' }}>
                <Gift size={36} className="mx-auto mb-3 opacity-10" style={{ color: '#002050' }} />
                <p className="font-bold" style={{ color: '#002050' }}>Aucun avantage pour cette structure</p>
              </div>
            ) : (
              <div className="space-y-4">
                {benefits.map(b => {
                  const sc = STATUS[b.status] ?? STATUS.draft;
                  return (
                    <div key={b.id} className="bg-white rounded-2xl border p-5 space-y-4"
                      style={{ borderColor: '#E4E7EC' }}>
                      {/* Infos avantage */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold" style={{ color: '#002050' }}>{b.benefit_name}</h3>
                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                          </div>
                          {b.description && (
                            <p className="text-sm mt-1" style={{ color: '#6B7280' }}>{b.description}</p>
                          )}
                          <div className="flex gap-3 mt-2 flex-wrap text-xs" style={{ color: '#9CA3AF' }}>
                            {b.discount_percentage > 0 && <span>🏷️ {b.discount_percentage}% réduction</span>}
                            {b.free_access && <span>🎁 Accès gratuit</span>}
                            {b.omnia_career_access && <span>💼 Omnia Career</span>}
                            {b.cv_token_bonus > 0 && <span>🪙 +{b.cv_token_bonus} jetons</span>}
                            {b.max_beneficiaries > 0 && <span>👥 Max {b.max_beneficiaries}</span>}
                          </div>
                          {b.eligibility_conditions && (
                            <p className="text-xs mt-1 italic" style={{ color: '#9CA3AF' }}>
                              Conditions : {b.eligibility_conditions}
                            </p>
                          )}
                          {b.structure_comment && (
                            <div className="mt-2 p-2 rounded-lg text-xs" style={{ background: '#F8F9FA', color: '#374151' }}>
                              💬 Structure : {b.structure_comment}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions admin */}
                      {['pending_admin_validation', 'validated', 'active', 'suspended'].includes(b.status) && (
                        <div className="border-t pt-4 space-y-3" style={{ borderColor: '#F3F4F6' }}>
                          <textarea
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#002050] resize-none"
                            rows={2} placeholder="Commentaire admin (optionnel)..."
                            value={comments[b.id] ?? ''}
                            onChange={e => setComments(c => ({ ...c, [b.id]: e.target.value }))} />
                          <div className="flex gap-2 flex-wrap">
                            {b.status === 'pending_admin_validation' && <>
                              <button onClick={() => handleDecision(b.id, 'validate')}
                                disabled={actionId === b.id}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white"
                                style={{ background: '#1E7A52' }}>
                                <CheckCircle size={12} /> Valider
                              </button>
                              <button onClick={() => handleDecision(b.id, 'activate')}
                                disabled={actionId === b.id}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white"
                                style={{ background: '#BF8813' }}>
                                <Zap size={12} /> Valider & Activer
                              </button>
                              <button onClick={() => handleDecision(b.id, 'request_changes')}
                                disabled={actionId === b.id}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border"
                                style={{ borderColor: '#BFDBFE', color: '#1D4ED8' }}>
                                <AlertCircle size={12} /> Demander modif.
                              </button>
                              <button onClick={() => handleDecision(b.id, 'reject')}
                                disabled={actionId === b.id}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border"
                                style={{ borderColor: '#FECACA', color: '#DC2626' }}>
                                <XCircle size={12} /> Refuser
                              </button>
                            </>}
                            {b.status === 'validated' && (
                              <button onClick={() => handleDecision(b.id, 'activate')}
                                disabled={actionId === b.id}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white"
                                style={{ background: '#BF8813' }}>
                                <Zap size={12} /> Activer
                              </button>
                            )}
                            {b.status === 'active' && (
                              <button onClick={() => handleDecision(b.id, 'suspend')}
                                disabled={actionId === b.id}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border"
                                style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>
                                Suspendre
                              </button>
                            )}
                            {b.status === 'suspended' && (
                              <button onClick={() => handleDecision(b.id, 'activate')}
                                disabled={actionId === b.id}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white"
                                style={{ background: '#1E7A52' }}>
                                <CheckCircle size={12} /> Réactiver
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
