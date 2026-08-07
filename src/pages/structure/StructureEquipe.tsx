import { useEffect, useState } from 'react';
import { StructureLayout } from '../../components/StructureLayout';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { Shield, PlusCircle, RefreshCw, XCircle, UserMinus, UserRoundCheck, Ban, Copy, Pencil } from 'lucide-react';
import { coachingRequest } from '../../lib/coachingApi';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/structure-manage`;

const MEMBER_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  invited:   { label: 'Invité',    color: '#92400E', bg: '#FEF3C7' },
  active:    { label: 'Actif',     color: '#065F46', bg: '#D1FAE5' },
  inactive:  { label: 'Inactif',   color: '#374151', bg: '#F3F4F6' },
  suspended: { label: 'Suspendu',  color: '#991B1B', bg: '#FEE2E2' },
  removed:   { label: 'Retiré',    color: '#6B7280', bg: '#F3F4F6' },
};

const INTERNAL_ROLES = [
  { value: 'administrateur_structure', label: 'Administrateur de structure' },
  { value: 'coordinateur_formation',   label: 'Coordinateur de formation' },
  { value: 'formateur_structure',      label: 'Formateur de la structure' },
  { value: 'secretaire',               label: 'Secrétaire' },
  { value: 'gestionnaire_membres',     label: 'Gestionnaire des membres' },
  { value: 'gestionnaire_codes',       label: 'Gestionnaire des codes' },
  { value: 'lecture_seule',            label: 'Lecture seule' },
];

const PERMISSIONS = [
  { key: 'can_manage_structure_profile',  label: 'Gérer le profil' },
  { key: 'can_manage_structure_users',    label: 'Gérer les utilisateurs' },
  { key: 'can_create_courses',            label: 'Créer des formations' },
  { key: 'can_edit_courses',              label: 'Modifier des formations' },
  { key: 'can_submit_courses',            label: 'Soumettre des formations' },
  { key: 'can_assign_trainers',           label: 'Assigner des formateurs' },
  { key: 'can_manage_lessons',            label: 'Gérer les leçons' },
  { key: 'can_upload_files',              label: 'Téléverser des fichiers' },
  { key: 'can_manage_members',            label: 'Gérer les membres' },
  { key: 'can_approve_memberships',       label: 'Valider les rattachements' },
  { key: 'can_manage_structure_codes',    label: 'Gérer les codes' },
  { key: 'can_view_statistics',           label: 'Voir les statistiques' },
  { key: 'can_view_logs',                 label: 'Voir les journaux' },
  { key: 'can_manage_notifications',      label: 'Gérer les notifications' },
  { key: 'can_manage_settings',           label: 'Gérer les paramètres' },
  { key: 'can_manage_b2b_contracts',      label: 'Gérer le B2B et les contrats' },
  { key: 'can_manage_omnia_live',         label: 'Gérer Omnia Live pour la Structure' },
  { key: 'can_manage_projects',           label: 'Gérer Omnia Projects pour la Structure' },
];

const DISPLAY: Record<string, string> = {
  ministere: 'Espace Ministère', etablissement: 'Espace Établissement',
  universite: 'Espace Université', ecole: 'Espace École',
  centre_formation: 'Espace Centre de formation', entreprise: 'Espace Entreprise',
  ong: 'Espace ONG', association: 'Espace Association',
  institution_publique: 'Espace Institution publique',
  organisation_internationale: 'Espace Organisation internationale',
  cabinet_formation: 'Espace Cabinet de formation', autre: 'Espace Structure professionnelle',
};

export default function StructureEquipe() {
  const [team, setTeam] = useState<any[]>([]);
  const [structureId, setStructureId] = useState('');
  const [displayName, setDisplayName] = useState('Espace Structure');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null);
  const [coachEmail, setCoachEmail] = useState('');
  const [coachDesignations, setCoachDesignations] = useState<any[]>([]);
  const [coachBusy, setCoachBusy] = useState(false);
  const [form, setForm] = useState({
    email: '', firstname: '', lastname: '',
    internal_role: 'lecture_seule', message: '', status: 'active',
    permissions: {} as Record<string, boolean>,
  });
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  async function load(sid?: string) {
    const id = sid || structureId;
    if (!id) return;
    const res = await fetch(API, {
      method: 'POST',
      headers: edgeAuthHeaders(),
      body: JSON.stringify({ action: 'list_team', structure_id: id }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) setTeam(data.team ?? []);
    else showToast(data.message || data.error || 'Impossible de charger l’équipe.');
    setLoading(false);
  }

  async function loadCoachDesignations(sid?: string) {
    const id = sid || structureId;
    if (!id) return;
    try {
      const data = await coachingRequest<{ success: true; designations: any[] }>('structure_coach_designations', { organization_id: id });
      setCoachDesignations(data.designations || []);
    } catch {
      setCoachDesignations([]);
    }
  }

  async function designateCoach(email: string, active = true) {
    if (!email.trim()) { showToast('Email du membre requis'); return; }
    setCoachBusy(true);
    try {
      await coachingRequest('structure_coach_designate', { organization_id: structureId, email: email.trim(), active });
      setCoachEmail('');
      showToast(active ? 'Membre désigné pour candidater comme coach' : 'Désignation coach retirée');
      await loadCoachDesignations();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Action impossible');
    } finally {
      setCoachBusy(false);
    }
  }

  useEffect(() => {
    (async () => {
      const res = await fetch(API, {
        method: 'POST',
        headers: edgeAuthHeaders(),
        body: JSON.stringify({ action: 'get_my_structure' }),
      });
      const data = await res.json();
      if (data.success) {
        setStructureId(data.structure.id);
        setDisplayName(DISPLAY[data.structure.structure_type] ?? 'Espace Structure');
        load(data.structure.id);
        loadCoachDesignations(data.structure.id);
      } else setLoading(false);
    })();
  }, []);

  function openInvite() {
    setEditingMember(null);
    setForm({ email: '', firstname: '', lastname: '', internal_role: 'lecture_seule', message: '', status: 'active', permissions: {} });
    setShowModal(true);
  }

  function openEdit(member: any) {
    if (member.is_primary || String(member.id).startsWith('invitation:')) return;
    const names = String(member.invited_name || '').trim().split(/\s+/);
    setEditingMember(member);
    setForm({
      email: member.invited_email || '',
      firstname: names[0] || '',
      lastname: names.slice(1).join(' '),
      internal_role: member.internal_role || 'lecture_seule',
      message: '',
      status: member.status === 'suspended' ? 'suspended' : 'active',
      permissions: member.permissions_json || {},
    });
    setShowModal(true);
  }

  async function handleInvite() {
    if (!editingMember && (!form.email || !form.internal_role)) { showToast('Email et rôle requis'); return; }
    if (editingMember && !form.internal_role) { showToast('Rôle interne requis'); return; }
    setActionBusy(true);
    try {
      const payload = editingMember
        ? { action: 'update_team_member', structure_id: structureId, member_id: editingMember.id, internal_role: form.internal_role, permissions: form.permissions, status: form.status }
        : { action: 'invite_team_member', structure_id: structureId, ...form };
      const res = await fetch(API, { method: 'POST', headers: edgeAuthHeaders(), body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success !== true) throw new Error(data.message || data.error || (editingMember ? 'Modification impossible.' : 'Invitation impossible.'));
      if (!editingMember) {
        setShareLink(!data.email_sent && data.invitation_url ? String(data.invitation_url) : '');
        showToast(data.email_sent ? 'Invitation envoyée par e-mail' : 'Invitation créée. Copiez le lien personnel affiché.');
      } else {
        showToast('Accès du membre mis à jour');
      }
      setShowModal(false);
      setEditingMember(null);
      setForm({ email: '', firstname: '', lastname: '', internal_role: 'lecture_seule', message: '', status: 'active', permissions: {} });
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : (editingMember ? 'Modification impossible.' : 'Invitation impossible.'));
    } finally {
      setActionBusy(false);
    }
  }

  async function handleRemove(memberId: string) {
    if (!confirm(memberId.startsWith('invitation:') ? 'Annuler cette invitation ?' : 'Retirer ce membre de l’équipe ?')) return;
    setActionBusy(true);
    try {
      const response = await fetch(API, {
        method: 'POST',
        headers: edgeAuthHeaders(),
        body: JSON.stringify({ action: 'remove_team_member', structure_id: structureId, member_id: memberId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success !== true) throw new Error(data.message || data.error || 'Action impossible.');
      showToast(memberId.startsWith('invitation:') ? 'Invitation annulée' : 'Membre retiré');
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Action impossible.');
    } finally {
      setActionBusy(false);
    }
  }

  const getRoleLabel = (role: string) => INTERNAL_ROLES.find(r => r.value === role)?.label ?? role;

  return (
    <StructureLayout displayName={displayName}>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {toast && (
          <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border"
            style={{ background: 'white', borderColor: '#E4E7EC', color: '#002050' }}>{toast}</div>
        )}

        {shareLink && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-bold" style={{ color: '#002050' }}>Lien personnel à transmettre</p>
            <p className="mt-1 text-xs text-amber-800">L’e-mail automatique n’a pas été envoyé. Copiez ce lien maintenant et transmettez-le uniquement à la personne invitée.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input readOnly value={shareLink} className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs" />
              <button type="button" onClick={() => void navigator.clipboard.writeText(shareLink).then(() => showToast('Lien copié')).catch(() => showToast('Sélectionnez le lien manuellement'))} className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-white" style={{ background: '#002050' }}><Copy size={14} /> Copier</button>
              <button type="button" onClick={() => setShareLink('')} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-900">Masquer</button>
            </div>
          </div>
        )}

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-black" style={{ color: '#002050' }}>Équipe de la structure</h1>
            <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
              Invitez des collaborateurs par e-mail, qu’ils possèdent déjà ou non un compte Omnia
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => load()} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm border"
              style={{ borderColor: '#E4E7EC', color: '#6B7280' }}><RefreshCw size={13} /></button>
            <button disabled={actionBusy} onClick={openInvite}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: '#002050' }}>
              <PlusCircle size={15} /> Inviter un membre
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="flex items-start gap-2 p-3 rounded-xl text-sm" style={{ background: '#EEF2FF', color: '#002050' }}>
          <Shield size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <p>Ces utilisateurs ont des rôles <strong>internes</strong> à votre structure uniquement. Ils disposent uniquement des accès internes que vous leur attribuez.
          Chaque rôle dispose de permissions précises que vous pouvez personnaliser.</p>
        </div>

        <section className="rounded-2xl border bg-white p-5" style={{ borderColor: '#E4E7EC' }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2"><UserRoundCheck size={18} style={{ color: '#BF8813' }} /><h2 className="font-bold" style={{ color: '#002050' }}>Désignation Coach Omnia</h2></div>
              <p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: '#6B7280' }}>
                Désignez un membre déjà lié à votre Structure. Cette désignation l’autorise à déposer une candidature coach, mais la validation finale reste assurée par l’Administration Omnia.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              value={coachEmail}
              onChange={event => setCoachEmail(event.target.value)}
              placeholder="email.du.membre@exemple.com"
              className="h-11 flex-1 rounded-xl border px-4 text-sm outline-none focus:border-[#BF8813]"
              style={{ borderColor: '#E4E7EC' }}
            />
            <button
              type="button"
              disabled={coachBusy || !coachEmail.trim()}
              onClick={() => designateCoach(coachEmail, true)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-white disabled:opacity-50"
              style={{ background: '#002050' }}
            >
              <UserRoundCheck size={16} /> Désigner comme coach
            </button>
          </div>
          <div className="mt-5 divide-y" style={{ borderColor: '#E4E7EC' }}>
            {coachDesignations.filter(item => item.status === 'active').length === 0 ? (
              <p className="py-4 text-sm" style={{ color: '#9CA3AF' }}>Aucune désignation coach active.</p>
            ) : coachDesignations.filter(item => item.status === 'active').map(item => {
              const linkedUser = Array.isArray(item.users) ? item.users[0] : item.users;
              return (
                <div key={item.id} className="flex flex-wrap items-center gap-3 py-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold" style={{ background: '#EEF2FF', color: '#002050' }}>
                    {(linkedUser?.full_name || linkedUser?.email || 'CO').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold" style={{ color: '#002050' }}>{linkedUser?.full_name || 'Membre de la Structure'}</p>
                    <p className="truncate text-xs" style={{ color: '#9CA3AF' }}>{linkedUser?.email || 'Email non disponible'}</p>
                  </div>
                  <button
                    type="button"
                    disabled={coachBusy || !linkedUser?.email}
                    onClick={() => designateCoach(linkedUser.email, false)}
                    className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"
                    style={{ borderColor: '#FECACA' }}
                  >
                    <Ban size={14} /> Retirer la désignation
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
          </div>
        ) : team.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed p-16 text-center" style={{ borderColor: '#E4E7EC' }}>
            <Shield size={40} className="mx-auto mb-3 opacity-10" style={{ color: '#002050' }} />
            <p className="font-bold" style={{ color: '#002050' }}>Aucun membre dans l'équipe</p>
            <p className="text-sm mt-1 mb-5" style={{ color: '#9CA3AF' }}>
              Invitez des collaborateurs pour vous aider à gérer votre structure
            </p>
            <button onClick={openInvite}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white mx-auto"
              style={{ background: '#002050' }}>
              <PlusCircle size={15} /> Inviter un membre
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {team.map(member => {
              const sc = MEMBER_STATUS[member.status] ?? MEMBER_STATUS.invited;
              const activePerms = Object.entries(member.permissions_json ?? {})
                .filter(([, v]) => v === true)
                .map(([k]) => PERMISSIONS.find(p => p.key === k)?.label)
                .filter(Boolean)
                .slice(0, 3);

              return (
                <div key={member.id} className="bg-white rounded-2xl border p-5" style={{ borderColor: '#E4E7EC' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                        style={{ background: '#EEF2FF', color: '#002050' }}>
                        {(member.invited_name ?? member.invited_email ?? '?').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-sm" style={{ color: '#002050' }}>
                            {member.invited_name || member.invited_email}
                          </p>
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{member.invited_email}</p>
                        <p className="text-xs mt-1 font-semibold" style={{ color: '#374151' }}>
                          {getRoleLabel(member.internal_role)}
                        </p>
                        {activePerms.length > 0 && (
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {activePerms.map(p => (
                              <span key={p} className="text-xs px-2 py-0.5 rounded-full"
                                style={{ background: '#F0F4FF', color: '#002050' }}>{p}</span>
                            ))}
                            {Object.values(member.permissions_json ?? {}).filter(Boolean).length > 3 && (
                              <span className="text-xs" style={{ color: '#9CA3AF' }}>
                                +{Object.values(member.permissions_json ?? {}).filter(Boolean).length - 3} autres
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {!member.is_primary && !String(member.id).startsWith('invitation:') && member.status !== 'removed' && (
                        <button disabled={actionBusy} onClick={() => openEdit(member)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border"
                          style={{ borderColor: '#E4E7EC', color: '#002050' }}>
                          <Pencil size={12} /> Modifier
                        </button>
                      )}
                      {!member.is_primary && member.status !== 'removed' && (
                        <button disabled={actionBusy} onClick={() => handleRemove(member.id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border"
                          style={{ borderColor: '#FECACA', color: '#DC2626' }}>
                          <UserMinus size={12} /> Retirer
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal invitation */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 my-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black" style={{ color: '#002050' }}>{editingMember ? 'Modifier un membre' : 'Inviter un membre'}</h2>
                <button onClick={() => { setShowModal(false); setEditingMember(null); }} className="text-gray-400"><XCircle size={20} /></button>
              </div>

              {!editingMember ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5 text-gray-500">Prénom</label>
                      <input className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#002050]" value={form.firstname} onChange={e => set('firstname', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5 text-gray-500">Nom</label>
                      <input className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#002050]" value={form.lastname} onChange={e => set('lastname', e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-gray-500">Email *</label>
                    <input type="email" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#002050]" value={form.email} onChange={e => set('email', e.target.value)} />
                  </div>
                </>
              ) : (
                <div className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: '#E4E7EC', background: '#F8F9FA' }}>
                  <p className="font-semibold" style={{ color: '#002050' }}>{editingMember.invited_name || editingMember.invited_email}</p>
                  <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>{editingMember.invited_email}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-gray-500">Rôle interne *</label>
                <select className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#002050]"
                  value={form.internal_role} onChange={e => set('internal_role', e.target.value)}>
                  {INTERNAL_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>

              {editingMember && (
                <div>
                  <label className="block text-xs font-semibold mb-1.5 text-gray-500">État de l’accès</label>
                  <select className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#002050]" value={form.status} onChange={e => set('status', e.target.value)}>
                    <option value="active">Actif</option>
                    <option value="suspended">Suspendu</option>
                  </select>
                </div>
              )}

              {/* Permissions */}
              <div>
                <label className="block text-xs font-semibold mb-2 text-gray-500">Permissions personnalisées</label>
                <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto p-1">
                  {PERMISSIONS.map(p => (
                    <label key={p.key} className="flex items-center gap-2 cursor-pointer py-1">
                      <input type="checkbox"
                        checked={form.permissions[p.key] ?? false}
                        onChange={e => set('permissions', { ...form.permissions, [p.key]: e.target.checked })}
                        className="w-3.5 h-3.5 rounded" style={{ accentColor: '#002050' }} />
                      <span className="text-xs" style={{ color: '#374151' }}>{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {!editingMember && (
                <div>
                  <label className="block text-xs font-semibold mb-1.5 text-gray-500">Message (optionnel)</label>
                  <textarea className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#002050] resize-none" rows={2} placeholder="Message facultatif pour la personne invitée..." value={form.message} onChange={e => set('message', e.target.value)} />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => { setShowModal(false); setEditingMember(null); }}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm border"
                  style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>Annuler</button>
                <button disabled={actionBusy} onClick={handleInvite}
                  className="flex-1 py-3 rounded-xl font-bold text-white text-sm"
                  style={{ background: '#002050' }}>{actionBusy ? 'Traitement…' : editingMember ? 'Enregistrer' : "Envoyer l'invitation"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </StructureLayout>
  );
}
