import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, GraduationCap, Building2, ChevronRight, HeartHandshake, Loader2, Radio, UserRoundSearch } from 'lucide-react';
import { AuthLayout } from '../../components/AuthLayout';
import { authGetMe, authSessionFetch } from '../../lib/authApi';
import { getSessionToken, getStoredUser, normalizePlatformRoles, saveSession, type CanonicalPlatformRole } from '../../lib/session';

type StoredUser = {
  id?: string;
  full_name?: string;
  email?: string;
  phone_number?: string;
  roles?: string[];
};

type ApplicationState = { status?: string; reason?: string | null } | null;
type PathwaysResponse = {
  success: boolean;
  message?: string;
  roles?: string[];
  applications?: {
    professeur?: ApplicationState;
    recruteur?: ApplicationState;
    organisateur?: ApplicationState;
    coach?: ApplicationState;
    structure?: (ApplicationState & { organization_id?: string; name?: string }) | null;
  };
};

type RoleChoice = {
  key: 'apprenant' | 'professeur' | 'organisateur' | 'recruteur' | 'coach' | 'structure';
  canonical: CanonicalPlatformRole;
  title: string;
  description: string;
  path: string;
  icon: typeof BookOpen;
  applicationKey?: 'professeur' | 'recruteur' | 'organisateur' | 'coach' | 'structure';
};

const roles: RoleChoice[] = [
  { key: 'apprenant', canonical: 'apprenant', icon: BookOpen, title: 'Apprenant', description: "J'explore et j'apprends à mon rythme", path: '/inscription/apprenant' },
  { key: 'professeur', canonical: 'professeur', icon: GraduationCap, title: 'Professeur', description: 'Je partage mon expertise et crée des cours', path: '/inscription/professeur', applicationKey: 'professeur' },
  { key: 'organisateur', canonical: 'organisateur', icon: Radio, title: 'Organisateur', description: 'J’organise des Lives, conférences, masterclass et événements en ligne', path: '/inscription/organisateur', applicationKey: 'organisateur' },
  { key: 'recruteur', canonical: 'recruteur', icon: UserRoundSearch, title: 'Recruteur indépendant', description: 'Je recrute et source des talents avec mon compte Omnia', path: '/inscription/recruteur', applicationKey: 'recruteur' },
  { key: 'coach', canonical: 'coach', icon: HeartHandshake, title: 'Coach', description: 'Je souhaite accompagner des personnes — candidature et validation requises', path: '/coaching/devenir-coach', applicationKey: 'coach' },
  { key: 'structure', canonical: 'structure', icon: Building2, title: 'Structure', description: 'Mon organisation souhaite rejoindre Omnia Global Academy', path: '/inscription/structure', applicationKey: 'structure' },
];

const PENDING_STATUSES = new Set(['pending', 'en_attente', 'under_review', 'approved_pending', 'modification_requested']);
const REOPEN_STATUSES = new Set(['rejected', 'rejete', 'refused', 'changes_requested', 'modification_requested']);

function statusLabel(status?: string) {
  const value = String(status || '').toLowerCase();
  if (!value) return '';
  if (['approved', 'valide', 'validated', 'verified', 'active', 'actif'].includes(value)) return 'Actif';
  if (['under_review'].includes(value)) return 'En cours d’examen';
  if (['changes_requested', 'modification_requested'].includes(value)) return 'Modifications demandées';
  if (['rejected', 'rejete', 'refused'].includes(value)) return 'À redéposer';
  if (['suspended', 'suspendu'].includes(value)) return 'Suspendu';
  return 'Candidature en attente';
}

