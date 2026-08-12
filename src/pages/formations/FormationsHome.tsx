import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Compass,
  FileCheck2,
  GraduationCap,
  Layers3,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ENDPOINTS } from '../../lib/config';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { getSessionToken } from '../../lib/session';
import { CourseCard, type CourseCardData } from '../../components/CourseCard';
import {
  LearnerFormationsLayout,
  ModeratorFormationsLayout,
  ProfessorFormationsLayout,
  PublicFormationsLayout,
  StructureFormationsLayout,
} from '../../components/formations/FormationsRoleLayout';
import { resolveFormationsAudience, type FormationsAudience } from '../../lib/formationsNavigation';

const BLUE = '#002050';
const GOLD = '#BF8813';
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

type LearnerData = {
  kpis?: { formations_en_cours?: number; formations_terminees?: number; certificats_obtenus?: number };
  courses_en_cours?: Array<{ course_id: string; title: string; slug: string; progress_percent?: number; lessons_completed?: number; lessons_total?: number }>;
  cours_termines?: Array<{ course_id: string; title: string }>;
};
type LearnerCourse = NonNullable<LearnerData['courses_en_cours']>[number];
type ProfessorData = {
  formations?: Array<{ id: string; title: string; status: string; total_students?: number; projets_a_corriger?: number }>;
  kpis?: { total_eleves?: number; note_globale?: number };
};
type StructureData = { stats?: { members?: number; courses?: number }; structure?: { display_name?: string; name?: string } | null };
type ModeratorData = { courses?: Array<{ id: string; title?: string; status?: string }>; items?: Array<{ id: string; title?: string; status?: string }> };

type PrivateData = LearnerData | ProfessorData | StructureData | ModeratorData | null;

type Signal = { label: string; value: string | number; icon: LucideIcon; accent: string };

function previewPath(path: string, preview: boolean, audience: FormationsAudience) {
  if (!preview) return path;
  const [base, hash = ''] = path.split('#', 2);
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}preview=true&role=${audience}${hash ? `#${hash}` : ''}`;
}

function Frame({ audience, children }: { audience: FormationsAudience; children: ReactNode }) {
  if (audience === 'apprenant') return <LearnerFormationsLayout>{children}</LearnerFormationsLayout>;
  if (audience === 'professeur') return <ProfessorFormationsLayout>{children}</ProfessorFormationsLayout>;
  if (audience === 'structure') return <StructureFormationsLayout>{children}</StructureFormationsLayout>;
  if (audience === 'moderateur') return <ModeratorFormationsLayout>{children}</ModeratorFormationsLayout>;
  return <PublicFormationsLayout audience={audience}>{children}</PublicFormationsLayout>;
}

function LearningMapVisual({ course }: { course?: LearnerCourse }) {
  const progress = Math.max(0, Math.min(100, Number(course?.progress_percent || 0)));
  return (
    <div className="relative mx-auto h-[330px] w-full max-w-[520px]" aria-label="Parcours d’apprentissage">
      <svg viewBox="0 0 520 330" className="absolute inset-0 h-full w-full" fill="none" aria-hidden="true">
        <path d="M78 245 C130 196 154 196 210 160 C270 121 307 91 446 82" stroke="#B8D7E5" strokeWidth="13" strokeLinecap="round" />
        <path d="M78 245 C130 196 154 196 210 160 C270 121 307 91 446 82" stroke="#0F7699" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${Math.max(16, progress * 4.6)} 520`} />
        <circle cx="78" cy="245" r="18" fill="#fff" stroke="#0F7699" strokeWidth="4"/><circle cx="210" cy="160" r="18" fill="#fff" stroke="#BF8813" strokeWidth="4"/><circle cx="446" cy="82" r="18" fill="#fff" stroke="#002050" strokeWidth="4"/>
      </svg>
      <div className="absolute left-3 top-[268px] rounded-xl bg-white px-4 py-3 shadow-[0_15px_35px_rgba(0,32,80,.10)]"><span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Départ</span><strong className="block text-sm text-[#002050]">Inscription</strong></div>
      <div className="absolute left-[155px] top-[184px] max-w-[190px] rounded-2xl border border-white bg-white/95 p-4 shadow-[0_18px_45px_rgba(0,32,80,.12)]"><span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#0F7699]">En cours</span><strong className="mt-1 block line-clamp-2 text-sm text-[#002050]">{course?.title || 'Votre prochaine formation'}</strong><span className="mt-2 block text-xs font-black text-[#0F7699]">{course ? `${progress}% complété` : 'À choisir'}</span></div>
      <div className="absolute right-0 top-4 rounded-2xl bg-[#002050] p-4 text-white shadow-[0_20px_45px_rgba(0,32,80,.18)]"><Award size={19} className="text-[#F3C96B]"/><strong className="mt-2 block text-sm">Preuve acquise</strong><span className="mt-1 block text-xs text-white/55">Certificat · badge · compétence</span></div>
    </div>
  );
}

