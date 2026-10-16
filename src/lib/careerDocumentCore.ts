/**
 * OGA Career Studio V3 — Lot 1: canonical, lossless content adapter.
 *
 * The persisted source of truth remains doc_data + design_options. This module
 * creates a consistent view for future professional renderers without copying
 * resume data into a second, diverging store or depending on a template key.
 * It is deliberately independent from Reactive Resume's auth, API and database.
 */
import type { DocData, DesignOptions } from '../components/career/CvTemplates';
import type { LmData, LmDesign } from '../components/career/LmTemplates';
import type { CareerDocType } from './careerStudioData';
import { createDefaultDesign } from './careerStudioData';

export const CAREER_DOCUMENT_CORE_VERSION = 3 as const;

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
}

function items(value: unknown, group: string): UnknownRecord[] {
  if (!Array.isArray(value)) return [];
  // Keep unknown, source-specific properties of every valid entry.
  return value.map((entry, index) => {
    const source = record(entry);
    const id = text(source.id).trim() || `${group}_${index + 1}`;
    return { ...source, id };
  });
}

/** Repair missing/invalid fields without wiping existing extended data. */
export function normalizeCareerContent(docType: 'cv', source: unknown): DocData;
export function normalizeCareerContent(docType: 'lm', source: unknown): LmData;
export function normalizeCareerContent(docType: CareerDocType, source: unknown): DocData | LmData;
export function normalizeCareerContent(docType: CareerDocType, source: unknown): DocData | LmData {
  const original = record(source);
  if (docType === 'lm') {
    const sender = record(original.sender);
    const recipient = record(original.recipient);
    return {
      ...original,
      sender: {
        ...sender,
        name: text(sender.name), address: text(sender.address), phone: text(sender.phone),
        email: text(sender.email), city: text(sender.city), date: text(sender.date),
      },
      recipient: { ...recipient, name: text(recipient.name), company: text(recipient.company), address: text(recipient.address) },
      subject: text(original.subject), salutation: text(original.salutation),
      intro: text(original.intro), motivation: text(original.motivation),
      skills_paragraph: text(original.skills_paragraph), company_link: text(original.company_link),
      availability: text(original.availability), closing: text(original.closing), signature: text(original.signature),
    } as LmData;
  }
  const contact = record(original.contact);
  return {
    ...original,
    name: text(original.name), title: text(original.title), objective: text(original.objective),
    summary: text(original.summary), photo_url: text(original.photo_url),
    contact: {
      ...contact,
      email: text(contact.email), phone: text(contact.phone), location: text(contact.location),
      linkedin: text(contact.linkedin), portfolio: text(contact.portfolio),
    },
    experiences: items(original.experiences, 'exp'),
    education: items(original.education, 'edu'),
    omnia_formations: items(original.omnia_formations, 'omnia'),
    skills: items(original.skills, 'skill'),
    languages: items(original.languages, 'lang'),
    certifications_external: items(original.certifications_external, 'cert'),
    projects: items(original.projects, 'project'),
    interests: Array.isArray(original.interests) ? [...original.interests] : [],
    custom_sections: Array.isArray(original.custom_sections)
      ? items(original.custom_sections, 'custom')
      : [],
  } as unknown as DocData;
}

/** Preserve custom design properties, while always providing valid core values. */
export function normalizeCareerDesign(docType: CareerDocType, source: unknown): DesignOptions | LmDesign {
  const original = record(source);
  const defaults = createDefaultDesign(docType);
  const colors = record(original.colors);
  const margins = record(original.margins);
  const normalized = {
    ...defaults,
    ...original,
    colors: { ...defaults.colors, ...colors },
    margins: { ...defaults.margins, ...margins },
  };
  return normalized as DesignOptions | LmDesign;
}

export type CareerSectionEntry = {
  id: string;
  title: string;
  subtitle?: string;
  body?: string;
  details?: string[];
};

export type CareerContentSection = {
  id: string;
  label: string;
  kind: 'identity' | 'text' | 'list';
  visible: boolean;
  entries: CareerSectionEntry[];
};

export type CareerDocumentModel = {
  version: typeof CAREER_DOCUMENT_CORE_VERSION;
  docType: CareerDocType;
  sections: CareerContentSection[];
};

const CV_LABELS: Record<string, string> = {
  profile: 'Identité et contact', summary: 'Profil professionnel', objective: 'Objectif',
  experiences: 'Expériences professionnelles', education: 'Formation',
  omnia_formations: 'Formations Omnia', skills: 'Compétences', languages: 'Langues',
  certifications: 'Certifications', projects: 'Projets', interests: 'Centres d’intérêt',
  references: 'Références',
};

function makeEntries(group: string, values: UnknownRecord[], titles: string[], subtitles: string[], descriptions: string[]): CareerSectionEntry[] {
  return values.map((value, index) => ({
    id: text(value.id) || `${group}_${index + 1}`,
    title: titles.map(key => text(value[key])).filter(Boolean).join(' · '),
    subtitle: subtitles.map(key => text(value[key])).filter(Boolean).join(' · '),
    body: descriptions.map(key => text(value[key])).filter(Boolean).join('\n'),
  }));
}

