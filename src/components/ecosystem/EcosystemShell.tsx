import { type CSSProperties, type ReactNode, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, Home, LogIn, Menu, UserPlus, X, type LucideIcon } from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import UserAccountMenu from '../UserAccountMenu';
import { PageFooter } from '../PageFooter';
import { ECOSYSTEMS, ecosystemEntryPath, getEcosystem, type EcosystemId } from '../../lib/ecosystemRegistry';

export type EcosystemNavChild = {
  label: string;
  path: string;
  description?: string;
  icon?: LucideIcon;
};

export type EcosystemNavGroup = {
  id: string;
  label: string;
  path: string;
  description?: string;
  icon?: LucideIcon;
  children?: EcosystemNavChild[];
};

type ShellProps = {
  ecosystem: EcosystemId;
  audienceLabel: string;
  navigation: EcosystemNavGroup[];
  search?: ReactNode;
  children: ReactNode;
  dashboardPath?: string;
};

type StandaloneProps = {
  ecosystem: EcosystemId;
  audienceLabel: string;
  navigation: EcosystemNavGroup[];
  publicMode?: boolean;
};

function cleanPath(path: string) {
  return path.split('#', 1)[0].split('?', 1)[0];
}

function matches(path: string, pathname: string) {
  const base = cleanPath(path);
  return pathname === base || pathname.startsWith(`${base}/`);
}

function groupIsActive(group: EcosystemNavGroup, pathname: string) {
  const base = cleanPath(group.path);
  if (group.id === 'accueil') return pathname === base;
  if (matches(group.path, pathname)) return true;
  return Boolean(group.children?.some(child => matches(child.path, pathname)));
}

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

function storedRoles(): string[] {
  try {
    return JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles || [];
  } catch {
    return [];
  }
}

function EcosystemBrand({ ecosystem, href, inverse = false }: { ecosystem: EcosystemId; href: string; inverse?: boolean }) {
  const theme = getEcosystem(ecosystem);
  return (
    <Link to={href} className="flex min-w-0 shrink-0 items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF8813]" aria-label={`Accueil Omnia ${theme.name}`}>
      <img src="/omnia-sidebar-logo.png" alt="" className="h-9 w-9 shrink-0 object-contain" />
      <span className="min-w-0 whitespace-nowrap text-[14px] font-black tracking-[0.055em]">
        <span style={{ color: inverse ? '#FFFFFF' : '#002050' }}>Omnia</span>{' '}
        <span style={{ color: theme.accent }}>{theme.name}</span>
      </span>
    </Link>
  );
}

function PrimaryLinks({ navigation, pathname, params, onNavigate, compact = false, accent = '#BF8813' }: { navigation: EcosystemNavGroup[]; pathname: string; params: URLSearchParams; onNavigate?: () => void; compact?: boolean; accent?: string }) {
  return (
    <nav className={compact ? 'space-y-1' : 'flex min-w-max items-center'} aria-label="Navigation de l’écosystème">
      {navigation.map(group => {
        const active = groupIsActive(group, pathname);
        const Icon = group.icon;
        return (
          <Link
            key={group.id}
            to={withPreview(group.path, params)}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={compact
              ? `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold ${active ? 'bg-white text-[#002050] shadow-sm' : 'text-slate-600 hover:bg-white/70 hover:text-[#002050]'}`
              : `group relative inline-flex min-h-14 items-center gap-2 px-3 text-[13px] font-bold transition ${active ? 'text-[#002050]' : 'text-slate-500 hover:text-[#002050]'}`}
          >
            {Icon ? <Icon size={15} style={{ color: active ? accent : '#64748B' }} /> : null}
            <span>{group.label}</span>
            {group.children?.length ? <ChevronRight size={13} className="text-slate-300" /> : null}
            {!compact && <span className="absolute inset-x-3 bottom-0 h-[2px] transition-colors" style={{ background: active ? accent : 'transparent' }} />}
          </Link>
        );
      })}
    </nav>
  );
}

