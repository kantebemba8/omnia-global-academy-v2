import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getCareerRedirectForRole, isOmniaCareerLearner } from '../../utils/omniaCareerAccess';

export default function RequireOmniaCareerLearner() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="rounded-2xl bg-white px-6 py-5 text-sm font-semibold text-slate-600 shadow-sm">
          Chargement de votre espace Omnia Career...
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/connexion?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (!isOmniaCareerLearner(user)) {
    return <Navigate to={getCareerRedirectForRole(user)} replace />;
  }

  return <Outlet />;
}
