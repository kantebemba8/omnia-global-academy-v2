import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  FileBadge2,
  GraduationCap,
  Video,
  Network,
  Search,
  ShieldCheck,
  Target,
  Users,
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { PageFooter } from '../components/PageFooter';
import { getPublicSiteSettings } from '../lib/siteSettingsCache';
import {
  createDefaultLandingPage,
  normalizeLandingPage,
  type AudiencePageConfig,
  type AudiencePageKey,
  type LandingContentItem,
  type LandingPageConfig,
  type MobileAppItem,
  type SocialNetworkItem,
} from '../types/landingCms';

type Settings = {
  social_networks_v2?: SocialNetworkItem[];
  mobile_apps_v2?: MobileAppItem[];
  landing_page?: LandingPageConfig | unknown;
  public_partners?: Array<{ id: string; name: string; logo_url?: string | null; website_url?: string | null; alt_text?: string | null; show_footer?: boolean }>;
};

const ICONS = [GraduationCap, BookOpen, Target, FileBadge2, Video, Briefcase, Users, ShieldCheck, BarChart3, Network];

function ordered(items: LandingContentItem[]) {
  return [...items]
    .filter(item => item.enabled !== false && (item.title.trim() || item.description.trim() || item.label.trim()))
    .sort((a, b) => a.order - b.order);
}

function Cta({ item, dark = false }: { item: LandingContentItem; dark?: boolean }) {
  if (!item.action_url || !item.action_label) return null;
  return (
    <Link
      to={item.action_url}
      className={`mt-4 inline-flex items-center gap-1.5 text-sm font-bold ${dark ? 'text-[#F1C35E]' : 'text-[#002050]'} hover:underline`}
    >
      {item.action_label}<ArrowRight size={14} />
    </Link>
  );
}

function HeroActions({ page, inverse = false }: { page: AudiencePageConfig; inverse?: boolean }) {
  return (
    <div className="mt-7 flex flex-wrap gap-3">
      {page.primary_cta_label && (
        <Link
          to={page.primary_cta_url}
          className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-5 py-3 text-sm font-black transition hover:-translate-y-0.5 ${inverse ? 'bg-white text-[#002050]' : 'bg-[#002050] text-white'}`}
        >
          {page.primary_cta_label}<ArrowRight size={15} />
        </Link>
      )}
      {page.secondary_cta_label && (
        <Link
          to={page.secondary_cta_url}
          className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-5 py-3 text-sm font-black transition ${inverse ? 'border-white/35 bg-white/10 text-white hover:bg-white/15' : 'border-slate-300 bg-white text-[#002050] hover:border-[#002050]'}`}
        >
          {page.secondary_cta_label}
        </Link>
      )}
    </div>
  );
}

function LearnerVisual() {
  return (
    <div className="relative h-[350px] w-full max-w-[520px]" aria-hidden="true">
      <div className="absolute inset-0 rounded-[46%] bg-[radial-gradient(circle_at_center,rgba(43,113,215,0.18),transparent_66%)] blur-2xl" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 520 350" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M32 272C102 217 145 227 198 176C257 119 287 67 370 64C424 62 458 91 495 121" stroke="#BF8813" strokeOpacity="0.66" strokeWidth="2" />
        <path d="M35 291C111 250 161 255 219 207C278 158 313 119 384 118C429 117 461 137 498 163" stroke="#3B78CB" strokeOpacity="0.36" strokeWidth="1.5" />
        {[{x:66,y:253},{x:194,y:180},{x:370,y:64},{x:466,y:102}].map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={i===2?12:8} fill={i===2?'#BF8813':'#0F5FBD'} stroke="white" strokeWidth="5" />)}
      </svg>
      <div className="absolute left-[9%] top-[60%] w-32 rounded-2xl border border-[#C9D8EA] bg-white p-4 shadow-[0_16px_40px_rgba(0,32,80,0.12)]">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Apprendre</p><div className="mt-2 h-2 w-20 rounded-full bg-[#002050]/75" /><div className="mt-2 h-2 w-14 rounded-full bg-slate-200" />
      </div>
      <div className="absolute left-[36%] top-[34%] w-36 rounded-2xl border border-[#C9D8EA] bg-white p-4 shadow-[0_18px_42px_rgba(0,32,80,0.12)]">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pratiquer</p><div className="mt-2 h-2 w-20 rounded-full bg-[#2469B8]" /><div className="mt-2 flex gap-1"><span className="h-8 flex-1 rounded bg-[#E9F1FB]"/><span className="h-8 flex-1 rounded bg-[#FFF3D9]"/><span className="h-8 flex-1 rounded bg-[#DCE9F8]"/></div>
      </div>
      <div className="absolute right-[4%] top-[5%] w-40 rounded-[22px] border border-[#D8C07F] bg-[#FFFDF8] p-4 shadow-[0_22px_48px_rgba(0,32,80,0.12)]">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#9A6A08]">Prouver & avancer</p><div className="mt-3 h-12 rounded-xl bg-[#002050] p-3"><div className="h-2 w-20 rounded-full bg-[#E8BB53]"/><div className="mt-2 h-2 w-14 rounded-full bg-white/25"/></div>
      </div>
    </div>
  );
}

