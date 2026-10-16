import { useEffect, useRef, useState, type ReactNode } from 'react';
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
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(1123);
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const update = () => setContentHeight(Math.max(1123, el.scrollHeight, el.getBoundingClientRect().height / Math.max(0.05, finalScale)));
    update();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    observer?.observe(el);
    return () => observer?.disconnect();
  }, [children, finalScale]);
  const measuredHeight = margins.top + contentHeight * finalScale + margins.bottom;
  const totalPages = Math.max(1, Math.ceil((measuredHeight - 0.5) / page.height));
  const totalHeight = totalPages * page.height;
  return (
    <div
      data-career-document-surface="true"
      className="relative bg-white"
      aria-label={title}
      style={{
        width: page.width,
        minHeight: totalHeight,
        height: totalHeight,
        background: advanced.colors?.background || '#ffffff',
        border: `${Number(advanced.border_width || 0)}px solid ${advanced.border_color || 'transparent'}`,
        boxSizing: 'border-box',
      }}
    >
      <div
        data-career-surface-content="true"
        ref={contentRef}
        style={{
          position: 'relative',
          left: margins.left + Math.max(0, (page.width - margins.left - margins.right - 794 * finalScale) / 2),
          marginTop: margins.top,
          width: 794,
          minHeight: 1123,
          transform: `scale(${finalScale})`,
          transformOrigin: 'top left',
          letterSpacing: `${Number(advanced.letter_spacing || 0)}px`,
        }}
      >
        {children}
      </div>
      {Array.from({ length: totalPages }, (_, index) => (
        <div
          key={index}
          data-career-page-marker="true"
          data-no-print="true"
          aria-hidden="true"
          className="pointer-events-none absolute left-0 right-0"
          style={{ top: (index + 1) * page.height - 1, height: 1, borderBottom: index < totalPages - 1 ? '1px dashed #cbd5e1' : undefined }}
        >
          {(advanced.footer_text || advanced.page_numbers) && (
            <div className="absolute right-5 flex justify-between gap-8 text-[9px] text-slate-500" style={{ bottom: 9 }}>
              <span>{advanced.footer_text || ''}</span>
              <span>{advanced.page_numbers ? `${index + 1} / ${totalPages}` : ''}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
