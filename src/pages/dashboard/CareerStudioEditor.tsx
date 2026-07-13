import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Download,
  Edit3,
  Eye,
  FileText,
  GraduationCap,
  Languages,
  Loader2,
  Mail,
  Palette,
  Plus,
  Save,
  Settings,
  Sparkles,
  Star,
  Trash2,
  User,
  X,
  Search,
} from 'lucide-react';
import { CvPreview, type DesignOptions, type DocData } from '../../components/career/CvTemplates';
import { LmPreview, type LmData, type LmDesign } from '../../components/career/LmTemplates';
import {
  CAREER_PALETTES,
  CareerDocType,
  CareerDocumentFull,
  CareerTemplateMeta,
  DEFAULT_COLORS,
  createDefaultData,
  createDefaultDesign,
  getDefaultDocTitle,
  getDefaultTemplateKey,
  getCareerTemplates,
  getTemplateMeta,
  normalizeTemplateKey,
  calculateBasicScore,
} from '../../lib/careerStudioData';
import { getCareerDocument, listCareerDocuments, prepareCareerPdfExport, runCareerAiAction, saveCareerDocument } from '../../lib/careerStudioApi';
import { printCareerElementAsPdf } from '../../lib/careerPdfExport';
import ManualDocumentEditor, { ManualDocumentCanvas, type ManualLayout, type ManualBlock } from '../../components/career/ManualDocumentEditor';
import { BUILTIN_CV_LAYOUTS, BUILTIN_LM_LAYOUTS } from '../../components/career/EditableCareerTemplates';
import TemplateLiveCard from '../../components/career/TemplateLiveCard';

const BLUE = '#002050';
const GOLD = '#bf8813';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type AiSuggestionMode = 'cv_summary' | 'cv_experience' | 'cv_skills' | 'lm_full' | 'lm_section' | 'analysis';
type AiSuggestion = { title: string; text: string; mode: AiSuggestionMode; targetId?: string; tokensConsumed?: number; tokensRemaining?: number; remote?: boolean };

type CvSectionKey = 'profile' | 'summary' | 'skills' | 'experiences' | 'education' | 'certifications' | 'languages' | 'projects' | 'interests';
type LmSectionKey = 'sender' | 'recipient' | 'letter' | 'variables';

const CV_SECTIONS: Array<{ key: CvSectionKey; label: string; subtitle: string; icon: any }> = [
  { key: 'profile', label: 'Profil', subtitle: 'Informations personnelles', icon: User },
  { key: 'summary', label: 'Résumé', subtitle: 'Accroche professionnelle', icon: FileText },
  { key: 'skills', label: 'Compétences', subtitle: 'Compétences clés', icon: Star },
  { key: 'experiences', label: 'Expériences', subtitle: 'Parcours professionnel', icon: Briefcase },
  { key: 'education', label: 'Formation', subtitle: 'Diplômes et formations', icon: GraduationCap },
  { key: 'certifications', label: 'Certifications', subtitle: 'Certifications obtenues', icon: Award },
  { key: 'languages', label: 'Langues', subtitle: 'Langues parlées', icon: Languages },
  { key: 'projects', label: 'Projets', subtitle: 'Portfolio et réalisations', icon: Settings },
  { key: 'interests', label: 'Centres d’intérêt', subtitle: 'Vos passions', icon: Star },
];

const LM_SECTIONS: Array<{ key: LmSectionKey; label: string; subtitle: string; icon: any }> = [
  { key: 'sender', label: 'Expéditeur', subtitle: 'Vos coordonnées', icon: User },
  { key: 'recipient', label: 'Destinataire', subtitle: 'Entreprise et recruteur', icon: Briefcase },
  { key: 'letter', label: 'Corps de la lettre', subtitle: 'Contenu principal', icon: Mail },
  { key: 'variables', label: 'Ciblage', subtitle: 'Poste, ton et mots-clés', icon: Sparkles },
];

function uid(prefix = 'item') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function cardClass(extra = '') {
  return `rounded-2xl border border-slate-200 bg-white shadow-sm ${extra}`;
}

function inputClass(extra = '') {
  return `w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-[#002050] focus:ring-4 focus:ring-[#002050]/10 ${extra}`;
}

function labelClass() {
  return 'mb-1.5 block text-xs font-semibold text-slate-600';
}

function getCvData(document: CareerDocumentFull): DocData {
  return document.doc_data as DocData;
}

function getLmData(document: CareerDocumentFull): LmData {
  return document.doc_data as LmData;
}

function getCvDesign(document: CareerDocumentFull): DesignOptions {
  return document.design_options as DesignOptions;
}

function getLmDesign(document: CareerDocumentFull): LmDesign {
  return document.design_options as LmDesign;
}

function PreviewFrame({ children, zoom, onZoomChange }: { children: React.ReactNode; zoom: number; onZoomChange: (zoom:number)=>void }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-center gap-2">
        <button type="button" onClick={()=>onZoomChange(Math.max(.35, zoom-.1))} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold">−</button>
        <span className="w-16 text-center text-xs font-semibold text-slate-600">{Math.round(zoom*100)}%</span>
        <button type="button" onClick={()=>onZoomChange(Math.min(1.05, zoom+.1))} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold">+</button>
        <button type="button" onClick={()=>onZoomChange(.62)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold">Ajuster</button>
      </div>
      <div className="mx-auto flex h-[760px] w-full justify-center overflow-auto rounded-2xl border border-slate-200 bg-slate-100 p-5 shadow-inner">
        <div style={{ width: 794*zoom, height:1123*zoom }}><div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width:794 }}>{children}</div></div>
      </div>
    </div>
  );
}

function plain(value: unknown) {
  return String(value || '').replace(/[<>]/g, '');
}

function textBlock(content: string, x: number, y: number, width: number, height: number, style: Partial<ManualBlock['style']> = {}, zIndex = 2): ManualBlock {
  return {
    id: uid('block'), type: 'text', x, y, width, height, rotation: 0, zIndex,
    content: plain(content),
    style: {
      fontFamily: 'Arial', fontSize: 12, fontWeight: 400, fontStyle: 'normal', textDecoration: 'none',
      textAlign: 'left', color: '#1f2937', backgroundColor: 'transparent', borderColor: 'transparent',
      borderWidth: 0, borderRadius: 0, lineHeight: 1.4, opacity: 1, padding: 2, ...style,
    },
  };
}

