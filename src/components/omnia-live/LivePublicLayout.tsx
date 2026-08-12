import type { ReactNode } from 'react';
import LiveHeaderSearch from './LiveHeaderSearch';
import { PageFooter } from '../PageFooter';
import { EcosystemPublicHeader } from '../ecosystem/EcosystemShell';
import { getLiveNavigation } from '../../lib/liveNavigation';

export default function LivePublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8F7FD] text-[#002050]">
      <EcosystemPublicHeader ecosystem="live" navigation={getLiveNavigation('public')} search={<LiveHeaderSearch />} />
      <main className="min-w-0">{children}</main>
      <PageFooter ecosystem="live" />
    </div>
  );
}
