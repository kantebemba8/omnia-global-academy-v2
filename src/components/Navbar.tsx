import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

interface NavbarProps {
  transparent?: boolean;
}

const NAV_LINKS = [
  { label: 'Catalogue', href: '/catalogue' },
  { label: 'Projects', href: '/projects' },
  { label: 'Talent', href: '/talent' },
  { label: 'Vérifier un certificat', href: '/verify' },
  { label: 'Devenir Formateur', href: '/inscription/professeur' },
  { label: 'À propos', href: '/a-propos' },
];

export function Navbar({ transparent = false }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

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

  const isScrolledOrSolid = !transparent || scrolled;

  return (
    <>
      <nav
        aria-label="Navigation principale"
        className="fixed left-0 right-0 top-0 z-50 transition-all duration-200"
        style={{
          backgroundColor: isScrolledOrSolid ? '#FFFFFF' : 'transparent',
          borderBottom: isScrolledOrSolid ? '1px solid #E4E7EC' : 'none',
          boxShadow: scrolled ? '0 2px 12px rgba(0,0,0,0.07)' : 'none',
        }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/accueil" className="flex flex-shrink-0 items-center gap-2.5" aria-label="Accueil Omnia Global Academy">
            <img src="/IMG_0349.png" alt="" className="h-9 w-auto object-contain" />
            <div>
              <div className="font-bold leading-none" style={{ color: '#002050', fontSize: '15px', letterSpacing: '0.09em' }}>
                OMNIA
              </div>
              <div className="font-semibold" style={{ color: '#BF8813', fontSize: '8px', letterSpacing: '0.18em', marginTop: '2px' }}>
                GLOBAL ACADEMY
              </div>
            </div>
          </Link>

          <div className="hidden items-center gap-7 md:flex">
            {NAV_LINKS.map(({ label, href }) => (
              <Link
                key={label}
                to={href}
                className="text-sm font-medium transition-colors hover:opacity-70"
                style={{ color: '#374151' }}
              >
                {label}
              </Link>
            ))}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <button
              type="button"
              onClick={() => navigate('/connexion')}
              className="rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ border: '1.5px solid #002050', color: '#002050' }}
            >
              Se connecter
            </button>
            <button
              type="button"
              onClick={() => navigate('/inscription')}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-85"
              style={{ backgroundColor: '#002050' }}
            >
              S'inscrire
            </button>
          </div>

          <button
            type="button"
            className="rounded-lg p-2 transition-colors hover:bg-gray-100 md:hidden"
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
            className="fixed inset-0 z-40 bg-black/45 md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Fermer le menu de navigation"
          />

          <aside
            id="omnia-mobile-navigation"
            aria-label="Navigation mobile"
            className="fixed right-0 top-0 z-50 flex h-full w-72 flex-col bg-white shadow-2xl md:hidden"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <Link
                to="/accueil"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2"
                aria-label="Accueil Omnia Global Academy"
              >
                <img src="/IMG_0349.png" alt="" className="h-8 w-auto object-contain" />
                <div>
                  <div className="font-bold leading-none" style={{ color: '#002050', fontSize: '13px', letterSpacing: '0.09em' }}>OMNIA</div>
                  <div className="font-semibold" style={{ color: '#BF8813', fontSize: '7px', letterSpacing: '0.18em', marginTop: '2px' }}>GLOBAL ACADEMY</div>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 hover:bg-gray-100"
                aria-label="Fermer le menu"
              >
                <X size={20} color="#6B7280" />
              </button>
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto px-5 py-4">
              {NAV_LINKS.map(({ label, href }) => (
                <Link
                  key={label}
                  to={href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-3 text-sm font-medium transition-colors hover:bg-gray-50"
                  style={{ color: '#374151' }}
                >
                  {label}
                </Link>
              ))}
            </div>

            <div className="space-y-3 px-5 pb-8">
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  navigate('/connexion');
                }}
                className="w-full rounded-lg py-3 text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ border: '1.5px solid #002050', color: '#002050' }}
              >
                Se connecter
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  navigate('/inscription');
                }}
                className="w-full rounded-lg py-3 text-sm font-semibold text-white transition-opacity hover:opacity-85"
                style={{ backgroundColor: '#002050' }}
              >
                S'inscrire
              </button>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