/**
 * Read-only adapter for any new OGA/Reactive-Resume-compatible visual template.
 * Sections use the same source data regardless of how the template is switched.
 */
export function buildCareerDocumentModel(docType: CareerDocType, source: unknown): CareerDocumentModel {
  const content = normalizeCareerContent(docType, source);
  const meta = record(content.career_meta);
  const visibility = record(meta.section_visibility);
  const order = Array.isArray(meta.section_order) ? meta.section_order.filter((key): key is string => typeof key === 'string') : [];
  const sections: CareerContentSection[] = [];
  const push = (id: string, label: string, kind: CareerContentSection['kind'], entries: CareerSectionEntry[]) => {
    sections.push({ id, label, kind, visible: visibility[id] !== false, entries });
  };
  const entry = (id: string, title: unknown, body: unknown = ''): CareerSectionEntry[] =>
    text(title).trim() || text(body).trim() ? [{ id, title: text(title), body: text(body) }] : [];

  if (docType === 'cv') {
    const cv = content as DocData;
    push('profile', CV_LABELS.profile, 'identity', [{
      id: 'profile', title: cv.name, subtitle: cv.title,
      details: [cv.contact.email, cv.contact.phone, cv.contact.location, cv.contact.linkedin, cv.contact.portfolio].filter((value): value is string => Boolean(value)),
    }]);
    push('summary', CV_LABELS.summary, 'text', entry('summary', cv.summary));
    push('objective', CV_LABELS.objective, 'text', entry('objective', cv.objective));
    push('experiences', CV_LABELS.experiences, 'list', makeEntries('exp', cv.experiences as unknown as UnknownRecord[], ['position'], ['company', 'location', 'start_date', 'end_date'], ['description']));
    push('education', CV_LABELS.education, 'list', makeEntries('edu', cv.education as unknown as UnknownRecord[], ['degree'], ['school', 'location', 'year'], []));
    push('omnia_formations', CV_LABELS.omnia_formations, 'list', makeEntries('omnia', (cv.omnia_formations as unknown as UnknownRecord[]).filter(x => x.show !== false), ['title'], ['completed_at'], []));
    push('skills', CV_LABELS.skills, 'list', makeEntries('skill', cv.skills as unknown as UnknownRecord[], ['name'], ['level'], []));
    push('languages', CV_LABELS.languages, 'list', makeEntries('lang', cv.languages as unknown as UnknownRecord[], ['name'], ['level'], []));
    push('certifications', CV_LABELS.certifications, 'list', makeEntries('cert', cv.certifications_external as unknown as UnknownRecord[], ['name'], ['issuer', 'year'], []));
    push('projects', CV_LABELS.projects, 'list', makeEntries('project', cv.projects as unknown as UnknownRecord[], ['name'], ['technologies'], ['description']));
    push('interests', CV_LABELS.interests, 'list', cv.interests.map((interest, index) => ({ id: `interest_${index + 1}`, title: text(interest) })));
    push('references', CV_LABELS.references, 'text', entry('references', cv.references));
    const fromData = Array.isArray(cv.custom_sections) ? cv.custom_sections : [];
    const fromMeta = Array.isArray(meta.custom_sections) ? meta.custom_sections : [];
    const custom = new Map<string, UnknownRecord>();
    for (const value of [...fromMeta, ...fromData]) {
      const item = record(value);
      const id = text(item.id).trim();
      if (id) custom.set(id, item);
    }
    for (const [id, item] of custom) {
      push(`custom:${id}`, text(item.title) || 'Rubrique personnalisée', 'text', entry(id, item.content));
      sections[sections.length - 1].visible = item.visible !== false && visibility[`custom:${id}`] !== false;
    }
  } else {
    const lm = content as LmData;
    push('sender', 'Expéditeur', 'identity', [{ id: 'sender', title: lm.sender.name,
      details: [lm.sender.address, lm.sender.city, lm.sender.phone, lm.sender.email, lm.sender.date].filter(Boolean) }]);
    push('recipient', 'Destinataire', 'identity', [{ id: 'recipient', title: lm.recipient.name,
      subtitle: lm.recipient.company, details: [lm.recipient.address].filter(Boolean) }]);
    push('subject', 'Objet', 'text', entry('subject', lm.subject));
    push('letter', 'Corps de la lettre', 'list', [
      'salutation', 'intro', 'motivation', 'skills_paragraph', 'company_link', 'availability', 'closing', 'signature',
    ].flatMap(key => entry(key, (lm as unknown as UnknownRecord)[key])));
  }
  // Unknown section keys are retained in metadata by the normalizer; no content
  // is deleted merely because an installed template does not display it.
  const index = (key: string) => {
    const position = order.indexOf(key);
    return position >= 0 ? position : Number.MAX_SAFE_INTEGER;
  };
  sections.sort((a, b) => index(a.id) - index(b.id));
  return { version: CAREER_DOCUMENT_CORE_VERSION, docType, sections };
}
