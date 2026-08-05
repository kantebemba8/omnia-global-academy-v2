import { getSessionToken } from '../lib/session';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart3, Briefcase, FileText, Lock, Mail, MessageSquare, Settings, UserRound } from 'lucide-react';
import SubspaceHamburgerLayout, { type SubspaceNavItem } from '../components/SubspaceHamburgerLayout';

const TOOLS = [
  { title: 'CV Builder', description: 'Créez un CV moderne, professionnel et optimisé pour les recruteurs.', icon: FileText },
  { title: 'Lettres de motivation', description: 'Personnalisez vos lettres en fonction de chaque offre.', icon: Mail },
  { title: 'Préparation entretien', description: 'Préparez vos réponses et entraînez-vous avec des simulations.', icon: MessageSquare },
  { title: 'Suivi candidatures', description: 'Suivez vos candidatures, relances, entretiens et offres.', icon: Briefcase },
];

const NAV_ITEMS: SubspaceNavItem[] = [
  { label: 'Accueil Career', path: '/career-studio', icon: BarChart3, exact: true },
  { label: 'CV Builder', path: '/career-studio', icon: FileText },
  { label: 'Lettres de motivation', path: '/career-studio', icon: Mail },
  { label: 'Préparation entretien', path: '/career-studio', icon: MessageSquare },
  { label: 'Suivi candidatures', path: '/career-studio', icon: Briefcase },
  { label: 'Profil carrière', path: '/career-studio', icon: UserRound },
  { label: 'Paramètres', path: '/career-studio', icon: Settings },
];

export default function OmniaCareerStudio() {
  const navigate = useNavigate();
  const location = useLocation();
  const isLoggedIn = Boolean(getSessionToken());

  useEffect(() => {
    if (!isLoggedIn) return;
    const params = new URLSearchParams(location.search);
    const suffix = params.get('preview') === 'true' ? '?preview=true' : '';
    navigate(`/dashboard/career-studio${suffix}`, { replace: true });
  }, [isLoggedIn, location.search, navigate]);

  if (isLoggedIn) {
    return <div className="flex min-h-screen items-center justify-center bg-white text-sm text-slate-500">Ouverture d’Omnia Career Studio…</div>;
  }

  const start = () => navigate('/inscription/apprenant?redirect=/dashboard/career-studio');
  const login = () => navigate('/connexion?redirect=/dashboard/career-studio');

  return (
    <SubspaceHamburgerLayout title="Omnia Career Studio" navItems={NAV_ITEMS} searchPath="/dashboard/career-studio" searchParam="search" searchPlaceholder="Rechercher un CV, une LM ou un modèle...">
      <main className="min-h-[calc(100vh-72px)] bg-white px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-8">
          <section className="grid gap-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[1fr_440px] lg:items-center lg:p-10">
            <div>
              <span className="inline-flex rounded-full bg-[#BF8813]/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#9A6A08]">Omnia Career</span>
              <h1 className="mt-5 max-w-3xl text-3xl font-black leading-tight text-[#002050] sm:text-4xl">Votre espace carrière pour créer votre CV, préparer vos candidatures et réussir vos entretiens.</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">Cet aperçu utilise la même interface blanche et le même menu hamburger que l’espace Career connecté. Créez un compte ou connectez-vous pour utiliser les outils.</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <button type="button" onClick={start} className="inline-flex items-center gap-2 rounded-xl bg-[#BF8813] px-5 py-3 text-sm font-bold text-white">Commencer maintenant <ArrowRight size={16} /></button>
                <button type="button" onClick={login} className="rounded-xl border border-[#002050] px-5 py-3 text-sm font-bold text-[#002050]">Se connecter</button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {TOOLS.map(tool => {
                const Icon = tool.icon;
                return (
                  <article key={tool.title} className="relative rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <Lock className="absolute right-4 top-4 h-4 w-4 text-slate-300" />
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#002050]/8 text-[#002050]"><Icon size={19} /></div>
                    <h2 className="mt-4 text-sm font-black text-[#002050]">{tool.title}</h2>
                    <p className="mt-2 text-xs leading-5 text-slate-600">{tool.description}</p>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </main>
    </SubspaceHamburgerLayout>
  );
}
