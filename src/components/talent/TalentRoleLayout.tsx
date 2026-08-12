import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import SubspaceHamburgerLayout from '../SubspaceHamburgerLayout';
import { DashboardLayout } from '../DashboardLayout';
import { StructureLayout } from '../StructureLayout';
import { ModerateurLayout } from '../ModerateurLayout';
import TalentEcosystemNav from './TalentEcosystemNav';
import TalentHeaderSearch from './TalentHeaderSearch';
import { getTalentNavigation, resolveTalentAudience, type TalentAudience } from '../../lib/talentNavigation';

export function PublicTalentLayout({children}:{children:ReactNode}){
  const navItems=getTalentNavigation('public').map(item=>({label:item.label,path:item.path,icon:item.icon,exact:item.id==='accueil'}));
  return <SubspaceHamburgerLayout title="Omnia Talent" navItems={navItems} searchPath="/talent/explorer" searchParam="q" searchPlaceholder="Rechercher un talent, une compétence ou une organisation..." navigationMode="horizontal">{children}</SubspaceHamburgerLayout>;
}
function Generic({audience,children}:{audience:'apprenant'|'professeur'|'recruteur'|'organisateur'|'coach';children:ReactNode}){const subtitle=audience==='apprenant'?'Profil, compétences et opportunités':audience==='recruteur'?'Sourcing, recrutement et relations talents':audience==='professeur'?'Profils, compétences et réseau professionnel':'Profils, compétences et réseau professionnel';return <DashboardLayout role={audience} headerTitle="Omnia Talent" headerSubtitle={subtitle} headerSearch={<TalentHeaderSearch/>}><TalentEcosystemNav audience={audience}/>{children}</DashboardLayout>}
export function TalentAudienceLayout({audience,children}:{audience:TalentAudience;children:ReactNode}){
  if(audience==='apprenant'||audience==='professeur'||audience==='recruteur'||audience==='organisateur'||audience==='coach')return <Generic audience={audience}>{children}</Generic>;
  if(audience==='structure')return <StructureLayout headerTitle="Omnia Talent" headerSubtitle="Talents, recrutement et compétences" headerSearch={<TalentHeaderSearch/>}><TalentEcosystemNav audience="structure"/>{children}</StructureLayout>;
  if(audience==='moderateur')return <ModerateurLayout headerTitle="Omnia Talent" headerSubtitle="Visibilité professionnelle et confiance" headerSearch={<TalentHeaderSearch/>}><TalentEcosystemNav audience="moderateur"/>{children}</ModerateurLayout>;
  return <PublicTalentLayout>{children}</PublicTalentLayout>;
}
export function AdaptiveTalentLayout({children}:{children:ReactNode}){const{user,loading}=useAuth();const[params]=useSearchParams();if(loading)return <div className="grid min-h-screen place-items-center bg-[#FCFAFC]"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#76506F]"/></div>;const preview=params.get('preview')==='true'&&Boolean(user?.roles?.includes('super_admin'));const audience=resolveTalentAudience(user?.roles,preview?params.get('role'):null);return <TalentAudienceLayout audience={audience==='super_admin'?'public':audience}>{children}</TalentAudienceLayout>}