function childIsActive(path: string, pathname: string, search: string, hash: string) {
  const [withoutHash, rawHash = ''] = path.split('#', 2);
  const [base, rawQuery = ''] = withoutHash.split('?', 2);
  if (cleanPath(base) !== pathname && !pathname.startsWith(`${cleanPath(base)}/`)) return false;
  if (rawHash && hash !== `#${rawHash}`) return false;
  if (!rawHash && hash) return false;
  if (rawQuery) {
    const expected = new URLSearchParams(rawQuery);
    const current = new URLSearchParams(search);
    for (const [key, value] of expected.entries()) if (current.get(key) !== value) return false;
  }
  return true;
}

function SectionContext({ ecosystem, group, pathname, search, hash, params }: { ecosystem: EcosystemId; group: EcosystemNavGroup; pathname: string; search: string; hash: string; params: URLSearchParams }) {
  const theme = getEcosystem(ecosystem);
  const onHub = cleanPath(group.path) === pathname;
  const backPath = onHub ? theme.rootPath : group.path;
  const backLabel = onHub ? `Omnia ${theme.name}` : group.label;
  return (
    <div className="relative z-20 flex-shrink-0 border-b" style={{ borderColor: theme.border, background: theme.panel }}>
      <div className="mx-auto max-w-[1480px] px-4 py-3 sm:px-5 lg:px-6">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <Link to={withPreview(backPath, params)} className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-xs font-black text-[#002050] hover:bg-black/[0.03]">
            <ArrowLeft size={15} style={{ color: theme.accent }} /> {backLabel}
          </Link>
          <div className="h-5 w-px bg-slate-200" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: theme.accent }}>Domaine</p>
            <strong className="block truncate text-sm font-black text-[#002050]">{group.label}</strong>
          </div>
          <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label={`Sous-menus ${group.label}`}>
            {group.children?.map(child => {
              const active = childIsActive(child.path, pathname, search, hash);
              return (
                <Link key={child.path} to={withPreview(child.path, params)} className={`min-w-max rounded-lg px-3 py-2 text-xs font-bold transition ${active ? 'text-white' : 'text-slate-600 hover:bg-black/[0.035] hover:text-[#002050]'}`} style={active ? { background: theme.secondary } : undefined}>
                  {child.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}

function EcosystemSwitcher({ ecosystem, params, mobile = false, onNavigate }: { ecosystem: EcosystemId; params: URLSearchParams; mobile?: boolean; onNavigate?: () => void }) {
  const roles = storedRoles();
  const previewRole = params.get('preview') === 'true' ? params.get('role') : null;
  return (
    <nav className={mobile ? 'grid grid-cols-2 gap-2' : 'flex min-w-max items-center'} aria-label="Changer d’écosystème Omnia">
      {ECOSYSTEMS.map(item => {
        const active = item.id === ecosystem;
        const path = ecosystemEntryPath(item.id, roles, previewRole);
        return (
          <Link
            key={item.id}
            to={withPreview(path, params)}
            onClick={onNavigate}
            className={mobile
              ? `rounded-xl border px-3 py-2.5 text-xs font-black ${active ? 'text-[#002050]' : 'border-slate-200 bg-white text-slate-600'}`
              : `relative inline-flex min-h-9 items-center px-3 text-[11px] font-bold transition ${active ? 'text-[#002050]' : 'text-slate-500 hover:text-[#002050]'}`}
            style={mobile && active ? { borderColor: item.accent, background: item.soft } : undefined}
          >
            {item.navLabel}
            {!mobile && active && <span className="absolute inset-x-3 bottom-0 h-[2px]" style={{ background: item.accent }} />}
          </Link>
        );
      })}
    </nav>
  );
}


export function EcosystemPublicHeader({
  ecosystem,
  navigation,
  search,
}: {
  ecosystem: EcosystemId;
  navigation: EcosystemNavGroup[];
  search?: ReactNode;
}) {
  const location = useLocation();
  const [params] = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);
  const [hasUser, setHasUser] = useState(() => {
    try { return Boolean(localStorage.getItem('omnia_user')); }
    catch { return false; }
  });
  const theme = getEcosystem(ecosystem);

  useEffect(() => setMenuOpen(false), [location.pathname, location.search, location.hash]);

  useEffect(() => {
    const refresh = () => {
      try { setHasUser(Boolean(localStorage.getItem('omnia_user'))); }
      catch { setHasUser(false); }
    };
    window.addEventListener('omnia:session-changed', refresh);
    window.addEventListener('omnia:profile-updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('omnia:session-changed', refresh);
      window.removeEventListener('omnia:profile-updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const before = document.body.style.overflow;
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setMenuOpen(false);
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', close);
    return () => {
      document.body.style.overflow = before;
      window.removeEventListener('keydown', close);
    };
  }, [menuOpen]);

  return (
    <>
      <header className="sticky top-0 z-50 flex-shrink-0 border-b bg-white/95 backdrop-blur-xl" style={{ borderColor: theme.border }}>
        <div className="mx-auto flex min-h-[72px] max-w-[1480px] items-center gap-3 px-4 sm:px-5 lg:gap-4 lg:px-6">
          <EcosystemBrand ecosystem={ecosystem} href={theme.publicPath} />

          <div className="hidden min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:block">
            <PrimaryLinks navigation={navigation} pathname={location.pathname} params={params} accent={theme.accent} />
          </div>

          {search ? (
            <div className="ml-auto hidden w-[min(30vw,390px)] min-w-[220px] lg:block">
              {search}
            </div>
          ) : null}

          <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
            {hasUser ? (
              <UserAccountMenu />
            ) : (
              <div className="hidden items-center gap-2 2xl:flex">
                <Link to="/connexion" className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-bold text-[#002050] transition hover:bg-slate-50">
                  Se connecter
                </Link>
                <Link to="/inscription" className="inline-flex h-10 items-center rounded-xl bg-[#002050] px-3.5 text-sm font-bold text-white transition hover:bg-[#00183E]">
                  Créer un compte
                </Link>
              </div>
            )}

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#002050] transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF8813]"
              aria-label={`Ouvrir le menu Omnia ${theme.name}`}
              aria-expanded={menuOpen}
            >
              <Menu size={19} />
            </button>
          </div>
        </div>

        {search ? (
          <div className="border-t px-4 py-2.5 lg:hidden" style={{ borderColor: theme.border, background: theme.panel }}>
            <div className="mx-auto max-w-[1480px]">{search}</div>
          </div>
        ) : null}
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-[95]" role="dialog" aria-modal="true" aria-label={`Navigation Omnia ${theme.name}`}>
          <button type="button" className="absolute inset-0 bg-slate-950/50" onClick={() => setMenuOpen(false)} aria-label="Fermer le menu" />
          <aside className="absolute right-0 top-0 flex h-[100dvh] w-[min(92vw,390px)] flex-col bg-[#F8FAFC] shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <EcosystemBrand ecosystem={ecosystem} href={theme.publicPath} />
              <button type="button" onClick={() => setMenuOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-100" aria-label="Fermer">
                <X size={19} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {search ? <div className="mb-5">{search}</div> : null}

              <Link
                to="/accueil"
                onClick={() => setMenuOpen(false)}
                className="mb-2 flex items-center gap-3 rounded-xl bg-white px-3 py-3 text-sm font-black text-[#002050] shadow-sm"
              >
                <Home size={16} style={{ color: theme.accent }} />
                Accueil
              </Link>

              <div className="my-4 border-t border-slate-200" />
              <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: theme.accent }}>
                Omnia {theme.name}
              </p>
              <PrimaryLinks navigation={navigation} pathname={location.pathname} params={params} compact accent={theme.accent} onNavigate={() => setMenuOpen(false)} />
            </div>

            {!hasUser && (
              <div className="space-y-2 border-t border-slate-200 bg-white px-5 pb-6 pt-5">
                <Link to="/connexion" onClick={() => setMenuOpen(false)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#002050] py-3 text-sm font-bold text-[#002050]">
                  <LogIn size={16} /> Se connecter
                </Link>
                <Link to="/inscription" onClick={() => setMenuOpen(false)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#002050] py-3 text-sm font-bold text-white">
                  <UserPlus size={16} /> Créer un compte
                </Link>
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}

export function EcosystemConnectedHeader({ ecosystem, audienceLabel, navigation, search, dashboardPath }: Omit<ShellProps, 'children'>) {
  const location = useLocation();
  const [params] = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = getEcosystem(ecosystem);
  const roles = storedRoles();
  const previewRole = params.get('preview') === 'true' ? params.get('role') : null;
  const ecosystemHomePath = ecosystemEntryPath(ecosystem, roles, previewRole);
  const activeGroup = useMemo(() => navigation.find(group => groupIsActive(group, location.pathname)), [navigation, location.pathname]);
  const sectionGroup = activeGroup?.children?.length ? activeGroup : null;

  useEffect(() => setMobileOpen(false), [location.pathname, location.search, location.hash]);
  useEffect(() => {
    if (!mobileOpen) return;
    const before = document.body.style.overflow;
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setMobileOpen(false);
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', close);
    return () => { document.body.style.overflow = before; window.removeEventListener('keydown', close); };
  }, [mobileOpen]);

  return (
    <>
      <header className="relative z-40 flex-shrink-0 bg-white/95 backdrop-blur-xl">
        <div className="hidden border-b border-slate-100 lg:block">
          <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4 px-5 lg:px-6">
            <EcosystemSwitcher ecosystem={ecosystem} params={params} />
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{audienceLabel}</span>
          </div>
        </div>
        <div className="border-b" style={{ borderColor: theme.border }}>
          <div className="mx-auto flex min-h-[68px] max-w-[1480px] items-center gap-4 px-4 sm:px-5 lg:px-6">
            <EcosystemBrand ecosystem={ecosystem} href={withPreview(ecosystemHomePath, params)} />
            <div className="hidden min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:block">
              <PrimaryLinks navigation={navigation} pathname={location.pathname} params={params} accent={theme.accent} />
            </div>
            {search ? <div className="ml-auto hidden w-[min(34vw,430px)] min-w-[230px] md:block">{search}</div> : null}
            <UserAccountMenu dashboardPath={dashboardPath} />
            <button type="button" onClick={() => setMobileOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-[#002050] lg:hidden" aria-label={`Ouvrir le menu Omnia ${theme.name}`}><Menu size={19} /></button>
          </div>
        </div>
        {search ? (
          <div className="border-b px-4 py-2.5 md:hidden" style={{ borderColor: theme.border, background: theme.panel }}>
            <div className="mx-auto max-w-[1480px]">{search}</div>
          </div>
        ) : null}
      </header>

      {sectionGroup ? <SectionContext ecosystem={ecosystem} group={sectionGroup} pathname={location.pathname} search={location.search} hash={location.hash} params={params} /> : null}

      {mobileOpen && (
        <div className="fixed inset-0 z-[90] lg:hidden" role="dialog" aria-modal="true" aria-label={`Navigation Omnia ${theme.name}`}>
          <button type="button" className="absolute inset-0 bg-slate-950/50" onClick={() => setMobileOpen(false)} aria-label="Fermer le menu" />
          <aside className="absolute right-0 top-0 flex h-[100dvh] w-[min(92vw,390px)] flex-col bg-[#F8FAFC] shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4"><EcosystemBrand ecosystem={ecosystem} href={withPreview(ecosystemHomePath, params)} /><button type="button" onClick={() => setMobileOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-100" aria-label="Fermer"><X size={19} /></button></div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {search ? <div className="mb-5">{search}</div> : null}
              <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Écosystèmes</p>
              <EcosystemSwitcher ecosystem={ecosystem} params={params} mobile onNavigate={() => setMobileOpen(false)} />
              <div className="my-5 border-t border-slate-200" />
              <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: theme.accent }}>Omnia {theme.name}</p>
              <PrimaryLinks navigation={navigation} pathname={location.pathname} params={params} compact accent={theme.accent} onNavigate={() => setMobileOpen(false)} />
              <p className="mt-5 px-1 text-[11px] leading-5 text-slate-400">Les sous-menus s’ouvrent dans leur propre page. Ils ne sont pas dupliqués dans ce panneau.</p>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

export function EcosystemConnectedShell({ ecosystem, audienceLabel, navigation, search, children, dashboardPath }: ShellProps) {
  const theme = getEcosystem(ecosystem);
  const style = {
    '--oga-ecosystem-accent': theme.accent,
    '--oga-ecosystem-secondary': theme.secondary,
    '--oga-ecosystem-bg': theme.background,
    '--oga-ecosystem-panel': theme.panel,
    '--oga-ecosystem-soft': theme.soft,
    '--oga-ecosystem-border': theme.border,
  } as CSSProperties;

  return (
    <div className="oga-ecosystem-shell flex h-[100dvh] min-h-0 flex-col overflow-hidden" data-ecosystem={ecosystem} style={style}>
      <EcosystemConnectedHeader ecosystem={ecosystem} audienceLabel={audienceLabel} navigation={navigation} search={search} dashboardPath={dashboardPath} />
      <div className="oga-ecosystem-content min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}<PageFooter ecosystem={ecosystem} /></div>
    </div>
  );
}

export function EcosystemStandaloneNav({ ecosystem, audienceLabel, navigation }: StandaloneProps) {
  const location = useLocation();
  const [params] = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = getEcosystem(ecosystem);
  useEffect(() => setMobileOpen(false), [location.pathname]);
  return (
    <>
      <div className="relative z-30 border-b bg-white/95 backdrop-blur-xl" style={{ borderColor: theme.border }}>
        <div className="mx-auto flex min-h-14 max-w-[1440px] items-center gap-4 px-4 sm:px-5 lg:px-6">
          <Link to={theme.publicPath} className="shrink-0 text-sm font-black text-[#002050]">Omnia <span style={{ color: theme.accent }}>{theme.name}</span></Link>
          <span className="hidden rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] md:inline-flex" style={{ background: theme.soft, color: theme.secondary }}>{audienceLabel}</span>
          <div className="hidden min-w-0 flex-1 overflow-x-auto lg:block"><PrimaryLinks navigation={navigation} pathname={location.pathname} params={params} accent={theme.accent} /></div>
          <button type="button" onClick={() => setMobileOpen(true)} className="ml-auto flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-[#002050] lg:hidden" aria-label={`Ouvrir le menu ${theme.name}`}><Menu size={19} /></button>
        </div>
      </div>
      {mobileOpen && <div className="fixed inset-0 z-[85] lg:hidden"><button type="button" className="absolute inset-0 bg-slate-950/45" onClick={() => setMobileOpen(false)} aria-label="Fermer"/><aside className="absolute right-0 top-0 h-full w-[min(92vw,380px)] bg-[#F8FAFC] p-4 shadow-2xl"><div className="mb-4 flex items-center justify-between"><strong className="text-[#002050]">Omnia <span style={{ color: theme.accent }}>{theme.name}</span></strong><button type="button" onClick={() => setMobileOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-white"><X size={19}/></button></div><PrimaryLinks navigation={navigation} pathname={location.pathname} params={params} compact accent={theme.accent} onNavigate={() => setMobileOpen(false)} /></aside></div>}
    </>
  );
}

export function EcosystemSectionLanding({ ecosystem, description }: { ecosystem: EcosystemId; description?: string }) {
  const theme = getEcosystem(ecosystem);
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-10 sm:px-6 lg:px-8 lg:py-14">
      <div className="relative overflow-hidden rounded-[28px] border px-6 py-8 sm:px-8 lg:px-10" style={{ borderColor: theme.border, background: `linear-gradient(135deg, ${theme.panel} 0%, ${theme.soft} 100%)` }}>
        <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full border opacity-60" style={{ borderColor: theme.accent }} aria-hidden="true" />
        <div className="relative max-w-3xl">
          <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: theme.accent }}>Page de domaine</p>
          <h1 className="mt-3 text-2xl font-black tracking-[-0.035em] text-[#002050] sm:text-3xl">Choisissez la fonction à ouvrir dans la barre ci-dessus.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{description || `Les fonctions Omnia ${theme.name} restent séparées dans leurs pages dédiées afin de garder une navigation claire.`}</p>
        </div>
      </div>
    </section>
  );
}
