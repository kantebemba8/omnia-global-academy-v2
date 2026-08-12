import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import CoachingLayout from '../../components/coaching/CoachingLayout';
import { useAuth } from '../../hooks/useAuth';
import { findCoachingSection, resolveCoachingAudience } from '../../lib/coachingNavigation';

function withPreview(path: string, params: URLSearchParams) {
  if (params.get('preview') !== 'true') return path;
  const [base, hash = ''] = path.split('#', 2);
  const [pathname, query = ''] = base.split('?', 2);
  const next = new URLSearchParams(query);
  next.set('preview', 'true');
  const role = params.get('role');
  if (role) next.set('role', role);
  return `${pathname}?${next.toString()}${hash ? `#${hash}` : ''}`;
}

export default function CoachingSectionHub() {
  const location = useLocation();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const preview = params.get('preview') === 'true' && Boolean(user?.roles?.includes('super_admin'));
  const audience = resolveCoachingAudience(user?.roles, preview ? params.get('role') : null);
  const effectiveAudience = audience === 'super_admin' ? 'public' : audience;
  const section = findCoachingSection(effectiveAudience, location.pathname);

  return (
    <CoachingLayout>
      <main className="mx-auto max-w-[1320px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        {section?.children?.length ? (
          <>
            <div className="max-w-3xl">
              <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#356C63]">Omnia Coaching · {section.label}</p>
              <h1 className="mt-3 text-3xl font-black tracking-[-.04em] text-[#002050] md:text-4xl">{section.label}</h1>
              <p className="mt-4 text-base leading-7 text-slate-600">{section.description}</p>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {section.children.map(child => {
                const Icon = child.icon;
                return (
                  <Link key={child.path} to={withPreview(child.path, params)} className="group flex min-h-[190px] flex-col rounded-[24px] border border-[#DCE7E1] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(0,32,80,.09)]">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF3F0] text-[#356C63]"><Icon size={19} /></span>
                    <h2 className="mt-6 text-lg font-black text-[#002050]">{child.label}</h2>
                    <p className="mt-2 flex-1 text-sm leading-6 text-slate-500">{child.description}</p>
                    <span className="mt-5 inline-flex items-center gap-2 text-xs font-black text-[#356C63]">Ouvrir <ArrowRight size={14} className="transition group-hover:translate-x-1" /></span>
                  </Link>
                );
              })}
            </div>
          </>
        ) : (
          <div className="rounded-[28px] border border-[#DCE7E1] bg-white p-8 text-center">
            <h1 className="text-2xl font-black text-[#002050]">Cette rubrique n’est pas disponible pour ce rôle.</h1>
            <p className="mt-3 text-sm text-slate-500">La navigation Omnia Coaching n’affiche que les fonctions correspondant à vos accès.</p>
            <Link to={withPreview('/coaching', params)} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#002050] px-4 py-2.5 text-sm font-black text-white">Retour à Omnia Coaching <ArrowRight size={15} /></Link>
          </div>
        )}
      </main>
    </CoachingLayout>
  );
}
