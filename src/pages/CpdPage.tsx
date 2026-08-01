import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { PageFooter } from '../components/PageFooter';
import {
  ArrowRight,
  Award,
  BadgeCheck,
  Building2,
  Check,
  ChevronDown,
  FileBadge2,
  Globe2,
  GraduationCap,
  Landmark,
  Network,
  ShieldCheck,
} from 'lucide-react';

const RECOGNITION_TYPES = [
  { icon: GraduationCap, title: 'Universités et écoles', text: 'Co-certifications, validations académiques et programmes reconnus.' },
  { icon: Building2, title: 'Entreprises et partenaires', text: 'Reconnaissances sectorielles et formations développées avec des organisations.' },
  { icon: Landmark, title: 'Organismes publics et professionnels', text: 'Ordres, institutions, organismes de certification et structures spécialisées.' },
  { icon: Award, title: 'Développement professionnel continu', text: 'Crédits, heures ou points CPD lorsqu’un organisme partenaire les prévoit.' },
];

const LEARNER_BENEFITS = [
  'Identifier clairement l’organisme qui reconnaît ou co-certifie la formation.',
  'Retrouver les logos autorisés, crédits, unités et références sur le certificat.',
  'Vérifier publiquement l’authenticité du document grâce à son QR code.',
  'Présenter les certificats, badges et preuves dans un profil professionnel.',
];

const CREATOR_STEPS = [
  'Choisir un organisme déjà validé ou proposer un nouvel organisme.',
  'Préciser le type de certification, reconnaissance, crédits ou unités.',
  'Soumettre l’association au contrôle du Super-admin.',
  'Afficher automatiquement les éléments autorisés sur la formation et le certificat.',
];

const FAQS = [
  {
    q: 'OGA travaille-t-elle uniquement avec des organismes CPD ?',
    a: 'Non. Omnia Global Academy peut travailler avec des universités, écoles, entreprises, organismes publics, ordres professionnels, organismes de certification, partenaires sectoriels et organismes CPD. Le CPD est une possibilité parmi plusieurs formes de reconnaissance.',
  },
  {
    q: 'Le logo d’un organisme apparaît-il automatiquement ?',
    a: 'Oui, lorsque l’organisme est validé, que son logo est enregistré et que son autorisation d’utilisation couvre la page de formation ou le certificat. Une proposition non validée ne publie pas automatiquement un logo.',
  },
  {
    q: 'Une formation reconnue reçoit-elle toujours des crédits ?',
    a: 'Non. Les crédits, heures ou points dépendent de l’organisme et du programme concernés. OGA affiche uniquement les informations réellement validées.',
  },
  {
    q: 'Comment vérifier un certificat ?',
    a: 'Chaque certificat Omnia actif peut comporter un QR code et un identifiant unique menant à sa page publique de vérification.',
  },
];

