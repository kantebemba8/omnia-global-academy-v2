import { EcosystemStandaloneNav } from '../ecosystem/EcosystemShell';
import { getProjectsNavigation, type ProjectsAudience } from '../../lib/projectsNavigation';

const label = (audience: ProjectsAudience) => ({ public: 'Découvrir', apprenant: 'Apprenant', professeur: 'Professeur', structure: 'Structure', moderateur: 'Modérateur', recruteur: 'Recruteur', organisateur: 'Organisateur', coach: 'Coach', super_admin: 'Administration' } as const)[audience];
export default function ProjectsEcosystemNav({ audience }: { audience: ProjectsAudience; publicMode?: boolean }) {
  return <EcosystemStandaloneNav ecosystem="projects" audienceLabel={label(audience)} navigation={getProjectsNavigation(audience)} />;
}
