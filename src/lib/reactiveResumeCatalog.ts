/** Licensed adaptations of Reactive Resume V6's original 17 template identities and semantic layouts.
 * Original source: https://github.com/reactive-resume/reactive-resume (MIT, Amruth Pillai).
 * This module maps the official templateLayouts metadata to OGA's interactive DOM renderer.
 * The original PDF renderer is not imported; multi-page PDF parity is a LOT 3 objective. */
export type ReactiveResumeName = 'azurill' | 'bronzor' | 'chikorita' | 'ditgar' | 'ditto' | 'gengar' | 'glalie' | 'kakuna' | 'lapras' | 'leafish' | 'meowth' | 'onyx' | 'pikachu' | 'porygon' | 'rhyhorn' | 'scizor' | 'smeargle';
export type ReactiveResumeProfile = { id:ReactiveResumeName; columns:1|2; sidebarSide:'left'|'right'|null; headerPlacement:'full-width'|'main-only'|'sidebar-only'; atsSafe:boolean; primary:string; accent:string; sidebar:string; description:string };
export const REACTIVE_RESUME_PROFILES: ReadonlyArray<ReactiveResumeProfile> = [
  { id:'azurill', columns:2, sidebarSide:"left", headerPlacement:'full-width', atsSafe:false, primary:'#25436b', accent:'#d4a147', sidebar:'#eef3f8', description:'Classique deux colonnes' },
  { id:'bronzor', columns:1, sidebarSide:null, headerPlacement:'full-width', atsSafe:true, primary:'#26374b', accent:'#47949a', sidebar:'#f3f7f7', description:'Linéaire professionnel' },
  { id:'chikorita', columns:2, sidebarSide:"right", headerPlacement:'main-only', atsSafe:false, primary:'#255b50', accent:'#83a993', sidebar:'#e8f2ec', description:'Colonne droite contrastée' },
  { id:'ditgar', columns:2, sidebarSide:"left", headerPlacement:'sidebar-only', atsSafe:false, primary:'#433651', accent:'#c09a67', sidebar:'#f6f0f9', description:'Identité latérale' },
  { id:'ditto', columns:2, sidebarSide:"left", headerPlacement:'full-width', atsSafe:false, primary:'#314867', accent:'#76a1ca', sidebar:'#eff3f8', description:'Sobre deux colonnes' },
  { id:'gengar', columns:2, sidebarSide:"left", headerPlacement:'sidebar-only', atsSafe:false, primary:'#49375b', accent:'#9f80c3', sidebar:'#f3eff8', description:'Sidebar créative' },
  { id:'glalie', columns:2, sidebarSide:"left", headerPlacement:'sidebar-only', atsSafe:false, primary:'#243c51', accent:'#7da5b5', sidebar:'#eaf1f5', description:'Colonne élégante' },
  { id:'kakuna', columns:1, sidebarSide:null, headerPlacement:'full-width', atsSafe:true, primary:'#253541', accent:'#d2a546', sidebar:'#fbf9f3', description:'Minimaliste classique' },
  { id:'lapras', columns:1, sidebarSide:null, headerPlacement:'full-width', atsSafe:true, primary:'#276075', accent:'#59a0ab', sidebar:'#eaf5f6', description:'Cadres et séparateurs' },
  { id:'leafish', columns:2, sidebarSide:"right", headerPlacement:'full-width', atsSafe:false, primary:'#375a46', accent:'#96a874', sidebar:'#f0f5e9', description:'Naturel deux colonnes' },
  { id:'meowth', columns:1, sidebarSide:null, headerPlacement:'full-width', atsSafe:true, primary:'#47382f', accent:'#c1a176', sidebar:'#f9f4ee', description:'Typographie sobre' },
  { id:'onyx', columns:1, sidebarSide:null, headerPlacement:'full-width', atsSafe:true, primary:'#293443', accent:'#758393', sidebar:'#f1f3f6', description:'Minimal ATS' },
  { id:'pikachu', columns:2, sidebarSide:"left", headerPlacement:'main-only', atsSafe:false, primary:'#3c3f48', accent:'#e7b938', sidebar:'#fff8df', description:'Accent latéral' },
  { id:'porygon', columns:1, sidebarSide:null, headerPlacement:'full-width', atsSafe:true, primary:'#304c65', accent:'#6f9db6', sidebar:'#f4f8fb', description:'Bordures structurées' },
  { id:'rhyhorn', columns:1, sidebarSide:null, headerPlacement:'full-width', atsSafe:true, primary:'#364438', accent:'#8d9d70', sidebar:'#f4f6ef', description:'Rubriques épurées' },
  { id:'scizor', columns:1, sidebarSide:null, headerPlacement:'full-width', atsSafe:true, primary:'#632f35', accent:'#bf6268', sidebar:'#fff3f4', description:'Typographie affirmée' },
  { id:'smeargle', columns:1, sidebarSide:null, headerPlacement:'full-width', atsSafe:true, primary:'#254c62', accent:'#4ba4af', sidebar:'#edf7f8', description:'Résumé mis en valeur' },
];
export const REACTIVE_RESUME_TEMPLATE_IDS = REACTIVE_RESUME_PROFILES.map(x=>x.id);
export function reactiveResumeProfile(templateKey:string, layoutVariant?:string):ReactiveResumeProfile|undefined {
  const key = /^((cv|lm)_rr_)([a-z]+)$/.exec(templateKey)?.[3] || /^rr-([a-z]+)$/.exec(layoutVariant||'')?.[1];
  return REACTIVE_RESUME_PROFILES.find(profile => profile.id === key);
}
export function reactiveResumeCatalogRows(type:'cv'|'lm') {
  return REACTIVE_RESUME_PROFILES.map((p,index)=>({
    template_key:`${type}_rr_${p.id}`, template_type:type, name_fr:`${p.id[0].toUpperCase()+p.id.slice(1)} · Reactive Resume`,
    description_fr:type==='cv'?`Adaptation OGA du modèle ${p.id}: ${p.description}.`:`Lettre de motivation assortie au modèle ${p.id} de Reactive Resume.`,
    category:type==='cv'?(p.atsSafe?'professional':'creative'):'classic_lm',
    is_free:true, is_ats_compatible:p.atsSafe, display_order:100+index,
    default_colors:{primary:p.primary,accent:p.accent,sidebar:p.sidebar,text:'#273342',background:'#ffffff'},
    layout_config:{variant:`rr-${p.id}`,primary:p.primary,accent:p.accent,sidebar:p.sidebar,header:'line',photo:type==='cv'},
    is_active:true, is_custom:false, catalog_status:'official' as const,
    canonical_template_key:`${type}_rr_${p.id}`,
  }));
}

/** Former OGA models reimplemented on the shared interactive document renderer.
 * IDs and colors remain OGA-owned; the semantic layout uses a close Reactive Resume analogue. */
const legacyVisualMapping: Record<string,ReactiveResumeName> = {
  cv_horizon:'azurill', cv_sahara:'lapras', cv_atlas:'onyx', cv_kora:'pikachu',
  cv_nile:'ditto', cv_executive:'meowth', cv_baobab:'gengar', cv_digital:'porygon',
  cv_academia:'kakuna', cv_hospitality:'leafish', cv_qhse:'bronzor', cv_impact:'scizor',
  lm_horizon:'azurill', lm_sahara:'lapras', lm_atlas:'onyx',
  lm_kora:'pikachu', lm_digital:'porygon', lm_executive:'meowth',
};
export function legacyOgaProfile(templateKey:string):ReactiveResumeProfile|undefined {
  const name=legacyVisualMapping[templateKey];
  return REACTIVE_RESUME_PROFILES.find(profile=>profile.id===name);
}
