import { useState, useEffect } from 'react';
import { Shield, Plus, Save, Trash2, User, ChevronDown, ChevronUp, X, Check } from 'lucide-react';
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

interface User {
  id: string;
  full_name: string;
  email: string;
}

const PERMISSION_SECTIONS: PermissionSection[] = [
  {
    title: 'Validation des formations',
    perms: [
      { key: 'can_see_pending_courses', label: 'Voir le contenu des formations en attente' },
      { key: 'can_validate_course_price', label: 'Valider une formation et son prix' },
      { key: 'can_reject_course', label: 'Rejeter une formation' },
      { key: 'can_request_course_modification', label: 'Demander des modifications' },
      { key: 'can_approve_transmit_course', label: 'Approuver et transmettre au Super-admin' },
      { key: 'can_create_assisted_course', label: 'Créer une formation assistée' },
    ]
  },
  {
    title: 'Gestion utilisateurs et KYC',
    perms: [
      { key: 'can_see_learners_list', label: 'Voir la liste des apprenants' },
      { key: 'can_see_professors_list', label: 'Voir la liste des professeurs' },
      { key: 'can_suspend_account', label: 'Suspendre temporairement un compte' },
      { key: 'can_validate_professor_kyc', label: 'Valider le KYC des professeurs' },
      { key: 'can_validate_establishment_kyc', label: 'Valider le KYC des établissements' },
    ]
  },
  {
    title: 'Forum, support et IA',
    perms: [
      { key: 'can_moderate_forum', label: 'Modérer le forum général' },
      { key: 'can_moderate_jobs', label: "Modérer les offres d'emploi" },
      { key: 'can_manage_support', label: 'Gérer les tickets de support' },
      { key: 'can_view_ai_conversations', label: 'Consulter les conversations IA' },
    ]
  },
  {
    title: 'Statistiques (non-financières uniquement)',
    perms: [
      { key: 'can_view_analytics', label: "Voir les statistiques d'audience" },
    ]
  },
];

