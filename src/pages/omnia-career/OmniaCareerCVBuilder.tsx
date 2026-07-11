import { Download, Eye, Palette, Pencil, Plus, Sparkles } from 'lucide-react';
import { ButtonPrimary, ButtonSoft, CareerCard, PageHeading } from './_CareerUi';

const cvSections = [
  ['Profil', 'Informations personnelles', true],
  ['Compétences', 'Compétences clés', true],
  ['Expériences', 'Parcours professionnel', true],
  ['Formation', 'Diplômes et formations', true],
  ['Certifications', 'Certifications obtenues', true],
  ['Langues', 'Langues parlées', true],
  ['Centres d’intérêt', 'Vos passions', false],
];

const skills = ['JavaScript (ES6+)', 'React', 'Next.js', 'Node.js', 'TypeScript', 'HTML5', 'CSS3 / SASS', 'Tailwind CSS', 'SQL / PostgreSQL', 'MongoDB', 'API REST', 'Git / GitHub', 'Docker', 'Figma', 'Agile / Scrum'];

export default function OmniaCareerCVBuilder() {
  return (
    <div>
      <PageHeading
        title="CV Builder"
        subtitle="Créez un CV professionnel qui vous démarque."
        actions={<><span className="text-sm font-bold text-green-600">✓ Enregistré automatiquement</span><ButtonSoft>Changer de modèle</ButtonSoft></>}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[285px_1fr_365px]">
        <CareerCard className="p-5">
          <h2 className="text-lg font-semibold text-[#002050]">Sections du CV</h2>
          <p className="mt-1 text-sm text-slate-500">Cliquez sur une section pour la modifier.</p>
          <div className="mt-5 space-y-3">
            {cvSections.map(([title, text, ok], i) => (
              <button key={title as string} className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition ${i === 0 ? 'border-blue-300 bg-blue-50/60' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#002050]"><Pencil className="h-4 w-4" /></div>
                <div className="flex-1"><div className="font-semibold text-[#002050]">{title}</div><div className="text-xs text-slate-500">{text}</div></div>
                <span className={`h-5 w-5 rounded-full ${ok ? 'bg-green-500' : 'border border-slate-300'} text-[11px] text-white flex items-center justify-center`}>{ok ? '✓' : ''}</span>
              </button>
            ))}
          </div>
          <button className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#bf8813]/50 text-sm font-semibold text-[#bf8813]"><Plus className="h-4 w-4" /> Ajouter une section</button>
        </CareerCard>

        <CareerCard className="p-4">
          <div className="mx-auto max-w-[780px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="bg-[#002050] px-14 py-8 text-center text-white">
              <h2 className="font-serif text-3xl font-semibold tracking-[0.16em]">LINA AMANI</h2>
              <p className="mt-2 text-sm font-semibold tracking-[0.18em] text-[#bf8813]">DÉVELOPPEUSE FULL STACK</p>
            </div>
            <div className="px-14 py-5 text-center text-xs text-slate-600">✉ lina.amani@email.com &nbsp;&nbsp; ☎ +33 6 12 34 56 78 &nbsp;&nbsp; ⦿ Paris, France &nbsp;&nbsp; in linkedin.com/in/linaamani</div>
            <div className="space-y-8 px-14 pb-12">
              <section>
                <h3 className="border-b border-slate-200 pb-2 text-sm font-semibold tracking-widest text-[#002050]">PROFIL</h3>
                <p className="mt-4 text-sm leading-7 text-slate-700">Développeuse Full Stack passionnée avec 4 ans d’expérience dans la conception et le développement d’applications web performantes. Spécialisée en JavaScript, React et Node.js, j’aime relever des défis techniques et créer des expériences utilisateur exceptionnelles.</p>
              </section>
              <section>
                <h3 className="border-b border-slate-200 pb-2 text-sm font-semibold tracking-widest text-[#002050]">COMPÉTENCES</h3>
                <div className="mt-4 flex flex-wrap gap-2">{skills.map((s) => <span key={s} className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-[#002050]">{s}</span>)}</div>
              </section>
              <section>
                <h3 className="border-b border-slate-200 pb-2 text-sm font-semibold tracking-widest text-[#002050]">EXPÉRIENCES PROFESSIONNELLES</h3>
                <div className="mt-4 space-y-5 text-sm">
                  <div className="grid grid-cols-[95px_1fr] gap-5">
                    <div className="text-xs font-bold text-slate-500">Janv. 2022 – Aujourd’hui</div>
                    <div><div className="font-semibold text-[#002050]">Développeuse Full Stack</div><div className="font-bold text-[#bf8813]">TechNova Solutions – Paris, France</div><ul className="mt-2 list-disc space-y-1 pl-5 text-slate-600"><li>Conception de nouvelles fonctionnalités pour une plateforme SaaS.</li><li>Optimisation des performances et refactorisation du code existant.</li><li>Collaboration avec l’équipe design et produit.</li></ul></div>
                  </div>
                  <div className="grid grid-cols-[95px_1fr] gap-5">
                    <div className="text-xs font-bold text-slate-500">Juin 2020 – Déc. 2021</div>
                    <div><div className="font-semibold text-[#002050]">Développeuse Web Junior</div><div className="font-bold text-[#bf8813]">WebCraft Agency – Paris, France</div><ul className="mt-2 list-disc space-y-1 pl-5 text-slate-600"><li>Développement d’applications web responsives.</li><li>Intégration d’API tierces et gestion des bases de données.</li></ul></div>
                  </div>
                </div>
              </section>
              <section>
                <h3 className="border-b border-slate-200 pb-2 text-sm font-semibold tracking-widest text-[#002050]">FORMATION</h3>
                <div className="mt-4 text-sm"><b>Master en Informatique</b><br /><span className="text-slate-600">Université Paris-Saclay – Orsay, France</span></div>
              </section>
            </div>
          </div>
        </CareerCard>

        <div className="space-y-5">
          <CareerCard className="p-5">
            <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold text-[#002050]">Modèle</h2><button className="text-sm font-bold text-blue-700">Voir tous les modèles</button></div>
            <div className="grid grid-cols-3 gap-3">
              {['Moderne', 'Professionnel', 'Créatif'].map((name, i) => <div key={name}><div className={`h-36 rounded-xl border p-1 ${i === 0 ? 'border-[#002050]' : 'border-slate-200'}`}><div className={`h-full rounded-lg ${i === 0 ? 'bg-[#002050]' : i === 1 ? 'bg-slate-100' : 'bg-emerald-700/10'}`} /></div><div className="mt-2 text-center text-xs font-bold text-slate-600">{name}</div></div>)}
            </div>
          </CareerCard>
          <CareerCard className="p-5">
            <h2 className="mb-4 font-semibold text-[#002050]">Couleurs</h2>
            <div className="flex items-center gap-3"><Palette className="h-5 w-5 text-slate-400" />{['#002050', '#047857', '#111827', '#6D28D9', '#9F1239'].map((c, i) => <button key={c} className="h-9 w-9 rounded-full border-2 border-white shadow ring-1 ring-slate-200" style={{ background: c }}>{i === 0 ? <span className="text-white">✓</span> : null}</button>)}<button className="h-9 w-9 rounded-full border border-dashed border-slate-300 text-slate-400">+</button></div>
          </CareerCard>
          <CareerCard className="p-5">
            <h2 className="font-semibold text-[#002050]">Score d’optimisation</h2>
            <div className="mt-5 flex items-center gap-5"><div className="flex h-24 w-24 items-center justify-center rounded-full border-[9px] border-green-500 text-center"><div><div className="text-2xl font-semibold text-[#002050]">82</div><div className="text-xs text-slate-500">/100</div></div></div><div><div className="text-xl font-semibold text-green-600">Très bon</div><p className="mt-1 text-sm text-slate-500">Votre CV est bien optimisé. Suivez les conseils IA pour atteindre 90+.</p><button className="mt-3 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-[#002050]">Voir le détail</button></div></div>
          </CareerCard>
          <CareerCard className="p-5">
            <div className="flex items-center justify-between"><h2 className="font-semibold text-[#002050]">Conseils IA</h2><span className="text-xs font-bold text-blue-700">3 recommandations</span></div>
            <div className="mt-4 flex gap-3 rounded-2xl bg-blue-50 p-4"><Sparkles className="h-5 w-5 text-blue-700" /><div><div className="font-semibold text-[#002050]">Quantifiez vos réalisations</div><p className="mt-1 text-sm text-slate-600">Ajoutez des chiffres pour démontrer l’impact de vos expériences.</p></div></div>
          </CareerCard>
          <CareerCard className="p-5"><h2 className="mb-4 font-semibold text-[#002050]">Actions</h2><div className="space-y-3"><ButtonPrimary className="w-full"><Pencil className="mr-2 inline h-4 w-4" /> Modifier</ButtonPrimary><ButtonSoft className="w-full"><Eye className="mr-2 inline h-4 w-4" /> Prévisualiser</ButtonSoft><ButtonSoft className="w-full"><Download className="mr-2 inline h-4 w-4" /> Télécharger PDF</ButtonSoft></div></CareerCard>
        </div>
      </div>
    </div>
  );
}
