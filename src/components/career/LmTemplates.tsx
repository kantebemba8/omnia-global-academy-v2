import React from 'react';
import { BUILTIN_LM_LAYOUTS, ConfigurableLmTemplate } from './EditableCareerTemplates';
import { normalizeCareerContent } from '../../lib/careerDocumentCore';

export interface LmData {
  sender: { name: string; address: string; phone: string; email: string; city: string; date: string; };
  recipient: { name: string; company: string; address: string; };
  subject: string;
  salutation: string;
  intro: string;
  motivation: string;
  skills_paragraph: string;
  company_link: string;
  availability: string;
  closing: string;
  signature: string;
  career_meta?: Record<string, unknown>;
  manual_layout?: unknown;
  manual_layouts?: Record<string, unknown>;
}

export interface LmDesign {
  colors: { primary: string; accent: string; sidebar: string; text: string; background: string; };
  font: string;
  font_size_body: number;
  line_spacing: number;
  document_mode?: 'creative' | 'balanced' | 'ats';
  page_format?: 'a4' | 'letter';
  orientation?: 'portrait' | 'landscape';
  margins?: { top: number; right: number; bottom: number; left: number };
  letter_spacing?: number;
  paragraph_spacing?: number;
  section_spacing?: number;
  density?: 'compact' | 'balanced' | 'spacious';
  page_numbers?: boolean;
  footer_text?: string;
  border_width?: number;
  border_color?: string;
  editor_mode?: 'template' | 'manual';
}

type LmTemplateComponent = React.ComponentType<{ data: LmData; design: LmDesign }>;

export const LM_TEMPLATE_MAP: Record<string, LmTemplateComponent> = Object.fromEntries(
  Object.keys(BUILTIN_LM_LAYOUTS).map(templateKey => [
    templateKey,
    (props: { data: LmData; design: LmDesign }) => (
      <ConfigurableLmTemplate {...props} templateKey={templateKey} />
    ),
  ]),
) as Record<string, LmTemplateComponent>;

export function LmPreview({
  templateKey,
  data,
  design,
}: {
  templateKey: string;
  data: LmData;
  design: LmDesign;
}) {
  const Component = LM_TEMPLATE_MAP[templateKey];
  const normalizedData = normalizeCareerContent('lm', data);
  return Component
    ? <Component data={normalizedData} design={design} />
    : <ConfigurableLmTemplate data={normalizedData} design={design} templateKey={templateKey} />;
}
