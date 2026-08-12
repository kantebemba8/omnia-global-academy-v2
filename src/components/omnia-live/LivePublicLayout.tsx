import type { ReactNode } from 'react';
import { Navbar } from '../Navbar';
import LiveEcosystemNav from './LiveEcosystemNav';
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

export function LegacySuperAdminLiveLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FAFAFE] text-[#002050]">
      <Navbar />
      <div className="pt-20">
        <header className="border-b border-[#E7E6F2] bg-white">
          <div className="mx-auto flex min-h-16 max-w-[1440px] items-center gap-5 px-4 sm:px-5 lg:px-6">
            <div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-[.18em] text-[#5C55C8]">Scène d’apprentissage & d’événements</p><p className="mt-1 hidden text-sm text-slate-500 md:block">Direct, expertise, échanges et replays dans un même univers.</p></div>
            <div className="hidden w-[min(38vw,460px)] lg:block"><LiveHeaderSearch /></div>
          </div>
        </header>
        <LiveEcosystemNav audience="public" />
        <main className="min-w-0">{children}</main>
        <PageFooter ecosystem="live" />
      </div>
    </div>
  );
}
