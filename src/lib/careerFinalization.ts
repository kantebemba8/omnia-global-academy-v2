import type { CareerDocumentFull } from './careerStudioData';
import type { DocData } from '../components/career/CvTemplates';
import { getCareerMeta, withCareerMeta } from './careerBuilderV2';

export type CareerAiProposalCheck = {
  mode: 'cv_summary' | 'cv_experience' | 'cv_skills' | 'lm_full' | 'lm_section' | 'cv_personalize' | 'lm_personalize' | 'analysis';
  targetId?: string;
  sourceValue?: string;
  sourceDocumentId?: string;
};

/** No AI answer may overwrite content edited since it was requested. */
export function isCareerAiProposalCurrent(proposal: CareerAiProposalCheck, document: CareerDocumentFull): boolean {
  if (!proposal.sourceDocumentId || proposal.sourceDocumentId !== document.id) return false;
  const data = document.doc_data as DocData;
  let current = '';
  switch (proposal.mode) {
    case 'cv_experience': {
      const target = (data.experiences || []).find(item => item.id === proposal.targetId);
      if (!target) return false;
      current = target.description || '';
      break;
    }
    case 'cv_summary': current = data.summary || ''; break;
    case 'cv_skills': current = JSON.stringify(data.skills || []); break;
    case 'analysis': return false;
    default: current = JSON.stringify(document.doc_data);
  }
  return current === proposal.sourceValue;
}

export function appendVerifiedCareerSkills<T extends { id: string; name: string }>(existing: T[], proposed: string[]): T[] {
  // Skills suggested by an AI must be confirmed by the learner in the panel.
  const current = [...(existing || [])];
  const keys = new Set(current.map(item => item.name.trim().toLocaleLowerCase('fr-FR')));
  for (const raw of proposed.slice(0, 20)) {
    const name = raw.replace(/^[-•*\d.\s]+/, '').trim().slice(0, 100);
    const key = name.toLocaleLowerCase('fr-FR');
    if (!name || keys.has(key)) continue;
    keys.add(key);
    current.push({ id: `sk_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`, name, level: 60 } as unknown as T);
  }
  return current;
}

export function buildSpecializedCareerCv(source: CareerDocumentFull, target: { job: string; company?: string; country?: string }): CareerDocumentFull {
  if (source.doc_type !== 'cv') throw new Error('SOURCE_MUST_BE_CV');
  const job = target.job.trim();
  if (!job) throw new Error('TARGET_JOB_REQUIRED');
  const company = (target.company || '').trim();
  const country = (target.country || '').trim();
  const data = JSON.parse(JSON.stringify(source.doc_data)) as DocData;
  const meta = getCareerMeta(data, 'cv');
  const nextMeta = {
    ...meta,
    source_cv_id: source.id,
    application_package_id: undefined,
    target: { ...meta.target, job_title: job, company, country, job_description: '', required_keywords: [], preferred_keywords: [] },
  };
  const now = new Date().toISOString();
  return {
    ...source,
    id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    doc_type: 'cv',
    title: `CV - ${job}${company ? ` - ${company}` : ''}`.slice(0, 140),
    target_job: job,
    target_country: country || null,
    is_primary: false,
    status: 'draft',
    created_at: now,
    updated_at: now,
    doc_data: withCareerMeta(data, 'cv', nextMeta),
    design_options: JSON.parse(JSON.stringify(source.design_options)),
  };
}
