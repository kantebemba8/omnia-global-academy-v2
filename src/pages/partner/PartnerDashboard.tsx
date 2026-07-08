import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/DashboardLayout';
import {
  Building2, Users, Key, BarChart2, CheckCircle, Clock,
  AlertCircle, Plus, Edit2, Trash2, Copy, X, Check,
  Shield, Globe, GraduationCap, Briefcase, ChevronRight,
  Eye, EyeOff, RefreshCw, QrCode, Upload, Download
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface Organization {
  id: string;
  org_name: string;
  org_type: string;
  country: string;
  city: string;
  email: string;
  phone: string;
  website: string;
  description: string;
  logo_url: string | null;
  contact_name: string;
  contact_function: string;
  contact_email: string;
  status: string;
  kyc_status: string;
  created_at: string;
}

interface Manager {
  id: string;
  user_id: string;
  role_in_org: string;
  is_primary: boolean;
  status: string;
  users: { full_name: string; email: string; phone_number?: string };
}

interface PartnerCode {
  id: string;
  code: string;
  pin: string;
  code_name: string;
  status: string;
  max_users: number;
  used_count: number;
  expires_at: string | null;
  advantages: Record<string, unknown>;
  created_at: string;
  partner_code_users: { id: string; status: string }[];
}

interface Member {
  id: string;
  user_id: string;
  status: string;
  activated_at: string;
  users: { full_name: string; email: string };
  partner_codes: { code: string };
}

type Tab = 'overview' | 'managers' | 'codes' | 'members' | 'stats';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'En attente', color: '#92400E', bg: '#FEF3C7' },
  validated: { label: 'Validé', color: '#065F46', bg: '#D1FAE5' },
  modification_requested: { label: 'Modification demandée', color: '#1D4ED8', bg: '#EFF6FF' },
  refused: { label: 'Refusé', color: '#991B1B', bg: '#FEE2E2' },
  suspended: { label: 'Suspendu', color: '#374151', bg: '#F3F4F6' },
  draft: { label: 'Brouillon', color: '#6B7280', bg: '#F3F4F6' },
  expired: { label: 'Expiré', color: '#6B7280', bg: '#F3F4F6' },
  quota_reached: { label: 'Quota atteint', color: '#92400E', bg: '#FEF3C7' },
};

const ORG_TYPES: Record<string, string> = {
  school: 'École / Lycée',
  university: 'Université',
  training_center: 'Centre de formation',
  company: 'Entreprise',
  ngo: 'ONG / Association',
  government: 'Institution publique',
  other: 'Autre',
};

