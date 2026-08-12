import { EcosystemStandaloneNav } from '../ecosystem/EcosystemShell';
import { getTalentNavigation, type TalentAudience } from '../../lib/talentNavigation';

const label = (audience: TalentAudience) => ({ public: 'Découvrir', apprenant: 'Apprenant', professeur: 'Professeur', structure: 'Structure', moderateur: 'Modérateur', recruteur: 'Recruteur', organisateur: 'Organisateur', coach: 'Coach', super_admin: 'Administration' } as const)[audience];
export default function TalentEcosystemNav({ audience }: { audience: TalentAudience; publicMode?: boolean }) {
  return <EcosystemStandaloneNav ecosystem="talent" audienceLabel={label(audience)} navigation={getTalentNavigation(audience)} />;
}
