import { CV_TEMPLATE_MAP } from '../components/career/CvTemplates';
import { LM_TEMPLATE_MAP } from '../components/career/LmTemplates';
import { CV_TEMPLATES_META, LM_TEMPLATES_META } from './careerStudioData';

export type TemplateIntegrityReport = {
  valid: boolean;
  cvCount: number;
  lmCount: number;
  missingCvRenderers: string[];
  missingLmRenderers: string[];
  duplicateKeys: string[];
};

/**
 * Vérification centralisée du catalogue Omnia Career.
 * Elle peut être appelée en développement ou depuis un test sans dépendre du DOM.
 */
export function verifyCareerTemplateCatalog(): TemplateIntegrityReport {
  const cvKeys = CV_TEMPLATES_META.map(t => t.template_key);
  const lmKeys = LM_TEMPLATES_META.map(t => t.template_key);
  const all = [...cvKeys, ...lmKeys];
  const duplicateKeys = all.filter((key, index) => all.indexOf(key) !== index);
  const missingCvRenderers = cvKeys.filter(key => !CV_TEMPLATE_MAP[key]);
  const missingLmRenderers = lmKeys.filter(key => !LM_TEMPLATE_MAP[key]);

  return {
    valid:
      cvKeys.length === 12 &&
      lmKeys.length === 6 &&
      missingCvRenderers.length === 0 &&
      missingLmRenderers.length === 0 &&
      duplicateKeys.length === 0,
    cvCount: cvKeys.length,
    lmCount: lmKeys.length,
    missingCvRenderers,
    missingLmRenderers,
    duplicateKeys: [...new Set(duplicateKeys)],
  };
}
