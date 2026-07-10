import { useMemo, type ElementType, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BarChart3,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Eye,
  FileText,
  FolderOpen,
  Mail,
  MessageSquare,
  Search,
  ShieldCheck,
  Star,
  Target,
} from 'lucide-react';
import { CareerSection, OmniaCareerShell } from '../../components/career/OmniaCareerShell';

const validSections: CareerSection[] = ['dashboard', 'cv', 'letters', 'interview', 'applications', 'profile', 'coaching', 'settings'];

function sectionFromUrl(value: string | null): CareerSection {
  if (value && validSections.includes(value as CareerSection)) return value as CareerSection;
  return 'dashboard';
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

function SmallStat({ icon: Icon, title, value, subtitle, accent = 'blue' }: { icon: ElementType; title: string; value: string; subtitle: string; accent?: 'blue' | 'green' | 'purple' | 'gold' | 'red' }) {
  const palette = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    purple: 'bg-violet-50 text-violet-700',
    gold: 'bg-amber-50 text-[#D6A11E]',
    red: 'bg-rose-50 text-rose-700',
  }[accent];
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${palette}`}><Icon className="h-6 w-6" /></div>
        <ChevronRight className="h-5 w-5 text-slate-400" />
      </div>
      <div className="mt-4 text-sm font-semibold text-slate-600">{title}</div>
      <div className="mt-1 text-3xl font-black text-[#061B3A]">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{subtitle}</div>
    </Card>
  );
}

function CvMiniature({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${compact ? 'h-44 w-32' : 'h-[250px] w-[185px]'}`}>
      <div className="bg-[#061B3A] px-3 py-3 text-white">
        <div className="text-xs font-black tracking-[0.18em]">LINA AMANI</div>
        <div className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-[#F6C64A]">Développeuse Full Stack</div>
      </div>
      <div className="space-y-2 p-3">
        <div className="h-1.5 w-20 rounded bg-slate-300" />
        <div className="space-y-1">
          <div className="h-1 w-full rounded bg-slate-200" />
          <div className="h-1 w-11/12 rounded bg-slate-200" />
          <div className="h-1 w-4/5 rounded bg-slate-200" />
        </div>
        <div className="h-px bg-slate-200" />
        <div className="grid grid-cols-2 gap-1">
          {['70%', '55%', '85%', '65%', '45%', '75%'].map((width) => <div key={width} className="h-3 rounded bg-blue-50" style={{ width }} />)}
        </div>
        <div className="h-px bg-slate-200" />
        <div className="space-y-1">
          <div className="h-1 w-full rounded bg-slate-200" />
          <div className="h-1 w-10/12 rounded bg-slate-200" />
          <div className="h-1 w-9/12 rounded bg-slate-200" />
        </div>
      </div>
    </div>
  );
}

