import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  FolderKanban,
  LayoutDashboard,
  MessageSquareQuote,
  ShieldAlert,
  Users,
} from 'lucide-react';

const items = [
  { href: '#overview', label: 'Vue d’ensemble', icon: LayoutDashboard },
  { href: '#projects-list', label: 'Projets', icon: FolderKanban },
  { href: '#professor-permissions', label: 'Professeurs autorisés', icon: Users },
  { href: '#reports', label: 'Signalements', icon: ShieldAlert },
];

export function AdminProjectsManagementLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 flex h-screen w-64 flex-shrink-0 flex-col bg-[#002050]">
          <div className="flex items-center gap-3 border-b border-white/10 p-5">
            <img src="/omnia-sidebar-logo.png" alt="Omnia" className="h-10 w-10 object-contain" />
            <div>
              <p className="font-bold text-white">Omnia</p>
              <p className="font-bold text-[#BF8813]">Projects</p>
            </div>
          </div>

          <nav className="space-y-1 p-3">
            {items.map(({ href, label, icon: Icon }) => (
              <a
                key={href}
                href={href}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                <Icon size={16} />
                {label}
              </a>
            ))}
            <Link
              to="/admin/projects/gestion/recommandations"
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <MessageSquareQuote size={16} />
              Recommandations professionnelles
            </Link>
          </nav>

          <div className="mt-auto border-t border-white/10 p-3">
            <Link
              to="/admin/dashboard"
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#BF8813] transition hover:bg-white/10"
            >
              <ArrowLeft size={16} />
              Retour au Dashboard
            </Link>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
