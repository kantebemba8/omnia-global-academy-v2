import { getSessionToken } from '../../lib/session';
import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { Bell, Lock, Mail, Phone, User } from 'lucide-react';

type StoredUser = {
  id?: string;
  full_name?: string;
  name?: string;
  email?: string;
  phone_number?: string;
  country_code?: string;
  roles?: string[];
};

function apiBase() {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  return url ? `${url}/functions/v1` : '/api';
}

export default function AdminProfile() {
  const [user, setUser] = useState<StoredUser>({});
  const [tab, setTab] = useState<'info'|'security'|'notifications'>('info');
  const [form, setForm] = useState({ full_name:'', email:'', phone_number:'', country_code:'' });
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const parsed: StoredUser = JSON.parse(localStorage.getItem('omnia_user') || '{}');
      setUser(parsed);
      setForm({
        full_name: parsed.full_name || parsed.name || '',
        email: parsed.email || '',
        phone_number: parsed.phone_number || '',
        country_code: parsed.country_code || '',
      });
    } catch {
      setUser({});
    }
  }, []);

  async function save() {
    const token = getSessionToken();
    if (!token) { setMsg('Session introuvable.'); return; }
    setSaving(true); setMsg('');
    try {
      const res = await fetch(`${apiBase()}/auth-update-profile`, {
        method:'PATCH',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body:JSON.stringify(form),
      });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(data?.message || data?.error || 'Mise à jour impossible');
      const next = { ...user, ...(data.user || {}), ...form };
      localStorage.setItem('omnia_user', JSON.stringify(next));
      setUser(next);
      setMsg('Profil mis à jour.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  return <AdminLayout>
    <div className="mx-auto max-w-3xl p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-[#002050]">Mon compte administratif</h1>
      <p className="mt-1 text-sm text-slate-500">Votre compte administratif reste protégé, même pendant la prévisualisation d’un autre espace.</p>

      <div className="mt-6 rounded-2xl border bg-white p-5">
        <div className="font-bold text-[#002050]">{user.full_name || user.name || 'Compte administratif'}</div>
        <div className="text-sm text-slate-500">{user.email}</div>
        <div className="mt-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">Administration Omnia</div>
      </div>

      <div className="mt-5 flex gap-1 rounded-xl bg-slate-100 p-1">
        <button onClick={()=>setTab('info')} className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${tab==='info'?'bg-[#002050] text-white':''}`}><User className="mr-2 inline h-4 w-4"/>Informations</button>
        <button onClick={()=>setTab('security')} className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${tab==='security'?'bg-[#002050] text-white':''}`}><Lock className="mr-2 inline h-4 w-4"/>Sécurité</button>
        <button onClick={()=>setTab('notifications')} className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${tab==='notifications'?'bg-[#002050] text-white':''}`}><Bell className="mr-2 inline h-4 w-4"/>Notifications</button>
      </div>

      <div className="mt-4 rounded-2xl border bg-white p-5">
        {tab==='info' && <div className="space-y-4">
          <label className="block"><span className="text-sm font-semibold">Nom complet</span><div className="relative mt-1"><User className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input className="w-full rounded-xl border py-2.5 pl-10 pr-3" value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})}/></div></label>
          <label className="block"><span className="text-sm font-semibold">Email</span><div className="relative mt-1"><Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input type="email" className="w-full rounded-xl border py-2.5 pl-10 pr-3" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div></label>
          <label className="block"><span className="text-sm font-semibold">Téléphone</span><div className="relative mt-1"><Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input className="w-full rounded-xl border py-2.5 pl-10 pr-3" value={form.phone_number} onChange={e=>setForm({...form,phone_number:e.target.value})}/></div></label>
          <button disabled={saving} onClick={save} className="rounded-xl bg-[#002050] px-5 py-3 font-bold text-white disabled:opacity-50">{saving?'Enregistrement...':'Enregistrer'}</button>
        </div>}
        {tab==='security' && <p className="text-sm text-slate-600">La sécurité et le mot de passe restent liés à votre compte administratif réel. Cette page ne bascule jamais vers le contexte Apprenant.</p>}
        {tab==='notifications' && <p className="text-sm text-slate-600">Les préférences de notifications du compte administratif pourront être gérées ici sans utiliser le profil Apprenant.</p>}
        {msg && <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">{msg}</div>}
      </div>
    </div>
  </AdminLayout>;
}
