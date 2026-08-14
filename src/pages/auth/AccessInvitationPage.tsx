import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Building2, CheckCircle2, Clock3, ShieldCheck, UserRoundCheck } from 'lucide-react';
import { AuthLayout } from '../../components/AuthLayout';
import { authFetch } from '../../lib/authApi';
import { getDashboardPathForRoles, getSessionToken, getStoredUser } from '../../lib/session';

type Invitation = {
  id: string;
  invitation_type: 'moderator' | 'structure_team' | 'coach_oga';
  email: string;
  full_name?: string | null;
  organization_name?: string | null;
  internal_role?: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired';
  expires_at: string;
  account_exists: boolean;
};

type StoredUser = {
  id?: string;
  email?: string;
  roles?: string[];
  [key: string]: unknown;
};

const TYPE_CONTENT: Record<Invitation['invitation_type'], { title: string; description: string; icon: typeof ShieldCheck }> = {
  moderator: {
    title: 'Invitation à l’équipe de modération',
    description: 'Cette invitation donne accès uniquement aux missions et permissions de modération définies par l’Administration Omnia.',
    icon: ShieldCheck,
  },
  structure_team: {
    title: 'Invitation à l’équipe d’une Structure',
    description: 'Cette invitation vous rattache à l’équipe interne de la Structure avec des permissions professionnelles précises.',
    icon: Building2,
  },
  coach_oga: {
    title: 'Invitation à rejoindre les Coachs OGA',
    description: 'Cette invitation vous rattache à Omnia Coaching comme Coach OGA. Si vous créez votre compte, sa confirmation se fait par code OTP envoyé par email.',
    icon: UserRoundCheck,
  },
};

export default function AccessInvitationPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);

  const loginRedirect = useMemo(
    () => `/connexion?redirect=${encodeURIComponent(`/invitation/${token}`)}`,
    [token],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    authFetch<{ success: boolean; invitation?: Invitation; message?: string }>('auth-register', {
      action: 'inspect_access_invitation',
      invitation_token: token,
    })
      .then(data => {
        if (!active) return;
        if (!data.success || !data.invitation) throw new Error(data.message || 'Invitation introuvable.');
        setInvitation(data.invitation);
      })
      .catch(err => {
        if (active) setError(err instanceof Error ? err.message : 'Invitation indisponible.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [token]);

  async function acceptInvitation() {
    const sessionToken = getSessionToken();
    if (!sessionToken) {
      navigate(loginRedirect);
      return;
    }
    setAccepting(true);
    setError('');
    try {
      const data = await authFetch<{ success: boolean; roles?: string[]; message?: string }>('auth-register', {
        action: 'accept_access_invitation',
        invitation_token: token,
        session_token: sessionToken,
      });
      if (!data.success || !data.roles) throw new Error(data.message || 'Invitation non acceptée.');
      const stored = getStoredUser<StoredUser>();
      if (stored) localStorage.setItem('omnia_user', JSON.stringify({ ...stored, roles: data.roles }));
      setAccepted(true);
      window.setTimeout(() => navigate(getDashboardPathForRoles(data.roles || []), { replace: true }), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invitation non acceptée.');
    } finally {
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <AuthLayout title="Invitation professionnelle" subtitle="Vérification du lien en cours">
        <div className="mt-8 flex justify-center py-12">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
        </div>
      </AuthLayout>
    );
  }

  if (!invitation || error && !invitation) {
    return (
      <AuthLayout title="Invitation indisponible" subtitle="Ce lien ne peut pas être utilisé">
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error || 'Invitation introuvable.'}</div>
        <Link to="/connexion" className="mt-5 block w-full rounded-xl px-4 py-3 text-center text-sm font-semibold text-white" style={{ background: '#002050' }}>
          Se connecter
        </Link>
      </AuthLayout>
    );
  }

  const content = TYPE_CONTENT[invitation.invitation_type];
  const Icon = content.icon;
  const unusable = invitation.status !== 'pending';
  const registerUrl = `/inscription/apprenant?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(invitation.email)}&name=${encodeURIComponent(invitation.full_name || '')}`;
  const currentUser = getStoredUser<StoredUser>();
  const connected = Boolean(getSessionToken() && currentUser);
  const emailMatches = !connected || String(currentUser?.email || '').trim().toLowerCase() === invitation.email.trim().toLowerCase();

  return (
    <AuthLayout title={content.title} subtitle={invitation.organization_name || 'Omnia Global Academy'}>
      <div className="mt-6 space-y-5">
        <div className="rounded-2xl border p-5" style={{ borderColor: '#E4E7EC' }}>
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl" style={{ background: '#EEF2FF', color: '#002050' }}>
              <Icon size={22} />
            </div>
            <div>
              <p className="font-semibold" style={{ color: '#002050' }}>{invitation.internal_role || content.title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{content.description}</p>
            </div>
          </div>
          <dl className="mt-5 grid gap-3 border-t pt-4 text-sm" style={{ borderColor: '#E4E7EC' }}>
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Adresse invitée</dt><dd className="mt-1 font-medium text-slate-700">{invitation.email}</dd></div>
            <div className="flex items-center gap-2 text-xs text-slate-500"><Clock3 size={14} /> Expire le {new Date(invitation.expires_at).toLocaleString('fr-FR')}</div>
          </dl>
        </div>

        {accepted && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
            <CheckCircle2 size={18} /> Invitation acceptée. Ouverture de votre espace…
          </div>
        )}
        {error && invitation && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {unusable ? (
          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            Cette invitation est {invitation.status === 'accepted' ? 'déjà acceptée' : invitation.status === 'expired' ? 'expirée' : 'inactive'}.
          </div>
        ) : connected ? (
          <>
            {!emailMatches && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Cette invitation a été envoyée à {invitation.email}. Connectez-vous avec ce compte pour l’accepter.
              </div>
            )}
            <button
              type="button"
              disabled={accepting || accepted || !emailMatches}
              onClick={acceptInvitation}
              className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: '#002050' }}
            >
              {accepting ? 'Acceptation…' : 'Accepter l’invitation'}
            </button>
          </>
        ) : invitation.account_exists ? (
          <Link to={loginRedirect} className="block w-full rounded-xl px-4 py-3 text-center text-sm font-semibold text-white" style={{ background: '#002050' }}>
            Se connecter avec cette adresse
          </Link>
        ) : (
          <Link to={registerUrl} className="block w-full rounded-xl px-4 py-3 text-center text-sm font-semibold text-white" style={{ background: '#002050' }}>
            Créer mon compte personnel
          </Link>
        )}

        <p className="text-center text-xs leading-5 text-slate-500">
          Cette invitation ne contient aucun mot de passe. Vos accès professionnels restent séparés de votre compte personnel.
        </p>
      </div>
    </AuthLayout>
  );
}
