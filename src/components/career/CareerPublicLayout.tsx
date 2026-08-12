import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import SubspaceHamburgerLayout from '../SubspaceHamburgerLayout';
import { useAuth } from '../../hooks/useAuth';
import { getCareerNavigation, resolveCareerAudience } from '../../lib/careerNavigation';
import { CareerAudienceLayout } from './CareerRoleLayout';

function PublicCareerLayout({ children }: { children: ReactNode }) {
  const navItems = getCareerNavigation('public').map(item => ({
    label: item.label,
    path: item.path,
    icon: item.icon,
    exact: item.id === 'accueil',
  }));
  return (
    <SubspaceHamburgerLayout
      title="Omnia Career"
      navItems={navItems}
      searchPath="/forum/emploi"
      searchParam="search"
      searchPlaceholder="Rechercher une opportunité, un métier ou une entreprise..."
      navigationMode="horizontal"
    >
      {children}
    </SubspaceHamburgerLayout>
  );
}

export default function CareerPublicLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  if (loading) return <div className="grid min-h-screen place-items-center bg-[#FBF8F1]"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E9DCC2] border-t-[#BF8813]" /></div>;
  const preview = params.get('preview') === 'true' && Boolean(user?.roles?.includes('super_admin'));
  const audience = resolveCareerAudience(user?.roles, preview ? params.get('role') : null);
  if (audience === 'public' || audience === 'super_admin') return <PublicCareerLayout>{children}</PublicCareerLayout>;
  return <CareerAudienceLayout audience={audience}>{children}</CareerAudienceLayout>;
}
