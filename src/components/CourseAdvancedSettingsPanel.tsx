import { useEffect, useMemo, useState } from 'react';
import { Accessibility, CalendarClock, CheckCircle2, Gauge, Loader2, Save, ShieldCheck, Users } from 'lucide-react';
import { edgeAuthHeaders } from '../lib/edgeAuth';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/studio-unified`;
const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

type LearningDesign = {
  delivery_mode: 'self_paced' | 'cohort' | 'blended';
  drip_enabled: boolean;
  drip_interval_days: number;
  cohort_start_at: string | null;
  estimated_effort_hours: number;
  completion_policy: 'all_required' | 'assessments_only' | 'manual';
  require_sequential_progress: boolean;
  require_video_completion: boolean;
  accessibility: { captions:boolean; transcript:boolean; keyboard_checked:boolean; contrast_checked:boolean; alt_text_checked:boolean };
  learner_persona: string;
  success_outcome: string;
};

type Props = {
  course: any;
  locked?: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
  onSaved: (message: string) => void;
};

const DEFAULTS: LearningDesign = {
  delivery_mode:'self_paced', drip_enabled:false, drip_interval_days:7, cohort_start_at:null,
  estimated_effort_hours:0, completion_policy:'all_required', require_sequential_progress:true,
  require_video_completion:false, accessibility:{captions:false,transcript:false,keyboard_checked:false,contrast_checked:false,alt_text_checked:false},
  learner_persona:'', success_outcome:'',
};

function toLocalDateTimeValue(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function toUtcIso(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default function CourseAdvancedSettingsPanel({ course, locked, onPatch, onSaved }: Props) {
  const [design,setDesign]=useState<LearningDesign>({...DEFAULTS,...(course.learning_design_settings||{}),accessibility:{...DEFAULTS.accessibility,...(course.learning_design_settings?.accessibility||{})}});
  const [thresholds,setThresholds]=useState({lesson:Number(course.lesson_passing_score||80),module:Number(course.module_passing_score||80),final:Number(course.final_passing_score||70)});
  const [saving,setSaving]=useState(false);
  useEffect(()=>{setDesign({...DEFAULTS,...(course.learning_design_settings||{}),accessibility:{...DEFAULTS.accessibility,...(course.learning_design_settings?.accessibility||{})}});setThresholds({lesson:Number(course.lesson_passing_score||80),module:Number(course.module_passing_score||80),final:Number(course.final_passing_score||70)});},[course.id]);

  const readiness=useMemo(()=>[
    {label:'Public apprenant décrit',ok:design.learner_persona.trim().length>=10},
    {label:'Résultat professionnel attendu',ok:design.success_outcome.trim().length>=10},
    {label:'Seuils compris entre 1 et 100 %',ok:Object.values(thresholds).every(value=>value>=1&&value<=100)},
    {label:'Accessibilité renseignée',ok:Object.values(design.accessibility).some(Boolean)},
  ],[design,thresholds]);

  async function save(){
    if(!course.id)return;
    if(!Object.values(thresholds).every(value=>value>=1&&value<=100)){onSaved('Erreur : les seuils doivent être compris entre 1 et 100 %.');return;}
    setSaving(true);
    try{
      const normalizedDesign: LearningDesign = {
        ...design,
        cohort_start_at: design.delivery_mode === 'self_paced' ? null : toUtcIso(design.cohort_start_at),
      };
      const payload={action:'update_course',course_id:course.id,learning_design_settings:normalizedDesign,lesson_passing_score:thresholds.lesson,module_passing_score:thresholds.module,final_passing_score:thresholds.final};
      const response=await fetch(API,{method:'POST',headers:edgeAuthHeaders(),body:JSON.stringify(payload)});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||data.success===false)throw new Error(data.message||data.error||'Enregistrement impossible');
      onPatch({learning_design_settings:normalizedDesign,lesson_passing_score:thresholds.lesson,module_passing_score:thresholds.module,final_passing_score:thresholds.final});
      onSaved('Paramètres pédagogiques avancés enregistrés.');
    }catch(error){onSaved(`Erreur : ${error instanceof Error?error.message:'enregistrement impossible'}`);}finally{setSaving(false);}
  }

  return <section className="rounded-2xl border bg-white p-5" style={{borderColor:BORDER}}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em]" style={{color:GOLD}}>Fabrique pédagogique</p><h2 className="mt-1 text-lg font-black" style={{color:BLUE}}>Conception pédagogique avancée</h2><p className="mt-1 max-w-2xl text-sm text-gray-500">Définissez le rythme, les prérequis de progression, l’accessibilité et tous les seuils avant soumission.</p></div><div className="grid gap-1 text-xs">{readiness.map(item=><span key={item.label} className="flex items-center gap-1.5" style={{color:item.ok?'#15803D':'#9CA3AF'}}><CheckCircle2 size={13}/>{item.label}</span>)}</div></div>
    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <div className="space-y-4 rounded-2xl bg-slate-50 p-4"><h3 className="flex items-center gap-2 text-sm font-bold" style={{color:BLUE}}><Users size={17} color={GOLD}/>Cadrage apprenant</h3><label className="block text-xs font-semibold text-gray-600">Profil précis de l’apprenant<textarea disabled={locked} rows={3} value={design.learner_persona} onChange={e=>setDesign(x=>({...x,learner_persona:e.target.value}))} className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm" style={{borderColor:BORDER}} placeholder="Ex. responsables de PME maîtrisant les bases de la comptabilité..."/></label><label className="block text-xs font-semibold text-gray-600">Résultat observable à la fin<textarea disabled={locked} rows={3} value={design.success_outcome} onChange={e=>setDesign(x=>({...x,success_outcome:e.target.value}))} className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm" style={{borderColor:BORDER}} placeholder="Ex. produire et contrôler un bilan conforme au SYSCOHADA..."/></label></div>
      <div className="space-y-4 rounded-2xl bg-slate-50 p-4"><h3 className="flex items-center gap-2 text-sm font-bold" style={{color:BLUE}}><CalendarClock size={17} color={GOLD}/>Diffusion et progression</h3><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-gray-600">Mode<select disabled={locked} value={design.delivery_mode} onChange={e=>setDesign(x=>({...x,delivery_mode:e.target.value as LearningDesign['delivery_mode']}))} className="mt-1 h-10 w-full rounded-xl border bg-white px-3 text-sm" style={{borderColor:BORDER}}><option value="self_paced">Libre accès</option><option value="cohort">Par cohorte</option><option value="blended">Hybride</option></select></label><label className="text-xs font-semibold text-gray-600">Effort estimé (heures)<input disabled={locked} type="number" min={0} step="0.5" value={design.estimated_effort_hours} onChange={e=>setDesign(x=>({...x,estimated_effort_hours:Number(e.target.value||0)}))} className="mt-1 h-10 w-full rounded-xl border bg-white px-3 text-sm" style={{borderColor:BORDER}}/></label></div>{design.delivery_mode!=='self_paced'&&<label className="block text-xs font-semibold text-gray-600">Début de la cohorte<input disabled={locked} type="datetime-local" value={toLocalDateTimeValue(design.cohort_start_at)} onChange={e=>setDesign(x=>({...x,cohort_start_at:e.target.value||null}))} className="mt-1 h-10 w-full rounded-xl border bg-white px-3 text-sm" style={{borderColor:BORDER}}/></label>}<label className="block text-xs font-semibold text-gray-600">Règle de complétion<select disabled={locked} value={design.completion_policy} onChange={e=>setDesign(x=>({...x,completion_policy:e.target.value as LearningDesign['completion_policy']}))} className="mt-1 h-10 w-full rounded-xl border bg-white px-3 text-sm" style={{borderColor:BORDER}}><option value="all_required">Tous les contenus obligatoires</option><option value="assessments_only">Évaluations obligatoires uniquement</option><option value="manual">Validation manuelle</option></select></label><label className="flex items-center gap-2 text-sm font-semibold text-gray-700"><input disabled={locked} type="checkbox" checked={design.drip_enabled} onChange={e=>setDesign(x=>({...x,drip_enabled:e.target.checked}))}/>Déblocage progressif</label>{design.drip_enabled&&<label className="block text-xs font-semibold text-gray-600">Intervalle entre modules (jours)<input disabled={locked} type="number" min={1} value={design.drip_interval_days} onChange={e=>setDesign(x=>({...x,drip_interval_days:Math.max(1,Number(e.target.value||1))}))} className="mt-1 h-10 w-full rounded-xl border bg-white px-3 text-sm" style={{borderColor:BORDER}}/></label>}<label className="flex items-center gap-2 text-sm font-semibold text-gray-700"><input disabled={locked} type="checkbox" checked={design.require_sequential_progress} onChange={e=>setDesign(x=>({...x,require_sequential_progress:e.target.checked}))}/>Respecter l’ordre des modules et leçons</label><label className="flex items-center gap-2 text-sm font-semibold text-gray-700"><input disabled={locked} type="checkbox" checked={design.require_video_completion} onChange={e=>setDesign(x=>({...x,require_video_completion:e.target.checked}))}/>Exiger la complétion des vidéos</label></div>
      <div className="space-y-4 rounded-2xl bg-slate-50 p-4"><h3 className="flex items-center gap-2 text-sm font-bold" style={{color:BLUE}}><Gauge size={17} color={GOLD}/>Seuils de réussite</h3><p className="text-xs leading-5 text-gray-500">Ces valeurs alimentent les nouvelles évaluations. Chaque évaluation reste ensuite modifiable individuellement.</p><div className="grid gap-3 sm:grid-cols-3">{([['lesson','Leçon'],['module','Module'],['final','Examen final']] as const).map(([key,label])=><label key={key} className="text-xs font-semibold text-gray-600">{label}<div className="relative mt-1"><input disabled={locked} type="number" min={1} max={100} value={thresholds[key]} onChange={e=>setThresholds(x=>({...x,[key]:Number(e.target.value||0)}))} className="h-10 w-full rounded-xl border bg-white px-3 pr-8 text-sm" style={{borderColor:BORDER}}/><span className="absolute right-3 top-2.5 text-xs text-gray-400">%</span></div></label>)}</div></div>
      <div className="space-y-4 rounded-2xl bg-slate-50 p-4"><h3 className="flex items-center gap-2 text-sm font-bold" style={{color:BLUE}}><Accessibility size={17} color={GOLD}/>Accessibilité contrôlée</h3><div className="grid gap-3 sm:grid-cols-2">{([['captions','Sous-titres'],['transcript','Transcription'],['keyboard_checked','Navigation clavier'],['contrast_checked','Contraste vérifié'],['alt_text_checked','Textes alternatifs']] as const).map(([key,label])=><label key={key} className="flex items-center gap-2 text-sm font-semibold text-gray-700"><input disabled={locked} type="checkbox" checked={design.accessibility[key]} onChange={e=>setDesign(x=>({...x,accessibility:{...x.accessibility,[key]:e.target.checked}}))}/>{label}</label>)}</div></div>
    </div>
    <div className="mt-5 flex justify-end"><button disabled={locked||saving} onClick={()=>void save()} className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50" style={{background:BLUE}}>{saving?<Loader2 size={15} className="animate-spin"/>:<Save size={15}/>}Enregistrer les paramètres</button></div>
  </section>;
}
