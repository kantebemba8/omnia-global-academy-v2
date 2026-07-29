import { useState, useEffect } from 'react';
import { Shield, Plus, Save, Trash2, User, ChevronDown, ChevronUp, X, Check, Clock, CheckCircle, XCircle } from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';

interface Permission {
  key: string;
  label: string;
}

interface PermissionSection {
  title: string;
  perms: Permission[];
}

interface ModeratorPermissions {
  user_id: string;
  full_name: string;
  email: string;
  permissions: Record<string, boolean>;
}

interface ActionRequest {
  id: string;
  action_type: string;
  reason: string;
  status: string;
  created_at: string;
  moderator: { full_name: string; email: string };
  target_user: { id: string; full_name: string; email: string };
}

const PERMISSION_SECTIONS: PermissionSection[] = [
  { title:'Formations & certifications', perms:[
    {key:'can_see_pending_courses',label:'Voir les formations en attente'},
    {key:'can_review_course_content',label:'Contrôler le contenu pédagogique'},
    {key:'can_request_course_modification',label:'Demander des modifications'},
    {key:'can_reject_course',label:'Rejeter une formation non conforme'},
    {key:'can_recommend_course_price',label:'Proposer une décision de prix'},
    {key:'can_approve_transmit_course',label:'Approuver et transmettre au Super-admin'},
    {key:'can_manage_course_certifications',label:'Contrôler les demandes de certifications et badges'},
    {key:'can_create_assisted_course',label:'Créer ou corriger une saisie assistée'},
  ]},
  { title:'Utilisateurs, Structures & KYC', perms:[
    {key:'can_see_learners_list',label:'Voir la liste des apprenants'},
    {key:'can_see_professors_list',label:'Voir la liste des professeurs'},
    {key:'can_see_structures_list',label:'Voir les Structures'},
    {key:'can_see_organizers_list',label:'Voir les organisateurs'},
    {key:'can_validate_professor_kyc',label:'Examiner le KYC des professeurs'},
    {key:'can_validate_structure_kyc',label:'Examiner le KYC des Structures'},
    {key:'can_request_account_suspension',label:'Demander la suspension temporaire d’un compte'},
  ]},
  { title:'Modération, support & communication', perms:[
    {key:'can_moderate_forum',label:'Modérer le forum'},
    {key:'can_moderate_jobs',label:"Modérer les offres d'emploi"},
    {key:'can_manage_support',label:'Gérer les tickets de support'},
    {key:'can_view_ai_conversations',label:'Consulter les conversations IA autorisées'},
    {key:'can_manage_reports',label:'Traiter les signalements'},
  ]},
  { title:'Omnia Live', perms:[
    {key:'can_review_live_events',label:'Examiner les événements Omnia Live'},
    {key:'can_review_live_reports',label:'Traiter les signalements Omnia Live'},
    {key:'can_review_live_refunds',label:'Préparer les dossiers de remboursement'},
    {key:'can_review_live_organizers',label:'Examiner les demandes organisateur'},
  ]},
  { title:'Structures', perms:[
    {key:'can_review_structure_requests',label:'Examiner les demandes Structure'},
    {key:'can_review_structure_codes',label:'Examiner les codes Structure'},
    {key:'can_review_structure_benefits',label:'Examiner les avantages Structure'},
  ]},
  { title:'Statistiques non financières', perms:[
    {key:'can_view_analytics',label:"Voir les statistiques d'audience et d'activité"},
  ]},
];


