import { REACTIVE_RESUME_PROFILES } from './reactiveResumeCatalog';

/** Career V3 layout registry. Data comes from Supabase's existing career_template_manager.
 * Future renderers (including licensed Reactive Resume adapters) register here; never eval code from the DB. */
export type CareerLayoutVariant = 'split'|'band'|'minimal'|'timeline'|'cards'|'executive'|'creative'|'tech'|'academic'|'hospitality'|'qhse'|'compact'|'editorial'|'modern-sidebar'|'serif' | `rr-${import('./reactiveResumeCatalog').ReactiveResumeName}`;
export type CareerLayoutConfig = {
  variant: CareerLayoutVariant; primary: string; accent: string; sidebar?: string;
  header?: 'solid'|'line'|'split'|'minimal'; photo?: boolean; font?: string;
};
export const CAREER_LAYOUT_VARIANTS: ReadonlyArray<{id:CareerLayoutVariant; label:string; kind:'cv'|'both'}> = [
  {id:'split',label:'Deux colonnes',kind:'both'}, {id:'band',label:'Bandeau',kind:'both'},
  {id:'minimal',label:'Minimal ATS',kind:'both'}, {id:'timeline',label:'Chronologie',kind:'cv'},
  {id:'cards',label:'Blocs',kind:'cv'}, {id:'executive',label:'Exécutif',kind:'both'},
  {id:'creative',label:'Créatif',kind:'both'}, {id:'tech',label:'Tech',kind:'both'},
  {id:'academic',label:'Académique',kind:'cv'}, {id:'hospitality',label:'Hôtellerie',kind:'cv'},
  {id:'qhse',label:'QHSE',kind:'cv'}, {id:'compact',label:'Compact',kind:'cv'},
  {id:'editorial',label:'Éditorial V3',kind:'both'},
  {id:'modern-sidebar',label:'Sidebar V3',kind:'both'},
  {id:'serif',label:'Classique V3',kind:'both'},
  ...REACTIVE_RESUME_PROFILES.map(p=>({id:`rr-${p.id}` as CareerLayoutVariant,label:`Reactive Resume · ${p.id}`,kind:'both' as const})),
];
const allowed = new Set(CAREER_LAYOUT_VARIANTS.map(v=>v.id));
function color(input:unknown, fallback:string):string {
  return typeof input==='string' && /^#[0-9a-fA-F]{6}$/.test(input) ? input : fallback;
}
export function validateCareerLayout(input:unknown, fallback:CareerLayoutConfig):CareerLayoutConfig {
  if (!input || typeof input!=='object') return fallback;
  const raw = input as Record<string,unknown>;
  const variant = typeof raw.variant==='string' && allowed.has(raw.variant as CareerLayoutVariant)
    ? raw.variant as CareerLayoutVariant : fallback.variant;
  return {
    variant, primary:color(raw.primary,fallback.primary), accent:color(raw.accent,fallback.accent),
    sidebar:color(raw.sidebar,fallback.sidebar||'#f4f6f8'),
    header: raw.header==='solid'||raw.header==='line'||raw.header==='split'||raw.header==='minimal' ? raw.header : fallback.header,
    photo:typeof raw.photo==='boolean'?raw.photo:fallback.photo,
    font:typeof raw.font==='string'&&raw.font.length<80&&/^[a-zA-Z ,\-]+$/.test(raw.font)?raw.font:fallback.font,
  };
}
export function cachedCareerLayout(templateKey:string):unknown {
  if (typeof localStorage==='undefined') return null;
  try {
    const rows=JSON.parse(localStorage.getItem('omnia_career_custom_templates')||'[]');
    return Array.isArray(rows)?rows.find(row=>row.template_key===templateKey)?.layout_config:null;
  } catch {return null;}
}
export function resolveCareerLayout(
  templateKey:string, base:Record<string,CareerLayoutConfig>,
  remoteConfig?:unknown,
):CareerLayoutConfig {
  const fallback=base[templateKey]||base[Object.keys(base)[0]];
  if (!fallback) throw new Error('CAREER_LAYOUT_REGISTRY_EMPTY');
  if (base[templateKey]) return fallback;
  const raw=remoteConfig??cachedCareerLayout(templateKey);
  return validateCareerLayout(raw,fallback);
}
