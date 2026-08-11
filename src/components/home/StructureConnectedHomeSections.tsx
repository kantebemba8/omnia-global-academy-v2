import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock3,
  FileSignature,
  FolderKanban,
  MessageCircle,
  Network,
  Plus,
  QrCode,
  Radio,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';

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
  stats?: {
    members?: number;
    active_codes?: number;
    courses?: number;
  };
  pending_members?: Array<{
    id: string;
    status?: string;
    requested_at?: string;
    users?: { full_name?: string; email?: string } | null;
  }>;
};

type Props = {
  data: StructureConnectedHomeData | null;
  previewMode: boolean;
};

type SpaceItem = {
  label: string;
  caption: string;
  path: string;
  accent: string;
  soft: string;
  icon: LucideIcon;
};

type Improvement = {
  title: string;
  description: string;
  path: string;
  label: string;
  icon: LucideIcon;
};

const TEAL = '#0B817A';
const GOLD = '#BF8813';
const BLUE = '#002050';

const SPACES: SpaceItem[] = [
  { label: 'Formations', caption: 'Concevoir et suivre les formations de votre organisation', path: '/structure/formations', accent: '#245D9B', soft: '#EDF4FC', icon: BookOpen },
  { label: 'Omnia Projects', caption: 'Porter et suivre les projets de la Structure', path: '/structure/projects', accent: '#A56B12', soft: '#FFF7E6', icon: FolderKanban },
  { label: 'Talent & recrutement', caption: 'Talents, offres, candidatures et compétences vérifiées', path: '/structure/recrutement/dashboard', accent: '#7650C5', soft: '#F4F0FF', icon: Briefcase },
  { label: 'Omnia Live', caption: 'Événements, expériences live et rapports Structure', path: '/omnia-live', accent: '#5A55C9', soft: '#F0F0FF', icon: Radio },
  { label: 'Communauté', caption: 'Échanger et accéder aux ressources de la communauté', path: '/forum', accent: '#0F766E', soft: '#EAF8F6', icon: MessageCircle },
  { label: 'B2B & contrats', caption: 'Abonnements, capacités et contrats de votre organisation', path: '/structure/commerce-b2b', accent: '#8A651A', soft: '#FBF5E9', icon: FileSignature },
];

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

