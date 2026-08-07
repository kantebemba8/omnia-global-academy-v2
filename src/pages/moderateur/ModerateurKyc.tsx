import { getSessionToken } from '../../lib/session';
import { useEffect, useState } from 'react';
import { ModerateurLayout } from '../../components/ModerateurLayout';
import { ENDPOINTS } from '../../lib/config';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { Shield, CheckCircle, XCircle, User, Calendar } from 'lucide-react';

interface ProfKyc {
  id: string;
  user_id: string;
  expertise_domain: string;
  bio: string;
  kyc_status: string;
  created_at: string;
  full_name: string;
  email: string;
}

interface KycData {
  professeurs: ProfKyc[];
  permissions?: { can_validate_professor_kyc: boolean };
}

type DecisionModal = {
  userId: string;
  name: string;
  action: 'approve' | 'reject';
};

export default function ModerateurKyc() {
  const [data, setData] = useState<KycData | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<DecisionModal | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  const bypassAuth = new URLSearchParams(window.location.search).get('preview') === 'true' &&
    (() => { try { return JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false; } catch { return false; } })();

  function load() {
    if (bypassAuth) {
      setData({ professeurs: [], permissions: { can_validate_professor_kyc: true } });
      setLoading(false);
      return;
    }
    const token = getSessionToken();
    if (!token) { setLoading(false); return; }
    fetch(ENDPOINTS.moderatorKycAction, { headers: edgeAuthHeaders() })
      .then((response) => response.json())
      .then((payload) => { setData(payload); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function decide() {
    if (!modal) return;
    setSubmitting(true);
    const token = getSessionToken();
    if (!token) { setToast('Session expirée. Veuillez vous reconnecter.'); setSubmitting(false); return; }
    const response = await fetch(ENDPOINTS.moderatorKycAction, {
      method: 'POST',
      headers: edgeAuthHeaders(),
      body: JSON.stringify({ user_id: modal.userId, kyc_type: 'professeur', action: modal.action, reason }),
    });
    const payload = await response.json();
    setSubmitting(false);
    if (payload.success) {
      setToast(modal.action === 'approve' ? 'Recommandation de validation transmise à l’Administration Omnia.' : 'Recommandation de rejet transmise à l’Administration Omnia.');
      setModal(null);
      setReason('');
      load();
    } else {
      setToast(payload.message ?? 'Erreur lors du traitement.');
    }
    setTimeout(() => setToast(''), 4000);
  }

  if (loading) {
    return (
      <ModerateurLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
        </div>
      </ModerateurLayout>
    );
  }

  const professeurs = data?.professeurs ?? [];

  return (
    <ModerateurLayout>
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        {toast && <div className="fixed right-4 top-4 z-50 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium shadow-lg" style={{ color: '#002050' }}>{toast}</div>}
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#002050' }}>Vérification de l’identité des professeurs</h1>
          <p className="mt-1 text-sm text-gray-500">Contrôlez l’identité et les justificatifs transmis par les professeurs puis transmettez votre recommandation. La décision finale reste réservée à l’Administration Omnia.</p>
        </div>

        {professeurs.length === 0 ? (
          <div className="rounded-xl border border-gray-100 bg-white p-12 text-center shadow-sm">
            <Shield className="mx-auto mb-3 h-10 w-10 opacity-20" style={{ color: '#1E7A52' }} />
            <p className="text-sm text-gray-400">Aucun professeur en attente de vérification d’identité</p>
          </div>
        ) : professeurs.map((professeur) => (
          <article key={professeur.id} className="space-y-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-gray-800">{professeur.full_name}</p>
                <p className="text-sm text-gray-500">{professeur.email}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-gray-400"><Calendar className="h-3.5 w-3.5" />Soumis le {new Date(professeur.created_at).toLocaleDateString('fr-FR')}</p>
              </div>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">En attente</span>
            </div>
            <div className="space-y-1 rounded-lg bg-gray-50 p-3">
              <p className="text-xs font-medium text-gray-600">Domaine d’expertise</p>
              <p className="text-sm text-gray-800">{professeur.expertise_domain || '—'}</p>
              <p className="mt-2 text-xs font-medium text-gray-600">Biographie</p>
              <p className="line-clamp-3 text-sm leading-relaxed text-gray-700">{professeur.bio || '—'}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setModal({ userId: professeur.user_id, name: professeur.full_name, action: 'approve' })} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: '#1E7A52' }}><CheckCircle className="h-3.5 w-3.5" />Recommander la validation</button>
              <button onClick={() => { setModal({ userId: professeur.user_id, name: professeur.full_name, action: 'reject' }); setReason(''); }} className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"><XCircle className="h-3.5 w-3.5" />Recommander le rejet</button>
            </div>
          </article>
        ))}

        {modal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-center gap-3"><User className="h-5 w-5" style={{ color: '#BF8813' }} /><h3 className="text-lg font-bold" style={{ color: '#002050' }}>{modal.action === 'approve' ? 'Recommander la validation' : 'Recommander le rejet'}</h3></div>
              <p className="text-sm text-gray-600">{modal.action === 'approve' ? `Transmettre une recommandation favorable pour ${modal.name} ?` : `Indiquez le motif de la recommandation de rejet pour ${modal.name}.`}</p>
              {modal.action === 'reject' && <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="Motif obligatoire…" />}
              <div className="flex justify-end gap-3">
                <button onClick={() => { setModal(null); setReason(''); }} className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50">Annuler</button>
                <button onClick={decide} disabled={submitting || (modal.action === 'reject' && !reason.trim())} className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${modal.action === 'reject' ? 'bg-red-600 hover:bg-red-700' : ''}`} style={modal.action === 'approve' ? { backgroundColor: '#1E7A52' } : {}}>{submitting ? 'En cours…' : 'Transmettre'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ModerateurLayout>
  );
}
