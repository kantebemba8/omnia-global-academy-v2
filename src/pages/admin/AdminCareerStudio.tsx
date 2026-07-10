import { AdminLayout } from '../../components/AdminLayout';
import {
  BarChart3, Briefcase, Crown, FileText,
  Mail, MessageSquare, Settings, ShieldCheck, Sparkles, Users
} from 'lucide-react';

const cards = [
  { title: 'Modèles de CV',           description: 'Créer, modifier, activer ou désactiver les modèles de CV.',       icon: FileText,     stat: '12 modèles' },
  { title: 'Modèles de lettres',      description: 'Gérer les modèles de lettres de motivation disponibles.',         icon: Mail,         stat: '9 modèles' },
  { title: 'Questions d\'entretien',  description: 'Gérer les questions RH, techniques et sectorielles.',             icon: MessageSquare, stat: '245 questions' },
  { title: 'Coaching IA',             description: 'Configurer les conseils, recommandations et limites IA.',         icon: Sparkles,     stat: 'Actif' },
  { title: 'Premium & jetons CV',     description: 'Gérer les accès premium, bonus CV et règles de consommation.',   icon: Crown,        stat: 'Configurable' },
  { title: 'Statistiques',            description: 'Suivre l\'utilisation globale de Omnia Career.',                  icon: BarChart3,    stat: 'Vue globale' },
  { title: 'Utilisateurs',            description: 'Consulter les apprenants utilisant Omnia Career.',               icon: Users,        stat: 'Apprenants' },
  { title: 'Candidatures',            description: 'Analyser les usages liés au suivi des candidatures.',            icon: Briefcase,    stat: 'Suivi' },
  { title: 'Paramètres',              description: 'Configurer les règles générales de Omnia Career.',               icon: Settings,     stat: 'Global' },
];

export default function AdminCareerStudio() {
  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
                style={{ background: 'rgba(0,32,80,0.08)', color: '#002050' }}>
                <ShieldCheck size={13} /> Accès Super Admin
              </span>
            </div>
            <h1 className="text-2xl font-semibold" style={{ color: '#002050' }}>
              Omnia Career Studio
            </h1>
            <p className="mt-1 text-sm" style={{ color: '#64748B' }}>
              Espace de gestion Super Admin pour configurer Omnia Career, contrôler les modèles,
              les contenus, les jetons CV, les accès premium et les statistiques globales.
            </p>
          </div>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: '#002050' }}>
            Nouveau contenu
          </button>
        </div>

        {/* Grille cartes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map(({ title, description, icon: Icon, stat }) => (
            <div key={title}
              className="bg-white rounded-2xl border p-5 hover:shadow-md transition-shadow"
              style={{ borderColor: '#E5E7EB' }}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(0,32,80,0.08)' }}>
                  <Icon size={18} style={{ color: '#002050' }} />
                </div>
                <span className="text-xs font-semibold px-2 py-1 rounded-full"
                  style={{ background: 'rgba(191,136,19,0.1)', color: '#bf8813' }}>
                  {stat}
                </span>
              </div>
              <h3 className="text-base font-semibold mb-1" style={{ color: '#002050' }}>{title}</h3>
              <p className="text-sm leading-relaxed mb-4" style={{ color: '#64748B' }}>{description}</p>
              <button
                className="text-sm font-semibold px-4 py-2 rounded-xl border transition-all hover:opacity-90"
                style={{ borderColor: '#002050', color: '#002050' }}>
                Gérer
              </button>
            </div>
          ))}
        </div>

        {/* Stats rapides */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'CV créés',          value: '0',  color: '#002050', bg: '#EEF2FF' },
            { label: 'LM créées',         value: '0',  color: '#002050', bg: '#EEF2FF' },
            { label: 'PDF exportés',      value: '0',  color: '#002050', bg: '#EEF2FF' },
            { label: 'Modèles CV actifs', value: '62', color: '#bf8813', bg: '#FEF3C7' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border p-4"
              style={{ borderColor: '#E5E7EB', background: s.bg }}>
              <p className="text-2xl font-semibold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs mt-1" style={{ color: '#64748B' }}>{s.label}</p>
            </div>
          ))}
        </div>

      </div>
    </AdminLayout>
  );
}
