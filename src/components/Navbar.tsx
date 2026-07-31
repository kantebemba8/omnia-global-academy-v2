import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Menu, X } from 'lucide-react';

interface NavbarProps {
  transparent?: boolean;
}

type NavItem = {
  label: string;
  href: string;
  description?: string;
};

type MenuKey = 'explore' | 'professionals';

const EXPLORER_LINKS: NavItem[] = [
  { label: 'Omnia Live', href: '/omnia-live', description: 'Lives, ateliers, masterclass et replays' },
  { label: 'Omnia Projects', href: '/projects', description: 'Projets, challenges, missions et portfolio' },
  { label: 'Omnia Coaching', href: '/coaching', description: 'Accompagnement individuel avec des coachs validés' },
  { label: 'Omnia Talent', href: '/talent', description: 'Profils, offres et recrutement' },
  { label: 'Carrière et opportunités', href: '/emploi', description: 'Emploi, candidatures et développement professionnel' },
  { label: 'Certificats et preuves', href: '/verify', description: 'Vérification publique des documents' },
  { label: 'Forum', href: '/forum', description: 'Échanges autour des formations et de la carrière' },
];

const PROFESSIONAL_LINKS: NavItem[] = [
  { label: 'Devenir professeur', href: '/inscription/professeur', description: 'Créer et publier des formations' },
  { label: 'Devenir coach', href: '/coaching/devenir-coach', description: 'Proposer un accompagnement individuel' },
  { label: 'Devenir organisateur', href: '/inscription/organisateur', description: 'Créer des événements Omnia Live' },
  { label: 'Devenir recruteur', href: '/inscription/recruteur', description: 'Publier des offres et gérer les candidatures' },
];

const DIRECT_LINKS: NavItem[] = [
  { label: 'Formations', href: '/catalogue' },
  { label: 'Structures', href: '/accueil#structures' },
  { label: 'À propos', href: '/a-propos' },
];

