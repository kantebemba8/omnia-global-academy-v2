import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function PreviewReturnButton() {
  const location = useLocation();
  const navigate = useNavigate();
  const preview = new URLSearchParams(location.search).get('preview') === 'true';
  let isAdmin = false;
  try {
    const user = JSON.parse(localStorage.getItem('omnia_user') || '{}');
    isAdmin = Array.isArray(user?.roles) && user.roles.includes('super_admin');
  } catch { /* ignore invalid local storage */ }

  if (!preview || !isAdmin || location.pathname.startsWith('/admin/')) return null;

  return (
    <button
      type="button"
      onClick={() => navigate('/admin/dashboard')}
      className="fixed right-4 top-4 z-[9999] flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-xl"
      style={{ background: '#002050', border: '1px solid rgba(255,255,255,.25)' }}
      aria-label="Retour au Dashboard Super Admin"
    >
      <ArrowLeft size={17} />
      <span className="hidden sm:inline">Dashboard Super Admin</span>
    </button>
  );
}
