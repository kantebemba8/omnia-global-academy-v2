import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Menu, X } from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  coachingAudienceLabel,
  findCoachingSection,
  getCoachingNavigation,
  type CoachingAudience,
  type CoachingNavGroup,
} from '../../lib/coachingNavigation';

const PETROL = '#356C63';

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

function clean(path: string) {
  return path.split('#', 1)[0].split('?', 1)[0];
}

function activeFor(group: CoachingNavGroup, pathname: string) {
  const gp = clean(group.path);
  if (pathname === gp || pathname.startsWith(`${gp}/`)) return true;
  return Boolean(group.children?.some(child => {
    const cp = clean(child.path);
    return pathname === cp || pathname.startsWith(`${cp}/`);
  }));
}

export default function CoachingEcosystemNav({ audience, publicMode = false }: { audience: CoachingAudience; publicMode?: boolean }) {
  const location = useLocation();
  const [params] = useSearchParams();
  const groups = useMemo(() => getCoachingNavigation(audience), [audience]);
  const activeSection = findCoachingSection(audience, location.pathname);
  const [hovered, setHovered] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setHovered(null);
    setMobileOpen(false);
  }, [location.pathname, location.search]);

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
      <div className={`${publicMode ? 'relative' : 'sticky top-0'} z-30 border-b border-[#DCE7E1] bg-[#FBFCFA]/96 backdrop-blur-xl`}>
        <div className="mx-auto max-w-[1440px] px-4 sm:px-5 lg:px-6">
          <div className="flex min-h-14 items-center gap-4">
            <Link to={withPreview('/coaching', params)} className="shrink-0 text-sm font-black tracking-[-.02em] text-[#002050] sm:text-base">
              Omnia <span style={{ color: PETROL }}>Coaching</span>
            </Link>
            <span className="hidden rounded-full bg-[#EAF3F0] px-2.5 py-1 text-[10px] font-black uppercase tracking-[.14em] text-[#356C63] md:inline-flex">
              {coachingAudienceLabel(audience)}
            </span>
            <nav className="hidden min-w-0 flex-1 items-center lg:flex" aria-label="Navigation Omnia Coaching">
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
                      to={withPreview(group.path, params)}
                      className={`relative inline-flex min-h-14 items-center gap-2 px-3 text-[13px] font-bold transition ${active ? 'text-[#002050]' : 'text-slate-500 hover:text-[#002050]'}`}
                    >
                      <Icon size={15} style={{ color: active ? PETROL : '#64748B' }} />
                      {group.label}
                      {group.children?.length ? <ChevronDown size={13} className="text-slate-400" /> : null}
                      <span className={`absolute inset-x-3 bottom-0 h-[2px] ${active ? 'bg-[#356C63]' : 'bg-transparent'}`} />
                    </Link>
                    {open && group.children && (
                      <div className="absolute left-0 top-[calc(100%+1px)] z-50 w-[420px] rounded-b-2xl border border-t-0 border-[#DCE7E1] bg-white p-2 shadow-[0_24px_60px_rgba(0,32,80,.14)]">
                        <div className="px-3 pb-2 pt-1">
                          <p className="text-[10px] font-black uppercase tracking-[.14em] text-[#356C63]">{group.label}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">{group.description}</p>
                        </div>
                        {group.children.map(child => {
                          const ChildIcon = child.icon;
                          return (
                            <Link key={child.path} to={withPreview(child.path, params)} className="flex items-start gap-3 rounded-xl px-3 py-3 transition hover:bg-[#F4F8F6]">
                              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EAF3F0] text-[#356C63]">
                                <ChildIcon size={15} />
                              </span>
                              <span>
                                <strong className="block text-sm font-bold text-[#002050]">{child.label}</strong>
                                <span className="mt-0.5 block text-xs leading-5 text-slate-500">{child.description}</span>
                              </span>
                            </Link>
                          );
                        })}
                        <Link to={withPreview(group.path, params)} className="mt-1 flex items-center justify-end gap-1 px-3 py-2 text-xs font-black text-[#356C63]">
                          Ouvrir la page {group.label}<ChevronRight size={13} />
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="ml-auto flex h-10 w-10 items-center justify-center rounded-xl border border-[#DCE7E1] bg-white text-[#002050] lg:hidden"
              aria-label="Ouvrir le menu Omnia Coaching"
            >
              <Menu size={19} />
            </button>
          </div>
          {activeSection?.children?.length ? (
            <div className="flex items-center gap-1 overflow-x-auto border-t border-[#E7EEE9] py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Link
                to={withPreview(activeSection.path, params)}
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
                    to={withPreview(child.path, params)}
                    className={`min-w-max rounded-lg px-3 py-2 text-xs font-bold transition ${active ? 'bg-[#EAF3F0] text-[#356C63] ring-1 ring-[#CFE0D9]' : 'text-slate-500 hover:bg-white hover:text-[#002050]'}`}
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
        <div className="fixed inset-0 z-[90] lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation Omnia Coaching">
          <button type="button" className="absolute inset-0 bg-slate-950/45" onClick={() => setMobileOpen(false)} aria-label="Fermer le menu" />
          <aside className="absolute right-0 top-0 flex h-[100dvh] w-[min(92vw,400px)] flex-col bg-[#FBFCFA] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#DCE7E1] px-5 py-4">
              <div>
                <p className="font-black text-[#002050]">Omnia <span className="text-[#356C63]">Coaching</span></p>
                <p className="mt-0.5 text-xs font-semibold text-slate-400">{coachingAudienceLabel(audience)}</p>
              </div>
              <button type="button" onClick={() => setMobileOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-white" aria-label="Fermer">
                <X size={19} />
              </button>
            </div>
            <nav className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {groups.map(group => {
                const Icon = group.icon;
                return (
                  <div key={group.id} className="border-b border-[#E7EEE9] py-2">
                    <Link to={withPreview(group.path, params)} onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-black text-[#002050]">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF3F0] text-[#356C63]"><Icon size={16} /></span>
                      {group.label}
                    </Link>
                    {group.children?.length ? (
                      <div className="ml-[52px] border-l border-[#CFE0D9] pl-3">
                        {group.children.map(child => (
                          <Link key={child.path} to={withPreview(child.path, params)} onClick={() => setMobileOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-white">
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
