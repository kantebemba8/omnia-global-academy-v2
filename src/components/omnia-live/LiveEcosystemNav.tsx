import { EcosystemStandaloneNav } from '../ecosystem/EcosystemShell';
import { getLiveNavigation, liveAudienceLabel, type LiveAudience } from '../../lib/liveNavigation';

export default function LiveEcosystemNav({ audience }: { audience: LiveAudience; publicMode?: boolean }) {
  return <EcosystemStandaloneNav ecosystem="live" audienceLabel={liveAudienceLabel(audience)} navigation={getLiveNavigation(audience)} />;
}
