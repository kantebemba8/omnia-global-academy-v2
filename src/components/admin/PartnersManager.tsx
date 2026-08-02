import { getSessionToken } from '../../lib/session';
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Plus, Save, Trash2, Upload } from 'lucide-react';
import { ENDPOINTS } from '../../lib/config';

type Partner = {
  id?: string;
  name: string;
  category: string;
  logo_url: string;
  website_url: string;
  description: string;
  display_order: number;
  is_active: boolean;
  is_featured: boolean;
  status: 'draft' | 'active' | 'archived';
  logo_authorized: boolean;
  show_homepage: boolean;
  show_footer: boolean;
  alt_text: string;
};

const EMPTY_PARTNER: Partner = {
  name: '',
  category: 'Institutionnel',
  logo_url: '',
  website_url: '',
  description: '',
  display_order: 0,
  is_active: false,
  is_featured: false,
  status: 'draft',
  logo_authorized: false,
  show_homepage: true,
  show_footer: false,
  alt_text: '',
};

const PARTNER_CATEGORIES = [
  'Institutionnel', 'Académique', 'Certification', 'Technologique', 'Financier',
  'Entreprise', 'ONG / Association', 'Organisme professionnel', 'Autre',
];

export function PartnersManager() {
  const [items, setItems] = useState<Partner[]>([]);
  const [form, setForm] = useState<Partner>(EMPTY_PARTNER);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const token = () => getSessionToken() || '';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(ENDPOINTS.adminCmsUpdate, { headers: { Authorization: `Bearer ${token()}` } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || 'Chargement impossible');
      const partners = Array.isArray(data.partners) ? data.partners : [];
      setItems(partners.map((partner: Partial<Partner>) => ({
        ...EMPTY_PARTNER,
        ...partner,
        logo_url: partner.logo_url || '',
        website_url: partner.website_url || '',
        description: partner.description || '',
        alt_text: partner.alt_text || '',
        status: partner.status || (partner.is_active ? 'active' : 'draft'),
        logo_authorized: Boolean(partner.logo_authorized),
        show_homepage: partner.show_homepage !== false,
        show_footer: Boolean(partner.show_footer),
      })));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setForm(EMPTY_PARTNER);
  }

  async function save() {
    setMessage('');
    setError('');
    if (!form.name.trim()) {
      setError('Le nom du partenaire est obligatoire.');
      return;
    }
    if (form.status === 'active' && (!form.logo_url.trim() || !form.logo_authorized)) {
      setError('Un partenaire actif doit avoir un logo et une autorisation d’utilisation confirmée.');
      return;
    }
    if ((form.show_homepage || form.show_footer) && form.status === 'active' && !form.is_active) {
      setError('Activez le partenaire avant de choisir un emplacement public.');
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(ENDPOINTS.adminCmsUpdate, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upsert_partner', partner: form }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || data.error || 'Enregistrement impossible');
      setMessage(form.id ? 'Partenaire mis à jour.' : 'Partenaire ajouté.');
      resetForm();
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Enregistrement impossible');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id?: string) {
    if (!id) return;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch(ENDPOINTS.adminCmsUpdate, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_partner', partner_id: id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || data.error || 'Suppression impossible');
      setMessage('Partenaire supprimé.');
      if (form.id === id) resetForm();
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Suppression impossible');
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!allowed.includes(file.type)) {
      setError('Utilisez un logo PNG, JPG, WEBP ou SVG.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Le logo doit faire moins de 2 Mo.');
      return;
    }
    setUploading(true);
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
        body: JSON.stringify({ action: 'upload_partner_logo', file_name: file.name, mime_type: file.type, base64 }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || data.error || 'Téléversement impossible');
      setForm(previous => ({ ...previous, logo_url: String(data.logo_url || '') }));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Téléversement impossible');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-[#002050]">Gestion des partenaires</h3>
        <p className="mt-1 text-xs leading-5 text-gray-500">
          Ajoutez uniquement des partenaires réels. Un partenaire public doit avoir un logo, une autorisation d’utilisation et un emplacement validé.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-2">
        <label>
          <span className="mb-1 block text-xs font-medium text-gray-600">Nom du partenaire</span>
          <input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-gray-600">Type de partenaire</span>
          <select value={form.category} onChange={event => setForm({ ...form, category: event.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
            {PARTNER_CATEGORIES.map(category => <option key={category}>{category}</option>)}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-gray-600">Site officiel</span>
          <input type="url" value={form.website_url} onChange={event => setForm({ ...form, website_url: event.target.value })} placeholder="https://…" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-gray-600">Ordre d’affichage</span>
          <input type="number" min="0" value={form.display_order} onChange={event => setForm({ ...form, display_order: Number(event.target.value) })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-gray-600">Statut</span>
          <select value={form.status} onChange={event => setForm({ ...form, status: event.target.value as Partner['status'], is_active: event.target.value === 'active' })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <option value="draft">Brouillon</option>
            <option value="active">Actif</option>
            <option value="archived">Archivé</option>
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-gray-600">Texte alternatif du logo</span>
          <input value={form.alt_text} onChange={event => setForm({ ...form, alt_text: event.target.value })} placeholder={`Logo ${form.name || 'du partenaire'}`} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
        </label>

        <div className="md:col-span-2">
          <span className="mb-1 block text-xs font-medium text-gray-600">Logo officiel</span>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-16 w-24 items-center justify-center overflow-hidden rounded-lg border bg-white">
              {form.logo_url ? <img src={form.logo_url} alt="" className="max-h-14 max-w-[88px] object-contain" /> : <span className="text-xs text-gray-400">Aucun logo</span>}
            </div>
            <input value={form.logo_url} onChange={event => setForm({ ...form, logo_url: event.target.value })} placeholder="URL du logo" className="min-w-[260px] flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ backgroundColor: '#002050' }}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Joindre une image
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" disabled={uploading} onChange={event => { const file = event.target.files?.[0]; if (file) upload(file); event.currentTarget.value = ''; }} />
            </label>
          </div>
        </div>

        <label className="md:col-span-2">
          <span className="mb-1 block text-xs font-medium text-gray-600">Courte description</span>
          <textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} rows={3} className="w-full resize-y rounded-lg border border-gray-200 px-3 py-2 text-sm" />
        </label>

        <div className="md:col-span-2 flex flex-wrap gap-5 border-t border-gray-100 pt-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.logo_authorized} onChange={event => setForm({ ...form, logo_authorized: event.target.checked })} /> Autorisation d’utiliser le logo confirmée</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.show_homepage} onChange={event => setForm({ ...form, show_homepage: event.target.checked })} /> Page d’accueil</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.show_footer} onChange={event => setForm({ ...form, show_footer: event.target.checked })} /> Pied de page</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_featured} onChange={event => setForm({ ...form, is_featured: event.target.checked })} /> Mis en avant</label>
        </div>

        <div className="md:col-span-2 flex flex-wrap justify-end gap-3">
          {form.id && <button type="button" onClick={resetForm} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700"><Plus className="h-4 w-4" /> Nouveau partenaire</button>}
          <button type="button" disabled={busy} onClick={save} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: '#002050' }}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {form.id ? 'Mettre à jour' : 'Ajouter le partenaire'}
          </button>
        </div>
      </div>

      {message && <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" /> {message}</div>}
      {error && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle className="h-4 w-4" /> {error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-10 text-sm text-gray-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Chargement…</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {items.map(partner => (
            <div key={partner.id} className="flex gap-3 rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white">
                {partner.logo_url ? <img src={partner.logo_url} alt={partner.alt_text || ''} className="max-h-14 max-w-[72px] object-contain" /> : <span className="text-xs text-gray-400">Sans logo</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-[#002050]">{partner.name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${partner.status === 'active' ? 'bg-emerald-50 text-emerald-700' : partner.status === 'archived' ? 'bg-gray-100 text-gray-500' : 'bg-amber-50 text-amber-700'}`}>
                    {partner.status === 'active' ? 'Actif' : partner.status === 'archived' ? 'Archivé' : 'Brouillon'}
                  </span>
                </div>
                <p className="text-xs text-gray-400">{partner.category}</p>
                <p className="mt-1 text-[11px] text-gray-500">
                  {partner.show_homepage ? 'Accueil' : ''}{partner.show_homepage && partner.show_footer ? ' · ' : ''}{partner.show_footer ? 'Pied de page' : ''}
                  {!partner.show_homepage && !partner.show_footer ? 'Aucun emplacement public' : ''}
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button type="button" onClick={() => setForm(partner)} className="text-xs font-semibold text-[#002050]">Modifier</button>
                  {partner.website_url && <a href={partner.website_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600"><ExternalLink className="h-3 w-3" /> Site</a>}
                  <button type="button" onClick={() => remove(partner.id)} className="inline-flex items-center gap-1 text-xs text-red-600"><Trash2 className="h-3 w-3" /> Supprimer</button>
                </div>
              </div>
            </div>
          ))}
          {items.length === 0 && <div className="md:col-span-2 rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">Aucun partenaire enregistré.</div>}
        </div>
      )}
    </div>
  );
}
