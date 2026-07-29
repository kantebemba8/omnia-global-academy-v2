import { useCallback, useEffect, useState, type ElementType, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { DashboardLayout } from '../../components/DashboardLayout';
import {
  AlertTriangle, Bell, Briefcase, CheckCircle, Eye, EyeOff, Globe, Languages,
  Lock, Mail, MapPin, Phone, Target, User,
} from 'lucide-react';
import { credentialsRequest, LearnerSkillsPassportResponse, SkillsPassport } from '../../lib/credentialsApi';
import { isLearnerPreviewMode, previewSkillsPassport } from '../../lib/learnerPreview';
import { edgeAuthHeaders } from '../../lib/edgeAuth';

interface UserData {
  id: string; full_name: string; email: string; phone_number: string;
  country_code: string; avatar_url: string | null; allow_email: boolean;
  allow_sms: boolean; allow_push: boolean; subscribe_newsletter: boolean;
  ai_tokens: number;
}

type Tab = 'info' | 'professionnel' | 'securite' | 'notifications';
type MessageState = { text: string; ok: boolean } | null;

function getApiBase() {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  return url ? `${url}/functions/v1` : '/api';
}

function monogram(name: string) {
  const clean = name.trim();
  if (!clean) return '?';
  const parts = clean.split(/\s+/);
  return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : clean.slice(0, 2).toUpperCase();
}

function splitList(value: string) {
  return [...new Set(value.split(',').map(item => item.trim()).filter(Boolean))];
}

function professionalForm(passport: SkillsPassport) {
  return {
    title: passport.title || 'Omnia Skills Passport',
    professional_headline: passport.professional_headline || '',
    professional_summary: passport.professional_summary || '',
    target_roles: (passport.target_roles || []).join(', '),
    languages: (passport.languages || []).join(', '),
    location_text: passport.location_text || '',
    availability_text: passport.availability_text || '',
  };
}

const PREVIEW_USER: UserData = {
  id: 'preview', full_name: '', email: '', phone_number: '', country_code: '', avatar_url: null,
  allow_email: true, allow_sms: false, allow_push: true, subscribe_newsletter: false, ai_tokens: 0,
};

export function DashboardProfil() {
  const location = useLocation();
  const previewMode = isLearnerPreviewMode();
  const requestedTab = new URLSearchParams(location.search).get('tab');
  const initialTab: Tab = requestedTab === 'professionnel' ? 'professionnel' : 'info';

  const [user, setUser] = useState<UserData | null>(null);
  const [passport, setPassport] = useState<SkillsPassport | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [form, setForm] = useState({ full_name: '', email: '', phone_number: '', country_code: '' });
  const [proForm, setProForm] = useState(professionalForm(previewSkillsPassport()));
  const [saving, setSaving] = useState(false);
  const [proSaving, setProSaving] = useState(false);
  const [msg, setMsg] = useState<MessageState>(null);
  const [proMsg, setProMsg] = useState<MessageState>(null);

  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<MessageState>(null);

  const [notifs, setNotifs] = useState({ allow_email: true, allow_sms: true, allow_push: false, subscribe_newsletter: false });
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifMsg, setNotifMsg] = useState<MessageState>(null);

  useEffect(() => {
    if (requestedTab === 'professionnel') setTab('professionnel');
  }, [requestedTab]);

  const load = useCallback(async () => {
    if (previewMode) {
      const previewPassport = previewSkillsPassport();
      setUser(PREVIEW_USER);
      setForm({ full_name: '', email: '', phone_number: '', country_code: '' });
      setNotifs({ allow_email: true, allow_sms: false, allow_push: true, subscribe_newsletter: false });
      setPassport(previewPassport);
      setProForm(professionalForm(previewPassport));
      setLoading(false);
      return;
    }

    const token = localStorage.getItem('omnia_session_token');
    if (!token) { setLoading(false); return; }
    try {
      const [profileResponse, passportResponse] = await Promise.all([
        fetch(`${getApiBase()}/dashboard-apprenant`, { headers: edgeAuthHeaders() }),
        credentialsRequest<LearnerSkillsPassportResponse>('learner_skills_passport').catch(() => null),
      ]);
      const json = await profileResponse.json();
      if (profileResponse.ok && json.user) {
        const stored = localStorage.getItem('omnia_user');
        let extra = {};
        if (stored) { try { extra = JSON.parse(stored); } catch { /* ignore */ } }
        const u: UserData = {
          ...extra, ...json.user,
          allow_email: json.user.allow_email ?? true,
          allow_sms: json.user.allow_sms ?? false,
          allow_push: json.user.allow_push ?? true,
          subscribe_newsletter: json.user.subscribe_newsletter ?? false,
        };
        setUser(u);
        setForm({ full_name: u.full_name || '', email: u.email || '', phone_number: u.phone_number || '', country_code: u.country_code || '' });
        setNotifs({ allow_email: u.allow_email, allow_sms: u.allow_sms, allow_push: u.allow_push, subscribe_newsletter: u.subscribe_newsletter });
      }
      if (passportResponse?.passport) {
        setPassport(passportResponse.passport);
        setProForm(professionalForm(passportResponse.passport));
      }
    } catch { /* errors are shown only after an explicit save */ }
    finally { setLoading(false); }
  }, [previewMode]);

  useEffect(() => { void load(); }, [load]);

  async function saveProfile() {
    setSaving(true); setMsg(null);
    if (previewMode) {
      setUser(current => ({ ...(current || PREVIEW_USER), ...form }));
      setMsg({ text: 'Modifications visibles dans cet aperçu uniquement. Aucune donnée n’a été enregistrée.', ok: true });
      setSaving(false); return;
    }
    const token = localStorage.getItem('omnia_session_token');
    if (!token) { setSaving(false); return; }
    try {
      const res = await fetch(`${getApiBase()}/auth-update-profile`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg({ text: json.error === 'EMAIL_TAKEN' ? 'Email déjà utilisé.' : json.error === 'PHONE_TAKEN' ? 'Numéro déjà utilisé.' : 'Erreur de mise à jour.', ok: false });
        return;
      }
      setUser(current => current ? { ...current, ...json.user } : current);
      setMsg({ text: 'Profil mis à jour et synchronisé.', ok: true });
      const stored = localStorage.getItem('omnia_user');
      if (stored) { try { localStorage.setItem('omnia_user', JSON.stringify({ ...JSON.parse(stored), ...json.user })); } catch { /* ignore */ } }
      window.dispatchEvent(new CustomEvent('omnia:profile-updated', { detail: json.user }));
    } catch { setMsg({ text: 'Erreur réseau', ok: false }); }
    finally { setSaving(false); }
  }

  async function saveProfessionalProfile() {
    setProSaving(true); setProMsg(null);
    const payload = {
      ...proForm,
      target_roles: splitList(proForm.target_roles),
      languages: splitList(proForm.languages),
    };
    if (previewMode) {
      const updated = { ...(passport || previewSkillsPassport()), ...payload } as SkillsPassport;
      setPassport(updated); setProForm(professionalForm(updated));
      setProMsg({ text: 'Présentation mise à jour dans cet aperçu uniquement. Aucune donnée n’a été créée.', ok: true });
      setProSaving(false); return;
    }
    try {
      const response = await credentialsRequest<{ success: true; passport: SkillsPassport }>('learner_update_skills_passport_profile', payload);
      await credentialsRequest('learner_update_clr_profile', {
        title: 'Omnia Learning Record',
        profile_headline: payload.professional_headline,
        summary: payload.professional_summary,
      });
      setPassport(response.passport);
      setProMsg({ text: 'Profil professionnel synchronisé avec le Skills Passport et le Learning Record.', ok: true });
    } catch (cause) {
      setProMsg({ text: cause instanceof Error ? cause.message : 'Enregistrement impossible.', ok: false });
    } finally { setProSaving(false); }
  }

  async function savePassword() {
    if (previewMode) { setPwMsg({ text: 'La sécurité du compte n’est pas modifiable depuis une prévisualisation.', ok: false }); return; }
    if (pwForm.newPw !== pwForm.confirm) { setPwMsg({ text: 'Les mots de passe ne correspondent pas.', ok: false }); return; }
    if (pwForm.newPw.length < 8) { setPwMsg({ text: 'Mot de passe trop court (min. 8 caractères).', ok: false }); return; }
    const token = localStorage.getItem('omnia_session_token');
    if (!token) return;
    setPwSaving(true); setPwMsg(null);
    try {
      const res = await fetch(`${getApiBase()}/auth-change-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
    setNotifSaving(true); setNotifMsg(null);
    if (previewMode) {
      setNotifMsg({ text: 'Préférences mises à jour dans cet aperçu uniquement.', ok: true });
      setNotifSaving(false); return;
    }
    const token = localStorage.getItem('omnia_session_token');
    if (!token) { setNotifSaving(false); return; }
    try {
      const res = await fetch(`${getApiBase()}/auth-update-profile`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(notifs),
      });
      if (!res.ok) throw new Error();
      setNotifMsg({ text: 'Préférences enregistrées.', ok: true });
    } catch { setNotifMsg({ text: 'Enregistrement impossible.', ok: false }); }
    finally { setNotifSaving(false); }
  }

  const tabs = [
    { key: 'info' as const, label: 'Informations', icon: User },
    { key: 'professionnel' as const, label: 'Professionnel', icon: Briefcase },
    { key: 'securite' as const, label: 'Sécurité', icon: Lock },
    { key: 'notifications' as const, label: 'Notifications', icon: Bell },
  ];

  return <DashboardLayout><div className="mx-auto max-w-3xl p-6 lg:p-8">
    <div className="mb-6"><h1 className="text-2xl font-bold text-gray-900">Mon profil</h1><p className="mt-1 text-sm text-gray-500">Un seul profil pour vos espaces apprenant, Learning Record et Skills Passport.</p></div>
    {loading ? <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} /></div> : <>
      <div className="mb-6 flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full text-xl font-bold" style={{ backgroundColor: '#BF8813', color: '#002050' }}>{monogram(user?.full_name || '')}</div>
        <div><p className="font-bold text-gray-900">{user?.full_name || 'Votre profil'}</p>{!previewMode && user?.email && <p className="text-sm text-gray-500">{user.email}</p>}<p className="mt-1 text-xs" style={{ color: '#BF8813' }}>{user?.ai_tokens ?? 0} jeton{(user?.ai_tokens ?? 0) !== 1 ? 's' : ''} IA</p></div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 sm:grid-cols-4">{tabs.map(t => <button key={t.key} onClick={() => setTab(t.key)} className="flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all" style={tab === t.key ? { backgroundColor: '#002050', color: 'white' } : { color: '#6b7280' }}><t.icon className="h-3.5 w-3.5" /><span>{t.label}</span></button>)}</div>

      <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
        {tab === 'info' && <div className="space-y-4 p-5">
          <ProfileField label="Nom complet" icon={User}><input value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} className={inputClass} /></ProfileField>
          <ProfileField label="Email" icon={Mail}><input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className={inputClass} /></ProfileField>
          <ProfileField label="Téléphone" icon={Phone}><input type="tel" value={form.phone_number} onChange={e => setForm(p => ({ ...p, phone_number: e.target.value }))} className={inputClass} /></ProfileField>
          <ProfileField label="Pays (code ISO)" icon={Globe}><input value={form.country_code} onChange={e => setForm(p => ({ ...p, country_code: e.target.value.toUpperCase().slice(0, 2) }))} className={inputClass} /></ProfileField>
          <InlineMessage value={msg} /><SaveButton saving={saving} onClick={() => void saveProfile()} label="Enregistrer les informations" />
        </div>}

        {tab === 'professionnel' && <div className="space-y-4 p-5">
          <p className="text-sm text-gray-500">Ces informations alimentent automatiquement votre Skills Passport et la présentation de votre Learning Record.</p>
          <ProfileField label="Titre du passeport" icon={Briefcase}><input value={proForm.title} onChange={e => setProForm(p => ({ ...p, title: e.target.value }))} className={inputClass} /></ProfileField>
          <ProfileField label="Accroche professionnelle" icon={Target}><input value={proForm.professional_headline} onChange={e => setProForm(p => ({ ...p, professional_headline: e.target.value }))} className={inputClass} placeholder="Ex. Responsable QSE orienté développement durable" /></ProfileField>
          <label className="block"><span className="mb-1 block text-sm font-medium text-gray-700">Présentation professionnelle</span><textarea rows={5} value={proForm.professional_summary} onChange={e => setProForm(p => ({ ...p, professional_summary: e.target.value }))} className={plainInputClass} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <ProfileField label="Postes recherchés" icon={Target}><input value={proForm.target_roles} onChange={e => setProForm(p => ({ ...p, target_roles: e.target.value }))} className={inputClass} placeholder="Responsable QSE, ESG Analyst" /></ProfileField>
            <ProfileField label="Langues" icon={Languages}><input value={proForm.languages} onChange={e => setProForm(p => ({ ...p, languages: e.target.value }))} className={inputClass} placeholder="Français, Anglais" /></ProfileField>
            <ProfileField label="Localisation" icon={MapPin}><input value={proForm.location_text} onChange={e => setProForm(p => ({ ...p, location_text: e.target.value }))} className={inputClass} /></ProfileField>
            <ProfileField label="Disponibilité" icon={Briefcase}><input value={proForm.availability_text} onChange={e => setProForm(p => ({ ...p, availability_text: e.target.value }))} className={inputClass} placeholder="Disponible immédiatement" /></ProfileField>
          </div>
          <InlineMessage value={proMsg} /><SaveButton saving={proSaving} onClick={() => void saveProfessionalProfile()} label="Synchroniser le profil professionnel" />
        </div>}

        {tab === 'securite' && <div className="space-y-4 p-5"><p className="text-sm text-gray-500">Modifiez votre mot de passe. Minimum 8 caractères.</p>{[
          ['current', 'Mot de passe actuel'], ['newPw', 'Nouveau mot de passe'], ['confirm', 'Confirmer le nouveau mot de passe'],
        ].map(([key, label]) => <label key={key} className="block"><span className="mb-1 block text-sm font-medium text-gray-700">{label}</span><div className="relative"><input type={showPw ? 'text' : 'password'} value={(pwForm as Record<string, string>)[key]} onChange={e => setPwForm(p => ({ ...p, [key]: e.target.value }))} className={`${plainInputClass} pr-10`} /><button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></label>)}<InlineMessage value={pwMsg} /><SaveButton saving={pwSaving} onClick={() => void savePassword()} label="Changer le mot de passe" /></div>}

        {tab === 'notifications' && <div className="space-y-4 p-5">{[
          ['allow_email', 'Notifications par email', 'Recevoir les mises à jour par email'],
          ['allow_sms', 'Notifications par SMS', 'Recevoir les alertes importantes par SMS'],
          ['allow_push', 'Notifications push', 'Notifications dans le navigateur'],
          ['subscribe_newsletter', 'Newsletter', 'Actualités et nouveautés Omnia Academy'],
        ].map(([key, label, desc]) => <div key={key} className="flex items-center justify-between gap-4 border-b border-gray-50 py-3 last:border-0"><div><p className="text-sm font-medium text-gray-800">{label}</p><p className="text-xs text-gray-500">{desc}</p></div><button onClick={() => setNotifs(p => ({ ...p, [key]: !p[key as keyof typeof p] }))} className="relative flex-shrink-0 rounded-full" style={{ width: 40, height: 22, backgroundColor: (notifs as Record<string, boolean>)[key] ? '#002050' : '#d1d5db' }}><span className="absolute left-0.5 top-0.5 rounded-full bg-white shadow-sm transition-all" style={{ width: 18, height: 18, transform: (notifs as Record<string, boolean>)[key] ? 'translateX(18px)' : 'translateX(0)' }} /></button></div>)}<InlineMessage value={notifMsg} /><SaveButton saving={notifSaving} onClick={() => void saveNotifs()} label="Enregistrer les préférences" /></div>}
      </div>
    </>}
  </div></DashboardLayout>;
}

function ProfileField({ label, icon: Icon, children }: { label: string; icon: ElementType; children: ReactNode }) {
  return <label className="block"><span className="mb-1 block text-sm font-medium text-gray-700">{label}</span><div className="relative"><Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />{children}</div></label>;
}
function InlineMessage({ value }: { value: MessageState }) {
  if (!value) return null;
  return <div className={`flex items-center gap-2 rounded-lg p-3 text-sm ${value.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{value.ok ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{value.text}</div>;
}
function SaveButton({ saving, onClick, label }: { saving: boolean; onClick: () => void; label: string }) {
  return <button type="button" onClick={onClick} disabled={saving} className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: '#002050' }}>{saving ? 'Enregistrement…' : label}</button>;
}
const plainInputClass = 'w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400';
const inputClass = `${plainInputClass} pl-9`;
