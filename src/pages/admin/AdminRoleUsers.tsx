import { Navigate, useParams } from 'react-router-dom';

const SUPPORTED = new Set(['apprenant', 'professeur', 'structure', 'organisateur', 'moderateur', 'recruteur', 'coach']);

export default function AdminRoleUsers() {
  const { roleKey = '' } = useParams();
  return <Navigate to={SUPPORTED.has(roleKey) ? `/admin/utilisateurs?role=${encodeURIComponent(roleKey)}` : '/admin/utilisateurs'} replace />;
}
