import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Briefcase, Home, Menu, MessageCircle, X } from 'lucide-react';

const BLUE = '#002050';
const GOLD = '#BF8813';

const NAV = [
  { label: 'Accueil Communauté', path: '/forum', icon: Home },
  { label: 'Espace général', path: '/forum/general', icon: MessageCircle },
  { label: 'Carrière & emploi', path: '/forum/emploi', icon: Briefcase },
  { label: 'Forums des formations', path: '/forum/formations', icon: BookOpen },
];

/**
 * Ancien composant conservé pour compatibilité. Le retour au tableau de bord
 * n'est plus affiché ici : il appartient au menu de l'avatar/initiales du layout principal.
 */
export default function ForumHamburgerNav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-100" aria-label="Ouvrir le menu Omnia Communauté">
        <Menu size={21} color={BLUE} />
      </button>
      {open && (
        <div className="fixed inset-0 z-[80]">
          <button type="button" className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} aria-label="Fermer le menu" />
          <aside className="absolute left-3 top-3 flex max-h-[calc(100dvh-24px)] w-[286px] max-w-[88vw] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div className="font-bold" style={{ color: BLUE }}>Omnia <span style={{ color: GOLD }}>Communauté</span></div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-slate-100" aria-label="Fermer"><X size={18} /></button>
            </div>
            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
              {NAV.map(item => {
                const Icon = item.icon;
                const active = item.path === '/forum' ? location.pathname === item.path : location.pathname.startsWith(item.path);
                return <Link key={item.path} to={item.path} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold hover:bg-slate-50" style={{ color: active ? GOLD : BLUE }}><Icon size={17} />{item.label}</Link>;
              })}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