function ProfessorVisual() {
  return (
    <div className="relative h-[360px] w-full max-w-[520px]" aria-hidden="true">
      <div className="absolute left-[4%] top-[8%] h-[285px] w-[360px] rounded-[26px] border border-white/15 bg-white/[0.07] shadow-[0_28px_70px_rgba(0,0,0,0.24)] backdrop-blur-sm">
        <div className="flex h-12 items-center gap-2 border-b border-white/10 px-5"><span className="h-2.5 w-2.5 rounded-full bg-[#E8B94E]"/><span className="h-2 w-24 rounded bg-white/40"/></div>
        <div className="grid grid-cols-[88px_1fr] gap-4 p-5">
          <div className="space-y-2"><div className="h-8 rounded-lg bg-white/10"/><div className="h-8 rounded-lg bg-white/10"/><div className="h-8 rounded-lg bg-[#BF8813]/24"/><div className="h-8 rounded-lg bg-white/10"/></div>
          <div><div className="h-3 w-32 rounded bg-white/70"/><div className="mt-3 h-2 w-full rounded bg-white/14"/><div className="mt-2 h-2 w-[78%] rounded bg-white/14"/><div className="mt-7 grid grid-cols-3 gap-2"><div className="h-24 rounded-xl bg-white/9"/><div className="h-24 rounded-xl bg-white/9"/><div className="h-24 rounded-xl bg-[#BF8813]/18"/></div></div>
        </div>
      </div>
      <div className="absolute bottom-[2%] right-[0%] h-36 w-48 rounded-[24px] border border-[#E0B34F]/40 bg-[#07306B] p-5 shadow-[0_20px_52px_rgba(0,0,0,0.28)]">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#F0C15A]">Suivi pédagogique</p><div className="mt-5 flex items-end gap-2"><span className="h-8 flex-1 rounded-t bg-[#2F6EBB]"/><span className="h-14 flex-1 rounded-t bg-[#5C91D6]"/><span className="h-20 flex-1 rounded-t bg-[#BF8813]"/><span className="h-12 flex-1 rounded-t bg-[#2F6EBB]"/></div>
      </div>
    </div>
  );
}

function StructureVisual() {
  return (
    <div className="relative h-[360px] w-full max-w-[540px]" aria-hidden="true">
      <div className="absolute left-1/2 top-1/2 h-[300px] w-[430px] -translate-x-1/2 -translate-y-1/2 rounded-[46%] border border-[#B7CCE8] bg-[radial-gradient(circle,rgba(45,114,207,0.11),transparent_66%)]" />
      <div className="absolute left-1/2 top-[45%] flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[28px] bg-[#002050] text-white shadow-[0_22px_48px_rgba(0,32,80,0.25)]"><Building2 size={38}/></div>
      {[
        ['left-[4%] top-[18%]','Entreprise'],['right-[1%] top-[15%]','École'],['left-[4%] bottom-[8%]','ONG'],['right-[1%] bottom-[10%]','Institution'],
      ].map(([pos,label]) => <div key={label} className={`absolute ${pos} min-w-[124px] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center shadow-[0_14px_36px_rgba(0,32,80,0.10)]`}><p className="text-xs font-black text-[#002050]">{label}</p></div>)}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 540 360" fill="none"><path d="M270 157L100 94M270 157L442 88M270 157L97 292M270 157L444 292" stroke="#BF8813" strokeOpacity="0.54"/><circle cx="270" cy="157" r="4" fill="#BF8813"/></svg>
    </div>
  );
}

