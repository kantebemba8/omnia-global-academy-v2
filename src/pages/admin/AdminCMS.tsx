import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { ENDPOINTS } from '../../lib/config';
import { CATEGORY_LABELS } from '../../lib/categories';
import {
  Save, Settings, Eye, EyeOff, Plus, Trash2, AlertTriangle, Send, Mail,
  MessageSquare, Clock, Bot, Image, Captions, ToggleLeft, ToggleRight,
  Users, BarChart2, MapPin, TrendingUp, Coins, X,
} from 'lucide-react';

type Settings = Record<string, string>;
type Tab = 'general' | 'coming_soon' | 'landing' | 'partenaires' | 'legal' | 'avance' | 'newsletter' | 'ia';

const COMMISSION_KEYS = [
  { key: 'commission_normal_sans_cpd', label: 'Normale sans CPD (part plateforme %)', row: 'Normale', col: 'Sans CPD' },
  { key: 'commission_normal_avec_cpd', label: 'Normale avec CPD', row: 'Normale', col: 'Avec CPD' },
  { key: 'commission_assistee_sans_cpd', label: 'Assistée sans CPD', row: 'Assistée', col: 'Sans CPD' },
  { key: 'commission_assistee_avec_cpd', label: 'Assistée avec CPD', row: 'Assistée', col: 'Avec CPD' },
];

function getDefaultMultipliers(): Record<string, string> {
  const m: Record<string, string> = {};
  CATEGORY_LABELS.forEach((c) => { m[c] = '1.0'; });
  return m;
}

