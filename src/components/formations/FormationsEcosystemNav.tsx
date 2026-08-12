import { EcosystemStandaloneNav } from '../ecosystem/EcosystemShell';
import { formationsAudienceLabel, getFormationsNavigation, type FormationsAudience } from '../../lib/formationsNavigation';

export default function FormationsEcosystemNav({ audience }: { audience: FormationsAudience; publicMode?: boolean }) {
  return <EcosystemStandaloneNav ecosystem="formations" audienceLabel={formationsAudienceLabel(audience)} navigation={getFormationsNavigation(audience)} />;
}