function RecruiterVisual() {
  return (
    <div className="relative h-[350px] w-full max-w-[520px]" aria-hidden="true">
      <div className="absolute left-0 top-9 w-[72%] rounded-[24px] border border-[#D6E1EF] bg-white p-5 shadow-[0_22px_54px_rgba(0,32,80,0.12)]">
        <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-wider text-[#9A6A08]">Talent pipeline</span><Search size={16} className="text-slate-400"/></div>
        <div className="mt-5 space-y-3">{['Profil & compétences','Preuves vérifiées','Candidature','Entretien'].map((x,i)=><div key={x} className="grid grid-cols-[26px_1fr_auto] items-center gap-3 border-b border-slate-100 pb-3"><span className={`h-6 w-6 rounded-full ${i<2?'bg-[#002050]':'bg-[#E8EEF6]'}`}/><span className="text-xs font-bold text-[#002050]">{x}</span><span className="h-2 w-12 rounded bg-slate-200"/></div>)}</div>
      </div>
      <div className="absolute bottom-6 right-0 w-[48%] rounded-[24px] bg-[#002050] p-5 text-white shadow-[0_22px_54px_rgba(0,32,80,0.20)]">
        <ShieldCheck size={26} className="text-[#E8B94E]"/><p className="mt-4 text-sm font-black">Décider avec plus de contexte</p><p className="mt-2 text-xs leading-5 text-white/65">Compétences, projets, preuves et suivi des candidatures dans le même environnement.</p>
      </div>
    </div>
  );
}

function LearnerPage({ page }: { page: AudiencePageConfig }) {
  const items = ordered(page.items); const segments = ordered(page.segments); const steps = ordered(page.steps);
  return <>
    <section className="overflow-hidden bg-[linear-gradient(110deg,#F7FBFF_0%,#EAF3FF_48%,#D4E6FC_100%)] px-6 py-16 lg:px-8 lg:py-20">
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.95fr_1.05fr]">
        <div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#9A6A08]">{page.hero_eyebrow}</p><h1 className="mt-4 text-[2.55rem] font-black leading-[1.03] tracking-[-0.052em] text-[#002050] sm:text-[3.25rem]">{page.hero_title}</h1><p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">{page.hero_subtitle}</p>{page.hero_body&&<p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">{page.hero_body}</p>}<HeroActions page={page}/></div>
        <LearnerVisual/>
      </div>
    </section>
    <section className="border-b border-slate-200 bg-white px-6 py-16 lg:px-8"><div className="mx-auto max-w-7xl"><div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr]"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#9A6A08]">{page.highlight_label}</p><h2 className="mt-4 text-3xl font-black tracking-[-0.04em] text-[#002050]">{page.highlight_title}</h2><p className="mt-4 text-sm leading-8 text-slate-600">{page.highlight_body}</p></div><div className="border-t border-slate-300">{steps.map((item,index)=><div key={item.id} className="grid gap-4 border-b border-slate-200 py-5 sm:grid-cols-[52px_170px_1fr]"><span className="text-sm font-black text-[#BF8813]">{item.label||String(index+1).padStart(2,'0')}</span><h3 className="font-black text-[#002050]">{item.title}</h3><p className="text-sm leading-6 text-slate-600">{item.description}</p></div>)}</div></div></div></section>
    <section className="bg-[#F7F9FC] px-6 py-16 lg:px-8"><div className="mx-auto max-w-7xl"><h2 className="max-w-3xl text-3xl font-black tracking-[-0.04em] text-[#002050]">{page.items_title}</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{page.items_subtitle}</p><div className="mt-9 grid border-y border-slate-300 md:grid-cols-2">{items.map((item,index)=>{const Icon=ICONS[index%ICONS.length];return <div key={item.id} className="border-b border-slate-200 px-0 py-7 md:px-7 md:[&:nth-child(odd)]:border-r"><div className="flex gap-4"><Icon className="mt-1 shrink-0 text-[#BF8813]" size={20}/><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{item.label}</p><h3 className="mt-1 text-xl font-black text-[#002050]">{item.title}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p><Cta item={item}/></div></div></div>})}</div></div></section>
    <section className="bg-[#002050] px-6 py-16 text-white lg:px-8"><div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]"><div><h2 className="text-3xl font-black tracking-[-0.04em]">{page.segments_title}</h2><p className="mt-4 text-sm leading-7 text-white/65">{page.segments_subtitle}</p></div><div className="divide-y divide-white/12 border-y border-white/15">{segments.map(item=><div key={item.id} className="grid gap-2 py-5 sm:grid-cols-[160px_1fr_auto]"><span className="text-xs font-bold uppercase tracking-wider text-[#F1C35E]">{item.label}</span><div><h3 className="font-black">{item.title}</h3><p className="mt-1 text-sm leading-6 text-white/65">{item.description}</p></div><Cta item={item} dark/></div>)}</div></div></section>
  </>;
}

