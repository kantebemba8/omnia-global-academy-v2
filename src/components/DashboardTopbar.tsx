import type { ReactNode } from 'react';
import { Menu } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';
import UserAccountMenu from './UserAccountMenu';

const BLUE = '#002050';

type Props = {
  title: string;
  subtitle?: string;
  onOpenNavigation?: () => void;
  navigationOpen?: boolean;
  navigationId?: string;
  actions?: ReactNode;
  search?: ReactNode;
  dashboardPath?: string;
};

/**
 * En-tête commun des espaces connectés.
 * Le composant reste dans la colonne de contenu : le sidebar conserve ainsi
 * toute la hauteur de l'écran et l'en-tête commence exactement après lui.
 */
export function DashboardTopbar({
  title,
  subtitle,
  onOpenNavigation,
  navigationOpen = false,
  navigationId = 'dashboard-mobile-navigation',
  actions,
  search,
  dashboardPath,
}: Props) {
  return (
    <header className="relative z-30 flex min-h-[68px] flex-shrink-0 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-6">
      {onOpenNavigation && (
        <button
          type="button"
          onClick={onOpenNavigation}
          className="flex h-10 w-10 flex-none items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF8813] lg:hidden"
          aria-label="Ouvrir le menu du tableau de bord"
          aria-expanded={navigationOpen}
          aria-controls={navigationId}
        >
          <Menu size={21} />
        </button>
      )}

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-extrabold sm:text-base" style={{ color: BLUE }}>{title}</h1>
        {subtitle && <p className="hidden truncate text-xs text-slate-500 sm:block">{subtitle}</p>}
      </div>

      {search && <div className="hidden min-w-0 flex-1 justify-center xl:flex">{search}</div>}

      <div className="ml-auto flex flex-none items-center gap-2">
        {actions}
        <LanguageSwitcher compact />
        <UserAccountMenu dashboardPath={dashboardPath} />
      </div>
    </header>
  );
}
