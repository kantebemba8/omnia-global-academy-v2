import { ArrowRight } from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import CommunityLayout from '../../components/community/CommunityLayout';
import { useAuth } from '../../hooks/useAuth';
import { findCommunitySection, resolveCommunityAudience } from '../../lib/communityNavigation';

function withPreview(path: string, params: URLSearchParams) {
  if (params.get('preview') !== 'true') return path;
  const next = new URLSearchParams();
  next.set('preview', 'true');
  const role = params.get('role');
  if (role) next.set('role', role);
  return `${path}${path.includes('?') ? '&' : '?'}${next.toString()}`;
}

export default function CommunitySectionHub() {
  const location = useLocation();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const preview = params.get('preview') === 'true' && Boolean(user?.roles?.includes('super_admin'));
  const audience = resolveCommunityAudience(user?.roles, preview ? params.get('role') : null);
  const section = findCommunitySection(audience === 'super_admin' ? 'public' : audience, location.pathname);

  return (
    <CommunityLayout>
      <main className="min-h-[70vh] bg-[#F8FCFB]">
        <section className="border-b border-[#DDEBE8] bg-white">
          <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
            <p className="text-xs font-black uppercase tracking-[.18em] text-[#0F766E]">Omnia Communauté · {section?.label || 'Espace'}</p>
            <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-[-.04em] text-[#002050] md:text-4xl">{section?.label || 'Espace Communauté'}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{section?.description || 'Choisissez l’espace correspondant à votre besoin.'}</p>
          </div>
        </section>
        <section className="mx-auto max-w-6xl px-5 py-9 md:px-8">
          <div className="overflow-hidden rounded-[28px] border border-[#DDEBE8] bg-white">
            {section?.children?.map((child, index) => {
              const Icon = child.icon;
              return (
                <Link key={child.path} to={withPreview(child.path, params)} className={`group grid gap-3 px-5 py-6 transition hover:bg-[#F4FAF8] md:grid-cols-[54px_220px_1fr_auto] md:items-center ${index ? 'border-t border-[#E6F0EE]' : ''}`}>
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E8F6F3] text-[#0F766E]"><Icon size={19} /></span>
                  <strong className="text-sm font-black text-[#002050]">{child.label}</strong>
                  <span className="text-sm leading-6 text-slate-500">{child.description}</span>
                  <span className="flex items-center gap-2 text-xs font-black text-[#0F766E]">Ouvrir <ArrowRight size={14} className="transition group-hover:translate-x-1" /></span>
                </Link>
              );
            })}
            {!section?.children?.length && <div className="p-8 text-sm text-slate-500">Cette page ne contient pas de sous-menu supplémentaire.</div>}
          </div>
        </section>
      </main>
    </CommunityLayout>
  );
}