function ProfessorPage({ page }: { page: AudiencePageConfig }) {
  const items=ordered(page.items); const segments=ordered(page.segments); const steps=ordered(page.steps);
  return <>
    <section className="overflow-hidden bg-[#001B46] px-6 py-16 text-white lg:px-8 lg:py-20"><div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#E8B94E]">{page.hero_eyebrow}</p><h1 className="mt-4 text-[2.55rem] font-black leading-[1.03] tracking-[-0.052em] sm:text-[3.25rem]">{page.hero_title}</h1><p className="mt-5 max-w-2xl text-base leading-8 text-blue-100/80">{page.hero_subtitle}</p>{page.hero_body&&<p className="mt-3 max-w-xl text-sm leading-7 text-blue-100/55">{page.hero_body}</p>}<HeroActions page={page} inverse/></div><ProfessorVisual/></div></section>
    <section className="bg-white px-6 py-16 lg:px-8"><div className="mx-auto max-w-7xl"><div className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#9A6A08]">{page.highlight_label}</p><h2 className="mt-4 text-3xl font-black tracking-[-0.04em] text-[#002050]">{page.highlight_title}</h2><p className="mt-4 text-sm leading-8 text-slate-600">{page.highlight_body}</p></div><div className="mt-12 grid gap-10 lg:grid-cols-[0.72fr_1.28fr]"><div><h3 className="text-2xl font-black text-[#002050]">{page.steps_title}</h3><p className="mt-3 text-sm leading-7 text-slate-500">{page.steps_subtitle}</p></div><div className="relative border-l border-[#D7A63A]/50 pl-8">{steps.map((item,index)=><div key={item.id} className="relative pb-9 last:pb-0"><span className="absolute -left-[39px] top-0 flex h-5 w-5 items-center justify-center rounded-full border-4 border-white bg-[#BF8813] shadow"/><p className="text-xs font-black uppercase tracking-wider text-slate-400">{item.label||String(index+1).padStart(2,'0')}</p><h4 className="mt-1 text-xl font-black text-[#002050]">{item.title}</h4><p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">{item.description}</p></div>)}</div></div></div></section>
    <section className="border-y border-slate-200 bg-[#F6F8FB] px-6 py-16 lg:px-8"><div className="mx-auto max-w-7xl"><div className="grid gap-12 lg:grid-cols-[1fr_1fr]"><div><h2 className="text-3xl font-black tracking-[-0.04em] text-[#002050]">{page.items_title}</h2><p className="mt-3 text-sm leading-7 text-slate-600">{page.items_subtitle}</p></div><div className="border-t border-slate-300">{items.map((item,index)=>{const Icon=ICONS[(index+1)%ICONS.length];return <div key={item.id} className="grid grid-cols-[30px_1fr] gap-4 border-b border-slate-200 py-5"><Icon size={19} className="mt-1 text-[#BF8813]"/><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{item.label}</p><h3 className="mt-1 font-black text-[#002050]">{item.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p><Cta item={item}/></div></div>})}</div></div></div></section>
    <section className="bg-white px-6 py-16 lg:px-8"><div className="mx-auto max-w-7xl"><h2 className="text-3xl font-black tracking-[-0.04em] text-[#002050]">{page.segments_title}</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{page.segments_subtitle}</p><div className="mt-9 grid gap-0 border-y border-slate-300 lg:grid-cols-3">{segments.map((item,index)=><div key={item.id} className={`py-7 lg:px-7 ${index<segments.length-1?'border-b border-slate-200 lg:border-b-0 lg:border-r':''}`}><p className="text-xs font-black uppercase tracking-wider text-[#9A6A08]">{item.label}</p><h3 className="mt-3 text-xl font-black text-[#002050]">{item.title}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p><Cta item={item}/></div>)}</div></div></section>
  </>;
}

function StructurePage({ page }: { page: AudiencePageConfig }) {
  const items=ordered(page.items); const segments=ordered(page.segments); const steps=ordered(page.steps);
  return <>
    <section className="overflow-hidden bg-white px-6 py-16 lg:px-8 lg:py-20"><div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.04fr_0.96fr]"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#9A6A08]">{page.hero_eyebrow}</p><h1 className="mt-4 text-[2.65rem] font-black leading-[1.02] tracking-[-0.055em] text-[#002050] sm:text-[3.45rem]">{page.hero_title}</h1><p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">{page.hero_subtitle}</p>{page.hero_body&&<p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">{page.hero_body}</p>}<HeroActions page={page}/></div><StructureVisual/></div></section>
    <section className="border-y border-slate-200 bg-[#F7F9FC] px-6 py-14 lg:px-8"><div className="mx-auto max-w-7xl"><div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr]"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#9A6A08]">{page.highlight_label}</p><h2 className="mt-4 text-3xl font-black tracking-[-0.04em] text-[#002050]">{page.highlight_title}</h2></div><p className="text-base leading-8 text-slate-600">{page.highlight_body}</p></div></div></section>
    <section className="bg-white px-6 py-16 lg:px-8"><div className="mx-auto max-w-7xl"><h2 className="text-3xl font-black tracking-[-0.04em] text-[#002050]">{page.segments_title}</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{page.segments_subtitle}</p><div className="mt-10 divide-y divide-slate-200 border-y border-slate-300">{segments.map((item,index)=><div key={item.id} className="grid gap-4 py-7 lg:grid-cols-[220px_1fr_auto] lg:items-start"><div><p className="text-xs font-black uppercase tracking-wider text-[#BF8813]">0{index+1}</p><p className="mt-2 text-sm font-bold text-[#002050]">{item.label}</p></div><div><h3 className="text-2xl font-black tracking-[-0.03em] text-[#002050]">{item.title}</h3><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{item.description}</p></div><Cta item={item}/></div>)}</div></div></section>
    <section className="bg-[#001B46] px-6 py-16 text-white lg:px-8"><div className="mx-auto max-w-7xl"><div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr]"><div><h2 className="text-3xl font-black tracking-[-0.04em]">{page.steps_title}</h2><p className="mt-4 text-sm leading-7 text-blue-100/65">{page.steps_subtitle}</p></div><div className="grid gap-0 md:grid-cols-2">{steps.map((item,index)=><div key={item.id} className="border-b border-white/10 py-6 md:px-6 md:[&:nth-child(odd)]:border-r"><span className="text-xs font-black uppercase tracking-wider text-[#F1C35E]">{item.label||String(index+1).padStart(2,'0')}</span><h3 className="mt-2 text-xl font-black">{item.title}</h3><p className="mt-3 text-sm leading-7 text-blue-100/65">{item.description}</p></div>)}</div></div></div></section>
    <section className="bg-white px-6 py-16 lg:px-8"><div className="mx-auto max-w-7xl"><h2 className="text-3xl font-black tracking-[-0.04em] text-[#002050]">{page.items_title}</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{page.items_subtitle}</p><div className="mt-9 grid gap-x-10 gap-y-0 lg:grid-cols-2">{items.map((item,index)=>{const Icon=ICONS[(index+3)%ICONS.length];return <div key={item.id} className="grid grid-cols-[34px_1fr] gap-4 border-b border-slate-200 py-6"><Icon size={20} className="mt-1 text-[#BF8813]"/><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{item.label}</p><h3 className="mt-1 text-lg font-black text-[#002050]">{item.title}</h3><p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p><Cta item={item}/></div></div>})}</div></div></section>
  </>;
}

