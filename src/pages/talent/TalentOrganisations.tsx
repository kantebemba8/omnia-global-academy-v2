import { Building2 } from 'lucide-react';
import { TalentLayout } from '../../components/talent/TalentLayout';

const BLUE = '#002050';
const GOLD = '#BF8813';

export default function TalentOrganisations() {
  return (
    <TalentLayout>
      <section className="mx-auto max-w-6xl px-5 py-10 md:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: 'rgba(191,136,19,.10)' }}><Building2 size={22} color={GOLD} /></div>
          <div><h1 className="text-3xl font-semibold" style={{ color: BLUE }}>Organisations</h1><p className="mt-1 text-sm text-slate-500">Découvrez les organisations visibles dans l’écosystème Talent Omnia.</p></div>
        </div>
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <p className="text-sm text-slate-500">Les organisations apparaîtront ici à partir des données réelles de la plateforme. Aucune donnée de démonstration n’est affichée.</p>
        </div>
      </section>
    </TalentLayout>
  );
}