const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export default function AdminEquipe() {
  const [moderators, setModerators] = useState<ModeratorPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedModerators, setExpandedModerators] = useState<Record<string, boolean>>({});
  const [localPermissions, setLocalPermissions] = useState<Record<string, Record<string, boolean>>>({});
  const [savingModeratorId, setSavingModeratorId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [newMod, setNewMod] = useState({ full_name: '', email: '', phone_number: '' });
  const [newModPermissions, setNewModPermissions] = useState<Record<string, boolean>>({});
  const [creatingMod, setCreatingMod] = useState(false);
  const [actionRequests, setActionRequests] = useState<ActionRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const token = () => localStorage.getItem('omnia_session_token') || '';
  const authHeaders = (json = false) => ({ ...(json ? { 'Content-Type': 'application/json' } : {}), 'Authorization': `Bearer ${token()}`, 'x-omnia-session-token': token() });

  // ── Charger la liste des modérateurs ─────────────────────
  const fetchModerators = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-moderator-manage?action=list`, {
        headers: authHeaders()
      });
      if (!res.ok) { let detail=''; try { const j=await res.json(); detail=j.message||j.error||''; } catch {} throw new Error(detail ? `Chargement impossible : ${detail}` : 'Impossible de charger les modérateurs'); }
      const data = await res.json();
      const moderatorsData: ModeratorPermissions[] = (data.moderators || []).map((item: any) => ({
        user_id: item.id,
        full_name: item.full_name || 'Inconnu',
        email: item.email || 'N/A',
        permissions: item.permissions || {}
      }));
      setModerators(moderatorsData);
      const initialPermissions: Record<string, Record<string, boolean>> = {};
      moderatorsData.forEach(mod => { initialPermissions[mod.user_id] = { ...mod.permissions }; });
      setLocalPermissions(initialPermissions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchModerators(); }, []);

  // ── Charger les demandes en attente ──────────────────────
  const fetchRequests = async () => {
    try {
      setRequestsLoading(true);
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-moderator-manage?action=requests`, {
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || 'Impossible de charger les demandes');
      setActionRequests(data.requests || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement des demandes');
    } finally {
      setRequestsLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, []);

  // ── Toggle permission ─────────────────────────────────────
  const togglePermission = (userId: string, permKey: string) => {
    setLocalPermissions(prev => ({
      ...prev,
      [userId]: { ...prev[userId], [permKey]: !prev[userId]?.[permKey] }
    }));
  };

  const toggleModeratorExpanded = (userId: string) => {
    setExpandedModerators(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const hasChanges = (userId: string) => {
    return JSON.stringify(localPermissions[userId]) !== JSON.stringify(moderators.find(m => m.user_id === userId)?.permissions || {});
  };

  // ── Sauvegarder les permissions ───────────────────────────
  const savePermissions = async (userId: string) => {
    try {
      setSavingModeratorId(userId);
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-moderator-manage?action=update`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ moderator_id: userId, action: 'update_permissions', permissions: localPermissions[userId] })
      });
      if (!res.ok) { const d=await res.json().catch(()=>({})); throw new Error(d.message||d.error||'Échec de la sauvegarde'); }
      setModerators(prev => prev.map(mod => mod.user_id === userId ? { ...mod, permissions: localPermissions[userId] } : mod));
      setSuccessMessage(`Permissions de ${moderators.find(m => m.user_id === userId)?.full_name} mises à jour`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de sauvegarde');
    } finally {
      setSavingModeratorId(null);
    }
  };

  // ── Supprimer un modérateur ───────────────────────────────
  const deleteModerator = async (userId: string) => {
    if (pendingDeleteId !== userId) { setPendingDeleteId(userId); return; }
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-moderator-manage?action=delete`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ user_id: userId })
      });
      if (!res.ok) { const d=await res.json().catch(()=>({})); throw new Error(d.message||d.error||'Échec de la suppression'); }
      setModerators(prev => prev.filter(m => m.user_id !== userId));
      setLocalPermissions(prev => { const u = { ...prev }; delete u[userId]; return u; });
      setPendingDeleteId(null);
      setSuccessMessage('Modérateur révoqué');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de suppression');
    }
  };

  // ── Créer un nouveau modérateur ───────────────────────────
  const createModerator = async () => {
    if (!newMod.full_name.trim() || !newMod.email.trim()) return;
    setCreatingMod(true);
    setError(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-moderator-manage?action=create`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({
          full_name: newMod.full_name.trim(),
          email: newMod.email.trim(),
          phone_number: newMod.phone_number.trim() || undefined,
          permissions: newModPermissions,
        })
      });
      const data = await res.json();
      if (data.error === 'EMAIL_TAKEN') { setError('Cet email est déjà utilisé.'); return; }
      if (!res.ok) { throw new Error(data.message || data.error || 'Échec de la création'); }
      setSuccessMessage(`Compte créé pour ${newMod.full_name}. Un email avec le mot de passe temporaire a été envoyé.`);
      setTimeout(() => setSuccessMessage(null), 6000);
      setShowAddModal(false);
      setNewMod({ full_name: '', email: '', phone_number: '' });
      setNewModPermissions({});
      fetchModerators();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création');
    } finally {
      setCreatingMod(false);
    }
  };

  // ── Réviser une demande ───────────────────────────────────
  const reviewRequest = async (id: string, approve: boolean) => {
    try {
      setReviewingId(id);
      setError(null);
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-moderator-manage?action=review_request`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ request_id: id, approve }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || 'Impossible de traiter la demande');
      setActionRequests(prev => prev.filter(r => r.id !== id));
      setSuccessMessage(approve ? 'Demande approuvée et action exécutée.' : 'Demande rejetée.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur pendant la validation');
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield size={32} style={{ color: '#002050' }} />
            <div>
              <h1 className="text-2xl font-black" style={{ color: '#002050' }}>Équipe de modération</h1>
              <p className="text-gray-600 mt-1">Gérer les permissions des modérateurs</p>
            </div>
          </div>
          <button onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white"
            style={{ backgroundColor: '#002050' }}>
            <Plus size={20} /> Ajouter un modérateur
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
            <button onClick={() => setError(null)} className="ml-2 font-bold">✕</button>
          </div>
        )}
        {successMessage && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex items-center gap-2">
            <Check size={20} /> {successMessage}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-200 rounded-lg animate-pulse" />)}
          </div>
        )}

        {/* Liste modérateurs */}
        {!loading && (
          <div className="space-y-4">
            {moderators.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <User size={48} className="mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600 text-lg">Aucun modérateur configuré</p>
                <p className="text-gray-500 mt-2">Cliquez sur "Ajouter un modérateur" pour commencer</p>
              </div>
            ) : (
              moderators.map(mod => (
                <div key={mod.user_id} className="border rounded-lg bg-white shadow-sm overflow-hidden" style={{ borderColor: '#BF8813' }}>
                  <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleModeratorExpanded(mod.user_id)}
                    style={{ backgroundColor: expandedModerators[mod.user_id] ? '#f9f5f0' : 'white' }}>
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: '#002050' }}>
                        <User size={20} />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{mod.full_name}</p>
                        <p className="text-sm text-gray-600">{mod.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasChanges(mod.user_id) && (
                        <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">Modifications non sauvegardées</span>
                      )}
                      <button onClick={e => { e.stopPropagation(); deleteModerator(mod.user_id); }}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={20} />
                      </button>
                      {expandedModerators[mod.user_id] ? <ChevronUp size={20} style={{ color: '#002050' }} /> : <ChevronDown size={20} style={{ color: '#002050' }} />}
                    </div>
                  </div>

                  {expandedModerators[mod.user_id] && (
                    <div className="border-t p-6" style={{ borderColor: '#BF8813' }}>
                      {PERMISSION_SECTIONS.map(section => (
                        <div key={section.title} className="mb-6 last:mb-0">
                          <h3 className="font-semibold mb-4" style={{ color: '#002050' }}>{section.title}</h3>
                          <div className="space-y-3 ml-4">
                            {section.perms.map(perm => (
                              <label key={perm.key} className="flex items-center gap-3 cursor-pointer group">
                                <input type="checkbox"
                                  checked={localPermissions[mod.user_id]?.[perm.key] || false}
                                  onChange={() => togglePermission(mod.user_id, perm.key)}
                                  className="w-5 h-5 rounded border-gray-300 cursor-pointer"
                                  style={{ accentColor: '#BF8813' }} />
                                <span className="text-gray-700 group-hover:text-gray-900">{perm.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                      <div className="mt-8 pt-6 border-t flex gap-3">
                        <button onClick={() => setLocalPermissions(prev => ({ ...prev, [mod.user_id]: { ...moderators.find(m => m.user_id === mod.user_id)?.permissions || {} } }))}
                          className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50">
                          Annuler
                        </button>
                        <button onClick={() => savePermissions(mod.user_id)}
                          disabled={savingModeratorId === mod.user_id || !hasChanges(mod.user_id)}
                          className="flex items-center gap-2 px-6 py-2 rounded-lg font-medium text-white disabled:opacity-50"
                          style={{ backgroundColor: '#1E7A52' }}>
                          <Save size={18} />
                          {savingModeratorId === mod.user_id ? 'Sauvegarde...' : 'Sauvegarder'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Demandes en attente */}
        <div className="mt-10">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={20} style={{ color: '#BF8813' }} />
            <h2 className="text-xl font-bold" style={{ color: '#002050' }}>Demandes en attente</h2>
            {actionRequests.length > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{actionRequests.length}</span>
            )}
          </div>
          <p className="text-sm text-gray-500 mb-4">Actions proposées par les modérateurs nécessitant votre validation</p>

          {requestsLoading ? (
            <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />)}</div>
          ) : actionRequests.length === 0 ? (
            <div className="text-center py-10 bg-gray-50 rounded-lg border border-gray-200">
              <CheckCircle size={36} className="mx-auto mb-3 text-green-400" />
              <p className="text-gray-500">Aucune demande en attente</p>
            </div>
          ) : (
            <div className="space-y-3">
              {actionRequests.map(req => {
                const ACTION_FR: Record<string, string> = { suspend: 'Suspension de compte', reactivate: 'Réactivation de compte', validate_kyc: 'Validation KYC' };
                return (
                  <div key={req.id} className="bg-white border rounded-xl p-5 shadow-sm" style={{ borderColor: '#BF8813' }}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-700">{ACTION_FR[req.action_type] ?? req.action_type}</span>
                          <span className="text-xs text-gray-400">{new Date(req.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        </div>
                        <p className="text-sm font-medium text-gray-800">Cible : {(req.target_user as unknown as { full_name: string })?.full_name ?? '—'}</p>
                        <p className="text-xs text-gray-500">Proposé par : {(req.moderator as unknown as { full_name: string })?.full_name ?? '—'}</p>
                        <p className="text-sm text-gray-600 mt-2 italic">"{req.reason}"</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => reviewRequest(req.id, true)} disabled={reviewingId === req.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                          style={{ backgroundColor: '#1E7A52' }}>
                          <CheckCircle size={14} /> Approuver
                        </button>
                        <button onClick={() => reviewRequest(req.id, false)} disabled={reviewingId === req.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 bg-red-600">
                          <XCircle size={14} /> Rejeter
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Note */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
          <p className="font-semibold mb-1">Note importante :</p>
          <p>Tous les accès financiers sont réservés au Super-admin et ne peuvent pas être délégués.</p>
        </div>

      </div>

      {/* Modal création modérateur */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: '#E4E7EC' }}>
              <div>
                <h2 className="text-xl font-bold" style={{ color: '#002050' }}>Créer un modérateur</h2>
                <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>Un email avec le mot de passe temporaire sera envoyé automatiquement</p>
              </div>
              <button onClick={() => { setShowAddModal(false); setNewMod({ full_name: '', email: '', phone_number: '' }); setNewModPermissions({}); setError(null); }}>
                <X size={24} style={{ color: '#6B7280' }} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

              {/* Infos compte */}
              <div>
                <h3 className="text-sm font-semibold mb-3" style={{ color: '#002050' }}>Informations du compte</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Nom complet *</label>
                    <input type="text" value={newMod.full_name} onChange={e => setNewMod(p => ({ ...p, full_name: e.target.value }))}
                      placeholder="Prénom Nom"
                      className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:border-[#002050]"
                      style={{ borderColor: '#E4E7EC' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Email *</label>
                    <input type="email" value={newMod.email} onChange={e => setNewMod(p => ({ ...p, email: e.target.value }))}
                      placeholder="moderateur@example.com"
                      className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:border-[#002050]"
                      style={{ borderColor: '#E4E7EC' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Téléphone (optionnel)</label>
                    <input type="tel" value={newMod.phone_number} onChange={e => setNewMod(p => ({ ...p, phone_number: e.target.value }))}
                      placeholder="+223 70 00 00 00"
                      className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:border-[#002050]"
                      style={{ borderColor: '#E4E7EC' }} />
                  </div>
                </div>
              </div>

              {/* Permissions */}
              <div>
                <h3 className="text-sm font-semibold mb-3" style={{ color: '#002050' }}>Permissions initiales</h3>
                <div className="space-y-4">
                  {PERMISSION_SECTIONS.map(section => (
                    <div key={section.title}>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#9CA3AF' }}>{section.title}</p>
                      <div className="space-y-2">
                        {section.perms.map(perm => (
                          <label key={perm.key} className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer hover:bg-gray-50">
                            <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 cursor-pointer"
                              style={{ backgroundColor: newModPermissions[perm.key] ? '#002050' : 'white', borderColor: newModPermissions[perm.key] ? '#002050' : '#D1D5DB' }}
                              onClick={() => setNewModPermissions(p => ({ ...p, [perm.key]: !p[perm.key] }))}>
                              {newModPermissions[perm.key] && <Check size={12} color="white" />}
                            </div>
                            <span className="text-sm" style={{ color: '#374151' }}>{perm.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Boutons */}
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setShowAddModal(false); setNewMod({ full_name: '', email: '', phone_number: '' }); setNewModPermissions({}); setError(null); }}
                  className="flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium"
                  style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>
                  Annuler
                </button>
                <button onClick={createModerator}
                  disabled={creatingMod || !newMod.full_name.trim() || !newMod.email.trim()}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: '#002050' }}>
                  {creatingMod ? '⏳ Création...' : ' Créer le compte'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
