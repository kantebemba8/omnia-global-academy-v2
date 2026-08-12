import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import { ADMIN_ECOSYSTEMS } from '../../lib/adminNavigation';

export default function AdminCareerProjectsHub() {
  return (
    <AdminLayout headerTitle="Écosystèmes" headerSubtitle="Administration des espaces Omnia">
      <div className="mx-auto max-w-[1540px] px-4 py-6 md:px-6 md:py-8">
        <header className="overflow-hidden rounded-[26px] border border-slate-200 bg-[#002050] text-white shadow-[0_18px_50px_rgba(0,32,80,.12)]">
          <div className="grid gap-8 px-6 py-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,.7fr)] lg:px-9 lg:py-10">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#E9C46A]">Omnia Administration</p>
              <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-[-0.035em] md:text-4xl">Piloter chaque écosystème sans mélanger ses outils.</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/68 md:text-base">
                Chaque espace conserve ses fonctions Super-admin existantes. La navigation reprend désormais l’identité et la couleur de l’écosystème concerné.
              </p>
            </div>
            <div className="border-l-0 border-white/15 lg:border-l lg:pl-8">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">Architecture</p>
              <dl className="mt-4 divide-y divide-white/10 border-y border-white/10">
                <div className="flex items-center justify-between py-3.5"><dt className="text-sm text-white/55">Écosystèmes</dt><dd className="text-xl font-black">{ADMIN_ECOSYSTEMS.length}</dd></div>
                <div className="flex items-center justify-between py-3.5"><dt className="text-sm text-white/55">Navigation</dt><dd className="text-sm font-bold">Horizontale</dd></div>
                <div className="flex items-center justify-between py-3.5"><dt className="text-sm text-white/55">Fonctions</dt><dd className="text-sm font-bold">Conservées</dd></div>
              </dl>
            </div>
          </div>
        </header>

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Espaces de gestion</p>
              <h2 className="mt-1 text-xl font-black text-[#002050]">Choisir un écosystème</h2>
            </div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400"><Sparkles size={14} className="text-[#BF8813]" /> Les couleurs proviennent du registre officiel Omnia.</div>
          </div>

          <div className="grid gap-4 py-6 md:grid-cols-2 xl:grid-cols-3">
            {ADMIN_ECOSYSTEMS.map(ecosystem => {
              const Icon = ecosystem.icon;
              const toolCount = ecosystem.groups.reduce((total, group) => total + group.items.length, 0);
              return (
                <Link
                  key={ecosystem.id}
                  to={ecosystem.entryPath}
                  className="group overflow-hidden rounded-2xl border bg-white transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(0,32,80,.10)]"
                  style={{ borderColor: ecosystem.border }}
                >
                  <div className="h-1" style={{ background: ecosystem.accent }} />
                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl" style={{ background: ecosystem.soft, color: ecosystem.accent }}><Icon size={19} /></span>
                      <span className="min-w-0 flex-1">
                        <strong className="block text-base font-black text-[#002050]">Omnia {ecosystem.label}</strong>
                        <span className="mt-1 block text-xs text-slate-400">{ecosystem.groups.length} domaine{ecosystem.groups.length > 1 ? 's' : ''} · {toolCount} accès de gestion</span>
                      </span>
                    </div>
                    <div className="mt-5 flex items-center justify-between border-t pt-4" style={{ borderColor: ecosystem.border }}>
                      <span className="text-xs font-bold" style={{ color: ecosystem.accent }}>Ouvrir l’administration</span>
                      <ArrowRight size={15} className="text-slate-300 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