function StructureHero({ data, previewMode }: Props) {
  const structure = data?.structure || null;
  const pendingCount = data?.pending_members?.length || 0;
  const status = structureStatus(structure?.status);
  const visibleName = structure?.name && !/^Espace\s+Structure/i.test(structure.name.trim()) ? structure.name.trim() : '';

  let priorityTitle = 'Votre organisation est prête à être structurée';
  let priorityText = 'Retrouvez membres, formations et opérations depuis les espaces spécialisés de la Structure.';
  let priorityPath = '/structure/membres';
  let priorityLabel = 'Voir les membres';

  if (!structure && !previewMode) {
    priorityTitle = 'Finaliser votre espace Structure';
    priorityText = 'Votre compte Structure ne possède pas encore d’organisation associée.';
    priorityPath = '/inscription/structure';
    priorityLabel = 'Inscrire une structure';
  } else if (structure?.status === 'changes_requested') {
    priorityTitle = 'Une modification est demandée';
    priorityText = structure.admin_comment || structure.modification_note || 'Mettez à jour le profil de la Structure avant une nouvelle validation.';
    priorityPath = '/structure/profil';
    priorityLabel = 'Mettre à jour le profil';
  } else if (structure?.status === 'pending_validation') {
    priorityTitle = 'Validation de la Structure en cours';
    priorityText = 'Vous pouvez préparer votre organisation pendant l’examen de votre demande.';
    priorityPath = '/structure/profil';
    priorityLabel = 'Vérifier le profil';
  } else if (pendingCount > 0) {
    priorityTitle = `${pendingCount} demande${pendingCount > 1 ? 's' : ''} de rattachement à traiter`;
    priorityText = 'Des personnes attendent une décision pour rejoindre votre organisation.';
    priorityPath = '/structure/rattachements';
    priorityLabel = 'Traiter les demandes';
  }

  return (
    <section className="relative overflow-hidden bg-[#032F45] text-white">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 opacity-[0.10]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.24) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.18) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        <div className="absolute -left-24 bottom-[-230px] h-[500px] w-[500px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(11,129,122,.55), rgba(11,129,122,.10) 47%, transparent 70%)' }} />
        <div className="absolute -right-36 -top-48 h-[610px] w-[610px] rounded-full border border-white/10" />
        <div className="absolute -right-12 -top-20 h-[420px] w-[420px] rounded-full border border-[#66C7BC]/25" />
      </div>

      <div className="relative mx-auto grid min-h-[500px] max-w-7xl gap-12 px-5 py-14 sm:px-6 lg:grid-cols-[1.03fr_0.97fr] lg:items-center lg:px-8 lg:py-16">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#9DE0D8]"><span className="h-2 w-2 rounded-full bg-[#BF8813]" /> Organisation & compétences</span>
            <span className="rounded-full px-3 py-1 text-[11px] font-black" style={{ color: status.accent, backgroundColor: status.soft }}>{previewMode ? 'Aperçu du rôle Structure' : status.label}</span>
          </div>
          <h1 className="mt-5 max-w-[780px] text-4xl font-black leading-[1.02] tracking-[-0.045em] sm:text-5xl lg:text-[3.55rem]">
            Faire grandir les compétences de votre organisation.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/68 sm:text-lg">
            {visibleName ? `${visibleName} dispose ici d’une vue claire de son activité, de ses priorités et des espaces Omnia utiles à son développement.` : 'Votre accueil Structure rassemble l’essentiel de votre activité sans transformer cette page en centre d’administration.'}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={withPreview(priorityPath, previewMode)} className="inline-flex items-center gap-2 rounded-full bg-[#BF8813] px-5 py-3 text-sm font-black text-[#002050] transition hover:-translate-y-0.5">
              {priorityLabel} <ArrowRight size={16} />
            </Link>
            <Link to={withPreview('/structure/formations', previewMode)} className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15">
              Mes formations <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        <div className="relative mx-auto h-[340px] w-full max-w-[510px]" aria-label="Illustration abstraite de l’organisation">
          <div className="absolute left-1/2 top-1/2 h-[245px] w-[380px] -translate-x-1/2 -translate-y-1/2 -rotate-6 rounded-[38px] border border-white/10 bg-white/[0.04] shadow-[0_35px_80px_rgba(0,0,0,.20)]" />
          <div className="absolute left-1/2 top-1/2 h-[230px] w-[360px] -translate-x-1/2 -translate-y-1/2 rotate-[4deg] rounded-[36px] border border-[#66C7BC]/20 bg-[#0B4960]/45" />
          <div className="absolute left-1/2 top-1/2 w-[330px] -translate-x-1/2 -translate-y-1/2 rounded-[30px] border border-white/15 bg-[#073C55]/95 p-6 shadow-[0_28px_70px_rgba(0,0,0,.28)] backdrop-blur">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.17em] text-white/40">Priorité organisationnelle</p>
                <h2 className="mt-2 text-lg font-black tracking-[-0.02em]">{previewMode ? 'Vue Structure' : priorityTitle}</h2>
              </div>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0B817A]/35 text-[#B7EEE8]"><Network size={21} /></span>
            </div>
            <p className="mt-4 text-sm leading-6 text-white/58">{previewMode ? 'Les données privées de la Structure ne sont pas chargées pendant la prévisualisation Super-admin.' : priorityText}</p>
            <div className="mt-6 grid grid-cols-3 gap-3">
              {[{ icon: Users, label: 'Équipe' }, { icon: BookOpen, label: 'Formation' }, { icon: ShieldCheck, label: 'Suivi' }].map(item => {
                const Icon = item.icon;
                return <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-3 text-center"><Icon size={17} className="mx-auto text-[#9DE0D8]" /><span className="mt-2 block text-[10px] font-bold text-white/55">{item.label}</span></div>;
              })}
            </div>
          </div>
          <span className="absolute left-3 top-8 h-12 w-12 rounded-2xl border border-white/15 bg-[#0B817A]/45 shadow-[0_16px_35px_rgba(0,0,0,.18)]" />
          <span className="absolute right-2 top-16 h-8 w-8 rounded-full bg-[#BF8813] shadow-[0_14px_30px_rgba(191,136,19,.28)]" />
          <span className="absolute bottom-5 right-16 h-16 w-16 rounded-[22px] border border-white/15 bg-white/[0.06]" />
        </div>
      </div>
    </section>
  );
}

