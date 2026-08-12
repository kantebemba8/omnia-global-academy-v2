import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ChevronDown, ChevronRight } from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import { ADMIN_ECOSYSTEMS } from '../../lib/adminNavigation';

export default function AdminEcosystemHub() {
  const { ecosystemId = '' } = useParams();
  const ecosystem = ADMIN_ECOSYSTEMS.find(item => item.id === ecosystemId);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  if (!ecosystem) return <Navigate to="/admin/ecosystemes" replace />;
  const EcosystemIcon = ecosystem.icon;
  const toolCount = ecosystem.groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <AdminLayout headerTitle={`Omnia ${ecosystem.label}`} headerSubtitle="Administration Super-admin de l’écosystème">
      <div className="mx-auto max-w-[1480px] px-4 py-7 md:px-6 lg:px-8 lg:py-10">
        <Link to="/admin/ecosystemes" className="inline-flex items-center gap-2 text-sm font-black transition" style={{ color: ecosystem.accent }}>
          <ArrowLeft size={16} /> Écosystèmes
        </Link>

        <section className="relative mt-5 overflow-hidden rounded-[30px] border shadow-[0_24px_70px_rgba(0,32,80,.14)]" style={{ borderColor: ecosystem.border, background: `linear-gradient(118deg,#001A3E 0%,#073367 54%,${ecosystem.soft} 54%,${ecosystem.background} 100%)` }}>
          <div className="grid min-h-[290px] lg:grid-cols-[1.12fr_.88fr]">
            <div className="relative px-6 py-8 text-white md:px-9 md:py-10">
              <div className="absolute inset-y-0 right-0 w-32 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.04))]" aria-hidden="true" />
              <p className="text-[11px] font-black uppercase tracking-[.18em]" style={{ color: ecosystem.accent }}>Omnia Administration · Super-admin</p>
              <div className="mt-5 flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10" style={{ color: ecosystem.accent }}><EcosystemIcon size={22} /></span>
                <div>
                  <h1 className="text-3xl font-black tracking-[-.04em] md:text-4xl">Omnia <span style={{ color: ecosystem.accent }}>{ecosystem.label}</span></h1>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-white/68">Espace d’administration dédié. Les outils de gestion restent séparés des pages utilisateur et conservent les routes métier existantes.</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-end gap-5 px-6 py-7 md:px-9">
              <div className="grid grid-cols-2 gap-4 border-b pb-5" style={{ borderColor: ecosystem.border }}>
                <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Domaines</p><p className="mt-1 text-2xl font-black text-[#002050]">{ecosystem.groups.length}</p></div>
                <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Fonctions</p><p className="mt-1 text-2xl font-black text-[#002050]">{toolCount}</p></div>
              </div>
              <p className="text-sm leading-6 text-slate-500">Survolez un domaine pour voir son contenu. Cliquez dessus pour ouvrir sa page dédiée et accéder ensuite à ses fonctions.</p>
            </div>
          </div>
          <div className="h-1.5" style={{ background: ecosystem.accent }} />
        </section>

        <section className="relative mt-7 overflow-visible rounded-[24px] border px-3 py-3 shadow-[0_12px_34px_rgba(0,32,80,.06)]" style={{ borderColor: ecosystem.border, background: ecosystem.soft }} onMouseLeave={() => setOpenGroup(null)}>
          <div className="flex flex-wrap items-center justify-center gap-2" aria-label={`Domaines Omnia ${ecosystem.label}`}>
            {ecosystem.groups.map((group, index) => {
              const GroupIcon = group.icon;
              const destination = `/admin/ecosystemes/${ecosystem.id}/${group.id}`;
              const open = openGroup === group.id;
              return (
                <div key={group.id} className="relative" onMouseEnter={() => setOpenGroup(group.id)} onFocus={() => setOpenGroup(group.id)}>
                  <Link
                    to={destination}
                    className="inline-flex min-h-12 min-w-max items-center gap-2.5 rounded-xl border bg-white px-4 text-sm font-black transition hover:-translate-y-0.5"
                    style={{ borderColor: open ? ecosystem.accent : ecosystem.border, color: ecosystem.accent, boxShadow: open ? `0 12px 28px ${ecosystem.border}` : undefined }}
                  >
                    <GroupIcon size={16} /> {group.label} <ChevronDown size={13} />
                  </Link>
                  {open && (
                    <div className={`absolute top-[calc(100%+8px)] z-[180] w-[min(620px,calc(100vw-40px))] border bg-white p-5 shadow-[0_28px_75px_rgba(0,32,80,.20)] ${index >= ecosystem.groups.length - 2 ? 'right-0' : 'left-0'}`} style={{ borderColor: ecosystem.border }}>
                      <div className="flex items-end justify-between gap-5 border-b pb-4" style={{ borderColor: ecosystem.border }}>
                        <div><p className="text-[10px] font-black uppercase tracking-[.16em]" style={{ color: ecosystem.accent }}>Omnia {ecosystem.label}</p><h2 className="mt-1 text-lg font-black text-[#002050]">{group.label}</h2></div>
                        <Link to={destination} onClick={() => setOpenGroup(null)} className="text-xs font-black" style={{ color: ecosystem.accent }}>Ouvrir la page <ArrowRight className="inline" size={13} /></Link>
                      </div>
                      <div className="grid gap-x-8 pt-2 sm:grid-cols-2">
                        {group.items.map(item => {
                          const ItemIcon = item.icon;
                          return (
                            <Link key={item.path} to={item.path} onClick={() => setOpenGroup(null)} className="group flex items-center gap-3 border-b px-1 py-3 text-sm font-semibold text-slate-600 transition hover:text-[#002050]" style={{ borderColor: ecosystem.border }}>
                              <ItemIcon size={15} style={{ color: ecosystem.accent }} /><span className="flex-1">{item.label}</span><ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" style={{ color: ecosystem.accent }} />
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[.72fr_1.28fr]">
          <div className="rounded-[24px] border p-6" style={{ borderColor: ecosystem.border, background: ecosystem.background }}>
            <p className="text-[10px] font-black uppercase tracking-[.16em]" style={{ color: ecosystem.accent }}>Repère de gestion</p>
            <h2 className="mt-2 text-xl font-black text-[#002050]">Une administration propre à Omnia {ecosystem.label}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">Les pages de gestion utilisent l’identité de cet écosystème, tout en restant dans le cadre Omnia Administration. Aucune prévisualisation de rôle n’est déclenchée depuis cette navigation.</p>
          </div>
          <div className="rounded-[24px] border bg-[#002050] p-6 text-white" style={{ borderColor: ecosystem.border }}>
            <p className="text-[10px] font-black uppercase tracking-[.16em]" style={{ color: ecosystem.accent }}>Parcours recommandé</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {['Choisir un domaine', 'Ouvrir sa page dédiée', 'Lancer la fonction'].map((label, index) => <div key={label} className="border-l-2 pl-4" style={{ borderColor: ecosystem.accent }}><span className="text-xs font-black" style={{ color: ecosystem.accent }}>0{index + 1}</span><p className="mt-1 text-sm font-semibold text-white/85">{label}</p></div>)}
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
