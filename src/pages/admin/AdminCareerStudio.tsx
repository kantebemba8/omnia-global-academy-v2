import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { mergeCareerTemplateCatalog } from '../../lib/careerStudioData';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import CareerTokenGovernancePanel, { type CareerTokenGlobalRule, type CareerTokenRuleConfig } from '../../components/career/CareerTokenGovernancePanel';
import { AdminLayout } from '../../components/AdminLayout';
import {
  AlertCircle,
  BarChart2,
  Check,
  Coins,
  Download,
  FileText,
  Mail,
  MessageSquare,
  Plus,
  RefreshCw,
  Save,
  Settings,
  ShieldCheck,
  Sparkles,
  X,
  ExternalLink,
} from 'lucide-react';

type SubTab = 'dashboard' | 'rules' | 'packs' | 'cv_templates' | 'lm_templates' | 'ai' | 'question_bank' | 'exports' | 'stats';

type RuleValueType = 'boolean' | 'integer' | 'decimal' | 'text' | 'select';

type CareerRule = {
  id?: string;
  rule_key: string;
  group_key: string;
  label_fr: string;
  description_fr?: string | null;
  value_type: RuleValueType;
  value_json: any;
  options_json?: any[] | null;
  min_value?: number | null;
  max_value?: number | null;
  unit?: string | null;
  is_active: boolean;
  display_order: number;
};

type TokenConfig = CareerTokenRuleConfig;

type AiConfig = {
  id?: string;
  config_key: string;
  config_value: string;
  description_fr?: string | null;
  is_active: boolean;
};

type Template = {
  id?: string;
  template_key: string;
  template_type: 'cv' | 'lm';
  name_fr: string;
  description_fr: string;
  category: string;
  is_free: boolean;
  is_active: boolean;
  is_ats_compatible: boolean;
  display_order: number;
  usage_count?: number;
  export_count?: number;
  thumbnail_url?: string | null;
  layout_config?: Record<string, unknown>;
  is_custom?: boolean;
  catalog_status?: 'official' | 'custom' | 'retired';
  canonical_template_key?: string | null;
};

type InterviewQuestion = {
  id: string;
  category: 'rh' | 'technique' | 'metier' | 'sectorielle' | 'star' | 'offre';
  sector?: string;
  level?: string;
  question: string;
  expected_answer?: string;
  keywords?: string;
  is_active: boolean;
  source: 'super_admin' | 'ai';
};

