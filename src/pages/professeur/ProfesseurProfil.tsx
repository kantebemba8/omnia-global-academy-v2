import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/DashboardLayout';
import { User, Mail, Phone, Globe, Lock, Eye, EyeOff, CheckCircle, AlertTriangle, FileText } from 'lucide-react';

import { CATEGORY_LABELS } from '../../lib/categories';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { getSessionToken, saveSession } from '../../lib/session';
interface ProfUser {
  id: string; full_name: string; email: string; phone_number: string;
  country_code: string; allow_email: boolean; allow_sms: boolean;
  allow_push: boolean; subscribe_newsletter: boolean;
}

interface ProfProfile {
  bio: string | null; expertise_domain: string | null; cv_diploma_url: string | null; kyc_status: string;
}

const CATEGORIES = CATEGORY_LABELS;

function getApiBase() {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  return url ? `${url}/functions/v1` : '/api';
}

function monogram(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

export function ProfesseurProfil() {
  const [user, setUser] = useState<ProfUser | null>(null);
  const [profile, setProfile] = useState<ProfProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'info' | 'securite' | 'profil_pro'>('info');

  const [form, setForm] = useState({ full_name: '', email: '', phone_number: '', country_code: '' });
  const [profForm, setProfForm] = useState({ bio: '', expertise_domain: '', signature_url: '' });
  const [notifs, setNotifs] = useState({ allow_email: true, allow_sms: true, allow_push: false, subscribe_newsletter: false });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const navigate = useNavigate();

  const bypassAuth = new URLSearchParams(window.location.search).get('preview') === 'true' &&
    (() => { try { return JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false; } catch { return false; } })();

  const load = useCallback(async () => {
    if (bypassAuth) { setLoading(false); return; }
    const token = getSessionToken();
    if (!token && !bypassAuth) { navigate('/connexion'); return; }
    try {
      const res = await fetch(`${getApiBase()}/dashboard-professeur`, { headers: edgeAuthHeaders() });
      if (res.status === 403 && !bypassAuth) { navigate('/connexion'); return; }
      const json = await res.json();
      if (res.ok && json.user) {
        const u = json.user as ProfUser;
        const professor = (json.professeur || null) as (ProfProfile & { signature_url?: string | null }) | null;
        setUser(u);
        setProfile(professor);
        setForm({ full_name: u.full_name, email: u.email, phone_number: u.phone_number, country_code: u.country_code ?? '' });
        setNotifs({ allow_email: u.allow_email ?? true, allow_sms: u.allow_sms ?? true, allow_push: u.allow_push ?? false, subscribe_newsletter: u.subscribe_newsletter ?? false });
        setProfForm({
          bio: professor?.bio ?? '',
          expertise_domain: professor?.expertise_domain ?? '',
          signature_url: professor?.signature_url ?? '',
        });
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [navigate, bypassAuth]);

  useEffect(() => { load(); }, [load]);

  async function saveProfile() {
    const token = getSessionToken();
    if (!token) return;
    setSaving(true); setMsg(null);
    try {
      const res = await fetch(`${getApiBase()}/auth-update-profile`, {
        method: 'PATCH',
        headers: edgeAuthHeaders(),
        body: JSON.stringify({
          ...form,
          ...notifs,
          professor_profile: { bio: profForm.bio, expertise_domain: profForm.expertise_domain },
        }),
      });
      const json = await res.json();
      if (!res.ok) { setMsg({ text: json.error || 'Erreur', ok: false }); return; }
      if (json.professor_profile) setProfile(json.professor_profile as ProfProfile);
      setMsg({ text: 'Profil mis à jour.', ok: true });
      const stored = localStorage.getItem('omnia_user');
      if (stored) { try { localStorage.setItem('omnia_user', JSON.stringify({ ...JSON.parse(stored), ...json.user })); } catch { /* ignore */ } }
    } catch { setMsg({ text: 'Erreur réseau', ok: false }); }
    finally { setSaving(false); }
  }

  async function savePassword() {
    if (pwForm.newPw !== pwForm.confirm) { setPwMsg({ text: 'Mots de passe différents.', ok: false }); return; }
    if (pwForm.newPw.length < 8) { setPwMsg({ text: 'Minimum 8 caractères.', ok: false }); return; }
    const token = getSessionToken();
    if (!token) return;
    setPwSaving(true); setPwMsg(null);
    try {
      const res = await fetch(`${getApiBase()}/auth-change-password`, {
        method: 'POST',
        headers: edgeAuthHeaders(),
        body: JSON.stringify({ current_password: pwForm.current, new_password: pwForm.newPw }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) { setPwMsg({ text: json.message || 'Erreur', ok: false }); return; }
      if (json.session_token && json.user) saveSession(json.session_token, json.user);
      setPwMsg({ text: 'Mot de passe modifié.', ok: true });
      setPwForm({ current: '', newPw: '', confirm: '' });
    } catch { setPwMsg({ text: 'Erreur réseau', ok: false }); }
    finally { setPwSaving(false); }
  }

  const TABS = [
    { key: 'info' as const, label: 'Informations', icon: User },
    { key: 'profil_pro' as const, label: 'Profil professionnel', icon: FileText },
    { key: 'securite' as const, label: 'Sécurité', icon: Lock },
  ];

  return (
    <DashboardLayout role="professeur">
      <div className="p-6 lg:p-8 max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Configuration profil</h1>
          <p className="text-gray-500 text-sm mt-1">Gérez vos informations et votre profil public</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <>
            {/* Avatar */}
            <div className="flex items-center gap-4 mb-6 bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold"
                style={{ backgroundColor: '#BF8813', color: '#002050' }}>
                {user ? monogram(user.full_name) : '?'}
              </div>
              <div>
                <p className="font-bold text-gray-900">{user?.full_name}</p>
                <p className="text-gray-500 text-sm">{user?.email}</p>
                <p className="mt-1 text-xs" style={{ color: '#BF8813' }}>
                  Le profil public sera disponible après sa validation dans Omnia Talent.
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-5">
              {TABS.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all"
                  style={tab === t.key ? { backgroundColor: '#002050', color: 'white' } : { color: '#6b7280' }}>
                  <t.icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              {/* Info tab */}
              {tab === 'info' && (
                <div className="p-5 space-y-4">
                  {[
                    { key: 'full_name', label: 'Nom complet', icon: User, type: 'text' },
                    { key: 'email', label: 'Email', icon: Mail, type: 'email' },
                    { key: 'phone_number', label: 'Téléphone', icon: Phone, type: 'tel' },
                    { key: 'country_code', label: 'Pays (code ISO)', icon: Globe, type: 'text' },
                  ].map((f) => (
                    <div key={f.key}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                      <div className="relative">
                        <f.icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input type={f.type} value={(form as Record<string, string>)[f.key] ?? ''}
                          onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-gray-400" />
                      </div>
                    </div>
                  ))}

                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-sm font-semibold text-gray-700 mb-3">Préférences de communication</p>
                    {[
                      { key: 'allow_email', label: 'Emails' },
                      { key: 'allow_sms', label: 'SMS' },
                      { key: 'subscribe_newsletter', label: 'Newsletter' },
                    ].map((n) => (
                      <div key={n.key} className="flex items-center justify-between py-2">
                        <span className="text-sm text-gray-700">{n.label}</span>
                        <button onClick={() => setNotifs((p) => ({ ...p, [n.key]: !p[n.key as keyof typeof p] }))}
                          className="relative rounded-full transition-all"
                          style={{ width: 40, height: 22, backgroundColor: (notifs as Record<string, boolean>)[n.key] ? '#002050' : '#d1d5db' }}>
                          <span className="absolute top-0.5 bg-white rounded-full shadow-sm transition-all"
                            style={{ width: 18, height: 18, left: (notifs as Record<string, boolean>)[n.key] ? 20 : 2 }} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {msg && (
                    <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {msg.ok ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                      {msg.text}
                    </div>
                  )}
                  <div className="border-t border-gray-100 pt-4">
                    <label className="block text-sm font-medium text-gray-700">Signature professionnelle pour certificats</label>
                    <p className="text-xs text-gray-400 mt-1">Joignez une signature PNG transparente une seule fois. Elle pourra être utilisée uniquement sur les certificats des formations où votre signature est autorisée.</p>
                    {profForm.signature_url && <img src={profForm.signature_url} alt="Signature" className="h-16 object-contain mt-3 border rounded-lg p-2" />}
                    <label className="mt-3 inline-block px-3 py-2 border border-gray-200 rounded-lg text-sm cursor-pointer">
                      Joindre / remplacer la signature
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (e) => {
                        const file=e.target.files?.[0]; if(!file)return;
                        const reader=new FileReader();
                        reader.onload=async()=>{
                          const res=await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/certificate-admin`,{
                            method:'POST',
                            headers:edgeAuthHeaders(),
                            body:JSON.stringify({action:'upload_my_signature',filename:file.name,mime:file.type,data_url:String(reader.result)})
                          });
                          const data=await res.json().catch(()=>({}));
                          if(!res.ok||!data.url){setMsg({text:data.message||data.error||'Téléversement de la signature impossible.',ok:false});return;}
                          setProfForm((p)=>({...p,signature_url:data.url}));
                          setMsg({text:'Signature professionnelle enregistrée.',ok:true});
                        };
                        reader.readAsDataURL(file);
                      }}/>
                    </label>
                  </div>

                  <button onClick={saveProfile} disabled={saving}
                    className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                    style={{ backgroundColor: '#002050' }}>
                    {saving ? 'Sauvegarde...' : 'Enregistrer'}
                  </button>
                </div>
              )}

              {/* Pro profile tab */}
              {tab === 'profil_pro' && (
                <div className="p-5 space-y-4">
                  <p className="text-xs text-gray-400 bg-gray-50 p-3 rounded-lg">Ces informations sont visibles sur votre profil public formateur.</p>

                  {profile?.kyc_status && (
                    <div className="flex items-center gap-2 p-3 rounded-lg text-sm"
                      style={{ backgroundColor: profile.kyc_status === 'valide' ? '#ECFDF5' : '#FFFBEB', color: profile.kyc_status === 'valide' ? '#1E7A52' : '#92400E' }}>
                      {profile.kyc_status === 'valide' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                      Statut KYC : {profile.kyc_status === 'valide' ? 'Vérifié' : 'En attente de vérification'}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Domaine d'expertise</label>
                    <select value={profForm.expertise_domain} onChange={(e) => setProfForm((p) => ({ ...p, expertise_domain: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400">
                      <option value="">Sélectionner...</option>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Biographie</label>
                    <textarea rows={5} value={profForm.bio} onChange={(e) => setProfForm((p) => ({ ...p, bio: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-gray-400"
                      placeholder="Présentez votre parcours, vos expertises et ce qui vous motive à enseigner..." />
                  </div>

                  {profile?.cv_diploma_url && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <FileText className="w-5 h-5 text-gray-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700">CV / Diplôme soumis</p>
                        <a href={profile.cv_diploma_url} target="_blank" rel="noreferrer"
                          className="text-xs hover:underline" style={{ color: '#002050' }}>Voir le document</a>
                      </div>
                    </div>
                  )}

                  <button onClick={saveProfile} disabled={saving}
                    className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                    style={{ backgroundColor: '#002050' }}>
                    {saving ? 'Sauvegarde...' : 'Mettre à jour le profil pro'}
                  </button>
                </div>
              )}

              {/* Security tab */}
              {tab === 'securite' && (
                <div className="p-5 space-y-4">
                  {[
                    { key: 'current', label: 'Mot de passe actuel' },
                    { key: 'newPw', label: 'Nouveau mot de passe' },
                    { key: 'confirm', label: 'Confirmation' },
                  ].map((f) => (
                    <div key={f.key}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                      <div className="relative">
                        <input type={showPw ? 'text' : 'password'}
                          value={(pwForm as Record<string, string>)[f.key] ?? ''}
                          onChange={(e) => setPwForm((p) => ({ ...p, [f.key]: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 pr-10 py-2.5 text-sm focus:outline-none focus:border-gray-400" />
                        <button type="button" onClick={() => setShowPw((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                          {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  ))}
                  {pwMsg && (
                    <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${pwMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {pwMsg.ok ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                      {pwMsg.text}
                    </div>
                  )}
                  <button onClick={savePassword} disabled={pwSaving}
                    className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                    style={{ backgroundColor: '#002050' }}>
                    {pwSaving ? 'Modification...' : 'Changer le mot de passe'}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
