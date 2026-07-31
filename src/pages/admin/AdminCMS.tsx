import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../../components/AdminLayout';
import { ENDPOINTS } from '../../lib/config';
import { CATEGORY_LABELS } from '../../lib/categories';
import {
  Save, Settings, AlertTriangle, Send, Mail, MessageSquare, Clock, Bot,
  Image, Captions, ToggleLeft, ToggleRight, Upload, CheckCircle2,
} from 'lucide-react';
import { PartnersManager } from '../../components/admin/PartnersManager';
import { LandingCmsFoundation } from '../../components/admin/LandingCmsFoundation';
import { PublicChannelsManager } from '../../components/admin/PublicChannelsManager';
import { PricingRulesManager } from '../../components/admin/PricingRulesManager';
import { PricingTiersManager } from '../../components/admin/PricingTiersManager';

type Settings = Record<string, any>;
type Tab = 'general' | 'landing' | 'partenaires' | 'legal' | 'avance' | 'newsletter' | 'ia' | 'maintenance';

const COMMISSION_KEYS = [
  { key: 'commission_normal_sans_cpd', label: 'Normale sans CPD (part plateforme %)', row: 'Normale', col: 'Sans CPD' },
  { key: 'commission_normal_avec_cpd', label: 'Normale avec CPD', row: 'Normale', col: 'Avec CPD' },
  { key: 'commission_assistee_sans_cpd', label: 'Assistée sans CPD', row: 'Assistée', col: 'Sans CPD' },
  { key: 'commission_assistee_avec_cpd', label: 'Assistée avec CPD', row: 'Assistée', col: 'Avec CPD' },
];

const CMS_EXCLUDED_KEYS = new Set([
  // Propriétés de Configuration Fintech : jamais sauvegardées par le CMS.
  'payout_minimum_xof',
  'payout_delay_label',
  'ai_token_per_registration',
  'ai_token_per_purchase',
  // Anciennes clés fantômes conservées en base uniquement pour compatibilité historique.
  'ai_tokens_inscription',
  'ai_tokens_per_purchase',
  // Gouvernance de la page d’accueil : modification uniquement via le constructeur dédié.
  'landing_page_published',
  'landing_page_publication_meta',
]);

const CMS_FORBIDDEN_KEYS = new Set([
  'super_admin_id','service_role_key','fedapay_secret_key',
  'brevo_api_key','html2pdf_api_key','cron_secret'
]);

function canCmsWrite(key: string) {
  const normalized = key.toLowerCase();
  return !CMS_FORBIDDEN_KEYS.has(normalized) && !CMS_EXCLUDED_KEYS.has(key);
}


const OFFICIAL_SLOGAN = 'EMPOWER SKILLS. TRANSFORM AFRICA. IMPACT THE WORLD.';
const FIXED_BRAND_COLORS = {
  primary: '#002050',
  accent: '#BF8813',
  background: '#FFFFFF',
  success: '#1E7A52',
};

type FaviconItem = { url: string; name: string; created_at?: string; };

type PublicPageContent = {
  talent: {
    badge: string; title: string; subtitle: string; primary_cta: string; secondary_cta: string;
    recent_talents_title: string; recent_talents_subtitle: string;
    recent_jobs_title: string; recent_jobs_subtitle: string;
  };
  omnia_live: {
    badge: string; title: string; title_accent: string; subtitle: string;
    primary_cta: string; secondary_cta: string;
    live_card_title: string; live_card_text: string;
    training_card_title: string; training_card_text: string;
    videos_card_title: string; videos_card_text: string;
    replays_card_title: string; replays_card_text: string;
  };
};

