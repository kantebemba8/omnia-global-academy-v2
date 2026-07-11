import { Link } from 'react-router-dom';
import { ArrowRight, Briefcase, CheckCircle2, FileText, Lock, Mail, MessageSquare, Star, User } from 'lucide-react';

const tools = [
  { title: 'CV Builder', text: 'Créez un CV professionnel, moderne et optimisé.', icon: FileText },
  { title: 'Lettres de motivation', text: 'Rédigez une lettre personnalisée pour chaque offre.', icon: Mail },
  { title: 'Préparation entretien', text: 'Entraînez-vous aux questions RH et techniques.', icon: MessageSquare },
  { title: 'Suivi candidatures', text: 'Suivez vos candidatures, relances et réponses.', icon: Briefcase },
  { title: 'Profil carrière', text: 'Construisez un profil professionnel complet.', icon: User },
  { title: 'Coaching carrière', text: 'Recevez des conseils et un plan d’action.', icon: Star },
];

export default function OmniaCareerPublicPreview() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#002050] text-xl font-semibold text-[#bf8813]">O</div>
            <div>
              <div className="font-serif text-3xl leading-none tracking-wide text-[#002050]">OMNIA</div>
              <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-500">GLOBAL ACADEMY</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/connexion?redirect=/omnia-career" className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Se connecter</Link>
            <Link to="/inscription/apprenant?redirect=/omnia-career" className="rounded-xl bg-[#002050] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#002050]">Créer un compte apprenant</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-14">
        <section className="grid grid-cols-1 gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#bf8813]/30 bg-[#bf8813]/10 px-4 py-2 text-sm font-semibold text-[#bf8813]">
              <Star className="h-4 w-4" /> Omnia Career
            </div>
            <h1 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-[#002050]">
              Votre espace carrière pour créer votre CV, préparer vos candidatures et réussir vos entretiens.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Les visiteurs peuvent voir cet aperçu. Pour utiliser les outils, l’apprenant doit créer un compte ou se connecter.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/inscription/apprenant?redirect=/omnia-career" className="inline-flex items-center gap-2 rounded-2xl bg-[#002050] px-6 py-4 text-sm font-semibold text-white shadow-lg hover:bg-[#002050]">
                Commencer maintenant <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/connexion?redirect=/omnia-career" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
                J’ai déjà un compte
              </Link>
            </div>
            <div className="mt-8 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
              {['CV moderne', 'Coaching IA', 'Suivi candidatures'].map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600" /> {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-xl">
            <div className="rounded-2xl bg-[#F8FAFC] p-5">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-[#002050]">Aperçu Omnia Career</h2>
                  <p className="text-sm text-slate-500">Connectez-vous pour utiliser les outils.</p>
                </div>
                <div className="rounded-full bg-[#bf8813]/15 px-3 py-1 text-xs font-semibold text-[#bf8813]">Aperçu public</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {tools.slice(0, 4).map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <div key={tool.title} className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#002050]/8 text-[#002050]"><Icon className="h-5 w-5" /></div>
                      <h3 className="text-sm font-semibold text-slate-900">{tool.title}</h3>
                      <p className="mt-2 text-xs leading-5 text-slate-500">{tool.text}</p>
                      <Lock className="absolute right-3 top-3 h-4 w-4 text-slate-300" />
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 rounded-2xl border border-[#bf8813]/25 bg-[#bf8813]/10 p-4">
                <div className="text-sm font-semibold text-[#002050]">Accès réservé aux apprenants connectés</div>
                <p className="mt-1 text-sm leading-6 text-slate-600">L’aperçu est public, mais CV Builder, lettres, entretiens, candidatures et coaching nécessitent un compte apprenant.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
