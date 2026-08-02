import { getSessionToken } from '../../lib/session';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ExternalLink, Facebook, Globe2, Instagram,
  Linkedin, Loader2, MessageCircle, Plus, Save, Trash2, Upload, Youtube,
  type LucideIcon,
} from 'lucide-react';
import { ENDPOINTS } from '../../lib/config';
import type { MobileAppItem, SocialNetworkItem } from '../../types/landingCms';

const ICON_OPTIONS: Array<{ key: string; label: string; icon: LucideIcon }> = [
  { key: 'facebook', label: 'Facebook', icon: Facebook },
  { key: 'instagram', label: 'Instagram', icon: Instagram },
  { key: 'youtube', label: 'YouTube', icon: Youtube },
  { key: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { key: 'other', label: 'Autre réseau', icon: Globe2 },
];

const DEFAULT_APPS: MobileAppItem[] = [
  { id: 'ios-app-store', store: 'ios', name: 'App Store', url: '', enabled: false, display_order: 1, show_homepage: true, show_footer: true },
  { id: 'android-google-play', store: 'android', name: 'Google Play', url: '', enabled: false, display_order: 2, show_homepage: true, show_footer: true },
];

function parseValue<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'object') return value as T;
  try { return JSON.parse(String(value)) as T; } catch { return fallback; }
}

function normalizeSocials(value: unknown, legacy: unknown): SocialNetworkItem[] {
  if (Array.isArray(value)) return value as SocialNetworkItem[];
  if (typeof value === 'string') {
    const parsed = parseValue<SocialNetworkItem[]>(value, []);
    if (Array.isArray(parsed)) return parsed;
  }
  const old = parseValue<Record<string, string | null>>(legacy, {});
  return Object.entries(old)
    .filter(([, url]) => typeof url === 'string' && url.trim())
    .map(([key, url], index) => ({
      id: `legacy-${key}`,
      name: key.charAt(0).toUpperCase() + key.slice(1),
      url: String(url),
      enabled: true,
      display_order: index + 1,
      show_homepage: false,
      show_footer: true,
      icon_key: ICON_OPTIONS.some(item => item.key === key) ? key : 'other',
      logo_url: '',
      alt_text: '',
    }));
}

function normalizeApps(value: unknown, legacy: unknown): MobileAppItem[] {
  if (Array.isArray(value)) return value as MobileAppItem[];
  if (typeof value === 'string') {
    const parsed = parseValue<MobileAppItem[]>(value, []);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  }
  const old = parseValue<Record<string, string | null>>(legacy, {});
  return DEFAULT_APPS.map(item => ({
    ...item,
    url: item.store === 'ios' ? String(old.app_store || '') : String(old.google_play || ''),
    enabled: item.store === 'ios' ? Boolean(old.app_store) : Boolean(old.google_play),
  }));
}

