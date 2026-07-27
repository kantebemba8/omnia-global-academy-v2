import { Link, useLocation } from 'react-router-dom';
import { withCoachPreview } from '../../lib/coachingApi';
import { CalendarDays, CircleDollarSign, LayoutDashboard, ListChecks, Package, Settings2, Star } from 'lucide-react';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

const items = [
  { path: '/coach/dashboard', label: 'Vue d’ensemble', icon: LayoutDashboard },
  { path: '/coach/offres', label: 'Mes offres', icon: Settings2 },
  { path: '/coach/calendrier', label: 'Mon calendrier', icon: CalendarDays },
  { path: '/coach/sessions', label: 'Mes sessions', icon: ListChecks },
  { path: '/coach/avis', label: 'Mes avis', icon: Star },
  { path: '/coach/revenus', label: 'Mes revenus', icon: CircleDollarSign },
  { path: '/coach/produits', label: 'Coaching collectif', icon: Package },
];

export default function CoachWorkspaceNav() {
  const location = useLocation();
  return (
    <nav className="mb-6 flex gap-2 overflow-x-auto rounded-2xl border bg-white p-2" style={{ borderColor: BORDER }}>
        {items.map(({ path, label, icon: Icon }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={withCoachPreview(path)}
              className="inline-flex min-w-max items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
              style={{ background: active ? BLUE : 'transparent', color: active ? 'white' : BLUE }}
            >
              <Icon size={16} color={active ? GOLD : BLUE} />
              {label}
            </Link>
          );
        })}
      </nav>
  );
}
