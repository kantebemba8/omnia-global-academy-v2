import type { CSSProperties, ReactNode } from 'react';
import { Menu } from 'lucide-react';
import UserAccountMenu from './UserAccountMenu';
import OmniaBrandLockup from './OmniaBrandLockup';

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
  showBrand?: boolean;
  brandHref?: string;
  accentColor?: string;
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
  showBrand = true,
  brandHref = '/home',
  accentColor = '#BF8813',
}: Props) {
  return (
    <header className="relative z-[200] flex min-h-[78px] flex-shrink-0 flex-wrap items-center gap-3 overflow-visible border-b border-slate-200 bg-white px-4 py-2.5 md:px-6">
      {onOpenNavigation && (
        <button
          type="button"
          onClick={onOpenNavigation}
          className="flex h-10 w-10 flex-none items-center justify-center border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 lg:hidden"
          style={{ '--tw-ring-color': accentColor } as CSSProperties}
          aria-label="Ouvrir la navigation"
          aria-expanded={navigationOpen}
          aria-controls={navigationId}
        >
          <Menu size={21} />
        </button>
      )}

      {showBrand && (
        <OmniaBrandLockup href={brandHref} compact className="mr-1 hidden sm:flex" />
      )}

      <div className="min-w-0 flex-1 border-l border-slate-200 pl-4 xl:max-w-[360px]">
        <h1 className="truncate text-[15px] font-extrabold sm:text-base" style={{ color: BLUE }}>{title}</h1>
        {subtitle && <p className="mt-1 hidden truncate text-xs font-medium text-slate-500 sm:block">{subtitle}</p>}
      </div>

      {search && <div className="order-3 flex w-full min-w-0 justify-center xl:order-none xl:flex-1">{search}</div>}

      <div className="ml-auto flex flex-none items-center gap-2">
        {actions}
        <UserAccountMenu dashboardPath={dashboardPath} />
      </div>

      <span className="absolute bottom-0 left-0 h-[2px] w-16" style={{ backgroundColor: accentColor }} aria-hidden="true" />
    </header>
  );
}
