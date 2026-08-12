import { ArrowRight, Briefcase, Building2, GraduationCap, HeartHandshake, MessageSquare, Radio, ShieldCheck, Sparkles, Target, UsersRound, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { CareerAudience } from '../../lib/careerNavigation';

type Audience = Exclude<CareerAudience, 'public' | 'apprenant' | 'super_admin'>;

type RoleCopy = {
  eyebrow: string;
  title: string;
  text: string;
  principle: string;
  actions: Array<{ label: string; note: string; path: string; icon: LucideIcon }>;
};

const COPY: Record<Audience, RoleCopy> = {
  professeur: {
    eyebrow: 'Repères carrière pour vos apprenants',
    title: 'Relier apprentissage, preuves et projection professionnelle.',
    text: 'Career vous permet de comprendre l’expérience proposée aux apprenants et de prolonger vos formations vers des usages professionnels concrets.',
    principle: 'Une formation prend davantage de valeur quand l’apprenant sait traduire ses acquis dans son parcours professionnel.',
    actions: [
      { label: 'Voir les opportunités', note: 'Comprendre les postes et besoins visibles dans Omnia.', path: '/forum/emploi', icon: Briefcase },
      { label: 'Conseils carrière', note: 'Suivre les échanges et questions d’employabilité.', path: '/forum/carriere', icon: MessageSquare },
      { label: 'Omnia Talent', note: 'Voir comment compétences et preuves deviennent visibles.', path: '/talent', icon: UsersRound },
    ],
  },
  structure: {
    eyebrow: 'Employabilité & trajectoires',
    title: 'Voir comment les acquis deviennent des trajectoires professionnelles.',
    text: 'Career complète vos actions de formation en donnant aux membres des outils de présentation, de préparation et de candidature.',
    principle: 'L’enjeu n’est pas d’ajouter un outil RH de plus, mais de relier formation, compétences, présentation et opportunités.',
    actions: [
      { label: 'Opportunités', note: 'Consulter les opportunités visibles dans l’écosystème.', path: '/forum/emploi', icon: Briefcase },
      { label: 'Omnia Talent', note: 'Passer de la préparation à la visibilité professionnelle.', path: '/talent', icon: UsersRound },
      { label: 'Formations', note: 'Revenir aux parcours et preuves à l’origine des compétences.', path: '/formations', icon: GraduationCap },
    ],
  },
  recruteur: {
    eyebrow: 'Lecture candidat',
    title: 'Comprendre le parcours avant la candidature.',
    text: 'Career est l’espace où les candidats structurent CV, lettres, préparation et suivi. Votre activité de sourcing et de recrutement reste dans Omnia Talent.',
    principle: 'Career prépare la candidature ; Talent organise la rencontre entre profils, preuves et recruteurs.',
    actions: [
      { label: 'Omnia Talent', note: 'Rechercher, suivre et recruter les profils.', path: '/talent', icon: UsersRound },
      { label: 'Opportunités', note: 'Voir l’espace où les offres sont découvertes.', path: '/forum/emploi', icon: Briefcase },
      { label: 'Conseils carrière', note: 'Observer les sujets qui préoccupent les candidats.', path: '/forum/carriere', icon: MessageSquare },
    ],
  },
  organisateur: {
    eyebrow: 'Après l’événement',
    title: 'Transformer une rencontre en prochaine étape professionnelle.',
    text: 'Career donne aux participants des repères pour exploiter une rencontre, une masterclass ou un Live dans leur trajectoire professionnelle.',
    principle: 'Un événement peut déclencher une action : mieux se présenter, candidater, préparer un entretien ou rendre ses compétences visibles.',
    actions: [
      { label: 'Omnia Live', note: 'Retourner à la programmation et aux événements.', path: '/omnia-live', icon: Radio },
      { label: 'Opportunités', note: 'Voir les débouchés accessibles après une rencontre.', path: '/forum/emploi', icon: Briefcase },
      { label: 'Omnia Talent', note: 'Relier expertise, présence et visibilité.', path: '/talent', icon: UsersRound },
    ],
  },
  coach: {
    eyebrow: 'Passage à l’action',
    title: 'Transformer un objectif d’accompagnement en actions de carrière.',
    text: 'Career prolonge le coaching avec des outils concrets : présentation professionnelle, préparation, opportunités et suivi des démarches.',
    principle: 'Le coaching clarifie la direction ; Career aide à matérialiser les prochaines étapes.',
    actions: [
      { label: 'Omnia Coaching', note: 'Retrouver séances, offres et continuité.', path: '/coaching', icon: HeartHandshake },
      { label: 'Opportunités', note: 'Explorer les possibilités professionnelles visibles.', path: '/forum/emploi', icon: Briefcase },
      { label: 'Omnia Talent', note: 'Rendre les compétences et preuves visibles.', path: '/talent', icon: UsersRound },
    ],
  },
  moderateur: {
    eyebrow: 'Confiance & cohérence',
    title: 'Comprendre l’espace Career sans mélanger préparation et contrôle.',
    text: 'Career reste un studio de préparation pour les apprenants. Les contrôles et décisions de modération restent dans vos domaines autorisés.',
    principle: 'La navigation garde une frontière claire entre l’expérience utilisateur et les files de contrôle du Modérateur.',
    actions: [
      { label: 'Conseils carrière', note: 'Consulter les échanges publics liés aux trajectoires.', path: '/forum/carriere', icon: MessageSquare },
      { label: 'Opportunités', note: 'Voir les offres accessibles aux utilisateurs.', path: '/forum/emploi', icon: Briefcase },
      { label: 'Centre de confiance', note: 'Revenir aux domaines de contrôle qui vous sont attribués.', path: '/home', icon: ShieldCheck },
    ],
  },
};

export default function CareerConnectedLanding({ audience }: { audience: Audience }) {
  const copy = COPY[audience];
  return (
    <main className="min-h-full bg-[#F5F7FD] text-slate-900">
      <section className="relative overflow-hidden border-b border-[#D8E0F4] bg-[#071D38] px-5 py-12 text-white md:px-8 lg:py-16">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true"><div className="absolute -right-28 -top-32 h-96 w-96 rounded-full border border-[#3E63B8]/20"/><div className="absolute right-16 top-16 h-48 w-48 rounded-full border border-white/10"/><div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-[#3E63B8]/50 to-transparent"/></div>
        <div className="relative mx-auto grid max-w-[1220px] gap-10 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
          <div><p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[.17em] text-[#6F8DD3]"><Sparkles size={15}/>{copy.eyebrow}</p><h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.03] tracking-[-.045em] md:text-5xl">{copy.title}</h1><p className="mt-5 max-w-2xl text-base leading-8 text-white/68">{copy.text}</p></div>
          <div className="relative rounded-[28px] border border-white/12 bg-white/[.06] p-6 shadow-2xl backdrop-blur"><div className="flex items-center justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#3E63B8] text-[#071D38]"><Target size={20}/></span><span className="text-[10px] font-black uppercase tracking-[.16em] text-white/45">Rôle · {audience}</span></div><p className="mt-8 text-sm font-black uppercase tracking-[.14em] text-[#6F8DD3]">Principe</p><p className="mt-3 text-xl font-black leading-8 text-white">{copy.principle}</p></div>
        </div>
      </section>
      <section className="mx-auto max-w-[1220px] px-5 py-12 md:px-8"><div className="mb-6"><p className="text-[11px] font-black uppercase tracking-[.15em] text-[#3E63B8]">Continuer dans Omnia</p><h2 className="mt-2 text-2xl font-black tracking-[-.03em] text-[#002050]">Ouvrir la bonne destination sans recréer un espace de gestion parallèle.</h2></div><div className="divide-y divide-[#D8E0F4] border-y border-[#D8E0F4] bg-[#FEFEFF]">{copy.actions.map(item=>{const Icon=item.icon;return <Link key={item.label} to={item.path} className="group grid gap-4 px-5 py-5 sm:grid-cols-[44px_1fr_auto] sm:items-center"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E9EEFB] text-[#2D4E94]"><Icon size={18}/></span><span><strong className="block text-sm font-black text-[#002050]">{item.label}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{item.note}</span></span><ArrowRight size={16} className="text-[#3E63B8] transition group-hover:translate-x-1"/></Link>})}</div></section>
    </main>
  );
}
