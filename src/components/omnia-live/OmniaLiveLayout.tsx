import { ReactNode, useEffect, useMemo, useState } from 'react';
import { CalendarDays, PlayCircle, Compass, GraduationCap, Home, Info, Radio, Ticket, UserPlus, UsersRound, Video } from 'lucide-react';
import SubspaceHamburgerLayout from '../SubspaceHamburgerLayout';
import { liveApi } from '../../pages/omnia-live/liveApi';

function canProposeLive() {
  try {
    const raw = localStorage.getItem('omnia_user');
    const user = raw ? JSON.parse(raw) : null;
    const roles: string[] = user?.roles || [];
    return roles.some((r) => ['super_admin', 'professeur', 'formateur', 'responsable_structure', 'structure_admin', 'directeur'].includes(r))
      || Boolean(user?.omnia_live_organizer);
  } catch {
    return false;
  }
}

export default function OmniaLiveLayout({ children }: { children: ReactNode }) {
  const baseProposer = useMemo(() => canProposeLive(), []);
  const [verifiedOrganizer,setVerifiedOrganizer]=useState(false);
  const hasUser = useMemo(() => Boolean(localStorage.getItem('omnia_session_token')), []);
  useEffect(()=>{ if(hasUser && !baseProposer) liveApi('organizer_profile_me').then(d=>setVerifiedOrganizer(Boolean(d?.can_organize))).catch(()=>{}); },[hasUser,baseProposer]);
  const proposer = baseProposer || verifiedOrganizer;
  const nav = [
    { label: 'Accueil Live', path: '/omnia-live', icon: Home, exact: true },
    { label: 'En direct maintenant', path: '/omnia-live/en-direct', icon: Radio },
    { label: 'À venir', path: '/omnia-live/a-venir', icon: CalendarDays },
    { label: 'Explorer', path: '/omnia-live/explorer', icon: Compass },
    { label: 'Formations Live', path: '/omnia-live/formations', icon: GraduationCap },
    { label: 'Vidéos & Replays', path: '/omnia-live/videos', icon: PlayCircle },
    { label: 'Organisateurs', path: '/omnia-live/organisateurs', icon: UsersRound },
    { label: 'Mes Lives', path: '/omnia-live/mes-lives', icon: Ticket },
    ...(proposer ? [{ label: 'Proposer un Live', path: '/omnia-live/proposer', icon: Video }] : hasUser ? [{ label: 'Devenir organisateur', path: '/omnia-live/profil-organisateur', icon: UserPlus }] : []),
    { label: 'À propos', path: '/omnia-live/a-propos', icon: Info },
  ];

  return (
    <SubspaceHamburgerLayout title="Omnia Live" navItems={nav} searchPlaceholder="Rechercher un live, une formation, un expert..." profileSpaceLabel={proposer ? "Espace Organisateur" : "Mes Lives"} profileSpacePath={proposer ? "/omnia-live/organisateur" : "/omnia-live/mes-lives"}>
      {children}
    </SubspaceHamburgerLayout>
  );
}
