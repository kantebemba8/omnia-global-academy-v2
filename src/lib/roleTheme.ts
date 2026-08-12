export type RoleThemeKey =
  | 'apprenant'
  | 'professeur'
  | 'structure'
  | 'gestionnaire_structure'
  | 'recruteur_structure'
  | 'recruteur'
  | 'organisateur'
  | 'coach'
  | 'moderateur';

export type RoleTheme = {
  key: RoleThemeKey;
  accent: string;
  soft: string;
  secondary: string;
};

// Couleurs déjà utilisées par les accueils connectés de chaque rôle.
// Ce registre permet aux pages transversales (profil, préférences, pages de rôle)
// de reprendre exactement la même identité sans inventer une nouvelle palette.
export const ROLE_THEMES: Record<RoleThemeKey, RoleTheme> = {
  apprenant: { key: 'apprenant', accent: '#0F7699', soft: '#E9F7FB', secondary: '#15546A' },
  professeur: { key: 'professeur', accent: '#3E63B8', soft: '#EDF2FF', secondary: '#293F75' },
  structure: { key: 'structure', accent: '#087F79', soft: '#E8F7F5', secondary: '#0B4F54' },
  gestionnaire_structure: { key: 'gestionnaire_structure', accent: '#087F79', soft: '#E8F7F5', secondary: '#0B4F54' },
  recruteur_structure: { key: 'recruteur_structure', accent: '#315FA8', soft: '#EAF1FF', secondary: '#243E73' },
  recruteur: { key: 'recruteur', accent: '#9C436D', soft: '#FAEDF3', secondary: '#62304A' },
  organisateur: { key: 'organisateur', accent: '#7A55B8', soft: '#F2EDFB', secondary: '#49316F' },
  coach: { key: 'coach', accent: '#0F766E', soft: '#E9F8F5', secondary: '#0B4F54' },
  moderateur: { key: 'moderateur', accent: '#C66A22', soft: '#FFF2E8', secondary: '#6F3D1F' },
};

export function getRoleTheme(key: RoleThemeKey): RoleTheme {
  return ROLE_THEMES[key];
}
