import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import { ADMIN_ECOSYSTEMS } from '../../lib/adminNavigation';

export default function AdminCareerProjectsHub() {
  return (
    <AdminLayout headerTitle="Écosystèmes" headerSubtitle="Administration des espaces Omnia">
      <div className="mx-auto max-w-[1540px] px-4 py-6 md:px-6 md:py-8">
        <header className="relative overflow-hidden rounded-[30px] border border-[#163D69] bg-[linear-gradient(118deg,#001A3E_0%,#002B63_54%,#123E72_100%)] text-white shadow-[0_24px_70px_rgba(0,32,80,.16)]">
          <div className="absolute inset-0 opacity-50" aria-hidden="true"><div className="absolute -right-20 -top-36 h-[420px] w-[420px] rounded-full border border-white/10"/><div className="absolute right-16 top-10 h-[260px] w-[260px] rounded-full border border-[#BF8813]/30"/></div>
          <div className="relative grid gap-8 px-6 py-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,.7fr)] lg:px-9 lg:py-10">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#E9C46A]">Omnia Administration</p>
              <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-[-0.035em] md:text-4xl">Piloter les 7 écosystèmes depuis une administration dédiée.</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/68 md:text-base">Chaque espace conserve ses fonctions Super-admin et sa couleur officielle. Aucun clic ici ne déclenche une prévisualisation de rôle.</p>
            </div>
            <div className="border-l-0 border-white/15 lg:border-l lg:pl-8">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">Architecture</p>
              <dl className="mt-4 divide-y divide-white/10 border-y border-white/10">
                <div className="flex items-center justify-between py-3.5"><dt className="text-sm text-white/55">Écosystèmes</dt><dd className="text-xl font-black">{ADMIN_ECOSYSTEMS.length}</dd></div>
                <div className="flex items-center justify-between py-3.5"><dt className="text-sm text-white/55">Navigation</dt><dd className="text-sm font-bold">Pages dédiées</dd></div>
                <div className="flex items-center justify-between py-3.5"><dt className="text-sm text-white/55">Rôle</dt><dd className="text-sm font-bold">Super-admin</dd></div>
              </dl>
            </div>
          </div>
          <div className="grid grid-cols-7" aria-hidden="true">{ADMIN_ECOSYSTEMS.map(item => <span key={item.id} className="h-1.5" style={{ background: item.accent }}/>)}</div>
        </header>

        <section className="mt-7 rounded-[24px] border border-[#D9E3EF] bg-[#EAF0F7] p-3 shadow-[0_10px_32px_rgba(0,32,80,.06)]">
          <div className="flex flex-wrap items-center justify-center gap-2" aria-label="Choisir un écosystème à administrer">
            {ADMIN_ECOSYSTEMS.map(ecosystem => {
              const Icon = ecosystem.icon;
              return (
                <Link key={ecosystem.id} to={ecosystem.entryPath} className="group inline-flex min-h-12 items-center gap-2.5 rounded-xl border bg-white px-4 text-sm font-black transition hover:-translate-y-0.5 hover:shadow-md" style={{ borderColor: ecosystem.border, color: ecosystem.accent }}>
                  <Icon size={16}/><span>Omnia {ecosystem.label}</span><ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5"/>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
          <div className="rounded-[26px] border border-[#D9E3EF] bg-white/80 p-6 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#9B6B0B]"><Sparkles size={15}/> Accès de gestion</div>
            <h2 className="mt-2 text-xl font-black text-[#002050]">Un hub Super-admin par écosystème</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">Le clic sur un écosystème ouvre sa page d’administration. Les domaines et sous-menus sont ensuite accessibles depuis cette page, sans empiler plusieurs barres de navigation sous l’en-tête.</p>
          </div>
          <div className="rounded-[26px] bg-[#002050] p-6 text-white">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#E9C46A]">Règle de navigation</p>
            <p className="mt-3 text-sm leading-7 text-white/70">Survol : aperçu des contenus. Clic : page dédiée. Fonction : page métier Super-admin. Les pages utilisateur et les prévisualisations restent séparées.</p>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
