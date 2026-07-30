import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
  getDashboardPathForRoles,
  getSessionToken,
  getStoredUser,
  normalizePlatformRoles,
  type CanonicalPlatformRole,
} from '../../lib/session';

type StoredUser = {
  roles?: string[];
};

type PreviewRole = 'apprenant' | 'professeur' | 'structure' | 'recruteur_structure' | 'moderateur' | 'coach' | 'recruteur' | 'organisateur';

type AccessPolicy = {
  allowedRoles?: readonly CanonicalPlatformRole[];
  previewRole?: PreviewRole;
};

function startsWithSpace(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function resolvePolicy(pathname: string): AccessPolicy | null {
  if (startsWithSpace(pathname, '/admin')) {
    return { allowedRoles: ['super_admin'] };
  }
  if (startsWithSpace(pathname, '/moderator') || startsWithSpace(pathname, '/moderateur')) {
    return { allowedRoles: ['moderateur'], previewRole: 'moderateur' };
  }
  if (startsWithSpace(pathname, '/coach')) {
    return { allowedRoles: ['coach'], previewRole: 'coach' };
  }
  if (startsWithSpace(pathname, '/talent/recruteur')) {
    return { allowedRoles: ['recruteur'], previewRole: 'recruteur' };
  }
  const isLiveCreatorRoute =
    startsWithSpace(pathname, '/omnia-live/organisateur') ||
    pathname === '/omnia-live/revenus' ||
    startsWithSpace(pathname, '/omnia-live/proposer') ||
    startsWithSpace(pathname, '/omnia-live/studio') ||
    /^\/omnia-live\/[^/]+\/(organiser|presence|statistiques)$/.test(pathname);
  if (isLiveCreatorRoute) {
    return {
      allowedRoles: ['organisateur', 'professeur', 'structure', 'super_admin'],
      previewRole: 'organisateur',
    };
  }
  if (startsWithSpace(pathname, '/professeur') || startsWithSpace(pathname, '/staff')) {
    return { allowedRoles: ['professeur'], previewRole: 'professeur' };
  }
  if (startsWithSpace(pathname, '/structure/recrutement')) {
    return { allowedRoles: ['structure', 'recruteur_structure'], previewRole: 'recruteur_structure' };
  }
  if (startsWithSpace(pathname, '/structure') || startsWithSpace(pathname, '/partner') || startsWithSpace(pathname, '/school')) {
    return { allowedRoles: ['structure'], previewRole: 'structure' };
  }
  if (startsWithSpace(pathname, '/dashboard')) {
    return { allowedRoles: ['apprenant'], previewRole: 'apprenant' };
  }

  const authenticatedOnly = [
    '/projects/mes-projets',
    '/projects/gestion',
    '/coaching/paiement',
    '/coaching/avance/paiement',
    '/coaching/groupes',
    '/coaching/sessions',
    '/omnia-live/mes-lives',
    '/omnia-live/mes-achats',
    '/omnia-live/mes-documents',
    '/omnia-live/mes-acces',
    '/omnia-live/checkout',
    '/omnia-live/acces-prive',
    '/omnia-live/profil-organisateur',
    '/omnia-live/participant',
    '/paiement',
    '/demo/dashboard',
  ];
  if (authenticatedOnly.some(prefix => startsWithSpace(pathname, prefix))) {
    return {};
  }

  return null;
}

function canPreview(userRoles: CanonicalPlatformRole[], policy: AccessPolicy, search: string): boolean {
  if (!policy.previewRole || !userRoles.includes('super_admin')) return false;
  const queryPreview = new URLSearchParams(search).get('preview') === 'true';
  const storedPreview = sessionStorage.getItem('omnia_admin_role_preview') === policy.previewRole;
  return queryPreview || storedPreview;
}

function loginRedirect(pathname: string, search: string, hash: string): string {
  const requestedPath = `${pathname}${search}${hash}`;
  return `/connexion?redirect=${encodeURIComponent(requestedPath)}`;
}

/**
 * Limite d'accès côté navigateur pour les espaces privés de la plateforme.
 *
 * Les identifiants historiques ou techniques sont normalisés dans session.ts :
 * ils assurent seulement la compatibilité d'anciens comptes et ne créent aucun
 * rôle supplémentaire dans l'interface. Les Edge Functions et les politiques
 * RLS restent les protections de sécurité définitives côté serveur.
 */
export function PlatformRoleGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const policy = resolvePolicy(location.pathname);

  if (!policy) return <>{children}</>;

  const token = getSessionToken();
  const user = getStoredUser<StoredUser>();
  const storedRoles = Array.isArray(user?.roles) ? user.roles : [];
  const roles = normalizePlatformRoles(storedRoles);

  if (canPreview(roles, policy, location.search)) {
    return <>{children}</>;
  }

  if (!token || !user) {
    return <Navigate to={loginRedirect(location.pathname, location.search, location.hash)} replace />;
  }

  if (!policy.allowedRoles || policy.allowedRoles.some(role => roles.includes(role))) {
    return <>{children}</>;
  }

  const target = getDashboardPathForRoles(storedRoles);
  const current = `${location.pathname}${location.search}`;
  return <Navigate to={target === current || target === location.pathname ? '/accueil' : target} replace />;
}