type AdminStats = {
  total_cv: number;
  total_lm: number;
  unique_creators: number;
  active_users_30d: number;
  total_exports: number;
  export_success: number;
  export_failed: number;
  tokens_consumed: number;
  tokens_credited: number;
  tokens_sold: number;
  token_sales_count: number;
  token_revenue_xof: number;
  ai_actions: number;
  active_templates: number;
  active_cv_templates: number;
  active_lm_templates: number;
  active_packs: number;
  active_questions: number;
  top_templates: Array<{ template_key: string; name_fr: string; template_type: string; usage_count: number }>;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';

const OMNIA_BLUE = '#002050';
const OMNIA_GOLD = '#bf8813';
const BORDER = '#E4E7EC';
const MUTED = '#667085';

const GROUP_LABELS: Record<string, string> = {
  general: 'Règles générales',
  tokens: 'Jetons CV',
  exports: 'Téléchargements & exports',
  ai: 'IA & assistance',
  templates: 'Modèles CV / LM',
  premium: 'Premium & accès',
  structure: 'Avantages structure',
};

const CATEGORY_LABELS: Record<string, string> = {
  student: 'Étudiant & Stage',
  professional: 'Professionnel',
  africa_premium: 'Afrique Premium',
  tech: 'Tech & Digital',
  creative: 'Créatif',
  specialized: 'Spécialisé',
  classic_lm: 'LM classique',
  quick_lm: 'LM rapide',
};

const SUB_MENUS = [
  { key: 'dashboard', label: 'Tableau de bord', icon: BarChart2 },
  { key: 'rules', label: 'Règles & Prix', icon: Settings },
  { key: 'packs', label: 'Gains & dépenses', icon: Coins },
  { key: 'cv_templates', label: 'Modèles CV', icon: FileText },
  { key: 'lm_templates', label: 'Modèles LM', icon: Mail },
  { key: 'ai', label: 'IA & Automatisation', icon: Sparkles },
  { key: 'question_bank', label: 'Banque questions', icon: MessageSquare },
  { key: 'exports', label: 'Exports', icon: Download },
  { key: 'stats', label: 'Statistiques', icon: BarChart2 },
] as { key: SubTab; label: string; icon: typeof BarChart2 }[];

async function postAdmin<T>(body: unknown): Promise<T> {
  if (!SUPABASE_URL) throw new Error('VITE_SUPABASE_URL manquant');
  const res = await fetch(`${SUPABASE_URL}/functions/v1/career-studio-admin-config`, {
    method: 'POST',
    headers: edgeAuthHeaders(),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data?.message || data?.error || `Erreur ${res.status}`);
  return data as T;
}

async function postTokenManager<T>(body: unknown): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/career-token-manage`, {
    method: 'POST', headers: edgeAuthHeaders(), body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || `Erreur ${res.status}`);
  return data as T;
}

function valueFromJson(rule: CareerRule) {
  if (rule?.value_json && typeof rule.value_json === 'object' && 'value' in rule.value_json) return rule.value_json.value;
  return rule.value_json;
}

function setRuleValue(rule: CareerRule, nextValue: any): CareerRule {
  return { ...rule, value_json: { value: nextValue } };
}

function NumberInput({ value, onChange, min = 0, max, suffix }: { value: number; onChange: (n: number) => void; min?: number; max?: number | null; suffix?: string | null }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={min}
        max={max ?? undefined}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value || 0))}
        className="h-10 w-24 rounded-lg border px-3 text-sm font-semibold outline-none focus:border-[#002050]"
        style={{ borderColor: BORDER, color: OMNIA_BLUE }}
      />
      {suffix && <span className="text-xs" style={{ color: MUTED }}>{suffix}</span>}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="relative h-6 w-11 rounded-full transition-all"
      style={{ background: checked ? OMNIA_BLUE : '#D0D5DD' }}
      aria-pressed={checked}
    >
      <span
        className="absolute left-0 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform"
        style={{ transform: checked ? 'translateX(24px)' : 'translateX(4px)' }}
      />
    </button>
  );
}


async function postTemplateManager<T>(body: unknown): Promise<T> {
  if (!SUPABASE_URL) throw new Error('VITE_SUPABASE_URL manquant');
  const res = await fetch(`${SUPABASE_URL}/functions/v1/career-template-manager`, {
    method: 'POST',
    headers: edgeAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || 'Erreur template');
  return data as T;
}

export default function AdminCareerStudio() {
  const navigate = useNavigate();
  const [subTab, setSubTab] = useState<SubTab>('dashboard');
  const [rules, setRules] = useState<CareerRule[]>([]);
  const [tokenConfig, setTokenConfig] = useState<TokenConfig[]>([]);
  const [aiConfig, setAiConfig] = useState<AiConfig[]>([]);
  const [cvTemplates, setCvTemplates] = useState<Template[]>([]);
  const [lmTemplates, setLmTemplates] = useState<Template[]>([]);
  const [showTemplateCreator, setShowTemplateCreator] = useState(false);
  const [customTemplate, setCustomTemplate] = useState({ template_key: '', name_fr: '', description_fr: '', thumbnail_url: '', variant: 'split', primary: '#002050', accent: '#bf8813', sidebar: '#eef3f8', is_free: true, is_ats_compatible: true });
  const [stats, setStats] = useState<AdminStats>({ total_cv: 0, total_lm: 0, unique_creators: 0, active_users_30d: 0, total_exports: 0, export_success: 0, export_failed: 0, tokens_consumed: 0, tokens_credited: 0, tokens_sold: 0, token_sales_count: 0, token_revenue_xof: 0, ai_actions: 0, active_templates: 0, active_cv_templates: 0, active_lm_templates: 0, active_packs: 0, active_questions: 0, top_templates: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [questionBank, setQuestionBank] = useState<InterviewQuestion[]>([]);
  const [exportLogs, setExportLogs] = useState<any[]>([]);
  const [tokenTransactions, setTokenTransactions] = useState<any[]>([]);
  const [questionForm, setQuestionForm] = useState<Omit<InterviewQuestion, 'id'>>({
    category: 'rh',
    sector: '',
    level: 'Débutant',
    question: '',
    expected_answer: '',
    keywords: '',
    is_active: true,
    source: 'super_admin',
  });

  function showToast(text: string, type: 'success' | 'error' = 'success') {
    setToast({ text, type });
    window.setTimeout(() => setToast(null), 3800);
  }

  async function loadAll() {
    setLoading(true);
    try {
      const data = await postAdmin<{
        rules: CareerRule[];
        token_config: TokenConfig[];
        ai_config: AiConfig[];
        templates: Template[];
        stats: AdminStats;
        questions?: InterviewQuestion[];
        exports?: any[];
        transactions?: any[];
      }>({ action: 'get_config' });
      setRules(data.rules || []);
      setTokenConfig(data.token_config || []);
      setAiConfig(data.ai_config || []);
      const remoteTemplates = data.templates || [];
      setCvTemplates(mergeCareerTemplateCatalog('cv', remoteTemplates as any, { authoritative: true, includeInactive: true }) as Template[]);
      setLmTemplates(mergeCareerTemplateCatalog('lm', remoteTemplates as any, { authoritative: true, includeInactive: true }) as Template[]);
      setStats(data.stats || stats);
      setQuestionBank(data.questions || []);
      setExportLogs(data.exports || []);
      setTokenTransactions(data.transactions || []);
    } catch (err) {
      showToast((err as Error).message || 'Erreur de chargement', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  function openLearnerCareerPreview() {
    sessionStorage.setItem('omnia_admin_role_preview', 'apprenant');
    navigate('/dashboard/career-studio?preview=true');
  }



  const groupedRules = useMemo(() => {
    return rules
      .slice()
      .sort((a, b) => (a.group_key === b.group_key ? a.display_order - b.display_order : a.group_key.localeCompare(b.group_key)))
      .reduce<Record<string, CareerRule[]>>((acc, rule) => {
        acc[rule.group_key] = acc[rule.group_key] || [];
        acc[rule.group_key].push(rule);
        return acc;
      }, {});
  }, [rules]);

  async function saveRules() {
    setSaving(true);
    try {
      const data = await postAdmin<{ success: boolean; updated: number }>({ action: 'save_rules', rules });
      showToast(`${data.updated} règle(s) sauvegardée(s)`);
      await loadAll();
    } catch (err) {
      showToast((err as Error).message || 'Erreur de sauvegarde', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function saveTokenCosts() {
    setSaving(true);
    try {
      const [tokenData, ruleData] = await Promise.all([
        postTokenManager<{ success: boolean; updated: number }>({ action: 'update_config', configs: tokenConfig }),
        postAdmin<{ success: boolean; updated: number }>({ action: 'save_rules', rules }),
      ]);
      showToast(`${tokenData.updated} règle(s) de jetons et ${ruleData.updated} paramètre(s) généraux sauvegardés`);
      await loadAll();
    } catch (err) {
      showToast((err as Error).message || 'Erreur de sauvegarde', 'error');
    } finally {
      setSaving(false);
    }
  }


  async function saveAiConfig() {
    setSaving(true);
    try {
      const data = await postAdmin<{ success: boolean; updated: number }>({ action: 'save_ai_config', configs: aiConfig });
      showToast(`${data.updated} paramètre(s) IA sauvegardé(s)`);
      await loadAll();
    } catch (err) {
      showToast((err as Error).message || 'Erreur IA', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function saveTemplate(template: Template) {
    setSaving(true);
    try {
      await postAdmin({ action: 'save_template', template });
      showToast('Modèle sauvegardé');
      await loadAll();
    } catch (err) {
      showToast((err as Error).message || 'Erreur modèle', 'error');
    } finally {
      setSaving(false);
    }
  }


  async function uploadTemplateThumbnail(file: File) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const result = await postTemplateManager<{ success: boolean; url: string }>({
      action: 'upload_thumbnail',
      filename: file.name,
      mime: file.type || 'image/png',
      data_url: dataUrl,
    });
    setCustomTemplate((prev) => ({ ...prev, thumbnail_url: result.url }));
    showToast('Image du modèle téléversée. Elle sera utilisée comme aperçu du modèle éditable.');
  }

  async function createCompatibleTemplate(type: 'cv' | 'lm') {
    if (!customTemplate.template_key.trim() || !customTemplate.name_fr.trim()) {
      showToast('Clé et nom du template obligatoires.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        template_key: customTemplate.template_key,
        template_type: type,
        name_fr: customTemplate.name_fr,
        description_fr: customTemplate.description_fr,
        category: 'custom',
        is_free: customTemplate.is_free,
        is_active: true,
        is_ats_compatible: customTemplate.is_ats_compatible,
        display_order: (type === 'cv' ? cvTemplates : lmTemplates).length + 1,
        thumbnail_url: customTemplate.thumbnail_url || null,
        layout_config: {
          variant: customTemplate.variant,
          primary: customTemplate.primary,
          accent: customTemplate.accent,
          sidebar: customTemplate.sidebar,
          header: customTemplate.variant === 'minimal' ? 'line' : 'solid',
          photo: type === 'cv',
        },
      };
      const data = await postTemplateManager<{ template: Template }>({ action: 'upsert', template: payload });
      const setter = type === 'cv' ? setCvTemplates : setLmTemplates;
      setter(prev => [...prev.filter(t => t.template_key !== data.template.template_key), data.template].sort((a,b) => a.display_order-b.display_order));
      setShowTemplateCreator(false);
      setCustomTemplate({ template_key: '', name_fr: '', description_fr: '', thumbnail_url: '', variant: 'split', primary: '#002050', accent: '#bf8813', sidebar: '#eef3f8', is_free: true, is_ats_compatible: true });
      showToast('Modèle ajouté. Il est disponible pour les apprenants après actualisation.');
    } catch (err) {
      showToast((err as Error).message || 'Erreur template', 'error');
    } finally { setSaving(false); }
  }


  async function addInterviewQuestion() {
    if (!questionForm.question.trim()) { showToast('Veuillez saisir une question.', 'error'); return; }
    try {
      const data = await postAdmin<{question: InterviewQuestion}>({ action:'question_create', question:{...questionForm, question:questionForm.question.trim()} });
      setQuestionBank(prev => [data.question, ...prev.filter(q => q.id !== data.question.id)]);
      setQuestionForm({ category:'rh', sector:'', level:'Débutant', question:'', expected_answer:'', keywords:'', is_active:true, source:'super_admin' });
      showToast('Question enregistrée et synchronisée.');
      const refreshed = await postAdmin<{ questions?: InterviewQuestion[] }>({ action: 'get_config' });
      if (refreshed.questions) setQuestionBank(refreshed.questions);
    } catch(e) { showToast((e as Error).message || 'Erreur question','error'); }
  }
  async function toggleInterviewQuestion(id: string) {
    const q=questionBank.find(x=>x.id===id); if(!q)return;
    try { const data=await postAdmin<{question:InterviewQuestion}>({action:'question_toggle',id,is_active:!q.is_active}); setQuestionBank(prev=>prev.map(x=>x.id===id?data.question:x)); }
    catch(e){showToast((e as Error).message||'Erreur question','error')}
  }
  async function deleteInterviewQuestion(id: string) {
    try { await postAdmin({action:'question_delete',id}); setQuestionBank(prev=>prev.filter(x=>x.id!==id)); showToast('Question supprimée.'); }
    catch(e){showToast((e as Error).message||'Erreur suppression','error')}
  }

  function renderRuleInput(rule: CareerRule) {
    const current = valueFromJson(rule);
    if (rule.value_type === 'boolean') {
      return <Toggle checked={Boolean(current)} onChange={(next) => setRules((prev) => prev.map((r) => r.rule_key === rule.rule_key ? setRuleValue(r, next) : r))} />;
    }
    if (rule.value_type === 'integer' || rule.value_type === 'decimal') {
      return (
        <NumberInput
          value={Number(current || 0)}
          min={rule.min_value ?? 0}
          max={rule.max_value}
          suffix={rule.unit}
          onChange={(next) => setRules((prev) => prev.map((r) => r.rule_key === rule.rule_key ? setRuleValue(r, next) : r))}
        />
      );
    }
    if (rule.value_type === 'select') {
      return (
        <select
          value={String(current || '')}
          onChange={(e) => setRules((prev) => prev.map((r) => r.rule_key === rule.rule_key ? setRuleValue(r, e.target.value) : r))}
          className="h-10 rounded-lg border px-3 text-sm font-semibold outline-none focus:border-[#002050]"
          style={{ borderColor: BORDER, color: OMNIA_BLUE }}
        >
          {(rule.options_json || []).map((option: any) => (
            <option key={String(option.value ?? option)} value={String(option.value ?? option)}>{option.label ?? option.value ?? option}</option>
          ))}
        </select>
      );
    }
    return (
      <input
        type="text"
        value={String(current || '')}
        onChange={(e) => setRules((prev) => prev.map((r) => r.rule_key === rule.rule_key ? setRuleValue(r, e.target.value) : r))}
        className="h-10 w-52 rounded-lg border px-3 text-sm font-semibold outline-none focus:border-[#002050]"
        style={{ borderColor: BORDER, color: OMNIA_BLUE }}
      />
    );
  }

  function renderTemplateTable(items: Template[], type: 'cv' | 'lm') {
    const setItems = type === 'cv' ? setCvTemplates : setLmTemplates;
    return (
      <div className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: BORDER }}>
        <div className="grid grid-cols-12 gap-4 border-b px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ background: '#F8FAFC', borderColor: BORDER, color: MUTED }}>
          <div className="col-span-1">Ordre</div>
          <div className="col-span-4">Modèle</div>
          <div className="col-span-2">Catégorie</div>
          <div className="col-span-1 text-center">Premium</div>
          <div className="col-span-1 text-center">Actif</div>
          <div className="col-span-1 text-center">ATS</div>
          <div className="col-span-2 text-right">Action</div>
        </div>
        {items.map((template, index) => (
          <div key={template.template_key} className="grid grid-cols-12 items-center gap-4 border-b px-5 py-4 text-sm last:border-b-0" style={{ borderColor: BORDER, opacity: template.is_active ? 1 : .58 }}>
            <div className="col-span-1">
              <input
                type="number"
                value={template.display_order}
                onChange={(e) => setItems((prev) => prev.map((t) => t.template_key === template.template_key ? { ...t, display_order: Number(e.target.value || 0) } : t))}
                className="w-14 rounded-lg border px-2 py-1.5 text-center text-xs font-semibold"
                style={{ borderColor: BORDER }}
              />
            </div>
            <div className="col-span-4 min-w-0">
              <input
                value={template.name_fr}
                onChange={(e) => setItems((prev) => prev.map((t) => t.template_key === template.template_key ? { ...t, name_fr: e.target.value } : t))}
                className="w-full bg-transparent text-sm font-semibold outline-none"
                style={{ color: OMNIA_BLUE }}
              />
              <p className="truncate text-xs" style={{ color: MUTED }}>{template.template_key}</p>
            </div>
            <div className="col-span-2">
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium" style={{ color: MUTED }}>{CATEGORY_LABELS[template.category] || template.category}</span>
            </div>
            <div className="col-span-1 flex justify-center"><Toggle checked={!template.is_free} onChange={(premium) => setItems((prev) => prev.map((t) => t.template_key === template.template_key ? { ...t, is_free: !premium } : t))} /></div>
            <div className="col-span-1 flex justify-center"><Toggle checked={template.is_active} onChange={(v) => setItems((prev) => prev.map((t) => t.template_key === template.template_key ? { ...t, is_active: v } : t))} /></div>
            <div className="col-span-1 flex justify-center">
              <button type="button" onClick={() => setItems((prev) => prev.map((t) => t.template_key === template.template_key ? { ...t, is_ats_compatible: !t.is_ats_compatible } : t))}>
                {template.is_ats_compatible ? <Check size={16} style={{ color: '#16A34A' }} /> : <X size={16} className="text-slate-300" />}
              </button>
            </div>
            <div className="col-span-2 text-right">
              <button onClick={() => saveTemplate(template)} disabled={saving} className="rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" style={{ background: OMNIA_BLUE }}>Sauvegarder</button>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="p-8 text-center text-sm text-slate-500">Aucun modèle trouvé.</div>}
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="mx-auto max-w-[1540px] px-4 py-6 md:px-6 md:py-8">
        {toast && (
          <div className="fixed right-5 top-5 z-50 border bg-white px-5 py-3 text-sm font-semibold shadow-lg" style={{ borderColor: toast.type === 'success' ? '#BBF7D0' : '#FECACA', color: toast.type === 'success' ? '#166534' : '#DC2626' }}>
            {toast.text}
          </div>
        )}

        <header className="border border-slate-200 bg-white">
          <div className="flex flex-col gap-6 px-6 py-7 lg:flex-row lg:items-end lg:justify-between lg:px-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#BF8813]">Carrière & projets · Career Studio</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.035em] text-[#002050]">Gestion Omnia Career Studio</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Règles, modèles CV/LM, jetons, exports, banque de questions et activité Career dans un espace de gestion unique.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={openLearnerCareerPreview} className="inline-flex items-center gap-2 border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-[#002050] transition hover:bg-slate-50">
                <ExternalLink size={15} /> Ouvrir le Studio
              </button>
              <button onClick={loadAll} disabled={loading} className="inline-flex items-center gap-2 bg-[#002050] px-3.5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Actualiser
              </button>
            </div>
          </div>
          <div className="h-1 bg-[linear-gradient(90deg,#002050_0%,#3157A4_42%,#BF8813_100%)]" />
        </header>

        <nav className="mt-5 flex items-center gap-1 overflow-x-auto border-y border-slate-200 bg-white px-2 py-2" aria-label="Gestion Career Studio">
          {SUB_MENUS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setSubTab(key)}
              className={`inline-flex min-h-10 min-w-max items-center gap-2 px-3 text-xs font-bold transition ${subTab === key ? 'bg-[#002050] text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-[#002050]'}`}
            >
              <Icon size={14} style={{ color: subTab === key ? '#E9C46A' : '#94A3B8' }} />
              {label}
            </button>
          ))}
        </nav>

        <div className="mt-6 space-y-6">
          {loading && (
            <div className="rounded-2xl border bg-white p-8 text-center text-sm" style={{ borderColor: BORDER, color: MUTED }}>Chargement des paramètres Omnia Career...</div>
          )}

          {!loading && subTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-x-7 gap-y-2 border-y py-3 text-sm" style={{ borderColor: BORDER }}>
                <Link to="/admin/career-studio/details/cv" className="font-medium hover:underline"><strong style={{color:OMNIA_BLUE}}>{stats.total_cv}</strong> CV apprenants</Link>
                <Link to="/admin/career-studio/details/lm" className="font-medium hover:underline"><strong style={{color:OMNIA_BLUE}}>{stats.total_lm}</strong> LM apprenants</Link>
                <Link to="/admin/career-studio/details/creators" className="font-medium hover:underline"><strong style={{color:OMNIA_BLUE}}>{stats.unique_creators}</strong> créateurs</Link>
                <Link to="/admin/career-studio/details/active-30d" className="font-medium hover:underline"><strong style={{color:OMNIA_BLUE}}>{stats.active_users_30d}</strong> actifs sur 30 jours</Link>
                <Link to="/admin/career-studio/details/exports" className="font-medium hover:underline"><strong style={{color:OMNIA_BLUE}}>{stats.total_exports}</strong> exports</Link>
                <Link to="/admin/career-studio/details/tokens" className="font-medium hover:underline"><strong style={{color:OMNIA_GOLD}}>{stats.tokens_consumed}</strong> jetons consommés</Link>
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
                <section className="border-t" style={{borderColor:BORDER}}>
                  <div className="flex items-center justify-between border-b py-3" style={{borderColor:BORDER}}>
                    <h2 className="font-semibold" style={{color:OMNIA_BLUE}}>Activité réelle Career Studio</h2>
                    <button onClick={()=>setSubTab('stats')} className="text-xs font-semibold" style={{color:OMNIA_GOLD}}>Voir les statistiques</button>
                  </div>
                  {tokenTransactions.slice(0,8).map((tx:any)=><div key={tx.id} className="flex items-center justify-between border-b py-3 text-sm" style={{borderColor:BORDER}}><div><p className="font-medium" style={{color:OMNIA_BLUE}}>{tx.reason||tx.transaction_type||'Mouvement de jetons'}</p><p className="text-xs" style={{color:MUTED}}>{tx.created_at?new Date(tx.created_at).toLocaleString('fr-FR'):'—'}</p></div><strong style={{color:Number(tx.amount)<0?'#B91C1C':'#15803D'}}>{Number(tx.amount)>0?'+':''}{Number(tx.amount||0)}</strong></div>)}
                  {tokenTransactions.length===0&&<p className="py-6 text-sm" style={{color:MUTED}}>Aucune activité Career enregistrée.</p>}
                </section>

                <section className="border-t" style={{borderColor:BORDER}}>
                  <h2 className="border-b py-3 font-semibold" style={{color:OMNIA_BLUE,borderColor:BORDER}}>État opérationnel</h2>
                  {[
                    ['Questions entretien actives', stats.active_questions],
                    ['Modèles CV actifs', stats.active_cv_templates],
                    ['Modèles LM actifs', stats.active_lm_templates],
                    ['Exports réussis', stats.export_success],
                    ['Exports échoués', stats.export_failed],
                  ].map(([label,value])=><div key={String(label)} className="flex justify-between border-b py-3 text-sm" style={{borderColor:BORDER}}><span style={{color:MUTED}}>{label}</span><strong style={{color:OMNIA_BLUE}}>{value}</strong></div>)}
                </section>
              </div>

              <div className="border-t pt-4" style={{borderColor:BORDER}}>
                <div className="rounded-2xl border p-4" style={{borderColor:BORDER,background:'#F8FAFC'}}><h2 className="font-semibold" style={{color:OMNIA_BLUE}}>Coûts Career</h2><p className="mt-1 text-sm" style={{color:MUTED}}>Configurez les coûts associés aux actions Career.</p><button onClick={()=>setSubTab('packs')} className="mt-3 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{background:OMNIA_BLUE}}>Configurer les jetons</button></div>
              </div>
            </div>
          )}

          {!loading && subTab === 'rules' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold" style={{ color: OMNIA_BLUE }}>Règles & Prix modifiables</h2>
                  <p className="mt-1 text-sm" style={{ color: MUTED }}>Ces paramètres contrôlent Omnia Career sans recoder. Les modèles restent accessibles tant que vous ne les marquez pas Premium et que leur mode d’accès n’est pas activé.</p>
                </div>
                <button onClick={saveRules} disabled={saving} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: OMNIA_BLUE }}>
                  <Save size={15} /> Sauvegarder
                </button>
              </div>
              <section className="border-y py-4" style={{borderColor:BORDER}}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><h3 className="font-semibold" style={{color:OMNIA_BLUE}}>Gains et dépenses en jetons</h3><p className="mt-1 text-sm" style={{color:MUTED}}>Choisissez les méthodes de gain, les plafonds et le coût de chaque action.</p></div>
                  <button onClick={()=>setSubTab('packs')} className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{background:OMNIA_BLUE}}>Configurer les coûts</button>
                </div>
                <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{tokenConfig.filter(cfg => cfg.metadata?.hidden !== true).map(cfg=><div key={cfg.config_key} className="flex justify-between border-b py-2 text-sm" style={{borderColor:BORDER}}><span style={{color:MUTED}}>{cfg.description_fr||cfg.config_key}</span><strong style={{color:OMNIA_BLUE}}>{cfg.config_value} {cfg.value_unit||'jeton(s)'}</strong></div>)}</div>
              </section>
              {Object.entries(groupedRules).map(([group, items]) => (
                <section key={group} className="rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}>
                  <h3 className="text-lg font-semibold" style={{ color: OMNIA_BLUE }}>{GROUP_LABELS[group] || group}</h3>
                  <div className="mt-4 space-y-3">
                    {items.map((rule) => (
                      <div key={rule.rule_key} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4" style={{ borderColor: BORDER, background: '#F8FAFC' }}>
                        <div className="min-w-[260px] flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{rule.label_fr}</p>
                            {!rule.is_active && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-500">Inactif</span>}
                          </div>
                          <p className="mt-1 text-xs leading-5" style={{ color: MUTED }}>{rule.description_fr || rule.rule_key}</p>
                        </div>
                        <div>{renderRuleInput(rule)}</div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {!loading && subTab === 'packs' && (
            <CareerTokenGovernancePanel
              configs={tokenConfig}
              globalRules={rules.filter(rule => [
                'career_token_earning_enabled',
                'career_token_spending_enabled',
                'career_premium_templates_enabled',
              ].includes(rule.rule_key)) as CareerTokenGlobalRule[]}
              saving={saving}
              onChange={setTokenConfig}
              onGlobalRulesChange={(globalRules) => setRules(current => current.map(rule =>
                globalRules.find(globalRule => globalRule.rule_key === rule.rule_key) || rule
              ))}
              onSave={saveTokenCosts}
            />
          )}


          {!loading && (subTab === 'cv_templates' || subTab === 'lm_templates') && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold" style={{ color: OMNIA_BLUE }}>{subTab === 'cv_templates' ? 'Modèles de CV' : 'Modèles de lettres de motivation'}</h2>
                <p className="mt-1 text-sm" style={{ color: MUTED }}>Tous les modèles sont accessibles par défaut. Activez « Premium » uniquement pour les modèles que vous souhaitez réserver à une règle d’accès future, y compris les nouveaux modèles.</p>
              </div>

              <div className="rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold" style={{ color: OMNIA_BLUE }}>Ajouter un template compatible</h3>
                    <p className="mt-1 text-xs" style={{ color: MUTED }}>Le template utilise le moteur éditable Omnia : contenu, couleurs, polices, aperçu et PDF restent modifiables.</p>
                  </div>
                  <button type="button" onClick={() => setShowTemplateCreator(v => !v)} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: OMNIA_GOLD }}><Plus size={15}/>{showTemplateCreator ? 'Fermer' : 'Nouveau template'}</button>
                </div>
                {showTemplateCreator && (
                  <div className="mt-5 grid grid-cols-1 gap-4 border-t pt-5 md:grid-cols-2" style={{ borderColor: BORDER }}>
                    <label className="text-xs font-semibold" style={{ color: MUTED }}>Clé technique
                      <input value={customTemplate.template_key} onChange={e=>setCustomTemplate(v=>({...v,template_key:e.target.value}))} placeholder={subTab==='cv_templates'?'cv_mon_modele':'lm_mon_modele'} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" style={{borderColor:BORDER}}/>
                    </label>
                    <label className="text-xs font-semibold" style={{ color: MUTED }}>Nom affiché
                      <input value={customTemplate.name_fr} onChange={e=>setCustomTemplate(v=>({...v,name_fr:e.target.value}))} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" style={{borderColor:BORDER}}/>
                    </label>
                    <label className="text-xs font-semibold md:col-span-2" style={{ color: MUTED }}>Description
                      <input value={customTemplate.description_fr} onChange={e=>setCustomTemplate(v=>({...v,description_fr:e.target.value}))} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" style={{borderColor:BORDER}}/>
                    </label>
                    <label className="text-xs font-semibold" style={{ color: MUTED }}>Mise en page
                      <select value={customTemplate.variant} onChange={e=>setCustomTemplate(v=>({...v,variant:e.target.value}))} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" style={{borderColor:BORDER}}>
                        <option value="split">Deux colonnes</option><option value="band">Bandeau supérieur</option><option value="minimal">Minimal ATS</option><option value="timeline">Chronologie</option><option value="cards">Blocs</option><option value="executive">Executive</option><option value="creative">Créatif</option><option value="tech">Tech sombre</option><option value="academic">Académique</option><option value="hospitality">Hospitality</option><option value="qhse">QHSE</option><option value="compact">Compact</option>
                      </select>
                    </label>
                    <div>
                      <label className="text-xs font-semibold" style={{ color: MUTED }}>Image d’aperçu du modèle</label>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <label className="cursor-pointer rounded-xl border px-3 py-2 text-sm font-semibold" style={{borderColor:BORDER,color:OMNIA_BLUE}}>Joindre une image<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{setSaving(true);await uploadTemplateThumbnail(file);}catch(err){showToast((err as Error).message||'Téléversement impossible','error')}finally{setSaving(false)}}}/></label>
                        <input value={customTemplate.thumbnail_url} onChange={e=>setCustomTemplate(v=>({...v,thumbnail_url:e.target.value}))} placeholder="ou URL d’image" className="min-w-[220px] flex-1 rounded-xl border px-3 py-2 text-sm" style={{borderColor:BORDER}}/>
                      </div>
                      {customTemplate.thumbnail_url&&<img src={customTemplate.thumbnail_url} alt="Aperçu modèle" className="mt-3 h-28 max-w-full rounded-lg border object-contain p-2" style={{borderColor:BORDER}}/>}
                      <p className="mt-2 text-xs" style={{color:MUTED}}>L’image sert d’aperçu. Le modèle reste entièrement éditable grâce à la mise en page Omnia sélectionnée ci-dessus.</p>
                    </div>
                    <div className="flex flex-wrap gap-4 md:col-span-2">
                      {[['primary','Couleur principale'],['accent','Accent'],['sidebar','Colonne']].map(([key,label])=><label key={key} className="text-xs font-semibold" style={{color:MUTED}}>{label}<input type="color" value={(customTemplate as any)[key]} onChange={e=>setCustomTemplate(v=>({...v,[key]:e.target.value}))} className="ml-2 h-9 w-12 rounded border align-middle" style={{borderColor:BORDER}}/></label>)}
                      <label className="flex items-center gap-2 text-xs font-semibold" style={{color:MUTED}}><input type="checkbox" checked={!customTemplate.is_free} onChange={e=>setCustomTemplate(v=>({...v,is_free:!e.target.checked}))}/> Premium</label>
                      <label className="flex items-center gap-2 text-xs font-semibold" style={{color:MUTED}}><input type="checkbox" checked={customTemplate.is_ats_compatible} onChange={e=>setCustomTemplate(v=>({...v,is_ats_compatible:e.target.checked}))}/> Compatible ATS</label>
                    </div>
                    <div className="md:col-span-2 flex justify-end"><button type="button" disabled={saving} onClick={()=>createCompatibleTemplate(subTab==='cv_templates'?'cv':'lm')} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{background:OMNIA_BLUE}}>Créer et publier</button></div>
                  </div>
                )}
              </div>
              {renderTemplateTable(subTab === 'cv_templates' ? cvTemplates : lmTemplates, subTab === 'cv_templates' ? 'cv' : 'lm')}
            </div>
          )}

          {!loading && subTab === 'ai' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold" style={{ color: OMNIA_BLUE }}>Paramètres IA</h2>
                  <p className="mt-1 text-sm" style={{ color: MUTED }}>Activez l’IA, ajustez les limites et les coûts liés aux suggestions CV/LM.</p>
                </div>
                <button onClick={saveAiConfig} disabled={saving} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: OMNIA_BLUE }}><Save size={15} /> Sauvegarder</button>
              </div>
              <div className="border-y py-4 text-sm" style={{borderColor:BORDER,color:MUTED}}>
                <p><strong style={{color:OMNIA_BLUE}}>Fonctionnement :</strong> l’IA assiste la rédaction, l’adaptation à une offre, l’analyse ATS, la traduction et la reformulation. Les interrupteurs activent chaque capacité ; les limites quotidiennes/mensuelles protègent les coûts ; les coûts en jetons restent définis dans la section Coûts en jetons. Désactiver une capacité ici doit la rendre indisponible côté apprenant.</p>
              </div>
              <div className="rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {aiConfig.map((cfg) => {
                    const isBool = cfg.config_value === 'true' || cfg.config_value === 'false';
                    const numeric = !isBool && cfg.config_value !== '' && !Number.isNaN(Number(cfg.config_value));
                    return (
                      <div key={cfg.config_key} className="flex items-center justify-between rounded-xl border p-4" style={{ borderColor: BORDER, background: '#F8FAFC' }}>
                        <div className="min-w-0 flex-1 pr-3">
                          <p className="text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{cfg.description_fr || cfg.config_key}</p>
                          <p className="text-xs" style={{ color: MUTED }}>{cfg.config_key}</p>
                        </div>
                        {isBool ? (
                          <Toggle checked={cfg.config_value === 'true'} onChange={(v) => setAiConfig((prev) => prev.map((c) => c.config_key === cfg.config_key ? { ...c, config_value: String(v) } : c))} />
                        ) : numeric ? (
                          <NumberInput value={Number(cfg.config_value)} onChange={(v) => setAiConfig((prev) => prev.map((c) => c.config_key === cfg.config_key ? { ...c, config_value: String(v) } : c))} />
                        ) : (
                          <input value={cfg.config_value} onChange={(e) => setAiConfig((prev) => prev.map((c) => c.config_key === cfg.config_key ? { ...c, config_value: e.target.value } : c))} className="h-10 w-48 rounded-lg border px-3 text-sm outline-none focus:border-[#002050]" style={{ borderColor: BORDER }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}


          {!loading && subTab === 'question_bank' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold" style={{ color: OMNIA_BLUE }}>Banque officielle de questions</h2>
                  <p className="mt-1 text-sm" style={{ color: MUTED }}>
                    Créez les questions RH, techniques, métier et STAR utilisées dans la préparation entretien. L’IA peut ensuite personnaliser ces bases selon une offre et le CV de l’apprenant.
                  </p>
                </div>
                <span className="rounded-full px-3 py-1.5 text-xs font-bold" style={{ background: `${OMNIA_BLUE}10`, color: OMNIA_BLUE }}>
                  {questionBank.filter(q => q.is_active).length} question(s) active(s)
                </span>
              </div>

              <div className="rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}>
                <h3 className="text-lg font-semibold" style={{ color: OMNIA_BLUE }}>Ajouter une question</h3>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold" style={{ color: MUTED }}>Catégorie</span>
                    <select value={questionForm.category} onChange={(e) => setQuestionForm({ ...questionForm, category: e.target.value as InterviewQuestion['category'] })} className="h-11 w-full rounded-xl border px-3 text-sm" style={{ borderColor: BORDER }}>
                      <option value="rh">RH</option>
                      <option value="technique">Technique</option>
                      <option value="metier">Métier</option>
                      <option value="sectorielle">Sectorielle</option>
                      <option value="star">Méthode STAR</option>
                      <option value="offre">Liée à une offre</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold" style={{ color: MUTED }}>Secteur</span>
                    <input value={questionForm.sector || ''} onChange={(e) => setQuestionForm({ ...questionForm, sector: e.target.value })} placeholder="QSE, Data, Finance..." className="h-11 w-full rounded-xl border px-3 text-sm" style={{ borderColor: BORDER }} />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold" style={{ color: MUTED }}>Niveau</span>
                    <select value={questionForm.level || 'Débutant'} onChange={(e) => setQuestionForm({ ...questionForm, level: e.target.value })} className="h-11 w-full rounded-xl border px-3 text-sm" style={{ borderColor: BORDER }}>
                      <option>Débutant</option><option>Intermédiaire</option><option>Avancé</option><option>Tous niveaux</option>
                    </select>
                  </label>
                  <label className="flex items-end gap-2 rounded-xl border p-3" style={{ borderColor: BORDER }}>
                    <input type="checkbox" checked={questionForm.is_active} onChange={(e) => setQuestionForm({ ...questionForm, is_active: e.target.checked })} />
                    <span className="text-sm font-semibold" style={{ color: OMNIA_BLUE }}>Active</span>
                  </label>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold" style={{ color: MUTED }}>Question</span>
                    <textarea rows={4} value={questionForm.question} onChange={(e) => setQuestionForm({ ...questionForm, question: e.target.value })} placeholder="Exemple : Expliquez une situation où vous avez appliqué la méthode PDCA." className="w-full rounded-xl border px-3 py-2 text-sm" style={{ borderColor: BORDER }} />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold" style={{ color: MUTED }}>Réponse attendue / critères</span>
                    <textarea rows={4} value={questionForm.expected_answer || ''} onChange={(e) => setQuestionForm({ ...questionForm, expected_answer: e.target.value })} placeholder="Éléments attendus, mots-clés, structure STAR..." className="w-full rounded-xl border px-3 py-2 text-sm" style={{ borderColor: BORDER }} />
                  </label>
                </div>
                <label className="mt-4 block">
                  <span className="mb-1.5 block text-xs font-semibold" style={{ color: MUTED }}>Mots-clés</span>
                  <input value={questionForm.keywords || ''} onChange={(e) => setQuestionForm({ ...questionForm, keywords: e.target.value })} placeholder="ISO 9001, audit, Excel, conformité..." className="h-11 w-full rounded-xl border px-3 text-sm" style={{ borderColor: BORDER }} />
                </label>
                <div className="mt-5 flex justify-end">
                  <button onClick={addInterviewQuestion} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: OMNIA_BLUE }}>
                    <Plus size={15} /> Ajouter à la banque
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}>
                <h3 className="text-lg font-semibold" style={{ color: OMNIA_BLUE }}>Questions enregistrées</h3>
                {questionBank.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed p-8 text-center text-sm" style={{ borderColor: BORDER, color: MUTED }}>
                    Aucune question officielle pour le moment. Ajoutez vos premières questions depuis ce formulaire.
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {questionBank.map((q) => (
                      <div key={q.id} className="rounded-xl border p-4" style={{ borderColor: BORDER, background: q.is_active ? '#FFFFFF' : '#F8FAFC' }}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex flex-wrap gap-2">
                              <span className="rounded-full px-2 py-1 text-[11px] font-bold" style={{ background: `${OMNIA_BLUE}10`, color: OMNIA_BLUE }}>{q.category}</span>
                              {q.sector && <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">{q.sector}</span>}
                              {q.level && <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">{q.level}</span>}
                            </div>
                            <p className="text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{q.question}</p>
                            {q.expected_answer && <p className="mt-2 text-xs leading-5" style={{ color: MUTED }}>{q.expected_answer}</p>}
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => toggleInterviewQuestion(q.id)} className="rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: BORDER, color: q.is_active ? '#16A34A' : MUTED }}>{q.is_active ? 'Active' : 'Inactive'}</button>
                            <button onClick={() => deleteInterviewQuestion(q.id)} className="rounded-lg border px-3 py-2 text-xs font-semibold text-red-600" style={{ borderColor: BORDER }}>Supprimer</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {!loading && subTab === 'exports' && (<div className="overflow-hidden border-y bg-white" style={{borderColor:BORDER}}><div className="border-b py-5" style={{borderColor:BORDER}}><h2 className="text-xl font-semibold" style={{color:OMNIA_BLUE}}>Exports CV & lettres de motivation</h2><p className="mt-1 text-sm" style={{color:MUTED}}>Uniquement les CV et LM réellement exportés par les apprenants.</p></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs" style={{borderColor:BORDER,color:MUTED}}><th className="py-3 pr-4">Apprenant</th><th className="py-3 pr-4">Type</th><th className="py-3 pr-4">Document</th><th className="py-3 pr-4">Jetons</th><th className="py-3 pr-4">Statut</th><th className="py-3">Date</th></tr></thead><tbody>{exportLogs.map((e:any)=><tr key={e.id} className="border-b" style={{borderColor:BORDER}}><td className="py-3 pr-4"><p className="font-medium" style={{color:OMNIA_BLUE}}>{e.user_name||'—'}</p><p className="text-xs" style={{color:MUTED}}>{e.user_email||''}</p></td><td className="py-3 pr-4 uppercase">{e.doc_type||e.export_type||'Document'}</td><td className="py-3 pr-4">{e.document_title||e.document_id||e.career_document_id||'—'}</td><td className="py-3 pr-4">{e.tokens_consumed??e.token_cost??'—'}</td><td className="py-3 pr-4">{e.status||'Réussi'}</td><td className="py-3">{e.created_at?new Date(e.created_at).toLocaleString('fr-FR'):'—'}</td></tr>)}{exportLogs.length===0&&<tr><td colSpan={6} className="py-8 text-center" style={{color:MUTED}}>Aucun export apprenant enregistré.</td></tr>}</tbody></table></div></div>)}

          {!loading && subTab === 'stats' && (
            <div className="space-y-6">
              <div><h2 className="text-xl font-semibold" style={{color:OMNIA_BLUE}}>Statistiques réelles Omnia Career Studio</h2><p className="mt-1 text-sm" style={{color:MUTED}}>Ces données proviennent des documents, exports, transactions de jetons, commandes payées et modèles réellement utilisés.</p></div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {[
                  ['CV créés par apprenants',stats.total_cv],['LM créées par apprenants',stats.total_lm],['Créateurs uniques',stats.unique_creators],['Actifs 30 jours',stats.active_users_30d],
                  ['Exports réussis',stats.export_success],['Exports échoués',stats.export_failed],['Actions IA identifiées',stats.ai_actions],['Questions actives',stats.active_questions],
                  ['Jetons consommés',stats.tokens_consumed],['Jetons crédités',stats.tokens_credited],['Anciens achats archivés',stats.token_sales_count],['CA historique jetons XOF',Number(stats.token_revenue_xof||0).toLocaleString('fr-FR')],
                ].map(([label,value])=><div key={String(label)} className="border-b py-3"><p className="text-xs" style={{color:MUTED}}>{label}</p><p className="mt-1 text-xl font-semibold" style={{color:OMNIA_BLUE}}>{value}</p></div>)}
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <section className="border-t" style={{borderColor:BORDER}}><h3 className="border-b py-3 font-semibold" style={{color:OMNIA_BLUE,borderColor:BORDER}}>Modèles les plus utilisés</h3>{stats.top_templates?.length?stats.top_templates.map(item=><div key={item.template_key} className="flex justify-between border-b py-3 text-sm" style={{borderColor:BORDER}}><span>{item.name_fr}<span className="ml-2 text-xs uppercase" style={{color:MUTED}}>{item.template_type}</span></span><strong>{item.usage_count}</strong></div>):<p className="py-6 text-sm" style={{color:MUTED}}>Aucune utilisation de modèle enregistrée.</p>}</section>
                <section className="border-t" style={{borderColor:BORDER}}><h3 className="border-b py-3 font-semibold" style={{color:OMNIA_BLUE,borderColor:BORDER}}>Synthèse des modèles disponibles</h3><div className="flex justify-between border-b py-3 text-sm" style={{borderColor:BORDER}}><span>CV actifs</span><strong>{stats.active_cv_templates}</strong></div><div className="flex justify-between border-b py-3 text-sm" style={{borderColor:BORDER}}><span>LM actifs</span><strong>{stats.active_lm_templates}</strong></div><div className="flex justify-between border-b py-3 text-sm" style={{borderColor:BORDER}}><span>Anciens jetons vendus (historique)</span><strong>{stats.tokens_sold}</strong></div></section>
              </div>
            </div>
          )}

          {!loading && rules.length === 0 && (
            <div className="rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}>
              <div className="flex items-center gap-3 text-sm" style={{ color: '#92400E' }}><AlertCircle size={17} /> Aucune règle n’est configurée. Vérifiez les paramètres de Career Studio.</div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