function BlueprintVisual({ formations = [] }: { formations?: ProfessorData['formations'] }) {
  const focus = formations?.[0];
  return (
    <div className="relative mx-auto w-full max-w-[540px] rounded-[28px] border border-[#D9DDF5] bg-[#F7F7FE] p-5 shadow-[0_28px_70px_rgba(35,49,120,.12)]">
      <div className="flex items-center justify-between border-b border-[#DDE1F3] pb-4"><div><span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5966C5]">Blueprint pédagogique</span><strong className="mt-1 block max-w-[310px] truncate text-sm text-[#002050]">{focus?.title || 'Nouvelle formation'}</strong></div><span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-[#5966C5]">Studio</span></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-[0.8fr_1.2fr]"><div className="space-y-2">{['Objectifs', 'Modules', 'Évaluations', 'Certification'].map((label, index)=><div key={label} className="flex items-center gap-3 rounded-xl bg-white px-3 py-3 shadow-sm"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EEF0FF] text-xs font-black text-[#5966C5]">{index+1}</span><span className="text-xs font-bold text-[#002050]">{label}</span></div>)}</div><div className="rounded-2xl bg-[#101B4B] p-4 text-white"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#AEB7F7]">Qualité du parcours</p><div className="mt-5 space-y-4">{[['Structure',82],['Clarté',74],['Évaluation',68]].map(([label,value])=><div key={String(label)}><div className="flex justify-between text-xs"><span>{label}</span><strong>{value}%</strong></div><div className="mt-1.5 h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full bg-[#BF8813]" style={{width:`${value}%`}}/></div></div>)}</div></div></div>
    </div>
  );
}

