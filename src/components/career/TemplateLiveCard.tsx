import { useEffect, useRef, useState } from 'react';
import { CvPreview, type DocData, type DesignOptions } from './CvTemplates';
import { LmPreview, type LmData, type LmDesign } from './LmTemplates';
import CareerDocumentSurface from './CareerDocumentSurface';
import { DEFAULT_CV_DATA, DEFAULT_LM_DATA, DEFAULT_CV_DESIGN, DEFAULT_LM_DESIGN, type CareerTemplateMeta, type CareerDocType } from '../../lib/careerStudioData';

// The catalogue previews the very same starter data used by the new-document
// workflow. This removes the misleading sample-CV vs Builder mismatch.
const SAMPLE_CV: DocData = DEFAULT_CV_DATA;
const SAMPLE_LM: LmData = DEFAULT_LM_DATA;

function designFrom(template: CareerTemplateMeta): DesignOptions {
  return {
    ...DEFAULT_CV_DESIGN,
    colors: template.default_colors,
    photo_enabled: false, // No dummy image when the CV has no photo.
  };
}

export default function TemplateLiveCard({ template, docType, selected=false, onClick, compact=false, data, documentDesign }:{
  template: CareerTemplateMeta; docType: CareerDocType; selected?: boolean; onClick?:()=>void; compact?:boolean;
  data?: DocData | LmData; documentDesign?: DesignOptions | LmDesign;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    const refresh = () => setWidth(node.clientWidth);
    refresh();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(refresh) : null;
    observer?.observe(node);
    return () => observer?.disconnect();
  }, []);
  const previewScale = Math.max(0.05, Math.min(1, (width || (compact ? 160 : 220)) / 794));
  // Same content, page surface and template configuration as the Builder.
  // Unselected cards preview the result of applying that template's color preset.
  const design: DesignOptions = {
    ...designFrom(template),
    ...(documentDesign && docType === 'cv' ? documentDesign as DesignOptions : {}),
    colors: selected && documentDesign ? documentDesign.colors : template.default_colors,
  };
  const lmDesign: LmDesign = {
    ...DEFAULT_LM_DESIGN,
    ...(documentDesign && docType === 'lm' ? documentDesign as LmDesign : {}),
    colors: selected && documentDesign ? documentDesign.colors : template.default_colors,
  };
  const cvData = data && docType === 'cv' ? data as DocData : SAMPLE_CV;
  const lmData = data && docType === 'lm' ? data as LmData : SAMPLE_LM;
  return (
    <button type="button" onClick={onClick} className={`group w-full overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${selected?'border-[#002050] ring-4 ring-[#002050]/10':'border-slate-200'}`}>
      <div className="relative aspect-[794/1123] w-full overflow-hidden bg-slate-100">
        <div ref={frameRef} className="absolute inset-0 flex items-start justify-center overflow-hidden bg-white">
          <div style={{ transform:`scale(${previewScale})`, transformOrigin:'top center', width:794, minHeight:1123 }}>
            {docType==='cv'
              ? <CareerDocumentSurface design={design} title={template.name_fr}><CvPreview templateKey={template.template_key} data={cvData} design={design} layoutConfig={template.layout_config} /></CareerDocumentSurface>
              : <CareerDocumentSurface design={lmDesign} title={template.name_fr}><LmPreview templateKey={template.template_key} data={lmData} design={lmDesign} layoutConfig={template.layout_config} /></CareerDocumentSurface>}
          </div>
        </div>
        {selected && <span className="absolute right-2 top-2 rounded-full bg-[#002050] px-2.5 py-1 text-[10px] font-bold text-white">Sélectionné</span>}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-slate-100 p-3">
        <div className="min-w-0"><div className="truncate text-sm font-semibold text-[#002050]">{template.name_fr}</div><div className="mt-0.5 text-[11px] text-slate-500">{template.is_ats_compatible?'Compatible ATS':'Design créatif'}</div></div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${template.is_free?'bg-emerald-50 text-emerald-700':'bg-[#bf8813]/15 text-[#7a570c]'}`}>{template.is_free?'Accessible':'Premium'}</span>
      </div>
    </button>
  );
}
