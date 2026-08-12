import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Menu, X } from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  communityAudienceLabel,
  findCommunitySection,
  getCommunityNavigation,
  type CommunityAudience,
  type CommunityNavGroup,
} from '../../lib/communityNavigation';

const TEAL = '#0F766E';

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

function clean(path: string) {
  return path.split('#', 1)[0].split('?', 1)[0];
}

function activeFor(group: CommunityNavGroup, pathname: string) {
  const gp = clean(group.path);
  if (pathname === gp || pathname.startsWith(`${gp}/`)) return true;
  return Boolean(group.children?.some(child => {
    const cp = clean(child.path);
    return pathname === cp || pathname.startsWith(`${cp}/`);
  }));
}

export default function CommunityEcosystemNav({ audience }: { audience: CommunityAudience }) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const groups = useMemo(() => getCommunityNavigation(audience), [audience]);
  const activeSection = findCommunitySection(audience, location.pathname);
  const [hovered, setHovered] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setHovered(null);
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', close);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', close);
    };
  }, [mobileOpen]);

  return (
    <>
      <div className="relative z-30 border-b border-[#DDEBE8] bg-[#F8FCFB]/96 backdrop-blur-xl">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-5 lg:px-6">
          <div className="flex min-h-14 items-center gap-4">
            <Link to={withPreview('/forum', searchParams)} className="shrink-0 text-sm font-black tracking-[-.02em] text-[#002050] sm:text-base">
              Omnia <span style={{ color: TEAL }}>Communauté</span>
            </Link>
            <span className="hidden rounded-full bg-[#E8F6F3] px-2.5 py-1 text-[10px] font-black uppercase tracking-[.14em] text-[#0F766E] md:inline-flex">
              {communityAudienceLabel(audience)}
            </span>
            <nav className="hidden min-w-0 flex-1 items-center lg:flex" aria-label="Navigation Omnia Communauté">
              {groups.map(group => {
                const active = activeFor(group, location.pathname);
                const open = hovered === group.id && Boolean(group.children?.length);
                const Icon = group.icon;
                return (
                  <div
                    key={group.id}
                    className="relative"
                    onMouseEnter={() => setHovered(group.id)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(group.id)}
                    onBlur={event => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHovered(null);
                    }}
                  >
                    <Link
                      to={withPreview(group.path, searchParams)}
                      className={`relative inline-flex min-h-14 items-center gap-2 px-3 text-[13px] font-bold transition ${active ? 'text-[#002050]' : 'text-slate-500 hover:text-[#002050]'}`}
                    >
                      <Icon size={15} style={{ color: active ? TEAL : '#64748B' }} />
                      {group.label}
                      {group.children?.length ? <ChevronDown size={13} className="text-slate-400" /> : null}
                      <span className={`absolute inset-x-3 bottom-0 h-[2px] ${active ? 'bg-[#0F766E]' : 'bg-transparent'}`} />
                    </Link>
                    {open && group.children && (
                      <div className="absolute left-0 top-[calc(100%+1px)] z-50 w-[410px] rounded-b-2xl border border-t-0 border-[#DDEBE8] bg-white p-2 shadow-[0_24px_60px_rgba(0,32,80,.14)]">
                        <div className="px-3 pb-2 pt-1">
                          <p className="text-[10px] font-black uppercase tracking-[.14em] text-[#0F766E]">{group.label}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">{group.description}</p>
                        </div>
                        {group.children.map(child => {
                          const ChildIcon = child.icon;
                          return (
                            <Link key={child.path} to={withPreview(child.path, searchParams)} className="flex items-start gap-3 rounded-xl px-3 py-3 transition hover:bg-[#F4FAF8]">
                              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E8F6F3] text-[#0F766E]">
                                <ChildIcon size={15} />
                              </span>
                              <span>
                                <strong className="block text-sm font-bold text-[#002050]">{child.label}</strong>
                                <span className="mt-0.5 block text-xs leading-5 text-slate-500">{child.description}</span>
                              </span>
                            </Link>
                          );
                        })}
                        <Link to={withPreview(group.path, searchParams)} className="mt-1 flex items-center justify-end gap-1 px-3 py-2 text-xs font-black text-[#0F766E]">
                          Ouvrir la page {group.label}<ChevronRight size={13} />
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
            <button type="button" onClick={() => setMobileOpen(true)} className="ml-auto flex h-10 w-10 items-center justify-center rounded-xl border border-[#DDEBE8] bg-white text-[#002050] lg:hidden" aria-label="Ouvrir le menu Omnia Communauté">
              <Menu size={19} />
            </button>
          </div>
          {activeSection?.children?.length ? (
            <div className="flex items-center gap-1 overflow-x-auto border-t border-[#E8F2F0] py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Link
                to={withPreview(activeSection.path, searchParams)}
                className={`min-w-max rounded-lg px-3 py-2 text-xs font-bold ${location.pathname === clean(activeSection.path) ? 'bg-[#002050] text-white' : 'text-slate-500 hover:bg-white hover:text-[#002050]'}`}
              >
                Vue {activeSection.label}
              </Link>
              {activeSection.children.map(child => {
                const cp = clean(child.path);
                const active = location.pathname === cp || location.pathname.startsWith(`${cp}/`);
                return (
                  <Link
                    key={child.path}
                    to={withPreview(child.path, searchParams)}
                    className={`min-w-max rounded-lg px-3 py-2 text-xs font-bold transition ${active ? 'bg-[#E8F6F3] text-[#0F766E] ring-1 ring-[#CDE8E2]' : 'text-slate-500 hover:bg-white hover:text-[#002050]'}`}
                  >
                    {child.label}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-[90] lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation Omnia Communauté">
          <button type="button" className="absolute inset-0 bg-slate-950/45" onClick={() => setMobileOpen(false)} aria-label="Fermer le menu" />
          <aside className="absolute right-0 top-0 flex h-[100dvh] w-[min(92vw,400px)] flex-col bg-[#F8FCFB] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#DDEBE8] px-5 py-4">
              <div>
                <p className="font-black text-[#002050]">Omnia <span className="text-[#0F766E]">Communauté</span></p>
                <p className="mt-0.5 text-xs font-semibold text-slate-400">{communityAudienceLabel(audience)}</p>
              </div>
              <button type="button" onClick={() => setMobileOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-white" aria-label="Fermer">
                <X size={19} />
              </button>
            </div>
            <nav className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {groups.map(group => {
                const Icon = group.icon;
                return (
                  <div key={group.id} className="border-b border-[#E5F0EE] py-2">
                    <Link to={withPreview(group.path, searchParams)} onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-black text-[#002050]">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E8F6F3] text-[#0F766E]"><Icon size={16} /></span>
                      {group.label}
                    </Link>
                    {group.children?.length ? (
                      <div className="ml-[52px] border-l border-[#CFE6E1] pl-3">
                        {group.children.map(child => (
                          <Link key={child.path} to={withPreview(child.path, searchParams)} onClick={() => setMobileOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-white">
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
