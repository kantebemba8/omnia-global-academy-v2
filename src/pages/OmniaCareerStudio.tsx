import { ArrowRight, Briefcase, FileText, Mail, MessageSquare, Sparkles, Target } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import CareerPublicLayout from '../components/career/CareerPublicLayout';
import { useAuth } from '../hooks/useAuth';
import { getCareerRedirectForRole, isOmniaCareerLearner } from '../utils/omniaCareerAccess';


const FLOW = [
  { label: 'Positionner', text: 'Clarifier votre cible, votre profil et le message professionnel.', icon: Target },
  { label: 'Présenter', text: 'Construire des CV et lettres cohérents avec votre objectif.', icon: FileText },
  { label: 'Candidater', text: 'Suivre vos candidatures, relances et prochaines étapes.', icon: Briefcase },
  { label: 'Préparer', text: 'Travailler vos réponses et votre posture avant l’entretien.', icon: MessageSquare },
];

export default function OmniaCareerStudio() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-[#F7F5F0]"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#002050]" /></div>;
  }

  if (user) {
    if (isOmniaCareerLearner(user)) return <Navigate to="/omnia-career" replace />;
    return <Navigate to={getCareerRedirectForRole(user)} replace />;
  }

  return (
    <CareerPublicLayout>
      <main className="bg-[#F7F5F0] text-slate-900">
        <section className="relative overflow-hidden border-b border-[#D8D0C2] bg-[#061A32] px-5 py-12 text-white md:px-8 lg:py-20">
          <div className="pointer-events-none absolute inset-0 opacity-60" aria-hidden="true">
            <div className="absolute -right-24 -top-20 h-80 w-80 rounded-full border border-white/10" />
            <div className="absolute right-10 top-10 h-52 w-52 rounded-full border border-[#BF8813]/25" />
            <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-[#BF8813]/40 to-transparent" />
          </div>
          <div className="relative mx-auto grid max-w-[1220px] gap-12 lg:grid-cols-[1.06fr_.94fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#D9B45C]"><Sparkles size={15} /> Omnia Career</div>
              <h1 className="mt-5 max-w-4xl text-4xl font-black leading-[1.02] tracking-[-0.045em] md:text-6xl">Transformez votre parcours en candidature claire, crédible et prête à avancer.</h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-white/68 md:text-lg">CV, lettres de motivation, préparation aux entretiens et suivi des candidatures réunis dans un même studio professionnel.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/inscription/apprenant?redirect=/omnia-career" className="inline-flex items-center gap-2 rounded-xl bg-[#BF8813] px-5 py-3 text-sm font-black text-[#061A32]">Créer mon espace Career <ArrowRight size={17} /></Link>
                <Link to="/forum/emploi" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-black text-white">Explorer les opportunités <Briefcase size={17} /></Link>
              </div>
            </div>

            <div className="relative mx-auto h-[390px] w-full max-w-[520px]" aria-label="Aperçu du studio documentaire Omnia Career">
              <div className="absolute inset-x-8 bottom-7 top-9 rotate-[-7deg] rounded-[28px] border border-white/10 bg-white/5 shadow-2xl" />
              <div className="absolute inset-x-4 bottom-12 top-5 rotate-[4deg] rounded-[28px] border border-[#D4B66C]/25 bg-[#0D294A] shadow-2xl" />
              <div className="absolute inset-0 rounded-[30px] border border-white/15 bg-[#FCFBF8] p-7 text-[#002050] shadow-[0_35px_90px_rgba(0,0,0,.35)]">
                <div className="flex items-center justify-between border-b border-[#E2DDD4] pb-5">
                  <div><p className="text-[10px] font-black uppercase tracking-[0.17em] text-[#9B731C]">Dossier professionnel</p><p className="mt-1 text-xl font-black">Votre candidature</p></div>
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#002050] text-white"><FileText size={20} /></span>
                </div>
                <div className="mt-6 grid grid-cols-[1fr_128px] gap-5">
                  <div className="space-y-4">
                    <div className="h-3 w-3/4 rounded-full bg-[#002050]/16" />
                    <div className="h-2.5 w-full rounded-full bg-slate-200" />
                    <div className="h-2.5 w-5/6 rounded-full bg-slate-200" />
                    <div className="mt-5 border-l-2 border-[#BF8813] pl-4"><p className="text-xs font-black">Expérience & compétences</p><div className="mt-3 h-2.5 w-full rounded-full bg-slate-200" /><div className="mt-2 h-2.5 w-4/5 rounded-full bg-slate-200" /></div>
                  </div>
                  <div className="rounded-2xl bg-[#F0ECE3] p-4"><Target size={19} className="text-[#8B6518]" /><p className="mt-3 text-xs font-black">Cible</p><p className="mt-1 text-[11px] leading-5 text-slate-500">Un message cohérent du CV jusqu’à l’entretien.</p></div>
                </div>
                <div className="absolute bottom-6 right-6 flex items-center gap-2 rounded-full bg-[#002050] px-4 py-2 text-xs font-black text-white"><Mail size={14} /> CV + LM + suivi</div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-[#D8D0C2] bg-[#FCFBF8] px-5 py-10 md:px-8">
          <div className="mx-auto max-w-[1220px]">
            <div className="grid gap-0 border-y border-[#D8D0C2] md:grid-cols-4">
              {FLOW.map((item, index) => {
                const Icon = item.icon;
                return <div key={item.label} className={`px-5 py-6 ${index ? 'border-t border-[#D8D0C2] md:border-l md:border-t-0' : ''}`}><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEE9DF] text-[#002050]"><Icon size={17} /></span><span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#BF8813]">0{index + 1}</span></div><h2 className="mt-5 text-lg font-black text-[#002050]">{item.label}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{item.text}</p></div>;
              })}
            </div>
          </div>
        </section>

        <section className="px-5 py-12 md:px-8 lg:py-16">
          <div className="mx-auto grid max-w-[1220px] gap-10 lg:grid-cols-[.78fr_1.22fr]">
            <div><p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#BF8813]">Un studio, pas une boîte à outils</p><h2 className="mt-3 text-3xl font-black leading-tight tracking-[-0.03em] text-[#002050]">Chaque étape de votre recherche d’opportunités reste reliée à la suivante.</h2><p className="mt-4 text-sm leading-7 text-slate-600">Vous pouvez travailler un document, préparer un entretien ou suivre une candidature sans perdre le contexte global de votre projet professionnel.</p></div>
            <div className="divide-y divide-[#E2DDD4] border-y border-[#D8D0C2] bg-white">
              {[
                { title: 'CV & lettres', text: 'Créer, modifier, comparer et réutiliser vos documents avec les modèles disponibles.', icon: FileText },
                { title: 'Préparation entretien', text: 'Structurer vos réponses et vous entraîner avant une rencontre importante.', icon: MessageSquare },
                { title: 'Suivi candidatures', text: 'Conserver un fil clair entre candidature, relance, entretien et décision.', icon: Briefcase },
              ].map(item => { const Icon = item.icon; return <div key={item.title} className="grid gap-4 px-5 py-6 md:grid-cols-[44px_1fr_auto] md:items-center"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F1EEE7] text-[#002050]"><Icon size={19} /></span><span><strong className="block text-base text-[#002050]">{item.title}</strong><span className="mt-1 block text-sm leading-6 text-slate-500">{item.text}</span></span><ArrowRight size={18} className="hidden text-[#BF8813] md:block" /></div>; })}
            </div>
          </div>
        </section>
      </main>
    </CareerPublicLayout>
  );
}
