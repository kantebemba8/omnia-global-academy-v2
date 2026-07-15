import React from 'react';
import { LM_TEMPLATE_MAP_1_10, LmData, LmDesign } from './LmTemplates_1_10';
import { LM_TEMPLATE_MAP_11_32 } from './LmTemplates_11_32';
import { ConfigurableLmTemplate, BUILTIN_LM_LAYOUTS } from './EditableCareerTemplates';

export type { LmData, LmDesign };

export const LM_TEMPLATE_MAP: Record<string, React.ComponentType<{ data: LmData; design: LmDesign }>> = {
  ...LM_TEMPLATE_MAP_1_10,
  ...LM_TEMPLATE_MAP_11_32,
  ...Object.fromEntries(Object.keys(BUILTIN_LM_LAYOUTS).map(key => [key, (props: { data: LmData; design: LmDesign }) => <ConfigurableLmTemplate {...props} templateKey={key} />])),
};

export function LmPreview({ templateKey, data, design }: { templateKey: string; data: LmData; design: LmDesign }) {
  const Component = LM_TEMPLATE_MAP[templateKey];
  return Component ? <Component data={data} design={design} /> : <ConfigurableLmTemplate data={data} design={design} templateKey={templateKey} />;
}
