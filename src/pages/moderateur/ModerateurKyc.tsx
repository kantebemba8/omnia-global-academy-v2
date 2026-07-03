import { useEffect, useState } from 'react';
import { ModerateurLayout } from '../../components/ModerateurLayout';
import { ENDPOINTS } from '../../lib/config';
import { Shield, CheckCircle, XCircle, Building2, User, Calendar } from 'lucide-react';

interface ProfKyc {
  id: string; user_id: string; expertise_domain: string; bio: string;
  kyc_status: string; created_at: string; full_name: string; email: string;
}
interface EtabKyc {
  id: string; user_id: string; school_name: string; logo_url: string;
  registration_number: string; director_name: string; kyc_status: string;
  created_at: string; email: string;
}
interface KycData {
  professeurs: ProfKyc[];
  etablissements: EtabKyc[];
  permissions?: { can_validate_professor_kyc: boolean; can_validate_establishment_kyc: boolean };
}

export default function ModerateurKyc() {
  const [data, setData] = useState<KycData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'profs' | 'etabs'>('profs');
  const [modal, setModal] = useState<{ userId: string; name: string; kycType: 'professeur' | 'etablissement'; action: 'approve' | 'reject' } | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  const bypassAuth = new URLSearchParams(window.location.search).get('preview') === 'true' &&
    (() => { try { return JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false; } catch { return false; } })();

  function load() {
    if (bypassAuth) { setLoading(false); return; }
    const token = localStorage.getItem('omnia_session_token');
    fetch(ENDPOINTS.moderatorKycAction, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function doAction() {
    if (!modal) return;
    setSubmitting(true);
    const token = localStorage.getItem('omnia_session_token');
    const res = await fetch(ENDPOINTS.moderatorKycAction, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: modal.userId, kyc_type: modal.kycType, action: modal.action, reason }),
    });
    const d = await res.json();
    setSubmitting(false);
    if (d.success) {
      setToast(modal.action === 'approve' ? 'KYC approuvé.' : 'KYC rejeté.');
      setModal(null); setReason('');
      load();
    } else {
      setToast(d.message ?? 'Erreur.');
    }
    setTimeout(() => setToast(''), 4000);
  }

  if (loading) {
    return (
      <ModerateurLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
        </div>
      </ModerateurLayout>
    );
  }

  const profs = data?.professeurs ?? [];
  const etabs = data?.etablissements ?? [];
  const perms = data?.permissions;

  return (
    <ModerateurLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {toast && (
          <div className="fixed top-4 right-4 z-50 bg-white shadow-lg rounded-xl px-5 py-3 text-sm font-medium border border-gray-200"
            style={{ color: '#002050' }}>{toast}</div>
        )}
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#002050' }}>Validation KYC</h1>
          <p className="text-gray-500 text-sm mt-1">Vérification des identités en attente</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {perms?.can_validate_professor_kyc && (
            <button onClick={() => setTab('profs')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'profs' ? 'text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              style={tab === 'profs' ? { backgroundColor: '#002050' } : {}}>
              <User className="w-4 h-4" /> Professeurs ({profs.length})
            </button>
          )}
          {perms?.can_validate_establishment_kyc && (
            <button onClick={() => setTab('etabs')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'etabs' ? 'text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              style={tab === 'etabs' ? { backgroundColor: '#002050' } : {}}>
              <Building2 className="w-4 h-4" /> Établissements ({etabs.length})
            </button>
          )}
        </div>

        {/* Professeurs tab */}
        {tab === 'profs' && (
          <div className="space-y-4">
            {profs.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center border border-gray-100 shadow-sm">
                <Shield className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: '#1E7A52' }} />
                <p className="text-gray-400 text-sm">Aucun professeur en attente de validation KYC</p>
              </div>
            ) : profs.map((p) => (
              <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-gray-800">{p.full_name}</p>
                    <p className="text-sm text-gray-500">{p.email}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Soumis le {new Date(p.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700">En attente</span>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 space-y-1">
                  <p className="text-xs font-medium text-gray-600">Domaine d'expertise</p>
                  <p className="text-sm text-gray-800">{p.expertise_domain || '—'}</p>
                  <p className="text-xs font-medium text-gray-600 mt-2">Biographie</p>
                  <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">{p.bio || '—'}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setModal({ userId: p.user_id, name: p.full_name, kycType: 'professeur', action: 'approve' })}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
                    style={{ backgroundColor: '#1E7A52' }}>
                    <CheckCircle className="w-3.5 h-3.5" /> Approuver
                  </button>
                  <button onClick={() => { setModal({ userId: p.user_id, name: p.full_name, kycType: 'professeur', action: 'reject' }); setReason(''); }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors">
                    <XCircle className="w-3.5 h-3.5" /> Rejeter
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Établissements tab */}
        {tab === 'etabs' && (
          <div className="space-y-4">
            {etabs.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center border border-gray-100 shadow-sm">
                <Building2 className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: '#1E7A52' }} />
                <p className="text-gray-400 text-sm">Aucun établissement en attente de validation KYC</p>
              </div>
            ) : etabs.map((e) => (
              <div key={e.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-gray-800">{e.school_name}</p>
                    <p className="text-sm text-gray-500">{e.email}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Soumis le {new Date(e.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700">En attente</span>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium text-gray-600">Directeur</p>
                    <p className="text-sm text-gray-800">{e.director_name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-600">N° d'enregistrement</p>
                    <p className="text-sm text-gray-800">{e.registration_number || '—'}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setModal({ userId: e.user_id, name: e.school_name, kycType: 'etablissement', action: 'approve' })}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
                    style={{ backgroundColor: '#1E7A52' }}>
                    <CheckCircle className="w-3.5 h-3.5" /> Approuver
                  </button>
                  <button onClick={() => { setModal({ userId: e.user_id, name: e.school_name, kycType: 'etablissement', action: 'reject' }); setReason(''); }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors">
                    <XCircle className="w-3.5 h-3.5" /> Rejeter
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal */}
        {modal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
              <h3 className="font-bold text-lg" style={{ color: '#002050' }}>
                {modal.action === 'approve' ? 'Approuver le KYC' : 'Rejeter le KYC'}
              </h3>
              <p className="text-sm text-gray-600">
                {modal.action === 'approve'
                  ? `Confirmer l'approbation de <strong>${modal.name}</strong> ? Le compte sera activé.`
                  : `Rejeter le KYC de ${modal.name} ?`}
              </p>
              {modal.action === 'reject' && (
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none"
                  placeholder="Motif obligatoire…" />
              )}
              <div className="flex gap-3 justify-end">
                <button onClick={() => { setModal(null); setReason(''); }}
                  className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Annuler</button>
                <button onClick={doAction} disabled={submitting || (modal.action === 'reject' && !reason.trim())}
                  className={`px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-60 ${modal.action === 'approve' ? '' : 'bg-red-600 hover:bg-red-700'}`}
                  style={modal.action === 'approve' ? { backgroundColor: '#1E7A52' } : {}}>
                  {submitting ? 'En cours…' : modal.action === 'approve' ? 'Confirmer' : 'Rejeter'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ModerateurLayout>
  );
}