function RecruiterPage({ page }: { page: AudiencePageConfig }) {
  const items=ordered(page.items); const segments=ordered(page.segments); const steps=ordered(page.steps);
  return <>
    <section className="overflow-hidden bg-[linear-gradient(118deg,#F8FAFC_0%,#EDF4FD_60%,#D9E9FC_100%)] px-6 py-16 lg:px-8 lg:py-20"><div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.92fr_1.08fr]"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#9A6A08]">{page.hero_eyebrow}</p><h1 className="mt-4 text-[2.55rem] font-black leading-[1.03] tracking-[-0.052em] text-[#002050] sm:text-[3.25rem]">{page.hero_title}</h1><p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">{page.hero_subtitle}</p>{page.hero_body&&<p className="mt-3 max-w-xl text-sm leading-7 text-slate-500">{page.hero_body}</p>}<HeroActions page={page}/></div><RecruiterVisual/></div></section>
    <section className="bg-[#002050] px-6 py-14 text-white lg:px-8"><div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.82fr_1.18fr]"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#F1C35E]">{page.highlight_label}</p><h2 className="mt-4 text-3xl font-black tracking-[-0.04em]">{page.highlight_title}</h2></div><p className="text-base leading-8 text-blue-100/70">{page.highlight_body}</p></div></section>
    <section className="bg-white px-6 py-16 lg:px-8"><div className="mx-auto max-w-7xl"><div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr]"><div><h2 className="text-3xl font-black tracking-[-0.04em] text-[#002050]">{page.items_title}</h2><p className="mt-3 text-sm leading-7 text-slate-600">{page.items_subtitle}</p></div><div className="border-t border-slate-300">{items.map((item,index)=><div key={item.id} className="grid gap-3 border-b border-slate-200 py-5 sm:grid-cols-[44px_170px_1fr_auto]"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EDF3FA] text-xs font-black text-[#002050]">{index+1}</span><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{item.label}</p><h3 className="mt-1 font-black text-[#002050]">{item.title}</h3></div><p className="text-sm leading-6 text-slate-600">{item.description}</p><Cta item={item}/></div>)}</div></div></div></section>
    <section className="border-y border-slate-200 bg-[#F7F9FC] px-6 py-16 lg:px-8"><div className="mx-auto max-w-7xl"><h2 className="text-3xl font-black tracking-[-0.04em] text-[#002050]">{page.segments_title}</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{page.segments_subtitle}</p><div className="mt-10 grid gap-8 lg:grid-cols-3">{segments.map((item,index)=><div key={item.id} className="border-t-2 border-[#BF8813] pt-5"><p className="text-xs font-black uppercase tracking-wider text-slate-400">0{index+1} · {item.label}</p><h3 className="mt-3 text-xl font-black text-[#002050]">{item.title}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p><Cta item={item}/></div>)}</div></div></section>
    <section className="bg-white px-6 py-16 lg:px-8"><div className="mx-auto max-w-7xl"><div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]"><div><h2 className="text-3xl font-black tracking-[-0.04em] text-[#002050]">{page.steps_title}</h2><p className="mt-3 text-sm leading-7 text-slate-600">{page.steps_subtitle}</p></div><div className="flex flex-col gap-0">{steps.map((item,index)=><div key={item.id} className="grid grid-cols-[52px_1fr] gap-4 border-l border-slate-300 pb-8 pl-6 last:pb-0"><span className="-ml-[33px] flex h-12 w-12 items-center justify-center rounded-full border-4 border-white bg-[#002050] text-xs font-black text-white shadow">{item.label||index+1}</span><div><h3 className="text-xl font-black text-[#002050]">{item.title}</h3><p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p></div></div>)}</div></div></div></section>
  </>;
}

