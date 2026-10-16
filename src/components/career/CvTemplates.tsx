import React from 'react';
import { BUILTIN_CV_LAYOUTS, ConfigurableCvTemplate } from './EditableCareerTemplates';
import { normalizeCareerContent } from '../../lib/careerDocumentCore';

export interface DocData {
  name: string;
  title: string;
  objective?: string;
  summary: string;
  photo_url?: string;
  photo_zoom?: number;
  photo_position_x?: number;
  photo_position_y?: number;
  contact: { email: string; phone: string; location: string; linkedin?: string; portfolio?: string; };
  experiences: Array<{ id: string; position: string; company: string; location?: string; start_date: string; end_date?: string; current: boolean; description: string; }>;
  education: Array<{ id: string; degree: string; school: string; location?: string; year: string; }>;
  omnia_formations: Array<{ id: string; title: string; completed_at: string; cpd_accredited: boolean; certificate_id?: string; show: boolean; }>;
  skills: Array<{ id: string; name: string; level: number; }>;
  languages: Array<{ id: string; name: string; level: string; }>;
  certifications_external: Array<{ id: string; name: string; issuer: string; year: string; }>;
  projects: Array<{ id: string; name: string; description: string; technologies?: string; }>;
  interests: string[];
  references?: string;
  career_meta?: Record<string, unknown>;
  manual_layout?: unknown;
  manual_layouts?: Record<string, unknown>;
  custom_sections?: Array<{ id: string; title: string; content: string; visible?: boolean }>;
}

export interface DesignOptions {
  colors: { primary: string; accent: string; sidebar: string; text: string; background: string; };
  font: string;
  font_size_body: number;
  font_size_title: number;
  line_spacing: number;
  photo_enabled: boolean;
  photo_shape: 'round' | 'square' | 'rectangle';
  pages: 1 | 2;
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

type CvTemplateComponent = React.ComponentType<{ data: DocData; design: DesignOptions; layoutConfig?:unknown; onFieldChange?: (field:string,value:string)=>void }>;

export const CV_TEMPLATE_MAP: Record<string, CvTemplateComponent> = Object.fromEntries(
  Object.keys(BUILTIN_CV_LAYOUTS).map(templateKey => [
    templateKey,
    (props: { data: DocData; design: DesignOptions }) => (
      <ConfigurableCvTemplate {...props} templateKey={templateKey} />
    ),
  ]),
) as Record<string, CvTemplateComponent>;

export function CvPreview({
  templateKey,
  data,
  design,
  layoutConfig,
  onFieldChange,
}: {
  templateKey: string;
  data: DocData;
  design: DesignOptions;
  layoutConfig?: unknown;
  onFieldChange?: (field:string,value:string)=>void;
}) {
  const Component = CV_TEMPLATE_MAP[templateKey];
  const normalizedData = normalizeCareerContent('cv', data);
  return Component
    ? <Component data={normalizedData} design={design} layoutConfig={layoutConfig} onFieldChange={onFieldChange} />
    : <ConfigurableCvTemplate data={normalizedData} design={design} templateKey={templateKey} layoutConfig={layoutConfig} onFieldChange={onFieldChange} />;
}
