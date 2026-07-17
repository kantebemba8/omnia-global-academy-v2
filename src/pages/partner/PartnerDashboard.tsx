import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/DashboardLayout';
import {
  Building2, Users, Key, BarChart2, CheckCircle, Clock,
  AlertCircle, Plus, Edit2, Trash2, Copy, X, Check,
  Shield, GraduationCap, ChevronRight,
  Eye, EyeOff, RefreshCw, BookOpen, PlusCircle,
  FileText, ArrowRight
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface Organization {
  id: string; org_name: string; org_type: string; country: string; city: string;
  email: string; phone: string; website: string; description: string;
  logo_url: string | null; contact_name: string; contact_function: string;
  contact_email: string; status: string; kyc_status: string; created_at: string;
}
interface Manager {
  id: string; user_id: string; role_in_org: string; is_primary: boolean; status: string;
  users: { full_name: string; email: string; phone_number?: string };
}
interface PartnerCode {
  id: string; code: string; pin: string; code_name: string; status: string;
  max_users: number; used_count: number; expires_at: string | null;
  advantages: Record<string, unknown>; created_at: string;
  partner_code_users: { id: string; status: string }[];
}
interface Member {
  id: string; user_id: string; status: string; activated_at: string;
  users: { full_name: string; email: string };
  partner_codes: { code: string };
}
interface Formation {
  id: string; title: string; studio_status: string; category?: string;
  cover_image_url?: string; created_at: string; updated_at: string;
  word_count?: number; admin_comment?: string;
}

type Tab = 'overview' | 'formations' | 'managers' | 'codes' | 'members' | 'stats';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'En attente',  color: '#92400E', bg: '#FEF3C7' },
  validated: { label: 'Validée',     color: '#065F46', bg: '#D1FAE5' },
  modification_requested: { label: 'Modification', color: '#1D4ED8', bg: '#EFF6FF' },
  refused:   { label: 'Refusée',     color: '#991B1B', bg: '#FEE2E2' },
  suspended: { label: 'Suspendue',   color: '#374151', bg: '#F3F4F6' },
  draft:     { label: 'Brouillon',   color: '#6B7280', bg: '#F3F4F6' },
  expired:   { label: 'Expiré',      color: '#6B7280', bg: '#F3F4F6' },
  quota_reached: { label: 'Quota atteint', color: '#92400E', bg: '#FEF3C7' },
};

const STUDIO_STATUS: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  draft:              { label: 'Brouillon',             color: '#6B7280', bg: '#F3F4F6', dot: '#9CA3AF' },
  pending_validation: { label: 'En attente validation', color: '#92400E', bg: '#FEF3C7', dot: '#D97706' },
  changes_requested:  { label: 'Modification demandée', color: '#1D4ED8', bg: '#EFF6FF', dot: '#3B82F6' },
  rejected:           { label: 'Refusée',               color: '#991B1B', bg: '#FEE2E2', dot: '#DC2626' },
  validated:          { label: 'Validée',               color: '#065F46', bg: '#D1FAE5', dot: '#10B981' },
  published:          { label: 'Publiée',               color: '#065F46', bg: '#D1FAE5', dot: '#10B981' },
  archived:           { label: 'Archivée',              color: '#374151', bg: '#F3F4F6', dot: '#6B7280' },
};

const ORG_TYPES: Record<string, string> = {
  school: 'École / Lycée', university: 'Université', training_center: 'Centre de formation',
  company: 'Entreprise', ngo: 'ONG / Association', government: 'Institution publique', other: 'Autre',
};

