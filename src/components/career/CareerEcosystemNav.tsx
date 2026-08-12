import { EcosystemStandaloneNav } from '../ecosystem/EcosystemShell';
import { getCareerNavigation, type CareerAudience } from '../../lib/careerNavigation';

export default function CareerEcosystemNav({ audience }: { audience: CareerAudience; publicMode?: boolean }) {
  return <EcosystemStandaloneNav ecosystem="career" audienceLabel={audience === 'apprenant' ? 'Apprenant' : 'Découvrir'} navigation={getCareerNavigation(audience)} />;
}
