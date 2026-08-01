import { CheckCircle2, FileText, Search, Target } from 'lucide-react';
import type { DocData } from './CvTemplates';
import type { LmData } from './LmTemplates';
import type { CareerDocumentFull } from '../../lib/careerStudioData';
import { extractJobKeywords, getCareerMeta, withCareerMeta } from '../../lib/careerBuilderV2';

type Props = {
  document: CareerDocumentFull;
  onChange: (document: CareerDocumentFull) => void;
};

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#002050] focus:ring-4 focus:ring-[#002050]/10';

export default function CareerTargetPanel({ document, onChange }: Props) {
  const data = document.doc_data as DocData | LmData;
  const meta = getCareerMeta(data, document.doc_type);
  const target = meta.target;

  function patch(patchValue: Partial<typeof target>) {
    const nextTarget = { ...target, ...patchValue };
    onChange({
      ...document,
      target_job: nextTarget.job_title || null,
      target_country: nextTarget.country || null,
      application_type: nextTarget.application_type || document.application_type,
      doc_data: withCareerMeta(data, document.doc_type, { ...meta, target: nextTarget }),
    });
  }

  function analyze() {
    patch({ required_keywords: extractJobKeywords(target.job_description, 24) });
  }

  function addKeyword(value: string) {
    const keyword = value.trim();
    if (!keyword) return;
    patch({ required_keywords: [...new Set([...target.required_keywords, keyword])] });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="inline-flex items-center gap-2 rounded-full bg-[#bf8813]/10 px-3 py-1 text-xs font-bold text-[#bf8813]"><Target className="h-3.5 w-3.5" /> Poste ciblé</div>
      <h3 className="mt-3 text-lg font-semibold text-[#002050]">Dossier de candidature</h3>
      <p className="mt-1 text-sm leading-5 text-slate-600">Le CV, la lettre et l’analyse ATS utilisent la même offre et les mêmes exigences.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Poste visé" value={target.job_title} onChange={value => patch({ job_title: value })} />
        <Field label="Entreprise" value={target.company} onChange={value => patch({ company: value })} />
        <Field label="Nom du recruteur" value={target.recruiter_name} onChange={value => patch({ recruiter_name: value })} />
        <Field label="Fonction du recruteur" value={target.recruiter_role} onChange={value => patch({ recruiter_role: value })} />
        <Field label="Ville ou lieu" value={target.location} onChange={value => patch({ location: value })} />
        <Field label="Pays ciblé" value={target.country} onChange={value => patch({ country: value })} />
        <Field label="Type de contrat" value={target.contract_type} onChange={value => patch({ contract_type: value })} />
        <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Type de candidature</span><select className={inputClass} value={target.application_type} onChange={event => patch({ application_type: event.target.value })}><option value="emploi">Emploi</option><option value="stage">Stage</option><option value="alternance">Alternance</option><option value="spontanee">Candidature spontanée</option><option value="mission">Mission ou freelance</option><option value="academique">Candidature académique</option></select></label>
        <Field label="Référence de l’offre" value={target.reference} onChange={value => patch({ reference: value })} />
        <Field label="Lien de l’offre" value={target.source_url} onChange={value => patch({ source_url: value })} />
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-xs font-semibold text-slate-600">Description de l’offre</span>
        <textarea className={`${inputClass} min-h-48 resize-y`} value={target.job_description} onChange={event => patch({ job_description: event.target.value })} placeholder="Collez ici les missions, exigences, compétences, diplômes et informations du poste…" />
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={analyze} disabled={!target.job_description.trim()} className="inline-flex items-center gap-2 rounded-xl bg-[#002050] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"><Search className="h-4 w-4" /> Extraire les exigences</button>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#002050] hover:bg-slate-50"><FileText className="h-4 w-4" /> Importer un texte<input type="file" accept=".txt,.md,.rtf,text/plain" className="hidden" onChange={async event => { const input = event.currentTarget; const file = input.files?.[0]; if (!file) return; const content = await file.text(); patch({ job_description: content.slice(0, 100000) }); input.value = ''; }} /></label>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between"><div className="text-sm font-semibold text-[#002050]">Exigences extraites</div><span className="text-xs text-slate-500">{target.required_keywords.length} élément(s)</span></div>
        <div className="mt-2 flex flex-wrap gap-2">
          {target.required_keywords.map(keyword => <button type="button" key={keyword} onClick={() => patch({ required_keywords: target.required_keywords.filter(item => item !== keyword) })} className="inline-flex items-center gap-1 rounded-full border border-[#002050]/15 bg-[#002050]/5 px-2.5 py-1 text-xs font-semibold text-[#002050]" title="Cliquer pour retirer"><CheckCircle2 className="h-3 w-3" />{keyword}</button>)}
          {!target.required_keywords.length && <span className="text-xs text-slate-500">Aucune exigence extraite. Collez l’offre puis lancez l’analyse.</span>}
        </div>
        <form className="mt-3 flex gap-2" onSubmit={event => { event.preventDefault(); const form = event.currentTarget; const input = form.elements.namedItem('keyword') as HTMLInputElement; addKeyword(input.value); input.value = ''; }}><input name="keyword" className={inputClass} placeholder="Ajouter une exigence manuellement" /><button className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-[#002050]">Ajouter</button></form>
      </div>

      <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-900">Les fichiers PDF et DOCX ne sont pas lus directement sans moteur d’extraction dédié. Pour éviter une analyse incorrecte, utilisez le texte de l’offre ou un fichier texte exporté.</div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span><input className={inputClass} value={value || ''} onChange={event => onChange(event.target.value)} /></label>;
}
