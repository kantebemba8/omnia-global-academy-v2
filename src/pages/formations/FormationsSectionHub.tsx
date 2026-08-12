import type { ReactNode } from 'react';
import { Navigate, Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, ChevronRight, type LucideIcon } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  LearnerFormationsLayout,
  ModeratorFormationsLayout,
  ProfessorFormationsLayout,
  PublicFormationsLayout,
  StructureFormationsLayout,
} from '../../components/formations/FormationsRoleLayout';
import { getFormationsNavigation, resolveFormationsAudience, type FormationsAudience } from '../../lib/formationsNavigation';

function Frame({ audience, children }: { audience: FormationsAudience; children: ReactNode }) {
  if (audience === 'apprenant') return <LearnerFormationsLayout>{children}</LearnerFormationsLayout>;
  if (audience === 'professeur') return <ProfessorFormationsLayout>{children}</ProfessorFormationsLayout>;
  if (audience === 'structure') return <StructureFormationsLayout>{children}</StructureFormationsLayout>;
  if (audience === 'moderateur') return <ModeratorFormationsLayout>{children}</ModeratorFormationsLayout>;
  return <PublicFormationsLayout audience={audience}>{children}</PublicFormationsLayout>;
}

function withPreview(path: string, params: URLSearchParams, audience: FormationsAudience) {
  if (params.get('preview') !== 'true') return path;
  const join = path.includes('?') ? '&' : '?';
  return `${path}${join}preview=true&role=${audience}`;
}

export default function FormationsSectionHub() {
  const { sectionId = '' } = useParams();
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const preview = params.get('preview') === 'true' && Boolean(user?.roles?.includes('super_admin'));
  const audience = resolveFormationsAudience(user?.roles, preview ? params.get('role') : null);
  const section = getFormationsNavigation(audience).find(group => group.id === sectionId);

  if (loading) return <div className="grid min-h-screen place-items-center bg-white"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#002050]" /></div>;
  if (audience === 'super_admin' && !preview) return <Navigate to="/admin/courses" replace />;
  if (!section || !section.children?.length) return <Navigate to={withPreview('/formations', params, audience)} replace />;

  const SectionIcon = section.icon;
  return (
    <Frame audience={audience}>
      <section className="relative overflow-hidden border-b border-slate-200 bg-[linear-gradient(135deg,#F8FAFD_0%,#EEF4F8_58%,#FFF9EC_100%)]">
        <div className="pointer-events-none absolute right-[-100px] top-[-150px] h-[360px] w-[360px] rounded-full border border-[#BF8813]/15" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-5 py-12 sm:px-6 lg:px-8">
          <div className="flex max-w-3xl items-start gap-5"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#002050] text-[#F0C568]"><SectionIcon size={24}/></span><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#BF8813]">Formations · {audience}</p><h1 className="mt-2 text-4xl font-black tracking-[-0.045em] text-[#002050]">{section.label}</h1><p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">{section.description}</p></div></div>
        </div>
      </section>
      <section className="bg-white"><div className="mx-auto max-w-7xl px-5 py-12 sm:px-6 lg:px-8"><div className="max-w-2xl"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#245D7A]">Sous-espaces</p><h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-[#002050]">Choisissez la fonction dont vous avez besoin.</h2><p className="mt-2 text-sm leading-6 text-slate-500">Cette page reste le niveau d’organisation du menu. Les fonctions détaillées s’ouvrent ensuite sur leurs pages existantes.</p></div><div className="mt-7 grid gap-4 md:grid-cols-2">{section.children.map((child,index)=>{const Icon = child.icon as LucideIcon;return <Link key={child.path} to={withPreview(child.path,params,audience)} className="group relative overflow-hidden rounded-[24px] border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-[#C5D3E0] hover:shadow-[0_18px_45px_rgba(0,32,80,.08)]"><span className="absolute right-5 top-2 text-5xl font-black text-slate-50">0{index+1}</span><span className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF3F8] text-[#245D7A]"><Icon size={19}/></span><h3 className="relative mt-5 text-lg font-black text-[#002050]">{child.label}</h3><p className="relative mt-2 max-w-md text-sm leading-6 text-slate-500">{child.description}</p><span className="relative mt-5 inline-flex items-center gap-1 text-xs font-black text-[#002050]">Ouvrir<ArrowRight size={13} className="transition group-hover:translate-x-1"/></span></Link>})}</div><Link to={withPreview('/formations',params,audience)} className="mt-8 inline-flex items-center gap-1 text-sm font-black text-slate-500 hover:text-[#002050]"><ChevronRight size={14} className="rotate-180"/>Retour à l’accueil Formations</Link></div></section>
    </Frame>
  );
}