export function AudienceRolePage({ audienceKey }: { audienceKey: AudiencePageKey }) {
  const [settings, setSettings] = useState<Settings>({});
  useEffect(() => { let active = true; getPublicSiteSettings().then(data => { if (active) setSettings(data); }).catch(() => {}); return () => { active = false; }; }, []);

  const landingPage = useMemo(() => normalizeLandingPage(settings.landing_page), [settings.landing_page]);
  const page = landingPage.audience_pages[audienceKey] || createDefaultLandingPage().audience_pages[audienceKey];
  const audienceLinks = Object.values(landingPage.audience_pages).filter(entry => entry.enabled).map(entry => ({ label: entry.nav_label, href: entry.route }));

  let content: ReactNode;
  if (audienceKey === 'apprenants') content = <LearnerPage page={page}/>;
  else if (audienceKey === 'professeurs') content = <ProfessorPage page={page}/>;
  else if (audienceKey === 'structures') content = <StructurePage page={page}/>;
  else content = <RecruiterPage page={page}/>;

  return (
    <div className="bg-white" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <Navbar showAudienceBar audienceLinks={audienceLinks} />
      <main className="pt-[116px]">{content}</main>
      <PageFooter socialNetworksV2={settings.social_networks_v2 || []} mobileAppsV2={settings.mobile_apps_v2 || []} partners={settings.public_partners || []} footerConfig={landingPage.footer} managedOnly />
    </div>
  );
}
