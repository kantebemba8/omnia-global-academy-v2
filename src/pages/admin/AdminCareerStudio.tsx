import { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import {
  FileText, Coins, BarChart2, Settings, Sparkles, Download,
  Users, Building2, Plus, Edit2, Trash2, Check, X,
  Eye, EyeOff, ChevronRight, RefreshCw, AlertCircle,
  TrendingUp, Award, MessageSquare, Key, Clock
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

type SubTab = 'dashboard' | 'cv_templates' | 'lm_templates' | 'ai_settings' | 'tokens' | 'exports' | 'stats' | 'partner_orgs';

interface Template {
  id?: string;
  template_key: string;
  template_type: string;
  name_fr: string;
  description_fr: string;
  category: string;
  is_free: boolean;
  is_active: boolean;
  is_ats_compatible: boolean;
  display_order: number;
  usage_count: number;
  export_count: number;
  default_colors: Record<string, string>;
}

interface TokenPack {
  id: string;
  pack_key: string;
  name_fr: string;
  tokens: number;
  price_xof: number;
  is_active: boolean;
  is_popular: boolean;
  bonus_tokens: number;
  display_order: number;
}

interface TokenConfig {
  config_key: string;
  config_value: number;
  description_fr: string;
  is_active: boolean;
}

interface AiConfig {
  config_key: string;
  config_value: string;
  description_fr: string;
}

interface PartnerOrg {
  id: string;
  org_name: string;
  org_type: string;
  country: string;
  status: string;
  contact_name: string;
  contact_email: string;
  created_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  student: 'Étudiant & Stage',
  professional: 'Professionnel',
  africa_premium: 'Afrique Premium',
  tech: 'Tech & Digital',
  creative: 'Créatif',
  specialized: 'Spécialisé',
  classic_lm: 'LM assortie',
  quick_lm: 'LM rapide',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'En attente', color: '#92400E', bg: '#FEF3C7' },
  validated: { label: 'Validée', color: '#065F46', bg: '#D1FAE5' },
  modification_requested: { label: 'Modification', color: '#1D4ED8', bg: '#EFF6FF' },
  refused: { label: 'Refusée', color: '#991B1B', bg: '#FEE2E2' },
  suspended: { label: 'Suspendue', color: '#374151', bg: '#F3F4F6' },
};

export default function AdminCareerStudio() {
  const [subTab, setSubTab] = useState<SubTab>('dashboard');
  const [cvTemplates, setCvTemplates] = useState<Template[]>([]);
  const [lmTemplates, setLmTemplates] = useState<Template[]>([]);
  const [tokenPacks, setTokenPacks] = useState<TokenPack[]>([]);
  const [tokenConfig, setTokenConfig] = useState<TokenConfig[]>([]);
  const [aiConfig, setAiConfig] = useState<AiConfig[]>([]);
  const [partnerOrgs, setPartnerOrgs] = useState<PartnerOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Stats
  const [stats, setStats] = useState({
    total_cv: 0, total_lm: 0, total_exports: 0,
    tokens_consumed: 0, active_users: 0, partner_orgs: 0,
  });

  const token = () => localStorage.getItem('omnia_session_token') || '';

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast(msg); setToastType(type);
    setTimeout(() => setToast(''), 4000);
  }

  async function loadAll() {
    setLoading(true);
    try {
      const sb = SUPABASE_URL;

      // Templates CV
      const cvRes = await fetch(`${sb}/functions/v1/career-studio-list?type=cv`);
      const cvData = await cvRes.json();
      setCvTemplates(cvData.templates || []);

      // Templates LM
      const lmRes = await fetch(`${sb}/functions/v1/career-studio-list?type=lm`);
      const lmData = await lmRes.json();
      setLmTemplates(lmData.templates || []);
      setTokenPacks(cvData.packs || []);

      // Config jetons
      const tkRes = await fetch(`${sb}/functions/v1/career-token-manage`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_history' }),
      });
      // On charge la config depuis Supabase directement via REST
      const configRes = await fetch(`${sb}/rest/v1/career_token_config?select=*&order=config_key`, {
        headers: { 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '', 'Authorization': `Bearer ${token()}` }
      });
      if (configRes.ok) setTokenConfig(await configRes.json());

      const aiRes = await fetch(`${sb}/rest/v1/career_ai_config?select=*`, {
        headers: { 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '', 'Authorization': `Bearer ${token()}` }
      });
      if (aiRes.ok) setAiConfig(await aiRes.json());

      // Organisations partenaires
      const orgRes = await fetch(`${sb}/functions/v1/partner-org-manage`, {
        headers: { 'Authorization': `Bearer ${token()}` }
      });
      if (orgRes.ok) {
        const orgData = await orgRes.json();
        setPartnerOrgs(orgData.organizations || []);
      }

      // Stats rapides depuis career_documents
      const docsRes = await fetch(`${sb}/rest/v1/career_documents?select=doc_type,status`, {
        headers: { 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '', 'Authorization': `Bearer ${token()}` }
      });
      if (docsRes.ok) {
        const docs = await docsRes.json();
        setStats({
          total_cv: docs.filter((d: any) => d.doc_type === 'cv').length,
          total_lm: docs.filter((d: any) => d.doc_type === 'lm').length,
          total_exports: docs.filter((d: any) => d.status === 'exported').length,
          tokens_consumed: 0,
          active_users: 0,
          partner_orgs: partnerOrgs.length,
        });
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadAll(); }, []);

  async function toggleTemplate(templateKey: string, field: 'is_active' | 'is_free', currentValue: boolean) {
    setSaving(true);
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/career_templates?template_key=eq.${templateKey}`, {
        method: 'PATCH',
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
          'Authorization': `Bearer ${token()}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ [field]: !currentValue }),
      });
      if (subTab === 'cv_templates') {
        setCvTemplates(prev => prev.map(t => t.template_key === templateKey ? { ...t, [field]: !currentValue } : t));
      } else {
        setLmTemplates(prev => prev.map(t => t.template_key === templateKey ? { ...t, [field]: !currentValue } : t));
      }
      showToast(`✅ Modèle mis à jour`);
    } catch { showToast('Erreur', 'error'); }
    finally { setSaving(false); }
  }

  async function saveTokenConfig() {
    setSaving(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/career-token-manage`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_config', configs: tokenConfig.map(c => ({ config_key: c.config_key, config_value: c.config_value })) }),
      });
      const data = await res.json();
      if (data.success) showToast(`✅ ${data.updated} paramètre(s) sauvegardé(s)`);
      else showToast('Erreur', 'error');
    } catch { showToast('Erreur réseau', 'error'); }
    finally { setSaving(false); }
  }

  async function saveAiConfig() {
    setSaving(true);
    try {
      for (const cfg of aiConfig) {
        await fetch(`${SUPABASE_URL}/rest/v1/career_ai_config?config_key=eq.${cfg.config_key}`, {
          method: 'PATCH',
          headers: { 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '', 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify({ config_value: cfg.config_value }),
        });
      }
      showToast('✅ Configuration IA sauvegardée');
    } catch { showToast('Erreur', 'error'); }
    finally { setSaving(false); }
  }

  async function saveTokenPack(pack: TokenPack) {
    setSaving(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/career-token-manage`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_pack', pack_id: pack.id, ...pack }),
      });
      const data = await res.json();
      if (data.success) showToast('✅ Pack mis à jour');
      else showToast('Erreur', 'error');
    } catch { showToast('Erreur', 'error'); }
    finally { setSaving(false); }
  }

  async function validateOrg(orgId: string, action: 'validate' | 'refuse' | 'suspend' | 'request_modification', reason?: string) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/partner-org-manage`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, org_id: orgId, reason }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ Organisation ${action === 'validate' ? 'validée' : action === 'refuse' ? 'refusée' : 'mise à jour'}`);
        loadAll();
      }
    } catch { showToast('Erreur', 'error'); }
  }

  const inputCls = 'w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:border-[#002050]';
  const inputStyle = { borderColor: '#E4E7EC' };

  const SUB_MENUS = [
    { key: 'dashboard', label: 'Tableau de bord', icon: BarChart2 },
    { key: 'cv_templates', label: 'Modèles CV', icon: FileText },
    { key: 'lm_templates', label: 'Modèles LM', icon: MessageSquare },
    { key: 'ai_settings', label: 'Paramètres IA', icon: Sparkles },
    { key: 'tokens', label: 'Jetons & Tarifs', icon: Coins },
    { key: 'exports', label: 'Demandes & Exports', icon: Download },
    { key: 'stats', label: 'Statistiques', icon: TrendingUp },
    { key: 'partner_orgs', label: 'Organisations', icon: Building2 },
  ] as { key: SubTab; label: string; icon: typeof BarChart2 }[];

  return (
    <AdminLayout>
      <div className="flex min-h-screen" style={{ background: '#F8F9FA' }}>

        {/* Toast */}
        {toast && (
          <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-lg border"
            style={{ background: toastType === 'success' ? 'white' : '#FEF2F2', borderColor: toastType === 'success' ? '#E4E7EC' : '#FECACA', color: toastType === 'success' ? '#002050' : '#DC2626' }}>
            {toast}
          </div>
        )}

        {/* Sidebar sous-menus */}
        <div className="w-56 bg-white border-r flex-shrink-0" style={{ borderColor: '#E4E7EC' }}>
          <div className="p-4 border-b" style={{ borderColor: '#E4E7EC' }}>
            <p className="text-xs font-black uppercase tracking-wider" style={{ color: '#002050' }}>Career Studio</p>
            <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Gestion super-admin</p>
          </div>
          <nav className="p-2 space-y-1">
            {SUB_MENUS.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setSubTab(key)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all"
                style={subTab === key ? { background: '#002050', color: 'white' } : { color: '#6B7280' }}>
                <Icon size={15} />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Contenu principal */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">

          {/* ── TABLEAU DE BORD ───────────────────────── */}
          {subTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-black" style={{ color: '#002050' }}>Omnia Career Studio</h1>
                  <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Vue d'ensemble et statistiques globales</p>
                </div>
                <button onClick={loadAll} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border" style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>
                  <RefreshCw size={14} /> Actualiser
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: 'CV créés', value: stats.total_cv, icon: FileText, color: '#002050', bg: '#EEF2FF' },
                  { label: 'LM créées', value: stats.total_lm, icon: MessageSquare, color: '#1B4332', bg: '#D1FAE5' },
                  { label: 'PDF exportés', value: stats.total_exports, icon: Download, color: '#7C3AED', bg: '#F5F3FF' },
                  { label: 'Modèles CV actifs', value: cvTemplates.filter(t => t.is_active).length, icon: Eye, color: '#0369A1', bg: '#F0F9FF' },
                  { label: 'Organisations', value: partnerOrgs.length, icon: Building2, color: '#BE185D', bg: '#FDF2F8' },
                  { label: 'En attente validation', value: partnerOrgs.filter(o => o.status === 'pending').length, icon: Clock, color: '#92400E', bg: '#FEF3C7' },
                ].map(({ label, value, icon: Icon, color, bg }) => (
                  <div key={label} className="bg-white rounded-xl border p-4" style={{ borderColor: '#E4E7EC' }}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: bg }}>
                        <Icon size={18} style={{ color }} />
                      </div>
                    </div>
                    <p className="text-2xl font-black" style={{ color }}>{loading ? '...' : value}</p>
                    <p className="text-xs mt-1" style={{ color: '#6B7280' }}>{label}</p>
                  </div>
                ))}
              </div>

              {/* Alertes */}
              {partnerOrgs.filter(o => o.status === 'pending').length > 0 && (
                <div className="bg-white rounded-2xl border p-5" style={{ borderColor: '#E4E7EC' }}>
                  <h3 className="font-bold mb-3 flex items-center gap-2" style={{ color: '#002050' }}>
                    <AlertCircle size={16} style={{ color: '#D97706' }} />
                    Organisations en attente de validation ({partnerOrgs.filter(o => o.status === 'pending').length})
                  </h3>
                  <div className="space-y-2">
                    {partnerOrgs.filter(o => o.status === 'pending').slice(0, 5).map(org => (
                      <div key={org.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: '#FFFBEB' }}>
                        <div>
                          <p className="font-semibold text-sm" style={{ color: '#002050' }}>{org.org_name}</p>
                          <p className="text-xs" style={{ color: '#9CA3AF' }}>{org.contact_email}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => validateOrg(org.id, 'validate')}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: '#1E7A52' }}>
                            Valider
                          </button>
                          <button onClick={() => setSubTab('partner_orgs')}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold border" style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>
                            Voir
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── MODÈLES CV ──────────────────────────── */}
          {(subTab === 'cv_templates' || subTab === 'lm_templates') && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-black" style={{ color: '#002050' }}>
                    {subTab === 'cv_templates' ? 'Modèles de CV' : 'Modèles de lettres'}
                  </h1>
                  <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
                    {subTab === 'cv_templates' ? `${cvTemplates.length} modèles` : `${lmTemplates.length} modèles`} · Gérez la disponibilité et les tarifs
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: '#E4E7EC' }}>
                <div className="grid grid-cols-12 gap-4 px-5 py-3 text-xs font-bold uppercase tracking-wider border-b" style={{ color: '#9CA3AF', borderColor: '#E4E7EC', background: '#F8F9FA' }}>
                  <div className="col-span-1">#</div>
                  <div className="col-span-4">Modèle</div>
                  <div className="col-span-2">Catégorie</div>
                  <div className="col-span-1 text-center">Gratuit</div>
                  <div className="col-span-1 text-center">Actif</div>
                  <div className="col-span-1 text-center">ATS</div>
                  <div className="col-span-1 text-center">Usages</div>
                  <div className="col-span-1 text-center">Exports</div>
                </div>
                {(subTab === 'cv_templates' ? cvTemplates : lmTemplates).map((tmpl, i) => (
                  <div key={tmpl.template_key}
                    className="grid grid-cols-12 gap-4 px-5 py-3 items-center text-sm"
                    style={{ borderBottom: i < (subTab === 'cv_templates' ? cvTemplates : lmTemplates).length - 1 ? '1px solid #E4E7EC' : 'none', opacity: tmpl.is_active ? 1 : 0.5 }}>
                    <div className="col-span-1 text-xs font-bold" style={{ color: '#9CA3AF' }}>{tmpl.display_order}</div>
                    <div className="col-span-4">
                      <p className="font-semibold" style={{ color: '#002050' }}>{tmpl.name_fr}</p>
                      <p className="text-xs" style={{ color: '#9CA3AF' }}>{tmpl.template_key}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#F3F4F6', color: '#6B7280' }}>
                        {CATEGORY_LABELS[tmpl.category] || tmpl.category}
                      </span>
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <button onClick={() => toggleTemplate(tmpl.template_key, 'is_free', tmpl.is_free)}
                        className="w-8 h-5 rounded-full transition-all flex-shrink-0 relative"
                        style={{ background: tmpl.is_free ? '#1E7A52' : '#E4E7EC' }}>
                        <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                          style={{ transform: tmpl.is_free ? 'translateX(12px)' : 'translateX(2px)' }} />
                      </button>
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <button onClick={() => toggleTemplate(tmpl.template_key, 'is_active', tmpl.is_active)}
                        className="w-8 h-5 rounded-full transition-all flex-shrink-0 relative"
                        style={{ background: tmpl.is_active ? '#002050' : '#E4E7EC' }}>
                        <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                          style={{ transform: tmpl.is_active ? 'translateX(12px)' : 'translateX(2px)' }} />
                      </button>
                    </div>
                    <div className="col-span-1 text-center">
                      {tmpl.is_ats_compatible
                        ? <Check size={14} style={{ color: '#1E7A52', margin: '0 auto' }} />
                        : <span style={{ color: '#E4E7EC' }}>—</span>}
                    </div>
                    <div className="col-span-1 text-center font-semibold text-xs" style={{ color: '#374151' }}>{tmpl.usage_count || 0}</div>
                    <div className="col-span-1 text-center font-semibold text-xs" style={{ color: '#374151' }}>{tmpl.export_count || 0}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── PARAMÈTRES IA ──────────────────────── */}
          {subTab === 'ai_settings' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-black" style={{ color: '#002050' }}>Paramètres IA</h1>
                  <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Activer/désactiver les fonctions IA et définir les limites</p>
                </div>
                <button onClick={saveAiConfig} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: '#002050' }}>
                  {saving ? '⏳' : '💾'} Sauvegarder
                </button>
              </div>

              <div className="bg-white rounded-2xl border p-5 space-y-3" style={{ borderColor: '#E4E7EC' }}>
                {aiConfig.map(cfg => {
                  const isBool = cfg.config_value === 'true' || cfg.config_value === 'false';
                  const isNum = !isNaN(Number(cfg.config_value)) && cfg.config_value !== 'true' && cfg.config_value !== 'false';
                  return (
                    <div key={cfg.config_key} className="flex items-center justify-between p-3 rounded-xl border"
                      style={{ borderColor: '#E4E7EC', background: '#F8F9FA' }}>
                      <div className="flex-1">
                        <p className="text-sm font-semibold" style={{ color: '#002050' }}>{cfg.description_fr || cfg.config_key}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{cfg.config_key}</p>
                      </div>
                      {isBool ? (
                        <button
                          onClick={() => setAiConfig(prev => prev.map(c => c.config_key === cfg.config_key ? { ...c, config_value: cfg.config_value === 'true' ? 'false' : 'true' } : c))}
                          className="w-10 h-6 rounded-full transition-all flex-shrink-0 relative ml-4"
                          style={{ background: cfg.config_value === 'true' ? '#002050' : '#E4E7EC' }}>
                          <span className="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform"
                            style={{ transform: cfg.config_value === 'true' ? 'translateX(20px)' : 'translateX(4px)' }} />
                        </button>
                      ) : isNum ? (
                        <input type="number" value={cfg.config_value} className="w-24 ml-4 px-3 py-1.5 border rounded-lg text-sm text-center" style={inputStyle}
                          onChange={e => setAiConfig(prev => prev.map(c => c.config_key === cfg.config_key ? { ...c, config_value: e.target.value } : c))} />
                      ) : (
                        <input type="text" value={cfg.config_value} className="w-32 ml-4 px-3 py-1.5 border rounded-lg text-sm" style={inputStyle}
                          onChange={e => setAiConfig(prev => prev.map(c => c.config_key === cfg.config_key ? { ...c, config_value: e.target.value } : c))} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── JETONS & TARIFS ─────────────────────── */}
          {subTab === 'tokens' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-black" style={{ color: '#002050' }}>Jetons & Tarifs</h1>
                  <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Packs, gains et coûts des actions</p>
                </div>
                <button onClick={saveTokenConfig} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: '#002050' }}>
                  {saving ? '⏳' : '💾'} Sauvegarder les coûts
                </button>
              </div>

              {/* Packs */}
              <div className="bg-white rounded-2xl border p-5" style={{ borderColor: '#E4E7EC' }}>
                <h3 className="font-bold mb-4" style={{ color: '#002050' }}>Packs de jetons</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {tokenPacks.map(pack => (
                    <div key={pack.id} className="p-4 rounded-xl border" style={{ borderColor: '#E4E7EC' }}>
                      <div className="flex items-center justify-between mb-3">
                        <input className="font-bold text-sm border-none outline-none bg-transparent" style={{ color: '#002050' }}
                          value={pack.name_fr} onChange={e => setTokenPacks(prev => prev.map(p => p.id === pack.id ? { ...p, name_fr: e.target.value } : p))} />
                        <div className="flex items-center gap-2">
                          <span className="text-xs" style={{ color: '#9CA3AF' }}>Populaire</span>
                          <button onClick={() => setTokenPacks(prev => prev.map(p => p.id === pack.id ? { ...p, is_popular: !p.is_popular } : p))}
                            className="w-8 h-5 rounded-full relative transition-all"
                            style={{ background: pack.is_popular ? '#BF8813' : '#E4E7EC' }}>
                            <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                              style={{ transform: pack.is_popular ? 'translateX(12px)' : 'translateX(2px)' }} />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Jetons</label>
                          <input type="number" min={1} className={inputCls} style={inputStyle} value={pack.tokens}
                            onChange={e => setTokenPacks(prev => prev.map(p => p.id === pack.id ? { ...p, tokens: parseInt(e.target.value) } : p))} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Prix FCFA</label>
                          <input type="number" min={0} className={inputCls} style={inputStyle} value={pack.price_xof}
                            onChange={e => setTokenPacks(prev => prev.map(p => p.id === pack.id ? { ...p, price_xof: parseInt(e.target.value) } : p))} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Bonus</label>
                          <input type="number" min={0} className={inputCls} style={inputStyle} value={pack.bonus_tokens}
                            onChange={e => setTokenPacks(prev => prev.map(p => p.id === pack.id ? { ...p, bonus_tokens: parseInt(e.target.value) } : p))} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs" style={{ color: '#9CA3AF' }}>Actif</span>
                          <button onClick={() => setTokenPacks(prev => prev.map(p => p.id === pack.id ? { ...p, is_active: !p.is_active } : p))}
                            className="w-8 h-5 rounded-full relative transition-all"
                            style={{ background: pack.is_active ? '#002050' : '#E4E7EC' }}>
                            <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                              style={{ transform: pack.is_active ? 'translateX(12px)' : 'translateX(2px)' }} />
                          </button>
                        </div>
                        <button onClick={() => saveTokenPack(pack)} disabled={saving}
                          className="px-3 py-1 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                          style={{ background: '#BF8813' }}>
                          Sauvegarder
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Coûts des actions */}
              <div className="bg-white rounded-2xl border p-5" style={{ borderColor: '#E4E7EC' }}>
                <h3 className="font-bold mb-4" style={{ color: '#002050' }}>Coûts des actions (en jetons)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {tokenConfig.map(cfg => (
                    <div key={cfg.config_key} className="flex items-center justify-between p-3 rounded-xl border"
                      style={{ borderColor: '#E4E7EC', background: '#F8F9FA' }}>
                      <div className="flex-1 min-w-0 mr-3">
                        <p className="text-sm font-semibold truncate" style={{ color: '#002050' }}>{cfg.description_fr || cfg.config_key}</p>
                        <p className="text-xs" style={{ color: '#9CA3AF' }}>{cfg.config_key}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <input type="number" min={0} max={99} value={cfg.config_value}
                          className="w-16 px-2 py-1.5 border rounded-lg text-sm text-center font-bold"
                          style={{ borderColor: '#E4E7EC', color: '#002050' }}
                          onChange={e => setTokenConfig(prev => prev.map(c => c.config_key === cfg.config_key ? { ...c, config_value: parseInt(e.target.value) || 0 } : c))} />
                        <span className="text-xs" style={{ color: '#9CA3AF' }}>jeton(s)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── DEMANDES & EXPORTS ──────────────────── */}
          {subTab === 'exports' && (
            <div className="space-y-5">
              <h1 className="text-2xl font-black" style={{ color: '#002050' }}>Demandes & Exports</h1>
              <div className="bg-white rounded-2xl border p-8 text-center" style={{ borderColor: '#E4E7EC' }}>
                <Download size={40} className="mx-auto mb-3 opacity-20" style={{ color: '#002050' }} />
                <p className="font-bold" style={{ color: '#002050' }}>Historique des exports</p>
                <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>
                  L'historique détaillé des exports PDF, Word et des transactions de jetons sera affiché ici.
                </p>
                <p className="text-xs mt-3 px-4 py-2 rounded-lg inline-block" style={{ background: '#FEF3C7', color: '#92400E' }}>
                  Fonctionnalité à compléter — données disponibles dans Supabase > career_token_transactions
                </p>
              </div>
            </div>
          )}

          {/* ── STATISTIQUES ────────────────────────── */}
          {subTab === 'stats' && (
            <div className="space-y-5">
              <h1 className="text-2xl font-black" style={{ color: '#002050' }}>Statistiques Career Studio</h1>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: 'CV créés', value: stats.total_cv, color: '#002050' },
                  { label: 'Lettres de motivation', value: stats.total_lm, color: '#1B4332' },
                  { label: 'PDF exportés', value: stats.total_exports, color: '#7C3AED' },
                  { label: 'Modèles CV actifs', value: cvTemplates.filter(t => t.is_active).length, color: '#0369A1' },
                  { label: 'Modèles LM actifs', value: lmTemplates.filter(t => t.is_active).length, color: '#BE185D' },
                  { label: 'Organisations partenaires', value: partnerOrgs.filter(o => o.status === 'validated').length, color: '#065F46' },
                ].map(stat => (
                  <div key={stat.label} className="bg-white rounded-xl border p-4" style={{ borderColor: '#E4E7EC' }}>
                    <p className="text-3xl font-black" style={{ color: stat.color }}>{loading ? '...' : stat.value}</p>
                    <p className="text-xs mt-1" style={{ color: '#6B7280' }}>{stat.label}</p>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-xl border p-5" style={{ borderColor: '#E4E7EC' }}>
                <p className="font-semibold mb-2" style={{ color: '#002050' }}>Modèles les plus utilisés</p>
                <div className="space-y-2">
                  {cvTemplates.sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0)).slice(0, 5).map(t => (
                    <div key={t.template_key} className="flex items-center justify-between text-sm">
                      <span style={{ color: '#374151' }}>{t.name_fr}</span>
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-1.5 rounded-full" style={{ background: '#E4E7EC' }}>
                          <div className="h-1.5 rounded-full" style={{ width: `${Math.min((t.usage_count || 0) * 10, 100)}%`, background: '#002050' }} />
                        </div>
                        <span className="font-bold w-6 text-right" style={{ color: '#002050' }}>{t.usage_count || 0}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── ORGANISATIONS PARTENAIRES ───────────── */}
          {subTab === 'partner_orgs' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-black" style={{ color: '#002050' }}>Organisations partenaires</h1>
                  <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>{partnerOrgs.length} organisation(s) · {partnerOrgs.filter(o => o.status === 'pending').length} en attente</p>
                </div>
                <button onClick={loadAll} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border" style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>
                  <RefreshCw size={14} /> Actualiser
                </button>
              </div>

              {/* Filtres par statut */}
              <div className="flex gap-2 flex-wrap">
                {['all', 'pending', 'validated', 'refused', 'suspended'].map(status => (
                  <button key={status}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
                    style={{ borderColor: '#E4E7EC', color: '#6B7280', background: 'white' }}>
                    {status === 'all' ? `Tous (${partnerOrgs.length})` : `${STATUS_CONFIG[status]?.label} (${partnerOrgs.filter(o => o.status === status).length})`}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {partnerOrgs.map(org => {
                  const cfg = STATUS_CONFIG[org.status] || STATUS_CONFIG.pending;
                  return (
                    <div key={org.id} className="bg-white rounded-2xl border p-5" style={{ borderColor: '#E4E7EC' }}>
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold" style={{ color: '#002050' }}>{org.org_name}</h3>
                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mt-2">
                            <div><span style={{ color: '#9CA3AF' }}>Type : </span><span style={{ color: '#374151' }}>{org.org_type}</span></div>
                            <div><span style={{ color: '#9CA3AF' }}>Pays : </span><span style={{ color: '#374151' }}>{org.country}</span></div>
                            <div><span style={{ color: '#9CA3AF' }}>Contact : </span><span style={{ color: '#374151' }}>{org.contact_name}</span></div>
                            <div><span style={{ color: '#9CA3AF' }}>Email : </span><span style={{ color: '#374151' }}>{org.contact_email}</span></div>
                          </div>
                          <p className="text-xs mt-2" style={{ color: '#9CA3AF' }}>
                            Inscrite le {new Date(org.created_at).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {org.status === 'pending' && (
                            <>
                              <button onClick={() => validateOrg(org.id, 'validate')}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                                style={{ background: '#1E7A52' }}>
                                <Check size={11} /> Valider
                              </button>
                              <button onClick={() => {
                                const reason = prompt('Raison de la modification demandée :');
                                if (reason) validateOrg(org.id, 'request_modification', reason);
                              }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border"
                                style={{ borderColor: '#BFDBFE', color: '#1D4ED8' }}>
                                Demander modification
                              </button>
                              <button onClick={() => {
                                const reason = prompt('Raison du refus :');
                                if (reason) validateOrg(org.id, 'refuse', reason);
                              }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                                style={{ color: '#DC2626' }}>
                                <X size={11} /> Refuser
                              </button>
                            </>
                          )}
                          {org.status === 'validated' && (
                            <button onClick={() => validateOrg(org.id, 'suspend')}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border"
                              style={{ borderColor: '#FCA5A5', color: '#DC2626' }}>
                              Suspendre
                            </button>
                          )}
                          {org.status === 'suspended' && (
                            <button onClick={() => validateOrg(org.id, 'validate')}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                              style={{ background: '#1E7A52' }}>
                              Réactiver
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {partnerOrgs.length === 0 && (
                  <div className="bg-white rounded-2xl border-2 border-dashed p-12 text-center" style={{ borderColor: '#E4E7EC' }}>
                    <Building2 size={40} className="mx-auto mb-3 opacity-20" style={{ color: '#002050' }} />
                    <p className="font-bold" style={{ color: '#002050' }}>Aucune organisation</p>
                    <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>Les inscriptions d'organisations apparaîtront ici</p>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </AdminLayout>
  );
}
