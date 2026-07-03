import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/DashboardLayout';
import { Users, PlusCircle, CheckCircle, AlertCircle, X, ChevronDown, ChevronUp } from 'lucide-react';

interface Teacher {
  id: string; full_name: string; email: string; status: string;
  courses_count: number; total_students: number; average_rating: number; created_at: string;
}

function getApiBase() {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  return url ? `${url}/functions/v1` : '/api';
}

function monogram(name: string) {
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

interface AddTeacherModalProps { onClose: () => void; onSuccess: () => void }
function AddTeacherModal({ onClose, onSuccess }: AddTeacherModalProps) {
  const [form, setForm] = useState({ full_name: '', email: '', phone_number: '' });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function submit() {
    if (!form.full_name || !form.email || !form.phone_number) { setMsg({ text: 'Tous les champs sont requis.', ok: false }); return; }
    setSubmitting(true); setMsg(null);
    try {
      const token = localStorage.getItem('omnia_session_token') || '';
      const res = await fetch(`${getApiBase()}/teacher-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (res.ok) { setMsg({ text: `Compte créé. Email envoyé à ${form.email}.`, ok: true }); setTimeout(() => { onSuccess(); onClose(); }, 2000); }
      else setMsg({ text: json.message || json.error || 'Erreur', ok: false });
    } catch { setMsg({ text: 'Erreur réseau', ok: false }); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Ajouter un enseignant</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <div className="p-5 space-y-4">
          {[
            { key: 'full_name', label: 'Prénom et Nom', placeholder: 'Aminata Traoré' },
            { key: 'email', label: 'Email professionnel', placeholder: 'a.traore@ecole.com', type: 'email' },
            { key: 'phone_number', label: 'Téléphone', placeholder: '+223 70 00 00 00', type: 'tel' },
          ].map((f) => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
              <input type={f.type || 'text'} value={(form as Record<string, string>)[f.key]}
                onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400" />
            </div>
          ))}
          {msg && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {msg.ok ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {msg.text}
            </div>
          )}
          <button onClick={submit} disabled={submitting}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-50"
            style={{ backgroundColor: '#002050' }}>
            {submitting ? 'Création en cours...' : 'Créer et envoyer les accès'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DirecteurEnseignants() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ teacher: Teacher; action: 'suspend' | 'activate' } | null>(null);
  const [actioning, setActioning] = useState(false);
  const navigate = useNavigate();

  const bypassAuth = new URLSearchParams(window.location.search).get('preview') === 'true' &&
    (() => { try { return JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false; } catch { return false; } })();

  const load = useCallback(async () => {
    if (bypassAuth) { setLoading(false); return; }
    const token = localStorage.getItem('omnia_session_token');
    if (!token && !bypassAuth) { navigate('/connexion'); return; }
    try {
      const res = await fetch(`${getApiBase()}/dashboard-directeur`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 403 && !bypassAuth) { navigate('/connexion'); return; }
      const json = await res.json();
      if (res.ok) setTeachers(json.enseignants ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [navigate, bypassAuth]);

  useEffect(() => { load(); }, [load]);

  async function doAction() {
    if (!confirmModal) return;
    setActioning(true);
    try {
      const token = localStorage.getItem('omnia_session_token') || '';
      const res = await fetch(`${getApiBase()}/teacher-manage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ teacher_id: confirmModal.teacher.id, action: confirmModal.action }),
      });
      if (res.ok) { setConfirmModal(null); load(); }
    } catch { /* ignore */ }
    finally { setActioning(false); }
  }

  return (
    <DashboardLayout role="directeur">
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestion des enseignants</h1>
            <p className="text-gray-500 text-sm mt-1">{teachers.length} enseignant{teachers.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90"
            style={{ backgroundColor: '#002050' }}>
            <PlusCircle className="w-4 h-4" /> Ajouter un enseignant
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
          </div>
        ) : teachers.length === 0 ? (
          <div className="bg-white rounded-xl p-12 border border-gray-100 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-200" />
            <p className="text-gray-500 font-medium">Aucun enseignant</p>
            <p className="text-gray-400 text-sm mt-1">Invitez votre premier enseignant pour commencer à créer des formations.</p>
            <button onClick={() => setAddModal(true)}
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg text-white"
              style={{ backgroundColor: '#002050' }}>
              <PlusCircle className="w-4 h-4" /> Ajouter un enseignant
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Enseignant</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 hidden md:table-cell">Email</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Cours</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Élèves</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Statut</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {teachers.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: '#002050' + '15', color: '#002050' }}>
                          {monogram(t.full_name)}
                        </div>
                        <span className="font-medium text-gray-900">{t.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-gray-500 hidden md:table-cell">{t.email}</td>
                    <td className="px-4 py-4 text-center text-gray-700">{t.courses_count}</td>
                    <td className="px-4 py-4 text-center text-gray-700">{t.total_students}</td>
                    <td className="px-4 py-4 text-center">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${t.status === 'actif' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                        {t.status === 'actif' ? 'Actif' : 'Suspendu'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={() => setConfirmModal({ teacher: t, action: t.status === 'actif' ? 'suspend' : 'activate' })}
                        className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors"
                        style={t.status === 'actif'
                          ? { borderColor: '#DC2626', color: '#DC2626' }
                          : { borderColor: '#1E7A52', color: '#1E7A52' }}>
                        {t.status === 'actif' ? 'Suspendre' : 'Réactiver'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {addModal && <AddTeacherModal onClose={() => setAddModal(false)} onSuccess={load} />}

      {confirmModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <h2 className="font-bold text-gray-900 mb-2">
              {confirmModal.action === 'suspend' ? 'Suspendre' : 'Réactiver'} {confirmModal.teacher.full_name} ?
            </h2>
            {confirmModal.action === 'suspend' && (
              <p className="text-sm text-gray-500 mb-5">
                Les cours de cet enseignant resteront accessibles aux apprenants inscrits.
              </p>
            )}
            <div className="flex gap-3 mt-4">
              <button onClick={() => setConfirmModal(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600">Annuler</button>
              <button onClick={doAction} disabled={actioning}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: confirmModal.action === 'suspend' ? '#DC2626' : '#1E7A52' }}>
                {actioning ? '...' : confirmModal.action === 'suspend' ? 'Suspendre' : 'Réactiver'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
