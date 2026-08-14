export type RoleThemeKey =
  | 'apprenant'
  | 'professeur'
  | 'structure'
  | 'gestionnaire_structure'
  | 'recruteur'
  | 'organisateur'
  | 'coach'
  | 'moderateur';

export type RoleTheme = {
  key: RoleThemeKey;
  accent: string;
  soft: string;
  secondary: string;
  footerBackground: string;
  footerBottom: string;
  footerAccent: string;
};

// Couleurs déjà utilisées par les accueils connectés de chaque rôle.
// Ce registre permet aux pages transversales (profil, préférences, pages de rôle)
// de reprendre exactement la même identité sans inventer une nouvelle palette.
export const ROLE_THEMES: Record<RoleThemeKey, RoleTheme> = {
  apprenant: { key: 'apprenant', accent: '#0F7699', soft: '#E9F7FB', secondary: '#15546A', footerBackground: '#15546A', footerBottom: '#0B3948', footerAccent: '#75C9DF' },
  professeur: { key: 'professeur', accent: '#3E63B8', soft: '#EDF2FF', secondary: '#293F75', footerBackground: '#293F75', footerBottom: '#1B2B52', footerAccent: '#9BB2F0' },
  structure: { key: 'structure', accent: '#087F79', soft: '#E8F7F5', secondary: '#0B4F54', footerBackground: '#0B4F54', footerBottom: '#07373B', footerAccent: '#73C8C1' },
  gestionnaire_structure: { key: 'gestionnaire_structure', accent: '#087F79', soft: '#E8F7F5', secondary: '#0B4F54', footerBackground: '#0B4F54', footerBottom: '#07373B', footerAccent: '#73C8C1' },
  recruteur: { key: 'recruteur', accent: '#9C436D', soft: '#FAEDF3', secondary: '#62304A', footerBackground: '#62304A', footerBottom: '#431F32', footerAccent: '#D99DBA' },
  organisateur: { key: 'organisateur', accent: '#7A55B8', soft: '#F2EDFB', secondary: '#49316F', footerBackground: '#49316F', footerBottom: '#302047', footerAccent: '#BCA2E3' },
  coach: { key: 'coach', accent: '#0F766E', soft: '#E9F8F5', secondary: '#0B4F54', footerBackground: '#0B4F54', footerBottom: '#07373B', footerAccent: '#78CEC5' },
  moderateur: { key: 'moderateur', accent: '#C66A22', soft: '#FFF2E8', secondary: '#6F3D1F', footerBackground: '#6F3D1F', footerBottom: '#4B2814', footerAccent: '#E7A56F' },
};

export function getRoleTheme(key: RoleThemeKey): RoleTheme {
  return ROLE_THEMES[key];
}
