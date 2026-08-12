import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Menu, X } from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { findCareerSection, getCareerNavigation, type CareerAudience, type CareerNavGroup } from '../../lib/careerNavigation';

const BLUE = '#002050';
const GOLD = '#BF8813';

function withPreview(path: string, searchParams: URLSearchParams) {
  if (searchParams.get('preview') !== 'true') return path;
  const [base, hash = ''] = path.split('#', 2);
  const [pathname, query = ''] = base.split('?', 2);
  const params = new URLSearchParams(query);
  params.set('preview', 'true');
  return `${pathname}?${params.toString()}${hash ? `#${hash}` : ''}`;
}

function activeFor(group: CareerNavGroup, pathname: string) {
  if (group.id === 'accueil') return pathname === group.path;
  if (pathname === group.path || pathname.startsWith(`${group.path}/`)) return true;
  return Boolean(group.children?.some(child => {
    const childPath = child.path.split('?', 1)[0];
    return pathname === childPath || pathname.startsWith(`${childPath}/`);
  }));
}

export default function CareerEcosystemNav({ audience }: { audience: CareerAudience }) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const groups = useMemo(() => getCareerNavigation(audience), [audience]);
  const activeSection = findCareerSection(audience, location.pathname);
  const [hovered, setHovered] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setHovered(null); setMobileOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setMobileOpen(false);
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onKey); };
  }, [mobileOpen]);

  return (
    <>
      <div className="relative z-30 border-b border-slate-200 bg-[#FCFBF8]/95 backdrop-blur-xl">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-5 lg:px-6">
          <div className="flex min-h-14 items-center gap-4">
            <Link to={withPreview(audience === 'apprenant' ? '/omnia-career' : '/career-studio', searchParams)} className="shrink-0 text-sm font-black tracking-[-0.02em] text-[#002050] sm:text-base">
              Omnia <span className="text-[#BF8813]">Career</span>
            </Link>
            {audience === 'apprenant' && <span className="hidden rounded-full bg-[#EEF1F5] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#53657A] md:inline-flex">Studio personnel</span>}
            <nav className="hidden min-w-0 flex-1 items-center lg:flex" aria-label="Navigation Omnia Career">
              {groups.map(group => {
                const active = activeFor(group, location.pathname);
                const open = hovered === group.id && Boolean(group.children?.length);
                const Icon = group.icon;
                return (
                  <div key={group.id} className="relative" onMouseEnter={() => setHovered(group.id)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(group.id)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHovered(null); }}>
                    <Link to={withPreview(group.path, searchParams)} className={`relative inline-flex min-h-14 items-center gap-2 px-3 text-[13px] font-bold transition ${active ? 'text-[#002050]' : 'text-slate-500 hover:text-[#002050]'}`} aria-current={active ? 'page' : undefined}>
                      <Icon size={15} style={{ color: active ? GOLD : '#64748B' }} />
                      {group.label}
                      {group.children?.length ? <ChevronDown size={13} className="text-slate-400" /> : null}
                      <span className={`absolute inset-x-3 bottom-0 h-[2px] ${active ? 'bg-[#BF8813]' : 'bg-transparent'}`} />
                    </Link>
                    {open && group.children && (
                      <div className="absolute left-0 top-[calc(100%+1px)] z-50 w-[350px] rounded-b-2xl border border-t-0 border-slate-200 bg-white p-2 shadow-[0_22px_55px_rgba(0,32,80,.14)]">
                        <div className="px-3 pb-2 pt-1"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#BF8813]">{group.label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{group.description}</p></div>
                        {group.children.map(child => {
                          const ChildIcon = child.icon;
                          return <Link key={child.path} to={withPreview(child.path, searchParams)} className="flex items-start gap-3 rounded-xl px-3 py-3 transition hover:bg-[#F8F6F0]"><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F3F0E8] text-[#002050]"><ChildIcon size={15} /></span><span><strong className="block text-sm font-bold text-[#002050]">{child.label}</strong><span className="mt-0.5 block text-xs leading-5 text-slate-500">{child.description}</span></span></Link>;
                        })}
                        <Link to={withPreview(group.path, searchParams)} className="mt-1 flex items-center justify-end gap-1 px-3 py-2 text-xs font-black text-[#002050]">Ouvrir la page {group.label}<ChevronRight size={13} /></Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
            <button type="button" onClick={() => setMobileOpen(true)} className="ml-auto flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#002050] lg:hidden" aria-label="Ouvrir le menu Omnia Career"><Menu size={19} /></button>
          </div>
          {activeSection?.children?.length ? (
            <div className="flex items-center gap-1 overflow-x-auto border-t border-slate-100 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Link to={withPreview(activeSection.path, searchParams)} className={`min-w-max rounded-lg px-3 py-2 text-xs font-bold ${location.pathname === activeSection.path ? 'bg-[#002050] text-white' : 'text-slate-500 hover:bg-white hover:text-[#002050]'}`}>Vue {activeSection.label}</Link>
              {activeSection.children.map(child => {
                const childPath = child.path.split('?', 1)[0];
                const active = location.pathname === childPath || location.pathname.startsWith(`${childPath}/`);
                return <Link key={child.path} to={withPreview(child.path, searchParams)} className={`min-w-max rounded-lg px-3 py-2 text-xs font-bold transition ${active ? 'bg-[#FFF7E7] text-[#8C6210] ring-1 ring-[#EEDDB5]' : 'text-slate-500 hover:bg-white hover:text-[#002050]'}`}>{child.label}</Link>;
              })}
            </div>
          ) : null}
        </div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-[90] lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation Omnia Career">
          <button type="button" className="absolute inset-0 bg-slate-950/45" onClick={() => setMobileOpen(false)} aria-label="Fermer le menu" />
          <aside className="absolute right-0 top-0 flex h-[100dvh] w-[min(92vw,390px)] flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><p className="font-black text-[#002050]">Omnia <span className="text-[#BF8813]">Career</span></p><p className="mt-0.5 text-xs font-semibold text-slate-400">{audience === 'apprenant' ? 'Studio personnel' : 'Découvrir'}</p></div><button type="button" onClick={() => setMobileOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-100" aria-label="Fermer"><X size={19} /></button></div>
            <nav className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {groups.map(group => {
                const Icon = group.icon;
                return <div key={group.id} className="border-b border-slate-100 py-2"><Link to={withPreview(group.path, searchParams)} onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-black text-[#002050]"><Icon size={17} className="text-[#BF8813]" />{group.label}</Link>{group.children?.length ? <div className="ml-7 border-l border-slate-200 pl-3">{group.children.map(child => <Link key={child.path} to={withPreview(child.path, searchParams)} onClick={() => setMobileOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">{child.label}</Link>)}</div> : null}</div>;
              })}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
