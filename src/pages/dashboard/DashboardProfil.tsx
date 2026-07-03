import { useEffect, useState, useCallback } from 'react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { User, Mail, Phone, Globe, Lock, Bell, AlertTriangle, CheckCircle, Eye, EyeOff } from 'lucide-react';

interface UserData {
  id: string; full_name: string; email: string; phone_number: string;
  country_code: string; avatar_url: string | null; allow_email: boolean;
  allow_sms: boolean; allow_push: boolean; subscribe_newsletter: boolean;
  ai_tokens: number;
}

function getApiBase() {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  return url ? `${url}/functions/v1` : '/api';
}

function monogram(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

export function DashboardProfil() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'info' | 'securite' | 'notifications'>('info');
  const [form, setForm] = useState({ full_name: '', email: '', phone_number: '', country_code: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Password form
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Notifs
  const [notifs, setNotifs] = useState({ allow_email: true, allow_sms: true, allow_push: false, subscribe_newsletter: false });
  const [notifSaving, setNotifSaving] = useState(false);

  const bypassAuth = new URLSearchParams(window.location.search).get('preview') === 'true' &&
    (() => { try { return JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false; } catch { return false; } })();

  const load = useCallback(async () => {
    if (bypassAuth) { setLoading(false); return; }
    const token = localStorage.getItem('omnia_session_token');
    if (!token) return;
    try {
      const res = await fetch(`${getApiBase()}/dashboard-apprenant`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (res.ok && json.user) {
        const stored = localStorage.getItem('omnia_user');
        let extra = {};
        if (stored) { try { extra = JSON.parse(stored); } catch { /* ignore */ } }
        const u: UserData = { ...extra, ...json.user, allow_email: true, allow_sms: true, allow_push: false, subscribe_newsletter: false };
        setUser(u);
        setForm({ full_name: u.full_name, email: u.email, phone_number: u.phone_number, country_code: u.country_code ?? 'ML' });
        setNotifs({ allow_email: u.allow_email, allow_sms: u.allow_sms, allow_push: u.allow_push, subscribe_newsletter: u.subscribe_newsletter });
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveProfile() {
    const token = localStorage.getItem('omnia_session_token');
    if (!token) return;
    setSaving(true); setMsg(null);
    try {
      const res = await fetch(`${getApiBase()}/auth-update-profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) { setMsg({ text: json.error === 'EMAIL_TAKEN' ? 'Email déjà utilisé.' : json.error === 'PHONE_TAKEN' ? 'Numéro déjà utilisé.' : 'Erreur de mise à jour.', ok: false }); return; }
      setMsg({ text: 'Profil mis à jour.', ok: true });
      // Update localStorage
      const stored = localStorage.getItem('omnia_user');
      if (stored) { try { localStorage.setItem('omnia_user', JSON.stringify({ ...JSON.parse(stored), ...json.user })); } catch { /* ignore */ } }
    } catch { setMsg({ text: 'Erreur réseau', ok: false }); }
    finally { setSaving(false); }
  }

  async function savePassword() {
    if (pwForm.newPw !== pwForm.confirm) { setPwMsg({ text: 'Les mots de passe ne correspondent pas.', ok: false }); return; }
    if (pwForm.newPw.length < 8) { setPwMsg({ text: 'Mot de passe trop court (min. 8 caractères).', ok: false }); return; }
    const token = localStorage.getItem('omnia_session_token');
    if (!token) return;
    setPwSaving(true); setPwMsg(null);
    try {
      const res = await fetch(`${getApiBase()}/auth-change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_password: pwForm.current, new_password: pwForm.newPw }),
      });
      const json = await res.json();
      if (!res.ok) { setPwMsg({ text: json.message || 'Erreur', ok: false }); return; }
      setPwMsg({ text: 'Mot de passe modifié avec succès.', ok: true });
      setPwForm({ current: '', newPw: '', confirm: '' });
    } catch { setPwMsg({ text: 'Erreur réseau', ok: false }); }
    finally { setPwSaving(false); }
  }

  async function saveNotifs() {
    const token = localStorage.getItem('omnia_session_token');
    if (!token) return;
    setNotifSaving(true);
    try {
      await fetch(`${getApiBase()}/auth-update-profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(notifs),
      });
    } catch { /* ignore */ }
    finally { setNotifSaving(false); }
  }

  const tabs = [
    { key: 'info' as const, label: 'Informations', icon: User },
    { key: 'securite' as const, label: 'Sécurité', icon: Lock },
    { key: 'notifications' as const, label: 'Notifications', icon: Bell },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Mon profil</h1>
          <p className="text-gray-500 text-sm mt-1">Gérez vos informations personnelles</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <>
            {/* Avatar */}
            <div className="flex items-center gap-4 mb-6 bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0"
                style={{ backgroundColor: '#BF8813', color: '#002050' }}>
                {user ? monogram(user.full_name) : '?'}
              </div>
              <div>
                <p className="font-bold text-gray-900">{user?.full_name}</p>
                <p className="text-gray-500 text-sm">{user?.email}</p>
                <p className="text-xs mt-1" style={{ color: '#BF8813' }}>{user?.ai_tokens ?? 0} jeton{(user?.ai_tokens ?? 0) !== 1 ? 's' : ''} IA</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-5">
              {tabs.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all"
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
                        <input
                          type={f.type}
                          value={(form as Record<string, string>)[f.key] ?? ''}
                          onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-gray-400"
                        />
                      </div>
                    </div>
                  ))}
                  {msg && (
                    <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {msg.ok ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                      {msg.text}
                    </div>
                  )}
                  <button onClick={saveProfile} disabled={saving}
                    className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                    style={{ backgroundColor: '#002050' }}>
                    {saving ? 'Sauvegarde...' : 'Enregistrer les modifications'}
                  </button>
                </div>
              )}

              {/* Security tab */}
              {tab === 'securite' && (
                <div className="p-5 space-y-4">
                  <p className="text-sm text-gray-500">Modifiez votre mot de passe. Minimum 8 caractères.</p>
                  {[
                    { key: 'current', label: 'Mot de passe actuel' },
                    { key: 'newPw', label: 'Nouveau mot de passe' },
                    { key: 'confirm', label: 'Confirmer le nouveau mot de passe' },
                  ].map((f) => (
                    <div key={f.key}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                      <div className="relative">
                        <input
                          type={showPw ? 'text' : 'password'}
                          value={(pwForm as Record<string, string>)[f.key] ?? ''}
                          onChange={(e) => setPwForm((p) => ({ ...p, [f.key]: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 pr-10 py-2.5 text-sm focus:outline-none focus:border-gray-400"
                        />
                        <button type="button" onClick={() => setShowPw((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
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
                    className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                    style={{ backgroundColor: '#002050' }}>
                    {pwSaving ? 'Modification...' : 'Changer le mot de passe'}
                  </button>
                </div>
              )}

              {/* Notifications tab */}
              {tab === 'notifications' && (
                <div className="p-5 space-y-4">
                  {[
                    { key: 'allow_email', label: 'Notifications par email', desc: 'Recevoir les mises à jour par email' },
                    { key: 'allow_sms', label: 'Notifications par SMS', desc: 'Recevoir les alertes importantes par SMS' },
                    { key: 'allow_push', label: 'Notifications push', desc: 'Notifications dans le navigateur' },
                    { key: 'subscribe_newsletter', label: 'Newsletter', desc: 'Actualités et nouveautés Omnia Academy' },
                  ].map((n) => (
                    <div key={n.key} className="flex items-center justify-between gap-4 py-3 border-b border-gray-50 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{n.label}</p>
                        <p className="text-xs text-gray-500">{n.desc}</p>
                      </div>
                      <button
                        onClick={() => setNotifs((p) => ({ ...p, [n.key]: !p[n.key as keyof typeof p] }))}
                        className="relative flex-shrink-0 w-10 h-5.5 rounded-full transition-all"
                        style={{ width: 40, height: 22, backgroundColor: (notifs as Record<string, boolean>)[n.key] ? '#002050' : '#d1d5db' }}>
                        <span className="absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full shadow-sm transition-all"
                          style={{ width: 18, height: 18, transform: (notifs as Record<string, boolean>)[n.key] ? 'translateX(18px)' : 'translateX(0)' }} />
                      </button>
                    </div>
                  ))}
                  <button onClick={saveNotifs} disabled={notifSaving}
                    className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                    style={{ backgroundColor: '#002050' }}>
                    {notifSaving ? 'Sauvegarde...' : 'Enregistrer les préférences'}
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
