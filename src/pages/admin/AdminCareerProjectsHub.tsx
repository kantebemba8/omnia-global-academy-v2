import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Briefcase,
  FolderKanban,
  Shield,
  ShieldCheck,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';

const AREAS = [
  {
    title: 'Omnia Career Studio',
    description: 'Piloter les règles, modèles CV/LM, jetons, exports, banque de questions et statistiques Career.',
    path: '/admin/career-studio',
    icon: Briefcase,
    accent: '#3157A4',
    surface: '#EEF3FF',
  },
  {
    title: 'Omnia Projects',
    description: 'Superviser les projets, validations, porteurs autorisés, partenaires, récompenses et signalements.',
    path: '/admin/projects',
    icon: FolderKanban,
    accent: '#0E7490',
    surface: '#ECFEFF',
  },
  {
    title: 'Omnia Coaching',
    description: 'Administrer les coachs, candidatures, offres, sessions, finance, litiges et avis.',
    path: '/admin/coaching',
    icon: Users,
    accent: '#0F766E',
    surface: '#ECFDF5',
  },
  {
    title: 'Omnia Talent',
    description: 'Gérer l’espace Talent, les règles de visibilité et les fonctions administratives existantes.',
    path: '/admin/talent',
    icon: Shield,
    accent: '#6D4BB8',
    surface: '#F5F3FF',
  },
  {
    title: 'Employabilité',
    description: 'Suivre les mécanismes d’employabilité et les intégrations déjà actives dans la plateforme.',
    path: '/admin/employabilite',
    icon: ShieldCheck,
    accent: '#9A6700',
    surface: '#FFF8E7',
  },
  {
    title: 'Offres d’emploi',
    description: 'Administrer les offres publiées dans les espaces emploi et les parcours de recrutement existants.',
    path: '/admin/offres-emploi',
    icon: UserRoundCheck,
    accent: '#9F3F68',
    surface: '#FFF1F5',
  },
] as const;

export default function AdminCareerProjectsHub() {
  return (
    <AdminLayout>
      <div className="mx-auto max-w-[1540px] px-4 py-6 md:px-6 md:py-8">
        <header className="overflow-hidden border border-slate-200 bg-white">
          <div className="grid gap-8 px-6 py-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,.7fr)] lg:px-9 lg:py-10">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#BF8813]">Administration · Carrière & projets</p>
              <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-[-0.035em] text-[#002050] md:text-4xl">
                Piloter les parcours professionnels, les projets et les opportunités.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
                Cette vue rassemble les espaces de gestion déjà présents dans Omnia. Chaque domaine conserve sa propre page et ses outils métier : aucun module n’est remplacé par Career Studio.
              </p>
            </div>
            <div className="border-l-0 border-slate-200 lg:border-l lg:pl-8">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Organisation</p>
              <dl className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
                <div className="flex items-center justify-between py-3.5">
                  <dt className="text-sm text-slate-500">Espaces de gestion</dt>
                  <dd className="text-xl font-black text-[#002050]">{AREAS.length}</dd>
                </div>
                <div className="flex items-center justify-between py-3.5">
                  <dt className="text-sm text-slate-500">Navigation</dt>
                  <dd className="text-sm font-bold text-[#002050]">Pages dédiées</dd>
                </div>
                <div className="flex items-center justify-between py-3.5">
                  <dt className="text-sm text-slate-500">Supervision</dt>
                  <dd className="text-sm font-bold text-[#002050]">Super-admin</dd>
                </div>
              </dl>
            </div>
          </div>
          <div className="h-1 bg-[linear-gradient(90deg,#002050_0%,#3157A4_35%,#0E7490_70%,#BF8813_100%)]" />
        </header>

        <section className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <div className="flex items-end justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Domaines opérationnels</p>
                <h2 className="mt-1 text-xl font-black text-[#002050]">Choisir un espace de gestion</h2>
              </div>
            </div>

            <div className="divide-y divide-slate-200 border-b border-slate-200">
              {AREAS.map(area => {
                const Icon = area.icon;
                return (
                  <Link
                    key={area.path}
                    to={area.path}
                    className="group grid gap-4 py-5 transition hover:bg-white sm:grid-cols-[54px_minmax(0,1fr)_auto] sm:items-center sm:px-3"
                  >
                    <span className="flex h-12 w-12 items-center justify-center" style={{ background: area.surface, color: area.accent }}>
                      <Icon size={21} />
                    </span>
                    <span className="min-w-0">
                      <strong className="block text-base font-black text-[#002050]">{area.title}</strong>
                      <span className="mt-1 block max-w-3xl text-sm leading-6 text-slate-500">{area.description}</span>
                    </span>
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-[#002050]">
                      Ouvrir <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          <aside className="self-start border border-slate-200 bg-[#002050] p-6 text-white">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#E9C46A]">Principe de gestion</p>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.03em]">Un domaine, une vraie page métier.</h2>
            <p className="mt-4 text-sm leading-7 text-white/72">
              Career Studio, Projects, Coaching et Talent restent indépendants. La navigation horizontale sert de point d’entrée ; les opérations détaillées restent dans leur espace spécialisé.
            </p>
            <div className="mt-6 border-t border-white/15 pt-5 text-sm leading-6 text-white/70">
              Les actions de création, validation, gouvernance, modération et statistiques restent celles déjà présentes dans le code.
            </div>
          </aside>
        </section>
      </div>
    </AdminLayout>
  );
}
