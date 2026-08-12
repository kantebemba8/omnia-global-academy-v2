import { normalizePlatformRoles } from './session';

export type EcosystemId = 'formations' | 'career' | 'projects' | 'talent' | 'live' | 'community' | 'coaching';

export type EcosystemTheme = {
  id: EcosystemId;
  name: string;
  navLabel: string;
  rootPath: string;
  publicPath: string;
  accent: string;
  secondary: string;
  background: string;
  panel: string;
  soft: string;
  border: string;
  description: string;
  footerBackground: string;
  footerBottom: string;
  footerAccent: string;
};

export const ECOSYSTEMS: EcosystemTheme[] = [
  { id: 'formations', name: 'Formations', navLabel: 'Formations', rootPath: '/formations', publicPath: '/formations', accent: '#BF8813', secondary: '#8A650D', background: '#FFF9EC', panel: '#FFFEFA', soft: '#F8E9C3', border: '#EBD9AA', description: 'Apprentissage, progression et preuves.', footerBackground: '#86600E', footerBottom: '#5C4108', footerAccent: '#F2CF74' },
  { id: 'career', name: 'Career', navLabel: 'Career', rootPath: '/omnia-career', publicPath: '/career-studio', accent: '#3E63B8', secondary: '#2D4E94', background: '#F5F7FD', panel: '#FEFEFF', soft: '#E9EEFB', border: '#D8E0F4', description: 'Documents, préparation et trajectoire professionnelle.', footerBackground: '#2C4789', footerBottom: '#1D3163', footerAccent: '#AFC3FF' },
  { id: 'projects', name: 'Projects', navLabel: 'Projects', rootPath: '/projects', publicPath: '/projects', accent: '#B5623C', secondary: '#8B482F', background: '#FCF7F3', panel: '#FFFEFC', soft: '#F5E6DD', border: '#E9D1C5', description: 'Missions, collaboration et preuves d’expérience.', footerBackground: '#7A402B', footerBottom: '#542B1F', footerAccent: '#F1B08F' },
  { id: 'talent', name: 'Talent', navLabel: 'Talent', rootPath: '/talent', publicPath: '/talent', accent: '#8B4166', secondary: '#76506F', background: '#FBF8FB', panel: '#FFFDFE', soft: '#F5EDF4', border: '#E7DCE5', description: 'Profils, compétences et opportunités.', footerBackground: '#62384F', footerBottom: '#442638', footerAccent: '#D9A5BF' },
  { id: 'live', name: 'Live', navLabel: 'Live', rootPath: '/omnia-live', publicPath: '/omnia-live', accent: '#6556B5', secondary: '#5C55C8', background: '#F8F7FD', panel: '#FFFEFF', soft: '#F0EEFF', border: '#E0DDF2', description: 'Direct, programmation et replays.', footerBackground: '#433B88', footerBottom: '#2E285F', footerAccent: '#BEB8FF' },
  { id: 'community', name: 'Communauté', navLabel: 'Communauté', rootPath: '/forum', publicPath: '/forum', accent: '#0F766E', secondary: '#356C63', background: '#F6FAF9', panel: '#FFFEFE', soft: '#E9F5F1', border: '#D9E8E3', description: 'Conversations, entraide et confiance.', footerBackground: '#0B5751', footerBottom: '#073C38', footerAccent: '#7FD3C6' },
  { id: 'coaching', name: 'Coaching', navLabel: 'Coaching', rootPath: '/coaching', publicPath: '/coaching', accent: '#667A3D', secondary: '#52622F', background: '#FAFBF4', panel: '#FFFFFB', soft: '#EEF1DE', border: '#DFE4C9', description: 'Accompagnement, séances et progression.', footerBackground: '#4B592B', footerBottom: '#343E1E', footerAccent: '#C9D78D' },
];

export function getEcosystem(id: EcosystemId) {
  return ECOSYSTEMS.find(item => item.id === id) || ECOSYSTEMS[0];
}

export function ecosystemEntryPath(id: EcosystemId, roles?: readonly string[] | null, previewRole?: string | null) {
  const ecosystem = getEcosystem(id);
  if (id !== 'career') return ecosystem.rootPath;
  const normalized = normalizePlatformRoles(roles || []);
  if (previewRole === 'apprenant') return ecosystem.rootPath;
  if (normalized.includes('apprenant') && !normalized.includes('super_admin')) return ecosystem.rootPath;
  return ecosystem.publicPath;
}
