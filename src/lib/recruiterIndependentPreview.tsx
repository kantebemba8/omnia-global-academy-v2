import type { LucideIcon } from 'lucide-react';
import { UserRoundSearch } from 'lucide-react';

export type AdminPreviewSpace = {
  label: string;
  icon: LucideIcon;
  path: string;
};

/**
 * Prévisualisation administrative Omnia de l'espace Recruteur indépendant.
 *
 * Ce fichier ne modifie aucun autre rôle ni aucun autre écran.
 */
export const RECRUITER_INDEPENDENT_PREVIEW_SPACE: AdminPreviewSpace = {
  label: 'Recruteur indépendant',
  icon: UserRoundSearch,
  path: '/talent/recruteur/dashboard?preview=true',
};
