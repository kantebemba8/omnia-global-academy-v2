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
};

export const ECOSYSTEMS: EcosystemTheme[] = [
  { id: 'formations', name: 'Formations', navLabel: 'Formations', rootPath: '/formations', publicPath: '/formations', accent: '#0F7699', secondary: '#245D9B', background: '#F5FAFD', panel: '#FFFFFF', soft: '#EAF5FB', border: '#D7E7F1', description: 'Apprentissage, progression et preuves.' },
  { id: 'career', name: 'Career', navLabel: 'Career', rootPath: '/omnia-career', publicPath: '/career-studio', accent: '#BF8813', secondary: '#4F46E5', background: '#FBF8F1', panel: '#FFFDF9', soft: '#F5EEDF', border: '#E9DCC2', description: 'Documents, préparation et trajectoire professionnelle.' },
  { id: 'projects', name: 'Projects', navLabel: 'Projects', rootPath: '/projects', publicPath: '/projects', accent: '#A96812', secondary: '#0F6070', background: '#FAF8F2', panel: '#FFFDF8', soft: '#F5EBD7', border: '#E8DCC7', description: 'Missions, collaboration et preuves d’expérience.' },
  { id: 'talent', name: 'Talent', navLabel: 'Talent', rootPath: '/talent', publicPath: '/talent', accent: '#8B4166', secondary: '#76506F', background: '#FBF8FB', panel: '#FFFDFE', soft: '#F5EDF4', border: '#E7DCE5', description: 'Profils, compétences et opportunités.' },
  { id: 'live', name: 'Live', navLabel: 'Live', rootPath: '/omnia-live', publicPath: '/omnia-live', accent: '#6556B5', secondary: '#5C55C8', background: '#F8F7FD', panel: '#FFFEFF', soft: '#F0EEFF', border: '#E0DDF2', description: 'Direct, programmation et replays.' },
  { id: 'community', name: 'Communauté', navLabel: 'Communauté', rootPath: '/forum', publicPath: '/forum', accent: '#0F766E', secondary: '#356C63', background: '#F6FAF9', panel: '#FFFEFE', soft: '#E9F5F1', border: '#D9E8E3', description: 'Conversations, entraide et confiance.' },
  { id: 'coaching', name: 'Coaching', navLabel: 'Coaching', rootPath: '/coaching', publicPath: '/coaching', accent: '#356C63', secondary: '#0B746C', background: '#F7FAF8', panel: '#FFFEFC', soft: '#EAF3F0', border: '#DCE7E1', description: 'Accompagnement, séances et progression.' },
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
