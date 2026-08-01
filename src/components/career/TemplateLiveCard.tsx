import { CvPreview, type DocData, type DesignOptions } from './CvTemplates';
import { LmPreview, type LmData, type LmDesign } from './LmTemplates';
import type { CareerTemplateMeta, CareerDocType } from '../../lib/careerStudioData';

const SAMPLE_CV: DocData = {
  name: 'Amadou Traoré', title: 'Responsable qualité et performance', objective: '',
  summary: 'Professionnel rigoureux, orienté amélioration continue, conformité et résultats mesurables.',
  photo_url: '',
  contact: { email: 'amadou@example.com', phone: '+223 70 00 00 00', location: 'Bamako, Mali', linkedin: 'linkedin.com/in/amadou' },
  experiences: [
    { id:'e1', position:'Responsable qualité', company:'Entreprise Exemple', location:'Bamako', start_date:'2022-01-01', current:true, description:'Pilotage des audits, indicateurs et plans d’amélioration.' },
    { id:'e2', position:'Assistant projet', company:'Organisation Exemple', location:'Dakar', start_date:'2020-01-01', end_date:'2021-12-01', current:false, description:'Suivi opérationnel et reporting.' },
  ],
  education: [{ id:'ed1', degree:'Master Management', school:'Université Exemple', location:'Bamako', year:'2022' }],
  omnia_formations: [],
  skills: [{ id:'s1', name:'Audit', level:88 },{ id:'s2', name:'Gestion de projet', level:82 },{ id:'s3', name:'Excel', level:78 }],
  languages: [{ id:'l1', name:'Français', level:'Courant' },{ id:'l2', name:'Anglais', level:'Intermédiaire' }],
  certifications_external: [{ id:'c1', name:'ISO 9001', issuer:'Organisme Exemple', year:'2024' }],
  projects: [{ id:'p1', name:'Tableau de bord qualité', description:'Conception et déploiement d’un suivi mensuel.', technologies:'Excel • Power BI' }],
  interests: ['Lecture','Innovation'], references:''
};

const SAMPLE_LM: LmData = {
  sender: { name:'Amadou Traoré', address:'Bamako', phone:'+223 70 00 00 00', email:'amadou@example.com', city:'Bamako', date:'13 juillet 2026' },
  recipient: { name:'Madame, Monsieur', company:'Entreprise Exemple', address:'Bamako' },
  subject:'Candidature au poste de Responsable qualité', salutation:'Madame, Monsieur,',
  intro:'Je vous adresse ma candidature pour rejoindre votre organisation.',
  motivation:'Votre engagement en faveur de la qualité et de l’innovation correspond pleinement à mon projet professionnel.',
  skills_paragraph:'Mon expérience en audit, amélioration continue et pilotage d’indicateurs me permet de contribuer rapidement à vos objectifs.',
  company_link:'Je souhaite mettre ces compétences au service de vos équipes.', availability:'Je suis disponible pour un entretien à votre convenance.',
  closing:'Je vous prie d’agréer, Madame, Monsieur, l’expression de mes salutations distinguées.', signature:'Amadou Traoré'
};

function designFrom(template: CareerTemplateMeta): DesignOptions {
  return {
    colors: template.default_colors,
    font:'inter', font_size_body:9, font_size_title:11, line_spacing:1.5,
    photo_enabled: template.template_key !== 'cv_atlas' && template.template_key !== 'cv_impact',
    photo_shape:'round', pages:1,
  };
}

export default function TemplateLiveCard({ template, docType, selected=false, onClick, compact=false }:{
  template: CareerTemplateMeta; docType: CareerDocType; selected?: boolean; onClick?:()=>void; compact?:boolean;
}) {
  const design = designFrom(template);
  const lmDesign: LmDesign = { colors: template.default_colors, font:'inter', font_size_body:10, line_spacing:1.65 };
  return (
    <button type="button" onClick={onClick} className={`group w-full overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${selected?'border-[#002050] ring-4 ring-[#002050]/10':'border-slate-200'}`}>
      <div className={`relative w-full overflow-hidden bg-slate-100 ${compact?'aspect-[9/11]':'aspect-[9/12]'}`}>
        <div className="absolute inset-0 flex items-start justify-center overflow-hidden bg-white">
          <div style={{ transform:`scale(${compact?0.205:0.285})`, transformOrigin:'top center', width:794, minHeight:1123 }}>
            {docType==='cv'
              ? <CvPreview templateKey={template.template_key} data={SAMPLE_CV} design={design} />
              : <LmPreview templateKey={template.template_key} data={SAMPLE_LM} design={lmDesign} />}
          </div>
        </div>
        {selected && <span className="absolute right-2 top-2 rounded-full bg-[#002050] px-2.5 py-1 text-[10px] font-bold text-white">Sélectionné</span>}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-slate-100 p-3">
        <div className="min-w-0"><div className="truncate text-sm font-semibold text-[#002050]">{template.name_fr}</div><div className="mt-0.5 text-[11px] text-slate-500">{template.is_ats_compatible?'Compatible ATS':'Design créatif'}</div></div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${template.is_free?'bg-emerald-50 text-emerald-700':'bg-[#bf8813]/15 text-[#7a570c]'}`}>{template.is_free?'Accessible':'Premium'}</span>
      </div>
    </button>
  );
}
