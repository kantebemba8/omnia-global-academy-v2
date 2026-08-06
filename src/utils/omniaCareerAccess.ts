import type { AuthUser } from '../hooks/useAuth';

export type CareerAuthUser = AuthUser | null | undefined;

export function hasAnyRole(user: CareerAuthUser, roles: string[]) {
  return roles.some((role) => user?.roles?.includes(role));
}

export function isOmniaCareerLearner(user: CareerAuthUser) {
  return hasAnyRole(user, ['apprenant', 'student', 'learner']);
}

export function isOmniaCareerSuperAdmin(user: CareerAuthUser) {
  return hasAnyRole(user, ['super_admin']);
}

export function isStructureOrTrainer(user: CareerAuthUser) {
  return hasAnyRole(user, [
    'professeur',
    'formateur',
    'teacher',
    'enseignant',
    'responsable_structure',
    'gestionnaire_structure',
    'structure_admin',
    'gestionnaire_partenaire',
    'directeur',
  ]);
}

export function getCareerRedirectForRole(user: CareerAuthUser) {
  if (!user) return '/connexion';
  if (isOmniaCareerLearner(user)) return '/omnia-career';
  if (isOmniaCareerSuperAdmin(user)) return '/admin/omnia-career';
  if (hasAnyRole(user, ['professeur', 'formateur'])) return '/professeur/dashboard';
  if (hasAnyRole(user, ['responsable_structure', 'gestionnaire_structure', 'structure_admin', 'directeur', 'gestionnaire_partenaire'])) return '/structure/dashboard';
  if (hasAnyRole(user, ['enseignant'])) return '/professeur/dashboard';
  return '/dashboard';
}

export function getInitials(fullName?: string, email?: string) {
  const base = (fullName || email || 'Apprenant').trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return base.slice(0, 2).toUpperCase();
}
