import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { StructureLayout } from '../../components/StructureLayout';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { Building2, Save, AlertCircle, CheckCircle, Upload, Globe, Mail, Phone, MapPin } from 'lucide-react';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/structure-manage`;
const inputCls = 'w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#002050] transition-colors';
const labelCls = 'block text-xs font-semibold uppercase tracking-wide mb-1.5 text-gray-500';

const STRUCTURE_TYPES = [
  { value: 'ministere', label: 'Ministère' },
  { value: 'etablissement', label: 'Établissement' },
  { value: 'universite', label: 'Université' },
  { value: 'ecole', label: 'École' },
  { value: 'centre_formation', label: 'Centre de formation' },
  { value: 'entreprise', label: 'Entreprise' },
  { value: 'ong', label: 'ONG' },
  { value: 'association', label: 'Association' },
  { value: 'institution_publique', label: 'Institution publique' },
  { value: 'organisation_internationale', label: 'Organisation internationale' },
  { value: 'cabinet_formation', label: 'Cabinet de formation' },
  { value: 'autre', label: 'Autre structure professionnelle' },
];

const DISPLAY_NAMES: Record<string, string> = {
  ministere: 'Espace Ministère', etablissement: 'Espace Établissement',
  universite: 'Espace Université', ecole: 'Espace École',
  centre_formation: 'Espace Centre de formation', entreprise: 'Espace Entreprise',
  ong: 'Espace ONG', association: 'Espace Association',
  institution_publique: 'Espace Institution publique',
  organisation_internationale: 'Espace Organisation internationale',
  cabinet_formation: 'Espace Cabinet de formation', autre: 'Espace Structure professionnelle',
};

type LogoSelection = {
  file: File;
  dataUrl: string;
};

export default function StructureProfil() {
  const [structure, setStructure] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [logoSelection, setLogoSelection] = useState<LogoSelection | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const set = (key: string, value: unknown) => setForm((current: any) => ({ ...current, [key]: value }));

  const logoPreview = useMemo(
    () => logoSelection?.dataUrl || structure?.logo_url || '',
    [logoSelection, structure?.logo_url],
  );

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    window.setTimeout(() => setToast(null), 3500);
  }

  async function load() {
    setLoading(true);
    try {
      const response = await fetch(API, {
        method: 'POST',
        headers: edgeAuthHeaders(),
        body: JSON.stringify({ action: 'get_my_structure' }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || data.error || 'Chargement impossible');

      setStructure(data.structure);
      setForm({
        name: data.structure.name ?? '',
        city: data.structure.city ?? '',
        address: data.structure.address ?? '',
        professional_email: data.structure.professional_email ?? '',
        phone: data.structure.phone ?? '',
        website: data.structure.website ?? '',
        description: data.structure.description ?? '',
        objective: data.structure.objective ?? '',
        responsible_name: data.structure.responsible_name ?? '',
        responsible_function: data.structure.responsible_function ?? '',
        responsible_email: data.structure.responsible_email ?? '',
        responsible_phone: data.structure.responsible_phone ?? '',
      });
      setLogoSelection(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Chargement impossible', false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function handleLogoSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      showToast('Le logo doit être au format PNG ou JPG.', false);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('Le logo ne doit pas dépasser 2 MB.', false);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setLogoSelection({ file, dataUrl: String(reader.result || '') });
      showToast('Logo prêt à être enregistré.', true);
    };
    reader.onerror = () => showToast('Impossible de lire ce fichier.', false);
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!structure || saving) return;
    if (!String(form.name || '').trim()) {
      showToast('Le nom de la structure est obligatoire.', false);
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        action: 'update_structure',
        structure_id: structure.id,
        ...form,
      };
      if (logoSelection) {
        payload.logo_base64 = logoSelection.dataUrl;
        payload.logo_mime = logoSelection.file.type;
        payload.logo_name = logoSelection.file.name;
      }

      const response = await fetch(API, {
        method: 'POST',
        headers: edgeAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'Erreur lors de la sauvegarde');
      }

      setStructure(data.structure);
      setLogoSelection(null);
      showToast('Profil mis à jour avec succès', true);
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erreur lors de la sauvegarde', false);
    } finally {
      setSaving(false);
    }
  }

  const displayName = structure ? (DISPLAY_NAMES[structure.structure_type] ?? 'Espace Structure') : 'Espace Structure';

  if (loading) {
    return (
      <StructureLayout displayName={displayName}>
        <div className="flex items-center justify-center h-64" aria-label="Chargement du profil">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
        </div>
      </StructureLayout>
    );
  }

  return (
    <StructureLayout displayName={displayName}>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
        {toast && (
          <div
            className="fixed top-4 right-4 left-4 sm:left-auto z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium"
            role={toast.ok ? 'status' : 'alert'}
            style={{ background: toast.ok ? '#D1FAE5' : '#FEE2E2', color: toast.ok ? '#065F46' : '#991B1B' }}
          >
            {toast.ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />} {toast.msg}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black" style={{ color: '#002050' }}>Profil de la structure</h1>
            <p className="text-sm mt-1" style={{ color: '#6B7280' }}>Gérez les informations officielles de votre structure</p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white text-sm disabled:cursor-not-allowed"
            style={{ background: saving ? '#9CA3AF' : '#002050' }}
          >
            <Save size={15} /> {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>

        <div className="bg-white rounded-2xl border p-5" style={{ borderColor: '#E4E7EC' }}>
          <h2 className="font-bold text-sm mb-4" style={{ color: '#002050' }}>Logo de la structure</h2>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {logoPreview ? (
              <img src={logoPreview} alt="Logo de la structure" className="w-20 h-20 rounded-xl object-contain border" style={{ borderColor: '#E4E7EC' }} />
            ) : (
              <div className="w-20 h-20 rounded-xl flex items-center justify-center" style={{ background: '#EEF2FF' }}>
                <Building2 size={32} style={{ color: '#002050' }} />
              </div>
            )}
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: '#374151' }}>Changer le logo</p>
              <p className="text-xs mb-2" style={{ color: '#9CA3AF' }}>PNG ou JPG, max 2 MB. Apparaît sur les certificats.</p>
              <label
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer border transition-colors hover:bg-gray-50 focus-within:ring-2 focus-within:ring-offset-2"
                style={{ borderColor: '#E4E7EC', color: '#374151' }}
              >
                <Upload size={13} /> Choisir un logo
                <input type="file" className="sr-only" accept="image/png,image/jpeg" onChange={handleLogoSelection} />
              </label>
              {logoSelection && <p className="mt-2 text-xs text-emerald-700">{logoSelection.file.name} sera envoyé lors de l’enregistrement.</p>}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border p-5 space-y-4" style={{ borderColor: '#E4E7EC' }}>
          <h2 className="font-bold text-sm" style={{ color: '#002050' }}>Informations de la structure</h2>
          <div>
            <label className={labelCls}>Nom de la structure *</label>
            <input className={inputCls} value={form.name ?? ''} onChange={(event) => set('name', event.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Type de structure</label>
            <select className={inputCls} value={structure?.structure_type ?? ''} disabled style={{ background: '#F9FAFB', color: '#6B7280' }}>
              {STRUCTURE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
            <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>Le type ne peut pas être modifié après validation.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}><MapPin size={11} className="inline mr-1" />Ville</label>
              <input className={inputCls} value={form.city ?? ''} onChange={(event) => set('city', event.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Adresse</label>
              <input className={inputCls} value={form.address ?? ''} onChange={(event) => set('address', event.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}><Mail size={11} className="inline mr-1" />Email professionnel</label>
            <input className={inputCls} type="email" value={form.professional_email ?? ''} onChange={(event) => set('professional_email', event.target.value)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}><Phone size={11} className="inline mr-1" />Téléphone</label>
              <input className={inputCls} value={form.phone ?? ''} onChange={(event) => set('phone', event.target.value)} />
            </div>
            <div>
              <label className={labelCls}><Globe size={11} className="inline mr-1" />Site web</label>
              <input className={inputCls} type="url" value={form.website ?? ''} onChange={(event) => set('website', event.target.value)} placeholder="https://..." />
            </div>
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea className={`${inputCls} resize-none`} rows={3} value={form.description ?? ''} onChange={(event) => set('description', event.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Objectif de présence sur Omnia</label>
            <textarea className={`${inputCls} resize-none`} rows={3} value={form.objective ?? ''} onChange={(event) => set('objective', event.target.value)} />
          </div>
        </div>

        <div className="bg-white rounded-2xl border p-5 space-y-4" style={{ borderColor: '#E4E7EC' }}>
          <h2 className="font-bold text-sm" style={{ color: '#002050' }}>Responsable de la structure</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nom complet</label>
              <input className={inputCls} value={form.responsible_name ?? ''} onChange={(event) => set('responsible_name', event.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Fonction</label>
              <input className={inputCls} value={form.responsible_function ?? ''} onChange={(event) => set('responsible_function', event.target.value)} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Email</label>
              <input className={inputCls} type="email" value={form.responsible_email ?? ''} onChange={(event) => set('responsible_email', event.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Téléphone</label>
              <input className={inputCls} value={form.responsible_phone ?? ''} onChange={(event) => set('responsible_phone', event.target.value)} />
            </div>
          </div>
        </div>

        <div className="flex justify-end pb-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-white disabled:cursor-not-allowed"
            style={{ background: saving ? '#9CA3AF' : '#002050' }}
          >
            <Save size={15} /> {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </button>
        </div>
      </div>
    </StructureLayout>
  );
}