export function SelectRole() {
  const navigate = useNavigate();
  const sessionToken = getSessionToken();
  const [user, setUser] = useState<StoredUser | null>(() => getStoredUser<StoredUser>());
  const [pathways, setPathways] = useState<PathwaysResponse['applications']>({});
  const [loading, setLoading] = useState(Boolean(sessionToken));
  const [busyRole, setBusyRole] = useState<string>('');
  const [error, setError] = useState('');
  const addMode = Boolean(sessionToken && user);
  const ownedRoles = useMemo(() => normalizePlatformRoles(user?.roles || []), [user?.roles]);

  useEffect(() => {
    if (!sessionToken) { setLoading(false); return; }
    let active = true;
    authSessionFetch<PathwaysResponse>('auth-register', { action: 'role_pathways_status' })
      .then(data => {
        if (!active) return;
        if (!data.success) throw new Error(data.message || 'Impossible de charger vos espaces.');
        setPathways(data.applications || {});
        if (Array.isArray(data.roles)) {
          setUser(current => {
            if (!current) return current;
            const refreshed = { ...current, roles: data.roles };
            if (sessionToken) saveSession(sessionToken, refreshed, false);
            return refreshed;
          });
        }
      })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Impossible de charger vos espaces.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [sessionToken]);

  async function activateLearner() {
    if (!sessionToken) { navigate('/inscription/apprenant'); return; }
    setBusyRole('apprenant');
    setError('');
    try {
      const result = await authSessionFetch<{ success: boolean; message?: string }>('auth-register', { action: 'apply_existing_role', target_role: 'apprenant' });
      if (!result.success) throw new Error(result.message || 'Impossible d’ajouter cet espace.');
      const me = await authGetMe<{ success: boolean; user?: StoredUser }>(sessionToken);
      if (me.success && me.user) {
        saveSession(sessionToken, me.user);
        setUser(me.user);
      }
      navigate('/home?role=apprenant');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d’ajouter cet espace.');
    } finally {
      setBusyRole('');
    }
  }

  function applicationFor(role: RoleChoice) {
    return role.applicationKey ? pathways?.[role.applicationKey] || null : null;
  }

  function handleRole(role: RoleChoice) {
    if (!addMode) {
      navigate(role.key === 'coach' ? '/inscription/apprenant?intent=coach' : role.path);
      return;
    }
    if (ownedRoles.includes(role.canonical)) {
      navigate(`/home?role=${encodeURIComponent(role.canonical)}`);
      return;
    }
    if (role.key === 'apprenant') {
      void activateLearner();
      return;
    }
    const application = applicationFor(role);
    const state = String(application?.status || '').toLowerCase();
    if (state && PENDING_STATUSES.has(state) && !REOPEN_STATUSES.has(state)) return;
    navigate(role.path);
  }

  return (
    <AuthLayout
      title={addMode ? 'Ajouter un espace à mon compte' : 'Créer un compte'}
      subtitle={addMode ? 'Gardez le même compte Omnia et activez ou candidatez à un nouvel espace.' : 'Choisissez le profil qui correspond à votre utilisation de la plateforme'}
      variant="wide"
    >
      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading ? (
        <div className="flex min-h-40 items-center justify-center"><Loader2 className="animate-spin text-[#002050]" size={26} /></div>
      ) : (
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {roles.map(({ icon: Icon, ...role }) => {
            const isOwned = ownedRoles.includes(role.canonical);
            const application = applicationFor(role as RoleChoice);
            const state = String(application?.status || '').toLowerCase();
            const isBlockedPending = addMode && !isOwned && Boolean(state) && PENDING_STATUSES.has(state) && !REOPEN_STATUSES.has(state);
            return (
              <button
                key={role.key}
                type="button"
                disabled={busyRole === role.key || isBlockedPending || state === 'suspended'}
                onClick={() => handleRole({ ...role, icon: Icon } as RoleChoice)}
                className="group flex min-h-[112px] w-full items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[#BF8813] hover:shadow-[0_12px_30px_rgba(0,32,80,0.08)] focus:outline-none focus:ring-2 focus:ring-[#BF8813]/30 disabled:cursor-default disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:border-gray-200 disabled:hover:shadow-none"
              >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[#F0F4FF] transition-colors group-hover:bg-[#FFF8E7]">
                  {busyRole === role.key ? <Loader2 size={21} className="animate-spin text-[#002050]" /> : <Icon size={22} className="text-[#002050]" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-[#002050] sm:text-[15px]">{role.title}</span>
                    {addMode && (isOwned || state) && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isOwned ? 'bg-emerald-50 text-emerald-700' : state === 'suspended' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                        {isOwned ? 'Actif' : statusLabel(state)}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-gray-500 sm:text-sm">{role.description}</div>
                </div>
                {!isBlockedPending && state !== 'suspended' && <ChevronRight size={19} className="flex-shrink-0 text-[#BF8813] transition-transform group-hover:translate-x-0.5" />}
              </button>
            );
          })}
        </div>
      )}

      <p className="mt-7 text-center text-sm text-gray-500">
        {addMode ? (
          <button type="button" onClick={() => navigate('/home')} className="font-semibold text-[#BF8813]">Retour à mon accueil</button>
        ) : (
          <>Déjà un compte ? <Link to="/connexion" className="font-semibold text-[#BF8813]">Se connecter</Link></>
        )}
      </p>
    </AuthLayout>
  );
}
