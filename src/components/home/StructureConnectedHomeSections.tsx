import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, BookOpen, Briefcase, Building2, FileSignature, FolderKanban, MessageCircle, Plus, QrCode, Radio, ShieldCheck, Users, type LucideIcon } from 'lucide-react';
import { getOwnerProjects, type OmniaProject } from '../../lib/projectsApi';
import { loadTalentDashboard, loadTalentInterviews, type TalentInterview } from '../../pages/talent/talentApi';

export type StructureConnectedHomeData = {
  structure?: {
    id: string;
    name?: string;
    display_name?: string;
    structure_type?: string;
    status?: string;
    status_label?: string;
    logo_url?: string | null;
    admin_comment?: string | null;
    modification_note?: string | null;
  } | null;
  stats?: { members?: number; active_codes?: number; courses?: number };
  pending_members?: Array<{ id: string; status?: string; requested_at?: string; users?: { full_name?: string; email?: string } | null }>;
};

type Props = { data: StructureConnectedHomeData | null; previewMode: boolean };
type Extra = { projects: OmniaProject[]; talentMetrics: { favorites: number; contacts: number; upcoming_interviews: number }; interviews: TalentInterview[] };
type SpaceItem = { label: string; caption: string; path: string; accent: string; soft: string; icon: LucideIcon; signal?: string };

const BLUE = '#002050';
void BLUE;
const TEAL = '#0B817A';
void TEAL;
const GOLD = '#BF8813';
void GOLD;
const EMPTY_EXTRA: Extra = { projects: [], talentMetrics: { favorites: 0, contacts: 0, upcoming_interviews: 0 }, interviews: [] };

