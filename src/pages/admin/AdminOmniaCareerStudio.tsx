import { Award, BarChart2, Coins, FileText, Mail, MessageSquare, Settings, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { CareerCard } from '../omnia-career/_CareerUi';

const cards = [
  ['Modèles de CV','Créer, modifier, activer ou désactiver les modèles de CV.',FileText,'12 modèles'],
  ['Modèles de lettres','Gérer les modèles de lettres de motivation disponibles.',Mail,'9 modèles'],
  ['Questions d’entretien','Gérer les questions RH, techniques et sectorielles.',MessageSquare,'245 questions'],
  ['Coaching IA','Configurer les conseils et recommandations IA.',Sparkles,'Actif'],
  ['Premium & jetons CV','Gérer les accès premium, bonus CV et règles de consommation.',Coins,'Configurable'],
  ['Statistiques','Suivre l’utilisation globale de Omnia Career.',BarChart2,'Vue globale'],
  ['Utilisateurs','Consulter les apprenants utilisant Omnia Career.',Users,'Apprenants'],
  ['Validation & contrôle','Contrôler signalements, abus ou contenus sensibles.',ShieldCheck,'Sécurité'],
  ['Certificats & badges','Gérer les badges carrière visibles sur les profils.',Award,'Badges'],
  ['Paramètres','Configurer les règles générales de Omnia Career.',Settings,'Global'],
];

export default function AdminOmniaCareerStudio() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] px-8 py-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#D6A11E]/30 bg-[#D6A11E]/10 px-4 py-2 text-sm font-black text-[#8A650C]"><ShieldCheck className="h-4 w-4" />Accès Super Admin</div>
          <h1 className="text-3xl font-black tracking-tight text-[#061B3A]">Omnia Career Studio</h1>
          <p className="mt-2 max-w-3xl text-slate-600">Espace de gestion Super Admin pour configurer Omnia Career, contrôler les modèles, les contenus, les jetons CV, les accès premium et les statistiques globales.</p>
        </div>
        <button className="rounded-2xl bg-[#061B3A] px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-[#0B2A5B]">Nouveau contenu</button>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {cards.map(([title, text, Icon, stat]: any) => <CareerCard key={title} className="p-6 transition hover:-translate-y-0.5 hover:shadow-md"><div className="mb-5 flex items-start justify-between"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#061B3A]/8 text-[#061B3A]"><Icon className="h-6 w-6" /></div><span className="rounded-full bg-[#D6A11E]/10 px-3 py-1 text-xs font-black text-[#8A650C]">{stat}</span></div><h2 className="text-lg font-black text-[#061B3A]">{title}</h2><p className="mt-2 min-h-[48px] text-sm leading-6 text-slate-600">{text}</p><button className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50">Gérer</button></CareerCard>)}
      </div>
    </div>
  );
}
