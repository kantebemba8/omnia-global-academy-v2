import { useMemo, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Palette,
  Pencil,
  Plus,
  Sparkles,
} from 'lucide-react';
import { OmniaCareerShell } from '../../components/career/OmniaCareerShell';

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

function CvPreview() {
  return (
    <div className="mx-auto max-w-[720px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-[#002050] px-12 py-8 text-center text-white">
        <div className="font-serif text-3xl font-bold tracking-[0.18em]">LINA AMANI</div>
        <div className="mt-2 text-sm font-bold uppercase tracking-[0.22em] text-[#bf8813]">Développeuse Full Stack</div>
      </div>
      <div className="border-b border-slate-200 px-12 py-4 text-center text-xs text-slate-500">
        lina.amani@email.com · +33 6 12 34 56 78 · Paris, France · linkedin.com/in/linaamani
      </div>
      <div className="space-y-8 px-12 py-8 text-sm leading-7 text-slate-700">
        <section>
          <h3 className="mb-3 flex items-center gap-2 font-semibold uppercase tracking-wide text-[#002050]"><span className="h-2 w-2 rounded-full bg-[#bf8813]" />Profil</h3>
          <p>Développeuse Full Stack passionnée avec 4 ans d’expérience dans la conception et le développement d’applications web performantes. Spécialisée en JavaScript, React et Node.js, j’aime relever des défis techniques et créer des expériences utilisateur exceptionnelles.</p>
        </section>
        <section>
          <h3 className="mb-3 flex items-center gap-2 font-semibold uppercase tracking-wide text-[#002050]"><span className="h-2 w-2 rounded-full bg-[#bf8813]" />Compétences</h3>
          <div className="flex flex-wrap gap-2">
            {['JavaScript (ES6+)', 'React', 'Next.js', 'Node.js', 'TypeScript', 'HTML5', 'CSS3 / SASS', 'Tailwind CSS', 'SQL / PostgreSQL', 'MongoDB', 'API REST', 'Git / GitHub', 'Docker', 'Figma', 'Agile / Scrum'].map((skill) => (
              <span key={skill} className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">{skill}</span>
            ))}
          </div>
        </section>
        <section>
          <h3 className="mb-3 flex items-center gap-2 font-semibold uppercase tracking-wide text-[#002050]"><span className="h-2 w-2 rounded-full bg-[#bf8813]" />Expériences professionnelles</h3>
          <div className="space-y-5">
            <div className="grid grid-cols-[95px_1fr] gap-5">
              <div className="text-xs font-semibold text-slate-500">Janv. 2022 – Aujourd’hui</div>
              <div><b className="text-[#002050]">Développeuse Full Stack</b><p className="text-[#bf8813]">TechNova Solutions – Paris, France</p><ul className="mt-2 list-disc space-y-1 pl-5"><li>Conception et développement de nouvelles fonctionnalités pour une plateforme SaaS.</li><li>Optimisation des performances et refactorisation du code existant.</li><li>Collaboration avec l’équipe design et produits pour livrer des solutions centrées utilisateur.</li></ul></div>
            </div>
            <div className="grid grid-cols-[95px_1fr] gap-5">
              <div className="text-xs font-semibold text-slate-500">Juin 2020 – Déc. 2021</div>
              <div><b className="text-[#002050]">Développeuse Web Junior</b><p className="text-[#bf8813]">WebCraft Agency – Paris, France</p><ul className="mt-2 list-disc space-y-1 pl-5"><li>Développement d’applications web responsives avec React et Node.js.</li><li>Intégration d’API tierces et gestion des bases de données.</li></ul></div>
            </div>
          </div>
        </section>
        <section>
          <h3 className="mb-3 flex items-center gap-2 font-semibold uppercase tracking-wide text-[#002050]"><span className="h-2 w-2 rounded-full bg-[#bf8813]" />Formation</h3>
          <p><b>Master en Informatique</b> — Université Paris-Saclay, Orsay, France</p>
          <p><b>Licence en Informatique</b> — Université de Nantes, Nantes, France</p>
        </section>
      </div>
    </div>
  );
}

