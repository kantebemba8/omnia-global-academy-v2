import { Navigate, useParams } from 'react-router-dom';
import CareerLearnerLayout from '../../components/career/CareerRoleLayout';
import { EcosystemSectionLanding } from '../../components/ecosystem/EcosystemShell';
import { getCareerNavigation } from '../../lib/careerNavigation';

export default function CareerSectionHub() {
  const { sectionId } = useParams();
  if (sectionId !== 'documents' && sectionId !== 'preparation') return <Navigate to="/omnia-career" replace />;
  const section = getCareerNavigation('apprenant').find(item => item.id === sectionId);
  if (!section?.children?.length) return <Navigate to="/omnia-career" replace />;
  return <CareerLearnerLayout><EcosystemSectionLanding ecosystem="career" group={section} /></CareerLearnerLayout>;
}
