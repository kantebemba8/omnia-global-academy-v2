import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getCareerNavigation, resolveCareerAudience } from '../../lib/careerNavigation';
import { CareerAudienceLayout } from './CareerRoleLayout';
import { PageFooter } from '../PageFooter';
import SuperAdminEcosystemLayout from '../ecosystem/SuperAdminEcosystemLayout';
import { EcosystemPublicHeader } from '../ecosystem/EcosystemShell';
import CareerHeaderSearch from './CareerHeaderSearch';

function PublicCareerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F5F7FD] text-[#002050]">
      <EcosystemPublicHeader ecosystem="career" navigation={getCareerNavigation('public')} search={<CareerHeaderSearch />} />
      <main className="min-w-0">{children}</main>
      <PageFooter ecosystem="career" />
    </div>
  );
}

export default function CareerPublicLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  if (loading) return <div className="grid min-h-screen place-items-center bg-[#F5F7FD]"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#D8E0F4] border-t-[#3E63B8]" /></div>;
  const preview = params.get('preview') === 'true' && Boolean(user?.roles?.includes('super_admin'));
  const audience = resolveCareerAudience(user?.roles, preview ? params.get('role') : null);
  if (audience === 'public') return <PublicCareerLayout>{children}</PublicCareerLayout>;
  if (audience === 'super_admin') return <SuperAdminEcosystemLayout ecosystem="career" navigation={getCareerNavigation('public')} search={<CareerHeaderSearch />}>{children}</SuperAdminEcosystemLayout>;
  return <CareerAudienceLayout audience={audience}>{children}</CareerAudienceLayout>;
}
