import type { ReactNode } from 'react';
import type { DesignOptions } from './CvTemplates';
import type { LmDesign } from './LmTemplates';
import { getPageDimensions } from '../../lib/careerBuilderV2';
import type { AdvancedCareerDesign } from './CareerDesignPanel';

export function getCareerSurfaceMetrics(design: DesignOptions | LmDesign) {
  const advanced = design as AdvancedCareerDesign;
  const page = getPageDimensions(design);
  const margins = advanced.margins || { top: 0, right: 0, bottom: 0, left: 0 };
  const usableWidth = Math.max(300, page.width - margins.left - margins.right);
  const usableHeight = Math.max(400, page.height - margins.top - margins.bottom);
  const scale = Math.min(usableWidth / 794, usableHeight / 1123);
  return { page, margins, scale };
}

export default function CareerDocumentSurface({ design, title, children }: { design: DesignOptions | LmDesign; title: string; children: ReactNode }) {
  const advanced = design as AdvancedCareerDesign;
  const { page, margins, scale } = getCareerSurfaceMetrics(design);
  const densityScale = advanced.density === 'compact' ? 0.98 : advanced.density === 'spacious' ? 0.94 : 1;
  const finalScale = scale * densityScale;
  return (
    <div
      className="relative overflow-hidden bg-white"
      aria-label={title}
      style={{
        width: page.width,
        height: page.height,
        background: advanced.colors?.background || '#ffffff',
        border: `${Number(advanced.border_width || 0)}px solid ${advanced.border_color || 'transparent'}`,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: margins.left + Math.max(0, (page.width - margins.left - margins.right - 794 * finalScale) / 2),
          top: margins.top + Math.max(0, (page.height - margins.top - margins.bottom - 1123 * finalScale) / 2),
          width: 794,
          minHeight: 1123,
          transform: `scale(${finalScale})`,
          transformOrigin: 'top left',
          letterSpacing: `${Number(advanced.letter_spacing || 0)}px`,
        }}
      >
        {children}
      </div>
      {(advanced.footer_text || advanced.page_numbers) && (
        <div className="absolute bottom-2 left-5 right-5 flex items-center justify-between text-[9px] text-slate-500">
          <span>{advanced.footer_text || ''}</span>
          <span>{advanced.page_numbers ? '1 / 1' : ''}</span>
        </div>
      )}
    </div>
  );
}
