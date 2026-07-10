import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import OmniaCareerLayout from '../../layouts/OmniaCareerLayout';
import { getCareerRedirectForRole, isOmniaCareerLearner, isOmniaCareerSuperAdmin } from '../../utils/omniaCareerAccess';
import OmniaCareerDashboard from './OmniaCareerDashboard';
import OmniaCareerPublicPreview from './OmniaCareerPublicPreview';

export default function OmniaCareerEntry() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="rounded-2xl bg-white px-6 py-5 text-sm font-semibold text-slate-600 shadow-sm">Chargement de Omnia Career...</div>
      </div>
    );
  }

  if (!user) return <OmniaCareerPublicPreview />;
  if (isOmniaCareerSuperAdmin(user)) return <Navigate to="/admin/omnia-career" replace />;
  if (!isOmniaCareerLearner(user)) return <Navigate to={getCareerRedirectForRole(user)} replace />;

  return (
    <OmniaCareerLayout>
      <OmniaCareerDashboard />
    </OmniaCareerLayout>
  );
}