export function Navbar({ transparent = false }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);
  const navigate = useNavigate();
  const { pathname, hash } = useLocation();
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setOpenMenu(null);
  }, [pathname, hash]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!navRef.current?.contains(event.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileOpen]);

  const isScrolledOrSolid = !transparent || scrolled || openMenu !== null;

  const dropdown = (key: MenuKey, label: string, items: NavItem[]) => (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpenMenu(current => current === key ? null : key)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 transition-colors hover:text-[#002050]"
        aria-expanded={openMenu === key}
        aria-haspopup="menu"
      >
        {label}
        <ChevronDown className={`h-4 w-4 transition-transform ${openMenu === key ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {openMenu === key && (
        <div role="menu" className="absolute left-1/2 top-[calc(100%+18px)] w-[420px] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-900/10">
          <div className="grid gap-1">
            {items.map(item => (
              <Link
                key={item.label}
                to={item.href}
                role="menuitem"
                className="rounded-xl px-4 py-3 transition-colors hover:bg-slate-50"
              >
                <span className="block text-sm font-semibold text-[#002050]">{item.label}</span>
                {item.description && <span className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</span>}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <nav
        ref={navRef}
        aria-label="Navigation principale"
        className="fixed left-0 right-0 top-0 z-50 transition-all duration-200"
        style={{
          backgroundColor: isScrolledOrSolid ? '#FFFFFF' : 'transparent',
          borderBottom: isScrolledOrSolid ? '1px solid #E4E7EC' : 'none',
          boxShadow: scrolled ? '0 2px 14px rgba(15,23,42,0.08)' : 'none',
        }}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-6">
          <Link to="/accueil" className="flex flex-shrink-0 items-center gap-2.5" aria-label="Accueil Omnia Global Academy">
            <img src="/IMG_0349.png" alt="" className="h-9 w-auto object-contain" />
            <div>
              <div className="text-[15px] font-bold leading-none tracking-[0.09em] text-[#002050]">OMNIA</div>
              <div className="mt-0.5 text-[8px] font-semibold tracking-[0.18em] text-[#BF8813]">GLOBAL ACADEMY</div>
            </div>
          </Link>

          <div className="hidden items-center gap-7 lg:flex">
            <Link to="/catalogue" className="text-sm font-medium text-slate-700 transition-colors hover:text-[#002050]">Formations</Link>
            {dropdown('explore', 'Explorer Omnia', EXPLORER_LINKS)}
            {dropdown('professionals', 'Professionnels', PROFESSIONAL_LINKS)}
            <Link to="/accueil#structures" className="text-sm font-medium text-slate-700 transition-colors hover:text-[#002050]">Structures</Link>
            <Link to="/a-propos" className="text-sm font-medium text-slate-700 transition-colors hover:text-[#002050]">À propos</Link>
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            <button
              type="button"
              onClick={() => navigate('/connexion')}
              className="rounded-xl border border-[#002050] px-4 py-2 text-sm font-semibold text-[#002050] transition-colors hover:bg-slate-50"
            >
              Se connecter
            </button>
            <button
              type="button"
              onClick={() => navigate('/inscription')}
              className="rounded-xl bg-[#002050] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#00183E]"
            >
              Créer un compte
            </button>
          </div>

          <button
            type="button"
            className="rounded-lg p-2 transition-colors hover:bg-slate-100 lg:hidden"
            onClick={() => setMobileOpen(value => !value)}
            aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={mobileOpen}
            aria-controls="omnia-mobile-navigation"
          >
            {mobileOpen ? <X size={22} color="#002050" /> : <Menu size={22} color="#002050" />}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/45 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Fermer le menu de navigation"
          />

          <aside
            id="omnia-mobile-navigation"
            aria-label="Navigation mobile"
            className="fixed right-0 top-0 z-50 flex h-full w-[min(92vw,360px)] flex-col bg-white shadow-2xl lg:hidden"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <Link to="/accueil" onClick={() => setMobileOpen(false)} className="flex items-center gap-2" aria-label="Accueil Omnia Global Academy">
                <img src="/IMG_0349.png" alt="" className="h-8 w-auto object-contain" />
                <div>
                  <div className="text-[13px] font-bold leading-none tracking-[0.09em] text-[#002050]">OMNIA</div>
                  <div className="mt-0.5 text-[7px] font-semibold tracking-[0.18em] text-[#BF8813]">GLOBAL ACADEMY</div>
                </div>
              </Link>
              <button type="button" onClick={() => setMobileOpen(false)} className="rounded-lg p-2 hover:bg-slate-100" aria-label="Fermer le menu">
                <X size={20} color="#64748B" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="space-y-1">
                {DIRECT_LINKS.map(item => (
                  <Link key={item.label} to={item.href} className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-[#002050] hover:bg-slate-50">{item.label}</Link>
                ))}
              </div>

              <div className="mt-6 border-t border-slate-100 pt-5">
                <p className="px-3 text-xs font-bold uppercase tracking-[0.16em] text-[#9A6A08]">Explorer Omnia</p>
                <div className="mt-2 space-y-1">
                  {EXPLORER_LINKS.map(item => (
                    <Link key={item.label} to={item.href} className="block rounded-lg px-3 py-2.5 hover:bg-slate-50">
                      <span className="block text-sm font-semibold text-[#002050]">{item.label}</span>
                      {item.description && <span className="mt-0.5 block text-xs leading-5 text-slate-500">{item.description}</span>}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="mt-6 border-t border-slate-100 pt-5">
                <p className="px-3 text-xs font-bold uppercase tracking-[0.16em] text-[#9A6A08]">Rejoindre comme professionnel</p>
                <div className="mt-2 space-y-1">
                  {PROFESSIONAL_LINKS.map(item => (
                    <Link key={item.label} to={item.href} className="block rounded-lg px-3 py-2.5 hover:bg-slate-50">
                      <span className="block text-sm font-semibold text-[#002050]">{item.label}</span>
                      {item.description && <span className="mt-0.5 block text-xs leading-5 text-slate-500">{item.description}</span>}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3 border-t border-slate-100 px-5 pb-7 pt-5">
              <button type="button" onClick={() => navigate('/connexion')} className="w-full rounded-xl border border-[#002050] py-3 text-sm font-semibold text-[#002050]">Se connecter</button>
              <button type="button" onClick={() => navigate('/inscription')} className="w-full rounded-xl bg-[#002050] py-3 text-sm font-semibold text-white">Créer un compte</button>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
