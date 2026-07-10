import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FileText, Plus, Edit2, Trash2, Copy, Download, Eye,
  Sparkles, ChevronLeft, Coins, Star, Lock, Check,
  Award, Clock, AlertCircle, X, LayoutGrid, List,
  MessageSquare, Briefcase, Globe, Target
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface CareerDocument {
  id: string;
  title: string;
  doc_type: 'cv' | 'lm';
  template_key: string;
  language: string;
  status: string;
  ats_score: number | null;
  target_job: string | null;
  application_type: string | null;
  created_at: string;
  updated_at: string;
}

interface Template {
  template_key: string;
  name_fr: string;
  description_fr: string;
  category: string;
  is_free: boolean;
  is_ats_compatible: boolean;
  display_order: number;
  default_colors: { primary: string; accent: string; sidebar: string };
}

interface TokenPack {
  pack_key: string;
  name_fr: string;
  tokens: number;
  price_xof: number;
  is_popular: boolean;
  bonus_tokens: number;
}

interface PartnerLink {
  status: string;
  advantages_remaining: Record<string, unknown>;
  partner_organizations: { org_name: string };
  partner_codes: { code: string };
}

const CATEGORY_LABELS: Record<string, string> = {
  student: 'Étudiant & Stage',
  professional: 'Professionnel',
  africa_premium: 'Afrique Premium',
  tech: 'Tech & Digital',
  creative: 'Créatif',
  specialized: 'Métiers spécialisés',
  classic_lm: 'Lettres assorties',
  quick_lm: 'Lettres rapides',
};

const DOC_TYPE_LABELS: Record<string, string> = {
  cv: 'CV',
  lm: 'Lettre de motivation',
  pack: 'Pack candidature',
};

export default function DashboardCareerStudio() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // State principal
  const [activeTab, setActiveTab] = useState<'cv' | 'lm'>('cv');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [documents, setDocuments] = useState<CareerDocument[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [packs, setPacks] = useState<TokenPack[]>([]);
  const [tokenConfig, setTokenConfig] = useState<Record<string, number>>({});
  const [partnerLink, setPartnerLink] = useState<PartnerLink | null>(null);
  const [tokens, setTokens] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Modals
  const [showBuyTokens, setShowBuyTokens] = useState(false);
  const [showNewDoc, setShowNewDoc] = useState(false);
  const [showTemplateSelect, setShowTemplateSelect] = useState(false);
  const [newDocType, setNewDocType] = useState<'cv' | 'lm'>('cv');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [buyingTokens, setBuyingTokens] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const token = () => localStorage.getItem('omnia_session_token') || '';

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(''), 4000);
  }

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/career-studio-list`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
       body: JSON.stringify({ doc_type: activeTab, load_all_templates: true }),
      });
      const data = await res.json();
      if (data.error) { navigate('/connexion'); return; }
      setDocuments(data.documents || []);
      setTemplates(data.templates || []);
      setPacks(data.packs || []);
      setTokenConfig(data.token_config || {});
      setTokens(data.user?.cv_tokens ?? 0);
      setPartnerLink(data.partner_link || null);
    } catch {
      showToast('Erreur de chargement', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // Détecter retour FedaPay
    const purchased = searchParams.get('tokens_purchased');
    if (purchased) {
      showToast(`✅ ${purchased} jeton(s) crédité(s) sur votre compte !`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [activeTab]);

  async function deleteDoc(docId: string) {
    if (!confirm('Supprimer ce document ?')) return;
    setDeleting(docId);
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/career-studio-save`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', document_id: docId }),
      });
      setDocuments(prev => prev.filter(d => d.id !== docId));
      showToast('Document supprimé');
    } catch { showToast('Erreur', 'error'); }
    finally { setDeleting(null); }
  }

  async function duplicateDoc(docId: string) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/career-studio-save`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate', document_id: docId }),
      });
      const data = await res.json();
      if (data.success) { showToast(`✅ "${data.document.title}" créé`); loadData(); }
    } catch { showToast('Erreur', 'error'); }
  }

  async function buyTokens(packKey: string) {
    setBuyingTokens(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/career-token-manage`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'checkout', pack_key: packKey }),
      });
      const data = await res.json();
      if (data.payment_url) { window.location.href = data.payment_url; }
      else { showToast('Erreur lors du paiement', 'error'); }
    } catch { showToast('Erreur réseau', 'error'); }
    finally { setBuyingTokens(false); }
  }

  function openEditor(docId: string) {
    navigate(`/dashboard/career-studio/editor/${docId}`);
  }

  function startNewDoc(docType: 'cv' | 'lm') {
    setNewDocType(docType);
    setSelectedTemplate(null);
    setShowNewDoc(false);
    setShowTemplateSelect(true);
  }

  function createFromTemplate(templateKey: string) {
    navigate(`/dashboard/career-studio/editor/new?type=${newDocType}&template=${templateKey}`);
  }