function CampusVisual({ data }: { data?: StructureData | null }) {
  const stats = data?.stats || {};
  return (
    <div className="relative mx-auto h-[340px] w-full max-w-[540px]" aria-label="Campus organisationnel">
      <svg viewBox="0 0 540 340" className="absolute inset-0 h-full w-full" fill="none" aria-hidden="true"><path d="M270 170 L100 80 M270 170 L445 77 M270 170 L95 275 M270 170 L445 270" stroke="#87B9B3" strokeWidth="2" strokeDasharray="7 9"/></svg>
      <div className="absolute left-1/2 top-1/2 flex h-36 w-36 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-[34px] border border-white bg-white shadow-[0_26px_60px_rgba(0,60,70,.13)]"><GraduationCap size={28} className="text-[#0B817A]"/><strong className="mt-3 text-sm text-[#002050]">Campus Formation</strong><span className="mt-1 text-xs text-slate-400">{Number(stats.courses || 0)} parcours</span></div>
      {[
        {x:'2%',y:'9%',label:'Membres',value:Number(stats.members||0),icon:Users},
        {x:'73%',y:'8%',label:'Programmes',value:Number(stats.courses||0),icon:BookOpen},
        {x:'1%',y:'70%',label:'Évaluation',value:'Suivi',icon:ClipboardCheck},
        {x:'74%',y:'68%',label:'Preuves',value:'Traçables',icon:FileCheck2},
      ].map(item=>{const Icon=item.icon;return <div key={item.label} className="absolute min-w-[132px] rounded-2xl border border-[#D7E9E7] bg-white p-4 shadow-[0_15px_36px_rgba(0,60,70,.09)]" style={{left:item.x,top:item.y}}><Icon size={17} className="text-[#0B817A]"/><span className="mt-2 block text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{item.label}</span><strong className="text-base text-[#002050]">{item.value}</strong></div>})}
    </div>
  );
}

function ReviewVisual({ count }: { count: number }) {
  return (
    <div className="mx-auto w-full max-w-[520px] rounded-[26px] bg-[#162C48] p-5 text-white shadow-[0_30px_70px_rgba(0,32,80,.20)]">
      <div className="flex items-center justify-between"><div><span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#9FC1DB]">Contrôle pédagogique</span><strong className="mt-1 block text-lg">File de revue</strong></div><span className="rounded-xl bg-[#F1B65A] px-3 py-2 text-sm font-black text-[#3A2A0B]">{count}</span></div>
      <div className="mt-5 space-y-2">{['Contenu pédagogique', 'Évaluation & cohérence', 'Prix & transmission'].map((label,index)=><div key={label} className="flex items-center gap-3 rounded-xl bg-white/[.07] px-4 py-3"><span className={`h-2.5 w-2.5 rounded-full ${index===0?'bg-[#F1B65A]':index===1?'bg-[#79B9DB]':'bg-[#79C9A7]'}`}/><span className="flex-1 text-sm font-semibold">{label}</span><ShieldCheck size={15} className="text-white/40"/></div>)}</div>
    </div>
  );
}

function PublicVisual() {
  return (
    <div className="relative mx-auto h-[340px] w-full max-w-[560px]" aria-label="Architecture d’un parcours de formation">
      <div className="absolute left-6 top-20 w-[72%] rotate-[-4deg] rounded-[28px] border border-[#C8D6E5] bg-white p-5 shadow-[0_25px_60px_rgba(0,32,80,.13)]"><span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#0F7699]">01 · Comprendre</span><div className="mt-4 h-2 w-4/5 rounded-full bg-[#D9EDF4]"/><div className="mt-2 h-2 w-3/5 rounded-full bg-[#E7EEF5]"/></div>
      <div className="absolute left-[19%] top-[112px] w-[72%] rotate-[2deg] rounded-[28px] border border-[#ECDDB7] bg-[#FFFCF4] p-5 shadow-[0_25px_60px_rgba(0,32,80,.11)]"><span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#A56B12]">02 · Pratiquer</span><div className="mt-4 grid grid-cols-3 gap-2">{[1,2,3].map(n=><div key={n} className="h-12 rounded-xl border border-[#EEE1C4] bg-white"/>)}</div></div>
      <div className="absolute bottom-4 right-2 w-[70%] rotate-[-1deg] rounded-[28px] bg-[#002050] p-5 text-white shadow-[0_28px_65px_rgba(0,32,80,.20)]"><span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#F0C568]">03 · Prouver</span><div className="mt-4 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10"><Award size={20}/></span><div><strong className="block text-sm">Compétence vérifiable</strong><span className="text-xs text-white/45">Progression → évaluation → preuve</span></div></div></div>
    </div>
  );
}

function RecruiterSkillVisual() {
  return <div className="mx-auto w-full max-w-[520px] rounded-[28px] border border-[#E0D8E8] bg-white p-5 shadow-[0_26px_70px_rgba(61,34,83,.12)]"><div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#7E4D83]">Lecture compétences</p><strong className="mt-1 block text-sm text-[#002050]">Formation → signal → métier</strong></div><Search size={20} className="text-[#BF8813]"/></div><div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3"><div className="space-y-2">{['Communication','Digital','Management'].map((label,index)=><div key={label} className="rounded-xl bg-[#F8F5FA] px-3 py-3 text-xs font-bold text-[#5E4265]"><span className="mr-2 text-[#BF8813]">0{index+1}</span>{label}</div>)}</div><ArrowRight size={18} className="text-slate-300"/><div className="rounded-2xl bg-[#002050] p-4 text-white"><p className="text-[10px] font-black uppercase tracking-[.12em] text-white/45">Repère Talent</p><strong className="mt-2 block text-sm">Compétences observables</strong><div className="mt-4 flex flex-wrap gap-1.5">{['Parcours','Niveau','Preuve'].map(x=><span key={x} className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-[#F0C568]">{x}</span>)}</div></div></div></div>;
}

function OrganizerKnowledgeVisual() {
  return <div className="relative mx-auto h-[330px] w-full max-w-[520px]"><div className="absolute inset-x-8 top-5 rounded-[24px] bg-[#101B4B] p-5 text-white shadow-[0_24px_55px_rgba(16,27,75,.18)]"><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#AEB7F7]">Thématique Live</p><strong className="mt-2 block text-lg">Identifier les savoirs qui nourrissent une session</strong></div><div className="absolute bottom-8 left-0 w-[58%] rounded-[22px] border border-[#DDE1F3] bg-white p-4 shadow-[0_18px_42px_rgba(0,32,80,.10)]"><Clock3 size={18} className="text-[#5966C5]"/><p className="mt-3 text-xs font-black text-[#002050]">Parcours de référence</p><div className="mt-3 h-1.5 rounded-full bg-slate-100"><div className="h-full w-3/4 rounded-full bg-[#5966C5]"/></div></div><div className="absolute bottom-0 right-0 w-[52%] rounded-[22px] border border-[#ECDDB7] bg-[#FFFCF4] p-4 shadow-[0_18px_42px_rgba(0,32,80,.09)]"><Sparkles size={18} className="text-[#BF8813]"/><p className="mt-3 text-xs font-black text-[#002050]">Expertise à mettre en scène</p><p className="mt-1 text-[11px] leading-5 text-slate-500">Formation, expert et événement restent des objets distincts.</p></div></div>;
}

function CoachLearningPlanVisual() {
  return <div className="mx-auto w-full max-w-[520px] rounded-[30px] border border-[#D2E7E2] bg-[#F7FCFB] p-6 shadow-[0_25px_65px_rgba(4,78,69,.11)]"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#DFF2ED] text-[#0B817A]"><Target size={20}/></span><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#0B817A]">Plan d’accompagnement</p><strong className="text-sm text-[#002050]">Objectif → ressource → mise en pratique</strong></div></div><div className="mt-6 space-y-3">{[{n:'01',label:'Clarifier l’objectif',w:'36%'},{n:'02',label:'Associer une formation',w:'68%'},{n:'03',label:'Mettre en pratique',w:'88%'}].map(item=><div key={item.n} className="rounded-2xl bg-white p-4 ring-1 ring-[#E0EEEB]"><div className="flex items-center gap-3"><span className="font-black text-[#BF8813]">{item.n}</span><strong className="text-xs text-[#002050]">{item.label}</strong></div><div className="mt-3 h-1.5 rounded-full bg-[#EDF4F2]"><div className="h-full rounded-full bg-[#0B817A]" style={{width:item.w}}/></div></div>)}</div></div>;
}

function heroCopy(audience: FormationsAudience, privateData: PrivateData) {
  if (audience === 'apprenant') {
    const data = privateData as LearnerData | null;
    const current = data?.courses_en_cours?.[0];
    return { eyebrow: 'Votre apprentissage', title: current ? 'Reprenez là où votre progression devient concrète.' : 'Construisez un parcours qui mène à une preuve.', text: current ? `${current.title} est votre point de reprise actuel. L’écosystème Formations relie cours, évaluations et preuves sans disperser votre parcours.` : 'Explorez les formations, progressez module par module et rassemblez vos preuves dans un même univers.', primary: current ? `/cours/${current.slug}/apprendre` : '/catalogue', primaryLabel: current ? 'Continuer la formation' : 'Explorer le catalogue', secondary: '/formations/apprentissage', secondaryLabel: 'Mon apprentissage' };
  }
  if (audience === 'professeur') return { eyebrow: 'Atelier pédagogique', title: 'Concevoir une formation comme un parcours, pas comme une suite de pages.', text: 'Retrouvez votre portfolio, la création, les évaluations et le suivi dans un environnement dédié à la pédagogie.', primary: '/formations/conception', primaryLabel: 'Ouvrir la conception', secondary: '/formations/evaluations', secondaryLabel: 'Gérer les évaluations' };
  if (audience === 'structure') return { eyebrow: 'Campus organisationnel', title: 'Piloter la formation comme un actif de votre organisation.', text: 'Centralisez les parcours créés par la Structure, leurs évaluations et leur évolution sans mélanger ces opérations avec le reste de la gestion RH.', primary: '/formations/conception', primaryLabel: 'Voir les formations', secondary: '/formations/evaluations', secondaryLabel: 'Évaluations & jurys' };
  if (audience === 'moderateur') return { eyebrow: 'Contrôle pédagogique', title: 'Examiner la qualité sans perdre le contexte de la formation.', text: 'Votre espace Formations isole les soumissions à contrôler et conserve uniquement les actions permises par votre mission.', primary: '/formations/controle', primaryLabel: 'Ouvrir le contrôle', secondary: '/moderator/missions', secondaryLabel: 'Centre de missions' };
  if (audience === 'recruteur') return { eyebrow: 'Compétences & employabilité', title: 'Lire les formations comme des signaux de compétences.', text: 'Explorez le catalogue pour mieux comprendre les domaines, parcours et compétences qui peuvent nourrir l’écosystème Talent.', primary: '/catalogue', primaryLabel: 'Explorer les formations', secondary: '/talent', secondaryLabel: 'Retour à Talent' };
  if (audience === 'organisateur') return { eyebrow: 'Savoirs & événements', title: 'Relier expertise, formation et expérience Live.', text: 'Explorez les parcours publiés et utilisez-les comme repères pour comprendre les thématiques et compétences présentes dans Omnia.', primary: '/catalogue', primaryLabel: 'Explorer les formations', secondary: '/omnia-live', secondaryLabel: 'Retour à Omnia Live' };
  if (audience === 'coach') return { eyebrow: 'Développement professionnel', title: 'Transformer un objectif d’accompagnement en parcours d’apprentissage.', text: 'Le catalogue vous permet d’identifier des ressources de formation complémentaires aux objectifs travaillés en coaching.', primary: '/catalogue', primaryLabel: 'Explorer les formations', secondary: '/coaching', secondaryLabel: 'Retour au Coaching' };
  return { eyebrow: 'Formations Omnia', title: 'Apprendre, pratiquer, évaluer et prouver dans un même parcours.', text: 'Une expérience de formation professionnelle où le catalogue n’est que le début : chaque parcours peut mener vers une évaluation, une preuve et une progression visible.', primary: '/catalogue', primaryLabel: 'Explorer les formations', secondary: '/inscription', secondaryLabel: 'Créer un compte' };
}

function Hero({ audience, privateData, preview }: { audience: FormationsAudience; privateData: PrivateData; preview: boolean }) {
  const copy = heroCopy(audience, privateData);
  const professor = privateData as ProfessorData | null;
  const structure = privateData as StructureData | null;
  const moderator = privateData as ModeratorData | null;
  const moderatorCount = moderator ? (moderator.courses?.length ?? moderator.items?.length ?? 0) : 0;
  const bg = audience === 'professeur' ? 'bg-[linear-gradient(135deg,#F6F7FF_0%,#ECEFFD_56%,#FFF9EC_100%)]' : audience === 'structure' ? 'bg-[linear-gradient(135deg,#F2FBF9_0%,#E9F6F5_55%,#FFF9EC_100%)]' : audience === 'moderateur' ? 'bg-[linear-gradient(135deg,#EDF3F8_0%,#E8EEF5_55%,#FFF6E8_100%)]' : audience === 'apprenant' ? 'bg-[linear-gradient(135deg,#F2FAFC_0%,#E8F5F9_55%,#FFF9EC_100%)]' : 'bg-[linear-gradient(135deg,#F7F9FC_0%,#EEF4F8_55%,#FFF9EC_100%)]';
  return <section className={`relative overflow-hidden border-b border-slate-200 ${bg}`}><div className="pointer-events-none absolute inset-0 opacity-60" aria-hidden="true"><div className="absolute -left-28 top-[-150px] h-[400px] w-[400px] rounded-full border border-[#002050]/10"/><div className="absolute right-[-120px] top-[-90px] h-[360px] w-[360px] rounded-full border border-[#BF8813]/15"/></div><div className="relative mx-auto grid min-h-[520px] max-w-7xl gap-12 px-5 py-14 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:px-8 lg:py-16"><div><span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-[#245D7A] shadow-sm"><GraduationCap size={14}/>{copy.eyebrow}</span><h1 className="mt-5 max-w-[720px] text-4xl font-black leading-[1.02] tracking-[-0.05em] text-[#002050] sm:text-5xl lg:text-[3.65rem]">{copy.title}</h1><p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">{copy.text}</p><div className="mt-8 flex flex-wrap gap-3"><Link to={previewPath(copy.primary, preview, audience)} className="inline-flex items-center gap-2 rounded-xl bg-[#002050] px-5 py-3 text-sm font-black text-white shadow-sm">{copy.primaryLabel}<ArrowRight size={15}/></Link><Link to={previewPath(copy.secondary, preview, audience)} className="inline-flex items-center gap-2 rounded-xl border border-[#C9D4E1] bg-white/85 px-5 py-3 text-sm font-black text-[#002050]">{copy.secondaryLabel}</Link></div></div><div>{audience === 'apprenant' ? <LearningMapVisual course={(privateData as LearnerData | null)?.courses_en_cours?.[0]} /> : audience === 'professeur' ? <BlueprintVisual formations={professor?.formations} /> : audience === 'structure' ? <CampusVisual data={structure} /> : audience === 'moderateur' ? <ReviewVisual count={moderatorCount} /> : audience === 'recruteur' ? <RecruiterSkillVisual /> : audience === 'organisateur' ? <OrganizerKnowledgeVisual /> : audience === 'coach' ? <CoachLearningPlanVisual /> : <PublicVisual />}</div></div></section>;
}

function DynamicDigest({ audience, privateData, preview }: { audience: FormationsAudience; privateData: PrivateData; preview: boolean }) {
  const signals = useMemo<Signal[]>(() => {
    if (preview) return [];
    if (audience === 'apprenant') {
      const d = privateData as LearnerData | null;
      return [
        { label: 'En cours', value: Number(d?.kpis?.formations_en_cours ?? d?.courses_en_cours?.length ?? 0), icon: BookOpen, accent: '#0F7699' },
        { label: 'Terminées', value: Number(d?.kpis?.formations_terminees ?? d?.cours_termines?.length ?? 0), icon: CheckCircle2, accent: '#13795B' },
        { label: 'Certificats', value: Number(d?.kpis?.certificats_obtenus ?? 0), icon: Award, accent: GOLD },
      ];
    }
    if (audience === 'professeur') {
      const d = privateData as ProfessorData | null;
      const formations = d?.formations || [];
      return [
        { label: 'Formations', value: formations.length, icon: BookOpen, accent: '#5966C5' },
        { label: 'Apprenants', value: Number(d?.kpis?.total_eleves || 0), icon: Users, accent: '#13795B' },
        { label: 'À corriger', value: formations.reduce((sum,item)=>sum+Number(item.projets_a_corriger||0),0), icon: ClipboardCheck, accent: '#C45B24' },
      ];
    }
    if (audience === 'structure') {
      const d = privateData as StructureData | null;
      return [
        { label: 'Formations', value: Number(d?.stats?.courses || 0), icon: BookOpen, accent: '#0B817A' },
        { label: 'Membres', value: Number(d?.stats?.members || 0), icon: Users, accent: '#245D9B' },
        { label: 'Évaluation', value: 'Centralisée', icon: ClipboardCheck, accent: GOLD },
      ];
    }
    if (audience === 'moderateur') {
      const d = privateData as ModeratorData | null;
      const count = d?.courses?.length ?? d?.items?.length ?? 0;
      return [
        { label: 'À examiner', value: count, icon: ShieldCheck, accent: '#315B8A' },
        { label: 'Objectif', value: 'Qualité', icon: Target, accent: '#C78A2E' },
        { label: 'Traçabilité', value: 'Active', icon: FileCheck2, accent: '#13795B' },
      ];
    }
    return [];
  }, [audience, privateData, preview]);

  if (!signals.length) return null;
  return <section className="border-b border-slate-200 bg-white"><div className="mx-auto grid max-w-7xl divide-y divide-slate-100 px-5 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6 lg:px-8">{signals.map(item=>{const Icon=item.icon;return <div key={item.label} className="flex items-center gap-4 py-6 sm:px-6 first:pl-0"><span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{background:`${item.accent}12`,color:item.accent}}><Icon size={19}/></span><div><span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{item.label}</span><strong className="block text-2xl font-black tracking-[-0.03em] text-[#002050]">{item.value}</strong></div></div>})}</div></section>;
}

function EcosystemPrinciples({ audience }: { audience: FormationsAudience }) {
  const items = audience === 'professeur' ? [
    { icon: Layers3, title: 'Concevoir', text: 'Structurer objectifs, modules et contenus sans quitter le fil pédagogique.' },
    { icon: ClipboardCheck, title: 'Évaluer', text: 'Programmer les évaluations et traiter les corrections depuis leur espace dédié.' },
    { icon: BarChart3, title: 'Suivre', text: 'Lire progression, certificats et activité après publication.' },
  ] : audience === 'structure' ? [
    { icon: BookOpen, title: 'Porter', text: 'Créer et gouverner les parcours appartenant à la Structure.' },
    { icon: Users, title: 'Organiser', text: 'Relier formation, membres et dispositif d’évaluation.' },
    { icon: FileCheck2, title: 'Tracer', text: 'Conserver des preuves et statuts vérifiables tout au long du cycle.' },
  ] : audience === 'moderateur' ? [
    { icon: ShieldCheck, title: 'Examiner', text: 'Ouvrir uniquement les formations qui entrent dans votre périmètre.' },
    { icon: ClipboardCheck, title: 'Décider', text: 'Appliquer les actions autorisées sans publier directement.' },
    { icon: FileCheck2, title: 'Tracer', text: 'Garder le contexte et la décision attachés au dossier pédagogique.' },
  ] : audience === 'recruteur' ? [
    { icon: Search, title: 'Comprendre', text: 'Lire les parcours comme un contexte de compétences et de niveau.' },
    { icon: Target, title: 'Relier', text: 'Faire le lien avec les métiers et profils recherchés dans Talent.' },
    { icon: Award, title: 'Vérifier', text: 'Repérer les preuves de progression sans transformer Formations en ATS.' },
  ] : audience === 'organisateur' ? [
    { icon: Compass, title: 'Explorer', text: 'Identifier les thématiques et expertises présentes dans Omnia.' },
    { icon: Sparkles, title: 'Contextualiser', text: 'Utiliser une formation comme repère éditorial pour préparer un Live.' },
    { icon: Clock3, title: 'Prolonger', text: 'Garder la session événementielle dans Live et l’apprentissage dans Formations.' },
  ] : audience === 'coach' ? [
    { icon: Target, title: 'Clarifier', text: 'Relier un objectif d’accompagnement à un besoin d’apprentissage.' },
    { icon: BookOpen, title: 'Compléter', text: 'Identifier une ressource de formation utile au parcours du coaché.' },
    { icon: CheckCircle2, title: 'Mettre en pratique', text: 'Faire de la formation un support, sans remplacer la séance de coaching.' },
  ] : [
    { icon: Compass, title: 'Choisir', text: 'Trouver un parcours adapté à votre objectif professionnel.' },
    { icon: BookOpen, title: 'Progresser', text: 'Avancer dans des modules, leçons et évaluations structurés.' },
    { icon: Award, title: 'Prouver', text: 'Transformer les acquis en certificats, badges et preuves de compétences.' },
  ];
  const heading = audience === 'public' ? 'Du catalogue à la preuve de compétence.' : audience === 'apprenant' ? 'Votre parcours garde un fil unique de l’inscription à la preuve.' : 'Des fonctions organisées selon votre rôle dans l’écosystème.';
  return <section className="bg-[#F8FAFC]"><div className="mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:px-8"><div className="max-w-2xl"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#BF8813]">Architecture Formations</p><h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#002050]">{heading}</h2></div><div className="mt-8 grid gap-4 md:grid-cols-3">{items.map((item,index)=>{const Icon=item.icon;return <div key={item.title} className="relative overflow-hidden rounded-[24px] border border-slate-200 bg-white p-6"><span className="absolute right-4 top-2 text-5xl font-black text-slate-50">0{index+1}</span><Icon size={21} className="relative text-[#245D7A]"/><h3 className="relative mt-5 text-lg font-black text-[#002050]">{item.title}</h3><p className="relative mt-2 text-sm leading-6 text-slate-500">{item.text}</p></div>})}</div></div></section>;
}

function FeaturedCourses({ courses }: { courses: CourseCardData[] }) {
  if (!courses.length) return null;
  return <section className="bg-white"><div className="mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:px-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#0F7699]">À explorer</p><h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#002050]">Formations disponibles</h2></div><Link to="/catalogue" className="inline-flex items-center gap-2 text-sm font-black text-[#002050]">Voir le catalogue<ArrowRight size={15}/></Link></div><div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{courses.slice(0,6).map(course=><CourseCard key={course.id} course={course}/>)}</div></div></section>;
}

export default function FormationsHome() {
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedRole = searchParams.get('role');
  const preview = searchParams.get('preview') === 'true' && Boolean(user?.roles?.includes('super_admin'));
  const audience = resolveFormationsAudience(user?.roles, preview ? requestedRole : null);
  const [privateData, setPrivateData] = useState<PrivateData>(null);
  const [featured, setFeatured] = useState<CourseCardData[]>([]);

  useEffect(() => {
    let active = true;
    const url = new URL(ENDPOINTS.catalogueList);
    url.searchParams.set('limit', '6');
    url.searchParams.set('tri', 'popularite');
    fetch(url.toString(), { headers: { Authorization: `Bearer ${ANON_KEY}` } })
      .then(response => response.json())
      .then(payload => { if (active) setFeatured(Array.isArray(payload?.courses) ? payload.courses : []); })
      .catch(() => { if (active) setFeatured([]); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user || preview || !['apprenant','professeur','structure','moderateur'].includes(audience)) { setPrivateData(null); return; }
    let active = true;
    async function load() {
      try {
        if (audience === 'apprenant') {
          const response = await fetch(ENDPOINTS.dashboardApprenant, { headers: edgeAuthHeaders() });
          if (!response.ok) throw new Error('learner');
          if (active) setPrivateData(await response.json());
          return;
        }
        if (audience === 'professeur') {
          const response = await fetch(ENDPOINTS.dashboardProfesseur, { headers: edgeAuthHeaders() });
          if (!response.ok) throw new Error('professor');
          if (active) setPrivateData(await response.json());
          return;
        }
        if (audience === 'structure') {
          const sessionToken = getSessionToken() || '';
          if (!sessionToken) return;
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/studio-unified`, { method:'POST', headers: edgeAuthHeaders(), body: JSON.stringify({ action:'structure_dashboard', session_token: sessionToken }) });
          const payload = await response.json();
          if (!response.ok || payload?.success === false) throw new Error('structure');
          if (active) setPrivateData(payload);
          return;
        }
        if (audience === 'moderateur') {
          const response = await fetch(ENDPOINTS.moderatorCourseAction, { headers: edgeAuthHeaders() });
          if (!response.ok) throw new Error('moderator');
          if (active) setPrivateData(await response.json());
        }
      } catch { if (active) setPrivateData(null); }
    }
    void load();
    return () => { active = false; };
  }, [audience, preview, user]);

  if (authLoading) return <div className="grid min-h-screen place-items-center bg-white"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#002050]"/></div>;
  if (audience === 'super_admin' && !preview) return <Navigate to="/admin/courses" replace />;

  return <Frame audience={audience}><Hero audience={audience} privateData={privateData} preview={preview}/><DynamicDigest audience={audience} privateData={privateData} preview={preview}/><EcosystemPrinciples audience={audience}/><FeaturedCourses courses={featured}/></Frame>;
}