function createManualLayout(document: CareerDocumentFull): ManualLayout {
  const design = document.design_options as DesignOptions;
  const builtin = document.doc_type === 'cv' ? BUILTIN_CV_LAYOUTS[document.template_key] : BUILTIN_LM_LAYOUTS[document.template_key];
  let custom: any = null;
  try { custom = JSON.parse(localStorage.getItem('omnia_career_custom_templates') || '[]').find((x:any)=>x.template_key===document.template_key)?.layout_config; } catch {}
  const cfg:any = builtin || custom || { variant:'band', primary:'#002050', accent:'#bf8813', sidebar:'#eef3f8', header:'solid' };
  const colors = { ...(design.colors || DEFAULT_COLORS), primary: design.colors?.primary || cfg.primary, accent: design.colors?.accent || cfg.accent, sidebar: design.colors?.sidebar || cfg.sidebar };
  const blocks: ManualBlock[] = [];
  const side = document.doc_type === 'cv' && ['split','timeline','cards','creative','tech','hospitality'].includes(cfg.variant);
  const mainX = side ? 238 : 46;
  const mainW = side ? 510 : 700;
  if (side) blocks.push({ id:uid('shape'), type:'shape', x:0,y:0,width:215,height:1123,rotation:0,zIndex:1,style:{backgroundColor:cfg.variant==='tech'?colors.primary:colors.sidebar,opacity:1,borderWidth:0,borderRadius:0} });
  blocks.push({ id:uid('shape'), type:'shape', x:side?215:0,y:0,width:side?579:794,height:122,rotation:0,zIndex:1,style:{backgroundColor:colors.primary,opacity:1,borderWidth:0,borderRadius:0} });

  if (document.doc_type === 'cv') {
    const d=getCvData(document);
    blocks.push(textBlock(d.name||'Votre nom', mainX,30,mainW,38,{fontSize:28,fontWeight:700,color:'#fff'},3));
    blocks.push(textBlock(d.title||'Titre professionnel',mainX,74,mainW,26,{fontSize:14,fontWeight:700,color:colors.accent},3));
    if(side){
      blocks.push(textBlock('CONTACT',26,145,160,24,{fontSize:12,fontWeight:700,color:cfg.variant==='tech'?'#fff':colors.primary}));
      blocks.push(textBlock([d.contact?.email,d.contact?.phone,d.contact?.location].filter(Boolean).join('\n'),26,178,160,90,{fontSize:9,lineHeight:1.6,color:cfg.variant==='tech'?'#e2e8f0':'#334155'}));
      blocks.push(textBlock('COMPÉTENCES',26,300,160,24,{fontSize:12,fontWeight:700,color:cfg.variant==='tech'?'#fff':colors.primary}));
      blocks.push(textBlock((d.skills||[]).map(x=>x.name).join('\n'),26,334,160,180,{fontSize:9,lineHeight:1.7,color:cfg.variant==='tech'?'#e2e8f0':'#334155'}));
      blocks.push(textBlock('LANGUES',26,545,160,24,{fontSize:12,fontWeight:700,color:cfg.variant==='tech'?'#fff':colors.primary}));
      blocks.push(textBlock((d.languages||[]).map(x=>`${x.name} — ${x.level}`).join('\n'),26,578,160,120,{fontSize:9,lineHeight:1.7,color:cfg.variant==='tech'?'#e2e8f0':'#334155'}));
    } else {
      blocks.push(textBlock([d.contact?.email,d.contact?.phone,d.contact?.location].filter(Boolean).join(' • '),46,138,700,28,{fontSize:10,color:'#475569'}));
    }
    let y=side?150:190;
    const add=(title:string, body:string, h:number)=>{ if(!body.trim()) return; blocks.push(textBlock(title,mainX,y,mainW,25,{fontSize:14,fontWeight:700,color:colors.primary})); blocks.push({id:uid('line'),type:'line',x:mainX,y:y+26,width:80,height:3,rotation:0,zIndex:1,style:{borderColor:colors.accent,borderWidth:3,opacity:1}}); blocks.push(textBlock(body,mainX,y+42,mainW,h,{fontSize:10,lineHeight:1.5,color:'#334155'})); y+=h+82; };
    add('PROFIL',d.summary||'',78);
    add('EXPÉRIENCES',(d.experiences||[]).map(e=>`${e.position}${e.company?` — ${e.company}`:''}\n${e.description||''}`).join('\n\n'),205);
    add('FORMATION',(d.education||[]).map(e=>`${e.degree}${e.school?` — ${e.school}`:''}${e.year?` (${e.year})`:''}`).join('\n'),110);
    if(!side) add('COMPÉTENCES',(d.skills||[]).map(x=>x.name).join(' • '),74);
  } else {
    const d=getLmData(document);
    blocks.push(textBlock(d.sender?.name||'Votre nom',46,32,540,34,{fontSize:25,fontWeight:700,color:'#fff'},3));
    blocks.push(textBlock([d.sender?.email,d.sender?.phone].filter(Boolean).join(' • '),48,78,520,22,{fontSize:10,color:'#fff'},3));
    blocks.push(textBlock(`${d.recipient?.name||''}\n${d.recipient?.company||''}\n${d.recipient?.address||''}`,48,160,340,76,{fontSize:11,lineHeight:1.5}));
    blocks.push(textBlock(`${d.sender?.city||''}${d.sender?.date?`, le ${d.sender.date}`:''}`,480,160,265,28,{fontSize:10,textAlign:'right'}));
    blocks.push(textBlock(d.subject?`Objet : ${d.subject}`:'Objet :',48,260,700,35,{fontSize:12,fontWeight:700,color:colors.primary}));
    blocks.push(textBlock(d.salutation||'Madame, Monsieur,',48,325,700,32,{fontSize:11}));
    blocks.push(textBlock([d.intro,d.motivation,d.skills_paragraph,d.company_link,d.availability].filter(Boolean).join('\n\n'),48,372,700,465,{fontSize:11,lineHeight:1.65,textAlign:'justify'}));
    blocks.push(textBlock(d.closing||'',48,860,700,95,{fontSize:11,lineHeight:1.6}));
    blocks.push(textBlock(d.signature||d.sender?.name||'',500,995,240,45,{fontSize:15,fontWeight:700,fontStyle:'italic',textAlign:'right',color:colors.primary}));
  }
  return {version:1,page:{width:794,height:1123,background:'#fff'},blocks};
}

