import { Briefcase, Calendar, FileText, Mail, MessageSquare, Star, TrendingUp } from 'lucide-react';
import { CareerCard, ButtonPrimary, ButtonSoft } from './_CareerUi';

const stats = [
  { label: 'CV créés', value: '3', sub: '2 à améliorer', icon: FileText, bg: 'bg-blue-50', color: 'text-blue-600', link: 'Voir mes CV' },
  { label: 'Candidatures', value: '12', sub: '4 en cours', icon: Briefcase, bg: 'bg-green-50', color: 'text-green-600', link: 'Voir le suivi' },
  { label: 'Entretiens', value: '2', sub: '1 à venir', icon: Calendar, bg: 'bg-violet-50', color: 'text-violet-600', link: 'Voir mes entretiens' },
  { label: 'Ma progression', value: '68%', sub: '+12% ce mois-ci', icon: TrendingUp, bg: 'bg-amber-50', color: 'text-[#bf8813]', link: 'Voir mon parcours' },
];

const actions = [
  { title: 'Améliorer mon CV', text: 'Votre CV “Développeur Full Stack” peut être optimisé.', badge: 'Prioritaire', icon: FileText, color: 'blue' },
  { title: 'Personnaliser une lettre', text: 'Candidature pour “Développeur Backend – Omnia Tech”.', badge: 'Aujourd’hui', icon: Mail, color: 'green' },
  { title: 'Préparer un entretien', text: 'Entretien technique – 15 mai 2025 à 14h00.', badge: 'Demain', icon: MessageSquare, color: 'violet' },
];

