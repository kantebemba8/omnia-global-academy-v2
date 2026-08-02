import { getSessionToken } from '../lib/session';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Briefcase, CheckCircle2, FileText, Lock, Mail, MessageSquare, Sparkles, Star, UserRound } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { PageFooter } from '../components/PageFooter';

const TOOLS = [
  { title: 'CV Builder', description: 'Créez un CV moderne, professionnel et optimisé pour les recruteurs.', icon: FileText },
  { title: 'Lettres de motivation', description: 'Personnalisez vos lettres en fonction de chaque offre.', icon: Mail },
  { title: 'Préparation entretien', description: 'Préparez vos réponses et entraînez-vous avec des simulations.', icon: MessageSquare },
  { title: 'Suivi candidatures', description: 'Suivez vos candidatures, relances, entretiens et offres.', icon: Briefcase },
  { title: 'Profil carrière', description: 'Construisez un profil professionnel complet et visible.', icon: UserRound },
  { title: 'Analyse de profil', description: 'Évaluez et améliorez votre positionnement professionnel.', icon: Star },
];

export default function OmniaCareerStudio() {
  const navigate = useNavigate();
  const isLoggedIn = Boolean(getSessionToken());

  function start() {
    if (isLoggedIn) navigate('/dashboard/career-studio');
    else navigate('/inscription/apprenant?redirect=/dashboard/career-studio');
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <Navbar />
      <section className="relative overflow-hidden bg-[#002050] px-6 py-20 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,161,30,0.25),transparent_38%)]" />
        <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#bf8813]/40 bg-white/10 px-4 py-2 text-sm font-bold text-[#bf8813]">
              <Sparkles className="h-4 w-4" /> Omnia Career
            </div>
            <h1 className="max-w-3xl text-2xl font-semibold leading-tight tracking-tight">Votre espace carrière pour créer votre CV, préparer vos candidatures et réussir vos entretiens.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/75">Les visiteurs peuvent voir cet aperçu. Pour utiliser les outils Omnia Career, il faut créer un compte apprenant ou se connecter.</p>
            <div className="mt-8 flex flex-wrap gap-4">
              <button onClick={start} className="inline-flex items-center gap-2 rounded-2xl bg-[#bf8813] px-6 py-4 text-sm font-semibold text-[#002050] shadow-lg transition hover:bg-[#bf8813]">Commencer maintenant <ArrowRight className="h-4 w-4" /></button>
              <button onClick={() => navigate('/connexion?redirect=/dashboard/career-studio')} className="rounded-2xl border border-white/20 bg-white/10 px-6 py-4 text-sm font-bold text-white transition hover:bg-white/15">Se connecter</button>
            </div>
            <div className="mt-8 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
              {['CV moderne', 'Analyse IA', 'Suivi candidatures'].map((item) => <div key={item} className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold"><CheckCircle2 className="h-4 w-4 text-[#bf8813]" />{item}</div>)}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur">
            <div className="rounded-3xl bg-white p-5 text-slate-900">
              <div className="mb-5 flex items-center justify-between">
                <div><h2 className="text-xl font-semibold text-[#002050]">Aperçu Omnia Career</h2><p className="text-sm text-slate-500">Connectez-vous pour utiliser les outils.</p></div>
                <span className="rounded-full bg-[#bf8813]/15 px-3 py-1 text-xs font-bold text-[#bf8813]">Aperçu public</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {TOOLS.slice(0, 4).map((tool) => {
                  const Icon = tool.icon;
                  return <div key={tool.title} className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#002050]/8 text-[#002050]"><Icon className="h-5 w-5" /></div><h3 className="text-sm font-semibold text-slate-900">{tool.title}</h3><p className="mt-2 text-xs leading-5 text-slate-500">{tool.description}</p><Lock className="absolute right-3 top-3 h-4 w-4 text-slate-300" /></div>;
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            return <div key={tool.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#002050]/8 text-[#002050]"><Icon className="h-6 w-6" /></div><h3 className="text-lg font-semibold text-[#002050]">{tool.title}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{tool.description}</p><button onClick={start} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#bf8813]">Créer un compte pour utiliser <ArrowRight className="h-4 w-4" /></button></div>;
          })}
        </div>
      </section>
      <PageFooter />
    </div>
  );
}
