import type { ReactNode } from 'react';
import { LayoutTemplate, Palette, Settings } from 'lucide-react';
import type { DesignOptions } from './CvTemplates';
import type { LmDesign } from './LmTemplates';
import type { CareerDocType } from '../../lib/careerStudioData';

export type AdvancedCareerDesign = (DesignOptions | LmDesign) & {
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
};

type Props = {
  docType: CareerDocType;
  design: AdvancedCareerDesign;
  onChange: (design: AdvancedCareerDesign) => void;
};

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#002050] focus:ring-4 focus:ring-[#002050]/10';

export default function CareerDesignPanel({ docType, design, onChange }: Props) {
  const margins = design.margins || { top: 24, right: 24, bottom: 24, left: 24 };
  const colors = design.colors;
  const patch = (value: Partial<AdvancedCareerDesign>) => onChange({ ...design, ...value });
  const patchMargins = (value: Partial<typeof margins>) => patch({ margins: { ...margins, ...value } });
  const patchColors = (value: Partial<typeof colors>) => patch({ colors: { ...colors, ...value } });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="inline-flex items-center gap-2 rounded-full bg-[#002050]/8 px-3 py-1 text-xs font-bold text-[#002050]"><Palette className="h-3.5 w-3.5" /> Design professionnel</div>
      <h3 className="mt-3 text-lg font-semibold text-[#002050]">Mise en page et identité visuelle</h3>
      <p className="mt-1 text-sm leading-5 text-slate-600">Les réglages essentiels restent simples. Les options avancées sont appliquées sans moteur graphique lourd.</p>

      <Section title="Version du document" icon={<LayoutTemplate className="h-4 w-4" />}>
        <div className="grid grid-cols-3 gap-2">
          {[['creative','Créative'],['balanced','Équilibrée'],['ats','ATS stricte']].map(([value,label]) => <button key={value} type="button" onClick={() => patch({ document_mode: value as AdvancedCareerDesign['document_mode'] })} className={`rounded-xl border px-2 py-2 text-xs font-semibold ${design.document_mode === value ? 'border-[#002050] bg-[#002050] text-white' : 'border-slate-200 bg-white text-slate-700'}`}>{label}</button>)}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Select label="Format" value={design.page_format || 'a4'} onChange={value => patch({ page_format: value as 'a4' | 'letter' })} options={[['a4','A4'],['letter','US Letter']]} />
          <Select label="Orientation" value={design.orientation || 'portrait'} onChange={value => patch({ orientation: value as 'portrait' | 'landscape' })} options={[['portrait','Portrait'],['landscape','Paysage']]} />
        </div>
      </Section>

      <Section title="Typographie" icon={<Settings className="h-4 w-4" />}>
        <Select label="Police" value={design.font || 'inter'} onChange={font => patch({ font })} options={[['inter','Inter / Arial'],['georgia','Georgia'],['arial','Arial'],['times','Times New Roman'],['calibri','Calibri'],['garamond','Garamond']]} />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <NumberField label="Corps" value={Number(design.font_size_body || 10)} min={7} max={18} step={0.5} onChange={font_size_body => patch({ font_size_body })} />
          {'font_size_title' in design && <NumberField label="Titres" value={Number((design as DesignOptions).font_size_title || 12)} min={9} max={34} step={0.5} onChange={font_size_title => patch({ font_size_title } as Partial<AdvancedCareerDesign>)} />}
          <NumberField label="Interligne" value={Number(design.line_spacing || 1.5)} min={1} max={2.5} step={0.05} onChange={line_spacing => patch({ line_spacing })} />
          <NumberField label="Espacement lettres" value={Number(design.letter_spacing || 0)} min={-0.5} max={3} step={0.1} onChange={letter_spacing => patch({ letter_spacing })} />
          <NumberField label="Espacement paragraphes" value={Number(design.paragraph_spacing || 8)} min={0} max={28} step={1} onChange={paragraph_spacing => patch({ paragraph_spacing })} />
          <NumberField label="Espacement sections" value={Number(design.section_spacing || 14)} min={4} max={36} step={1} onChange={section_spacing => patch({ section_spacing })} />
        </div>
      </Section>

      <Section title="Marges" icon={<LayoutTemplate className="h-4 w-4" />}>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Haut" value={margins.top} min={0} max={80} step={1} onChange={top => patchMargins({ top })} />
          <NumberField label="Droite" value={margins.right} min={0} max={80} step={1} onChange={right => patchMargins({ right })} />
          <NumberField label="Bas" value={margins.bottom} min={0} max={80} step={1} onChange={bottom => patchMargins({ bottom })} />
          <NumberField label="Gauche" value={margins.left} min={0} max={80} step={1} onChange={left => patchMargins({ left })} />
        </div>
        <Select label="Densité" value={design.density || 'balanced'} onChange={density => patch({ density: density as AdvancedCareerDesign['density'] })} options={[['compact','Compacte'],['balanced','Équilibrée'],['spacious','Aérée']]} className="mt-3" />
      </Section>

      <Section title="Couleurs" icon={<Palette className="h-4 w-4" />}>
        <div className="grid grid-cols-2 gap-3">
          <ColorField label="Principale" value={colors.primary} onChange={primary => patchColors({ primary })} />
          <ColorField label="Accent" value={colors.accent} onChange={accent => patchColors({ accent })} />
          <ColorField label="Colonne" value={colors.sidebar} onChange={sidebar => patchColors({ sidebar })} />
          <ColorField label="Texte" value={colors.text} onChange={text => patchColors({ text })} />
          <ColorField label="Fond" value={colors.background} onChange={background => patchColors({ background })} />
          <ColorField label="Bordure" value={design.border_color || '#e2e8f0'} onChange={border_color => patch({ border_color })} />
        </div>
        <NumberField label="Épaisseur bordure" value={Number(design.border_width || 0)} min={0} max={12} step={1} onChange={border_width => patch({ border_width })} className="mt-3" />
      </Section>

      {docType === 'cv' && 'photo_enabled' in design && (
        <Section title="Photo facultative" icon={<Settings className="h-4 w-4" />}>
          <label className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm font-semibold text-[#002050]"><span>Afficher la photo</span><input type="checkbox" checked={Boolean((design as DesignOptions).photo_enabled)} onChange={event => patch({ photo_enabled: event.target.checked } as Partial<AdvancedCareerDesign>)} /></label>
          <Select label="Forme" value={(design as DesignOptions).photo_shape || 'round'} onChange={photo_shape => patch({ photo_shape } as Partial<AdvancedCareerDesign>)} options={[['round','Ronde'],['square','Carrée'],['rectangle','Rectangulaire']]} className="mt-3" />
        </Section>
      )}

      <Section title="Pied de page" icon={<Settings className="h-4 w-4" />}>
        <label className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm font-semibold text-[#002050]"><span>Numéroter les pages</span><input type="checkbox" checked={Boolean(design.page_numbers)} onChange={event => patch({ page_numbers: event.target.checked })} /></label>
        <label className="mt-3 block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Texte du pied de page</span><input className={inputClass} value={design.footer_text || ''} onChange={event => patch({ footer_text: event.target.value })} placeholder="Facultatif" /></label>
      </Section>

      <div className="mt-4 rounded-xl bg-[#bf8813]/10 p-3 text-xs leading-5 text-slate-700">La version <strong>ATS stricte</strong> doit rester simple, sans éléments flottants complexes. L’éditeur libre reste disponible pour la version créative.</div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <div className="mt-4 border-t border-slate-200 pt-4"><div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#002050]">{icon}{title}</div>{children}</div>;
}

function Select({ label, value, onChange, options, className = '' }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string,string]>; className?: string }) {
  return <label className={`block ${className}`}><span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span><select className={inputClass} value={value} onChange={event => onChange(event.target.value)}>{options.map(([optionValue,optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}

function NumberField({ label, value, min, max, step, onChange, className = '' }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void; className?: string }) {
  return <label className={`block ${className}`}><span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span><input type="number" className={inputClass} value={Number.isFinite(value) ? value : min} min={min} max={max} step={step} onChange={event => onChange(Number(event.target.value))} /></label>;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span><div className="flex items-center gap-2 rounded-xl border border-slate-200 p-2"><input type="color" value={value || '#ffffff'} onChange={event => onChange(event.target.value)} className="h-8 w-10 rounded border-0 bg-transparent" /><input value={value || ''} onChange={event => onChange(event.target.value)} className="min-w-0 flex-1 border-0 text-xs font-semibold uppercase outline-none" /></div></label>;
}
