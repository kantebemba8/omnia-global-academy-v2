import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Menu, X } from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  findFormationsSection,
  formationsAudienceLabel,
  getFormationsNavigation,
  type FormationsAudience,
  type FormationsNavGroup,
} from '../../lib/formationsNavigation';

const BLUE = '#002050';
const GOLD = '#BF8813';

function pathWithPreview(path: string, searchParams: URLSearchParams) {
  if (searchParams.get('preview') !== 'true') return path;
  const [base, hash = ''] = path.split('#', 2);
  const [pathname, query = ''] = base.split('?', 2);
  const params = new URLSearchParams(query);
  params.set('preview', 'true');
  const role = searchParams.get('role');
  if (role) params.set('role', role);
  return `${pathname}?${params.toString()}${hash ? `#${hash}` : ''}`;
}

function activeFor(group: FormationsNavGroup, pathname: string) {
  if (pathname === group.path || pathname.startsWith(`${group.path}/`)) return true;
  return Boolean(group.children?.some(child => pathname === child.path || pathname.startsWith(`${child.path}/`)));
}

export default function FormationsEcosystemNav({ audience, publicMode = false }: { audience: FormationsAudience; publicMode?: boolean }) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const groups = useMemo(() => getFormationsNavigation(audience), [audience]);
  const activeSection = findFormationsSection(audience, location.pathname);
  const [hovered, setHovered] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setHovered(null);
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const old = document.body.style.overflow;
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setMobileOpen(false);
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', close);
    return () => {
      document.body.style.overflow = old;
      window.removeEventListener('keydown', close);
    };
  }, [mobileOpen]);

  return (
    <>
      <div className={`${publicMode ? 'relative' : 'sticky top-0'} z-30 border-b border-slate-200 bg-white/96 backdrop-blur-xl`}>
        <div className="mx-auto max-w-[1440px] px-4 sm:px-5 lg:px-6">
          <div className="flex min-h-14 items-center gap-4">
            <Link to={pathWithPreview('/formations', searchParams)} className="shrink-0 text-sm font-black tracking-[-0.02em] text-[#002050] sm:text-base">
              Formations <span className="text-[#BF8813]">Omnia</span>
            </Link>
            <span className="hidden rounded-full bg-[#EEF3F8] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#42617F] md:inline-flex">{formationsAudienceLabel(audience)}</span>
            <nav className="hidden min-w-0 flex-1 items-center lg:flex" aria-label="Navigation de l’écosystème Formations">
              {groups.map(group => {
                const active = activeFor(group, location.pathname);
                const open = hovered === group.id && Boolean(group.children?.length);
                const Icon = group.icon;
                return (
                  <div key={group.id} className="relative" onMouseEnter={() => setHovered(group.id)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(group.id)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHovered(null); }}>
                    <Link
                      to={pathWithPreview(group.path, searchParams)}
                      className={`relative inline-flex min-h-14 items-center gap-2 px-3 text-[13px] font-bold transition ${active ? 'text-[#002050]' : 'text-slate-500 hover:text-[#002050]'}`}
                      aria-current={active ? 'page' : undefined}
                    >
                      <Icon size={15} style={{ color: active ? GOLD : '#64748B' }} />
                      {group.label}
                      {group.children?.length ? <ChevronDown size={13} className="text-slate-400" /> : null}
                      <span className={`absolute inset-x-3 bottom-0 h-[2px] ${active ? 'bg-[#BF8813]' : 'bg-transparent'}`} />
                    </Link>
                    {open && group.children && (
                      <div className="absolute left-0 top-[calc(100%+1px)] z-50 w-[340px] rounded-b-2xl border border-t-0 border-slate-200 bg-white p-2 shadow-[0_22px_55px_rgba(0,32,80,.14)]">
                        <div className="px-3 pb-2 pt-1"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#BF8813]">{group.label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{group.description}</p></div>
                        {group.children.map(child => {
                          const ChildIcon = child.icon;
                          return <Link key={child.path} to={pathWithPreview(child.path, searchParams)} className="flex items-start gap-3 rounded-xl px-3 py-3 transition hover:bg-slate-50"><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F2F5F9] text-[#002050]"><ChildIcon size={15} /></span><span><strong className="block text-sm font-bold text-[#002050]">{child.label}</strong><span className="mt-0.5 block text-xs leading-5 text-slate-500">{child.description}</span></span></Link>;
                        })}
                        <Link to={pathWithPreview(group.path, searchParams)} className="mt-1 flex items-center justify-end gap-1 px-3 py-2 text-xs font-black text-[#002050]">Ouvrir la page {group.label}<ChevronRight size={13} /></Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
            <button type="button" onClick={() => setMobileOpen(true)} className="ml-auto flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-[#002050] lg:hidden" aria-label="Ouvrir le menu Formations"><Menu size={19} /></button>
          </div>
          {activeSection?.children?.length ? (
            <div className="flex items-center gap-1 overflow-x-auto border-t border-slate-100 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Link to={pathWithPreview(activeSection.path, searchParams)} className={`min-w-max rounded-lg px-3 py-2 text-xs font-bold ${location.pathname === activeSection.path ? 'bg-[#002050] text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-[#002050]'}`}>Vue {activeSection.label}</Link>
              {activeSection.children.map(child => {
                const active = location.pathname === child.path || location.pathname.startsWith(`${child.path}/`);
                return <Link key={child.path} to={pathWithPreview(child.path, searchParams)} className={`min-w-max rounded-lg px-3 py-2 text-xs font-bold transition ${active ? 'bg-[#FFF7E7] text-[#8C6210] ring-1 ring-[#EEDDB5]' : 'text-slate-500 hover:bg-slate-50 hover:text-[#002050]'}`}>{child.label}</Link>;
              })}
            </div>
          ) : null}
        </div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation Formations">
          <button type="button" className="absolute inset-0 bg-slate-950/45" onClick={() => setMobileOpen(false)} aria-label="Fermer le menu" />
          <aside className="absolute right-0 top-0 flex h-[100dvh] w-[min(92vw,390px)] flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><p className="font-black text-[#002050]">Formations Omnia</p><p className="mt-0.5 text-xs font-semibold text-slate-400">{formationsAudienceLabel(audience)}</p></div><button type="button" onClick={() => setMobileOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-100" aria-label="Fermer"><X size={19} /></button></div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {groups.map(group => {
                const Icon = group.icon;
                return <div key={group.id} className="border-b border-slate-100 py-2"><Link to={pathWithPreview(group.path, searchParams)} className="flex items-center gap-3 rounded-xl px-3 py-3 font-black text-[#002050]"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F2F5F9]"><Icon size={16} /></span><span className="flex-1">{group.label}</span><ChevronRight size={15} className="text-slate-300" /></Link>{group.children?.length ? <div className="pb-2 pl-[54px]">{group.children.map(child => <Link key={child.path} to={pathWithPreview(child.path, searchParams)} className="block rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-[#002050]">{child.label}</Link>)}</div> : null}</div>;
              })}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
