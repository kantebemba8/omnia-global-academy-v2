import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getCareerRedirectForRole, isOmniaCareerSuperAdmin } from '../../utils/omniaCareerAccess';

export default function RequireOmniaCareerAdmin() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="rounded-2xl bg-white px-6 py-5 text-sm font-semibold text-slate-600 shadow-sm">
          Chargement de Omnia Career Studio...
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/connexion?redirect=/admin/omnia-career" replace />;
  if (!isOmniaCareerSuperAdmin(user)) return <Navigate to={getCareerRedirectForRole(user)} replace />;

  return <Outlet />;
}
