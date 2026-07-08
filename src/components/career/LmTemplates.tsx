import React from 'react';
import { LM_TEMPLATE_MAP_1_10, LmData, LmDesign } from './LmTemplates_1_10';
import { LM_TEMPLATE_MAP_11_32 } from './LmTemplates_11_32';

export type { LmData, LmDesign };

export const LM_TEMPLATE_MAP: Record<string, React.ComponentType<{ data: LmData; design: LmDesign }>> = {
  ...LM_TEMPLATE_MAP_1_10,
  ...LM_TEMPLATE_MAP_11_32,
};

export function LmPreview({ templateKey, data, design }: { templateKey: string; data: LmData; design: LmDesign }) {
  const Component = LM_TEMPLATE_MAP[templateKey] || LM_TEMPLATE_MAP['lm_classic_pro'];
  if (!Component) return <div style={{ padding: 40, color: '#9CA3AF' }}>Modèle de lettre non trouvé</div>;
  return <Component data={data} design={design} />;
}