function DashboardHome() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-[#061B3A]">Bienvenue, Lina 👋</h1>
        <p className="mt-2 text-slate-500">Voici un aperçu de votre progression et de vos opportunités.</p>
      </div>

      <div className="grid grid-cols-4 gap-5">
        <SmallStat icon={FileText} title="CV créés" value="3" subtitle="2 à améliorer" />
        <SmallStat icon={Briefcase} title="Candidatures" value="12" subtitle="4 en cours" accent="green" />
        <SmallStat icon={CalendarDays} title="Entretiens" value="2" subtitle="1 à venir" accent="purple" />
        <SmallStat icon={BarChart3} title="Ma progression" value="68%" subtitle="+12% ce mois-ci" accent="gold" />
      </div>

      <div className="grid grid-cols-[1fr_1.05fr_1fr] gap-5">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-[#061B3A]">Prochaines actions</h2>
            <button className="text-sm font-semibold text-blue-700">Voir tout</button>
          </div>
          <div className="mt-4 space-y-3">
            {[
              { title: 'Améliorer mon CV', text: 'Votre CV “Développeur Full Stack” peut être optimisé.', tag: 'Prioritaire', icon: FileText, color: 'blue' },
              { title: 'Personnaliser une lettre', text: 'Candidature pour “Développeur Backend – Omnia Tech”.', tag: 'Aujourd’hui', icon: Mail, color: 'green' },
              { title: 'Préparer un entretien', text: 'Entretien technique – 15 mai 2025 à 14h00.', tag: 'Demain', icon: MessageSquare, color: 'purple' },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <button key={action.title} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 p-3 text-left transition hover:bg-slate-50">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${action.color === 'green' ? 'bg-emerald-50 text-emerald-700' : action.color === 'purple' ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700'}`}><Icon className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-slate-900">{action.title}</span>
                    <span className="block truncate text-xs text-slate-500">{action.text}</span>
                  </span>
                  <span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">{action.tag}</span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-[#061B3A]">Mon CV le plus récent</h2>
            <button onClick={() => navigate('/dashboard/career-studio?section=cv')} className="text-sm font-semibold text-blue-700">Voir tous mes CV</button>
          </div>
          <div className="mt-4 flex gap-5">
            <CvMiniature compact />
            <div className="flex-1">
              <div className="flex items-center gap-2"><h3 className="text-lg font-black text-[#061B3A]">Développeur Full Stack</h3><span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">Principal</span></div>
              <p className="mt-1 text-sm text-slate-500">Mis à jour le 10 mai 2025</p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between"><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" />Score d’optimisation</span><b className="text-emerald-700">82/100</b></div>
                <div className="flex items-center justify-between"><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" />Mots-clés pertinents</span><b className="text-emerald-700">18</b></div>
                <div className="flex items-center justify-between"><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" />Lisibilité</span><b className="text-emerald-700">Excellente</b></div>
              </div>
              <div className="mt-5 flex gap-2">
                <button onClick={() => navigate('/dashboard/career-studio/editor/new?type=cv')} className="rounded-xl bg-[#061B3A] px-4 py-2 text-sm font-bold text-white">Modifier</button>
                <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700">Télécharger</button>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-[#061B3A]">Modèles recommandés</h2>
            <button className="text-sm font-semibold text-blue-700">Voir tous les modèles</button>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {['Moderne', 'Professionnel', 'Créatif'].map((name, index) => (
              <div key={name}>
                <div className="relative rounded-xl border border-slate-200 bg-slate-50 p-2">
                  <CvMiniature compact />
                  <span className="absolute bottom-3 right-3 rounded-full bg-white p-1 shadow"><Eye className="h-4 w-4 text-slate-600" /></span>
                </div>
                <div className="mt-2 text-sm font-bold text-slate-900">{name}</div>
                <div className="text-xs text-slate-500">{index === 0 ? 'Idéal pour la tech' : index === 1 ? 'Tous secteurs' : 'Design & Marketing'}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <Card className="p-5">
          <h2 className="font-bold text-[#061B3A]">Démarrage rapide</h2>
          <div className="mt-4 grid grid-cols-4 gap-3">
            {[
              { label: 'Créer un CV', icon: FileText, section: 'cv' },
              { label: 'Nouvelle lettre', icon: Mail, section: 'letters' },
              { label: 'Préparer entretien', icon: MessageSquare, section: 'interview' },
              { label: 'Évaluer mon profil', icon: Star, section: 'profile' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.label} onClick={() => navigate(`/dashboard/career-studio?section=${item.section}`)} className="rounded-2xl border border-slate-200 p-4 text-center transition hover:bg-slate-50">
                  <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Icon className="h-5 w-5" /></span>
                  <span className="mt-3 block text-xs font-bold text-slate-900">{item.label}</span>
                  <span className="mt-1 block text-xs text-slate-500">Commencer</span>
                </button>
              );
            })}
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between"><h2 className="font-bold text-[#061B3A]">Activité récente</h2><button className="text-sm font-semibold text-blue-700">Voir toute l’activité</button></div>
          <div className="mt-4 space-y-3 text-sm">
            {['CV “Développeur Full Stack” mis à jour', 'Lettre “Candidature spontanée” modifiée', 'Entretien planifié avec Omnia Tech'].map((item, i) => (
              <div key={item} className="flex items-center justify-between"><span className="flex items-center gap-2"><span className="h-8 w-8 rounded-xl bg-blue-50" />{item}</span><span className="text-slate-500">{i === 0 ? '10 mai 2025 à 16:42' : i === 1 ? '9 mai 2025 à 11:15' : '8 mai 2025 à 09:30'}</span></div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start gap-4">
            <div className="text-4xl text-[#D6A11E]">“</div>
            <div>
              <h2 className="font-bold text-[#061B3A]">Conseil du jour</h2>
              <p className="mt-4 leading-7 text-slate-700">Un CV ciblé augmente vos chances d’entretien de 3 fois. Adaptez-le à chaque offre !</p>
              <button className="mt-5 rounded-xl border border-[#D6A11E]/40 px-4 py-2 text-sm font-bold text-[#8A650C]">Voir tous les conseils</button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function CvBuilderOverview() {
  const navigate = useNavigate();
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500">Omnia Career &gt; CV Builder</p>
          <h1 className="mt-2 text-3xl font-black text-[#061B3A]">CV Builder</h1>
          <p className="mt-1 text-slate-500">Créez un CV professionnel qui vous démarque.</p>
        </div>
        <button onClick={() => navigate('/dashboard/career-studio/editor/new?type=cv')} className="rounded-2xl bg-[#061B3A] px-5 py-3 text-sm font-bold text-white shadow-sm">Créer / modifier mon CV</button>
      </div>
      <div className="grid grid-cols-[280px_1fr_320px] gap-5">
        <Card className="p-5">
          <h2 className="font-bold text-[#061B3A]">Sections du CV</h2>
          <p className="mt-1 text-sm text-slate-500">Cliquez sur une section pour la modifier.</p>
          <div className="mt-4 space-y-3">
            {['Profil', 'Compétences', 'Expériences', 'Formation', 'Certifications', 'Langues', 'Centres d’intérêt'].map((section, index) => (
              <button key={section} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 p-3 text-left hover:bg-slate-50">
                <FileText className="h-5 w-5 text-[#061B3A]" />
                <span className="flex-1"><span className="block text-sm font-bold text-slate-900">{section}</span><span className="text-xs text-slate-500">{index === 0 ? 'Informations personnelles' : 'Complété'}</span></span>
                {index < 6 ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <span className="h-5 w-5 rounded-full border border-slate-300" />}
              </button>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <div className="mx-auto max-w-[680px] rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="bg-[#061B3A] px-10 py-8 text-center text-white"><div className="font-serif text-3xl font-bold tracking-[0.18em]">LINA AMANI</div><div className="mt-2 text-sm font-bold uppercase tracking-[0.22em] text-[#F6C64A]">Développeuse Full Stack</div></div>
            <div className="space-y-7 px-10 py-8 text-sm text-slate-700">
              <section><h3 className="mb-3 font-black uppercase tracking-wide text-[#061B3A]">Profil</h3><p>Développeuse Full Stack passionnée avec 4 ans d’expérience dans la conception et le développement d’applications web performantes.</p></section>
              <section><h3 className="mb-3 font-black uppercase tracking-wide text-[#061B3A]">Compétences</h3><div className="flex flex-wrap gap-2">{['JavaScript', 'React', 'Next.js', 'Node.js', 'TypeScript', 'Tailwind CSS', 'SQL', 'MongoDB'].map(skill => <span key={skill} className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">{skill}</span>)}</div></section>
              <section><h3 className="mb-3 font-black uppercase tracking-wide text-[#061B3A]">Expériences professionnelles</h3><p><b>Développeuse Full Stack</b> — TechNova Solutions, Paris</p><ul className="mt-2 list-disc space-y-1 pl-5"><li>Développement de fonctionnalités pour une plateforme SaaS.</li><li>Optimisation des performances et refactorisation du code.</li></ul></section>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="font-bold text-[#061B3A]">Modèle</h2>
          <div className="mt-4 grid grid-cols-3 gap-3">{['Moderne', 'Pro', 'Créatif'].map(x => <div key={x}><CvMiniature compact /><p className="mt-2 text-center text-xs font-bold">{x}</p></div>)}</div>
          <h2 className="mt-6 font-bold text-[#061B3A]">Couleurs</h2>
          <div className="mt-3 flex gap-3">{['#061B3A', '#047857', '#111827', '#6D28D9', '#991B1B'].map(c => <span key={c} className="h-8 w-8 rounded-full border-4 border-white shadow ring-1 ring-slate-200" style={{ background: c }} />)}</div>
          <div className="mt-6 rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-4"><div className="flex h-20 w-20 items-center justify-center rounded-full border-[8px] border-emerald-500 text-xl font-black text-[#061B3A]">82</div><div><h3 className="font-black text-emerald-700">Très bon</h3><p className="text-sm text-slate-500">Votre CV est bien optimisé.</p></div></div></div>
          <button onClick={() => navigate('/dashboard/career-studio/editor/new?type=cv')} className="mt-6 h-12 w-full rounded-xl bg-[#061B3A] font-bold text-white">Modifier</button>
          <button className="mt-3 h-12 w-full rounded-xl border border-slate-200 font-bold text-slate-700">Télécharger PDF</button>
        </Card>
      </div>
    </div>
  );
}

function LettersPage() {
  const navigate = useNavigate();
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><div><h1 className="text-3xl font-black text-[#061B3A]">Lettres de motivation</h1><p className="mt-1 text-slate-500">Créez des lettres personnalisées qui captent l’attention des recruteurs.</p></div><button onClick={() => navigate('/dashboard/career-studio/editor/new?type=lm')} className="rounded-2xl bg-[#061B3A] px-5 py-3 text-sm font-bold text-white">+ Nouvelle lettre</button></div>
      <div className="grid grid-cols-[300px_1fr_360px] gap-5">
        <Card className="p-5"><h2 className="font-bold text-[#061B3A]">Mes lettres</h2><div className="mt-4 space-y-3">{['Développeur Full Stack', 'Chef de projet digital', 'Data Analyst', 'Ingénieur Logiciel'].map((l, i) => <button key={l} className={`w-full rounded-2xl border p-4 text-left ${i === 0 ? 'border-blue-300 bg-blue-50' : 'border-slate-200'}`}><b className="block text-sm text-[#061B3A]">{l}</b><span className="text-xs text-slate-500">Modifié il y a {i + 2} min</span></button>)}</div></Card>
        <Card className="p-7"><div className="mb-5 flex gap-5 border-b border-slate-200 pb-4 text-slate-600"><span>↶</span><span>↷</span><span>Paragraphe</span><b>B</b><i>I</i><span>U</span></div><div className="space-y-5 text-sm leading-7 text-slate-800"><p><b>Lina Amani</b><br />lina.amani@email.com<br />Paris, France</p><p className="text-right">10 mai 2025</p><p>Objet : Candidature au poste de Développeur Full Stack</p><p>Monsieur,</p><p>Passionnée par le développement web et les technologies innovantes, je souhaite vous proposer ma candidature au poste de Développeur Full Stack au sein de NovaTech Solutions.</p><p>Diplômée en informatique et forte de 3 années d’expérience, j’ai développé des compétences solides en JavaScript, React, Node.js et bases de données.</p><p>Je serais ravie d’échanger avec vous lors d’un entretien afin de vous présenter plus en détail ma motivation et mon parcours.</p><p>Lina Amani</p></div></Card>
        <div className="space-y-5"><Card className="p-5"><h2 className="font-bold text-[#061B3A]">Suggestions IA</h2>{['Mettre en avant votre expérience full stack', 'Valoriser votre impact', 'Montrer votre alignement culturel'].map(t => <div key={t} className="mt-4 rounded-2xl border border-slate-200 p-4"><b className="text-sm text-[#061B3A]">{t}</b><button className="mt-3 rounded-xl border px-4 py-2 text-sm font-bold">Appliquer</button></div>)}</Card><Card className="p-5"><h2 className="font-bold text-[#061B3A]">Structure de la lettre</h2>{['En-tête', 'Introduction', 'Paragraphe 1', 'Paragraphe 2', 'Conclusion'].map(x => <div key={x} className="mt-3 flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-emerald-600" />{x}</div>)}</Card></div>
      </div>
    </div>
  );
}

function InterviewPage() {
  return <div className="space-y-5"><h1 className="text-3xl font-black text-[#061B3A]">Préparation entretien</h1><p className="text-slate-500">Entraînez-vous, maîtrisez les questions clés et gagnez en confiance.</p><div className="grid grid-cols-[1fr_1fr_360px] gap-5"><Card className="p-5"><h2 className="font-bold text-[#061B3A]">Catégories d’entretien</h2><div className="mt-4 grid grid-cols-2 gap-4">{['Développeur Full Stack', 'Data & Analytics', 'Product Manager', 'Design & UX/UI', 'Questions RH'].map(x => <div key={x} className="rounded-2xl border p-4"><b>{x}</b><p className="text-sm text-slate-500">28 questions</p></div>)}</div></Card><Card className="bg-[#061B3A] p-6 text-white"><h2 className="text-xl font-bold">Simulation entretien</h2><p className="mt-2 text-white/70">Entraînez-vous dans des conditions réalistes.</p><div className="mt-5 rounded-xl border border-white/15 p-3">Développeur Full Stack</div><button className="mt-5 w-full rounded-xl bg-[#F6C64A] py-3 font-black text-[#061B3A]">Commencer une simulation</button></Card><Card className="p-5"><h2 className="font-bold text-[#061B3A]">Checklist STAR</h2>{['Situation', 'Tâche', 'Action', 'Résultat'].map(x => <div key={x} className="mt-4 flex items-center justify-between"><span>{x}</span><span className="h-5 w-5 rounded border" /></div>)}</Card></div><div className="grid grid-cols-3 gap-5"><Card className="p-5"><h2 className="font-bold">Questions fréquentes</h2><ul className="mt-3 list-disc pl-5 text-sm leading-7"><li>Parlez-moi de vous.</li><li>Pourquoi cette entreprise ?</li><li>Vos forces et faiblesses ?</li></ul></Card><Card className="p-5"><h2 className="font-bold">Questions techniques</h2><ul className="mt-3 list-disc pl-5 text-sm leading-7"><li>Différence SQL / NoSQL.</li><li>Qu’est-ce qu’une API REST ?</li></ul></Card><Card className="p-5"><h2 className="font-bold">Mes prochains entretiens</h2><p className="mt-3 text-sm">Entretien technique — 10 mai 2025 à 14:00</p></Card></div></div>;
}

function ApplicationsPage() {
  const columns = ['À envoyer', 'Envoyées', 'Entretien', 'Offres', 'Refus'];
  const jobs = ['TotalEnergies', 'BNP Paribas', 'Schneider Electric', 'Sanofi', 'Google'];
  return <div className="space-y-5"><div className="flex items-center justify-between"><div><h1 className="text-3xl font-black text-[#061B3A]">Suivi candidatures</h1><p className="text-slate-500">Suivez l’avancement de vos candidatures et ne manquez aucune opportunité.</p></div><button className="rounded-2xl bg-[#061B3A] px-5 py-3 text-sm font-bold text-white">+ Ajouter une candidature</button></div><div className="flex gap-3"><div className="flex h-11 w-[320px] items-center rounded-xl border bg-white px-3"><Search className="mr-2 h-4 w-4 text-slate-400" />Rechercher une candidature...</div>{['Statut', 'Type de contrat', 'Lieu', 'Plus de filtres'].map(x => <button key={x} className="rounded-xl border bg-white px-4 font-bold text-slate-600">{x}</button>)}</div><div className="grid grid-cols-[repeat(5,1fr)_240px] gap-4"><div className="col-span-5 grid grid-cols-5 gap-4">{columns.map((col, i) => <div key={col} className={`min-h-[560px] rounded-2xl border p-4 ${i === 3 ? 'bg-emerald-50/50' : i === 4 ? 'bg-rose-50/50' : 'bg-white'}`}><h2 className="font-black text-[#061B3A]">{col}</h2><div className="mt-4 space-y-3">{[0,1,2].slice(0, i === 3 ? 1 : i === 4 ? 2 : 3).map(n => <div key={n} className="rounded-2xl border bg-white p-4 shadow-sm"><b className="block text-sm text-[#061B3A]">{jobs[i]}</b><span className="text-xs text-slate-500">{i === 2 ? 'Entretien RH' : i === 3 ? 'Offre reçue' : i === 4 ? 'Refusée' : 'Ingénieur Data Analyst'}</span><button className="mt-3 text-xs font-bold text-blue-700">Voir les détails</button></div>)}</div></div>)}</div><Card className="p-4"><h2 className="font-black text-[#061B3A]">Aperçu</h2>{[['Taux de réponse','28%'],['Candidatures actives','14'],['Relances à faire','6'],['Entretiens à venir','3']].map(([a,b]) => <div key={a} className="mt-4 rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-500">{a}</div><div className="text-2xl font-black text-[#061B3A]">{b}</div></div>)}</Card></div></div>;
}

function ProfilePage() {
  return <div className="space-y-5"><div className="flex items-center justify-between"><div><h1 className="text-3xl font-black text-[#061B3A]">Profil carrière</h1><p className="text-slate-500">Gérez votre profil professionnel et augmentez votre visibilité auprès des recruteurs.</p></div><button className="rounded-2xl bg-[#061B3A] px-5 py-3 text-sm font-bold text-white">Modifier mon profil</button></div><div className="grid grid-cols-3 gap-5"><Card className="p-5"><div className="flex items-center gap-5"><div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#061B3A] text-3xl font-black text-white">LA</div><div><h2 className="text-xl font-black">Lina Amani</h2><p>Développeuse Full Stack</p><p className="text-sm text-slate-500">Paris, France</p></div></div></Card><Card className="p-5"><h2 className="font-bold">Complétude du profil</h2><div className="mt-4 flex items-center gap-4"><div className="flex h-24 w-24 items-center justify-center rounded-full border-[10px] border-emerald-500 text-2xl font-black">82%</div><p className="text-sm text-slate-600">Excellent ! Votre profil est bien renseigné.</p></div></Card><Card className="p-5"><h2 className="font-bold">Badges Omnia Global Academy</h2><div className="mt-4 flex gap-4"><ShieldCheck className="h-16 w-16 text-[#061B3A]" /><Star className="h-16 w-16 text-[#D6A11E]" /><Target className="h-16 w-16 text-[#061B3A]" /></div></Card></div><div className="grid grid-cols-3 gap-5"><Card className="p-5"><h2 className="font-bold">Résumé professionnel</h2><p className="mt-3 text-sm leading-7">Développeuse Full Stack avec plus de 4 ans d’expérience dans la conception et le déploiement d’applications web performantes.</p></Card><Card className="p-5"><h2 className="font-bold">Compétences</h2><div className="mt-3 flex flex-wrap gap-2">{['JavaScript','React','Node.js','Docker','AWS','GitHub'].map(x => <span key={x} className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold">{x}</span>)}</div></Card><Card className="p-5"><h2 className="font-bold">Portfolio & Documents</h2><p className="mt-3 text-sm text-blue-700">linaamani.dev</p><p className="mt-2 text-sm">CV Lina Amani.pdf</p></Card></div></div>;
}

function CoachingPage() {
  return <div className="space-y-5"><h1 className="text-3xl font-black text-[#061B3A]">Coaching carrière ⭐</h1><p className="text-slate-500">Avancez avec un accompagnement personnalisé pour atteindre vos objectifs professionnels.</p><div className="grid grid-cols-5 gap-5"><SmallStat icon={BarChart3} title="Progression globale" value="72%" subtitle="En progression" /><SmallStat icon={CalendarDays} title="Sessions complétées" value="8" subtitle="sur 12 sessions" accent="red" /><SmallStat icon={CheckCircle2} title="Objectifs atteints" value="3" subtitle="sur 5 objectifs" accent="green" /><SmallStat icon={CalendarDays} title="Prochaine session" value="14 mai" subtitle="10:00 - 11:00" accent="purple" /><SmallStat icon={FolderOpen} title="Plan en cours" value="30 jours" subtitle="Étape 3 sur 4" accent="gold" /></div><div className="grid grid-cols-3 gap-5"><Card className="p-6"><h2 className="font-black">Objectif professionnel</h2><p className="mt-4 text-xl font-black text-[#061B3A]">Devenir Développeur Full Stack</p><p className="mt-2 text-slate-500">Évoluer vers un poste tech innovant d’ici 6 mois.</p></Card><Card className="p-6"><h2 className="font-black">Plan 30 jours</h2><p className="mt-4 text-sm text-slate-500">Diagnostic terminé · Plan d’action en cours · Mise en œuvre à venir.</p></Card><Card className="bg-[#061B3A] p-6 text-white"><h2 className="font-black">Coaching IA</h2><p className="mt-2 text-white/70">Votre coach IA disponible 24/7.</p><button className="mt-6 w-full rounded-xl bg-[#F6C64A] py-3 font-black text-[#061B3A]">Poser une question</button></Card></div></div>;
}

function SettingsPage() {
  return <div className="space-y-5"><h1 className="text-3xl font-black text-[#061B3A]">Paramètres</h1><p className="text-slate-500">Gérez vos préférences, votre compte et la confidentialité de vos données.</p><div className="grid grid-cols-3 gap-5">{['Compte', 'Profil', 'Notifications', 'Confidentialité', 'Langue', 'Téléchargements', 'Abonnement', 'Sécurité'].map((title) => <Card key={title} className="p-5"><h2 className="font-black text-[#061B3A]">{title}</h2><div className="mt-4 space-y-3"><div className="h-10 rounded-xl border bg-white" /><div className="h-10 rounded-xl border bg-white" /></div></Card>)}</div></div>;
}

export default function DashboardCareerStudio() {
  const [searchParams] = useSearchParams();
  const section = useMemo(() => sectionFromUrl(searchParams.get('section')), [searchParams]);
  const content = {
    dashboard: <DashboardHome />,
    cv: <CvBuilderOverview />,
    letters: <LettersPage />,
    interview: <InterviewPage />,
    applications: <ApplicationsPage />,
    profile: <ProfilePage />,
    coaching: <CoachingPage />,
    settings: <SettingsPage />,
  }[section];

  return <OmniaCareerShell activeSection={section}>{content}</OmniaCareerShell>;
}
