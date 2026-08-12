import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowRight, FolderKanban } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { AdaptiveProjectsLayout } from '../../components/projects/ProjectsRoleLayout';
import { getProjectsNavigation, resolveProjectsAudience } from '../../lib/projectsNavigation';

function withPreview(path: string, searchParams: URLSearchParams) {
  if (searchParams.get('preview') !== 'true') return path;
  const [base, hash = ''] = path.split('#', 2);
  const [pathname, query = ''] = base.split('?', 2);
  const params = new URLSearchParams(query);
  params.set('preview', 'true');
  const role = searchParams.get('role');
  if (role) params.set('role', role);
  return `${pathname}?${params.toString()}${hash ? `#${hash}` : ''}`;
}

export default function ProjectsSectionHub() {
  const { user } = useAuth();
  const location = useLocation();
  const [params] = useSearchParams();
  const preview = params.get('preview') === 'true' && Boolean(user?.roles?.includes('super_admin'));
  const audience = resolveProjectsAudience(user?.roles, preview ? params.get('role') : null);
  const group = getProjectsNavigation(audience).find(item => item.path === location.pathname);
  if (!group || !group.children?.length) return <Navigate to={withPreview('/projects', params)} replace />;
  const Icon = group.icon || FolderKanban;
  return (
    <AdaptiveProjectsLayout>
      <main className="min-h-[70vh] bg-[#F7F4EE] px-4 py-8 sm:px-6 lg:py-12">
        <div className="mx-auto max-w-6xl">
          <section className="overflow-hidden rounded-[28px] border border-[#E6DED1] bg-white shadow-[0_20px_60px_rgba(0,32,80,.08)]">
            <div className="grid gap-0 lg:grid-cols-[.82fr_1.18fr]">
              <div className="relative overflow-hidden bg-[#002050] p-7 text-white sm:p-9">
                <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full border border-white/10" /><div className="absolute right-6 top-20 h-28 w-28 rotate-12 rounded-[28px] border border-[#D9A34C]/30 bg-white/5" />
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-[#E3B35C]"><Icon size={21} /></span>
                <p className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-[#E3B35C]">Omnia Projects</p>
                <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-4xl">{group.label}</h1>
                <p className="mt-4 max-w-md text-sm leading-7 text-blue-100">{group.description}</p>
              </div>
              <div className="p-6 sm:p-8"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#A96812]">Espaces de travail</p><h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#002050]">Choisissez l’action que vous voulez ouvrir</h2><div className="mt-6 divide-y divide-[#EEE8DE] border-y border-[#EEE8DE]">{group.children.map(child => { const ChildIcon = child.icon; return <Link key={child.path} to={withPreview(child.path, params)} className="group flex items-start gap-4 py-5"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F3EBDD] text-[#8C5510]"><ChildIcon size={19} /></span><span className="min-w-0 flex-1"><strong className="block text-base font-black text-[#002050]">{child.label}</strong><span className="mt-1 block text-sm leading-6 text-slate-500">{child.description}</span></span><ArrowRight size={18} className="mt-3 text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#A96812]" /></Link>; })}</div></div>
            </div>
          </section>
        </div>
      </main>
    </AdaptiveProjectsLayout>
  );
}
