import { EcosystemStandaloneNav } from '../ecosystem/EcosystemShell';
import { coachingAudienceLabel, getCoachingNavigation, type CoachingAudience } from '../../lib/coachingNavigation';

export default function CoachingEcosystemNav({ audience }: { audience: CoachingAudience; publicMode?: boolean }) {
  return <EcosystemStandaloneNav ecosystem="coaching" audienceLabel={coachingAudienceLabel(audience)} navigation={getCoachingNavigation(audience)} />;
}
