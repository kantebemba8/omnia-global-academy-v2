import { EcosystemStandaloneNav } from '../ecosystem/EcosystemShell';
import { communityAudienceLabel, getCommunityNavigation, type CommunityAudience } from '../../lib/communityNavigation';

export default function CommunityEcosystemNav({ audience }: { audience: CommunityAudience; publicMode?: boolean }) {
  return <EcosystemStandaloneNav ecosystem="community" audienceLabel={communityAudienceLabel(audience)} navigation={getCommunityNavigation(audience)} />;
}
