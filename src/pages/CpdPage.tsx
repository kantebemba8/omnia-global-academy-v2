import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { PageFooter } from '../components/PageFooter';
import { Globe, Linkedin, TrendingUp, Award, DollarSign, Star, Users, ChevronDown, BadgeCheck } from 'lucide-react';

const LEARNER_ARGS = [
  { icon: Globe, title: 'Reconnue dans +40 pays', desc: 'Votre certification CPD est valide dans tous les pays membres de l\'association CPD.' },
  { icon: Linkedin, title: 'Badge LinkedIn en 1 clic', desc: 'Ajoutez automatiquement votre badge à votre profil LinkedIn dès l\'obtention de votre certificat.' },
  { icon: TrendingUp, title: 'Valorisée par les recruteurs', desc: 'Les certifications CPD sont reconnues et recherchées par les employeurs dans le monde entier.' },
  { icon: Award, title: 'Accréditation internationale', desc: 'Chaque heure de formation CPD compte officiellement dans votre développement professionnel continu.' },
];

const TRAINER_ARGS = [
  { icon: DollarSign, title: 'Accès au palier Premium CPD', desc: 'Les formations CPD accèdent au palier de commission CPD, plus avantageux.' },
  { icon: Star, title: 'Crédibilité renforcée', desc: 'L\'accréditation CPD renforce la confiance des apprenants et augmente les ventes.' },
  { icon: Users, title: 'Meilleure visibilité', desc: 'Les formations CPD sont mises en avant dans le catalogue et les résultats de recherche.' },
];

const FAQS = [
  {
    q: "Qu'est-ce que l'accréditation CPD ?",
    a: "CPD (Continuing Professional Development) est un standard international de reconnaissance de la formation professionnelle continue. Une formation CPD est évaluée et validée par un organisme accrédité, garantissant sa qualité et sa pertinence.",
  },
  {
    q: "Comment fonctionne le badge LinkedIn ?",
    a: "Dès que vous obtenez votre certificat CPD sur Omnia Global Academy, vous recevez un lien unique pour ajouter votre badge directement à la section Licences et certifications de votre profil LinkedIn en un seul clic.",
  },
  {
    q: "Combien de temps prend la validation ?",
    a: "Le certificat est généré automatiquement dès la validation finale de la formation. Le badge Open CPD est émis dans les minutes qui suivent, sous réserve de disponibilité des crédits CPD.",
  },
  {
    q: "Mon certificat CPD est-il valide à l'étranger ?",
    a: "Oui. L'accréditation CPD est reconnue dans plus de 40 pays et par des milliers d'employeurs internationaux. Chaque certificat est vérifiable publiquement via son URL unique.",
  },
];

export default function CpdPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      {/* Hero */}
      <section className="py-20 px-4" style={{ background: 'linear-gradient(135deg, #001840 0%, #002050 60%, #003580 100%)' }}>
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 border border-amber-400/30" style={{ backgroundColor: 'rgba(191,136,19,0.12)' }}>
            <BadgeCheck className="w-4 h-4" style={{ color: '#BF8813' }} />
            <span className="text-sm font-medium" style={{ color: '#BF8813' }}>Standard International CPD</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-4">
            La certification CPD qui<br />ouvre des portes partout
          </h1>
          <p className="text-xl font-semibold mb-8" style={{ color: '#BF8813' }}>Reconnue dans plus de 40 pays</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/catalogue?cpd_only=true"
              className="px-8 py-4 rounded-xl font-semibold text-base transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#BF8813', color: '#fff' }}>
              Je cherche une formation CPD
            </Link>
            <Link to="/inscription/professeur"
              className="px-8 py-4 rounded-xl font-semibold text-base border border-white/30 text-white hover:bg-white/10 transition-colors">
              Je suis formateur
            </Link>
          </div>
        </div>
      </section>

      {/* Learners section */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold uppercase tracking-widest mb-2" style={{ color: '#BF8813' }}>Pour les apprenants</p>
            <h2 className="text-3xl font-bold" style={{ color: '#002050' }}>Pourquoi obtenir une certification CPD ?</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-6 mb-14">
            {LEARNER_ARGS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-4 p-6 rounded-2xl border border-gray-100 hover:border-amber-200 hover:shadow-sm transition-all">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FEF9EE' }}>
                  <Icon className="w-5 h-5" style={{ color: '#BF8813' }} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 mb-1">{title}</p>
                  <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Certificate preview */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl p-8 md:p-12 flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#BF8813' }}>Aperçu du certificat</p>
              <h3 className="text-2xl font-bold mb-3" style={{ color: '#002050' }}>Un certificat élégant et vérifiable</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-4">Chaque certificat Omnia possède un QR code unique qui renvoie vers une page de vérification publique, garantissant son authenticité.</p>
              <Link to="/catalogue?cpd_only=true"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#002050' }}>
                Explorer les formations CPD →
              </Link>
            </div>
            {/* Mini certificate mockup */}
            <div className="w-72 bg-white rounded-2xl shadow-lg overflow-hidden flex-shrink-0 border-2" style={{ borderColor: '#BF8813' }}>
              <div className="p-4" style={{ background: 'linear-gradient(135deg, #002050, #003580)' }}>
                <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">OMNIA GLOBAL ACADEMY</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Certificat de Réussite</p>
                <p className="text-base font-bold mb-0.5" style={{ color: '#002050' }}>Aminata Diallo</p>
                <p className="text-xs text-gray-500 mb-3">Comptabilité & Finance d'entreprise</p>
                <div className="flex items-center justify-center gap-1.5 mb-3">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#FEF9EE', color: '#BF8813', border: '1px solid #BF8813' }}>
                    CPD 12h
                  </span>
                </div>
                <div className="text-xs font-mono text-gray-300">CERT-2026-A3KP9X2MQT</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trainers section */}
      <section className="py-20 px-4" style={{ backgroundColor: '#F8F9FA' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold uppercase tracking-widest mb-2" style={{ color: '#002050' }}>Pour les formateurs</p>
            <h2 className="text-3xl font-bold" style={{ color: '#002050' }}>Pourquoi proposer une formation CPD ?</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 mb-10">
            {TRAINER_ARGS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#EFF6FF' }}>
                  <Icon className="w-6 h-6" style={{ color: '#002050' }} />
                </div>
                <p className="font-semibold text-gray-900 mb-2">{title}</p>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center">
            <Link to="/inscription/professeur"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#BF8813' }}>
              Créer une formation CPD →
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold" style={{ color: '#002050' }}>Questions fréquentes</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="font-semibold text-gray-800 pr-4">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5">
                    <p className="text-gray-600 text-sm leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <PageFooter />
    </div>
  );
}
