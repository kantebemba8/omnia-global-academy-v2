import { useEffect, useRef, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { ENDPOINTS } from '../../lib/config';
import {
  Monitor, RefreshCw, AlertTriangle, Clock, CheckCircle,
  ShieldCheck, Wifi, WifiOff, BookOpen,
} from 'lucide-react';

interface DemoConfig {
  id: string;
  configured_at: string;
  expires_at: string | null;
  configured_by_name: string;
  demo_roles: string[];
  demo_course_ids: string[];
  is_online: boolean;
  last_seen_at: string | null;
}

interface DemoStatus {
  is_active: boolean;
  last_activity: string | null;
  time_remaining_seconds: number;
}

interface Course {
  id: string;
  title: string;
}

const ROLE_OPTIONS = [
  { key: 'apprenant', label: 'Apprenant' },
  { key: 'professeur', label: 'Professeur' },
 { key: 'responsable_structure', label: 'Responsable de structure' },
  { key: 'moderateur', label: 'Modérateur' },
];

function generate12() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let pwd = '';
  for (let i = 0; i < 12; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
}

function formatCountdown(seconds: number) {
  if (seconds <= 0) return 'Expiré';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

export default function AdminDemoAccess() {
  const [configs, setConfigs] = useState<DemoConfig[]>([]);
  const [status, setStatus] = useState<DemoStatus | null>(null);
  const [publishedCourses, setPublishedCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({
    password: '',
    expires_at: '',
    demo_roles: ['apprenant'] as string[],
    demo_course_ids: [] as string[],
  });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function load() {
    const token = localStorage.getItem('omnia_session_token');
    fetch(ENDPOINTS.adminDemoConfigure, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        setConfigs(d.configs ?? []);
        setStatus(d.status ?? null);
        setPublishedCourses(d.published_courses ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 15_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  function setF<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function toggleRole(role: string) {
    setForm((prev) => {
      const has = prev.demo_roles.includes(role);
      return {
        ...prev,
        demo_roles: has ? prev.demo_roles.filter((r) => r !== role) : [...prev.demo_roles, role],
      };
    });
  }

  function toggleCourse(id: string) {
    setForm((prev) => {
      const has = prev.demo_course_ids.includes(id);
      return {
        ...prev,
        demo_course_ids: has ? prev.demo_course_ids.filter((c) => c !== id) : [...prev.demo_course_ids, id],
      };
    });
  }

  async function apply() {
    if (!form.password || !form.expires_at) return;
    if (form.demo_roles.length === 0) {
      setToast('Sélectionnez au moins un rôle démo.');
      setTimeout(() => setToast(''), 4000);
      return;
    }
    setSubmitting(true);
    const token = localStorage.getItem('omnia_session_token');
    const res = await fetch(ENDPOINTS.adminDemoConfigure, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        new_password: form.password,
        expires_at: form.expires_at,
        demo_roles: form.demo_roles,
        demo_course_ids: form.demo_course_ids,
      }),
    });
    const d = await res.json();
    setSubmitting(false);
    if (d.success) {
      setToast('Configuration appliquée. Toutes les sessions démo ont été invalidées.');
      setForm({ password: '', expires_at: '', demo_roles: ['apprenant'], demo_course_ids: [] });
      load();
    } else {
      setToast(d.message ?? d.error ?? 'Erreur lors de la configuration.');
    }
    setTimeout(() => setToast(''), 5000);
  }

  const latestConfig = configs[0] ?? null;
  const isExpired = latestConfig?.expires_at ? new Date(latestConfig.expires_at) < new Date() : false;

  return (
    <AdminLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {toast && (
          <div className="fixed top-4 right-4 z-50 bg-white shadow-lg rounded-xl px-5 py-3 text-sm font-medium border border-gray-200 max-w-sm"
            style={{ color: '#002050' }}>{toast}</div>
        )}

        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#002050' }}>Accès Démo</h1>
          <p className="text-gray-500 text-sm mt-0.5">Gestion du compte de démonstration de la plateforme</p>
        </div>

        {/* Status card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#002050' }}>
                <Monitor className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-gray-800">test@omniaglobalacademy.com</p>
                <p className="text-xs text-gray-400 mt-0.5">Compte de démonstration — email non modifiable</p>
              </div>
            </div>

            {!loading && status !== null && (
              <div className="flex items-center gap-1.5">
                {status.is_active ? (
                  <>
                    <Wifi className="w-4 h-4 text-green-500" />
                    <span className="text-xs font-medium text-green-600">En ligne</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-4 h-4 text-gray-300" />
                    <span className="text-xs font-medium text-gray-400">Déconnecté</span>
                  </>
                )}
              </div>
            )}
          </div>

          {!loading && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Temps restant</p>
                <p className="text-sm font-bold mt-0.5" style={{ color: isExpired ? '#DC2626' : '#002050' }}>
                  {isExpired ? 'Expiré' : formatCountdown(status?.time_remaining_seconds ?? 0)}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Dernière activité</p>
                <p className="text-sm font-medium text-gray-700 mt-0.5">
                  {status?.last_activity
                    ? new Date(status.last_activity).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                    : '—'}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Rôles actifs</p>
                <p className="text-sm font-medium text-gray-700 mt-0.5">
                  {latestConfig?.demo_roles?.length
                    ? latestConfig.demo_roles.join(', ')
                    : '—'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Config form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
          <h3 className="font-semibold" style={{ color: '#002050' }}>Nouvelle configuration</h3>

          <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Cette action invalide <strong>immédiatement</strong> toute session démo en cours et remplace le mot de passe du compte.
            </p>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nouveau mot de passe</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.password}
                onChange={(e) => setF('password', e.target.value)}
                placeholder="Mot de passe du compte démo"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none"
              />
              <button
                onClick={() => setF('password', generate12())}
                className="px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50 flex items-center gap-1 whitespace-nowrap"
              >
                <RefreshCw className="w-3 h-3" /> Générer
              </button>
            </div>
          </div>

          {/* Expiry */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date et heure d'expiration</label>
            <input
              type="datetime-local"
              value={form.expires_at}
              onChange={(e) => setF('expires_at', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
              min={new Date().toISOString().slice(0, 16)}
            />
          </div>

          {/* Roles */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Rôles accessibles dans la démo</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ROLE_OPTIONS.map((opt) => {
                const checked = form.demo_roles.includes(opt.key);
                return (
                  <label
                    key={opt.key}
                    className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                      checked ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRole(opt.key)}
                      className="rounded"
                      style={{ accentColor: '#002050' }}
                    />
                    <span className="text-xs font-medium" style={{ color: checked ? '#002050' : '#6B7280' }}>
                      {opt.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Course preloading */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              <BookOpen className="w-3.5 h-3.5 inline mr-1" />
              Cours pré-inscrits pour la démo (optionnel)
            </label>
            {publishedCourses.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">Aucun cours publié disponible.</p>
            ) : (
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                {publishedCourses.map((course) => {
                  const selected = form.demo_course_ids.includes(course.id);
                  return (
                    <label
                      key={course.id}
                      className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${selected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleCourse(course.id)}
                        className="rounded flex-shrink-0"
                        style={{ accentColor: '#002050' }}
                      />
                      <span className="text-xs text-gray-700 truncate">{course.title}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={apply}
              disabled={submitting || !form.password || !form.expires_at}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-60"
              style={{ backgroundColor: '#002050' }}
            >
              <CheckCircle className="w-4 h-4" />
              {submitting ? 'Application…' : 'Appliquer la configuration'}
            </button>
          </div>
        </div>

        {/* Rules */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4" style={{ color: '#002050' }} />
            <h3 className="font-semibold text-sm" style={{ color: '#002050' }}>Règles du compte démo</h3>
          </div>
          <ul className="space-y-2">
            {[
              'Le compte démo utilise toujours l\'adresse test@omniaglobalacademy.com — non modifiable.',
              'Une nouvelle configuration invalide immédiatement toutes les sessions démo actives.',
              'Une seule session simultanée : toute nouvelle connexion démo expulse la session précédente.',
              'Le compte démo ne peut pas effectuer d\'achats réels ni de retraits.',
              'L\'accès démo est automatiquement révoqué à la date d\'expiration configurée.',
            ].map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                  style={{ backgroundColor: '#EFF6FF', color: '#002050' }}>{i + 1}</span>
                {r}
              </li>
            ))}
          </ul>
        </div>

        {/* History */}
        <div>
          <h3 className="font-semibold text-sm mb-3" style={{ color: '#002050' }}>Historique des configurations</h3>
          {loading ? (
            <div className="flex items-center justify-center h-24">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
            </div>
          ) : configs.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-gray-100">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-20" style={{ color: '#002050' }} />
              <p className="text-gray-400 text-sm">Aucune configuration enregistrée</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Configuré le', 'Par', 'Expiration', 'Rôles'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {configs.map((c, idx) => {
                    const exp = c.expires_at ? new Date(c.expires_at) < new Date() : false;
                    return (
                      <tr key={c.id} className={`transition-colors ${idx === 0 ? 'bg-blue-50/40' : 'hover:bg-gray-50'}`}>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {new Date(c.configured_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          {idx === 0 && (
                            <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#EFF6FF', color: '#002050' }}>
                              Actif
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-700">{c.configured_by_name}</td>
                        <td className="px-4 py-3 text-xs">
                          {c.expires_at ? (
                            <span className={exp ? 'text-red-500' : 'text-gray-600'}>
                              {new Date(c.expires_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              {exp && ' (expiré)'}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {Array.isArray(c.demo_roles) && c.demo_roles.length > 0
                            ? c.demo_roles.join(', ')
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