function withPreview(path: string, previewMode: boolean) {
  if (!previewMode) return path;
  const [base, hash = ''] = path.split('#', 2);
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}preview=true${hash ? `#${hash}` : ''}`;
}
function structureStatus(status?: string) {
  if (status === 'validated') return { label: 'Structure validée', accent: '#13795B', soft: '#EAF8F2' };
  if (status === 'changes_requested') return { label: 'Modifications demandées', accent: '#C45B24', soft: '#FFF2E8' };
  if (status === 'pending_validation') return { label: 'Validation en cours', accent: '#A56B12', soft: '#FFF7E6' };
  return { label: status ? 'Statut Structure' : 'Espace Structure', accent: '#64748B', soft: '#F1F5F9' };
}

function useStructureExtra(previewMode: boolean) {
  const [extra, setExtra] = useState<Extra>(EMPTY_EXTRA);
  useEffect(() => {
    if (previewMode) { setExtra(EMPTY_EXTRA); return; }
    let active = true;
    Promise.allSettled([getOwnerProjects('structure'), loadTalentDashboard('structure'), loadTalentInterviews('structure')]).then(results => {
      if (!active) return;
      const next: Extra = { ...EMPTY_EXTRA };
      if (results[0].status === 'fulfilled') next.projects = results[0].value.projects || [];
      if (results[1].status === 'fulfilled') next.talentMetrics = results[1].value.metrics || EMPTY_EXTRA.talentMetrics;
      if (results[2].status === 'fulfilled') next.interviews = results[2].value || [];
      setExtra(next);
    });
    return () => { active = false; };
  }, [previewMode]);
  return extra;
}

function OrganizationHero({ data, previewMode, extra }: Props & { extra: Extra }) {
  const structure = data?.structure || null;
  const stats = data?.stats || {};
  const pendingCount = data?.pending_members?.length || 0;
  const status = structureStatus(structure?.status);
  const name = structure?.display_name || structure?.name || 'Votre organisation';
  const activeProjects = extra.projects.filter(project => ['published', 'selection', 'in_progress'].includes(project.status)).length;

  let actionTitle = 'Structurer votre organisation';
void actionTitle;
  let actionText = 'Membres, formations, projets et recrutement apparaîtront ici à mesure que votre activité grandit.';
void actionText;
  let actionPath = '/structure/membres';
  let actionLabel = 'Gérer les membres';
  if (!structure && !previewMode) { actionTitle = 'Finaliser votre espace Structure'; actionText = 'Votre compte ne possède pas encore d’organisation associée.'; actionPath = '/inscription/structure'; actionLabel = 'Inscrire la Structure'; }
  else if (structure?.status === 'changes_requested') { actionTitle = 'Une modification est demandée'; actionText = structure.admin_comment || structure.modification_note || 'Mettez à jour le profil avant une nouvelle validation.'; actionPath = '/structure/profil'; actionLabel = 'Mettre à jour le profil'; }
  else if (pendingCount) { actionTitle = `${pendingCount} rattachement${pendingCount > 1 ? 's' : ''} à décider`; actionText = 'Des personnes attendent une décision de votre organisation.'; actionPath = '/structure/rattachements'; actionLabel = 'Traiter les rattachements'; }

  return <section className="relative overflow-hidden border-b border-[#CFE1E0] bg-[linear-gradient(135deg,#F4FBFA_0%,#EAF5F5_54%,#FDF9F0_100%)]"><div className="pointer-events-none absolute inset-0" aria-hidden="true"><div className="absolute left-[52%] top-[-180px] h-[520px] w-[520px] rounded-full border border-[#0B817A]/10" /><div className="absolute right-[-130px] top-[-100px] h-[420px] w-[420px] rounded-full border border-[#BF8813]/15" /></div><div className="relative mx-auto grid min-h-[500px] max-w-7xl gap-12 px-5 py-14 sm:px-6 lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:px-8 lg:py-16"><div><div className="inline-flex items-center gap-2 rounded-full bg-white/85 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-[#0B817A] shadow-sm"><Building2 size={14} /> Espace organisation</div><h1 className="mt-5 max-w-[690px] text-4xl font-black leading-[1.02] tracking-[-0.048em] text-[#002050] sm:text-5xl lg:text-[3.55rem]">Voir votre organisation comme un système vivant.</h1><p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">Votre accueil rassemble les personnes, les formations et les opérations qui font avancer {previewMode ? 'la Structure' : name}.</p><div className="mt-7 flex flex-wrap items-center gap-3"><Link to={withPreview(actionPath, previewMode)} className="inline-flex items-center gap-2 rounded-xl bg-[#0B817A] px-5 py-3 text-sm font-black text-white">{previewMode ? 'Explorer l’espace Structure' : actionLabel}<ArrowRight size={16} /></Link>{structure && !previewMode && <span className="rounded-full px-3 py-2 text-xs font-black" style={{ background: status.soft, color: status.accent }}>{status.label}</span>}</div></div>
    <div className="relative mx-auto h-[360px] w-full max-w-[580px]" aria-label="Carte abstraite de l’organisation"><svg className="absolute inset-0 h-full w-full" viewBox="0 0 580 360" fill="none" aria-hidden="true"><path d="M290 174 C210 120 140 95 72 88" stroke="#8DBDB8" strokeWidth="2" strokeDasharray="6 8"/><path d="M290 174 C392 115 470 82 535 93" stroke="#C4A24D" strokeWidth="2" strokeDasharray="6 8"/><path d="M290 174 C200 238 132 276 70 285" stroke="#7196B6" strokeWidth="2" strokeDasharray="6 8"/><path d="M290 174 C390 238 468 270 526 278" stroke="#8B76B7" strokeWidth="2" strokeDasharray="6 8"/></svg>
      <div className="absolute left-1/2 top-1/2 flex h-36 w-36 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-[34px] border border-white bg-white shadow-[0_30px_70px_rgba(0,32,80,.12)]"><span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-[#E8F7F5] text-[#0B817A]">{structure?.logo_url && !previewMode ? <img src={structure.logo_url} alt="" className="h-full w-full object-cover" /> : <Building2 size={25} />}</span><strong className="mt-3 max-w-[115px] truncate text-center text-sm font-black text-[#002050]">{previewMode ? 'Structure' : name}</strong></div>
      {[{left:'3%',top:'12%',icon:Users,label:'Membres',value:Number(stats.members||0),color:'#0B817A',soft:'#E8F7F5'},{left:'79%',top:'13%',icon:BookOpen,label:'Formations',value:Number(stats.courses||0),color:'#245D9B',soft:'#EDF4FC'},{left:'2%',top:'69%',icon:FolderKanban,label:'Projects',value:activeProjects,color:'#A56B12',soft:'#FFF7E6'},{left:'78%',top:'67%',icon:Briefcase,label:'Recrutement',value:Number(extra.talentMetrics.upcoming_interviews||0),color:'#7650C5',soft:'#F4F0FF'}].map(node=>{const Icon=node.icon;return <div key={node.label} className="absolute min-w-[130px] rounded-[20px] border border-white bg-white/95 p-4 shadow-[0_18px_40px_rgba(0,32,80,.08)]" style={{left:node.left,top:node.top}}><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{color:node.color,background:node.soft}}><Icon size={17}/></span><div><span className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{node.label}</span><strong className="block text-xl font-black text-[#002050]">{previewMode?'—':node.value}</strong></div></div></div>})}
    </div></div></section>;
}

function StructureSpaces({ data, previewMode, extra }: Props & { extra: Extra }) {
  const stats = data?.stats || {};
  const spaces: SpaceItem[] = [
    { label: 'Formations', caption: 'Concevoir et suivre vos formations', path: '/formations', accent: '#245D9B', soft: '#EDF4FC', icon: BookOpen, signal: Number(stats.courses||0) ? `${Number(stats.courses||0)} formation${Number(stats.courses||0)>1?'s':''}` : undefined },
    { label: 'Omnia Career', caption: 'Développer l’employabilité et les trajectoires', path: '/career-studio', accent: '#BF8813', soft: '#FBF5E9', icon: FileSignature },
    { label: 'Omnia Projects', caption: 'Porter les projets de votre organisation', path: '/projects', accent: '#A56B12', soft: '#FFF7E6', icon: FolderKanban, signal: extra.projects.length ? `${extra.projects.length} projet${extra.projects.length>1?'s':''}` : undefined },
    { label: 'Omnia Talent', caption: 'Talents, candidatures et entretiens', path: '/talent', accent: '#7650C5', soft: '#F4F0FF', icon: Briefcase, signal: extra.talentMetrics.upcoming_interviews ? `${extra.talentMetrics.upcoming_interviews} entretien${extra.talentMetrics.upcoming_interviews>1?'s':''}` : undefined },
    { label: 'Omnia Live', caption: 'Événements et expériences en direct', path: '/omnia-live', accent: '#5A55C9', soft: '#F0F0FF', icon: Radio },
    { label: 'Communauté', caption: 'Échanges et ressources transversales', path: '/forum', accent: '#0F766E', soft: '#EAF8F6', icon: MessageCircle },
    { label: 'Coaching', caption: 'Accompagnement et développement humain', path: '/coaching', accent: '#356C63', soft: '#EAF3F0', icon: Users },
  ];
  return <section className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-7xl px-5 py-9 sm:px-6 lg:px-8"><div className="flex items-end justify-between gap-5"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#0B817A]">Vos espaces Omnia</p><h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#002050]">Accéder aux outils qui font avancer votre organisation.</h2></div><p className="hidden max-w-md text-right text-xs leading-5 text-slate-500 md:block">Les compteurs se mettent à jour avec les contenus réels de votre organisation.</p></div><div className="mt-6 flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{spaces.map(item=>{const Icon=item.icon;return <Link key={item.path} to={withPreview(item.path,previewMode)} className="group min-w-[215px] flex-1 rounded-[18px] border border-slate-200 bg-white p-4 transition hover:bg-[#FAFCFC]"><div className="flex items-start justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{color:item.accent,background:item.soft}}><Icon size={18}/></span>{item.signal&&!previewMode&&<span className="text-[10px] font-black text-slate-400">{item.signal}</span>}</div><strong className="mt-4 block text-sm font-black text-[#002050]">{item.label}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{item.caption}</span><ArrowRight size={14} className="mt-3 text-slate-300 transition group-hover:translate-x-1"/></Link>})}</div></div></section>;
}

function OrganizationDigest({ data, previewMode, extra }: Props & { extra: Extra }) {
  const structure = data?.structure || null;
  const stats = data?.stats || {};
  const pending = previewMode ? [] : (data?.pending_members || []);
  const activeProjects = extra.projects.filter(project=>['published','selection','in_progress'].includes(project.status));
  const nextInterview = extra.interviews.filter(item=>new Date(item.scheduled_at).getTime()>Date.now()&&!['completed','cancelled','declined'].includes(item.status)).sort((a,b)=>new Date(a.scheduled_at).getTime()-new Date(b.scheduled_at).getTime())[0];
  const levers = useMemo(()=>{
    const rows:Array<{title:string;text:string;path:string;icon:LucideIcon;accent:string}>=[];
    if (structure?.status==='changes_requested') rows.push({title:'Répondre à la demande administrative',text:structure.admin_comment||structure.modification_note||'Une modification du profil Structure est attendue.',path:'/structure/profil',icon:ShieldCheck,accent:'#C45B24'});
    if (pending.length) rows.push({title:'Fluidifier les rattachements',text:`${pending.length} demande${pending.length>1?'s attendent':' attend'} une décision.`,path:'/structure/rattachements',icon:Users,accent:'#0B817A'});
    if (structure?.status==='validated'&&Number(stats.members||0)===0) rows.push({title:'Connecter vos premiers membres',text:'Aucun membre n’est encore rattaché à l’organisation.',path:'/structure/codes',icon:QrCode,accent:'#A56B12'});
    if (structure?.status==='validated'&&Number(stats.courses||0)===0) rows.push({title:'Lancer votre premier parcours interne',text:'Aucune formation Structure n’apparaît encore dans l’activité.',path:'/structure/courses/new',icon:Plus,accent:'#245D9B'});
    if (nextInterview) rows.push({title:'Préparer le prochain entretien',text:`${nextInterview.title||'Entretien'} avec ${nextInterview.talent?.full_name||'un talent'}.`,path:'/structure/recrutement/entretiens',icon:Briefcase,accent:'#7650C5'});
    if (activeProjects.length) rows.push({title:'Suivre les projets en mouvement',text:`${activeProjects.length} projet${activeProjects.length>1?'s sont':' est'} actuellement actif${activeProjects.length>1?'s':''}.`,path:'/structure/projects',icon:FolderKanban,accent:'#A56B12'});
    if (!rows.length) rows.push({title:'Approfondir le pilotage RH',text:'Votre socle principal est en place. Le suivi RH peut maintenant consolider la lecture de l’organisation.',path:'/structure/suivi-rh',icon:BarChart3,accent:'#0B817A'});
    return rows.slice(0,4);
  },[structure,pending.length,stats.members,stats.courses,nextInterview,activeProjects.length]);

  const summaries=[Number(stats.members||0)?`${Number(stats.members||0)} membre${Number(stats.members||0)>1?'s':''} lié${Number(stats.members||0)>1?'s':''}`:null,Number(stats.courses||0)?`${Number(stats.courses||0)} formation${Number(stats.courses||0)>1?'s':''}`:null,activeProjects.length?`${activeProjects.length} projet${activeProjects.length>1?'s':''} actif${activeProjects.length>1?'s':''}`:null,extra.talentMetrics.upcoming_interviews?`${extra.talentMetrics.upcoming_interviews} entretien${extra.talentMetrics.upcoming_interviews>1?'s':''} à venir`:null].filter(Boolean) as string[];
  return <section className="bg-[#F6FAFA]"><div className="mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:px-8"><div className="grid gap-9 xl:grid-cols-[1.15fr_0.85fr]"><div><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#0B817A]">Organisation en mouvement</p><h2 className="mt-2 text-3xl font-black tracking-[-0.035em] text-[#002050]">Les informations qui deviennent utiles au fil de l’activité.</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">Les résumés ci-dessous restent vides tant qu’aucun contenu réel n’existe. Dès qu’une activité apparaît, elle remonte ici.</p></div>
    <div className="mt-6 grid gap-4 md:grid-cols-2">{previewMode?<div className="rounded-[22px] border border-[#D6E7E5] bg-white p-6 text-sm text-slate-500 md:col-span-2">Les données privées de l’organisation sont masquées pendant la prévisualisation.</div>:summaries.length?summaries.map((text,index)=><div key={text} className="rounded-[22px] border border-[#D6E7E5] bg-white p-5"><span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#0B817A]">Signal {String(index+1).padStart(2,'0')}</span><strong className="mt-3 block text-xl font-black text-[#002050]">{text}</strong></div>):<div className="rounded-[22px] border border-dashed border-[#BFD7D4] bg-white p-6 text-sm leading-6 text-slate-500 md:col-span-2">Membres, formations, projets et recrutement apparaîtront ici automatiquement dès que l’activité commencera.</div>}</div>
    {pending.length>0&&!previewMode&&<div className="mt-7 border-y border-[#D6E7E5] bg-white px-5">{pending.slice(0,3).map((member,index)=><Link key={member.id} to="/structure/rattachements" className={`group flex items-center gap-4 py-4 ${index?'border-t border-slate-100':''}`}><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8F7F5] text-xs font-black text-[#0B817A]">{(member.users?.full_name||'?').slice(0,2).toUpperCase()}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm font-black text-[#002050]">{member.users?.full_name||'Demande de rattachement'}</strong><span className="text-xs text-slate-500">En attente</span></span><ArrowRight size={14} className="text-slate-300 transition group-hover:translate-x-1"/></Link>)}</div>}
    </div>
    <aside className="rounded-[26px] bg-[#073E45] p-6 text-white"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#93DDD6]">Leviers d’organisation</p><h3 className="mt-2 text-2xl font-black tracking-[-0.03em]">Ce qu’il est utile d’améliorer maintenant.</h3><div className="mt-5 divide-y divide-white/10">{levers.map(item=>{const Icon=item.icon;return <Link key={`${item.path}-${item.title}`} to={withPreview(item.path,previewMode)} className="group flex gap-3 py-4"><span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10" style={{color:item.accent}}><Icon size={17}/></span><span className="min-w-0 flex-1"><strong className="block text-sm font-black">{previewMode?'Levier personnalisé':item.title}</strong><span className="mt-1 block text-xs leading-5 text-white/50">{previewMode?'Cette recommandation dépendra des données réelles de la Structure.':item.text}</span></span><ArrowRight size={14} className="mt-2 text-white/25 transition group-hover:translate-x-1"/></Link>})}</div></aside>
  </div></div></section>;
}

export default function StructureConnectedHomeSections(props: Props) { const extra=useStructureExtra(props.previewMode); return <><OrganizationHero {...props} extra={extra}/><StructureSpaces {...props} extra={extra}/><OrganizationDigest {...props} extra={extra}/></>; }
