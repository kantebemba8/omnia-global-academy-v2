import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '../DashboardLayout';
import { StructureLayout } from '../StructureLayout';
import { ModerateurLayout } from '../ModerateurLayout';
import { useAuth } from '../../hooks/useAuth';
import LiveEcosystemNav from './LiveEcosystemNav';
import LiveHeaderSearch from './LiveHeaderSearch';
import LivePublicLayout from './LivePublicLayout';
import { resolveLiveAudience, type LiveAudience } from '../../lib/liveNavigation';

export function LiveAudienceLayout({audience,children}:{audience:LiveAudience;children:ReactNode}){
 if(audience==='public'||audience==='super_admin')return <LivePublicLayout>{children}</LivePublicLayout>;
 if(audience==='structure')return <StructureLayout headerTitle="Omnia Live" headerSubtitle="Événements, apprentissage synchrone et activité de votre Structure" headerSearch={<LiveHeaderSearch/>}><LiveEcosystemNav audience="structure"/>{children}</StructureLayout>;
 if(audience==='moderateur')return <ModerateurLayout headerTitle="Omnia Live" headerSubtitle="Programmation publique et confiance" headerSearch={<LiveHeaderSearch/>}><LiveEcosystemNav audience="moderateur"/>{children}</ModerateurLayout>;
 const role=audience as 'apprenant'|'professeur'|'recruteur'|'organisateur'|'coach';
 const subtitle=audience==='organisateur'?'Programmation, audience et production':audience==='professeur'?'Partager une expertise en direct':audience==='recruteur'?'Événements, experts et rencontres professionnelles':audience==='coach'?'Rencontres, expertise et apprentissage en direct':'Vos sessions, replays et rendez-vous Live';
 return <DashboardLayout role={role} headerTitle="Omnia Live" headerSubtitle={subtitle} headerSearch={<LiveHeaderSearch/>} brandTitle="Omnia" brandAccent="Live" spaceHomePath="/omnia-live" spaceHomeLabel="Retour à Omnia Live" contentClassName="bg-[#FAFAFE]"><LiveEcosystemNav audience={audience}/>{children}</DashboardLayout>
}

export default function OmniaLiveLayout({children}:{children:ReactNode}){
 const{user,loading}=useAuth();const[params]=useSearchParams();
 if(loading)return <div className="grid min-h-screen place-items-center bg-[#FAFAFE]"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E7E6F2] border-t-[#5C55C8]"/></div>;
 const preview=params.get('preview')==='true'&&Boolean(user?.roles?.includes('super_admin'));const audience=resolveLiveAudience(user?.roles,preview?params.get('role'):null);
 return <LiveAudienceLayout audience={audience}>{children}</LiveAudienceLayout>
}
