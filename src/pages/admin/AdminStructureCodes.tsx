import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { QrCode, RefreshCw, CheckCircle, XCircle, AlertCircle, Search, Eye } from 'lucide-react';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/structure-manage`;

const CODE_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  draft:                    { label: 'Brouillon',             color: '#6B7280', bg: '#F3F4F6' },
  pending_admin_validation: { label: 'En attente',            color: '#92400E', bg: '#FEF3C7' },
  active:                   { label: 'Actif',                 color: '#065F46', bg: '#D1FAE5' },
  inactive:                 { label: 'Inactif',               color: '#374151', bg: '#F3F4F6' },
  expired:                  { label: 'Expiré',                color: '#6B7280', bg: '#F3F4F6' },
  suspended:                { label: 'Suspendu',              color: '#991B1B', bg: '#FEE2E2' },
  rejected:                 { label: 'Refusé',                color: '#991B1B', bg: '#FEE2E2' },
};

export default function AdminStructureCodes() {
  const [structures, setStructures] = useState<any[]>([]);
  const [selectedStructure, setSelectedStructure] = useState<any>(null);
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [adminComment, setAdminComment] = useState('');
  const [actionCode, setActionCode] = useState('');

  const token = () => localStorage.getItem('omnia_session_token') || '';
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  async function loadStructures() {
    setLoading(true);
    const res = await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'admin_list_structures', status_filter: 'validated' }),
    });
    const data = await res.json();
    if (data.success) setStructures(data.structures ?? []);
    setLoading(false);
  }

  async function loadCodes(structureId: string) {
    setLoading(true);
    const res = await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list_codes', structure_id: structureId }),
    });
    const data = await res.json();
    if (data.success) setCodes(data.codes ?? []);
    setLoading(false);
  }

  useEffect(() => { loadStructures(); }, []);

  async function handleDecision(codeId: string, decision: string) {
    setActionCode(codeId);
    const res = await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'admin_validate_code', code_id: codeId, decision, admin_comment: adminComment }),
    });
    const data = await res.json();
    if (data.success) {
      showToast('✅ Action effectuée');
      setAdminComment('');
      if (selectedStructure) loadCodes(selectedStructure.id);
    } else showToast(data.error ?? 'Erreur');
    setActionCode('');
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {toast && (
          <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border"
            style={{ background: 'white', borderColor: '#E4E7EC', color: '#002050' }}>{toast}</div>
        )}

        <div>
          <h1 className="text-2xl font-black" style={{ color: '#002050' }}>Codes structure</h1>
          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
            Validez et gérez les codes structure soumis par les responsables
          </p>
        </div>

        {/* Sélection structure */}
        <div className="bg-white rounded-2xl border p-5" style={{ borderColor: '#E4E7EC' }}>
          <p className="text-sm font-semibold mb-3" style={{ color: '#374151' }}>Sélectionner une structure</p>
          <div className="flex gap-3 flex-wrap">
            {structures.map(s => (
              <button key={s.id}
                onClick={() => { setSelectedStructure(s); loadCodes(s.id); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border"
                style={selectedStructure?.id === s.id
                  ? { background: '#002050', color: 'white', borderColor: '#002050' }
                  : { background: 'white', color: '#374151', borderColor: '#E4E7EC' }}>
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* Codes */}
        {selectedStructure && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold" style={{ color: '#002050' }}>
                Codes de {selectedStructure.name}
              </h2>
              <button onClick={() => loadCodes(selectedStructure.id)}
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
            ) : codes.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-dashed p-12 text-center" style={{ borderColor: '#E4E7EC' }}>
                <QrCode size={36} className="mx-auto mb-3 opacity-10" style={{ color: '#002050' }} />
                <p className="font-bold" style={{ color: '#002050' }}>Aucun code pour cette structure</p>
              </div>
            ) : (
              <div className="space-y-3">
                {codes.map(code => {
                  const sc = CODE_STATUS[code.status] ?? CODE_STATUS.draft;
                  return (
                    <div key={code.id} className="bg-white rounded-2xl border p-5 space-y-3"
                      style={{ borderColor: '#E4E7EC' }}>
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold" style={{ color: '#002050' }}>{code.code_name}</h3>
                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                          </div>
                          <code className="text-sm font-mono font-bold px-3 py-1 rounded-lg mt-1 inline-block"
                            style={{ background: '#F0F4FF', color: '#002050' }}>{code.code_value}</code>
                          <div className="flex gap-3 mt-1 text-xs" style={{ color: '#9CA3AF' }}>
                            <span>Type : {code.type_label}</span>
                            <span>{code.current_uses ?? 0}/{code.max_uses ?? '∞'} utilisations</span>
                            {code.expires_at && <span>Expire : {new Date(code.expires_at).toLocaleDateString('fr-FR')}</span>}
                          </div>
                        </div>
                      </div>

                      {code.status === 'pending_admin_validation' && (
                        <div className="space-y-2 pt-2 border-t" style={{ borderColor: '#F3F4F6' }}>
                          <textarea
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#002050] resize-none"
                            rows={2} placeholder="Commentaire (optionnel)..."
                            value={adminComment} onChange={e => setAdminComment(e.target.value)} />
                          <div className="flex gap-2">
                            <button onClick={() => handleDecision(code.id, 'activate')}
                              disabled={actionCode === code.id}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white"
                              style={{ background: '#1E7A52' }}>
                              <CheckCircle size={12} /> Activer
                            </button>
                            <button onClick={() => handleDecision(code.id, 'reject')}
                              disabled={actionCode === code.id}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border"
                              style={{ borderColor: '#FECACA', color: '#DC2626' }}>
                              <XCircle size={12} /> Refuser
                            </button>
                          </div>
                        </div>
                      )}

                      {code.status === 'active' && (
                        <div className="flex gap-2 pt-2 border-t" style={{ borderColor: '#F3F4F6' }}>
                          <button onClick={() => handleDecision(code.id, 'suspend')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border"
                            style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>
                            Suspendre
                          </button>
                          <button onClick={() => handleDecision(code.id, 'deactivate')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border"
                            style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>
                            Désactiver
                          </button>
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
