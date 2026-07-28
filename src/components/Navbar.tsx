import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

interface NavbarProps {
  transparent?: boolean;
}

const NAV_LINKS = [
  { label: 'Catalogue',          href: '/catalogue' },
  { label: 'Projects',           href: '/projects' },
  { label: 'Talent',             href: '/talent' },
  { label: 'Vérifier un certificat', href: '/verify' },
  { label: 'Devenir Formateur',  href: '/inscription/professeur' },
  { label: 'À propos',           href: '/a-propos' },
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

  // Close drawer on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const isScrolledOrSolid = !transparent || scrolled;

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-200"
        style={{
          backgroundColor: isScrolledOrSolid ? '#FFFFFF' : 'transparent',
          borderBottom: isScrolledOrSolid ? '1px solid #E4E7EC' : 'none',
          boxShadow: scrolled ? '0 2px 12px rgba(0,0,0,0.07)' : 'none',
        }}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2.5 flex-shrink-0">
            <img src="/IMG_0349.png" alt="Omnia" className="h-9 w-auto object-contain" />
            <div>
              <div className="font-bold leading-none" style={{ color: '#002050', fontSize: '15px', letterSpacing: '0.09em' }}>
                OMNIA
              </div>
              <div className="font-semibold" style={{ color: '#BF8813', fontSize: '8px', letterSpacing: '0.18em', marginTop: '2px' }}>
                GLOBAL ACADEMY
              </div>
            </div>
          </a>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-7">
            {NAV_LINKS.map(({ label, href }) => (
              <a
                key={label}
                href={href}
                className="text-sm font-medium transition-colors hover:opacity-70"
                style={{ color: '#374151' }}
              >
                {label}
              </a>
            ))}
          </div>

          {/* Desktop buttons */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => navigate('/connexion')}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ border: '1.5px solid #002050', color: '#002050' }}
            >
              Se connecter
            </button>
            <button
              onClick={() => navigate('/inscription')}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-85"
              style={{ backgroundColor: '#002050' }}
            >
              S'inscrire
            </button>
          </div>

          {/* Mobile burger */}
          <button
            className="md:hidden p-2 rounded-lg transition-colors hover:bg-gray-100"
            onClick={() => setMobileOpen(v => !v)}
            aria-label="Menu"
          >
            {mobileOpen ? <X size={22} color="#002050" /> : <Menu size={22} color="#002050" />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer panel */}
      <div
        className="fixed top-0 right-0 h-full w-72 z-50 md:hidden flex flex-col transition-transform duration-250"
        style={{
          backgroundColor: '#FFFFFF',
          transform: mobileOpen ? 'translateX(0)' : 'translateX(100%)',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
        }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <img src="/IMG_0349.png" alt="Omnia" className="h-8 w-auto object-contain" />
            <div>
              <div className="font-bold leading-none" style={{ color: '#002050', fontSize: '13px', letterSpacing: '0.09em' }}>OMNIA</div>
              <div className="font-semibold" style={{ color: '#BF8813', fontSize: '7px', letterSpacing: '0.18em', marginTop: '2px' }}>GLOBAL ACADEMY</div>
            </div>
          </div>
          <button onClick={() => setMobileOpen(false)} className="p-1">
            <X size={20} color="#6B7280" />
          </button>
        </div>

        <div className="flex-1 px-5 py-4 space-y-1">
          {NAV_LINKS.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="block px-3 py-3 rounded-lg text-sm font-medium transition-colors hover:bg-gray-50"
              style={{ color: '#374151' }}
            >
              {label}
            </a>
          ))}
        </div>

        <div className="px-5 pb-8 space-y-3">
          <button
            onClick={() => navigate('/connexion')}
            className="w-full py-3 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ border: '1.5px solid #002050', color: '#002050' }}
          >
            Se connecter
          </button>
          <button
            onClick={() => navigate('/inscription')}
            className="w-full py-3 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-85"
            style={{ backgroundColor: '#002050' }}
          >
            S'inscrire
          </button>
        </div>
      </div>
    </>
  );
}