export default function PartnerDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');
  const [org, setOrg] = useState<Organization | null>(null);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [codes, setCodes] = useState<PartnerCode[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [myRole, setMyRole] = useState<{ role_in_org: string; is_primary: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Modals
  const [showNewCode, setShowNewCode] = useState(false);
  const [showEditOrg, setShowEditOrg] = useState(false);
  const [showPinFor, setShowPinFor] = useState<string | null>(null);

  // Formulaire nouveau code
  const [newCode, setNewCode] = useState({
    code_name: '', custom_code: '', custom_pin: '',
    max_users: 100, expires_at: '',
    requires_manual_validation: false,
    advantages: { cv_tokens: 1, pdf_export_free: false, premium_templates: false, career_studio_access: true },
  });
  const [creatingCode, setCreatingCode] = useState(false);

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
        headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_my_org' }),
      });
      const data = await res.json();
      if (data.error) { navigate('/connexion'); return; }
      setOrg(data.organization);
      setManagers(data.managers || []);
      setMembers(data.members || []);
      setMyRole(data.my_role);

      // Charger les codes
      if (data.organization?.id) {
        const codesRes = await fetch(`${SUPABASE_URL}/functions/v1/partner-code-manage`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_my_codes', org_id: data.organization.id }),
        });
        const codesData = await codesRes.json();
        setCodes(codesData.codes || []);
      }
    } catch { showToast('Erreur de chargement', 'error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadData(); }, []);

  async function createCode() {
    if (!org?.id) return;
    setCreatingCode(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/partner-code-manage`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_code',
          org_id: org.id,
          ...newCode,
          expires_at: newCode.expires_at || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ Code "${data.code.code}" créé — PIN: ${data.code.pin}`);
        setShowNewCode(false);
        setNewCode({ code_name: '', custom_code: '', custom_pin: '', max_users: 100, expires_at: '', requires_manual_validation: false, advantages: { cv_tokens: 1, pdf_export_free: false, premium_templates: false, career_studio_access: true } });
        loadData();
      } else { showToast(data.message || 'Erreur', 'error'); }
    } catch { showToast('Erreur réseau', 'error'); }
    finally { setCreatingCode(false); }
  }

  async function submitCode(codeId: string) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/partner-code-manage`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'submit_code', code_id: codeId }),
    });
    const data = await res.json();
    if (data.success) { showToast('Demande envoyée au super-admin pour validation'); loadData(); }
    else showToast('Erreur', 'error');
  }

  const inputCls = 'w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:border-[#002050]';
  const inputStyle = { borderColor: '#E4E7EC' };

  const PARTNER_NAV = [
    { path: '/partner/dashboard', label: 'Tableau de bord', icon: Building2, exact: true },
    { path: '/partner/managers', label: 'Gestionnaires', icon: Users },
    { path: '/partner/codes', label: 'Codes & PIN', icon: Key },
    { path: '/partner/members', label: 'Membres liés', icon: GraduationCap },
    { path: '/partner/stats', label: 'Statistiques', icon: BarChart2 },
    { path: '/school/teachers', label: 'Enseignants', icon: Users },
    { path: '/school/courses', label: 'Catalogue interne', icon: Briefcase },
    { path: '/school/payouts', label: 'Retraits', icon: Briefcase },
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

  // Organisation non encore créée
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
  const pendingCodes = codes.filter(c => c.status === 'pending');
  const totalMembers = members.filter(m => m.status === 'validated').length;

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
                  <span className="text-xs" style={{ color: '#9CA3AF' }}>
                    Depuis le {new Date(org.created_at).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setShowEditOrg(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border"
                style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>
                <Edit2 size={14} /> Modifier
              </button>
              <button onClick={loadData}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border"
                style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>
                <RefreshCw size={14} /> Actualiser
              </button>
            </div>
          </div>

          {/* Alertes statut */}
          {org.status === 'pending' && (
            <div className="mt-4 flex items-start gap-3 p-3 rounded-xl" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
              <Clock size={16} style={{ color: '#D97706', flexShrink: 0, marginTop: 1 }} />
              <p className="text-sm" style={{ color: '#92400E' }}>
                Votre demande a été envoyée au super-admin pour validation. Vous serez notifié par email.
              </p>
            </div>
          )}
          {org.status === 'modification_requested' && (
            <div className="mt-4 flex items-start gap-3 p-3 rounded-xl" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
              <AlertCircle size={16} style={{ color: '#1D4ED8', flexShrink: 0, marginTop: 1 }} />
              <p className="text-sm" style={{ color: '#1D4ED8' }}>
                Modification demandée par le super-admin. Veuillez mettre à jour vos informations.
              </p>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {([
            { key: 'overview', label: 'Vue d\'ensemble', icon: Building2 },
            { key: 'codes', label: `Codes & PIN (${codes.length})`, icon: Key },
            { key: 'members', label: `Membres (${totalMembers})`, icon: Users },
            { key: 'managers', label: `Gestionnaires (${managers.length})`, icon: Shield },
            { key: 'stats', label: 'Statistiques', icon: BarChart2 },
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
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Codes actifs', value: validatedCodes.length, color: '#065F46', bg: '#D1FAE5' },
                { label: 'En attente', value: pendingCodes.length, color: '#92400E', bg: '#FEF3C7' },
                { label: 'Membres liés', value: totalMembers, color: '#002050', bg: '#EEF2FF' },
                { label: 'Gestionnaires', value: managers.length, color: '#7C3AED', bg: '#F5F3FF' },
              ].map(stat => (
                <div key={stat.label} className="bg-white rounded-xl border p-4" style={{ borderColor: '#E4E7EC' }}>
                  <p className="text-2xl font-black" style={{ color: stat.color }}>{stat.value}</p>
                  <p className="text-xs mt-1" style={{ color: '#6B7280' }}>{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Informations organisation */}
            <div className="bg-white rounded-2xl border p-5" style={{ borderColor: '#E4E7EC' }}>
              <h3 className="font-bold mb-4" style={{ color: '#002050' }}>Informations</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  { label: 'Type', value: ORG_TYPES[org.org_type] },
                  { label: 'Pays', value: org.country },
                  { label: 'Ville', value: org.city },
                  { label: 'Email', value: org.email },
                  { label: 'Téléphone', value: org.phone },
                  { label: 'Site web', value: org.website },
                  { label: 'Contact principal', value: org.contact_name },
                  { label: 'Fonction', value: org.contact_function },
                  { label: 'Email contact', value: org.contact_email },
                ].map(({ label, value }) => value ? (
                  <div key={label}>
                    <span className="text-xs font-semibold" style={{ color: '#9CA3AF' }}>{label}</span>
                    <p style={{ color: '#374151' }}>{value}</p>
                  </div>
                ) : null)}
              </div>
              {org.description && (
                <div className="mt-4 pt-4 border-t" style={{ borderColor: '#E4E7EC' }}>
                  <span className="text-xs font-semibold" style={{ color: '#9CA3AF' }}>Description</span>
                  <p className="text-sm mt-1" style={{ color: '#374151' }}>{org.description}</p>
                </div>
              )}
            </div>

            {/* Codes récents */}
            {codes.length > 0 && (
              <div className="bg-white rounded-2xl border p-5" style={{ borderColor: '#E4E7EC' }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold" style={{ color: '#002050' }}>Codes récents</h3>
                  <button onClick={() => setTab('codes')} className="text-xs font-semibold" style={{ color: '#BF8813' }}>
                    Voir tous <ChevronRight size={12} className="inline" />
                  </button>
                </div>
                <div className="space-y-2">
                  {codes.slice(0, 3).map(code => {
                    const cfg = STATUS_CONFIG[code.status] || STATUS_CONFIG.pending;
                    return (
                      <div key={code.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: '#F8F9FA' }}>
                        <div>
                          <p className="font-semibold text-sm" style={{ color: '#002050' }}>{code.code_name || code.code}</p>
                          <p className="text-xs" style={{ color: '#9CA3AF' }}>
                            {code.used_count}/{code.max_users} utilisateurs
                          </p>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: cfg.bg, color: cfg.color }}>
                          {cfg.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
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
                <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Les codes doivent être validés par le super-admin avant distribution</p>
              </div>
              {org.status === 'validated' && (
                <button onClick={() => setShowNewCode(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
                  style={{ background: '#002050' }}>
                  <Plus size={15} /> Créer un code
                </button>
              )}
            </div>

            {org.status !== 'validated' && (
              <div className="p-4 rounded-xl border flex items-start gap-3" style={{ background: '#FFFBEB', borderColor: '#FDE68A' }}>
                <AlertCircle size={16} style={{ color: '#D97706', flexShrink: 0, marginTop: 1 }} />
                <p className="text-sm" style={{ color: '#92400E' }}>
                  Votre organisation doit être validée par le super-admin avant de pouvoir créer des codes.
                </p>
              </div>
            )}

            {codes.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-dashed p-12 text-center" style={{ borderColor: '#E4E7EC' }}>
                <Key size={40} className="mx-auto mb-3 opacity-20" style={{ color: '#002050' }} />
                <p className="font-bold" style={{ color: '#002050' }}>Aucun code créé</p>
                <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>Créez un code pour distribuer à vos membres</p>
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
                          <div className="flex items-center gap-4 text-sm flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-base" style={{ color: '#002050' }}>{code.code}</span>
                              <button onClick={() => { navigator.clipboard?.writeText(code.code); showToast('Code copié'); }}>
                                <Copy size={12} style={{ color: '#9CA3AF' }} />
                              </button>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs" style={{ color: '#6B7280' }}>PIN :</span>
                              {showPinFor === code.id ? (
                                <span className="font-mono font-bold" style={{ color: '#002050' }}>{code.pin}</span>
                              ) : (
                                <span className="font-mono" style={{ color: '#9CA3AF' }}>••••</span>
                              )}
                              <button onClick={() => setShowPinFor(showPinFor === code.id ? null : code.id)}>
                                {showPinFor === code.id ? <EyeOff size={12} style={{ color: '#9CA3AF' }} /> : <Eye size={12} style={{ color: '#9CA3AF' }} />}
                              </button>
                            </div>
                          </div>
                          {/* Barre d'utilisation */}
                          <div className="mt-3">
                            <div className="flex justify-between text-xs mb-1">
                              <span style={{ color: '#6B7280' }}>{code.used_count} / {code.max_users} utilisateurs</span>
                              <span style={{ color: '#6B7280' }}>{usagePercent}%</span>
                            </div>
                            <div className="h-1.5 rounded-full" style={{ background: '#E4E7EC' }}>
                              <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min(usagePercent, 100)}%`, background: usagePercent >= 90 ? '#DC2626' : '#002050' }} />
                            </div>
                          </div>
                          {/* Avantages */}
                          {Object.keys(code.advantages).length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {code.advantages.cv_tokens && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#FEF3C7', color: '#92400E' }}>{String(code.advantages.cv_tokens)} jetons CV</span>}
                              {code.advantages.pdf_export_free && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#D1FAE5', color: '#065F46' }}>PDF gratuit</span>}
                              {code.advantages.premium_templates && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>Templates premium</span>}
                              {code.advantages.career_studio_access && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#F5F3FF', color: '#7C3AED' }}>Career Studio</span>}
                            </div>
                          )}
                          {code.expires_at && (
                            <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
                              Expire le {new Date(code.expires_at).toLocaleDateString('fr-FR')}
                            </p>
                          )}
                        </div>
                        {/* Actions */}
                        <div className="flex gap-2 flex-wrap">
                          {code.status === 'draft' && (
                            <button onClick={() => submitCode(code.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                              style={{ background: '#1E7A52' }}>
                              <ChevronRight size={12} /> Soumettre au super-admin
                            </button>
                          )}
                        </div>
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
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold" style={{ color: '#002050' }}>Membres liés</h2>
                <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Apprenants ayant activé un code de votre organisation</p>
              </div>
            </div>
            {members.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-dashed p-12 text-center" style={{ borderColor: '#E4E7EC' }}>
                <Users size={40} className="mx-auto mb-3 opacity-20" style={{ color: '#002050' }} />
                <p className="font-bold" style={{ color: '#002050' }}>Aucun membre lié</p>
                <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>Les membres apparaîtront ici après avoir activé un code</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: '#E4E7EC' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#F8F9FA', borderBottom: '1px solid #E4E7EC' }}>
                      <th className="text-left px-4 py-3 font-semibold" style={{ color: '#6B7280' }}>Membre</th>
                      <th className="text-left px-4 py-3 font-semibold" style={{ color: '#6B7280' }}>Code utilisé</th>
                      <th className="text-left px-4 py-3 font-semibold" style={{ color: '#6B7280' }}>Statut</th>
                      <th className="text-left px-4 py-3 font-semibold" style={{ color: '#6B7280' }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m, i) => {
                      const cfg = STATUS_CONFIG[m.status] || STATUS_CONFIG.pending;
                      return (
                        <tr key={m.id} style={{ borderBottom: i < members.length - 1 ? '1px solid #E4E7EC' : 'none' }}>
                          <td className="px-4 py-3">
                            <p className="font-semibold" style={{ color: '#002050' }}>{m.users?.full_name || 'Inconnu'}</p>
                            <p className="text-xs" style={{ color: '#9CA3AF' }}>{m.users?.email}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs font-bold" style={{ color: '#002050' }}>{m.partner_codes?.code}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                          </td>
                          <td className="px-4 py-3 text-xs" style={{ color: '#9CA3AF' }}>
                            {new Date(m.activated_at).toLocaleDateString('fr-FR')}
                          </td>
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
            <div className="flex items-center justify-between">
              <h2 className="font-bold" style={{ color: '#002050' }}>Gestionnaires</h2>
            </div>
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
                { label: 'Total codes créés', value: codes.length },
                { label: 'Codes validés', value: validatedCodes.length },
                { label: 'Codes en attente', value: pendingCodes.length },
                { label: 'Membres actifs', value: totalMembers },
                { label: 'Membres en attente', value: members.filter(m => m.status === 'pending').length },
                { label: 'Taux d\'utilisation moyen', value: codes.length > 0 ? `${Math.round(codes.reduce((acc, c) => acc + (c.used_count / c.max_users * 100), 0) / codes.length)}%` : '0%' },
              ].map(stat => (
                <div key={stat.label} className="bg-white rounded-xl border p-4" style={{ borderColor: '#E4E7EC' }}>
                  <p className="text-2xl font-black" style={{ color: '#002050' }}>{stat.value}</p>
                  <p className="text-xs mt-1" style={{ color: '#6B7280' }}>{stat.label}</p>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl border p-5" style={{ borderColor: '#E4E7EC' }}>
              <p className="text-sm font-semibold mb-2" style={{ color: '#002050' }}>Note</p>
              <p className="text-sm" style={{ color: '#6B7280' }}>
                Les statistiques détaillées (jetons consommés, exports, etc.) sont disponibles dans le dashboard super-admin. Contactez Omnia Global Academy pour plus d'informations.
              </p>
            </div>
          </div>
        )}

      </div>

      {/* ── MODAL Nouveau code ─────────────────────────── */}
      {showNewCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#E4E7EC' }}>
              <div>
                <h3 className="font-bold text-lg" style={{ color: '#002050' }}>Créer un code d'accès</h3>
                <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>Le code sera soumis au super-admin pour validation</p>
              </div>
              <button onClick={() => setShowNewCode(false)}><X size={20} style={{ color: '#6B7280' }} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#002050' }}>Nom du code</label>
                <input className={inputCls} style={inputStyle} value={newCode.code_name} onChange={e => setNewCode(p => ({ ...p, code_name: e.target.value }))} placeholder="Ex: Promotion 2026, Salariés..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#002050' }}>Code personnalisé (optionnel)</label>
                  <input className={inputCls} style={inputStyle} value={newCode.custom_code} onChange={e => setNewCode(p => ({ ...p, custom_code: e.target.value.toUpperCase() }))} placeholder="Ex: ECOLE2026 (auto si vide)" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#002050' }}>PIN personnalisé (optionnel)</label>
                  <input className={inputCls} style={inputStyle} value={newCode.custom_pin} onChange={e => setNewCode(p => ({ ...p, custom_pin: e.target.value }))} placeholder="4 chiffres (auto si vide)" maxLength={4} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#002050' }}>Quota max d'utilisateurs</label>
                  <input className={inputCls} style={inputStyle} type="number" min={1} value={newCode.max_users} onChange={e => setNewCode(p => ({ ...p, max_users: parseInt(e.target.value) || 100 }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#002050' }}>Date d'expiration (optionnel)</label>
                  <input className={inputCls} style={inputStyle} type="date" value={newCode.expires_at} onChange={e => setNewCode(p => ({ ...p, expires_at: e.target.value }))} />
                </div>
              </div>

              {/* Avantages */}
              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: '#002050' }}>Avantages demandés</label>
                <p className="text-xs mb-3" style={{ color: '#9CA3AF' }}>Ces avantages seront validés et éventuellement modifiés par le super-admin</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: '#E4E7EC' }}>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#002050' }}>Accès Career Studio</p>
                      <p className="text-xs" style={{ color: '#9CA3AF' }}>Accès au module CV Builder</p>
                    </div>
                    <input type="checkbox" checked={!!newCode.advantages.career_studio_access} onChange={e => setNewCode(p => ({ ...p, advantages: { ...p.advantages, career_studio_access: e.target.checked } }))} style={{ accentColor: '#002050', width: '16px', height: '16px' }} />
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg border" style={{ borderColor: '#E4E7EC' }}>
                    <div className="flex-1">
                      <p className="text-sm font-semibold" style={{ color: '#002050' }}>Jetons CV offerts</p>
                    </div>
                    <input type="number" min={0} max={20} value={Number(newCode.advantages.cv_tokens)} onChange={e => setNewCode(p => ({ ...p, advantages: { ...p.advantages, cv_tokens: parseInt(e.target.value) || 0 } }))} className="w-16 px-2 py-1.5 border rounded-lg text-sm text-center" style={{ borderColor: '#E4E7EC' }} />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: '#E4E7EC' }}>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#002050' }}>Export PDF gratuit</p>
                      <p className="text-xs" style={{ color: '#9CA3AF' }}>Sans consommer de jetons</p>
                    </div>
                    <input type="checkbox" checked={!!newCode.advantages.pdf_export_free} onChange={e => setNewCode(p => ({ ...p, advantages: { ...p.advantages, pdf_export_free: e.target.checked } }))} style={{ accentColor: '#002050', width: '16px', height: '16px' }} />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: '#E4E7EC' }}>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#002050' }}>Templates premium</p>
                      <p className="text-xs" style={{ color: '#9CA3AF' }}>Accès aux 14 modèles premium</p>
                    </div>
                    <input type="checkbox" checked={!!newCode.advantages.premium_templates} onChange={e => setNewCode(p => ({ ...p, advantages: { ...p.advantages, premium_templates: e.target.checked } }))} style={{ accentColor: '#002050', width: '16px', height: '16px' }} />
                  </div>
                </div>
              </div>

              {/* Validation manuelle */}
              <div className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: '#E4E7EC' }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#002050' }}>Validation manuelle des membres</p>
                  <p className="text-xs" style={{ color: '#9CA3AF' }}>Vous validez chaque membre manuellement</p>
                </div>
                <input type="checkbox" checked={newCode.requires_manual_validation} onChange={e => setNewCode(p => ({ ...p, requires_manual_validation: e.target.checked }))} style={{ accentColor: '#002050', width: '16px', height: '16px' }} />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowNewCode(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium"
                  style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>
                  Annuler
                </button>
                <button onClick={createCode} disabled={creatingCode || !newCode.code_name}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: '#002050' }}>
                  {creatingCode ? '⏳ Création...' : 'Créer le code'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
