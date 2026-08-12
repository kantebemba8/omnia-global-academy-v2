import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Navbar } from '../Navbar';
import { PageFooter } from '../PageFooter';
import { DashboardLayout } from '../DashboardLayout';
import { StructureLayout } from '../StructureLayout';
import { ModerateurLayout } from '../ModerateurLayout';
import { useAuth } from '../../hooks/useAuth';
import CommunityEcosystemNav from './CommunityEcosystemNav';
import CommunityHeaderSearch from './CommunityHeaderSearch';
import { resolveCommunityAudience, type CommunityAudience } from '../../lib/communityNavigation';

function PublicCommunityLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8FCFB] text-[#002050]">
      <Navbar />
      <div className="pt-20">
        <header className="border-b border-[#DDEBE8] bg-white">
          <div className="mx-auto flex min-h-16 max-w-[1440px] items-center gap-5 px-4 sm:px-5 lg:px-6">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-[.18em] text-[#0F766E]">Réseau d’entraide & de pratiques</p>
              <p className="mt-1 hidden text-sm text-slate-500 md:block">Questions, expériences et solutions utiles au même endroit.</p>
            </div>
            <div className="hidden w-[min(40vw,480px)] lg:block"><CommunityHeaderSearch /></div>
          </div>
        </header>
        <CommunityEcosystemNav audience="public" />
        <main className="min-w-0">{children}</main>
        <PageFooter />
      </div>
    </div>
  );
}

function GenericCommunityLayout({ audience, children }: { audience: 'apprenant' | 'professeur' | 'recruteur' | 'organisateur' | 'coach'; children: ReactNode }) {
  const subtitle = audience === 'apprenant'
    ? 'Questions, entraide et apprentissage entre pairs'
    : audience === 'professeur'
      ? 'Questions, réponses et communauté de pratique'
      : audience === 'recruteur'
        ? 'Échanges professionnels et signaux du terrain'
        : audience === 'organisateur'
          ? 'Échanges avant, pendant et après les événements'
          : 'Réflexion, entraide et continuité de l’accompagnement';
  return (
    <DashboardLayout
      role={audience}
      headerTitle="Omnia Communauté"
      headerSubtitle={subtitle}
      headerSearch={<CommunityHeaderSearch />}
      brandTitle="Omnia"
      brandAccent="Communauté"
      spaceHomePath="/forum"
      spaceHomeLabel="Retour à Omnia Communauté"
      contentClassName="bg-[#F8FCFB]"
    >
      <CommunityEcosystemNav audience={audience} />
      {children}
    </DashboardLayout>
  );
}

function CommunityAudienceLayout({ audience, children }: { audience: CommunityAudience; children: ReactNode }) {
  if (audience === 'apprenant' || audience === 'professeur' || audience === 'recruteur' || audience === 'organisateur' || audience === 'coach') {
    return <GenericCommunityLayout audience={audience}>{children}</GenericCommunityLayout>;
  }
  if (audience === 'structure') {
    return (
      <StructureLayout headerTitle="Omnia Communauté" headerSubtitle="Échanges, pratiques et apprentissage collectif" headerSearch={<CommunityHeaderSearch />}>
        <CommunityEcosystemNav audience="structure" />
        {children}
      </StructureLayout>
    );
  }
  if (audience === 'moderateur') {
    return (
      <ModerateurLayout headerTitle="Omnia Communauté" headerSubtitle="Conversations, signalements et confiance" headerSearch={<CommunityHeaderSearch />}>
        <CommunityEcosystemNav audience="moderateur" />
        {children}
      </ModerateurLayout>
    );
  }
  return <PublicCommunityLayout>{children}</PublicCommunityLayout>;
}

export default function CommunityLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-[#F8FCFB]"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#DDEBE8] border-t-[#0F766E]" /></div>;
  }
  const preview = params.get('preview') === 'true' && Boolean(user?.roles?.includes('super_admin'));
  const audience = resolveCommunityAudience(user?.roles, preview ? params.get('role') : null);
  return <CommunityAudienceLayout audience={audience === 'super_admin' ? 'public' : audience}>{children}</CommunityAudienceLayout>;
}
