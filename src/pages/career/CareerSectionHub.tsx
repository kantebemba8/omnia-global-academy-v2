import { ArrowRight, FileText, Mail, MessageSquare, Target, UserRound } from 'lucide-react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import CareerLearnerLayout from '../../components/career/CareerRoleLayout';
import { getCareerNavigation } from '../../lib/careerNavigation';

const META = {
  documents: {
    eyebrow: 'Votre dossier professionnel',
    title: 'Construire des documents qui racontent clairement votre valeur.',
    text: 'Cette page rassemble vos deux ateliers documentaires. Choisissez le bon format sans mélanger les outils sur une seule page.',
    accent: '#BF8813',
    icon: FileText,
  },
  preparation: {
    eyebrow: 'Votre positionnement',
    title: 'Préparer le message avant de préparer la rencontre.',
    text: 'Travaillez votre profil professionnel puis entraînez-vous aux entretiens dans des espaces dédiés.',
    accent: '#356D7A',
    icon: Target,
  },
} as const;

function withPreview(path: string, search: string) {
  const params = new URLSearchParams(search);
  if (params.get('preview') !== 'true') return path;
  const [base, hash = ''] = path.split('#', 2);
  const [pathname, query = ''] = base.split('?', 2);
  const next = new URLSearchParams(query);
  next.set('preview', 'true');
  return `${pathname}?${next.toString()}${hash ? `#${hash}` : ''}`;
}

export default function CareerSectionHub() {
  const { sectionId } = useParams();
  const location = useLocation();
  if (sectionId !== 'documents' && sectionId !== 'preparation') return <Navigate to="/omnia-career" replace />;
  const section = getCareerNavigation('apprenant').find(item => item.id === sectionId);
  if (!section?.children?.length) return <Navigate to="/omnia-career" replace />;
  const meta = META[sectionId];
  const HeroIcon = meta.icon;

  return (
    <CareerLearnerLayout>
      <main className="min-h-full bg-[#F7F5F0]">
        <section className="border-b border-[#DED8CB] bg-[#FCFBF8] px-5 py-10 md:px-8 lg:py-14">
          <div className="mx-auto grid max-w-[1180px] gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.17em]" style={{ color: meta.accent }}><HeroIcon size={15} />{meta.eyebrow}</div>
              <h1 className="mt-4 max-w-4xl text-3xl font-black leading-[1.08] tracking-[-0.035em] text-[#002050] md:text-5xl">{meta.title}</h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">{meta.text}</p>
            </div>
            <div className="border-l border-[#DED8CB] pl-6">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Organisation Career</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">Chaque sous-fonction conserve sa propre page de travail. La barre horizontale au-dessus sert uniquement à passer d’un atelier à l’autre.</p>
            </div>
          </div>
        </section>
        <section className="px-5 py-8 md:px-8 lg:py-12">
          <div className="mx-auto max-w-[1180px] border-y border-[#D9D3C7] bg-white">
            {section.children.map((child, index) => {
              const Icon = child.icon;
              const supportingIcon = child.label.includes('CV') ? FileText : child.label.includes('Lettre') ? Mail : child.label.includes('entretien') ? MessageSquare : UserRound;
              const Supporting = supportingIcon;
              return (
                <Link key={child.path} to={withPreview(child.path, location.search)} className={`group grid gap-5 px-5 py-6 transition hover:bg-[#FBF8F1] md:grid-cols-[52px_1fr_auto] md:items-center md:px-7 ${index ? 'border-t border-[#E7E1D7]' : ''}`}>
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F1EEE7] text-[#002050]"><Icon size={21} /></span>
                  <span><strong className="block text-lg font-black tracking-[-0.02em] text-[#002050]">{child.label}</strong><span className="mt-1 block text-sm leading-6 text-slate-500">{child.description}</span></span>
                  <span className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.11em] text-[#8B6415]"><Supporting size={16} /> Ouvrir <ArrowRight size={16} className="transition group-hover:translate-x-1" /></span>
                </Link>
              );
            })}
          </div>
        </section>
      </main>
    </CareerLearnerLayout>
  );
}
