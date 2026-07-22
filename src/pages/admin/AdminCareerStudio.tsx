import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CV_TEMPLATES_META, LM_TEMPLATES_META } from '../../lib/careerStudioData';
import {
  AlertCircle,
  ArrowLeft,
  BarChart2,
  Check,
  Coins,
  Download,
  Eye,
  EyeOff,
  FileText,
  Mail,
  MessageSquare,
  Plus,
  RefreshCw,
  Save,
  Settings,
  ShieldCheck,
  Sparkles,
  ToggleLeft,
  Trash2,
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

type TokenConfig = {
  id?: string;
  config_key: string;
  config_value: number;
  description_fr?: string | null;
  config_group?: string | null;
  min_value?: number | null;
  max_value?: number | null;
  value_unit?: string | null;
  display_order?: number | null;
  is_active: boolean;
};

type TokenPack = {
  id?: string;
  pack_key: string;
  name_fr: string;
  description_fr?: string | null;
  tokens: number;
  bonus_tokens: number;
  price_xof: number;
  price_eur?: number | null;
  currency_code?: string | null;
  is_popular: boolean;
  is_active: boolean;
  display_order: number;
};

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
  total_exports: number;
  tokens_consumed: number;
  active_templates: number;
  active_packs: number;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

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
  { key: 'packs', label: 'Jetons & Packs', icon: Coins },
  { key: 'cv_templates', label: 'Modèles CV', icon: FileText },
  { key: 'lm_templates', label: 'Modèles LM', icon: Mail },
  { key: 'ai', label: 'IA & Automatisation', icon: Sparkles },
  { key: 'question_bank', label: 'Banque questions', icon: MessageSquare },
  { key: 'exports', label: 'Exports', icon: Download },
  { key: 'stats', label: 'Statistiques', icon: BarChart2 },
] as { key: SubTab; label: string; icon: typeof BarChart2 }[];

function token() {
  return localStorage.getItem('omnia_session_token') || '';
}

async function postAdmin<T>(body: unknown): Promise<T> {
  if (!SUPABASE_URL) throw new Error('VITE_SUPABASE_URL manquant');
  const res = await fetch(`${SUPABASE_URL}/functions/v1/career-studio-admin-config`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token()}`,
      apikey: ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data?.message || data?.error || `Erreur ${res.status}`);
  return data as T;
}

async function postTokenManager<T>(body: unknown): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/career-token-manage`, {
    method: 'POST', headers: { Authorization: `Bearer ${token()}`, apikey: ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
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
        className="absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform"
        style={{ transform: checked ? 'translateX(23px)' : 'translateX(4px)' }}
      />
    </button>
  );
}


async function postTemplateManager<T>(body: unknown): Promise<T> {
  if (!SUPABASE_URL) throw new Error('VITE_SUPABASE_URL manquant');
  const res = await fetch(`${SUPABASE_URL}/functions/v1/career-template-manager`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token()}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || 'Erreur template');
  return data as T;
}

