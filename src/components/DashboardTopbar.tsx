import type { ReactNode } from 'react';
import { Menu } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';
import UserAccountMenu from './UserAccountMenu';

const BLUE = '#002050';
const GOLD = '#BF8813';

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
    <header className="relative z-30 flex min-h-[72px] flex-shrink-0 flex-wrap items-center gap-3 border-b border-slate-200/80 bg-white/95 px-4 py-2.5 backdrop-blur md:px-6">
      {onOpenNavigation && (
        <button
          type="button"
          onClick={onOpenNavigation}
          className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF8813] lg:hidden"
          aria-label="Ouvrir la navigation"
          aria-expanded={navigationOpen}
          aria-controls={navigationId}
        >
          <Menu size={21} />
        </button>
      )}

      <div className="min-w-0 flex-1 xl:max-w-[330px]">
        <div className="flex min-w-0 items-center gap-2">
          <span className="hidden h-5 w-1 rounded-full sm:block" style={{ background: GOLD }} />
          <h1 className="truncate text-[15px] font-extrabold sm:text-base" style={{ color: BLUE }}>{title}</h1>
        </div>
        {subtitle && <p className="mt-0.5 hidden truncate text-xs font-medium text-slate-500 sm:block sm:pl-3">{subtitle}</p>}
      </div>

      {search && <div className="order-3 flex w-full min-w-0 justify-center xl:order-none xl:flex-1">{search}</div>}

      <div className="ml-auto flex flex-none items-center gap-2">
        {actions}
        <LanguageSwitcher compact />
        <UserAccountMenu dashboardPath={dashboardPath} />
      </div>
    </header>
  );
}