const DEFAULT_PAGE_CONTENT: PublicPageContent = {
  talent: {
    badge: 'La vitrine professionnelle d’Omnia Global Academy',
    title: 'Découvrez les talents qui ont choisi de rendre leur profil visible',
    subtitle: 'Omnia Talent permet aux recruteurs de repérer des profils publics, consulter leurs compétences et prendre contact dans un environnement vérifié.',
    primary_cta: 'Explorer les talents',
    secondary_cta: 'Espace recruteurs',
    recent_talents_title: 'Talents récemment visibles',
    recent_talents_subtitle: 'Profils issus directement du Profil carrière Omnia.',
    recent_jobs_title: 'Offres récentes',
    recent_jobs_subtitle: 'Les mêmes offres que dans l’espace Emploi et le Forum Communauté.',
  },
  omnia_live: {
    badge: 'APPRENDRE EN TEMPS RÉEL',
    title: 'Apprenez. Échangez. Participez.',
    title_accent: 'En direct.',
    subtitle: 'Classes en ligne, masterclass, ateliers, conférences, formations synchrones et vidéos à la demande, accessibles depuis tous les pays.',
    primary_cta: 'Explorer Omnia Live',
    secondary_cta: 'Voir les prochains Lives',
    live_card_title: 'Lives',
    live_card_text: 'Classes et événements interactifs.',
    training_card_title: 'Formations Live',
    training_card_text: 'Parcours synchrones à plusieurs sessions.',
    videos_card_title: 'Vidéos',
    videos_card_text: 'Masterclass et contenus à la demande.',
    replays_card_title: 'Replays',
    replays_card_text: 'Revivez les sessions disponibles.',
  },
};

function parseObject<T>(value: unknown, fallback: T): T {
  if (!value) return fallback;
  if (typeof value === 'object') return value as T;
  try {
    const parsed = JSON.parse(String(value));
    return (parsed && typeof parsed === 'object') ? parsed as T : fallback;
  } catch {
    return fallback;
  }
}


const DEFAULT_CATEGORY_MULTIPLIERS: Record<string, string> = {
  'Data & Intelligence Artificielle': '1.5',
  'Informatique & Développement': '1.4',
  'Cybersécurité & Réseaux': '1.4',
  'Business & Entrepreneuriat': '1.3',
  'Finance & Comptabilité': '1.3',
  'Droit & Juridique': '1.3',
  'Marketing & Communication': '1.2',
  'Santé & Médecine': '1.2',
  'Architecture & BTP': '1.2',
  'Éducation & Pédagogie': '1.1',
  'Langues & Linguistique': '1.0',
  'Agriculture & Agro-business': '1.0',
  'Tourisme & Hôtellerie': '1.0',
  'Environnement & Développement durable': '1.0',
  'Bien-être & Développement personnel': '0.9',
  'Artisanat & Métiers manuels': '0.9',
  'Cuisine & Gastronomie': '0.9',
  'Mode & Stylisme': '0.9',
  'Élevage & Pêche': '0.9',
  'Arts & Créativité': '0.8',
  'Musique & Audio': '0.8',
  'Loisirs & Hobbies': '0.8',
};
function getDefaultMultipliers(): Record<string, string> { return { ...DEFAULT_CATEGORY_MULTIPLIERS }; }