const filteredTemplates = templates.filter(t =>
    (t as any).template_type === newDocType || !((t as any).template_type)
  );

  const freeTemplates = filteredTemplates.filter(t => t.is_free);
  const premiumTemplates = filteredTemplates.filter(t => !t.is_free);

  return (
    <div className="min-h-screen" style={{ background: '#F8F9FA' }}>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-lg border"
          style={{
            background: toastType === 'success' ? 'white' : '#FEF2F2',
            borderColor: toastType === 'success' ? '#E4E7EC' : '#FECACA',
            color: toastType === 'success' ? '#002050' : '#DC2626',
          }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b px-6 py-4 sticky top-0 z-30" style={{ borderColor: '#E4E7EC' }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            <button onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-sm mb-1" style={{ color: '#6B7280' }}>
              <ChevronLeft size={14} /> Tableau de bord
            </button>
            <h1 className="text-xl font-black" style={{ color: '#002050' }}>Omnia Career Studio</h1>
            <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>CV · Lettres de motivation · Candidatures</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Jetons */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border"
              style={{ borderColor: '#BF8813', background: 'rgba(191,136,19,0.05)' }}>
              <Coins size={15} style={{ color: '#BF8813' }} />
              <span className="font-bold text-sm" style={{ color: '#BF8813' }}>{tokens}</span>
              <span className="text-xs" style={{ color: '#6B7280' }}>jeton(s)</span>
            </div>
            <button onClick={() => setShowBuyTokens(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: '#BF8813' }}>
              <Plus size={14} /> Acheter
            </button>
            {/* Nouveau document */}
            <button onClick={() => setShowNewDoc(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
              style={{ background: '#002050' }}>
              <Plus size={16} /> Nouveau document
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">

        {/* Alerte code partenaire */}
        {partnerLink && (
          <div className="flex items-center gap-3 p-4 rounded-xl border"
            style={{ background: '#F0FDF4', borderColor: '#BBF7D0' }}>
            <Check size={18} style={{ color: '#16A34A' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: '#15803D' }}>
                Code partenaire actif — {partnerLink.partner_organizations?.org_name}
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#16A34A' }}>
                Vos avantages sont disponibles. Code : {partnerLink.partner_codes?.code}
              </p>
            </div>
          </div>
        )}

        {/* Info jetons */}
        <div className="flex items-start gap-3 p-4 rounded-xl border" style={{ background: 'white', borderColor: '#E4E7EC' }}>
          <AlertCircle size={16} style={{ color: '#BF8813', flexShrink: 0, marginTop: 1 }} />
          <p className="text-sm" style={{ color: '#6B7280' }}>
            <span className="font-semibold" style={{ color: '#002050' }}>Système de jetons : </span>
            Création, modification, aperçu A4 et changement de couleurs sont <strong>gratuits</strong>.
            {tokenConfig.cout_pdf_gratuit && ` Export PDF modèle gratuit : ${tokenConfig.cout_pdf_gratuit} jeton.`}
            {tokenConfig.cout_cv_ia && ` Génération IA : ${tokenConfig.cout_cv_ia} jetons.`}
            {tokenConfig.cout_pack_candidature && ` Pack candidature complet : ${tokenConfig.cout_pack_candidature} jetons.`}
          </p>
        </div>

        {/* Tabs CV / LM */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-2">
            {(['cv', 'lm'] as const).map(tab => (
              <button key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                style={activeTab === tab
                  ? { background: '#002050', color: 'white' }
                  : { background: 'white', color: '#6B7280', border: '1px solid #E4E7EC' }}>
                {tab === 'cv' ? <FileText size={14} /> : <MessageSquare size={14} />}
                {tab === 'cv' ? 'Mes CV' : 'Mes lettres'}
                {documents.filter(d => d.doc_type === tab).length > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                    style={{ background: activeTab === tab ? 'rgba(255,255,255,0.2)' : '#F3F4F6', color: activeTab === tab ? 'white' : '#6B7280' }}>
                    {documents.filter(d => d.doc_type === tab).length}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => setViewMode('grid')}
              className="p-2 rounded-lg transition-all"
              style={viewMode === 'grid' ? { background: '#002050', color: 'white' } : { background: 'white', color: '#9CA3AF', border: '1px solid #E4E7EC' }}>
              <LayoutGrid size={16} />
            </button>
            <button onClick={() => setViewMode('list')}
              className="p-2 rounded-lg transition-all"
              style={viewMode === 'list' ? { background: '#002050', color: 'white' } : { background: 'white', color: '#9CA3AF', border: '1px solid #E4E7EC' }}>
              <List size={16} />
            </button>
          </div>
        </div>

        {/* Documents */}
        {loading ? (
          <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 gap-4' : 'space-y-3'}>
            {[1, 2, 3].map(i => <div key={i} className="h-40 rounded-2xl animate-pulse" style={{ background: '#E4E7EC' }} />)}
          </div>
        ) : documents.filter(d => d.doc_type === activeTab).length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed p-12 text-center" style={{ borderColor: '#E4E7EC' }}>
            {activeTab === 'cv' ? <FileText size={48} className="mx-auto mb-4 opacity-20" style={{ color: '#002050' }} />
              : <MessageSquare size={48} className="mx-auto mb-4 opacity-20" style={{ color: '#002050' }} />}
            <h3 className="font-bold mb-2" style={{ color: '#002050' }}>
              Aucun {activeTab === 'cv' ? 'CV' : 'lettre de motivation'} créé
            </h3>
            <p className="text-sm mb-6" style={{ color: '#6B7280' }}>
              Créez votre premier {activeTab === 'cv' ? 'CV professionnel' : 'lettre de motivation'} en quelques minutes
            </p>
            <button onClick={() => startNewDoc(activeTab)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white"
              style={{ background: '#002050' }}>
              <Plus size={16} />
              Créer {activeTab === 'cv' ? 'mon CV' : 'ma lettre'}
            </button>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}>
            {documents.filter(d => d.doc_type === activeTab).map(doc => {
              const tmpl = templates.find(t => t.template_key === doc.template_key);
              const colors = tmpl?.default_colors || { primary: '#002050', accent: '#BF8813', sidebar: '#F8F9FA' };
              return (
                <div key={doc.id}
                  className={`bg-white rounded-2xl border overflow-hidden hover:shadow-md transition-shadow ${viewMode === 'list' ? 'flex items-center gap-4 p-4' : 'p-5'}`}
                  style={{ borderColor: '#E4E7EC' }}>

                  {viewMode === 'grid' && (
                    /* Mini preview */
                    <div className="h-28 rounded-xl mb-4 overflow-hidden relative" style={{ background: '#F8F9FA' }}>
                      <div className="absolute inset-2 rounded-lg overflow-hidden" style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                        <div className="flex h-full" style={{ fontSize: '4px' }}>
                          <div className="w-1/3 h-full" style={{ background: colors.sidebar || colors.primary }} />
                          <div className="flex-1 p-1.5">
                            <div className="h-1 rounded mb-0.5" style={{ background: colors.primary, width: '70%' }} />
                            <div className="h-0.5 rounded" style={{ background: colors.accent, width: '45%' }} />
                          </div>
                        </div>
                      </div>
                      {doc.ats_score !== null && (
                        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-xs font-bold"
                          style={{ background: doc.ats_score >= 80 ? '#D1FAE5' : doc.ats_score >= 60 ? '#FEF3C7' : '#FEE2E2', color: doc.ats_score >= 80 ? '#065F46' : doc.ats_score >= 60 ? '#92400E' : '#991B1B' }}>
                          ATS {doc.ats_score}%
                        </div>
                      )}
                    </div>
                  )}

                  <div className={viewMode === 'list' ? 'flex-1 min-w-0' : ''}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-bold truncate" style={{ color: '#002050', fontSize: '14px' }}>{doc.title}</h3>
                      {tmpl && !tmpl.is_free && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0"
                          style={{ background: '#FEF3C7', color: '#92400E' }}>Premium</span>
                      )}
                    </div>
                    <p className="text-xs mb-1" style={{ color: '#9CA3AF' }}>
                      {tmpl?.name_fr || doc.template_key}
                      {doc.target_job && ` · ${doc.target_job}`}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs" style={{ color: '#9CA3AF' }}>
                        <Clock size={10} className="inline mr-1" />
                        {new Date(doc.updated_at).toLocaleDateString('fr-FR')}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full"
                        style={{ background: '#F3F4F6', color: '#6B7280' }}>
                        {doc.language === 'fr' ? 'Français' : 'English'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className={`flex gap-2 flex-wrap ${viewMode === 'grid' ? 'mt-4' : 'flex-shrink-0'}`}>
                    <button onClick={() => openEditor(doc.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                      style={{ background: '#002050' }}>
                      <Edit2 size={11} /> Modifier
                    </button>
                    <button onClick={() => duplicateDoc(doc.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border"
                      style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>
                      <Copy size={11} /> Copier
                    </button>
                    <button
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                      disabled={tokens < (tokenConfig.cout_pdf_gratuit || 1)}
                      style={{ background: '#BF8813', color: 'white' }}
                      onClick={() => navigate(`/dashboard/career-studio/editor/${doc.id}?action=download`)}>
                      <Download size={11} /> PDF
                    </button>
                    <button onClick={() => deleteDoc(doc.id)}
                      disabled={deleting === doc.id}
                      className="p-1.5 rounded-lg"
                      style={{ color: '#DC2626' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Carte Nouveau */}
            <div onClick={() => startNewDoc(activeTab)}
              className="bg-white rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-8 cursor-pointer hover:border-[#002050] transition-colors"
              style={{ borderColor: '#E4E7EC', minHeight: viewMode === 'grid' ? '220px' : '80px' }}>
              <Plus size={24} style={{ color: '#9CA3AF' }} className="mb-2" />
              <span className="text-sm font-medium" style={{ color: '#9CA3AF' }}>
                Nouveau {activeTab === 'cv' ? 'CV' : 'LM'}
              </span>
            </div>
          </div>
        )}

        {/* Actions rapides */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: Sparkles, label: 'Générer avec l\'IA', desc: 'CV complet en quelques secondes', color: '#7C3AED', action: () => navigate('/dashboard/career-studio/editor/new?type=cv&mode=ai') },
            { icon: Target, label: 'Adapter à une offre', desc: 'Analysez votre correspondance ATS', color: '#0369A1', action: () => navigate('/dashboard/career-studio/editor/new?type=cv&mode=adapt') },
            { icon: Briefcase, label: 'Pack candidature', desc: 'CV + LM + ATS en 5 jetons', color: '#1B4332', action: () => navigate('/dashboard/career-studio/editor/new?type=pack') },
          ].map(({ icon: Icon, label, desc, color, action }) => (
            <button key={label} onClick={action}
              className="bg-white rounded-xl border p-4 text-left hover:shadow-md transition-shadow"
              style={{ borderColor: '#E4E7EC' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                style={{ background: `${color}15` }}>
                <Icon size={20} style={{ color }} />
              </div>
              <p className="font-bold text-sm mb-0.5" style={{ color: '#002050' }}>{label}</p>
              <p className="text-xs" style={{ color: '#9CA3AF' }}>{desc}</p>
            </button>
          ))}
        </div>

        {/* Lien code partenaire */}
        {!partnerLink && (
          <div className="bg-white rounded-xl border p-4 flex items-center justify-between gap-4"
            style={{ borderColor: '#E4E7EC' }}>
            <div>
              <p className="font-semibold text-sm" style={{ color: '#002050' }}>Vous avez un code partenaire ?</p>
              <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>Saisissez votre code pour débloquer des avantages gratuits</p>
            </div>
            <button onClick={() => navigate('/dashboard/profil?tab=partenaire')}
              className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: '#002050' }}>
              Saisir un code
            </button>
          </div>
        )}
      </div>

      {/* ── MODAL Nouveau document ─────────────────────────── */}
      {showNewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold" style={{ color: '#002050' }}>Quel document créer ?</h3>
              <button onClick={() => setShowNewDoc(false)}><X size={20} style={{ color: '#6B7280' }} /></button>
            </div>
            <div className="space-y-3">
              {[
                { type: 'cv' as const, icon: FileText, label: 'CV professionnel', desc: '20 modèles disponibles', color: '#002050' },
                { type: 'lm' as const, icon: MessageSquare, label: 'Lettre de motivation', desc: '32 modèles disponibles', color: '#1B4332' },
              ].map(({ type, icon: Icon, label, desc, color }) => (
                <button key={type} onClick={() => startNewDoc(type)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left hover:border-current transition-all"
                  style={{ borderColor: '#E4E7EC' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${color}15` }}>
                    <Icon size={20} style={{ color }} />
                  </div>
                  <div>
                    <p className="font-bold text-sm" style={{ color: '#002050' }}>{label}</p>
                    <p className="text-xs" style={{ color: '#9CA3AF' }}>{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL Choix template ───────────────────────────── */}
      {showTemplateSelect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#E4E7EC' }}>
              <div>
                <h3 className="text-lg font-bold" style={{ color: '#002050' }}>
                  Choisir un modèle {newDocType === 'cv' ? 'CV' : 'de lettre'}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
                  {freeTemplates.length} gratuits · {premiumTemplates.length} premium
                </p>
              </div>
              <button onClick={() => setShowTemplateSelect(false)}><X size={20} style={{ color: '#6B7280' }} /></button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-6">
              {/* Gratuits */}
              {freeTemplates.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#9CA3AF' }}>Modèles gratuits</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {freeTemplates.map(tmpl => {
                      const colors = tmpl.default_colors || { primary: '#002050', accent: '#BF8813', sidebar: '#F8F9FA' };
                      return (
                        <button key={tmpl.template_key}
                          onClick={() => createFromTemplate(tmpl.template_key)}
                          className="p-3 rounded-xl border-2 text-left hover:shadow-md transition-all group"
                          style={{ borderColor: selectedTemplate === tmpl.template_key ? '#002050' : '#E4E7EC' }}>
                          {/* Mini preview */}
                          <div className="h-20 rounded-lg overflow-hidden mb-2" style={{ background: '#F8F9FA' }}>
                            <div className="flex h-full" style={{ fontSize: '3px' }}>
                              <div className="w-1/3 h-full" style={{ background: colors.sidebar || colors.primary, opacity: 0.8 }} />
                              <div className="flex-1 p-1">
                                <div className="h-0.5 rounded mb-0.5" style={{ background: colors.primary, width: '70%' }} />
                                <div className="h-0.5 rounded" style={{ background: colors.accent, width: '45%' }} />
                              </div>
                            </div>
                          </div>
                          <p className="text-xs font-bold" style={{ color: '#002050' }}>{tmpl.name_fr}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: '#D1FAE5', color: '#065F46', fontSize: '10px' }}>Gratuit</span>
                            {tmpl.is_ats_compatible && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: '#EFF6FF', color: '#1D4ED8', fontSize: '10px' }}>ATS</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Premium */}
              {premiumTemplates.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#9CA3AF' }}>Modèles premium</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {premiumTemplates.map(tmpl => {
                      const colors = tmpl.default_colors || { primary: '#002050', accent: '#BF8813', sidebar: '#F8F9FA' };
                      const hasAccess = partnerLink?.advantages_remaining?.premium_templates;
                      return (
                        <button key={tmpl.template_key}
                          onClick={() => hasAccess ? createFromTemplate(tmpl.template_key) : setShowBuyTokens(true)}
                          className="p-3 rounded-xl border-2 text-left hover:shadow-md transition-all relative group"
                          style={{ borderColor: '#E4E7EC' }}>
                          <div className="h-20 rounded-lg overflow-hidden mb-2 relative" style={{ background: '#F8F9FA' }}>
                            <div className="flex h-full" style={{ fontSize: '3px' }}>
                              <div className="w-1/3 h-full" style={{ background: colors.sidebar || colors.primary, opacity: 0.8 }} />
                              <div className="flex-1 p-1">
                                <div className="h-0.5 rounded mb-0.5" style={{ background: colors.primary, width: '70%' }} />
                                <div className="h-0.5 rounded" style={{ background: colors.accent, width: '45%' }} />
                              </div>
                            </div>
                            {!hasAccess && (
                              <div className="absolute inset-0 flex items-center justify-center rounded-lg"
                                style={{ background: 'rgba(0,0,0,0.4)' }}>
                                <Lock size={16} style={{ color: 'white' }} />
                              </div>
                            )}
                          </div>
                          <p className="text-xs font-bold" style={{ color: '#002050' }}>{tmpl.name_fr}</p>
                          <span className="text-xs px-1.5 py-0.5 rounded-full mt-1 inline-block"
                            style={{ background: '#FEF3C7', color: '#92400E', fontSize: '10px' }}>
                            {hasAccess ? '✓ Inclus' : 'Premium'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL Achat jetons ────────────────────────────── */}
      {showBuyTokens && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold" style={{ color: '#002050' }}>Acheter des jetons</h3>
              <button onClick={() => setShowBuyTokens(false)}><X size={20} style={{ color: '#6B7280' }} /></button>
            </div>
            <p className="text-xs mb-5" style={{ color: '#6B7280' }}>
              Solde actuel : <strong style={{ color: '#BF8813' }}>{tokens} jeton(s)</strong>
            </p>
            <div className="space-y-3 mb-4">
              {packs.map(pack => (
                <button key={pack.pack_key} onClick={() => buyTokens(pack.pack_key)}
                  disabled={buyingTokens}
                  className="w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all disabled:opacity-50"
                  style={{ borderColor: pack.is_popular ? '#BF8813' : '#E4E7EC', background: pack.is_popular ? 'rgba(191,136,19,0.04)' : 'white' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: 'rgba(0,32,80,0.08)' }}>
                      <Coins size={18} style={{ color: '#BF8813' }} />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-sm" style={{ color: '#002050' }}>{pack.name_fr}</p>
                      <p className="text-xs" style={{ color: '#9CA3AF' }}>
                        {pack.tokens + (pack.bonus_tokens || 0)} jetons
                        {pack.is_popular && ' ⭐ Meilleure valeur'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm" style={{ color: '#002050' }}>
                      {pack.price_xof.toLocaleString('fr-FR')} FCFA
                    </p>
                    <p className="text-xs" style={{ color: '#9CA3AF' }}>
                      {Math.round(pack.price_xof / (pack.tokens + (pack.bonus_tokens || 0)))} FCFA/jeton
                    </p>
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-center" style={{ color: '#9CA3AF' }}>
              Paiement sécurisé via FedaPay · Mobile Money & Carte
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