export default function AdminEquipe() {
  const [moderators, setModerators] = useState<ModeratorPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedModerators, setExpandedModerators] = useState<Record<string, boolean>>({});
  const [localPermissions, setLocalPermissions] = useState<Record<string, Record<string, boolean>>>({});
  const [savingModeratorId, setSavingModeratorId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch moderators list
  useEffect(() => {
    const fetchModerators = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem('omnia_session_token');

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/moderator_permissions?select=user_id,users(full_name,email,id)`,
          {
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
              'Authorization': `Bearer ${token}`,
            }
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch moderators: ${response.statusText}`);
        }

        const data = await response.json();
        const moderatorsData: ModeratorPermissions[] = data.map((item: any) => ({
          user_id: item.user_id,
          full_name: item.users?.full_name || 'Unknown',
          email: item.users?.email || 'N/A',
          permissions: item.permissions || {}
        }));

        setModerators(moderatorsData);

        // Initialize local permissions state
        const initialPermissions: Record<string, Record<string, boolean>> = {};
        moderatorsData.forEach(mod => {
          initialPermissions[mod.user_id] = { ...mod.permissions };
        });
        setLocalPermissions(initialPermissions);
      } catch (err) {
        console.error('Error fetching moderators:', err);
        setError(err instanceof Error ? err.message : 'Failed to load moderators');
      } finally {
        setLoading(false);
      }
    };

    fetchModerators();
  }, []);

  // Toggle permission
  const togglePermission = (userId: string, permKey: string) => {
    setLocalPermissions(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [permKey]: !prev[userId]?.[permKey]
      }
    }));
  };

  // Toggle section expansion
  const toggleModeratorExpanded = (userId: string) => {
    setExpandedModerators(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  // Save permissions
  const savePermissions = async (userId: string) => {
    try {
      setSavingModeratorId(userId);
      const token = localStorage.getItem('omnia_session_token');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-moderator-update`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            user_id: userId,
            permissions: localPermissions[userId]
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to save permissions: ${response.statusText}`);
      }

      // Update the moderators list with new permissions
      setModerators(prev =>
        prev.map(mod =>
          mod.user_id === userId
            ? { ...mod, permissions: localPermissions[userId] }
            : mod
        )
      );

      setSuccessMessage(`Permissions de ${moderators.find(m => m.user_id === userId)?.full_name} mises à jour`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error saving permissions:', err);
      setError(err instanceof Error ? err.message : 'Failed to save permissions');
    } finally {
      setSavingModeratorId(null);
    }
  };

  // Delete moderator
  const deleteModerator = async (userId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir révoquer les permissions de ce modérateur ?')) return;

    try {
      const token = localStorage.getItem('omnia_session_token');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-moderator-delete`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ user_id: userId })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete moderator: ${response.statusText}`);
      }

      setModerators(prev => prev.filter(m => m.user_id !== userId));
      setLocalPermissions(prev => {
        const updated = { ...prev };
        delete updated[userId];
        return updated;
      });

      setSuccessMessage('Modérateur révoqué');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error deleting moderator:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete moderator');
    }
  };

  // Search users for adding new moderators
  const handleSearchUsers = async (query: string) => {
    if (!query.trim()) {
      setAvailableUsers([]);
      return;
    }

    try {
      setSearchingUsers(true);
      const token = localStorage.getItem('omnia_session_token');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/users?full_name=ilike.*${encodeURIComponent(query)}*&select=id,full_name,email`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
            'Authorization': `Bearer ${token}`,
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to search users');
      }

      const data = await response.json();
      setAvailableUsers(data || []);
    } catch (err) {
      console.error('Error searching users:', err);
    } finally {
      setSearchingUsers(false);
    }
  };

  // Add new moderator
  const addModerator = async (userId: string) => {
    try {
      const token = localStorage.getItem('omnia_session_token');
      const selectedUser = availableUsers.find(u => u.id === userId);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-moderator-create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ user_id: userId })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to add moderator: ${response.statusText}`);
      }

      // Add to list
      const newModerator: ModeratorPermissions = {
        user_id: userId,
        full_name: selectedUser?.full_name || 'Unknown',
        email: selectedUser?.email || 'N/A',
        permissions: {}
      };

      setModerators(prev => [...prev, newModerator]);
      setLocalPermissions(prev => ({
        ...prev,
        [userId]: {}
      }));

      setShowAddModal(false);
      setSearchQuery('');
      setAvailableUsers([]);
      setSuccessMessage(`${selectedUser?.full_name || 'User'} ajouté en tant que modérateur`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error adding moderator:', err);
      setError(err instanceof Error ? err.message : 'Failed to add moderator');
    }
  };

  const hasChanges = (userId: string) => {
    return JSON.stringify(localPermissions[userId]) !== JSON.stringify(moderators.find(m => m.user_id === userId)?.permissions || {});
  };

  return (
    <AdminLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield size={32} style={{ color: '#002050' }} />
            <div>
              <h1 className="text-3xl font-bold" style={{ color: '#002050' }}>
                Équipe de modération
              </h1>
              <p className="text-gray-600 mt-1">Gérer les permissions des modérateurs</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white transition-colors"
            style={{ backgroundColor: '#002050' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#001a3a'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#002050'}
          >
            <Plus size={20} />
            Ajouter un modérateur
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex items-center gap-2">
            <Check size={20} />
            {successMessage}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg animate-pulse"></div>
            ))}
          </div>
        )}

        {/* Moderators List */}
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
                <div
                  key={mod.user_id}
                  className="border rounded-lg bg-white shadow-sm overflow-hidden"
                  style={{ borderColor: '#BF8813' }}
                >
                  {/* Moderator Header */}
                  <div
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleModeratorExpanded(mod.user_id)}
                    style={{ backgroundColor: expandedModerators[mod.user_id] ? '#f9f5f0' : 'white' }}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                        style={{ backgroundColor: '#002050' }}
                      >
                        <User size={20} />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{mod.full_name}</p>
                        <p className="text-sm text-gray-600">{mod.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {hasChanges(mod.user_id) && (
                        <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                          Modifications non sauvegardées
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteModerator(mod.user_id);
                        }}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={20} />
                      </button>
                      {expandedModerators[mod.user_id] ? (
                        <ChevronUp size={20} style={{ color: '#002050' }} />
                      ) : (
                        <ChevronDown size={20} style={{ color: '#002050' }} />
                      )}
                    </div>
                  </div>

                  {/* Expanded Permissions Panel */}
                  {expandedModerators[mod.user_id] && (
                    <div className="border-t p-6" style={{ borderColor: '#BF8813' }}>
                      {/* Permission Sections */}
                      {PERMISSION_SECTIONS.map(section => (
                        <div key={section.title} className="mb-6 last:mb-0">
                          <h3 className="font-semibold text-gray-900 mb-4" style={{ color: '#002050' }}>
                            {section.title}
                          </h3>
                          <div className="space-y-3 ml-4">
                            {section.perms.map(perm => (
                              <label
                                key={perm.key}
                                className="flex items-center gap-3 cursor-pointer group"
                              >
                                <input
                                  type="checkbox"
                                  checked={localPermissions[mod.user_id]?.[perm.key] || false}
                                  onChange={() => togglePermission(mod.user_id, perm.key)}
                                  className="w-5 h-5 rounded border-gray-300 cursor-pointer"
                                  style={{
                                    accentColor: '#BF8813'
                                  }}
                                />
                                <span className="text-gray-700 group-hover:text-gray-900">
                                  {perm.label}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}

                      {/* Save Button */}
                      <div className="mt-8 pt-6 border-t flex gap-3">
                        <button
                          onClick={() => {
                            const originalPerms = moderators.find(m => m.user_id === mod.user_id)?.permissions || {};
                            setLocalPermissions(prev => ({
                              ...prev,
                              [mod.user_id]: { ...originalPerms }
                            }));
                          }}
                          className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={() => savePermissions(mod.user_id)}
                          disabled={savingModeratorId === mod.user_id || !hasChanges(mod.user_id)}
                          className="flex items-center gap-2 px-6 py-2 rounded-lg font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          style={{
                            backgroundColor: '#1E7A52'
                          }}
                          onMouseEnter={(e) => !savingModeratorId && (e.currentTarget.style.backgroundColor = '#164d38')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#1E7A52')}
                        >
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

        {/* Warning Note */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
          <p className="font-semibold mb-1">Note importante:</p>
          <p>
            Tous les accès financiers sont réservés au Super-admin et ne peuvent pas être délégués.
          </p>
        </div>
      </div>

      {/* Add Moderator Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            {/* Modal Header */}
            <div
              className="px-6 py-4 flex items-center justify-between border-b"
              style={{ borderColor: '#BF8813', backgroundColor: '#f9f5f0' }}
            >
              <h2 className="text-xl font-bold" style={{ color: '#002050' }}>
                Ajouter un modérateur
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSearchQuery('');
                  setAvailableUsers([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {/* Search Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rechercher un utilisateur
                </label>
                <input
                  type="text"
                  placeholder="Nom ou email..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    handleSearchUsers(e.target.value);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2"
                  style={{ focusRingColor: '#BF8813' }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#BF8813'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
                />
              </div>

              {/* Search Results */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {searchingUsers && (
                  <div className="text-center py-4 text-gray-500">Recherche en cours...</div>
                )}

                {!searchingUsers && availableUsers.length === 0 && searchQuery && (
                  <div className="text-center py-4 text-gray-500">Aucun utilisateur trouvé</div>
                )}

                {!searchingUsers && availableUsers.map(user => {
                  const isAlreadyModerator = moderators.some(m => m.user_id === user.id);
                  return (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{user.full_name}</p>
                        <p className="text-sm text-gray-600">{user.email}</p>
                      </div>
                      <button
                        onClick={() => addModerator(user.id)}
                        disabled={isAlreadyModerator || savingModeratorId === user.id}
                        className="px-3 py-1 rounded font-medium text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        style={{
                          backgroundColor: isAlreadyModerator ? '#ccc' : '#002050'
                        }}
                        onMouseEnter={(e) => !isAlreadyModerator && (e.currentTarget.style.backgroundColor = '#001a3a')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#002050')}
                      >
                        {savingModeratorId === user.id ? 'Ajout...' : isAlreadyModerator ? 'Déjà mod.' : 'Ajouter'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