function hasText(value: unknown) { return typeof value === 'string' && value.trim().length > 0; }
function isCvSectionComplete(key: CvSectionKey, data: DocData) {
  if (key === 'profile') return hasText(data.name) && hasText(data.title) && (hasText(data.contact?.email) || hasText(data.contact?.phone));
  if (key === 'summary') return hasText(data.summary);
  if (key === 'skills') return Array.isArray(data.skills) && data.skills.some((x: any) => hasText(x?.name));
  if (key === 'experiences') return Array.isArray(data.experiences) && data.experiences.some((x: any) => hasText(x?.position) && hasText(x?.company));
  if (key === 'education') return Array.isArray(data.education) && data.education.some((x: any) => hasText(x?.degree) && hasText(x?.school));
  if (key === 'certifications') return Array.isArray(data.certifications_external) && data.certifications_external.some((x: any) => hasText(x?.name));
  if (key === 'languages') return Array.isArray(data.languages) && data.languages.some((x: any) => hasText(x?.name) && hasText(x?.level));
  return false;
}
function isLmSectionComplete(key: LmSectionKey, data: LmData) {
  const map: Record<string, boolean> = {
    sender: hasText(data.sender?.name) && hasText(data.sender?.email), recipient: hasText(data.recipient?.company), subject: hasText(data.subject),
    intro: hasText(data.intro), motivation: hasText(data.motivation), skills: hasText(data.skills_paragraph), company: hasText(data.company_link),
    closing: hasText(data.closing), signature: hasText(data.signature),
  };
  return Boolean(map[key]);
}
export default function CareerStudioEditor() {
  const navigate = useNavigate();
  const { docId } = useParams<{ docId: string }>();
  const [searchParams] = useSearchParams();
  const docType = (searchParams.get('type') === 'lm' ? 'lm' : 'cv') as CareerDocType;
  const requestedTemplate = normalizeTemplateKey(docType, searchParams.get('template') || getDefaultTemplateKey(docType));

  const [document, setDocument] = useState<CareerDocumentFull | null>(null);
  const [templates, setTemplates] = useState<CareerTemplateMeta[]>([]);
  const [tokens, setTokens] = useState(0);
  const [remoteMode, setRemoteMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [activeCvSection, setActiveCvSection] = useState<CvSectionKey>('profile');
  const [activeLmSection, setActiveLmSection] = useState<LmSectionKey>('letter');
  const [toast, setToast] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [offerText, setOfferText] = useState('');
  const saveTimer = useRef<number | null>(null);
  const printRef = useRef<HTMLDivElement | null>(null);
  const [manualEditorOpen, setManualEditorOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(0.62);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [pendingDocumentName, setPendingDocumentName] = useState('');
  const [pendingSaveAction, setPendingSaveAction] = useState<'save' | 'pdf' | 'manual' | null>(null);

  const score = useMemo(() => {
    if (!document) return 0;
    return calculateBasicScore(document.doc_type, document.doc_data);
  }, [document]);

  const selectedTemplate = useMemo(() => {
    if (!document) return getTemplateMeta(docType, requestedTemplate);
    return getTemplateMeta(document.doc_type, document.template_key);
  }, [document, docType, requestedTemplate]);

  const manualLayout = useMemo(() => {
    if (!document) return null;
    return ((document.doc_data as any).manual_layout as ManualLayout | undefined) || createManualLayout(document);
  }, [document]);

  const isManualMode = Boolean((document?.design_options as any)?.editor_mode === 'manual');

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3200);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listCareerDocuments(docType);
      setTemplates(list.templates);
      setTokens(list.tokens);
      setRemoteMode(list.remote);
      const loaded = await getCareerDocument(docType, docId, requestedTemplate);
      setRemoteMode(loaded.remote);
      setDocument(loaded.document);
    } finally {
      setLoading(false);
    }
  }, [docId, docType, requestedTemplate]);

  useEffect(() => {
    load();
  }, [load]);

  const updateDocument = useCallback((updater: (current: CareerDocumentFull) => CareerDocumentFull) => {
    setDocument(prev => {
      if (!prev) return prev;
      const next = updater(prev);
      return {
        ...next,
        ats_score: calculateBasicScore(next.doc_type, next.doc_data),
        updated_at: new Date().toISOString(),
      };
    });
    setSaveState('idle');
    setDirty(true);
  }, []);

  const isDocumentNamed = useCallback((doc: CareerDocumentFull) => {
    const currentTitle = String(doc.title || '').trim();
    const defaultTitle = getDefaultDocTitle(doc.doc_type);
    return Boolean(currentTitle && currentTitle !== defaultTitle);
  }, []);

  const persistDocument = useCallback(async (docToSave: CareerDocumentFull) => {
    setSaveState('saving');
    try {
      const saved = await saveCareerDocument(docToSave);
      setDocument(saved.document);
      setRemoteMode(saved.remote);
      setSaveState('saved');
      setDirty(false);
      return saved.document;
    } catch {
      setSaveState('error');
      throw new Error('SAVE_FAILED');
    }
  }, []);

  const saveNow = useCallback(async (interactive = true, action: 'save' | 'pdf' | 'manual' = 'save') => {
    if (!document) return null;
    if (!isDocumentNamed(document)) {
      if (!interactive) return null;
      setPendingDocumentName('');
      setPendingSaveAction(action);
      setNameDialogOpen(true);
      setSaveState('idle');
      return null;
    }
    return persistDocument(document);
  }, [document, isDocumentNamed, persistDocument]);

  const confirmDocumentName = useCallback(async () => {
    if (!document || !pendingDocumentName.trim()) return;
    const named = { ...document, title: pendingDocumentName.trim() };
    setDocument(named);
    setNameDialogOpen(false);
    const action = pendingSaveAction;
    setPendingSaveAction(null);
    try {
      await persistDocument(named);
      if (action === 'manual') showToast('Mise en page manuelle enregistrée');
      else if (action === 'save') showToast('Document sauvegardé');
      else if (action === 'pdf') window.setTimeout(() => handlePdfDownload(true), 0);
    } catch {
      showToast('Impossible de sauvegarder le document.');
    }
  }, [document, pendingDocumentName, pendingSaveAction, persistDocument]);

  useEffect(() => {
    if (!document || loading || !dirty) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveNow(false);
    }, 900);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [document?.doc_data, document?.design_options, document?.template_key, document?.title, dirty]);

  function updateCv(mutator: (data: DocData) => DocData) {
    updateDocument(doc => ({ ...doc, doc_data: mutator(getCvData(doc)) }));
  }

  function updateLm(mutator: (data: LmData) => LmData) {
    updateDocument(doc => ({ ...doc, doc_data: mutator(getLmData(doc)) }));
  }

  function updateDesignColors(colors: typeof DEFAULT_COLORS) {
    updateDocument(doc => ({
      ...doc,
      design_options: {
        ...doc.design_options,
        colors,
      } as DesignOptions | LmDesign,
    }));
  }

  function templatePreset(key: string) {
    const presets: Record<string, Partial<DesignOptions>> = {
      classic_pro: { colors: { primary: '#17365D', accent: '#BF8813', sidebar: '#EEF2F6', text: '#374151', background: '#FFFFFF' }, photo_enabled: true },
      modern_student: { colors: { primary: '#E9A8B8', accent: '#7B61A8', sidebar: '#FFF4F7', text: '#374151', background: '#FFFFFF' }, photo_enabled: true },
      corporate_blue: { colors: { primary: '#002B5C', accent: '#2F6B9A', sidebar: '#EAF1F7', text: '#273444', background: '#FFFFFF' }, photo_enabled: true },
      minimal_luxe: { colors: { primary: '#111827', accent: '#C9A86A', sidebar: '#F8F5EF', text: '#2F2F2F', background: '#FFFFFF' }, photo_enabled: false },
      africa_gold: { colors: { primary: '#06182E', accent: '#BF8813', sidebar: '#06182E', text: '#E5E7EB', background: '#06182E' }, photo_enabled: true },
      tech_future: { colors: { primary: '#071622', accent: '#00D9E9', sidebar: '#071622', text: '#D7F9FF', background: '#071622' }, photo_enabled: true },
      cyber_security: { colors: { primary: '#050A07', accent: '#71FF4D', sidebar: '#050A07', text: '#D8FFD0', background: '#050A07' }, photo_enabled: true },
      data_analyst: { colors: { primary: '#1E4F7A', accent: '#4AA3DF', sidebar: '#EAF5FB', text: '#334155', background: '#FFFFFF' }, photo_enabled: true },
      creative_digital: { colors: { primary: '#1F2937', accent: '#FF7A59', sidebar: '#FFF3EE', text: '#374151', background: '#FFFFFF' }, photo_enabled: true },
      no_photo_ats: { colors: { primary: '#111827', accent: '#4B5563', sidebar: '#FFFFFF', text: '#111827', background: '#FFFFFF' }, photo_enabled: false },
      photo_elegant: { colors: { primary: '#102A43', accent: '#BF8813', sidebar: '#102A43', text: '#334155', background: '#FFFFFF' }, photo_enabled: true },
      young_graduate: { colors: { primary: '#577263', accent: '#A9C2B3', sidebar: '#EEF5F0', text: '#34443B', background: '#FFFFFF' }, photo_enabled: true },
      internship_ready: { colors: { primary: '#4B6B63', accent: '#A8C8BE', sidebar: '#EDF5F2', text: '#334155', background: '#FFFFFF' }, photo_enabled: true },
      international_cv: { colors: { primary: '#1F4C7A', accent: '#64A4D8', sidebar: '#EEF6FC', text: '#334155', background: '#FFFFFF' }, photo_enabled: true },
      qhse_professional: { colors: { primary: '#1F5A39', accent: '#6B9C79', sidebar: '#EAF4ED', text: '#2F4738', background: '#FFFFFF' }, photo_enabled: true },
      business_manager: { colors: { primary: '#071A33', accent: '#BF8813', sidebar: '#071A33', text: '#E5E7EB', background: '#071A33' }, photo_enabled: true },
      hospitality: { colors: { primary: '#7A4A2E', accent: '#C7A17A', sidebar: '#F7EFE7', text: '#4A3326', background: '#FFFDFC' }, photo_enabled: true },
      academic_cv: { colors: { primary: '#123B6D', accent: '#3E6FA3', sidebar: '#EAF1F8', text: '#2F3B49', background: '#FFFFFF' }, photo_enabled: true },
      freelancer: { colors: { primary: '#463D78', accent: '#7B6EC8', sidebar: '#F1EFFF', text: '#36304B', background: '#FFFFFF' }, photo_enabled: true },
      executive_one_page: { colors: { primary: '#050505', accent: '#BF8813', sidebar: '#050505', text: '#F3F4F6', background: '#050505' }, photo_enabled: true },
    };
    return presets[key] || {};
  }

  function changeTemplate(templateKey: string) {
    const normalizedTemplateKey = normalizeTemplateKey(docType, templateKey);
    const meta = getTemplateMeta(docType, normalizedTemplateKey);
    const preset = docType === 'cv' ? templatePreset(normalizedTemplateKey) : {};
    updateDocument(doc => ({
      ...doc,
      template_key: normalizedTemplateKey,
      doc_data: { ...(doc.doc_data as any), manual_layout: undefined },
      design_options: {
        ...doc.design_options,
        ...preset,
        colors: (preset as any).colors || meta.default_colors || DEFAULT_COLORS,
        editor_mode: 'template',
      } as DesignOptions | LmDesign,
    }));
  }

  function resetDemoData() {
    updateDocument(doc => ({
      ...doc,
      doc_data: createDefaultData(doc.doc_type),
      design_options: createDefaultDesign(doc.doc_type),
      template_key: getDefaultTemplateKey(doc.doc_type),
      title: getDefaultDocTitle(doc.doc_type),
    }));
  }

  function updateManualLayout(layout: ManualLayout) {
    updateDocument(doc => ({
      ...doc,
      doc_data: { ...(doc.doc_data as any), manual_layout: layout },
      design_options: { ...(doc.design_options as any), editor_mode: 'manual' },
    }));
  }

  function switchToTemplateMode() {
    updateDocument(doc => ({ ...doc, design_options: { ...(doc.design_options as any), editor_mode: 'template' } }));
  }

  async function manualSave() {
    const saved = await saveNow(true, 'save');
    if (saved) showToast('Document sauvegardé');
  }


  function getActiveExperienceText() {
    if (!document || document.doc_type !== 'cv') return '';
    const data = getCvData(document);
    const first = data.experiences?.[0];
    return first ? `${first.position} - ${first.company}\n${first.description}` : data.summary;
  }

  async function requestAi(mode: AiSuggestionMode, action: Parameters<typeof runCareerAiAction>[0]['action']) {
    if (!document || aiLoading) return;
    setAiLoading(true);
    setAiSuggestion(null);
    try {
      const isCvDoc = document.doc_type === 'cv';
      const cv = isCvDoc ? getCvData(document) : null;
      const lm = !isCvDoc ? getLmData(document) : null;
      const textByMode =
        mode === 'cv_summary' ? (cv?.summary || '') :
        mode === 'cv_experience' ? getActiveExperienceText() :
        mode === 'cv_skills' ? `${cv?.title || ''}\n${cv?.summary || ''}\n${(cv?.experiences || []).map(e => e.description).join('\n')}` :
        mode === 'lm_full' ? `${lm?.subject || ''}\n${lm?.intro || ''}\n${lm?.motivation || ''}\n${lm?.skills_paragraph || ''}` :
        mode === 'lm_section' ? `${lm?.intro || ''}\n${lm?.motivation || ''}\n${lm?.skills_paragraph || ''}\n${lm?.company_link || ''}` :
        document.doc_type === 'cv' ? JSON.stringify(cv) : JSON.stringify(lm);

      const result = await runCareerAiAction({
        action,
        doc_type: document.doc_type,
        text: textByMode,
        doc_data: document.doc_data,
        offer_text: offerText,
        target_job: isCvDoc ? (cv?.title || document.target_job || '') : (lm?.subject || document.target_job || ''),
        application_type: document.application_type || document.doc_type,
        language: 'fr',
      });

      if (typeof result.tokens_remaining === 'number') setTokens(result.tokens_remaining);
      setAiSuggestion({
        title: getAiTitle(mode, action),
        text: result.result,
        mode,
        tokensConsumed: result.tokens_consumed,
        tokensRemaining: result.tokens_remaining,
        remote: result.remote,
      });
      showToast(result.remote ? 'Suggestion IA générée' : 'Suggestion locale générée');
    } catch (err) {
      showToast((err as Error).message || 'Impossible de générer la suggestion IA.');
    } finally {
      setAiLoading(false);
    }
  }

  function applyAiSuggestion() {
    if (!aiSuggestion || !document) return;

    if (document.doc_type === 'cv') {
      if (aiSuggestion.mode === 'cv_summary') {
        updateCv(d => ({ ...d, summary: cleanAiText(aiSuggestion.text) }));
      } else if (aiSuggestion.mode === 'cv_experience') {
        updateCv(d => ({
          ...d,
          experiences: d.experiences.map((exp, index) => index === 0 ? { ...exp, description: cleanAiText(aiSuggestion.text) } : exp),
        }));
      } else if (aiSuggestion.mode === 'cv_skills') {
        const skills = parseAiLines(aiSuggestion.text).slice(0, 12);
        updateCv(d => ({
          ...d,
          skills: skills.map((name, index) => ({ id: uid('skai'), name, level: Math.max(60, 92 - index * 3) })),
        }));
      }
    } else {
      if (aiSuggestion.mode === 'lm_full') {
        updateLm(d => mergeLetterText(d, aiSuggestion.text));
      } else if (aiSuggestion.mode === 'lm_section') {
        const paragraphs = splitParagraphs(aiSuggestion.text);
        updateLm(d => ({
          ...d,
          intro: paragraphs[0] || d.intro,
          motivation: paragraphs[1] || d.motivation,
          skills_paragraph: paragraphs[2] || d.skills_paragraph,
          company_link: paragraphs[3] || d.company_link,
          availability: paragraphs[4] || d.availability,
        }));
      }
    }

    setAiSuggestion(null);
    showToast('Suggestion appliquée au document');
  }

  async function handlePdfDownload(alreadyNamed = false) {
    if (!document) return;
    if (exportingPdf) return;

    if (document.doc_type === 'cv' && remoteMode && tokens <= 0) {
      showToast('Jeton insuffisant : le téléchargement PDF du CV nécessite 1 jeton.');
      return;
    }

    setExportingPdf(true);
    try {
      if (!alreadyNamed) {
        const saved = await saveNow(true, 'pdf');
        if (!saved) { setExportingPdf(false); return; }
      }
      const currentDocument = document;
      const result = await prepareCareerPdfExport(currentDocument);
      if (typeof result.tokens_remaining === 'number') {
        setTokens(result.tokens_remaining);
      }

      printCareerElementAsPdf(printRef.current, {
        title: currentDocument.title || (currentDocument.doc_type === 'cv' ? 'CV Omnia Career' : 'Lettre Omnia Career'),
        docType: currentDocument.doc_type,
        tokensConsumed: result.tokens_consumed,
      });

      const message = currentDocument.doc_type === 'cv'
        ? result.remote
          ? `PDF prêt. ${result.tokens_consumed} jeton consommé. Solde : ${result.tokens_remaining ?? tokens}.`
          : 'PDF prêt en mode test local : aucun jeton consommé.'
        : 'PDF de la lettre prêt. Les lettres ne consomment pas de jeton pour cette étape.';
      showToast(message);
    } catch (err) {
      const e = err as Error & { code?: string; status?: number };
      if (e.code === 'INSUFFICIENT_TOKENS' || e.status === 402) {
        showToast(e.message || 'Jetons insuffisants pour télécharger ce CV.');
      } else {
        showToast(e.message || 'Impossible de préparer le PDF.');
      }
    } finally {
      setExportingPdf(false);
    }
  }

  if (loading || !document) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="h-8 w-8 animate-spin text-[#002050]" />
      </div>
    );
  }

  const isCv = document.doc_type === 'cv';
  const cvData = isCv ? getCvData(document) : null;
  const lmData = !isCv ? getLmData(document) : null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      {toast && (
        <div className="fixed right-5 top-5 z-50 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-[#002050] shadow-lg">
          {toast}
        </div>
      )}

      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex h-[76px] items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard/career-studio')} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <ArrowLeft className="h-4 w-4" /> Mes documents
            </button>
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                Omnia Career <ChevronRight className="h-3 w-3" /> {isCv ? 'CV Builder' : 'Lettres de motivation'}
              </div>
              <input
                value={document.title}
                onChange={e => updateDocument(doc => ({ ...doc, title: e.target.value }))}
                className="mt-1 w-[420px] border-0 bg-transparent text-2xl font-semibold text-[#002050] outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 md:flex">
              {saveState === 'saving' && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#bf8813]" />}
              {saveState === 'saved' && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
              {saveState === 'saving' ? 'Enregistrement...' : saveState === 'saved' ? 'Enregistré automatiquement' : remoteMode ? 'Connecté Supabase' : 'Mode local sécurisé'}
            </div>
            <div className="rounded-full bg-[#bf8813]/10 px-3 py-2 text-xs font-bold text-[#bf8813]">{tokens} jeton(s)</div>
            <button onClick={() => setManualEditorOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-[#bf8813]/40 bg-[#bf8813]/10 px-4 py-2 text-sm font-semibold text-[#7a570c] hover:bg-[#bf8813]/15">
              <Edit3 className="h-4 w-4" /> Éditeur libre
            </button>
            <button onClick={manualSave} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[#002050] hover:bg-slate-50">
              <Save className="h-4 w-4" /> Enregistrer
            </button>
            <button onClick={handlePdfDownload} disabled={exportingPdf} className="inline-flex items-center gap-2 rounded-xl bg-[#002050] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
              <Download className="h-4 w-4" /> {exportingPdf ? 'Préparation...' : 'Télécharger PDF'}
            </button>
          </div>
        </div>
      </div>

      {isManualMode && (
        <div className="mx-5 mt-4 flex items-center justify-between rounded-xl border border-[#bf8813]/30 bg-[#bf8813]/10 px-4 py-3 text-sm">
          <span className="font-semibold text-[#002050]">Mode édition libre actif : le PDF utilisera votre mise en page manuelle.</span>
          <div className="flex gap-2"><button onClick={() => setManualEditorOpen(true)} className="rounded-lg bg-[#002050] px-3 py-2 text-xs font-semibold text-white">Continuer l’édition</button><button onClick={switchToTemplateMode} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold">Revenir au modèle</button></div>
        </div>
      )}

      <div className="grid min-h-[calc(100vh-76px)] grid-cols-[300px_minmax(520px,1fr)_340px] gap-5 p-5">
        <aside className={cardClass('h-[calc(100vh-116px)] overflow-hidden p-4')}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#002050]">{isCv ? 'Sections du CV' : 'Structure de la lettre'}</h2>
              <p className="mt-1 text-xs text-slate-500">Cliquez sur une section pour modifier.</p>
            </div>
            <button onClick={resetDemoData} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Réinitialiser</button>
          </div>

          <div className="space-y-2">
            {(isCv ? CV_SECTIONS : LM_SECTIONS).map(section => {
              const Icon = section.icon;
              const active = isCv ? activeCvSection === section.key : activeLmSection === section.key;
              return (
                <button
                  key={section.key}
                  onClick={() => (isCv ? setActiveCvSection(section.key as CvSectionKey) : setActiveLmSection(section.key as LmSectionKey))}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${active ? 'border-[#002050] bg-[#002050]/5' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? 'bg-[#002050] text-white' : 'bg-slate-100 text-[#002050]'}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-[#002050]">{section.label}</div>
                    <div className="truncate text-xs text-slate-500">{section.subtitle}</div>
                  </div>
                  {(isCv ? isCvSectionComplete(section.key as CvSectionKey, cvData as DocData) : isLmSectionComplete(section.key as LmSectionKey, lmData as LmData))
                    ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                    : <span className="h-4 w-4 rounded-full border border-slate-300" />}
                </button>
              );
            })}
          </div>

          <div className="mt-5 rounded-2xl border border-[#bf8813]/30 bg-[#bf8813]/10 p-4">
            <div className="text-sm font-semibold text-[#002050]">Conseil Omnia</div>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              Sauvegarde automatique active. Les modèles CV et LM déjà définis sont disponibles dans le panneau droit.
            </p>
          </div>
        </aside>

        <main className="min-w-0">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-[#002050]">{isCv ? 'CV Builder' : 'Éditeur de lettre'}</h1>
              <p className="mt-1 text-sm text-slate-500">Aperçu en direct avec sauvegarde automatique.</p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
              <Eye className="h-4 w-4 text-[#002050]" /> Aperçu live
            </div>
          </div>

          <div className={cardClass('p-4')}>
            <PreviewFrame zoom={previewZoom} onZoomChange={setPreviewZoom}>
              <div ref={printRef} data-career-print-source="true">
                {isManualMode && manualLayout ? (
                  <ManualDocumentCanvas layout={manualLayout} />
                ) : isCv ? (
                  <CvPreview templateKey={document.template_key} data={cvData as DocData} design={getCvDesign(document)} />
                ) : (
                  <LmPreview templateKey={document.template_key} data={lmData as LmData} design={getLmDesign(document)} />
                )}
              </div>
            </PreviewFrame>
          </div>
        </main>

        <aside className="h-[calc(100vh-116px)] overflow-y-auto space-y-4 pr-1">
          <EditorPanel
            isCv={isCv}
            cvData={cvData}
            lmData={lmData}
            activeCvSection={activeCvSection}
            activeLmSection={activeLmSection}
            updateCv={updateCv}
            updateLm={updateLm}
            score={score}
          />

          <AiAssistantPanel
            isCv={isCv}
            loading={aiLoading}
            suggestion={aiSuggestion}
            offerText={offerText}
            onOfferTextChange={setOfferText}
            onRequest={requestAi}
            onApply={applyAiSuggestion}
            onDismiss={() => setAiSuggestion(null)}
          />

          <TemplatePanel
            docType={document.doc_type}
            templates={templates.length ? templates : getCareerTemplates(document.doc_type)}
            selectedTemplate={selectedTemplate}
            selectedKey={document.template_key}
            data={document.doc_data}
            design={document.design_options}
            onSelect={changeTemplate}
          />


          <div className={cardClass('p-4')}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#002050]">Score d’optimisation</h3>
              <span className="text-2xl font-bold text-green-600">{score}/100</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-green-600" style={{ width: `${score}%` }} />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Score local basé sur les sections complétées. Le téléchargement PDF est maintenant activé avec consommation de jeton pour les CV.
            </p>
          </div>
        </aside>
      </div>

      {manualLayout && (
        <ManualDocumentEditor
          open={manualEditorOpen}
          title={document.title}
          initialLayout={manualLayout}
          onChange={updateManualLayout}
          onClose={() => setManualEditorOpen(false)}
          onSave={async () => {
            const saved = await saveNow(true, 'manual');
            if (saved) showToast('Mise en page manuelle enregistrée');
          }}
          printRef={printRef}
        />
      )}

      {nameDialogOpen && document && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-[#002050]">
              {document.doc_type === 'cv' ? 'Nommer votre CV' : 'Nommer votre lettre de motivation'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Donnez un nom clair pour retrouver facilement ce document dans Omnia Career.
            </p>
            <input
              autoFocus
              value={pendingDocumentName}
              onChange={(e) => setPendingDocumentName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && pendingDocumentName.trim()) confirmDocumentName(); }}
              placeholder={document.doc_type === 'cv' ? 'Ex. CV Assistant QSE Luxembourg' : 'Ex. LM Stage QHSE'}
              className="mt-5 h-12 w-full rounded-2xl border border-slate-300 px-4 text-sm outline-none focus:border-[#bf8813] focus:ring-4 focus:ring-[#bf8813]/10"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => { setNameDialogOpen(false); setPendingSaveAction(null); setSaveState('idle'); }} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">Annuler</button>
              <button type="button" disabled={!pendingDocumentName.trim()} onClick={confirmDocumentName} className="rounded-xl bg-[#002050] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function getAiTitle(mode: AiSuggestionMode, action: string) {
  if (mode === 'cv_summary') return 'Résumé professionnel amélioré';
  if (mode === 'cv_experience') return 'Expérience reformulée';
  if (mode === 'cv_skills') return 'Compétences suggérées';
  if (mode === 'lm_full') return 'Lettre de motivation générée';
  if (mode === 'lm_section') return 'Lettre améliorée';
  if (action === 'ats_score') return 'Analyse ATS détaillée';
  return 'Suggestion IA';
}

function cleanAiText(text: string) {
  return (text || '')
    .replace(/^```(?:json|text)?/i, '')
    .replace(/```$/i, '')
    .trim();
}

function splitParagraphs(text: string) {
  return cleanAiText(text)
    .split(/\n{2,}/)
    .map(p => p.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean);
}

function parseAiLines(text: string) {
  return cleanAiText(text)
    .split(/\n|,|;/)
    .map(line => line.replace(/^[-•\d.)\s]+/, '').trim())
    .filter(Boolean)
    .filter((item, index, arr) => arr.findIndex(x => x.toLowerCase() === item.toLowerCase()) === index);
}

function mergeLetterText(data: LmData, text: string): LmData {
  const paragraphs = splitParagraphs(text).filter(p => !/^madame|^monsieur|^objet\s*:/i.test(p));
  return {
    ...data,
    intro: paragraphs[0] || data.intro,
    motivation: paragraphs[1] || data.motivation,
    skills_paragraph: paragraphs[2] || data.skills_paragraph,
    company_link: paragraphs[3] || data.company_link,
    availability: paragraphs[4] || data.availability,
    closing: paragraphs[5] || data.closing,
  };
}

function AiAssistantPanel({
  isCv,
  loading,
  suggestion,
  offerText,
  onOfferTextChange,
  onRequest,
  onApply,
  onDismiss,
}: {
  isCv: boolean;
  loading: boolean;
  suggestion: AiSuggestion | null;
  offerText: string;
  onOfferTextChange: (value: string) => void;
  onRequest: (mode: AiSuggestionMode, action: Parameters<typeof runCareerAiAction>[0]['action']) => void;
  onApply: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className={cardClass('p-4')}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#bf8813]/10 px-3 py-1 text-xs font-bold text-[#bf8813]">
            <Sparkles className="h-3.5 w-3.5" /> IA Omnia Career
          </div>
          <h3 className="mt-3 text-lg font-semibold text-[#002050]">Assistant IA</h3>
          <p className="mt-1 text-sm leading-5 text-slate-600">Les suggestions sont proposées sans remplacer votre contenu. Vous décidez quand les appliquer.</p>
        </div>
      </div>

      {isCv ? (
        <div className="grid grid-cols-1 gap-2">
          <AiButton loading={loading} label="Améliorer le résumé" onClick={() => onRequest('cv_summary', 'improve_summary')} />
          <AiButton loading={loading} label="Reformuler l’expérience principale" onClick={() => onRequest('cv_experience', 'rewrite_experience')} />
          <AiButton loading={loading} label="Suggérer des compétences" onClick={() => onRequest('cv_skills', 'suggest_skills')} />
          <AiButton loading={loading} label="Analyser ATS" onClick={() => onRequest('analysis', 'ats_score')} subtle />
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block">
            <span className={labelClass()}>Offre d’emploi ou contexte ciblé</span>
            <textarea
              className={inputClass('min-h-[92px] resize-y')}
              placeholder="Collez ici une offre, le nom de l’entreprise, les missions ou les mots-clés à intégrer..."
              value={offerText}
              onChange={(e) => onOfferTextChange(e.target.value)}
            />
          </label>
          <div className="grid grid-cols-1 gap-2">
            <AiButton loading={loading} label="Générer une lettre complète" onClick={() => onRequest('lm_full', 'generate_lm')} />
            <AiButton loading={loading} label="Adapter à l’offre" onClick={() => onRequest('lm_full', 'adapt_to_offer')} />
            <AiButton loading={loading} label="Rendre plus professionnel" onClick={() => onRequest('lm_section', 'make_professional')} subtle />
            <AiButton loading={loading} label="Corriger la langue" onClick={() => onRequest('lm_section', 'fix_grammar')} subtle />
          </div>
        </div>
      )}

      {suggestion && (
        <div className="mt-4 rounded-2xl border border-[#bf8813]/30 bg-[#bf8813]/10 p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-[#002050]">{suggestion.title}</h4>
            <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-slate-600">
              {suggestion.remote ? 'IA' : 'Local'} · {suggestion.tokensConsumed || 0} jeton
            </span>
          </div>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-xs leading-5 text-slate-700">{suggestion.text}</pre>
          <div className="mt-3 flex items-center gap-2">
            {suggestion.mode !== 'analysis' && (
              <button type="button" onClick={onApply} className="rounded-xl bg-[#002050] px-3 py-2 text-sm font-semibold text-white hover:opacity-90">
                Appliquer
              </button>
            )}
            <button type="button" onClick={onDismiss} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AiButton({ label, loading, onClick, subtle = false }: { label: string; loading: boolean; onClick: () => void; subtle?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={subtle
        ? 'inline-flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-[#002050] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60'
        : 'inline-flex items-center justify-between rounded-xl bg-[#002050] px-3 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'}
    >
      <span>{label}</span>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
    </button>
  );
}

function EditorPanel({
  isCv,
  cvData,
  lmData,
  activeCvSection,
  activeLmSection,
  updateCv,
  updateLm,
  score,
}: {
  isCv: boolean;
  cvData: DocData | null;
  lmData: LmData | null;
  activeCvSection: CvSectionKey;
  activeLmSection: LmSectionKey;
  updateCv: (mutator: (data: DocData) => DocData) => void;
  updateLm: (mutator: (data: LmData) => LmData) => void;
  score: number;
}) {
  if (isCv && cvData) {
    return (
      <div className={cardClass('p-4')}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[#002050]">Modifier la section</h3>
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700">{score}%</span>
        </div>
        <CvSectionEditor active={activeCvSection} data={cvData} update={updateCv} />
      </div>
    );
  }

  if (!isCv && lmData) {
    return (
      <div className={cardClass('p-4')}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[#002050]">Modifier la lettre</h3>
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700">{score}%</span>
        </div>
        <LmSectionEditor active={activeLmSection} data={lmData} update={updateLm} />
      </div>
    );
  }

  return null;
}

function CvSectionEditor({ active, data, update }: { active: CvSectionKey; data: DocData; update: (mutator: (data: DocData) => DocData) => void }) {
  if (active === 'profile') {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {data.photo_url ? <img src={data.photo_url} alt="Photo du CV" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">Photo</div>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-[#002050]">Photo du CV</div>
              <div className="mt-1 text-xs leading-5 text-slate-500">Ajoutez, remplacez ou supprimez votre photo. Les modèles sans photo l’ignorent automatiquement.</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <label className="cursor-pointer rounded-xl bg-[#002050] px-3 py-2 text-xs font-semibold text-white">
                  {data.photo_url ? 'Remplacer' : 'Ajouter une photo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => update(d => ({ ...d, photo_url: String(reader.result || '') }));
                      reader.readAsDataURL(file);
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
                {data.photo_url && <button type="button" onClick={() => update(d => ({ ...d, photo_url: '' }))} className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600">Supprimer</button>}
              </div>
            </div>
          </div>
        </div>
        <Field label="Nom complet" value={data.name} onChange={v => update(d => ({ ...d, name: v }))} />
        <Field label="Titre professionnel" value={data.title} onChange={v => update(d => ({ ...d, title: v }))} />
        <Field label="Email" value={data.contact.email} onChange={v => update(d => ({ ...d, contact: { ...d.contact, email: v } }))} />
        <Field label="Téléphone" value={data.contact.phone} onChange={v => update(d => ({ ...d, contact: { ...d.contact, phone: v } }))} />
        <Field label="Ville / Pays" value={data.contact.location} onChange={v => update(d => ({ ...d, contact: { ...d.contact, location: v } }))} />
        <Field label="LinkedIn" value={data.contact.linkedin || ''} onChange={v => update(d => ({ ...d, contact: { ...d.contact, linkedin: v } }))} />
      </div>
    );
  }

  if (active === 'summary') {
    return <TextArea label="Résumé professionnel" value={data.summary} rows={8} onChange={v => update(d => ({ ...d, summary: v }))} />;
  }

  if (active === 'skills') {
    return (
      <ListEditor
        title="Compétences"
        addLabel="Ajouter une compétence"
        items={data.skills}
        render={(item, remove) => (
          <div className="flex items-center gap-2">
            <input className={inputClass('flex-1')} value={item.name} onChange={e => update(d => ({ ...d, skills: d.skills.map(s => s.id === item.id ? { ...s, name: e.target.value } : s) }))} />
            <input type="range" min={0} max={100} value={item.level} className="w-20" style={{ accentColor: BLUE }} onChange={e => update(d => ({ ...d, skills: d.skills.map(s => s.id === item.id ? { ...s, level: Number(e.target.value) } : s) }))} />
            <span className="w-8 text-right text-xs text-slate-500">{item.level}%</span>
            {remove}
          </div>
        )}
        onAdd={() => update(d => ({ ...d, skills: [...d.skills, { id: uid('sk'), name: 'Nouvelle compétence', level: 70 }] }))}
        onRemove={id => update(d => ({ ...d, skills: d.skills.filter(s => s.id !== id) }))}
      />
    );
  }

  if (active === 'experiences') {
    return (
      <ListEditor
        title="Expériences"
        addLabel="Ajouter une expérience"
        items={data.experiences}
        render={(item, remove) => (
          <div className="space-y-2 rounded-xl border border-slate-200 p-3">
            <div className="flex justify-end">{remove}</div>
            <Field label="Poste" value={item.position} onChange={v => update(d => ({ ...d, experiences: d.experiences.map(x => x.id === item.id ? { ...x, position: v } : x) }))} />
            <Field label="Entreprise" value={item.company} onChange={v => update(d => ({ ...d, experiences: d.experiences.map(x => x.id === item.id ? { ...x, company: v } : x) }))} />
            <Field label="Lieu" value={item.location || ''} onChange={v => update(d => ({ ...d, experiences: d.experiences.map(x => x.id === item.id ? { ...x, location: v } : x) }))} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Début" value={item.start_date} onChange={v => update(d => ({ ...d, experiences: d.experiences.map(x => x.id === item.id ? { ...x, start_date: v } : x) }))} />
              <Field label="Fin" value={item.end_date || ''} onChange={v => update(d => ({ ...d, experiences: d.experiences.map(x => x.id === item.id ? { ...x, end_date: v } : x) }))} />
            </div>
            <TextArea label="Description" rows={4} value={item.description} onChange={v => update(d => ({ ...d, experiences: d.experiences.map(x => x.id === item.id ? { ...x, description: v } : x) }))} />
          </div>
        )}
        onAdd={() => update(d => ({ ...d, experiences: [...d.experiences, { id: uid('exp'), position: 'Nouveau poste', company: 'Entreprise', start_date: '2025-01', current: false, description: '' }] }))}
        onRemove={id => update(d => ({ ...d, experiences: d.experiences.filter(x => x.id !== id) }))}
      />
    );
  }

  if (active === 'education') {
    return <SimpleRows title="Formation" items={data.education} fields={[['degree', 'Diplôme'], ['school', 'École'], ['year', 'Année']]} onAdd={() => update(d => ({ ...d, education: [...d.education, { id: uid('edu'), degree: 'Nouveau diplôme', school: 'École', year: '2025' }] }))} onRemove={id => update(d => ({ ...d, education: d.education.filter(x => x.id !== id) }))} onChange={(id, field, value) => update(d => ({ ...d, education: d.education.map(x => x.id === id ? { ...x, [field]: value } : x) }))} />;
  }

  if (active === 'certifications') {
    return <SimpleRows title="Certifications" items={data.certifications_external} fields={[['name', 'Certification'], ['issuer', 'Organisme'], ['year', 'Année']]} onAdd={() => update(d => ({ ...d, certifications_external: [...d.certifications_external, { id: uid('cert'), name: 'Nouvelle certification', issuer: 'Organisme', year: '2025' }] }))} onRemove={id => update(d => ({ ...d, certifications_external: d.certifications_external.filter(x => x.id !== id) }))} onChange={(id, field, value) => update(d => ({ ...d, certifications_external: d.certifications_external.map(x => x.id === id ? { ...x, [field]: value } : x) }))} />;
  }

  if (active === 'languages') {
    return <SimpleRows title="Langues" items={data.languages} fields={[['name', 'Langue'], ['level', 'Niveau']]} onAdd={() => update(d => ({ ...d, languages: [...d.languages, { id: uid('lang'), name: 'Anglais', level: 'Intermédiaire' }] }))} onRemove={id => update(d => ({ ...d, languages: d.languages.filter(x => x.id !== id) }))} onChange={(id, field, value) => update(d => ({ ...d, languages: d.languages.map(x => x.id === id ? { ...x, [field]: value } : x) }))} />;
  }

  if (active === 'projects') {
    return <SimpleRows title="Projets" items={data.projects} fields={[['name', 'Nom'], ['description', 'Description'], ['technologies', 'Technologies']]} onAdd={() => update(d => ({ ...d, projects: [...d.projects, { id: uid('proj'), name: 'Nouveau projet', description: '', technologies: '' }] }))} onRemove={id => update(d => ({ ...d, projects: d.projects.filter(x => x.id !== id) }))} onChange={(id, field, value) => update(d => ({ ...d, projects: d.projects.map(x => x.id === id ? { ...x, [field]: value } : x) }))} />;
  }

  return <TextArea label="Centres d’intérêt" rows={5} value={(data.interests || []).join(', ')} onChange={v => update(d => ({ ...d, interests: v.split(',').map(x => x.trim()).filter(Boolean) }))} />;
}

function LmSectionEditor({ active, data, update }: { active: LmSectionKey; data: LmData; update: (mutator: (data: LmData) => LmData) => void }) {
  if (active === 'sender') {
    return (
      <div className="space-y-3">
        <Field label="Nom complet" value={data.sender.name} onChange={v => update(d => ({ ...d, sender: { ...d.sender, name: v }, signature: v }))} />
        <Field label="Adresse" value={data.sender.address} onChange={v => update(d => ({ ...d, sender: { ...d.sender, address: v } }))} />
        <Field label="Téléphone" value={data.sender.phone} onChange={v => update(d => ({ ...d, sender: { ...d.sender, phone: v } }))} />
        <Field label="Email" value={data.sender.email} onChange={v => update(d => ({ ...d, sender: { ...d.sender, email: v } }))} />
        <Field label="Ville" value={data.sender.city} onChange={v => update(d => ({ ...d, sender: { ...d.sender, city: v } }))} />
        <Field label="Date" value={data.sender.date} onChange={v => update(d => ({ ...d, sender: { ...d.sender, date: v } }))} />
      </div>
    );
  }

  if (active === 'recipient') {
    return (
      <div className="space-y-3">
        <Field label="Nom du recruteur" value={data.recipient.name} onChange={v => update(d => ({ ...d, recipient: { ...d.recipient, name: v } }))} />
        <Field label="Entreprise" value={data.recipient.company} onChange={v => update(d => ({ ...d, recipient: { ...d.recipient, company: v } }))} />
        <TextArea label="Adresse de l’entreprise" value={data.recipient.address} rows={3} onChange={v => update(d => ({ ...d, recipient: { ...d.recipient, address: v } }))} />
      </div>
    );
  }

  if (active === 'variables') {
    return (
      <div className="space-y-3">
        <Field label="Objet" value={data.subject} onChange={v => update(d => ({ ...d, subject: v }))} />
        <Field label="Formule d’appel" value={data.salutation} onChange={v => update(d => ({ ...d, salutation: v }))} />
        <Field label="Signature" value={data.signature} onChange={v => update(d => ({ ...d, signature: v }))} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <TextArea label="Introduction" value={data.intro} rows={4} onChange={v => update(d => ({ ...d, intro: v }))} />
      <TextArea label="Motivation" value={data.motivation} rows={4} onChange={v => update(d => ({ ...d, motivation: v }))} />
      <TextArea label="Compétences clés" value={data.skills_paragraph} rows={4} onChange={v => update(d => ({ ...d, skills_paragraph: v }))} />
      <TextArea label="Lien avec l’entreprise" value={data.company_link} rows={4} onChange={v => update(d => ({ ...d, company_link: v }))} />
      <TextArea label="Disponibilité" value={data.availability} rows={3} onChange={v => update(d => ({ ...d, availability: v }))} />
      <TextArea label="Conclusion" value={data.closing} rows={4} onChange={v => update(d => ({ ...d, closing: v }))} />
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className={labelClass()}>{label}</span>
      <input className={inputClass()} value={value || ''} onChange={e => onChange(e.target.value)} />
    </label>
  );
}

function TextArea({ label, value, rows, onChange }: { label: string; value: string; rows: number; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className={labelClass()}>{label}</span>
      <textarea className={inputClass('resize-y')} rows={rows} value={value || ''} onChange={e => onChange(e.target.value)} />
    </label>
  );
}

function ListEditor<T extends { id: string }>({ title, addLabel, items, render, onAdd, onRemove }: { title: string; addLabel: string; items: T[]; render: (item: T, remove: React.ReactNode) => React.ReactNode; onAdd: () => void; onRemove: (id: string) => void }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-[#002050]">{title}</h4>
        <button onClick={onAdd} className="inline-flex items-center gap-1 rounded-lg bg-[#002050] px-3 py-1.5 text-xs font-semibold text-white">
          <Plus className="h-3 w-3" /> {addLabel}
        </button>
      </div>
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id}>{render(item, <button onClick={() => onRemove(item.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>)}</div>
        ))}
      </div>
    </div>
  );
}

function SimpleRows<T extends { id: string }>({ title, items, fields, onAdd, onRemove, onChange }: { title: string; items: T[]; fields: Array<[keyof T & string, string]>; onAdd: () => void; onRemove: (id: string) => void; onChange: (id: string, field: keyof T & string, value: string) => void }) {
  return (
    <ListEditor
      title={title}
      addLabel="Ajouter"
      items={items}
      onAdd={onAdd}
      onRemove={onRemove}
      render={(item, remove) => (
        <div className="space-y-2 rounded-xl border border-slate-200 p-3">
          <div className="flex justify-end">{remove}</div>
          {fields.map(([field, label]) => (
            <Field key={field} label={label} value={String((item as any)[field] || '')} onChange={v => onChange(item.id, field, v)} />
          ))}
        </div>
      )}
    />
  );
}

function TemplatePanel({
  docType,
  templates,
  selectedTemplate,
  selectedKey,
  data,
  design,
  onSelect,
}: {
  docType: CareerDocType;
  templates: CareerTemplateMeta[];
  selectedTemplate: CareerTemplateMeta;
  selectedKey: string;
  data: DocData | LmData;
  design: DesignOptions | LmDesign;
  onSelect: (key: string) => void;
}) {
  const canonicalTemplates = templates.length ? templates : getCareerTemplates(docType);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'free' | 'premium' | 'ats'>('all');

  const filteredTemplates = canonicalTemplates
    .filter(t => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return `${t.name_fr} ${t.description_fr} ${t.category}`.toLowerCase().includes(q);
    })
    .filter(t => {
      if (filter === 'free') return t.is_free;
      if (filter === 'premium') return !t.is_free;
      if (filter === 'ats') return t.is_ats_compatible;
      return true;
    });

  return (
    <div className={cardClass('p-4')}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[#002050]">Modèles</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {selectedTemplate?.name_fr || 'Modèle sélectionné'} est appliqué à l’aperçu live et au PDF.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setGalleryOpen(true)}
          className="rounded-xl bg-[#002050] px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
        >
          Voir en grand
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {canonicalTemplates.slice(0, 3).map(template => (
          <TemplatePreviewCard
            key={template.template_key}
            template={template}
            docType={docType}
            data={data}
            design={design}
            selected={template.template_key === selectedKey}
            onSelect={() => onSelect(template.template_key)}
            compact
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setGalleryOpen(true)}
        className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-[#002050] hover:bg-slate-50"
      >
        Ouvrir la galerie complète ({canonicalTemplates.length})
      </button>

      {galleryOpen && (
        <div className="fixed inset-0 z-[80] bg-slate-950/70 p-4 backdrop-blur-sm md:p-8">
          <div className="mx-auto flex h-full max-w-7xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-[#002050]">
                  {docType === 'cv' ? 'Choisir un modèle de CV' : 'Choisir un modèle de lettre'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Sélectionnez un modèle : il sera appliqué immédiatement dans l’éditeur, l’aperçu plein écran et le PDF.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGalleryOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
                aria-label="Fermer la galerie"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex h-11 w-full max-w-md items-center rounded-2xl border border-slate-200 bg-white px-3">
                <Search className="mr-2 h-4 w-4 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher un modèle..."
                  className="h-full flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  ['all', 'Tous'],
                  ['free', 'Gratuits'],
                  ['premium', 'Premium'],
                  ['ats', 'ATS'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key as typeof filter)}
                    className={`rounded-full px-4 py-2 text-xs font-bold transition ${filter === key ? 'bg-[#002050] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-5">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                {filteredTemplates.map(template => (
                  <TemplatePreviewCard
                    key={template.template_key}
                    template={template}
                    docType={docType}
                    data={data}
                    design={design}
                    selected={template.template_key === selectedKey}
                    onSelect={() => {
                      onSelect(template.template_key);
                      setGalleryOpen(false);
                    }}
                  />
                ))}
              </div>
              {!filteredTemplates.length && (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                  Aucun modèle trouvé pour cette recherche.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/**
 * Chaque modèle dispose de sa propre maquette découpée depuis les planches
 * validées par l'administrateur. La clé du fichier est exactement la même
 * que template_key, ce qui empêche tout décalage entre la galerie, le
 * renderer HTML/CSS, l'aperçu plein écran et l'export PDF.
 */
function getTemplateMockup(template: CareerTemplateMeta, _docType: CareerDocType) {
  return template.thumbnail_url || (template.is_custom ? '/career-templates/generated/custom.svg' : `/career-templates/generated/${template.template_key}.svg`);
}

function TemplatePreviewCard({
  template,
  docType,
  data: _data,
  design: _design,
  selected,
  onSelect,
  compact = false,
}: {
  template: CareerTemplateMeta;
  docType: CareerDocType;
  data: DocData | LmData;
  design: DesignOptions | LmDesign;
  selected: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  return <TemplateLiveCard template={template} docType={docType} selected={selected} onClick={onSelect} compact={compact} />;
}