export default function CpdPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar />

      <main className="flex-1">
        <section className="relative overflow-hidden bg-[#002050] px-5 py-20 sm:px-6 lg:py-24">
          <div className="absolute inset-0 opacity-35" aria-hidden="true" style={{ backgroundImage: 'radial-gradient(circle at 78% 20%, rgba(191,136,19,.55), transparent 30%), linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px)', backgroundSize: 'auto, 38px 38px, 38px 38px' }} />
          <div className="relative mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#BF8813]/40 bg-[#BF8813]/10 px-4 py-2 text-sm font-semibold text-[#E6BE58]">
                <Network className="h-4 w-4" /> Reconnaissances professionnelles
              </div>
              <h1 className="mt-6 text-4xl font-black leading-tight text-white sm:text-5xl">
                Des formations reliées aux organismes qui leur donnent de la valeur.
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-blue-100">
                OGA rassemble certifications, co-certifications, crédits professionnels, badges et partenariats validés sans dépendre d’un seul standard.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/catalogue" className="inline-flex items-center gap-2 rounded-xl bg-[#BF8813] px-6 py-3 font-bold text-white hover:bg-[#A8730F]">
                  Explorer les formations <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/verify" className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-6 py-3 font-bold text-white hover:bg-white/15">
                  Vérifier un certificat <ShieldCheck className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur-xl">
              <div className="rounded-2xl bg-white p-6">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div className="font-black tracking-widest text-[#002050]">OMNIA</div>
                  <BadgeCheck className="h-7 w-7 text-[#BF8813]" />
                </div>
                <p className="mt-7 text-center text-xs font-bold uppercase tracking-[.2em] text-[#BF8813]">Certificat vérifiable</p>
                <div className="mx-auto mt-5 h-3 w-48 rounded-full bg-slate-100" />
                <div className="mx-auto mt-3 h-2 w-64 max-w-full rounded-full bg-slate-100" />
                <div className="mt-7 flex flex-wrap justify-center gap-2">
                  <span className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">Créateur validé</span>
                  <span className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">Partenaire autorisé</span>
                  <span className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">Crédits éventuels</span>
                </div>
                <div className="mt-7 flex items-center justify-between text-xs text-slate-400">
                  <span>Signatures</span><span>QR</span><span>Logos autorisés</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 py-16 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[.18em] text-[#BF8813]">Un système ouvert</p>
              <h2 className="mt-3 text-3xl font-black text-[#002050]">Toutes les formes de reconnaissance utiles peuvent coexister.</h2>
              <p className="mt-4 leading-7 text-slate-600">Chaque organisme conserve son identité, ses règles et ses autorisations. OGA organise leur affichage sans inventer de reconnaissance ni de partenariat.</p>
            </div>
            <div className="mt-9 grid gap-4 md:grid-cols-2">
              {RECOGNITION_TYPES.map(({ icon: Icon, title, text }) => (
                <article key={title} className="flex gap-4 border-y border-slate-200 py-6">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#F8F2E4] text-[#BF8813]"><Icon className="h-6 w-6" /></span>
                  <div><h3 className="font-bold text-[#002050]">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#F5F7FB] px-5 py-16 sm:px-6">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2">
            <div>
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#002050] text-white"><FileBadge2 className="h-6 w-6" /></span>
              <h2 className="mt-5 text-2xl font-black text-[#002050]">Pour les apprenants</h2>
              <div className="mt-5 space-y-3">
                {LEARNER_BENEFITS.map(item => <p key={item} className="flex gap-3 text-sm leading-6 text-slate-600"><Check className="mt-1 h-4 w-4 shrink-0 text-[#BF8813]" />{item}</p>)}
              </div>
            </div>
            <div>
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#BF8813] text-white"><Globe2 className="h-6 w-6" /></span>
              <h2 className="mt-5 text-2xl font-black text-[#002050]">Pour les créateurs et Structures</h2>
              <div className="mt-5 space-y-3">
                {CREATOR_STEPS.map(item => <p key={item} className="flex gap-3 text-sm leading-6 text-slate-600"><Check className="mt-1 h-4 w-4 shrink-0 text-[#BF8813]" />{item}</p>)}
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 py-16 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <p className="text-center text-xs font-bold uppercase tracking-[.18em] text-[#BF8813]">Questions fréquentes</p>
            <h2 className="mt-3 text-center text-3xl font-black text-[#002050]">Comprendre les reconnaissances OGA</h2>
            <div className="mt-8 space-y-3">
              {FAQS.map((faq, index) => (
                <div key={faq.q} className="overflow-hidden rounded-xl border border-slate-200">
                  <button type="button" onClick={() => setOpenFaq(openFaq === index ? null : index)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-[#002050]" aria-expanded={openFaq === index}>
                    {faq.q}<ChevronDown className={`h-5 w-5 shrink-0 transition-transform ${openFaq === index ? 'rotate-180' : ''}`} />
                  </button>
                  {openFaq === index && <p className="border-t border-slate-100 px-5 py-4 text-sm leading-7 text-slate-600">{faq.a}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <PageFooter />
    </div>
  );
}