export default function OmniaCareerDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[32px] font-semibold tracking-tight text-[#002050]">Bienvenue, Lina 👋</h1>
        <p className="mt-1 text-[15px] text-slate-500">Voici un aperçu de votre progression et de vos opportunités.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-4">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <CareerCard key={item.label} className="p-5">
              <div className="flex items-center gap-4">
                <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${item.bg} ${item.color}`}>
                  <Icon className="h-7 w-7" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-600">{item.label}</div>
                  <div className="mt-1 text-3xl font-semibold text-[#002050]">{item.value}</div>
                  <div className={`mt-1 text-sm ${item.sub.startsWith('+') ? 'text-green-600' : 'text-slate-500'}`}>{item.sub}</div>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm font-bold text-[#002050]">
                {item.link}<span>›</span>
              </div>
            </CareerCard>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1.05fr_1fr]">
        <CareerCard className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#002050]">Prochaines actions</h2>
            <button className="text-sm font-bold text-blue-700">Voir tout</button>
          </div>
          <div className="space-y-3">
            {actions.map((item) => {
              const Icon = item.icon;
              const colors: Record<string, string> = { blue: 'bg-blue-50 text-blue-600', green: 'bg-green-50 text-green-600', violet: 'bg-violet-50 text-violet-600' };
              return (
                <div key={item.title} className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${colors[item.color]}`}><Icon className="h-5 w-5" /></div>
                  <div className="flex-1">
                    <div className="font-semibold text-[#002050]">{item.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.text}</div>
                  </div>
                  <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{item.badge}</span>
                  <span className="text-slate-400">›</span>
                </div>
              );
            })}
          </div>
        </CareerCard>

        <CareerCard className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#002050]">Mon CV le plus récent</h2>
            <button className="text-sm font-bold text-blue-700">Voir tous mes CV</button>
          </div>
          <div className="flex gap-5">
            <div className="w-44 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
              <div className="h-10 rounded-t-lg bg-[#002050] text-center text-[9px] font-semibold tracking-widest text-white">LINA AMANI</div>
              <div className="space-y-2 p-3">
                <div className="h-2 w-20 rounded bg-slate-200" />
                <div className="h-2 w-28 rounded bg-slate-100" />
                <div className="h-2 w-24 rounded bg-slate-100" />
                <div className="mt-3 h-2 w-16 rounded bg-[#bf8813]/50" />
                <div className="h-2 w-28 rounded bg-slate-100" />
                <div className="h-2 w-20 rounded bg-slate-100" />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-semibold text-[#002050]">Développeur Full Stack</h3>
                <span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">Principal</span>
              </div>
              <p className="mt-1 text-sm text-slate-500">Mis à jour le 10 mai 2025</p>
              <div className="mt-5 space-y-3 text-sm">
                {[
                  ['Score d’optimisation', '82/100'], ['Mots-clés pertinents', '18'], ['Lisibilité', 'Excellente'],
                ].map(([a, b]) => <div key={a} className="flex items-center justify-between"><span className="text-slate-600">✓ {a}</span><span className="font-semibold text-green-600">{b}</span></div>)}
              </div>
              <div className="mt-5 flex gap-2"><ButtonPrimary>Modifier</ButtonPrimary><ButtonSoft>Télécharger</ButtonSoft></div>
            </div>
          </div>
        </CareerCard>

        <CareerCard className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#002050]">Modèles recommandés</h2>
            <button className="text-sm font-bold text-blue-700">Voir tous les modèles</button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {['Moderne', 'Professionnel', 'Créatif'].map((name, i) => (
              <div key={name}>
                <div className="h-44 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                  <div className={`h-full rounded-lg ${i === 0 ? 'bg-[#002050]' : i === 1 ? 'bg-slate-100' : 'bg-emerald-700/10'}`} />
                </div>
                <div className="mt-2 font-semibold text-[#002050]">{name}</div>
                <div className="text-xs text-slate-500">{i === 0 ? 'Idéal pour la tech' : i === 1 ? 'Tous secteurs' : 'Design & Marketing'}</div>
              </div>
            ))}
          </div>
        </CareerCard>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <CareerCard className="p-5">
          <h2 className="mb-4 text-lg font-semibold text-[#002050]">Démarrage rapide</h2>
          <div className="grid grid-cols-4 gap-3">
            {[
              ['Créer un CV', FileText], ['Nouvelle lettre', Mail], ['Préparer entretien', MessageSquare], ['Évaluer mon profil', Star],
            ].map(([label, Icon]: any) => (
              <button key={label} className="rounded-2xl border border-slate-200 bg-white p-4 text-center hover:shadow-sm">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Icon className="h-5 w-5" /></div>
                <div className="text-xs font-semibold text-[#002050]">{label}</div>
                <div className="mt-2 text-xs text-slate-400">Commencer</div>
              </button>
            ))}
          </div>
        </CareerCard>

        <CareerCard className="p-5">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-[#002050]">Activité récente</h2><button className="text-sm font-bold text-blue-700">Voir toute l’activité</button></div>
          {['CV “Développeur Full Stack” mis à jour', 'Lettre “Candidature spontanée” modifiée', 'Entretien planifié avec Omnia Tech'].map((item, i) => (
            <div key={item} className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0">
              <span className="text-sm font-semibold text-slate-700">{item}</span><span className="text-xs text-slate-400">{i === 0 ? '10 mai 2025 à 16:42' : i === 1 ? '9 mai 2025 à 11:15' : '8 mai 2025 à 09:30'}</span>
            </div>
          ))}
        </CareerCard>

        <CareerCard className="p-6">
          <div className="text-2xl text-[#bf8813]">“</div>
          <h2 className="text-lg font-semibold text-[#002050]">Conseil du jour</h2>
          <p className="mt-4 text-[15px] leading-7 text-slate-700">Un CV ciblé augmente vos chances d’entretien de 3 fois. Adaptez-le à chaque offre !</p>
          <button className="mt-5 rounded-xl border border-[#bf8813]/40 px-5 py-3 text-sm font-semibold text-[#bf8813]">Voir tous les conseils</button>
        </CareerCard>
      </div>
    </div>
  );
}
