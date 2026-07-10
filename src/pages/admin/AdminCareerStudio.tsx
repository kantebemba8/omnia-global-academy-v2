import { AdminLayout } from '../../components/AdminLayout';
import { BarChart3, Briefcase, Crown, FileText, Mail, MessageSquare, Settings, ShieldCheck, Sparkles, Users } from 'lucide-react';

const cards = [
  { title: 'Modèles de CV', description: 'Créer, modifier, activer ou désactiver les modèles de CV.', icon: FileText, stat: '12 modèles' },
  { title: 'Modèles de lettres', description: 'Gérer les modèles de lettres de motivation disponibles.', icon: Mail, stat: '9 modèles' },
  { title: 'Questions d’entretien', description: 'Gérer les questions RH, techniques et sectorielles.', icon: MessageSquare, stat: '245 questions' },
  { title: 'Coaching IA', description: 'Configurer les conseils, recommandations et limites IA.', icon: Sparkles, stat: 'Actif' },
  { title: 'Premium & jetons CV', description: 'Gérer les accès premium, bonus CV et règles de consommation.', icon: Crown, stat: 'Configurable' },
  { title: 'Statistiques', description: 'Suivre l’utilisation globale de Omnia Career.', icon: BarChart3, stat: 'Vue globale' },
  { title: 'Utilisateurs', description: 'Consulter les apprenants utilisant Omnia Career.', icon: Users, stat: 'Apprenants' },
  { title: 'Candidatures', description: 'Analyser les usages liés au suivi des candidatures.', icon: Briefcase, stat: 'Suivi' },
  { title: 'Paramètres', description: 'Configurer les règles générales de Omnia Career.', icon: Settings, stat: 'Global' },
];

export default function AdminCareerStudio() {
  return (
    <AdminLayout>
      <div className="min-h-screen bg-[#F8FAFC] px-8 py-8">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#D6A11E]/30 bg-[#D6A11E]/10 px-4 py-2 text-sm font-bold text-[#8A650C]"><ShieldCheck className="h-4 w-4" />Accès Super Admin</div>
            <h1 className="text-3xl font-black tracking-tight text-[#061B3A]">Omnia Career Studio</h1>
            <p className="mt-2 max-w-3xl text-slate-600">Espace de gestion Super Admin pour configurer Omnia Career, contrôler les modèles, les contenus, les règles d’accès, les jetons CV, les options premium et les statistiques globales.</p>
          </div>
          <button className="rounded-2xl bg-[#061B3A] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#0B2A5B]">Nouveau contenu</button>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon;
            return <div key={card.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="mb-5 flex items-start justify-between"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#061B3A]/8 text-[#061B3A]"><Icon className="h-6 w-6" /></div><span className="rounded-full bg-[#D6A11E]/10 px-3 py-1 text-xs font-bold text-[#8A650C]">{card.stat}</span></div><h2 className="text-lg font-black text-[#061B3A]">{card.title}</h2><p className="mt-2 min-h-[48px] text-sm leading-6 text-slate-600">{card.description}</p><button className="mt-5 inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">Gérer</button></div>;
          })}
        </div>
      </div>
    </AdminLayout>
  );
}