function TemplateThumb({ selected, name }: { selected?: boolean; name: string }) {
  return (
    <div>
      <div className={`relative h-36 rounded-xl border bg-slate-50 p-2 ${selected ? 'border-[#bf8813] ring-2 ring-[#bf8813]/20' : 'border-slate-200'}`}>
        <div className="h-full overflow-hidden rounded-lg bg-white shadow-sm">
          <div className="h-8 bg-[#002050]" />
          <div className="space-y-1 p-2">
            <div className="h-1.5 w-16 rounded bg-slate-300" />
            <div className="h-1 w-full rounded bg-slate-200" />
            <div className="h-1 w-10/12 rounded bg-slate-200" />
            <div className="mt-2 h-1.5 w-14 rounded bg-slate-300" />
            <div className="h-1 w-full rounded bg-slate-200" />
          </div>
        </div>
        {selected && <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#002050] text-white"><CheckCircle2 className="h-4 w-4" /></span>}
      </div>
      <p className="mt-2 text-center text-xs font-bold text-slate-700">{name}</p>
    </div>
  );
}

function CvEditor() {
  return (
    <OmniaCareerShell activeSection="cv">
      <div className="space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500">Omnia Career &gt; CV Builder</p>
            <h1 className="mt-2 text-2xl font-semibold text-[#002050]">CV Builder</h1>
            <p className="mt-1 text-slate-500">Créez un CV professionnel qui vous démarque.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 text-sm font-bold text-emerald-600"><CheckCircle2 className="h-4 w-4" />Enregistré automatiquement</span>
            <button className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700">Changer de modèle</button>
          </div>
        </div>
        <div className="grid grid-cols-[300px_1fr_340px] gap-5">
          <Card className="p-5">
            <h2 className="font-bold text-[#002050]">Sections du CV</h2>
            <p className="mt-1 text-sm text-slate-500">Cliquez sur une section pour la modifier.</p>
            <div className="mt-4 space-y-3">
              {[
                ['Profil', 'Informations personnelles'],
                ['Compétences', 'Compétences clés'],
                ['Expériences', 'Parcours professionnel'],
                ['Formation', 'Diplômes et formations'],
                ['Certifications', 'Certifications obtenues'],
                ['Langues', 'Langues parlées'],
                ['Centres d’intérêt', 'Vos passions'],
              ].map(([title, subtitle], index) => (
                <button key={title} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition hover:bg-slate-50 ${index === 0 ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                  <FileText className="h-5 w-5 text-[#002050]" />
                  <span className="flex-1"><span className="block text-sm font-bold text-slate-900">{title}</span><span className="text-xs text-slate-500">{subtitle}</span></span>
                  {index < 6 ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <span className="h-5 w-5 rounded-full border border-slate-300" />}
                </button>
              ))}
            </div>
            <button className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#bf8813]/60 font-bold text-[#bf8813]"><Plus className="h-4 w-4" />Ajouter une section</button>
          </Card>

          <Card className="p-5">
            <CvPreview />
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between"><h2 className="font-bold text-[#002050]">Modèle</h2><button className="text-xs font-bold text-blue-700">Voir tous les modèles</button></div>
            <div className="mt-4 grid grid-cols-3 gap-3"><TemplateThumb selected name="Moderne" /><TemplateThumb name="Pro" /><TemplateThumb name="Créatif" /></div>
            <div className="mt-6 border-t border-slate-200 pt-5">
              <h2 className="flex items-center gap-2 font-bold text-[#002050]"><Palette className="h-5 w-5" />Couleurs</h2>
              <div className="mt-3 flex gap-3">{['#002050', '#047857', '#111827', '#6D28D9', '#991B1B'].map((color, i) => <span key={color} className={`h-8 w-8 rounded-full border-4 border-white shadow ring-1 ${i === 0 ? 'ring-[#bf8813]' : 'ring-slate-200'}`} style={{ background: color }} />)}</div>
            </div>
            <div className="mt-6 border-t border-slate-200 pt-5">
              <h2 className="font-bold text-[#002050]">Score d’optimisation</h2>
              <div className="mt-4 flex items-center gap-4"><div className="flex h-20 w-20 items-center justify-center rounded-full border-[8px] border-emerald-500 text-xl font-semibold text-[#002050]">82</div><div><h3 className="font-semibold text-emerald-700">Très bon</h3><p className="text-sm text-slate-500">Votre CV est bien optimisé.</p><button className="mt-2 rounded-xl border px-3 py-1.5 text-xs font-bold">Voir le détail</button></div></div>
            </div>
            <div className="mt-6 rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between"><h2 className="font-bold text-[#002050]">Conseils IA</h2><span className="text-xs font-bold text-blue-700">3 recommandations</span></div>
              <div className="mt-4 flex items-center gap-3 rounded-xl bg-blue-50 p-3"><Sparkles className="h-5 w-5 text-blue-700" /><div><b className="text-sm">Quantifiez vos réalisations</b><p className="text-xs text-slate-500">Ajoutez des chiffres pour démontrer l’impact de vos expériences.</p></div></div>
            </div>
            <div className="mt-6 space-y-3">
              <button className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#002050] font-bold text-white"><Pencil className="h-4 w-4" />Modifier</button>
              <button className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 font-bold text-slate-700"><Eye className="h-4 w-4" />Prévisualiser</button>
              <button className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 font-bold text-slate-700"><Download className="h-4 w-4" />Télécharger PDF</button>
            </div>
          </Card>
        </div>
      </div>
    </OmniaCareerShell>
  );
}

function LetterEditor() {
  return (
    <OmniaCareerShell activeSection="letters">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-semibold text-[#002050]">Lettres de motivation</h1><p className="mt-1 text-slate-500">Créez des lettres personnalisées qui captent l’attention des recruteurs.</p></div>
          <div className="flex gap-3"><button className="rounded-xl border px-4 py-3 text-sm font-bold"><Eye className="mr-2 inline h-4 w-4" />Prévisualiser</button><button className="rounded-xl border px-4 py-3 text-sm font-bold"><Download className="mr-2 inline h-4 w-4" />Télécharger</button><button className="rounded-xl bg-[#002050] px-4 py-3 text-sm font-bold text-white"><Sparkles className="mr-2 inline h-4 w-4" />Personnaliser avec IA</button></div>
        </div>
        <div className="grid grid-cols-[300px_1fr_360px] gap-5">
          <Card className="p-5"><h2 className="font-bold text-[#002050]">Mes lettres</h2><div className="mt-4 space-y-3">{['Développeur Full Stack', 'Chef de projet digital', 'Data Analyst', 'Ingénieur Logiciel'].map((letter, i) => <button key={letter} className={`w-full rounded-2xl border p-4 text-left ${i === 0 ? 'border-blue-300 bg-blue-50' : 'border-slate-200'}`}><b className="block text-sm text-[#002050]">{letter}</b><span className="text-xs text-slate-500">Modifié il y a {i + 2} min</span></button>)}</div></Card>
          <Card className="p-7"><div className="mb-5 flex gap-5 border-b border-slate-200 pb-4 text-slate-600"><span>↶</span><span>↷</span><span>Paragraphe</span><b>B</b><i>I</i><span>U</span></div><div className="space-y-5 text-sm leading-7 text-slate-800"><p><b>Lina Amani</b><br />lina.amani@email.com<br />+33 6 12 34 56 78<br />Paris, France</p><p className="text-right">10 mai 2025</p><p>À l’attention de Monsieur Martin Lefèvre<br />Responsable des Ressources Humaines<br />NovaTech Solutions</p><p><b>Objet : Candidature au poste de Développeur Full Stack</b></p><p>Monsieur,</p><p>Passionnée par le développement web et les technologies innovantes, je souhaite vous proposer ma candidature au poste de Développeur Full Stack au sein de NovaTech Solutions.</p><p>Diplômée en informatique et forte de 3 années d’expérience, j’ai développé des compétences solides en JavaScript, React, Node.js et bases de données.</p><p>Je serais ravie d’échanger avec vous lors d’un entretien afin de vous présenter plus en détail ma motivation et mon parcours.</p><p>Lina Amani</p></div></Card>
          <div className="space-y-5"><Card className="p-5"><h2 className="font-bold text-[#002050]">Suggestions IA</h2>{['Mettre en avant votre expérience full stack', 'Valoriser votre impact', 'Montrer votre alignement culturel'].map((tip) => <div key={tip} className="mt-4 rounded-2xl border border-slate-200 p-4"><b className="text-sm text-[#002050]">{tip}</b><button className="mt-3 rounded-xl border px-4 py-2 text-sm font-bold">Appliquer</button></div>)}</Card><Card className="p-5"><h2 className="font-bold text-[#002050]">Variables</h2><div className="mt-4 space-y-3"><div className="rounded-xl border p-3 text-sm">Entreprise : NovaTech Solutions</div><div className="rounded-xl border p-3 text-sm">Poste : Développeur Full Stack</div><div className="rounded-xl border p-3 text-sm">Ton : Professionnel</div></div></Card></div>
        </div>
      </div>
    </OmniaCareerShell>
  );
}

export default function CareerStudioEditor() {
  const [searchParams] = useSearchParams();
  const type = useMemo(() => searchParams.get('type') || 'cv', [searchParams]);
  const navigate = useNavigate();
  return (
    <div>
      <button onClick={() => navigate('/dashboard/career-studio')} className="fixed left-[305px] top-[92px] z-50 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 shadow-sm"><ArrowLeft className="h-4 w-4" />Retour</button>
      {type === 'lm' ? <LetterEditor /> : <CvEditor />}
    </div>
  );
}