export default function PartnerDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');
  const [org, setOrg] = useState<Organization | null>(null);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [codes, setCodes] = useState<PartnerCode[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [myRole, setMyRole] = useState<{ role_in_org: string; is_primary: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingFormations, setLoadingFormations] = useState(false);
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [showNewCode, setShowNewCode] = useState(false);
  const [showPinFor, setShowPinFor] = useState<string | null>(null);
  const [creatingCode, setCreatingCode] = useState(false);
  const [newCode, setNewCode] = useState({
    code_name: '', custom_code: '', custom_pin: '', max_users: 100, expires_at: '',
    requires_manual_validation: false,
    advantages: { cv_tokens: 1, pdf_export_free: false, premium_templates: false, career_studio_access: true },
  });

  const token = () => localStorage.getItem('omnia_session_token') || '';

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast(msg); setToastType(type);
    setTimeout(() => setToast(''), 4000);
  }

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/partner-org-manage`, {
        method: 'POST',
        headers: edgeAuthHeaders(),
        body: JSON.stringify({ action: 'get_my_org' }),
      });
      const data = await res.json();
      if (data.error) { navigate('/connexion'); return; }
      setOrg(data.organization);
      setManagers(data.managers || []);
      setMembers(data.members || []);
      setMyRole(data.my_role);

      if (data.organization?.id) {
        const codesRes = await fetch(`${SUPABASE_URL}/functions/v1/partner-code-manage`, {
          method: 'POST',
          headers: edgeAuthHeaders(),
          body: JSON.stringify({ action: 'get_my_codes', org_id: data.organization.id }),
        });
        const codesData = await codesRes.json();
        setCodes(codesData.codes || []);
      }
    } catch { showToast('Erreur de chargement', 'error'); }
    finally { setLoading(false); }
  }

  async function loadFormations() {
    setLoadingFormations(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/studio-unified`, {
        method: 'POST',
        headers: edgeAuthHeaders(),
        body: JSON.stringify({ action: 'get_my_courses' }),
      });
      const data = await res.json();
      if (data.success) setFormations(data.courses || []);
    } catch { showToast('Erreur chargement formations', 'error'); }
    finally { setLoadingFormations(false); }
  }

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (tab === 'formations') loadFormations(); }, [tab]);

  async function createCode() {
    if (!org?.id) return;
    setCreatingCode(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/partner-code-manage`, {
        method: 'POST',
        headers: edgeAuthHeaders(),
        body: JSON.stringify({ action: 'create_code', org_id: org.id, ...newCode, expires_at: newCode.expires_at || null }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ Code "${data.code.code}" créé`);
        setShowNewCode(false);
        setNewCode({ code_name: '', custom_code: '', custom_pin: '', max_users: 100, expires_at: '', requires_manual_validation: false, advantages: { cv_tokens: 1, pdf_export_free: false, premium_templates: false, career_studio_access: true } });
        loadData();
      } else showToast(data.message || 'Erreur', 'error');
    } catch { showToast('Erreur réseau', 'error'); }
    finally { setCreatingCode(false); }
  }

  async function submitCode(codeId: string) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/partner-code-manage`, {
      method: 'POST',
      headers: edgeAuthHeaders(),
      body: JSON.stringify({ action: 'submit_code', code_id: codeId }),
    });
    const data = await res.json();
    if (data.success) { showToast('Demande envoyée'); loadData(); }
    else showToast('Erreur', 'error');
  }

  const inputCls = 'w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:border-[#002050]';
  const inputStyle = { borderColor: '#E4E7EC' };

  const PARTNER_NAV = [
    { path: '/partner/dashboard', label: 'Tableau de bord', icon: Building2, exact: true },
    { path: '/partner/dashboard', label: 'Organisation',    icon: Building2 },
    { path: '/partner/dashboard', label: 'Codes & PIN',     icon: Key },
    { path: '/partner/dashboard', label: 'Membres',         icon: Users },
    { path: '/school/teachers',   label: 'Enseignants',     icon: Users },
    { path: '/school/courses',    label: 'Catalogue interne',icon: BookOpen },
    { path: '/school/payouts',    label: 'Retraits',        icon: BarChart2 },
    { path: '/school/certificats',label: 'Certificats',     icon: CheckCircle },
  ];

  if (loading) {
    return (
      <DashboardLayout role="directeur">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
        </div>
      </DashboardLayout>
    );
  }

  if (!org) {
    return (
      <DashboardLayout role="directeur">
        <div className="max-w-2xl mx-auto p-8 text-center">
          <Building2 size={56} className="mx-auto mb-4 opacity-20" style={{ color: '#002050' }} />
          <h2 className="text-2xl font-black mb-3" style={{ color: '#002050' }}>Aucune organisation liée</h2>
          <p className="mb-6" style={{ color: '#6B7280' }}>Votre compte n'est pas encore lié à une organisation partenaire.</p>
          <button onClick={() => navigate('/inscription/organisation')}
            className="px-6 py-3 rounded-xl font-bold text-white" style={{ background: '#002050' }}>
            Inscrire mon organisation
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const statusCfg = STATUS_CONFIG[org.status] || STATUS_CONFIG.pending;
  const validatedCodes = codes.filter(c => c.status === 'validated');
  const totalMembers = members.filter(m => m.status === 'validated').length;
  const formationsByStatus = {
    draft: formations.filter(f => f.studio_status === 'draft').length,
    pending: formations.filter(f => f.studio_status === 'pending_validation').length,
    published: formations.filter(f => f.studio_status === 'published').length,
    changes: formations.filter(f => f.studio_status === 'changes_requested').length,
  };

  return (
    <DashboardLayout role="directeur" navItems={PARTNER_NAV}>
      <div className="p-6 max-w-6xl mx-auto space-y-6">

        {/* Toast */}
        {toast && (
          <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-lg border"
            style={{ background: toastType === 'success' ? 'white' : '#FEF2F2', borderColor: toastType === 'success' ? '#E4E7EC' : '#FECACA', color: toastType === 'success' ? '#002050' : '#DC2626' }}>
            {toast}
          </div>
        )}

        {/* Header organisation */}
        <div className="bg-white rounded-2xl border p-6" style={{ borderColor: '#E4E7EC' }}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              {org.logo_url ? (
                <img src={org.logo_url} alt={org.org_name} className="w-16 h-16 rounded-xl object-contain border" style={{ borderColor: '#E4E7EC' }} />
              ) : (
                <div className="w-16 h-16 rounded-xl flex items-center justify-center font-black text-2xl text-white" style={{ background: '#002050' }}>
                  {org.org_name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <h1 className="text-xl font-black" style={{ color: '#002050' }}>{org.org_name}</h1>
                <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
                  {ORG_TYPES[org.org_type] || org.org_type} · {org.city}{org.country ? `, ${org.country}` : ''}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: statusCfg.bg, color: statusCfg.color }}>
                    {statusCfg.label}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => navigate('/partner/studio/new')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white"
                style={{ background: '#002050' }}>
                <PlusCircle size={14} /> Créer une formation
              </button>
              <button onClick={loadData}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border"
                style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>
                <RefreshCw size={14} /> Actualiser
              </button>
            </div>
          </div>

          {org.status === 'pending' && (
            <div className="mt-4 flex items-start gap-3 p-3 rounded-xl" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
              <Clock size={16} style={{ color: '#D97706', flexShrink: 0, marginTop: 1 }} />
              <p className="text-sm" style={{ color: '#92400E' }}>Votre demande est en cours de validation par l'équipe Omnia Global Academy.</p>
            </div>
          )}
          {org.status === 'modification_requested' && (
            <div className="mt-4 flex items-start gap-3 p-3 rounded-xl" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
              <AlertCircle size={16} style={{ color: '#1D4ED8', flexShrink: 0, marginTop: 1 }} />
              <p className="text-sm" style={{ color: '#1D4ED8' }}>Modification demandée par le super-admin. Veuillez mettre à jour vos informations.</p>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {([
            { key: 'overview',   label: 'Vue d\'ensemble',             icon: Building2 },
            { key: 'formations', label: `Formations (${formations.length})`, icon: BookOpen },
            { key: 'codes',      label: `Codes & PIN (${codes.length})`, icon: Key },
            { key: 'members',    label: `Membres (${totalMembers})`,    icon: Users },
            { key: 'managers',   label: `Gestionnaires (${managers.length})`, icon: Shield },
            { key: 'stats',      label: 'Statistiques',                 icon: BarChart2 },
          ] as { key: Tab; label: string; icon: typeof Building2 }[]).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={tab === key ? { background: '#002050', color: 'white' } : { background: 'white', color: '#6B7280', border: '1px solid #E4E7EC' }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* ── VUE D'ENSEMBLE ─────────────────────────────── */}
        {tab === 'overview' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Formations publiées', value: formationsByStatus.published, color: '#065F46', bg: '#D1FAE5' },
                { label: 'En attente validation', value: formationsByStatus.pending, color: '#92400E', bg: '#FEF3C7' },
                { label: 'Membres liés', value: totalMembers, color: '#002050', bg: '#EEF2FF' },
                { label: 'Codes actifs', value: validatedCodes.length, color: '#7C3AED', bg: '#F5F3FF' },
              ].map(stat => (
                <div key={stat.label} className="bg-white rounded-xl border p-4" style={{ borderColor: '#E4E7EC' }}>
                  <p className="text-2xl font-black" style={{ color: stat.color }}>{stat.value}</p>
                  <p className="text-xs mt-1" style={{ color: '#6B7280' }}>{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Formations récentes */}
            <div className="bg-white rounded-2xl border p-5" style={{ borderColor: '#E4E7EC' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold" style={{ color: '#002050' }}>Formations récentes</h3>
                <button onClick={() => setTab('formations')} className="text-xs font-semibold flex items-center gap-1" style={{ color: '#BF8813' }}>
                  Voir toutes <ChevronRight size={12} />
                </button>
              </div>
              {formations.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen size={32} className="mx-auto mb-2 opacity-20" style={{ color: '#002050' }} />
                  <p className="text-sm" style={{ color: '#9CA3AF' }}>Aucune formation créée</p>
                  <button onClick={() => navigate('/partner/studio/new')}
                    className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white mx-auto"
                    style={{ background: '#002050' }}>
                    <PlusCircle size={13} /> Créer ma première formation
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {formations.slice(0, 3).map(f => {
                    const sc = STUDIO_STATUS[f.studio_status] || STUDIO_STATUS.draft;
                    return (
                      <div key={f.id} className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                        style={{ background: '#F8F9FA' }}
                        onClick={() => navigate(`/partner/studio/${f.id}`)}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#EEF2FF' }}>
                            <BookOpen size={16} style={{ color: '#002050' }} />
                          </div>
                          <div>
                            <p className="font-semibold text-sm" style={{ color: '#002050' }}>{f.title}</p>
                            <p className="text-xs" style={{ color: '#9CA3AF' }}>{f.category || 'Sans catégorie'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                          <ArrowRight size={14} style={{ color: '#9CA3AF' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── FORMATIONS ─────────────────────────────────── */}
        {tab === 'formations' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold" style={{ color: '#002050' }}>Mes formations</h2>
                <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Gérez vos formations et leur statut de validation</p>
              </div>
              <button onClick={() => navigate('/partner/studio/new')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
                style={{ background: '#002050' }}>
                <PlusCircle size={14} /> Nouvelle formation
              </button>
            </div>

            {/* Filtres rapides */}
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'all', label: `Toutes (${formations.length})` },
                { key: 'draft', label: `Brouillons (${formationsByStatus.draft})` },
                { key: 'pending_validation', label: `En attente (${formationsByStatus.pending})` },
                { key: 'changes_requested', label: `À modifier (${formationsByStatus.changes})` },
                { key: 'published', label: `Publiées (${formationsByStatus.published})` },
              ].map(f => (
                <button key={f.key} className="px-3 py-1.5 rounded-xl text-xs font-semibold border"
                  style={{ borderColor: '#E4E7EC', background: 'white', color: '#6B7280' }}>
                  {f.label}
                </button>
              ))}
            </div>

            {loadingFormations ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
              </div>
            ) : formations.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-dashed p-12 text-center" style={{ borderColor: '#E4E7EC' }}>
                <BookOpen size={40} className="mx-auto mb-3 opacity-20" style={{ color: '#002050' }} />
                <p className="font-bold" style={{ color: '#002050' }}>Aucune formation créée</p>
                <p className="text-sm mt-1 mb-4" style={{ color: '#9CA3AF' }}>Commencez à créer votre première formation</p>
                <button onClick={() => navigate('/partner/studio/new')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white mx-auto"
                  style={{ background: '#002050' }}>
                  <PlusCircle size={14} /> Créer une formation
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {formations.map(f => {
                  const sc = STUDIO_STATUS[f.studio_status] || STUDIO_STATUS.draft;
                  return (
                    <div key={f.id} className="bg-white rounded-2xl border p-5" style={{ borderColor: '#E4E7EC' }}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#EEF2FF' }}>
                            {f.cover_image_url
                              ? <img src={f.cover_image_url} alt="" className="w-full h-full rounded-xl object-cover" />
                              : <BookOpen size={20} style={{ color: '#002050' }} />}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold truncate" style={{ color: '#002050' }}>{f.title}</h3>
                            <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
                              {f.category || 'Sans catégorie'} · Modifié le {new Date(f.updated_at).toLocaleDateString('fr-FR')}
                            </p>
                            {f.admin_comment && f.studio_status === 'changes_requested' && (
                              <p className="text-xs mt-1 px-2 py-1 rounded" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>
                                💬 {f.admin_comment}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1" style={{ background: sc.bg, color: sc.color }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc.dot }} />
                            {sc.label}
                          </span>
                          <button onClick={() => navigate(`/partner/studio/${f.id}`)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border"
                            style={{ borderColor: '#002050', color: '#002050' }}>
                            <Edit2 size={11} /> Modifier
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── CODES & PIN ────────────────────────────────── */}
        {tab === 'codes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold" style={{ color: '#002050' }}>Codes d'accès & PIN</h2>
                <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Les codes doivent être validés par le super-admin</p>
              </div>
              {org.status === 'validated' && (
                <button onClick={() => setShowNewCode(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
                  style={{ background: '#002050' }}>
                  <Plus size={15} /> Créer un code
                </button>
              )}
            </div>

            {codes.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-dashed p-12 text-center" style={{ borderColor: '#E4E7EC' }}>
                <Key size={40} className="mx-auto mb-3 opacity-20" style={{ color: '#002050' }} />
                <p className="font-bold" style={{ color: '#002050' }}>Aucun code créé</p>
              </div>
            ) : (
              <div className="space-y-3">
                {codes.map(code => {
                  const cfg = STATUS_CONFIG[code.status] || STATUS_CONFIG.pending;
                  const usagePercent = Math.round((code.used_count / code.max_users) * 100);
                  return (
                    <div key={code.id} className="bg-white rounded-2xl border p-5" style={{ borderColor: '#E4E7EC' }}>
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold" style={{ color: '#002050' }}>{code.code_name || 'Code partenaire'}</h3>
                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                          </div>
                          <div className="flex items-center gap-4 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-base" style={{ color: '#002050' }}>{code.code}</span>
                              <button onClick={() => { navigator.clipboard?.writeText(code.code); showToast('Code copié'); }}>
                                <Copy size={12} style={{ color: '#9CA3AF' }} />
                              </button>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs" style={{ color: '#6B7280' }}>PIN :</span>
                              {showPinFor === code.id
                                ? <span className="font-mono font-bold text-sm" style={{ color: '#002050' }}>{code.pin}</span>
                                : <span className="font-mono text-sm" style={{ color: '#9CA3AF' }}>••••</span>}
                              <button onClick={() => setShowPinFor(showPinFor === code.id ? null : code.id)}>
                                {showPinFor === code.id ? <EyeOff size={12} style={{ color: '#9CA3AF' }} /> : <Eye size={12} style={{ color: '#9CA3AF' }} />}
                              </button>
                            </div>
                          </div>
                          <div className="mt-3">
                            <div className="flex justify-between text-xs mb-1">
                              <span style={{ color: '#6B7280' }}>{code.used_count} / {code.max_users} utilisateurs</span>
                              <span style={{ color: '#6B7280' }}>{usagePercent}%</span>
                            </div>
                            <div className="h-1.5 rounded-full" style={{ background: '#E4E7EC' }}>
                              <div className="h-1.5 rounded-full" style={{ width: `${Math.min(usagePercent, 100)}%`, background: usagePercent >= 90 ? '#DC2626' : '#002050' }} />
                            </div>
                          </div>
                        </div>
                        {code.status === 'draft' && (
                          <button onClick={() => submitCode(code.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                            style={{ background: '#1E7A52' }}>
                            <ChevronRight size={12} /> Soumettre
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── MEMBRES ────────────────────────────────────── */}
        {tab === 'members' && (
          <div className="space-y-4">
            <h2 className="font-bold" style={{ color: '#002050' }}>Membres liés</h2>
            {members.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-dashed p-12 text-center" style={{ borderColor: '#E4E7EC' }}>
                <Users size={40} className="mx-auto mb-3 opacity-20" style={{ color: '#002050' }} />
                <p className="font-bold" style={{ color: '#002050' }}>Aucun membre lié</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: '#E4E7EC' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#F8F9FA', borderBottom: '1px solid #E4E7EC' }}>
                      {['Membre', 'Code utilisé', 'Statut', 'Date'].map(h => (
                        <th key={h} className="text-left px-4 py-3 font-semibold text-xs" style={{ color: '#6B7280' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m, i) => {
                      const cfg = STATUS_CONFIG[m.status] || STATUS_CONFIG.pending;
                      return (
                        <tr key={m.id} style={{ borderBottom: i < members.length - 1 ? '1px solid #E4E7EC' : 'none' }}>
                          <td className="px-4 py-3">
                            <p className="font-semibold" style={{ color: '#002050' }}>{m.users?.full_name}</p>
                            <p className="text-xs" style={{ color: '#9CA3AF' }}>{m.users?.email}</p>
                          </td>
                          <td className="px-4 py-3"><span className="font-mono text-xs font-bold" style={{ color: '#002050' }}>{m.partner_codes?.code}</span></td>
                          <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span></td>
                          <td className="px-4 py-3 text-xs" style={{ color: '#9CA3AF' }}>{new Date(m.activated_at).toLocaleDateString('fr-FR')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── GESTIONNAIRES ──────────────────────────────── */}
        {tab === 'managers' && (
          <div className="space-y-4">
            <h2 className="font-bold" style={{ color: '#002050' }}>Gestionnaires</h2>
            <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: '#E4E7EC' }}>
              {managers.map((m, i) => (
                <div key={m.id} className="flex items-center justify-between p-4"
                  style={{ borderBottom: i < managers.length - 1 ? '1px solid #E4E7EC' : 'none' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white"
                      style={{ background: m.is_primary ? '#002050' : '#6B7280' }}>
                      {(m.users?.full_name || 'U').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: '#002050' }}>{m.users?.full_name}</p>
                      <p className="text-xs" style={{ color: '#9CA3AF' }}>{m.users?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.is_primary && <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: '#EEF2FF', color: '#3730A3' }}>Principal</span>}
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#F3F4F6', color: '#6B7280' }}>{m.role_in_org}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── STATISTIQUES ───────────────────────────────── */}
        {tab === 'stats' && (
          <div className="space-y-4">
            <h2 className="font-bold" style={{ color: '#002050' }}>Statistiques</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: 'Formations créées', value: formations.length },
                { label: 'Formations publiées', value: formationsByStatus.published },
                { label: 'En attente validation', value: formationsByStatus.pending },
                { label: 'Membres actifs', value: totalMembers },
                { label: 'Codes validés', value: validatedCodes.length },
                { label: 'Codes totaux', value: codes.length },
              ].map(stat => (
                <div key={stat.label} className="bg-white rounded-xl border p-4" style={{ borderColor: '#E4E7EC' }}>
                  <p className="text-2xl font-black" style={{ color: '#002050' }}>{stat.value}</p>
                  <p className="text-xs mt-1" style={{ color: '#6B7280' }}>{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL Nouveau code ─────────────────────────── */}
      {showNewCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#E4E7EC' }}>
              <h3 className="font-bold text-lg" style={{ color: '#002050' }}>Créer un code d'accès</h3>
              <button onClick={() => setShowNewCode(false)}><X size={20} style={{ color: '#6B7280' }} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#002050' }}>Nom du code</label>
                <input className={inputCls} style={inputStyle} value={newCode.code_name} onChange={e => setNewCode(p => ({ ...p, code_name: e.target.value }))} placeholder="Ex: Promotion 2026..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#002050' }}>Code (optionnel)</label>
                  <input className={inputCls} style={inputStyle} value={newCode.custom_code} onChange={e => setNewCode(p => ({ ...p, custom_code: e.target.value.toUpperCase() }))} placeholder="Auto si vide" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#002050' }}>PIN (optionnel)</label>
                  <input className={inputCls} style={inputStyle} value={newCode.custom_pin} onChange={e => setNewCode(p => ({ ...p, custom_pin: e.target.value }))} placeholder="4 chiffres" maxLength={4} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#002050' }}>Quota max</label>
                  <input className={inputCls} style={inputStyle} type="number" min={1} value={newCode.max_users} onChange={e => setNewCode(p => ({ ...p, max_users: parseInt(e.target.value) || 100 }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#002050' }}>Expiration</label>
                  <input className={inputCls} style={inputStyle} type="date" value={newCode.expires_at} onChange={e => setNewCode(p => ({ ...p, expires_at: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowNewCode(false)} className="flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium" style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>Annuler</button>
                <button onClick={createCode} disabled={creatingCode || !newCode.code_name}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: '#002050' }}>
                  {creatingCode ? '⏳...' : 'Créer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