export default function AdminCareerStudio() {
  const [subTab, setSubTab] = useState<SubTab>('dashboard');
  const [rules, setRules] = useState<CareerRule[]>([]);
  const [tokenConfig, setTokenConfig] = useState<TokenConfig[]>([]);
  const [tokenPacks, setTokenPacks] = useState<TokenPack[]>([]);
  const [aiConfig, setAiConfig] = useState<AiConfig[]>([]);
  const [cvTemplates, setCvTemplates] = useState<Template[]>([]);
  const [lmTemplates, setLmTemplates] = useState<Template[]>([]);
  const [showTemplateCreator, setShowTemplateCreator] = useState(false);
  const [customTemplate, setCustomTemplate] = useState({ template_key: '', name_fr: '', description_fr: '', thumbnail_url: '', variant: 'split', primary: '#002050', accent: '#bf8813', sidebar: '#eef3f8', is_free: true, is_ats_compatible: true });
  const [stats, setStats] = useState<AdminStats>({ total_cv: 0, total_lm: 0, total_exports: 0, tokens_consumed: 0, active_templates: 0, active_packs: 0 });
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
        token_packs: TokenPack[];
        ai_config: AiConfig[];
        templates: Template[];
        stats: AdminStats;
        questions?: InterviewQuestion[];
        exports?: any[];
        transactions?: any[];
      }>({ action: 'get_config' });
      setRules(data.rules || []);
      setTokenConfig(data.token_config || []);
      setTokenPacks(data.token_packs || []);
      setAiConfig(data.ai_config || []);
      let customTemplates: Template[] = [];
      try {
        const custom = await postTemplateManager<{ templates: Template[] }>({ action: 'list' });
        customTemplates = (custom.templates || []).filter(t => t.is_custom);
      } catch { customTemplates = []; }
      const builtins = [...CV_TEMPLATES_META, ...LM_TEMPLATES_META].map(t => ({ ...t, is_active: true } as Template));
      const merged = [...builtins, ...customTemplates.filter(c => !builtins.some(b => b.template_key === c.template_key))];
      setCvTemplates(merged.filter(t => t.template_type === 'cv').sort((a,b)=>a.display_order-b.display_order));
      setLmTemplates(merged.filter(t => t.template_type === 'lm').sort((a,b)=>a.display_order-b.display_order));
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
      showToast(`✅ ${data.updated} règle(s) sauvegardée(s)`);
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
      const data = await postTokenManager<{ success: boolean; updated: number }>({ action: 'update_config', configs: tokenConfig });
      showToast(`✅ ${data.updated} coût(s) sauvegardé(s)`);
      await loadAll();
    } catch (err) {
      showToast((err as Error).message || 'Erreur de sauvegarde', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function saveTokenPack(pack: TokenPack) {
    setSaving(true);
    try {
      await postTokenManager({ action: 'update_pack', pack_id: pack.id, pack_key: pack.pack_key, name_fr: pack.name_fr, tokens: pack.tokens, price_xof: pack.price_xof, is_active: pack.is_active, is_popular: pack.is_popular, bonus_tokens: pack.bonus_tokens, display_order: pack.display_order });
      showToast('✅ Pack sauvegardé');
      await loadAll();
    } catch (err) {
      showToast((err as Error).message || 'Erreur pack', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function saveAiConfig() {
    setSaving(true);
    try {
      const data = await postAdmin<{ success: boolean; updated: number }>({ action: 'save_ai_config', configs: aiConfig });
      showToast(`✅ ${data.updated} paramètre(s) IA sauvegardé(s)`);
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
      showToast('✅ Modèle sauvegardé');
      await loadAll();
    } catch (err) {
      showToast((err as Error).message || 'Erreur modèle', 'error');
    } finally {
      setSaving(false);
    }
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
      showToast('✅ Template compatible ajouté. Il sera visible par les apprenants après actualisation.');
    } catch (err) {
      showToast((err as Error).message || 'Erreur template', 'error');
    } finally { setSaving(false); }
  }


  async function addInterviewQuestion() {
    if (!questionForm.question.trim()) { showToast('Veuillez saisir une question.', 'error'); return; }
    try {
      const data = await postAdmin<{question: InterviewQuestion}>({ action:'question_create', question:{...questionForm, question:questionForm.question.trim()} });
      setQuestionBank(prev => [data.question, ...prev]);
      setQuestionForm({ category:'rh', sector:'', level:'Débutant', question:'', expected_answer:'', keywords:'', is_active:true, source:'super_admin' });
      showToast('✅ Question enregistrée et synchronisée.');
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
          <div className="col-span-1 text-center">Gratuit</div>
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
            <div className="col-span-1 flex justify-center"><Toggle checked={template.is_free} onChange={(v) => setItems((prev) => prev.map((t) => t.template_key === template.template_key ? { ...t, is_free: v } : t))} /></div>
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
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      <header className="sticky top-0 z-40 border-b bg-white" style={{ borderColor: BORDER }}>
        <div className="flex min-h-16 items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-3">
            <img src="/omnia-sidebar-logo.png" alt="Omnia" className="h-10 w-10 rounded-lg object-contain" />
            <div><p className="text-base font-bold leading-tight" style={{color:OMNIA_BLUE}}>Omnia</p><p className="text-base font-bold leading-tight" style={{color:OMNIA_GOLD}}>Career Studio</p></div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              to="/career-studio"
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-semibold transition hover:bg-slate-50"
              style={{ borderColor: BORDER, color: OMNIA_BLUE }}
            >
              <ExternalLink size={15} /> Ouvrir Omnia Career Studio
            </Link>
            <Link
              to="/admin/dashboard"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
              style={{ background: OMNIA_BLUE }}
            >
              <ArrowLeft size={15} /> Retour au Dashboard
            </Link>
          </div>
        </div>
      </header>
      <div className="flex min-h-[calc(100vh-65px)]" style={{ background: '#F8FAFC' }}>
        {toast && (
          <div className="fixed right-5 top-5 z-50 rounded-xl border bg-white px-5 py-3 text-sm font-semibold shadow-lg" style={{ borderColor: toast.type === 'success' ? '#BBF7D0' : '#FECACA', color: toast.type === 'success' ? '#166534' : '#DC2626' }}>
            {toast.text}
          </div>
        )}

        <aside className="w-64 flex flex-shrink-0 flex-col" style={{background:OMNIA_BLUE}}>
          <div className="border-b border-white/10 p-5 flex items-center gap-3"><img src="/omnia-sidebar-logo.png" alt="Omnia" className="h-10 w-10 object-contain"/><div><p className="font-bold text-white">Omnia</p><p className="font-bold" style={{color:OMNIA_GOLD}}>Career Studio</p></div></div>
          <nav className="space-y-1 p-3">
            {SUB_MENUS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setSubTab(key)}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all"
                style={subTab === key ? { background: 'rgba(191,136,19,.18)', color: OMNIA_GOLD } : { color: 'rgba(255,255,255,.78)' }}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </nav><div className="mt-auto border-t border-white/10 p-3"><Link to="/admin/dashboard" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold" style={{color:OMNIA_GOLD}}><ArrowLeft size={16}/>Retour au Dashboard</Link></div>
        </aside>

        <main className="flex-1 space-y-6 overflow-y-auto p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: `${OMNIA_GOLD}55`, background: `${OMNIA_GOLD}12`, color: OMNIA_GOLD }}>
                <ShieldCheck size={14} /> Accès Super Admin
              </div>
              <h1 className="text-2xl font-semibold" style={{ color: OMNIA_BLUE }}>Omnia Career Studio</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6" style={{ color: MUTED }}>
                Gérez les règles, les prix, les jetons, les modèles CV/LM, l’IA et les exports depuis le tableau de bord Super Admin.
              </p>
            </div>
            <button onClick={loadAll} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ borderColor: BORDER, color: OMNIA_BLUE }}>
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Actualiser
            </button>
          </div>

          {loading && (
            <div className="rounded-2xl border bg-white p-8 text-center text-sm" style={{ borderColor: BORDER, color: MUTED }}>Chargement des paramètres Omnia Career...</div>
          )}

          {!loading && subTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
                {[
                  { label: 'CV créés', value: stats.total_cv, icon: FileText },
                  { label: 'LM créées', value: stats.total_lm, icon: Mail },
                  { label: 'PDF exportés', value: stats.total_exports, icon: Download },
                  { label: 'Jetons consommés', value: stats.tokens_consumed, icon: Coins },
                  { label: 'Modèles actifs', value: stats.active_templates, icon: Eye },
                  { label: 'Packs actifs', value: stats.active_packs, icon: Check },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: BORDER }}>
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${OMNIA_BLUE}10`, color: OMNIA_BLUE }}><Icon size={18} /></div>
                    <p className="text-2xl font-semibold" style={{ color: OMNIA_BLUE }}>{value}</p>
                    <p className="mt-1 text-xs" style={{ color: MUTED }}>{label}</p>
                  </div>
                ))}
              </div>
              <div className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border bg-white p-5" style={{borderColor:BORDER}}><h2 className="text-lg font-semibold" style={{color:OMNIA_BLUE}}>Activité récente</h2><div className="mt-4 space-y-3">{tokenTransactions.slice(0,6).map((t:any)=><div key={t.id} className="flex items-center justify-between border-b pb-2 text-sm" style={{borderColor:BORDER}}><span style={{color:MUTED}}>{t.reason||t.transaction_type||'Mouvement de jetons'}</span><strong style={{color:Number(t.amount)<0?'#B91C1C':'#15803D'}}>{Number(t.amount)>0?'+':''}{t.amount||0}</strong></div>)}{tokenTransactions.length===0&&<p className="text-sm" style={{color:MUTED}}>Aucune activité enregistrée.</p>}</div></div><div className="rounded-2xl border bg-white p-5" style={{borderColor:BORDER}}><h2 className="text-lg font-semibold" style={{color:OMNIA_BLUE}}>État opérationnel</h2><div className="mt-4 space-y-3 text-sm" style={{color:MUTED}}><p>{tokenPacks.filter(p=>p.is_active).length} pack(s) de jetons proposé(s)</p><p>{questionBank.filter(q=>q.is_active).length} question(s) active(s)</p><p>{exportLogs.length} export(s) récent(s) chargé(s)</p><p>{cvTemplates.filter(t=>t.is_active).length} modèles CV et {lmTemplates.filter(t=>t.is_active).length} modèles LM actifs</p></div></div></div>
            </div>
          )}

          {!loading && subTab === 'rules' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold" style={{ color: OMNIA_BLUE }}>Règles & Prix modifiables</h2>
                  <p className="mt-1 text-sm" style={{ color: MUTED }}>Ces paramètres contrôlent Omnia Career sans recoder : gratuité, jetons, coût PDF, IA, accès premium et avantages structure.</p>
                </div>
                <button onClick={saveRules} disabled={saving} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: OMNIA_BLUE }}>
                  <Save size={15} /> Sauvegarder
                </button>
              </div>
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
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold" style={{ color: OMNIA_BLUE }}>Gestion centralisée des jetons & packs</h2>
                  <p className="mt-1 text-sm" style={{ color: MUTED }}>Modifiez les prix, les jetons, les bonus et l’état des packs vendus aux apprenants.</p>
                </div>
                <button
                  onClick={() => setTokenPacks((prev) => [...prev, { pack_key: `pack_${Date.now()}`, name_fr: 'Nouveau pack', description_fr: '', tokens: 1, bonus_tokens: 0, price_xof: 0, price_eur: 0, currency_code: 'XOF', is_popular: false, is_active: false, display_order: prev.length + 1 }])}
                  className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-semibold"
                  style={{ borderColor: BORDER, color: OMNIA_BLUE }}
                >
                  <Plus size={15} /> Ajouter un pack
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {tokenPacks.map((pack) => (
                  <div key={pack.id || pack.pack_key} className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: BORDER }}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <input value={pack.name_fr} onChange={(e) => setTokenPacks((prev) => prev.map((p) => p.pack_key === pack.pack_key ? { ...p, name_fr: e.target.value } : p))} className="w-full bg-transparent text-base font-semibold outline-none" style={{ color: OMNIA_BLUE }} />
                        <input value={pack.description_fr || ''} placeholder="Description du pack" onChange={(e) => setTokenPacks((prev) => prev.map((p) => p.pack_key === pack.pack_key ? { ...p, description_fr: e.target.value } : p))} className="mt-1 w-full bg-transparent text-sm outline-none" style={{ color: MUTED }} />
                      </div>
                      <div className="flex items-center gap-2"><span className="text-xs" style={{ color: MUTED }}>Actif</span><Toggle checked={pack.is_active} onChange={(v) => setTokenPacks((prev) => prev.map((p) => p.pack_key === pack.pack_key ? { ...p, is_active: v } : p))} /></div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
                      <label className="text-xs font-medium" style={{ color: MUTED }}>Jetons<NumberInput value={pack.tokens} onChange={(v) => setTokenPacks((prev) => prev.map((p) => p.pack_key === pack.pack_key ? { ...p, tokens: v } : p))} /></label>
                      <label className="text-xs font-medium" style={{ color: MUTED }}>Bonus<NumberInput value={pack.bonus_tokens} onChange={(v) => setTokenPacks((prev) => prev.map((p) => p.pack_key === pack.pack_key ? { ...p, bonus_tokens: v } : p))} /></label>
                      <label className="text-xs font-medium" style={{ color: MUTED }}>Prix XOF<NumberInput value={pack.price_xof} onChange={(v) => setTokenPacks((prev) => prev.map((p) => p.pack_key === pack.pack_key ? { ...p, price_xof: v } : p))} /></label>
                      <label className="text-xs font-medium" style={{ color: MUTED }}>Prix €<NumberInput value={Number(pack.price_eur || 0)} onChange={(v) => setTokenPacks((prev) => prev.map((p) => p.pack_key === pack.pack_key ? { ...p, price_eur: v } : p))} /></label>
                      <label className="text-xs font-medium" style={{ color: MUTED }}>Ordre<NumberInput value={pack.display_order} onChange={(v) => setTokenPacks((prev) => prev.map((p) => p.pack_key === pack.pack_key ? { ...p, display_order: v } : p))} /></label>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2"><span className="text-xs" style={{ color: MUTED }}>Populaire</span><Toggle checked={pack.is_popular} onChange={(v) => setTokenPacks((prev) => prev.map((p) => p.pack_key === pack.pack_key ? { ...p, is_popular: v } : p))} /></div>
                      <button onClick={() => saveTokenPack(pack)} disabled={saving} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: OMNIA_GOLD }}><Save size={14} /> Sauvegarder</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold" style={{ color: OMNIA_BLUE }}>Coûts des actions en jetons</h3>
                    <p className="text-sm" style={{ color: MUTED }}>Exemple : télécharger un CV PDF = 1 jeton, télécharger une LM = 0 jeton.</p>
                  </div>
                  <button onClick={saveTokenCosts} disabled={saving} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: OMNIA_BLUE }}><Save size={14} /> Sauvegarder les coûts</button>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {tokenConfig.map((cfg) => (
                    <div key={cfg.config_key} className="flex items-center justify-between rounded-xl border p-4" style={{ borderColor: BORDER, background: '#F8FAFC' }}>
                      <div className="min-w-0 flex-1 pr-3">
                        <p className="truncate text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{cfg.description_fr || cfg.config_key}</p>
                        <p className="text-xs" style={{ color: MUTED }}>{cfg.config_key}</p>
                      </div>
                      <NumberInput value={cfg.config_value} min={cfg.min_value ?? 0} max={cfg.max_value} suffix={cfg.value_unit || 'jeton(s)'} onChange={(v) => setTokenConfig((prev) => prev.map((c) => c.config_key === cfg.config_key ? { ...c, config_value: v } : c))} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!loading && (subTab === 'cv_templates' || subTab === 'lm_templates') && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold" style={{ color: OMNIA_BLUE }}>{subTab === 'cv_templates' ? 'Modèles de CV' : 'Modèles de lettres de motivation'}</h2>
                <p className="mt-1 text-sm" style={{ color: MUTED }}>Activez, désactivez, rendez gratuit/premium et ajustez l’ordre d’affichage.</p>
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
                    <label className="text-xs font-semibold" style={{ color: MUTED }}>URL miniature (optionnelle)
                      <input value={customTemplate.thumbnail_url} onChange={e=>setCustomTemplate(v=>({...v,thumbnail_url:e.target.value}))} placeholder="https://.../apercu.webp" className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" style={{borderColor:BORDER}}/>
                    </label>
                    <div className="flex flex-wrap gap-4 md:col-span-2">
                      {[['primary','Couleur principale'],['accent','Accent'],['sidebar','Colonne']].map(([key,label])=><label key={key} className="text-xs font-semibold" style={{color:MUTED}}>{label}<input type="color" value={(customTemplate as any)[key]} onChange={e=>setCustomTemplate(v=>({...v,[key]:e.target.value}))} className="ml-2 h-9 w-12 rounded border align-middle" style={{borderColor:BORDER}}/></label>)}
                      <label className="flex items-center gap-2 text-xs font-semibold" style={{color:MUTED}}><input type="checkbox" checked={customTemplate.is_free} onChange={e=>setCustomTemplate(v=>({...v,is_free:e.target.checked}))}/> Gratuit</label>
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

          {!loading && subTab === 'exports' && (<div className="rounded-2xl border bg-white overflow-hidden" style={{borderColor:BORDER}}><div className="p-5 border-b" style={{borderColor:BORDER}}><h2 className="text-xl font-semibold" style={{color:OMNIA_BLUE}}>Exports CV & lettres de motivation</h2><p className="mt-1 text-sm" style={{color:MUTED}}>Journal réel des exports enregistrés par la plateforme.</p></div><div className="divide-y">{exportLogs.map((e:any)=><div key={e.id} className="grid grid-cols-4 gap-3 px-5 py-3 text-sm"><span>{e.doc_type?.toUpperCase()||e.export_type||'Document'}</span><span className="truncate">{e.document_id||e.career_document_id||'—'}</span><span>{e.tokens_consumed??e.token_cost??'—'} jeton(s)</span><span>{e.created_at?new Date(e.created_at).toLocaleString('fr-FR'):'—'}</span></div>)}{exportLogs.length===0&&<div className="p-8 text-center text-sm" style={{color:MUTED}}>Aucun export enregistré.</div>}</div></div>)}

          {!loading && subTab === 'stats' && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}>
                <h2 className="text-lg font-semibold" style={{ color: OMNIA_BLUE }}>Modèles CV actifs</h2>
                <div className="mt-4 space-y-2">
                  {cvTemplates.filter((t) => t.is_active).slice(0, 10).map((t) => <p key={t.template_key} className="text-sm" style={{ color: MUTED }}>{t.display_order}. {t.name_fr}</p>)}
                </div>
              </div>
              <div className="rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}>
                <h2 className="text-lg font-semibold" style={{ color: OMNIA_BLUE }}>Modèles LM actifs</h2>
                <div className="mt-4 space-y-2">
                  {lmTemplates.filter((t) => t.is_active).slice(0, 10).map((t) => <p key={t.template_key} className="text-sm" style={{ color: MUTED }}>{t.display_order}. {t.name_fr}</p>)}
                </div>
              </div>
            </div>
          )}

          {!loading && rules.length === 0 && (
            <div className="rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}>
              <div className="flex items-center gap-3 text-sm" style={{ color: '#92400E' }}><AlertCircle size={17} /> Aucune règle trouvée. Lancez la migration 028 puis redéployez l’edge function.</div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