export function PublicChannelsManager() {
  const [socials, setSocials] = useState<SocialNetworkItem[]>([]);
  const [apps, setApps] = useState<MobileAppItem[]>(DEFAULT_APPS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const token = () => getSessionToken() || '';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(ENDPOINTS.adminCmsUpdate, { headers: { Authorization: `Bearer ${token()}` } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || 'Chargement impossible');
      const map: Record<string, unknown> = {};
      (data.settings || []).forEach((item: { key: string; value: unknown }) => { map[item.key] = item.value; });
      const cmsState = data.landing_cms && typeof data.landing_cms === 'object'
        ? data.landing_cms as { social_networks?: unknown; mobile_apps?: unknown }
        : {};
      setSocials(normalizeSocials(cmsState.social_networks, map.social_networks));
      setApps(normalizeApps(cmsState.mobile_apps, map.app_downloads));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const orderedSocials = useMemo(
    () => [...socials].sort((a, b) => a.display_order - b.display_order),
    [socials],
  );

  function addSocial() {
    setSocials(previous => [...previous, {
      id: `social-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: '', url: '', enabled: false, display_order: previous.length + 1,
      show_homepage: false, show_footer: true, icon_key: 'other', logo_url: '', alt_text: '',
    }]);
  }

  function updateSocial(id: string, changes: Partial<SocialNetworkItem>) {
    setSocials(previous => previous.map(item => item.id === id ? { ...item, ...changes } : item));
  }

  function updateApp(id: string, changes: Partial<MobileAppItem>) {
    setApps(previous => previous.map(item => item.id === id ? { ...item, ...changes } : item));
  }

  async function uploadLogo(id: string, file: File) {
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!allowed.includes(file.type)) {
      setError('Utilisez un logo PNG, JPG, WEBP ou SVG.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Le logo doit faire moins de 2 Mo.');
      return;
    }
    setUploadingId(id);
    setError('');
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const response = await fetch(ENDPOINTS.adminCmsUpdate, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upload_social_logo', file_name: file.name, mime_type: file.type, base64 }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || data.error || 'Téléversement impossible');
      updateSocial(id, { logo_url: String(data.logo_url || '') });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Téléversement impossible');
    } finally {
      setUploadingId(null);
    }
  }

  async function save() {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const normalizedSocials = socials.map((item, index) => ({
        ...item,
        name: item.name.trim(),
        url: item.url.trim(),
        alt_text: item.alt_text.trim(),
        logo_url: item.logo_url.trim(),
        display_order: Number.isFinite(Number(item.display_order)) ? Number(item.display_order) : index + 1,
        enabled: Boolean(item.enabled),
        show_homepage: Boolean(item.show_homepage),
        show_footer: Boolean(item.show_footer),
      }));
      const invalidSocial = normalizedSocials.find(item => item.enabled && (!item.name || !item.url || (!item.logo_url && !item.icon_key)));
      if (invalidSocial) throw new Error(`Le réseau « ${invalidSocial.name || 'sans nom'} » doit avoir un nom, une URL et une icône ou un logo.`);

      const normalizedApps = apps.map((item, index) => ({
        ...item,
        name: item.name.trim(),
        url: item.url.trim(),
        display_order: Number.isFinite(Number(item.display_order)) ? Number(item.display_order) : index + 1,
      }));
      const invalidApp = normalizedApps.find(item => item.enabled && !item.url);
      if (invalidApp) throw new Error(`${invalidApp.name} ne peut pas être activée sans URL publique.`);

      const response = await fetch(ENDPOINTS.adminCmsUpdate, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_public_channels',
          social_networks: normalizedSocials,
          mobile_apps: normalizedApps,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || data.error || 'Enregistrement impossible');
      setSocials(normalizedSocials);
      setApps(normalizedApps);
      setMessage('Réseaux sociaux et applications enregistrés.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-10 text-sm text-gray-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Chargement…</div>;
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-semibold text-[#002050]">Réseaux sociaux officiels</h3>
            <p className="mt-1 text-xs text-gray-500">Ajoutez n’importe quel réseau. Il reste masqué tant qu’il n’est pas activé avec une URL et une icône ou un logo.</p>
          </div>
          <button type="button" onClick={addSocial} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: '#002050' }}>
            <Plus className="h-4 w-4" /> Ajouter un réseau
          </button>
        </div>

        {orderedSocials.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">Aucun réseau enregistré.</div>
        )}

        {orderedSocials.map(item => {
          const option = ICON_OPTIONS.find(icon => icon.key === item.icon_key) || ICON_OPTIONS[ICON_OPTIONS.length - 1];
          const Icon = option.icon;
          return (
            <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <label>
                  <span className="mb-1 block text-xs font-medium text-gray-600">Nom du réseau</span>
                  <input value={item.name} onChange={event => updateSocial(item.id, { name: event.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="TikTok, X, Telegram…" />
                </label>
                <label className="lg:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-gray-600">URL du compte officiel</span>
                  <input type="url" value={item.url} onChange={event => updateSocial(item.id, { url: event.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="https://…" />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-medium text-gray-600">Ordre</span>
                  <input type="number" min="0" value={item.display_order} onChange={event => updateSocial(item.id, { display_order: Number(event.target.value) })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-medium text-gray-600">Icône connue</span>
                  <select value={item.icon_key} onChange={event => updateSocial(item.id, { icon_key: event.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                    {ICON_OPTIONS.map(icon => <option key={icon.key} value={icon.key}>{icon.label}</option>)}
                  </select>
                </label>
                <label className="lg:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-gray-600">Texte alternatif</span>
                  <input value={item.alt_text} onChange={event => updateSocial(item.id, { alt_text: event.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder={`Compte officiel ${item.name || 'Omnia'}`} />
                </label>
                <div>
                  <span className="mb-1 block text-xs font-medium text-gray-600">Logo personnalisé</span>
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border bg-white">
                      {item.logo_url ? <img src={item.logo_url} alt="" className="max-h-8 max-w-8 object-contain" /> : <Icon className="h-5 w-5 text-[#002050]" />}
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold text-gray-700">
                      {uploadingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      Joindre
                      <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" disabled={uploadingId === item.id} onChange={event => { const file = event.target.files?.[0]; if (file) uploadLogo(item.id, file); event.currentTarget.value = ''; }} />
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-5 border-t border-gray-100 pt-4 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={item.enabled} onChange={event => updateSocial(item.id, { enabled: event.target.checked })} /> Actif</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={item.show_homepage} onChange={event => updateSocial(item.id, { show_homepage: event.target.checked })} /> Page d’accueil</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={item.show_footer} onChange={event => updateSocial(item.id, { show_footer: event.target.checked })} /> Pied de page</label>
                {item.url && <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-[#002050]"><ExternalLink className="h-3.5 w-3.5" /> Tester</a>}
                <button type="button" onClick={() => setSocials(previous => previous.filter(network => network.id !== item.id))} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-red-600"><Trash2 className="h-3.5 w-3.5" /> Supprimer</button>
              </div>
            </div>
          );
        })}
      </section>

      <section className="space-y-4 border-t border-gray-200 pt-7">
        <div>
          <h3 className="font-semibold text-[#002050]">Applications mobiles</h3>
          <p className="mt-1 text-xs text-gray-500">Les boutons restent masqués tant que l’application correspondante n’est pas publiée, activée et associée à une URL.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[...apps].sort((a, b) => a.display_order - b.display_order).map(app => (
            <div key={app.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="font-semibold text-[#002050]">{app.store === 'ios' ? 'Application iOS' : 'Application Android'}</p>
              <label className="mt-3 block">
                <span className="mb-1 block text-xs font-medium text-gray-600">Libellé</span>
                <input value={app.name} onChange={event => updateApp(app.id, { name: event.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              </label>
              <label className="mt-3 block">
                <span className="mb-1 block text-xs font-medium text-gray-600">URL publique</span>
                <input type="url" value={app.url} onChange={event => updateApp(app.id, { url: event.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder={app.store === 'ios' ? 'https://apps.apple.com/…' : 'https://play.google.com/…'} />
              </label>
              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={app.enabled} onChange={event => updateApp(app.id, { enabled: event.target.checked })} /> Active</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={app.show_homepage} onChange={event => updateApp(app.id, { show_homepage: event.target.checked })} /> Page d’accueil</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={app.show_footer} onChange={event => updateApp(app.id, { show_footer: event.target.checked })} /> Pied de page</label>
              </div>
            </div>
          ))}
        </div>
      </section>

      {message && <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" /> {message}</div>}
      {error && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle className="h-4 w-4" /> {error}</div>}

      <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: '#002050' }}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Enregistrer les réseaux et applications
      </button>
    </div>
  );
}
