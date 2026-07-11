import { Download, Eye, Plus, Sparkles } from 'lucide-react';
import { ButtonPrimary, ButtonSoft, CareerCard, PageHeading } from './_CareerUi';

const letters = ['Développeur Full Stack', 'Chef de projet digital', 'Data Analyst', 'Ingénieur Logiciel'];
const suggestions = [
  ['Mettre en avant votre expérience full stack', 'Soulignez vos projets complets frontend + backend.'],
  ['Valoriser votre impact', 'Ajoutez des résultats chiffrés pour montrer l’impact concret.'],
  ['Montrer votre alignement culturel', 'Expliquez pourquoi vous êtes attiré par NovaTech.'],
];

export default function OmniaCareerLetters() {
  return (
    <div>
      <PageHeading title="Lettres de motivation" subtitle="Créez des lettres personnalisées qui captent l’attention des recruteurs." actions={<><ButtonSoft><Plus className="mr-2 inline h-4 w-4" />Nouvelle lettre</ButtonSoft><ButtonSoft><Eye className="mr-2 inline h-4 w-4" />Prévisualiser</ButtonSoft><ButtonSoft><Download className="mr-2 inline h-4 w-4" />Télécharger</ButtonSoft><ButtonPrimary><Sparkles className="mr-2 inline h-4 w-4" />Personnaliser avec IA</ButtonPrimary></>} />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[285px_1fr_290px_315px]">
        <CareerCard className="p-5">
          <h2 className="font-semibold text-[#002050]">Mes lettres</h2>
          <input className="mt-4 h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none" placeholder="Rechercher une lettre..." />
          <div className="mt-4 space-y-2">
            {letters.map((letter, i) => <button key={letter} className={`w-full rounded-2xl border p-4 text-left ${i === 0 ? 'border-blue-300 bg-blue-50' : 'border-slate-100 bg-white'}`}><div className="font-semibold text-[#002050]">{letter}</div><div className="mt-1 text-xs text-slate-500">{i === 0 ? 'NovaTech Solutions' : i === 1 ? 'Innovatech' : i === 2 ? 'DataVision' : 'SoftVision'}</div><div className="mt-1 text-xs text-slate-400">Modifié le {10 - i} mai 2025</div></button>)}
          </div>
          <button className="mt-8 w-full text-sm font-semibold text-blue-700">Voir toutes mes lettres →</button>
        </CareerCard>

        <CareerCard className="p-0">
          <div className="flex h-14 items-center gap-4 border-b border-slate-100 px-6 text-sm text-slate-600"><span>↶</span><span>↷</span><select className="rounded-lg border border-slate-200 px-3 py-1.5"><option>Paragraphe</option></select><b>B</b><i>I</i><u>U</u><span>• Liste</span><span>🔗</span></div>
          <div className="min-h-[640px] px-10 py-8 text-[14px] leading-7 text-slate-800">
            <div><b>Lina Amani</b><br />lina.amani@email.com<br />+33 6 12 34 56 78<br />Paris, France</div>
            <div className="mt-2 text-right">10 mai 2025</div>
            <p className="mt-8">À l’attention de Monsieur Martin Lefèvre<br />Responsable des Ressources Humaines<br />NovaTech Solutions<br />15 rue de la Paix<br />75002 Paris, France</p>
            <p className="mt-7 font-bold">Objet : Candidature au poste de Développeur Full Stack</p>
            <p className="mt-6">Monsieur,</p>
            <p className="mt-5">Passionnée par le développement web et les technologies innovantes, je souhaite vous proposer ma candidature au poste de Développeur Full Stack au sein de NovaTech Solutions.</p>
            <p className="mt-4">Diplômée en informatique et forte de 3 années d’expérience dans la conception et le développement d’applications web performantes, j’ai eu l’opportunité de travailler sur des projets variés qui m’ont permis de renforcer mes compétences en JavaScript, React, Node.js et bases de données.</p>
            <p className="mt-4">Rigoureuse, autonome et orientée résultats, je suis convaincue que mes compétences techniques et mon esprit d’équipe seraient un atout pour accompagner vos projets ambitieux.</p>
            <p className="mt-4">Je serais ravie d’échanger avec vous lors d’un entretien afin de vous présenter plus en détail ma motivation et mon parcours.</p>
            <p className="mt-4">Dans l’attente de votre retour, je vous prie d’agréer, Monsieur, l’expression de mes salutations distinguées.</p>
            <p className="mt-6 font-bold">Lina Amani</p>
          </div>
        </CareerCard>

        <div className="space-y-4">
          <CareerCard className="p-5"><h2 className="font-semibold text-[#002050]">Suggestions IA</h2><p className="mt-1 text-sm text-slate-500">Basées sur l’offre et votre profil</p><div className="mt-4 space-y-4">{suggestions.map(([title, text]) => <div key={title} className="rounded-2xl border border-slate-100 bg-white p-4"><div className="font-semibold text-[#002050]">{title}</div><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p><button className="mt-4 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-[#002050]">Appliquer</button></div>)}</div><button className="mt-4 w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold text-blue-700">Voir plus de suggestions</button></CareerCard>
        </div>

        <div className="space-y-4">
          <CareerCard className="p-5"><h2 className="font-semibold text-[#002050]">Structure de la lettre</h2>{['En-tête', 'Introduction', 'Paragraphe 1', 'Paragraphe 2', 'Conclusion'].map((s) => <div key={s} className="flex items-center justify-between border-b border-slate-100 py-3"><div><div className="font-bold text-[#002050]">✓ {s}</div><div className="text-xs text-slate-500">{s === 'En-tête' ? 'Coordonnées et destinataire' : s === 'Introduction' ? 'Accroche et motivation' : 'Contenu personnalisé'}</div></div><span className="text-slate-400">⋮⋮</span></div>)}</CareerCard>
          <CareerCard className="p-5"><h2 className="font-semibold text-[#002050]">Variables</h2><label className="mt-4 block text-xs font-bold text-slate-500">Entreprise</label><input className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3" defaultValue="NovaTech Solutions" /><label className="mt-4 block text-xs font-bold text-slate-500">Poste</label><input className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3" defaultValue="Développeur Full Stack" /><label className="mt-4 block text-xs font-bold text-slate-500">Ton de la lettre</label><div className="mt-2 flex flex-wrap gap-2">{['Professionnel','Motivé','Créatif','Convaincant','Neutre'].map((t,i)=><span key={t} className={`rounded-lg px-3 py-2 text-xs font-semibold ${i===0?'bg-[#bf8813] text-[#002050]':'bg-slate-100 text-slate-600'}`}>{t}</span>)}</div></CareerCard>
        </div>
      </div>
      <CareerCard className="mt-5 grid grid-cols-3 gap-8 p-5"><div><h3 className="font-semibold text-[#002050]">Ciblage de l’offre</h3><div className="mt-3 h-2 rounded bg-slate-100"><div className="h-2 w-[92%] rounded bg-green-500" /></div><p className="mt-2 text-sm font-bold text-green-600">92% de correspondance</p></div><div><h3 className="font-semibold text-[#002050]">Points forts détectés</h3><p className="mt-2 text-sm leading-7 text-slate-600">✓ Compétences alignées<br />✓ Expérience pertinente<br />✓ Mots-clés intégrés</p></div><div><h3 className="font-semibold text-[#002050]">Mots-clés manquants</h3><p className="mt-2 text-sm leading-7 text-slate-600">⚠ Microservices<br />⚠ Docker<br />⚠ CI/CD</p></div></CareerCard>
    </div>
  );
}