export default function AdminCMS() {
  const [settings, setSettings] = useState<Settings>({});
  const [initialSettings, setInitialSettings] = useState<Settings>({});
  const [favicons, setFavicons] = useState<FaviconItem[]>([]);
  const [faviconUploading, setFaviconUploading] = useState(false);
  const [pageEditorTarget, setPageEditorTarget] = useState<'landing' | 'talent' | 'omnia_live'>('landing');
  const [pageContent, setPageContent] = useState<PublicPageContent>(DEFAULT_PAGE_CONTENT);
  const [multipliers, setMultipliers] = useState<Record<string, string>>(getDefaultMultipliers());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>('general');
  const [toast, setToast] = useState('');

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
        (d.settings ?? []).forEach((s: { key: string; value: unknown }) => { map[s.key] = s.value; });

        const editableMap = { ...map };
        if (!editableMap.site_slogan || String(editableMap.site_slogan).trim().toLowerCase() === 'test') {
          editableMap.site_slogan = OFFICIAL_SLOGAN;
        }

        const faviconLibrary = parseObject<FaviconItem[]>(map.favicon_library, []);
        const loadedPageContent = parseObject<Partial<PublicPageContent>>(map.page_content, {});

        setSettings(editableMap);
        setInitialSettings(map);
        setFavicons(Array.isArray(faviconLibrary) ? faviconLibrary : []);
        setPageContent({
          talent: { ...DEFAULT_PAGE_CONTENT.talent, ...(loadedPageContent.talent || {}) },
          omnia_live: { ...DEFAULT_PAGE_CONTENT.omnia_live, ...(loadedPageContent.omnia_live || {}) },
        });

        const dbMultipliers: Record<string, string> = getDefaultMultipliers();
        (d.category_multipliers ?? []).forEach((row: { category_name: string; multiplier: number | string }) => {
          if (CATEGORY_LABELS.includes(row.category_name as any)) {
            dbMultipliers[row.category_name] = String(row.multiplier);
          }
        });
        setMultipliers(dbMultipliers);
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

  function set(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

 async function save(extraUpdates?: { key: string; value: unknown }[]) {
    setSaving(true);
    const token = localStorage.getItem('omnia_session_token');

    const updates: { key: string; value: unknown }[] = Object.entries(settings)
      .filter(([key]) => canCmsWrite(key))
      .filter(([key, value]) => value !== initialSettings[key])
      .map(([key, value]) => ({ key, value }));

    if (tab === 'landing') {
      updates.push({ key: 'page_content', value: pageContent });
    }

    if (extraUpdates) updates.push(...extraUpdates.filter(u => canCmsWrite(u.key)));

    if (updates.length === 0) {
      setSaving(false);
      setToast('Aucune modification à enregistrer.');
      setTimeout(() => setToast(''), 2500);
      return;
    }

    try {
      const res = await fetch(ENDPOINTS.adminCmsUpdate, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) throw new Error(d.message || d.error || 'Enregistrement impossible');

      setInitialSettings(prev => {
        const next = { ...prev };
        for (const update of updates) next[update.key] = update.value;
        return next;
      });
      setToast('Modifications enregistrées.');
      setTimeout(() => setToast(''), 3500);
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Enregistrement impossible.');
      setTimeout(() => setToast(''), 4000);
    } finally {
      setSaving(false);
    }
  }

  async function uploadFavicon(file: File) {
    const allowed = ['image/png', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/svg+xml', 'image/webp', 'image/jpeg'];
    if (!allowed.includes(file.type)) {
      setToast('Format non pris en charge. Utilisez PNG, ICO, SVG, WEBP ou JPG.');
      return;
    }
    if (file.size > 1024 * 1024) {
      setToast('Le favicon doit faire moins de 1 Mo.');
      return;
    }

    setFaviconUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const token = localStorage.getItem('omnia_session_token');
      const res = await fetch(ENDPOINTS.adminCmsUpdate, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upload_favicon',
          file_name: file.name,
          mime_type: file.type,
          base64,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) throw new Error(d.message || d.error || 'Upload impossible');

      setSettings(prev => ({ ...prev, favicon_url: d.favicon_url }));
      setInitialSettings(prev => ({ ...prev, favicon_url: d.favicon_url, favicon_library: d.favicon_library }));
      setFavicons(Array.isArray(d.favicon_library) ? d.favicon_library : []);
      setToast('Favicon ajouté et activé.');
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Upload impossible.');
    } finally {
      setFaviconUploading(false);
    }
  }

  async function activateFavicon(url: string) {
    const token = localStorage.getItem('omnia_session_token');
    try {
      const res = await fetch(ENDPOINTS.adminCmsUpdate, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_active_favicon', favicon_url: url }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) throw new Error(d.message || d.error || 'Activation impossible');
      setSettings(prev => ({ ...prev, favicon_url: url }));
      setInitialSettings(prev => ({ ...prev, favicon_url: url }));
      setToast('Favicon actif mis à jour.');
      setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Activation impossible.');
    }
  }

  async function deleteFavicon(url: string) {
    const token = localStorage.getItem('omnia_session_token');
    try {
      const res = await fetch(ENDPOINTS.adminCmsUpdate, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_favicon', favicon_url: url }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) throw new Error(d.message || d.error || 'Suppression impossible');
      setFavicons(Array.isArray(d.favicon_library) ? d.favicon_library : []);
      setToast('Favicon supprimé de la bibliothèque.');
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Suppression impossible.');
    }
  }

  async function saveCpdQuiz() {
    setSaving(true);
    setToast('');
    try {
      const token = localStorage.getItem('omnia_session_token');
      const updates = [
        { key: 'quiz_lesson_threshold', value: settings.quiz_lesson_threshold ?? '80' },
        { key: 'quiz_module_threshold', value: settings.quiz_module_threshold ?? '70' },
        { key: 'quiz_final_threshold', value: settings.quiz_final_threshold ?? '70' },
      ];
      const res = await fetch(ENDPOINTS.adminCmsUpdate, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) throw new Error('Enregistrement impossible');
      setToast('Paramètres CPD & Quiz enregistrés.');
    } catch {
      setToast('Erreur pendant l’enregistrement des paramètres CPD & Quiz.');
    } finally {
      setSaving(false);
      setTimeout(() => setToast(''), 3000);
    }
  }

  async function saveMultipliers() {
    setSaving(true);
    setToast('');
    const token = localStorage.getItem('omnia_session_token');
    try {
      const res = await fetch(ENDPOINTS.adminCmsUpdate, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_category_multipliers',
          multipliers: CATEGORY_LABELS.map(category_name => ({
            category_name,
            multiplier: Number(multipliers[category_name] ?? 1),
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Enregistrement impossible');
      setToast('Multiplicateurs enregistrés. Le moteur de tarification utilise immédiatement ces valeurs.');
      load();
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Erreur pendant l’enregistrement des multiplicateurs.');
    } finally {
      setSaving(false);
      setTimeout(() => setToast(''), 3500);
    }
  }

  async function sendMaintenanceNotice() {
    const message = String(settings.maintenance_notice_message_fr || '').trim();
    if (!message) {
      setToast('Saisissez le message d’annonce de maintenance.');
      return;
    }

    await save();

    if (settings.maintenance_notice_email === 'true') {
      const token = localStorage.getItem('omnia_session_token');
      try {
        const res = await fetch(ENDPOINTS.newsletterSend, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject: 'Information maintenance — Omnia Global Academy',
            content_html: `<div style="font-family:Arial,sans-serif"><h2>Information maintenance</h2><p>${message.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p></div>`,
            channel: 'email',
            schedule_at: settings.maintenance_notice_at || undefined,
          }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok || !d.success) throw new Error(d.message || d.error || 'Envoi impossible');
        setToast(d.scheduled ? 'Annonce enregistrée et e-mail programmé.' : 'Annonce enregistrée et e-mail envoyé.');
      } catch (error) {
        setToast(error instanceof Error ? error.message : 'Annonce enregistrée mais e-mail non envoyé.');
      }
    } else {
      setToast('Annonce de maintenance enregistrée.');
    }
    setTimeout(() => setToast(''), 4000);
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
    { key: 'general', label: 'Identité & Branding' },
    { key: 'landing', label: 'Éditeur des pages' },
    { key: 'partenaires', label: 'Partenaires' },
    { key: 'legal', label: 'Légal' },
    { key: 'avance', label: 'Règles métier' },
    { key: 'newsletter', label: 'Newsletter' },
    { key: 'ia', label: 'IA & Automatisation' },
    { key: 'maintenance', label: 'Maintenance' },
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

  function PageField({ label, value, onChange, area = false }: { label: string; value: string; onChange: (value: string) => void; area?: boolean }) {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
        {area ? (
          <textarea value={value} onChange={e => onChange(e.target.value)} rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-y" />
        ) : (
          <input value={value} onChange={e => onChange(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
        )}
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
            <p className="text-gray-500 text-sm mt-0.5">Contenu public, identité, règles métier et maintenance de la plateforme</p>
            <p className="mt-1 text-xs text-gray-400">Jetons, retraits et paramètres financiers sont centralisés dans Configuration Fintech.</p>
          </div>
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
              <Field label="Slogan officiel" k="site_slogan" placeholder={OFFICIAL_SLOGAN} />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-3 pt-2 space-y-3">
                <h3 className="font-semibold" style={{ color: '#002050' }}>Favicon & Identité visuelle</h3>
                <div className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 p-4">
                  <div className="h-14 w-14 rounded-xl border border-gray-200 bg-white flex items-center justify-center overflow-hidden">
                    {settings.favicon_url
                      ? <img src={String(settings.favicon_url)} alt="Favicon actif" className="h-10 w-10 object-contain" />
                      : <span className="text-xs text-gray-400">Aucun</span>}
                  </div>
                  <div className="flex-1 min-w-[220px]">
                    <p className="text-sm font-semibold" style={{color:'#002050'}}>Favicon actif</p>
                    <p className="text-xs text-gray-500 mt-1">Joignez une image et conservez plusieurs favicons pour les fêtes et événements.</p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
                    style={{backgroundColor:'#002050'}}>
                    <Upload className="w-4 h-4" />
                    {faviconUploading ? 'Envoi…' : 'Joindre une image'}
                    <input type="file" className="hidden"
                      accept=".png,.ico,.svg,.webp,.jpg,.jpeg,image/png,image/x-icon,image/svg+xml,image/webp,image/jpeg"
                      disabled={faviconUploading}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) uploadFavicon(file);
                        e.currentTarget.value = '';
                      }} />
                  </label>
                </div>
                {favicons.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-2">Bibliothèque de favicons</p>
                    <div className="flex flex-wrap gap-3">
                      {favicons.map(item => {
                        const active = String(settings.favicon_url || '') === item.url;
                        return (
                          <div key={item.url} className="w-28 rounded-xl border p-3 text-center"
                            style={{borderColor: active ? '#BF8813' : '#E4E7EC'}}>
                            <div className="mx-auto h-12 w-12 flex items-center justify-center">
                              <img src={item.url} alt={item.name || 'Favicon'} className="max-h-10 max-w-10 object-contain" />
                            </div>
                            <p className="mt-2 truncate text-[11px] text-gray-500" title={item.name}>{item.name || 'Favicon'}</p>
                            {active ? (
                              <div className="mt-2 flex items-center justify-center gap-1 text-[11px] font-semibold" style={{color:'#BF8813'}}>
                                <CheckCircle2 className="w-3 h-3" /> Actif
                              </div>
                            ) : (
                              <button type="button" onClick={() => activateFavicon(item.url)}
                                className="mt-2 text-[11px] font-semibold" style={{color:'#002050'}}>Activer</button>
                            )}
                            {!active && (
                              <button type="button" onClick={() => deleteFavicon(item.url)}
                                className="block mx-auto mt-1 text-[10px] text-red-600">Supprimer</button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
                <Field label="Email Admission" k="email_admission" type="email" placeholder="admission@omniaglobalacademy.com" />
                <Field label="Email Support" k="email_support" type="email" placeholder="support@omniaglobalacademy.com" />
                <Field label="Email Contact" k="email_contact" type="email" placeholder="contact@omniaglobalacademy.com" />
              </div>
              <div className="pt-5 border-t border-gray-100">
                <PublicChannelsManager />
              </div>

              <div className="pt-4 border-t border-gray-100">
                <h3 className="font-semibold" style={{ color: '#002050' }}>Couleurs de marque</h3>
                <p className="mt-1 text-xs text-gray-500">L’identité visuelle Omnia est fixe afin de garantir une présentation cohérente sur toute la plateforme.</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {[
                    ['Bleu Omnia', FIXED_BRAND_COLORS.primary],
                    ['Or Omnia', FIXED_BRAND_COLORS.accent],
                    ['Blanc', FIXED_BRAND_COLORS.background],
                    ['Succès', FIXED_BRAND_COLORS.success],
                  ].map(([label,color]) => (
                    <div key={label} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
                      <span className="h-5 w-5 rounded border border-gray-200" style={{backgroundColor:color}} />
                      <span className="text-xs font-medium text-gray-600">{label}</span>
                      <span className="text-[10px] font-mono text-gray-400">{color}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* COMING SOON */}
                    {/* LANDING PAGE */}
          {tab === 'landing' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold" style={{color:'#002050'}}>Éditeur des pages publiques</h3>
                <p className="mt-1 text-xs text-gray-500">
                  Modifiez les contenus principaux sans changer le code. Les textes enregistrés sont utilisés directement par les pages publiques.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2">
                {[
                  ['landing','Accueil'],
                  ['talent','Omnia Talent'],
                  ['omnia_live','Omnia Live'],
                ].map(([key,label]) => (
                  <button key={key} type="button" onClick={() => setPageEditorTarget(key as typeof pageEditorTarget)}
                    className="rounded-lg px-4 py-2 text-sm font-semibold transition"
                    style={{
                      backgroundColor:pageEditorTarget===key?'#002050':'transparent',
                      color:pageEditorTarget===key?'#FFFFFF':'#475467',
                    }}>
                    {label}
                  </button>
                ))}
              </div>

              {pageEditorTarget === 'landing' && (
                <LandingCmsFoundation />
              )}

              {pageEditorTarget === 'talent' && (
                <div className="space-y-4">
                  <PageField label="Badge supérieur" value={pageContent.talent.badge}
                    onChange={v=>setPageContent(p=>({...p,talent:{...p.talent,badge:v}}))} />
                  <PageField label="Titre principal" value={pageContent.talent.title}
                    onChange={v=>setPageContent(p=>({...p,talent:{...p.talent,title:v}}))} />
                  <PageField area label="Sous-titre" value={pageContent.talent.subtitle}
                    onChange={v=>setPageContent(p=>({...p,talent:{...p.talent,subtitle:v}}))} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <PageField label="Bouton principal" value={pageContent.talent.primary_cta}
                      onChange={v=>setPageContent(p=>({...p,talent:{...p.talent,primary_cta:v}}))} />
                    <PageField label="Bouton secondaire" value={pageContent.talent.secondary_cta}
                      onChange={v=>setPageContent(p=>({...p,talent:{...p.talent,secondary_cta:v}}))} />
                    <PageField label="Titre profils récents" value={pageContent.talent.recent_talents_title}
                      onChange={v=>setPageContent(p=>({...p,talent:{...p.talent,recent_talents_title:v}}))} />
                    <PageField label="Sous-titre profils récents" value={pageContent.talent.recent_talents_subtitle}
                      onChange={v=>setPageContent(p=>({...p,talent:{...p.talent,recent_talents_subtitle:v}}))} />
                    <PageField label="Titre offres récentes" value={pageContent.talent.recent_jobs_title}
                      onChange={v=>setPageContent(p=>({...p,talent:{...p.talent,recent_jobs_title:v}}))} />
                    <PageField label="Sous-titre offres récentes" value={pageContent.talent.recent_jobs_subtitle}
                      onChange={v=>setPageContent(p=>({...p,talent:{...p.talent,recent_jobs_subtitle:v}}))} />
                  </div>
                </div>
              )}

              {pageEditorTarget === 'omnia_live' && (
                <div className="space-y-4">
                  <PageField label="Badge supérieur" value={pageContent.omnia_live.badge}
                    onChange={v=>setPageContent(p=>({...p,omnia_live:{...p.omnia_live,badge:v}}))} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <PageField label="Titre principal" value={pageContent.omnia_live.title}
                      onChange={v=>setPageContent(p=>({...p,omnia_live:{...p.omnia_live,title:v}}))} />
                    <PageField label="Partie du titre en or" value={pageContent.omnia_live.title_accent}
                      onChange={v=>setPageContent(p=>({...p,omnia_live:{...p.omnia_live,title_accent:v}}))} />
                  </div>
                  <PageField area label="Sous-titre" value={pageContent.omnia_live.subtitle}
                    onChange={v=>setPageContent(p=>({...p,omnia_live:{...p.omnia_live,subtitle:v}}))} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <PageField label="Bouton principal" value={pageContent.omnia_live.primary_cta}
                      onChange={v=>setPageContent(p=>({...p,omnia_live:{...p.omnia_live,primary_cta:v}}))} />
                    <PageField label="Bouton secondaire" value={pageContent.omnia_live.secondary_cta}
                      onChange={v=>setPageContent(p=>({...p,omnia_live:{...p.omnia_live,secondary_cta:v}}))} />
                  </div>
                  <h4 className="font-semibold pt-2" style={{color:'#002050'}}>Cartes principales</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      ['live_card_title','live_card_text','Lives'],
                      ['training_card_title','training_card_text','Formations Live'],
                      ['videos_card_title','videos_card_text','Vidéos'],
                      ['replays_card_title','replays_card_text','Replays'],
                    ].map(([titleKey,textKey,label])=>(
                      <div key={titleKey} className="rounded-xl border border-gray-200 p-4 space-y-3">
                        <p className="text-xs font-semibold text-gray-500">{label}</p>
                        <PageField label="Titre" value={(pageContent.omnia_live as any)[titleKey]}
                          onChange={v=>setPageContent(p=>({...p,omnia_live:{...p.omnia_live,[titleKey]:v}}))} />
                        <PageField area label="Description" value={(pageContent.omnia_live as any)[textKey]}
                          onChange={v=>setPageContent(p=>({...p,omnia_live:{...p.omnia_live,[textKey]:v}}))} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PARTENAIRES */}
          {tab === 'partenaires' && (
            <div className="max-w-5xl mx-auto">
              <PartnersManager />
            </div>
          )}

          {/* LÉGAL */}
          {tab === 'legal' && (
            <div className="max-w-5xl mx-auto space-y-6">
              <div>
                <h3 className="font-semibold" style={{color:'#002050'}}>Documents juridiques centralisés</h3>
                <p className="text-xs text-gray-500 mt-1">Une seule source pour toute la plateforme. Les mêmes contenus doivent être reliés depuis l’accueil, Omnia Talent, Omnia Live, Career, Forum, inscription et paiement.</p>
              </div>
              <TextArea label="À Propos (Markdown)" k="a_propos_content_fr" rows={8} />
              <TextArea label="Politique de confidentialité et données personnelles (Markdown)" k="confidentialite_content_fr" rows={10} />
              <TextArea label="Conditions Générales d’Utilisation — CGU (Markdown)" k="cgu_content_fr" rows={10} />
              <TextArea label="Mentions légales (Markdown)" k="mentions_legales_fr" rows={8} />
              <TextArea label="Politique cookies (Markdown)" k="cookies_content_fr" rows={8} />
              <TextArea label="Conditions Générales de Vente — CGV (Markdown)" k="cgv_content_fr" rows={10} />
              <TextArea label="Politique de remboursement & annulation (Markdown)" k="refund_policy_content_fr" rows={8} />
              <TextArea label="Conditions spécifiques Formateurs (Markdown)" k="teacher_terms_content_fr" rows={8} />
              <TextArea label="Conditions spécifiques Structures (Markdown)" k="structure_terms_content_fr" rows={8} />
              <TextArea label="Conditions spécifiques Omnia Live (Markdown)" k="omnia_live_terms_content_fr" rows={8} />
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
                Les changements juridiques importants doivent être versionnés avant de demander une nouvelle acceptation aux utilisateurs concernés. La version et la date d’entrée en vigueur sont prévues dans la configuration juridique.
              </div>
            </div>
          )}

          {/* AVANCÉ */}
          {tab === 'avance' && (
            <div className="space-y-8">
              <div className="max-w-5xl mx-auto space-y-6">
                <PricingRulesManager />
                <div className="border-t border-gray-100 pt-6">
                  <PricingTiersManager />
                </div>
                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                  <p className="text-sm font-semibold" style={{color:'#002050'}}>Paramètres financiers centralisés</p>
                  <p className="text-xs text-gray-500 mt-1">Le parrainage, les jetons, commissions, retraits et autres montants financiers sont centralisés dans Configuration Fintech. Les paliers de prix restent ici car ils font partie directement du moteur Score → Palier → Prix.</p>
                  <Link to="/admin/fintech" className="inline-flex mt-2 text-xs font-semibold" style={{color:'#BF8813'}}>Ouvrir Configuration Fintech →</Link>
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
                <div className="flex justify-end">
                  <button
                    onClick={saveCpdQuiz}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                    style={{ backgroundColor: '#002050' }}
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Enregistrement…' : 'Enregistrer les paramètres CPD & Quiz'}
                  </button>
                </div>
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

              {/* La gestion des jetons est centralisée exclusivement dans Admin > Omnia Career > Jetons. */}

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

      
        
          {/* MAINTENANCE — toujours en dernier */}
          {tab === 'maintenance' && (
            <div className="max-w-5xl mx-auto space-y-7">
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">État de maintenance</p>
                    <h3 className="mt-1 text-lg font-semibold" style={{color:'#002050'}}>
                      Maintenance globale {settings.maintenance_enabled === 'true' ? 'active' : 'inactive'}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Le Super-admin conserve toujours l’accès. Les autres utilisateurs voient la page de maintenance.
                    </p>
                  </div>
                  <button type="button"
                    onClick={() => set('maintenance_enabled', settings.maintenance_enabled === 'true' ? 'false':'true')}
                    className="relative h-7 w-13 shrink-0 rounded-full p-1 transition"
                    style={{width:52,backgroundColor:settings.maintenance_enabled==='true'?'#F97316':'#D0D5DD'}}>
                    <span className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${settings.maintenance_enabled==='true'?'translate-x-6':'translate-x-0'}`} />
                  </button>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Début programmé</label>
                    <input type="datetime-local" value={settings.maintenance_start_time ?? ''}
                      onChange={e=>set('maintenance_start_time',e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Fin prévue</label>
                    <input type="datetime-local" value={settings.maintenance_end_time ?? ''}
                      onChange={e=>set('maintenance_end_time',e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Message affiché pendant la maintenance</label>
                  <textarea rows={3} value={settings.maintenance_message_fr ?? ''}
                    onChange={e=>set('maintenance_message_fr',e.target.value)}
                    placeholder="Une maintenance est en cours. Merci pour votre patience."
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-y" />
                </div>
              </div>

              <div>
                <div className="mb-4">
                  <h3 className="font-semibold" style={{color:'#002050'}}>Maintenance ciblée</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Activez ou programmez une maintenance différente pour chaque module sans bloquer le reste de la plateforme.
                  </p>
                </div>
                <div className="space-y-3">
                  {[
                    ['omnia_live','Omnia Live'],
                    ['career','Omnia Career'],
                    ['talent','Omnia Talent'],
                    ['forum','Forum'],
                    ['payments','Paiements'],
                    ['formations','Formations'],
                  ].map(([slug,label])=>{
                    const key=`maintenance_module_${slug}`;
                    const active=settings[key]==='true';
                    return (
                      <div key={slug} className="rounded-xl border border-gray-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold" style={{color:'#002050'}}>{label}</p>
                            <p className="text-xs text-gray-400">{active?'Maintenance activée manuellement':'Disponible normalement hors programmation'}</p>
                          </div>
                          <button type="button" onClick={()=>set(key,active?'false':'true')}
                            className="relative h-6 shrink-0 rounded-full p-0.5"
                            style={{width:44,backgroundColor:active?'#F97316':'#D0D5DD'}}>
                            <span className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${active?'translate-x-5':'translate-x-0'}`} />
                          </button>
                        </div>
                        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Début programmé</label>
                            <input type="datetime-local" value={settings[`maintenance_module_${slug}_start_time`] ?? ''}
                              onChange={e=>set(`maintenance_module_${slug}_start_time`,e.target.value)}
                              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Fin prévue</label>
                            <input type="datetime-local" value={settings[`maintenance_module_${slug}_end_time`] ?? ''}
                              onChange={e=>set(`maintenance_module_${slug}_end_time`,e.target.value)}
                              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-5">
                <h3 className="font-semibold" style={{color:'#002050'}}>Informer les utilisateurs</h3>
                <p className="mt-1 text-sm text-gray-500">
                  La bannière plateforme est visible par tous les visiteurs. L’e-mail utilise les contacts inscrits aux communications.
                </p>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
                    <input type="checkbox" checked={settings.maintenance_notice_platform==='true'}
                      onChange={e=>set('maintenance_notice_platform',e.target.checked?'true':'false')} />
                    <div>
                      <p className="text-sm font-semibold text-gray-700">Bannière plateforme</p>
                      <p className="text-xs text-gray-400">Visible sur toute la plateforme avant la maintenance.</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
                    <input type="checkbox" checked={settings.maintenance_notice_email==='true'}
                      onChange={e=>set('maintenance_notice_email',e.target.checked?'true':'false')} />
                    <div>
                      <p className="text-sm font-semibold text-gray-700">E-mail</p>
                      <p className="text-xs text-gray-400">Envoyé aux contacts inscrits aux communications.</p>
                    </div>
                  </label>
                </div>
                <div className="mt-4">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Message d’annonce</label>
                  <textarea rows={3} value={settings.maintenance_notice_message_fr ?? ''}
                    onChange={e=>set('maintenance_notice_message_fr',e.target.value)}
                    placeholder="Une maintenance est prévue le… de… à…"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-y" />
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Date/heure d’affichage ou d’envoi</label>
                    <input type="datetime-local" value={settings.maintenance_notice_at ?? ''}
                      onChange={e=>set('maintenance_notice_at',e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                  </div>
                  <div className="flex items-end">
                    <button type="button" onClick={sendMaintenanceNotice} disabled={saving}
                      className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                      style={{backgroundColor:'#BF8813'}}>
                      Enregistrer et programmer l’annonce
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

{tab !== 'newsletter' && tab !== 'partenaires' && !(tab === 'landing' && pageEditorTarget === 'landing') && (
          <div className="pt-5 flex justify-end">
            <button type="button" onClick={() => save()} disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
              style={{backgroundColor:'#002050'}}>
              <Save className="w-4 h-4" />
              {saving ? 'Enregistrement…' : `Enregistrer — ${TABS.find(x => x.key === tab)?.label || 'section'}`}
            </button>
          </div>
        )}

    </AdminLayout>
  );
}