function SpacesStrip({ previewMode }: { previewMode: boolean }) {
  return (
    <section className="border-b border-[#DCE6E8] bg-white">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0B817A]">Accès direct</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#002050]">Vos espaces Omnia</h2>
          </div>
          <p className="hidden max-w-md text-right text-xs leading-5 text-slate-500 md:block">L’accueil vous oriente. Les fonctions détaillées restent dans chaque espace pour éviter les doublons.</p>
        </div>
        <div className="mt-7 flex snap-x gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
          {SPACES.map(space => {
            const Icon = space.icon;
            return (
              <Link key={space.path} to={withPreview(space.path, previewMode)} className="group min-w-[220px] flex-1 snap-start rounded-[22px] border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_38px_rgba(0,32,80,.08)]">
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ color: space.accent, backgroundColor: space.soft }}><Icon size={20} /></span>
                  <ArrowRight size={16} className="mt-2 text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#002050]" />
                </div>
                <strong className="mt-4 block text-sm font-black text-[#002050]">{space.label}</strong>
                <span className="mt-1.5 block text-xs leading-5 text-slate-500">{space.caption}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ActivitySnapshot({ data, previewMode }: Props) {
  const stats = data?.stats || {};
  const pendingCount = data?.pending_members?.length || 0;
  const metrics = [
    { label: 'Membres liés', value: previewMode ? '—' : String(stats.members ?? 0), icon: Users, accent: '#0B817A' },
    { label: 'Formations', value: previewMode ? '—' : String(stats.courses ?? 0), icon: BookOpen, accent: '#245D9B' },
    { label: 'Codes actifs', value: previewMode ? '—' : String(stats.active_codes ?? 0), icon: QrCode, accent: '#A56B12' },
    { label: 'Rattachements en attente', value: previewMode ? '—' : String(pendingCount), icon: Clock3, accent: pendingCount > 0 ? '#C45B24' : '#64748B' },
  ];

  return (
    <section className="bg-[#F5F9FA]">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.68fr_1.32fr] lg:items-start">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0B817A]">Organisation aujourd’hui</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-[#002050]">Une lecture rapide de votre activité.</h2>
            <p className="mt-4 max-w-md text-sm leading-7 text-slate-600">Uniquement les données déjà disponibles dans votre espace Structure : membres, formations, codes et demandes de rattachement.</p>
          </div>
          <div className="overflow-hidden rounded-[26px] border border-[#D9E5E7] bg-white shadow-[0_18px_44px_rgba(0,32,80,.05)]">
            <div className="grid sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric, index) => {
                const Icon = metric.icon;
                return (
                  <div key={metric.label} className={`relative p-5 ${index > 0 ? 'border-t border-slate-100 sm:border-l sm:border-t-0' : ''} ${index === 2 ? 'sm:border-l-0 xl:border-l' : ''}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50" style={{ color: metric.accent }}><Icon size={17} /></span>
                      <span className="text-3xl font-black tracking-[-0.04em] text-[#002050]">{metric.value}</span>
                    </div>
                    <p className="mt-5 text-xs font-bold leading-5 text-slate-500">{metric.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PendingWork({ data, previewMode }: Props) {
  const pending = previewMode ? [] : (data?.pending_members || []);
  const structure = data?.structure || null;

  return (
    <section className="bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:px-8">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#BF8813]">À traiter</p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-[#002050]">Ce qui mérite votre attention.</h2>
          <p className="mt-4 max-w-md text-sm leading-7 text-slate-600">Les priorités sont placées ici sans recopier les pages de gestion. Un clic vous amène directement à l’espace concerné.</p>
        </div>

        <div className="border-y border-slate-200">
          {previewMode ? (
            <div className="flex items-start gap-4 py-7">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EAF8F6] text-[#0B817A]"><Building2 size={18} /></span>
              <div><strong className="text-sm font-black text-[#002050]">Prévisualisation Structure</strong><p className="mt-1 text-xs leading-5 text-slate-500">Les demandes et données privées ne sont pas chargées pendant la prévisualisation.</p></div>
            </div>
          ) : pending.length > 0 ? (
            pending.slice(0, 4).map(member => (
              <Link key={member.id} to="/structure/rattachements" className="group flex items-center gap-4 border-b border-slate-100 py-5 last:border-b-0">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EAF8F6] text-sm font-black text-[#0B817A]">{(member.users?.full_name || '?').slice(0, 2).toUpperCase()}</span>
                <span className="min-w-0 flex-1"><strong className="block truncate text-sm font-extrabold text-[#002050]">{member.users?.full_name || 'Demande de rattachement'}</strong><span className="mt-1 block text-xs text-slate-500">En attente{member.requested_at ? ` · ${new Date(member.requested_at).toLocaleDateString('fr-FR')}` : ''}</span></span>
                <ArrowRight size={16} className="text-slate-300 transition group-hover:translate-x-1" />
              </Link>
            ))
          ) : structure?.status === 'changes_requested' ? (
            <Link to="/structure/profil" className="group flex items-start gap-4 py-7">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFF2E8] text-[#C45B24]"><ShieldCheck size={18} /></span>
              <span className="min-w-0 flex-1"><strong className="block text-sm font-black text-[#002050]">Profil à mettre à jour</strong><span className="mt-1 block text-xs leading-5 text-slate-500">L’Administration Omnia a demandé une modification de la Structure.</span></span>
              <ArrowRight size={16} className="mt-1 text-slate-300 transition group-hover:translate-x-1" />
            </Link>
          ) : structure?.status === 'pending_validation' ? (
            <div className="flex items-start gap-4 py-7">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFF7E6] text-[#A56B12]"><Clock3 size={18} /></span>
              <div><strong className="text-sm font-black text-[#002050]">Validation en cours</strong><p className="mt-1 text-xs leading-5 text-slate-500">Aucune action supplémentaire n’est indiquée pour le moment.</p></div>
            </div>
          ) : (
            <div className="flex items-start gap-4 py-7">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EAF8F2] text-[#13795B]"><CheckCircle2 size={18} /></span>
              <div><strong className="text-sm font-black text-[#002050]">Aucune demande de rattachement en attente</strong><p className="mt-1 text-xs leading-5 text-slate-500">Votre file de rattachement est actuellement à jour.</p></div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Improvements({ data, previewMode }: Props) {
  const stats = data?.stats || {};
  const structure = data?.structure || null;
  const pendingCount = data?.pending_members?.length || 0;
  const improvements: Improvement[] = [];

  if (previewMode) {
    improvements.push({ title: 'Aperçu des recommandations', description: 'En utilisation réelle, les recommandations dépendent de l’état de la Structure et de son activité.', path: '/structure/dashboard', label: 'Voir l’espace Structure', icon: Sparkles });
  } else {
    if (!structure) improvements.push({ title: 'Associer une organisation', description: 'Finalisez l’inscription de la Structure pour activer son espace organisationnel.', path: '/inscription/structure', label: 'Inscrire la Structure', icon: Building2 });
    if (structure?.status === 'changes_requested') improvements.push({ title: 'Corriger le profil Structure', description: structure.admin_comment || structure.modification_note || 'Une modification a été demandée avant validation.', path: '/structure/profil', label: 'Modifier le profil', icon: ShieldCheck });
    if (pendingCount > 0) improvements.push({ title: 'Réduire la file de rattachement', description: `${pendingCount} demande${pendingCount > 1 ? 's' : ''} attend${pendingCount > 1 ? 'ent' : ''} une décision.`, path: '/structure/rattachements', label: 'Traiter les demandes', icon: Users });
    if (structure?.status === 'validated' && Number(stats.members || 0) === 0) improvements.push({ title: 'Connecter vos premiers membres', description: 'Aucun membre lié n’apparaît encore dans les données actuelles de la Structure.', path: '/structure/codes', label: 'Gérer les codes', icon: QrCode });
    if (structure?.status === 'validated' && Number(stats.courses || 0) === 0) improvements.push({ title: 'Démarrer votre offre de formation', description: 'Aucune formation Structure n’apparaît encore dans votre activité.', path: '/structure/courses/new', label: 'Créer une formation', icon: Plus });
    if (structure?.status === 'validated' && Number(stats.active_codes || 0) === 0) improvements.push({ title: 'Préparer les rattachements', description: 'Aucun code Structure actif n’est actuellement disponible.', path: '/structure/codes', label: 'Créer ou activer un code', icon: QrCode });
    if (improvements.length === 0) improvements.push({ title: 'Approfondir le suivi organisationnel', description: 'Votre socle principal est en place. Retrouvez les indicateurs RH et les obligations dans l’espace de suivi dédié.', path: '/structure/suivi-rh', label: 'Ouvrir le suivi RH', icon: BarChart3 });
  }

  return (
    <section className="border-t border-[#DCE6E8] bg-[#F5F9FA]">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-9 lg:grid-cols-[0.62fr_1.38fr]">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#E6F5F2] text-[#0B817A]"><Sparkles size={21} /></div>
            <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-[#0B817A]">Améliorer votre organisation</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-[#002050]">Des prochaines étapes utiles, pas des conseils génériques.</h2>
            <p className="mt-4 max-w-sm text-sm leading-7 text-slate-600">Ces propositions utilisent uniquement l’état et les compteurs déjà disponibles dans votre espace Structure.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {improvements.slice(0, 4).map(item => {
              const Icon = item.icon;
              return (
                <Link key={`${item.path}-${item.title}`} to={withPreview(item.path, previewMode)} className="group rounded-[24px] border border-[#D9E5E7] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(0,32,80,.07)]">
                  <div className="flex items-start justify-between gap-4"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EAF8F6] text-[#0B817A]"><Icon size={18} /></span><ArrowRight size={16} className="mt-2 text-slate-300 transition group-hover:translate-x-1" /></div>
                  <h3 className="mt-5 text-base font-black tracking-[-0.02em] text-[#002050]">{item.title}</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{item.description}</p>
                  <span className="mt-5 inline-flex text-xs font-black text-[#0B817A]">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function StructureConnectedHomeSections(props: Props) {
  return (
    <>
      <StructureHero {...props} />
      <SpacesStrip previewMode={props.previewMode} />
      <ActivitySnapshot {...props} />
      <PendingWork {...props} />
      <Improvements {...props} />
    </>
  );
}