export default function AdminCMS() {
  const [settings, setSettings] = useState<Settings>({});
  const [multipliers, setMultipliers] = useState<Record<string, string>>(getDefaultMultipliers());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>('general');
  const [toast, setToast] = useState('');
  const [showComingSoonPreview, setShowComingSoonPreview] = useState(false);

  // Launch confirmation modal
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [launchConfirmText, setLaunchConfirmText] = useState('');
  const [launching, setLaunching] = useState(false);

  // Waitlist stats
  const [waitlistStats, setWaitlistStats] = useState<{
    total_count: number;
    by_country: { country_code: string; count: number }[];
    by_day_30: { date: string; count: number }[];
    recent_signups: { email: string; first_name: string | null; country_code: string | null; created_at: string }[];
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Newsletter state
  const [nlChannel, setNlChannel] = useState<'email' | 'sms'>('email');
  const [nlSubject, setNlSubject] = useState('');
  const [nlHtml, setNlHtml] = useState('');
  const [nlSmsText, setNlSmsText] = useState('');
  const [nlScheduleAt, setNlScheduleAt] = useState('');
  const [nlSending, setNlSending] = useState(false);
  const [nlCampaigns, setNlCampaigns] = useState<Array<{ id: string; subject: string; channel: string; status: string; sent_at: string | null; recipients_count: number; created_at: string }>>([]);

  function load() {
    const token = localStorage.getItem('omnia_session_token');
    fetch(ENDPOINTS.adminCmsUpdate, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        const map: Settings = {};
        (d.settings ?? []).forEach((s: { key: string; value: string }) => { map[s.key] = s.value; });
        setSettings(map);
        if (map.category_multipliers) {
          try { setMultipliers({ ...getDefaultMultipliers(), ...JSON.parse(map.category_multipliers) }); } catch { /* use defaults */ }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Load newsletter campaigns
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    if (supabaseUrl && anonKey) {
      fetch(`${supabaseUrl}/rest/v1/newsletter_campaigns?order=created_at.desc&limit=20`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${localStorage.getItem('omnia_session_token') || ''}` },
      }).then(r => r.ok ? r.json() : []).then(d => { if (Array.isArray(d)) setNlCampaigns(d); }).catch(() => {});
    }
  }
  useEffect(() => { load(); }, []);

  function loadWaitlistStats() {
    setLoadingStats(true);
    const token = localStorage.getItem('omnia_session_token');
    fetch(ENDPOINTS.waitlistStats, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setWaitlistStats(d); setLoadingStats(false); })
      .catch(() => setLoadingStats(false));
  }

  function set(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function save(extraUpdates?: { key: string; value: string }[]) {
    setSaving(true);
    const token = localStorage.getItem('omnia_session_token');
    const updates = Object.entries(settings).map(([key, value]) => ({ key, value }));
    if (extraUpdates) updates.push(...extraUpdates);
    const res = await fetch(ENDPOINTS.adminCmsUpdate, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    });
    const d = await res.json();
    setSaving(false);
    if (d.success) { setToast(`${d.updated} paramètre(s) enregistré(s).`); setTimeout(() => setToast(''), 3000); }
    else setToast(d.message ?? 'Erreur.');
  }

  async function saveMultipliers() {
    await save([{ key: 'category_multipliers', value: JSON.stringify(multipliers) }]);
  }

  async function confirmLaunch() {
    if (launchConfirmText !== 'LANCER') return;
    setLaunching(true);
    const token = localStorage.getItem('omnia_session_token');
    const updates = Object.entries(settings).map(([key, value]) => ({ key, value }));
    // Ensure coming_soon_enabled is false
    const idx = updates.findIndex(u => u.key === 'coming_soon_enabled');
    if (idx >= 0) updates[idx].value = 'false';
    else updates.push({ key: 'coming_soon_enabled', value: 'false' });

    const res = await fetch(ENDPOINTS.adminCmsUpdate, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    });
    const d = await res.json();
    setLaunching(false);
    setShowLaunchModal(false);
    setLaunchConfirmText('');
    if (d.success) {
      setSettings(prev => ({ ...prev, coming_soon_enabled: 'false' }));
      setToast(d.launched ? 'Plateforme lancee ! Email Brevo envoye a la liste d\'attente.' : 'Parametre enregistre.');
      setTimeout(() => setToast(''), 5000);
    } else {
      setToast(d.error ?? 'Erreur.');
    }
  }

  async function sendNewsletter() {
    if (!nlSubject.trim()) { setToast('Objet requis.'); return; }
    if (nlChannel === 'email' && !nlHtml.trim()) { setToast('Contenu HTML requis.'); return; }
    if (nlChannel === 'sms' && !nlSmsText.trim()) { setToast('Texte SMS requis.'); return; }
    setNlSending(true);
    const token = localStorage.getItem('omnia_session_token');
    try {
      const res = await fetch(ENDPOINTS.newsletterSend, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: nlSubject,
          content_html: nlHtml,
          channel: nlChannel,
          sms_text: nlSmsText,
          schedule_at: nlScheduleAt || undefined,
        }),
      });
      const d = await res.json();
      if (d.success) {
        setToast(d.scheduled ? 'Campagne planifiée !' : 'Campagne envoyée !');
        setNlSubject(''); setNlHtml(''); setNlSmsText(''); setNlScheduleAt('');
        load();
      } else {
        setToast(d.error || 'Erreur envoi.');
      }
    } catch { setToast('Erreur réseau.'); }
    finally { setNlSending(false); setTimeout(() => setToast(''), 4000); }
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'general', label: 'Général' },
    { key: 'coming_soon', label: 'Coming Soon' },
    { key: 'landing', label: 'Landing Page' },
    { key: 'partenaires', label: 'Partenaires' },
    { key: 'legal', label: 'Légal' },
    { key: 'avance', label: 'Paramètres avancés' },
    { key: 'newsletter', label: 'Newsletter' },
    { key: 'ia', label: 'IA & Automatisation' },
  ];

  function Field({ label, k, type = 'text', placeholder = '' }: { label: string; k: string; type?: string; placeholder?: string }) {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
        <input type={type} value={settings[k] ?? ''} onChange={(e) => set(k, e.target.value)}
          placeholder={placeholder}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
          style={{ '--tw-ring-color': '#002050' } as React.CSSProperties} />
      </div>
    );
  }

  function TextArea({ label, k, rows = 6 }: { label: string; k: string; rows?: number }) {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
        <textarea value={settings[k] ?? ''} onChange={(e) => set(k, e.target.value)} rows={rows}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-y"
          style={{ '--tw-ring-color': '#002050' } as React.CSSProperties} />
      </div>
    );
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {toast && (
          <div className="fixed top-4 right-4 z-50 bg-white shadow-lg rounded-xl px-5 py-3 text-sm font-medium border border-gray-200"
            style={{ color: '#002050' }}>{toast}</div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#002050' }}>Configuration CMS</h1>
            <p className="text-gray-500 text-sm mt-0.5">Contenu et paramètres de la plateforme</p>
          </div>
          <button onClick={() => save()} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60"
            style={{ backgroundColor: '#002050' }}>
            <Save className="w-4 h-4" />
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>

        {/* Tab nav */}
        <div className="flex gap-1 flex-wrap bg-gray-100 p-1 rounded-xl">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${tab === t.key ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
          {/* GÉNÉRAL */}
          {tab === 'general' && (
            <div className="space-y-4">
              <h3 className="font-semibold" style={{ color: '#002050' }}>Identité de la plateforme</h3>
              <Field label="Slogan" k="site_slogan" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <h3 className="font-semibold pt-2" style={{ color: '#002050' }}>Favicon & Identité visuelle</h3>
              <Field label="URL du Favicon" k="favicon_url" placeholder="https://... (.png, .ico, .svg)" />
              <p className="text-xs text-gray-400 -mt-2">
                Lien public vers l'icône de l'onglet. Recommandé : image carrée 32×32 ou 64×64px.
                Après sauvegarde, le favicon se met à jour au prochain chargement de la page.
              </p>
                <Field label="Email Admission" k="email_admission" type="email" placeholder="admission@omniaglobalacademy.com" />
                <Field label="Email Support" k="email_support" type="email" placeholder="support@omniaglobalacademy.com" />
                <Field label="Email Contact" k="email_contact" type="email" placeholder="contact@omniaglobalacademy.com" />
              </div>
              <h3 className="font-semibold pt-2" style={{ color: '#002050' }}>Réseaux sociaux</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {['Facebook', 'Instagram', 'YouTube', 'LinkedIn', 'WhatsApp'].map((net) => (
                  <Field key={net} label={net} k={`social_${net.toLowerCase()}`} placeholder={`URL ${net}`} />
                ))}
              </div>
              <h3 className="font-semibold pt-2" style={{ color: '#002050' }}>Applications mobiles</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="App Store (iOS)" k="app_store_url" placeholder="https://apps.apple.com/…" />
                <Field label="Google Play (Android)" k="google_play_url" placeholder="https://play.google.com/…" />
              </div>

              {/* --- Personnalisation des couleurs --- */}
              <div className="pt-2 border-t border-gray-100 space-y-4">
                <h3 className="font-semibold" style={{ color: '#002050' }}>Personnalisation des couleurs</h3>

                {[
                  { key: 'color_primary', label: 'Couleur primaire', desc: 'Sidebar, titres, boutons principaux', default: '#002050' },
                  { key: 'color_accent', label: 'Couleur accent', desc: 'Boutons secondaires, badges, liens', default: '#BF8813' },
                  { key: 'color_bg_light', label: 'Fond général', desc: 'Arrière-plan des pages', default: '#F8F9FA' },
                  { key: 'color_success', label: 'Couleur succès', desc: 'Validations, statuts positifs', default: '#1E7A52' },
                ].map(({ key, label, desc, default: def }) => (
                  <div key={key} className="flex items-center gap-3">
                    <input
                      type="color"
                      value={settings[key] || def}
                      onChange={e => set(key, e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border-0 p-0.5"
                      style={{ border: '1px solid #E4E7EC' }}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: '#002050' }}>{label}</p>
                      <p className="text-xs" style={{ color: '#6B7280' }}>{desc}</p>
                    </div>
                    <span className="text-xs font-mono" style={{ color: '#9CA3AF' }}>
                      {settings[key] || def}
                    </span>
                  </div>
                ))}

                <p className="text-xs" style={{ color: '#6B7280' }}>
                  Les couleurs sont appliquées à l'ensemble de la plateforme après rechargement de la page.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      set('color_primary', '#002050');
                      set('color_accent', '#BF8813');
                      set('color_bg_light', '#F8F9FA');
                      set('color_success', '#1E7A52');
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border"
                    style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>
                    Réinitialiser aux couleurs d'origine
                  </button>
                  <button onClick={() => save()} disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60"
                    style={{ backgroundColor: '#002050' }}>
                    <Save className="w-4 h-4" />
                    {saving ? 'Enregistrement…' : 'Enregistrer les couleurs'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* COMING SOON */}
          {tab === 'coming_soon' && (
            <div className="space-y-4">
              {/* Toggle card */}
              <div className="flex items-center justify-between p-4 rounded-xl border-2 transition-colors"
                style={{
                  borderColor: settings.coming_soon_enabled === 'true' ? '#dc2626' : '#1E7A52',
                  backgroundColor: settings.coming_soon_enabled === 'true' ? '#fef2f2' : '#f0fdf4',
                }}>
                <div>
                  <p className="font-semibold text-sm" style={{ color: settings.coming_soon_enabled === 'true' ? '#dc2626' : '#1E7A52' }}>
                    Mode liste d'attente {settings.coming_soon_enabled === 'true' ? '— ACTIF' : '— Inactif'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {settings.coming_soon_enabled === 'true'
                      ? 'Le site affiche la page "Coming Soon" à tous les visiteurs.'
                      : 'Le site affiche normalement la Landing Page.'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (settings.coming_soon_enabled === 'true') {
                      setShowLaunchModal(true);
                    } else {
                      set('coming_soon_enabled', 'true');
                    }
                  }}
                  className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${settings.coming_soon_enabled === 'true' ? 'bg-red-500' : 'bg-green-500'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.coming_soon_enabled === 'true' ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {settings.coming_soon_enabled === 'true' && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">Le mode Coming Soon est actif. Cliquez sur le bouton ci-dessus pour lancer la plateforme.</p>
                </div>
              )}

              <Field label="Titre de la page Coming Soon" k="coming_soon_title_fr" />
              <Field label="Sous-titre" k="coming_soon_subtitle_fr" />
              <Field label="Date de lancement" k="launch_date" type="date" />

              {/* Waitlist stats */}
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" style={{ color: '#002050' }} />
                    <h3 className="font-semibold text-sm" style={{ color: '#002050' }}>Statistiques liste d'attente</h3>
                  </div>
                  <button onClick={loadWaitlistStats} disabled={loadingStats}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium text-white disabled:opacity-60"
                    style={{ backgroundColor: '#002050' }}>
                    {loadingStats ? 'Chargement…' : 'Charger les stats'}
                  </button>
                </div>

                {waitlistStats && (
                  <div className="space-y-4">
                    {/* Total */}
                    <div className="flex items-center gap-3 p-4 rounded-xl border border-gray-100"
                      style={{ backgroundColor: '#F8F9FA' }}>
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: 'rgba(0,32,80,0.08)' }}>
                        <Users className="w-5 h-5" style={{ color: '#002050' }} />
                      </div>
                      <div>
                        <p className="text-2xl font-bold" style={{ color: '#002050' }}>
                          {waitlistStats.total_count.toLocaleString('fr-FR')}
                        </p>
                        <p className="text-xs text-gray-500">inscrits au total</p>
                      </div>
                    </div>

                    {/* By country */}
                    {waitlistStats.by_country.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" />
                          <p className="text-xs font-semibold text-gray-600">Par pays (top 10)</p>
                        </div>
                        <div className="space-y-1.5">
                          {waitlistStats.by_country.slice(0, 10).map(({ country_code, count }) => {
                            const pct = Math.round((count / waitlistStats.total_count) * 100);
                            return (
                              <div key={country_code} className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 w-8 font-mono">{country_code}</span>
                                <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: '#002050' }} />
                                </div>
                                <span className="text-xs text-gray-500 w-12 text-right">{count.toLocaleString('fr-FR')}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Recent signups */}
                    {waitlistStats.recent_signups.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <TrendingUp className="w-3.5 h-3.5 text-gray-400" />
                          <p className="text-xs font-semibold text-gray-600">Dernières inscriptions</p>
                        </div>
                        <div className="rounded-xl border border-gray-100 overflow-hidden">
                          <table className="w-full text-xs">
                            <thead style={{ backgroundColor: '#F8F9FA' }}>
                              <tr>
                                {['Email', 'Prénom', 'Pays', 'Date'].map(h => (
                                  <th key={h} className="text-left px-3 py-2 text-gray-500 font-medium">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {waitlistStats.recent_signups.map((r, i) => (
                                <tr key={i} className="border-t border-gray-50">
                                  <td className="px-3 py-2 text-gray-700 font-mono">{r.email}</td>
                                  <td className="px-3 py-2 text-gray-600">{r.first_name ?? '—'}</td>
                                  <td className="px-3 py-2 text-gray-500">{r.country_code ?? '—'}</td>
                                  <td className="px-3 py-2 text-gray-400 whitespace-nowrap">
                                    {new Date(r.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* --- Mode Maintenance --- */}
              <div className="pt-4 border-t border-gray-100 space-y-4">
                <h3 className="font-semibold" style={{ color: '#002050' }}>Mode Maintenance</h3>

                {/* Toggle */}
                <div className="flex items-center justify-between p-4 rounded-xl border-2 transition-colors"
                  style={{
                    borderColor: settings.maintenance_enabled === 'true' ? '#F97316' : '#E4E7EC',
                    backgroundColor: settings.maintenance_enabled === 'true' ? '#FFF7ED' : '#F9FAFB',
                  }}>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: settings.maintenance_enabled === 'true' ? '#F97316' : '#6B7280' }}>
                      Mode Maintenance {settings.maintenance_enabled === 'true' ? '— ACTIF' : '— Inactif'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Affiche une page de maintenance à tous les visiteurs (sauf Super-admin)
                    </p>
                  </div>
                  <button
                    onClick={() => set('maintenance_enabled', settings.maintenance_enabled === 'true' ? 'false' : 'true')}
                    className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0`}
                    style={{ backgroundColor: settings.maintenance_enabled === 'true' ? '#F97316' : '#D1D5DB' }}>
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.maintenance_enabled === 'true' ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Message affiché aux utilisateurs</label>
                  <textarea
                    value={settings.maintenance_message_fr ?? ''}
                    onChange={e => set('maintenance_message_fr', e.target.value)}
                    rows={3}
                    placeholder="La plateforme est en maintenance. Retour prévu dans quelques heures."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-y"
                  />
                </div>

                {/* End time */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fin prévue des travaux (optionnel)</label>
                  <input
                    type="datetime-local"
                    value={settings.maintenance_end_time ?? ''}
                    onChange={e => set('maintenance_end_time', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>

                <button onClick={() => save()} disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60"
                  style={{ backgroundColor: '#F97316' }}>
                  <Save className="w-4 h-4" />
                  {saving ? 'Enregistrement…' : 'Enregistrer mode maintenance'}
                </button>
              </div>
            </div>
          )}

          {/* LANDING PAGE */}
          {tab === 'landing' && (
            <div className="space-y-5">
              <h3 className="font-semibold" style={{ color: '#002050' }}>Section Hero</h3>
              <Field label="Titre principal" k="landing_hero_title_fr" />
              <Field label="Sous-titre" k="landing_hero_subtitle_fr" />
              <h3 className="font-semibold pt-2" style={{ color: '#002050' }}>Statistiques (4 compteurs)</h3>
              <div className="grid grid-cols-2 gap-4">
                {['Formations', 'Apprenants', 'Pays', 'Formateurs'].map((stat) => (
                  <Field key={stat} label={stat} k={`stat_${stat.toLowerCase()}`} placeholder="ex: 200+" />
                ))}
              </div>
              <h3 className="font-semibold pt-2" style={{ color: '#002050' }}>Section "Devenir Formateur"</h3>
              <Field label="Titre" k="landing_devenir_formateur_title_fr" />
              <TextArea label="Description" k="landing_devenir_formateur_desc_fr" rows={3} />
            </div>
          )}

          {/* PARTENAIRES */}
          {tab === 'partenaires' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                <p className="text-xs text-blue-700">Les logos des partenaires fintech et des collaborations sont configurés via des URLs stockées dans les paramètres.</p>
              </div>
              <h3 className="font-semibold" style={{ color: '#002050' }}>Logos Fintech Mobile Money</h3>
              {['Wave', 'Orange', 'MTN', 'Moov', 'Free'].map((name) => (
                <Field key={name} label={`${name} — URL logo`} k={`fintech_logo_${name.toLowerCase()}`} placeholder="https://…/logo.png" />
              ))}
              <h3 className="font-semibold pt-2" style={{ color: '#002050' }}>Libellé "Suivez-nous"</h3>
              <Field label="Texte affiché" k="follow_us_label_fr" placeholder="Suivez-nous" />
            </div>
          )}

          {/* LÉGAL */}
          {tab === 'legal' && (
            <div className="space-y-5">
              <TextArea label="À Propos (Markdown)" k="a_propos_content_fr" rows={10} />
              <TextArea label="Politique de Confidentialité (Markdown)" k="confidentialite_content_fr" rows={10} />
              <TextArea label="CGU (Markdown)" k="cgu_content_fr" rows={6} />
              <TextArea label="Mentions Légales (Markdown)" k="mentions_legales_fr" rows={6} />
            </div>
          )}

          {/* AVANCÉ */}
          {tab === 'avance' && (
            <div className="space-y-8">
              {/* Commissions */}
              <div>
                <h3 className="font-semibold mb-3" style={{ color: '#002050' }}>Commissions (% part Plateforme)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                    <thead style={{ backgroundColor: '#002050' }}>
                      <tr>
                        <th className="text-left px-4 py-2.5 text-white text-xs font-medium">Type</th>
                        <th className="text-center px-4 py-2.5 text-white text-xs font-medium">Sans CPD</th>
                        <th className="text-center px-4 py-2.5 text-white text-xs font-medium">Avec CPD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {['normal', 'assistee'].map((type) => (
                        <tr key={type} className="border-t border-gray-100">
                          <td className="px-4 py-3 font-medium text-gray-700 capitalize">{type === 'normal' ? 'Normale' : 'Assistée'}</td>
                          {['sans', 'avec'].map((cpd) => {
                            const k = `commission_${type}_${cpd}_cpd`;
                            const val = parseFloat(settings[k] ?? (type === 'normal' ? (cpd === 'sans' ? '0.30' : '0.50') : (cpd === 'sans' ? '0.50' : '0.70')));
                            return (
                              <td key={cpd} className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <span className="text-xs text-gray-400">Prof {Math.round((1 - val) * 100)}% /</span>
                                  <input type="number" min="0" max="100" step="1" value={Math.round(val * 100)}
                                    onChange={(e) => set(k, String(parseInt(e.target.value) / 100))}
                                    className="w-16 border border-gray-200 rounded px-2 py-1 text-sm text-center focus:outline-none" />
                                  <span className="text-xs text-gray-400">% Pf</span>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-400 mt-2">Les valeurs sont le pourcentage revenant à la Plateforme. Le professeur reçoit le complément à 100%.</p>
              </div>

              {/* Paliers de prix */}
              <div>
                <h3 className="font-semibold mb-1" style={{ color: '#002050' }}>Paliers de prix</h3>
                <p className="text-xs text-gray-400 mb-3">Les 4 paliers de base (cadenas) ne peuvent pas être supprimés.</p>
                <div className="space-y-2">
                  {[
                    { label: 'Palier Essentiel', min: 0, max: 15, price: '5000', base: true },
                    { label: 'Palier Standard', min: 16, max: 30, price: '15000', base: true },
                    { label: 'Palier Professionnel', min: 31, max: 50, price: '25000', base: true },
                    { label: 'Palier Expert', min: 51, max: null, price: '35000', base: true },
                  ].map((tier, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50">
                      <span className="text-xs text-gray-500 w-32">{tier.label}</span>
                      <span className="text-xs text-gray-400">Score: {tier.min}–{tier.max ?? '∞'}</span>
                      <input type="number" defaultValue={tier.price}
                        className="w-24 border border-gray-200 rounded px-2 py-1 text-sm text-center focus:outline-none"
                        placeholder="XOF" />
                      <span className="text-xs text-gray-400">XOF</span>
                      <span className="ml-auto text-gray-300 text-sm">🔒</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Prix Premium CPD (XOF)</label>
                  <input type="number" value={settings.cpd_premium_price_xof ?? ''} onChange={(e) => set('cpd_premium_price_xof', e.target.value)}
                    className="w-40 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
              </div>

              {/* Multiplicateurs de catégorie */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold" style={{ color: '#002050' }}>Multiplicateurs de catégorie</h3>
                  <button onClick={saveMultipliers} disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-60"
                    style={{ backgroundColor: '#BF8813' }}>
                    <Save className="w-3.5 h-3.5" />
                    Sauvegarder les multiplicateurs
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {CATEGORY_LABELS.map((cat) => (
                    <div key={cat} className="flex items-center gap-2 p-2 rounded-lg border border-gray-100">
                      <span className="text-xs text-gray-600 flex-1 truncate">{cat}</span>
                      <input type="number" min="0.5" max="2.0" step="0.1"
                        value={multipliers[cat] ?? '1.0'}
                        onChange={(e) => setMultipliers((prev) => ({ ...prev, [cat]: e.target.value }))}
                        className="w-16 border border-gray-200 rounded px-2 py-1 text-xs text-center focus:outline-none" />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">Toute modification est enregistrée dans l'audit log avec l'ancienne et la nouvelle valeur.</p>
              </div>

              {/* Other params */}
              <div>
                <h3 className="font-semibold mb-3" style={{ color: '#002050' }}>Parrainage & Jetons</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Récompense parrain (XOF)" k="referral_reward_referrer_xof" type="number" />
                  <Field label="Récompense filleul (XOF)" k="referral_reward_referred_xof" type="number" />
                  <Field label="Jetons à l'inscription" k="ai_token_per_registration" type="number" />
                  <Field label="Jetons par achat" k="ai_token_per_purchase" type="number" />
                  <Field label="Retrait minimum (XOF)" k="payout_minimum_xof" type="number" />
                </div>
              </div>

              {/* CPD settings */}
              <div className="border-t border-gray-100 pt-6">
                <h3 className="font-semibold mb-1" style={{ color: '#002050' }}>Paramètres CPD & Quiz</h3>
                <p className="text-xs text-gray-400 mb-4">
                  Seuils de réussite appliqués aux évaluations CPD. Une leçon/module/examen final est validé si le score atteint le seuil configuré.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  {[
                    { k: 'quiz_lesson_threshold', label: 'Seuil quiz leçon (%)', default: '80' },
                    { k: 'quiz_module_threshold', label: 'Seuil examen module (%)', default: '70' },
                    { k: 'quiz_final_threshold', label: 'Seuil examen final (%)', default: '70' },
                  ].map(({ k, label, default: def }) => (
                    <div key={k}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number" min="0" max="100" step="1"
                          value={settings[k] ?? def}
                          onChange={e => set(k, e.target.value)}
                          className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm text-center focus:outline-none"
                        />
                        <span className="text-xs text-gray-400">%</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Jetons IA à l'inscription" k="ai_tokens_inscription" type="number" placeholder="1" />
                  <Field label="Jetons IA par achat" k="ai_tokens_per_purchase" type="number" placeholder="1" />
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Ces jetons s'ajoutent aux jetons CPD standards configurés dans la section "Parrainage & Jetons".
                </p>
              </div>
            </div>
          )}
          {/* NEWSLETTER */}
          {tab === 'newsletter' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-1" style={{ color: '#002050' }}>Composer une campagne</h3>
                <p className="text-xs text-gray-400 mb-4">Envoi à la Liste Newsletter Globale Brevo #7</p>

                {/* Channel selector */}
                <div className="flex gap-2 mb-5">
                  {(['email', 'sms'] as const).map(ch => (
                    <button key={ch} onClick={() => setNlChannel(ch)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all"
                      style={nlChannel === ch ? { backgroundColor: '#002050', color: 'white', borderColor: '#002050' } : { borderColor: '#e5e7eb', color: '#374151' }}>
                      {ch === 'email' ? <Mail className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                      {ch === 'email' ? 'Email' : 'SMS'}
                    </button>
                  ))}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Objet</label>
                    <input value={nlSubject} onChange={e => setNlSubject(e.target.value)}
                      placeholder="Objet de la campagne"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
                  </div>

                  {nlChannel === 'email' && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Contenu HTML</label>
                        <textarea value={nlHtml} onChange={e => setNlHtml(e.target.value)} rows={8}
                          placeholder="<h1>Bonjour !</h1><p>Votre message ici...</p>"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:border-gray-400" />
                      </div>
                      {nlHtml && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Prévisualisation</label>
                          <div className="border border-gray-200 rounded-lg overflow-hidden" style={{ height: 240 }}>
                            <iframe srcDoc={nlHtml} title="preview" className="w-full h-full" sandbox="allow-same-origin" />
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {nlChannel === 'sms' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Texte SMS
                        <span className={`ml-2 font-mono ${nlSmsText.length > 160 ? 'text-red-500' : 'text-gray-400'}`}>
                          {nlSmsText.length}/160
                        </span>
                      </label>
                      <textarea value={nlSmsText} onChange={e => setNlSmsText(e.target.value.slice(0, 160))} rows={3}
                        placeholder="Votre message SMS (160 caractères max)"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-gray-400" />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      <Clock className="w-3.5 h-3.5 inline mr-1" />
                      Date d'envoi planifié (optionnel — vide = immédiat)
                    </label>
                    <input type="datetime-local" value={nlScheduleAt} onChange={e => setNlScheduleAt(e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
                  </div>

                  <button onClick={sendNewsletter} disabled={nlSending}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60 transition-opacity hover:opacity-90"
                    style={{ backgroundColor: '#BF8813' }}>
                    <Send className="w-4 h-4" />
                    {nlSending ? 'Envoi en cours…' : nlScheduleAt ? 'Planifier la campagne' : 'Envoyer maintenant'}
                  </button>
                </div>
              </div>

              {/* Campaign history */}
              <div>
                <h3 className="font-semibold mb-3" style={{ color: '#002050' }}>Historique des campagnes</h3>
                {nlCampaigns.length === 0 ? (
                  <p className="text-sm text-gray-400">Aucune campagne envoyée.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full text-sm">
                      <thead style={{ backgroundColor: '#F8F9FA' }}>
                        <tr>
                          {['Date', 'Type', 'Objet', 'Destinataires', 'Statut'].map(h => (
                            <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {nlCampaigns.map((c, i) => (
                          <tr key={c.id} className={`border-t border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                            <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                              {c.sent_at ? new Date(c.sent_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : new Date(c.created_at).toLocaleDateString('fr-FR')}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="flex items-center gap-1 text-xs">
                                {c.channel === 'email' ? <Mail className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
                                {c.channel}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-gray-700 max-w-xs truncate">{c.subject}</td>
                            <td className="px-4 py-2.5 text-gray-500">{c.recipients_count || '—'}</td>
                            <td className="px-4 py-2.5">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                c.status === 'sent' ? 'bg-green-50 text-green-700' :
                                c.status === 'scheduled' ? 'bg-amber-50 text-amber-700' :
                                'bg-gray-100 text-gray-500'
                              }`}>{c.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* IA & AUTOMATISATION */}
          {tab === 'ia' && (
            <div className="space-y-8">
              {/* RAG Assistant */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Bot className="w-5 h-5" style={{ color: '#002050' }} />
                  <h3 className="font-bold" style={{ color: '#002050' }}>Assistant pédagogique RAG</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Journaliser les conversations IA</p>
                      <p className="text-xs text-gray-500 mt-0.5">OFF par défaut. Une fois activé, les professeurs peuvent consulter les questions fréquentes sur leurs formations.</p>
                    </div>
                    <button onClick={() => set('ai_conversations_log_enabled', settings['ai_conversations_log_enabled'] === 'true' ? 'false' : 'true')}
                      className="flex-shrink-0">
                      {settings['ai_conversations_log_enabled'] === 'true'
                        ? <ToggleRight className="w-8 h-8" style={{ color: '#1E7A52' }} />
                        : <ToggleLeft className="w-8 h-8 text-gray-300" />}
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Modèle Claude</label>
                      <select value={settings['ai_model'] || 'claude-sonnet-4-6'} onChange={e => set('ai_model', e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2">
                        <option value="claude-sonnet-4-6">claude-sonnet-4-6 (recommandé)</option>
                        <option value="claude-opus-4-7">claude-opus-4-7 (haute qualité)</option>
                        <option value="claude-haiku-4-5">claude-haiku-4-5 (économique)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Max tokens par réponse</label>
                      <input type="number" min="200" max="4000" step="100"
                        value={settings['ai_max_tokens_per_response'] || '1000'}
                        onChange={e => set('ai_max_tokens_per_response', e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2" />
                    </div>
                  </div>
                </div>
              </div>

             {/* CV Builder IA */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Coins className="w-5 h-5" style={{ color: '#002050' }} />
                  <h3 className="font-bold" style={{ color: '#002050' }}>CV Builder IA — Jetons & Packs</h3>
                </div>

                {/* Jetons automatiques */}
                <div className="p-4 rounded-xl border border-gray-200 mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Jetons offerts automatiquement</h4>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">À l'inscription</label>
                      <input type="number" min="0" value={settings['cv_tokens_inscription'] || '1'}
                        onChange={e => set('cv_tokens_inscription', e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Par formation achetée</label>
                      <input type="number" min="0" value={settings['cv_tokens_per_purchase'] || '1'}
                        onChange={e => set('cv_tokens_per_purchase', e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Par parrainage</label>
                      <input type="number" min="0" value={settings['cv_tokens_per_referral'] || '1'}
                        onChange={e => set('cv_tokens_per_referral', e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2" />
                    </div>
                  </div>
                </div>

                {/* Packs achetables */}
                <div className="p-4 rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-700">Packs de jetons achetables</h4>
                    <button
                      onClick={() => {
                       const defaultPacks = [{"id":"pack_3","tokens":3,"price_xof":500,"label":"3 jetons","popular":false},{"id":"pack_5","tokens":5,"price_xof":1000,"label":"5 jetons","popular":true}];
                        const packs = JSON.parse(settings['cv_token_packs'] || JSON.stringify(defaultPacks));
                        packs.push({ id: `pack_${Date.now()}`, tokens: 3, price_xof: 500, label: 'Nouveau pack', popular: false });
                        set('cv_token_packs', JSON.stringify(packs));
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                      style={{ backgroundColor: '#002050' }}>
                      <Plus size={13} /> Ajouter un pack
                    </button>
                  </div>

                  {(() => {
                    const packs = JSON.parse(settings['cv_token_packs'] || '[{"id":"pack_3","tokens":3,"price_xof":500,"label":"3 jetons","popular":false},{"id":"pack_5","tokens":5,"price_xof":1000,"label":"5 jetons","popular":true}]');
                    return (
                      <div className="space-y-3">
                        {packs.map((pack: any, idx: number) => (
                          <div key={pack.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50">
                            <div className="flex-1 grid grid-cols-4 gap-3">
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Label</label>
                                <input type="text" value={pack.label}
                                  onChange={e => {
                                    const updated = [...packs];
                                    updated[idx] = { ...pack, label: e.target.value };
                                    set('cv_token_packs', JSON.stringify(updated));
                                  }}
                                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1" />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Jetons</label>
                                <input type="number" min="1" value={pack.tokens}
                                  onChange={e => {
                                    const updated = [...packs];
                                    updated[idx] = { ...pack, tokens: parseInt(e.target.value) };
                                    set('cv_token_packs', JSON.stringify(updated));
                                  }}
                                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1" />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Prix (FCFA)</label>
                                <input type="number" min="0" step="100" value={pack.price_xof}
                                  onChange={e => {
                                    const updated = [...packs];
                                    updated[idx] = { ...pack, price_xof: parseInt(e.target.value) };
                                    set('cv_token_packs', JSON.stringify(updated));
                                  }}
                                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1" />
                              </div>
                              <div className="flex items-end gap-2">
                                <label className="flex items-center gap-1.5 text-xs text-gray-600 mb-1.5 cursor-pointer">
                                  <input type="checkbox" checked={pack.popular}
                                    onChange={e => {
                                      const updated = [...packs];
                                      updated[idx] = { ...pack, popular: e.target.checked };
                                      set('cv_token_packs', JSON.stringify(updated));
                                    }}
                                    style={{ accentColor: '#BF8813' }} />
                                  Populaire
                                </label>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                const updated = packs.filter((_: any, i: number) => i !== idx);
                                set('cv_token_packs', JSON.stringify(updated));
                              }}
                              className="flex-shrink-0 p-1 rounded hover:bg-red-50">
                              <X size={14} className="text-red-400" />
                            </button>
                          </div>
                        ))}
                        {packs.length === 0 && (
                          <p className="text-xs text-gray-400 text-center py-4">Aucun pack configuré — cliquez sur "Ajouter un pack"</p>
                        )}
                      </div>
                    );
                  })()}
                  <p className="text-xs text-gray-400 mt-3">Ces packs apparaissent dans la modal d'achat sur la page CV Builder.</p>
                </div>
              </div>

              {/* DALL-E Couvertures */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Image className="w-5 h-5" style={{ color: '#002050' }} />
                  <h3 className="font-bold" style={{ color: '#002050' }}>Couvertures DALL-E</h3>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Modèle DALL-E</label>
                  <select value={settings['dall_e_model'] || 'dall-e-3'} onChange={e => set('dall_e_model', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 max-w-xs">
                    <option value="dall-e-3">dall-e-3 (recommandé)</option>
                    <option value="dall-e-2">dall-e-2 (économique)</option>
                  </select>
                </div>
                <div className="mt-3 flex items-start gap-2 p-3 rounded-lg border border-amber-200" style={{ backgroundColor: '#FFFBEB' }}>
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#D97706' }} />
                  <p className="text-xs text-amber-700">Le prompt impose toujours "NO people, NO faces, NO hands" — cette règle est absolue et non configurable.</p>
                </div>
              </div>

              {/* Pipeline Sous-titres */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Captions className="w-5 h-5" style={{ color: '#002050' }} />
                  <h3 className="font-bold" style={{ color: '#002050' }}>Pipeline de sous-titres</h3>
                </div>
                <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Activer le pipeline de sous-titres</p>
                    <p className="text-xs text-gray-500 mt-0.5">Consomme des tokens Whisper (OpenAI) et des crédits de traduction (Claude). Désactivé par défaut.</p>
                  </div>
                  <button onClick={() => set('subtitle_pipeline_enabled', settings['subtitle_pipeline_enabled'] === 'true' ? 'false' : 'true')}
                    className="flex-shrink-0">
                    {settings['subtitle_pipeline_enabled'] === 'true'
                      ? <ToggleRight className="w-8 h-8" style={{ color: '#1E7A52' }} />
                      : <ToggleLeft className="w-8 h-8 text-gray-300" />}
                  </button>
                </div>
              </div>

              <button onClick={() => save()} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: '#002050' }}>
                <Save className="w-4 h-4" />
                {saving ? 'Enregistrement…' : 'Enregistrer les paramètres IA'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Launch confirmation modal */}
      {showLaunchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: '#fef2f2' }}>
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <h2 className="text-lg font-bold" style={{ color: '#002050' }}>Confirmer le lancement</h2>
            </div>
            <p className="text-sm text-gray-600 mb-2">
              Cette action va :
            </p>
            <ul className="text-sm text-gray-600 mb-5 space-y-1 list-disc list-inside">
              <li>Désactiver le mode liste d'attente</li>
              <li>Rendre la plateforme accessible à tous</li>
              <li>Envoyer un email de lancement à toute la liste d'attente (liste Brevo #8)</li>
            </ul>
            <p className="text-sm font-semibold text-gray-700 mb-2">
              Tapez <span className="font-mono text-red-600">LANCER</span> pour confirmer :
            </p>
            <input
              type="text"
              value={launchConfirmText}
              onChange={e => setLaunchConfirmText(e.target.value)}
              placeholder="LANCER"
              className="w-full border-2 rounded-lg px-3 py-2 text-sm mb-5 focus:outline-none font-mono"
              style={{ borderColor: launchConfirmText === 'LANCER' ? '#1E7A52' : '#e5e7eb' }}
            />
            <div className="flex gap-3">
              <button onClick={() => { setShowLaunchModal(false); setLaunchConfirmText(''); }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Annuler
              </button>
              <button
                onClick={confirmLaunch}
                disabled={launchConfirmText !== 'LANCER' || launching}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
                style={{ backgroundColor: '#1E7A52' }}>
                {launching ? 'Lancement en cours…' : 'Lancer la plateforme'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
