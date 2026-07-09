import { useEffect, useState } from 'react';
import { StructureLayout } from '../../components/StructureLayout';
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

export default function StructureProfil() {
  const [structure, setStructure] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const token = () => localStorage.getItem('omnia_session_token') || '';
  const set = (k: string, v: unknown) => setForm((f: any) => ({ ...f, [k]: v }));

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  async function load() {
    setLoading(true);
    const res = await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_my_structure' }),
    });
    const data = await res.json();
    if (data.success) {
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
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSave() {
    if (!structure) return;
    setSaving(true);
    const res = await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_structure', structure_id: structure.id, ...form }),
    });
    const data = await res.json();
    if (data.success) { showToast('Profil mis à jour avec succès', true); load(); }
    else showToast(data.error ?? 'Erreur lors de la sauvegarde', false);
    setSaving(false);
  }

  const displayName = structure ? (DISPLAY_NAMES[structure.structure_type] ?? 'Espace Structure') : 'Espace Structure';

  if (loading) return (
    <StructureLayout displayName={displayName}>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
      </div>
    </StructureLayout>
  );

  return (
    <StructureLayout displayName={displayName}>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {toast && (
          <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium"
            style={{ background: toast.ok ? '#D1FAE5' : '#FEE2E2', color: toast.ok ? '#065F46' : '#991B1B' }}>
            {toast.ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />} {toast.msg}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black" style={{ color: '#002050' }}>Profil de la structure</h1>
            <p className="text-sm mt-1" style={{ color: '#6B7280' }}>Gérez les informations officielles de votre structure</p>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white text-sm"
            style={{ background: saving ? '#9CA3AF' : '#002050' }}>
            <Save size={15} /> {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>

        {/* Logo */}
        <div className="bg-white rounded-2xl border p-5" style={{ borderColor: '#E4E7EC' }}>
          <h2 className="font-bold text-sm mb-4" style={{ color: '#002050' }}>Logo de la structure</h2>
          <div className="flex items-center gap-4">
            {structure?.logo_url ? (
              <img src={structure.logo_url} alt="Logo" className="w-20 h-20 rounded-xl object-contain border" style={{ borderColor: '#E4E7EC' }} />
            ) : (
              <div className="w-20 h-20 rounded-xl flex items-center justify-center" style={{ background: '#EEF2FF' }}>
                <Building2 size={32} style={{ color: '#002050' }} />
              </div>
            )}
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: '#374151' }}>Changer le logo</p>
              <p className="text-xs mb-2" style={{ color: '#9CA3AF' }}>PNG ou JPG, max 2 MB. Apparaît sur les certificats.</p>
              <label className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer border transition-colors hover:bg-gray-50"
                style={{ borderColor: '#E4E7EC', color: '#374151' }}>
                <Upload size={13} /> Téléverser un logo
                <input type="file" className="hidden" accept=".png,.jpg,.jpeg" />
              </label>
            </div>
          </div>
        </div>

        {/* Infos structure */}
        <div className="bg-white rounded-2xl border p-5 space-y-4" style={{ borderColor: '#E4E7EC' }}>
          <h2 className="font-bold text-sm" style={{ color: '#002050' }}>Informations de la structure</h2>

          <div>
            <label className={labelCls}>Nom de la structure *</label>
            <input className={inputCls} value={form.name ?? ''} onChange={e => set('name', e.target.value)} />
          </div>

          <div>
            <label className={labelCls}>Type de structure</label>
            <select className={inputCls} value={structure?.structure_type ?? ''} disabled
              style={{ background: '#F9FAFB', color: '#6B7280' }}>
              {STRUCTURE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>Le type ne peut pas être modifié après validation.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}><MapPin size={11} className="inline mr-1" />Ville</label>
              <input className={inputCls} value={form.city ?? ''} onChange={e => set('city', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Adresse</label>
              <input className={inputCls} value={form.address ?? ''} onChange={e => set('address', e.target.value)} />
            </div>
          </div>

          <div>
            <label className={labelCls}><Mail size={11} className="inline mr-1" />Email professionnel</label>
            <input className={inputCls} type="email" value={form.professional_email ?? ''} onChange={e => set('professional_email', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}><Phone size={11} className="inline mr-1" />Téléphone</label>
              <input className={inputCls} value={form.phone ?? ''} onChange={e => set('phone', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}><Globe size={11} className="inline mr-1" />Site web</label>
              <input className={inputCls} type="url" value={form.website ?? ''} onChange={e => set('website', e.target.value)} placeholder="https://..." />
            </div>
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea className={`${inputCls} resize-none`} rows={3} value={form.description ?? ''} onChange={e => set('description', e.target.value)} />
          </div>

          <div>
            <label className={labelCls}>Objectif de présence sur Omnia</label>
            <textarea className={`${inputCls} resize-none`} rows={3} value={form.objective ?? ''} onChange={e => set('objective', e.target.value)} />
          </div>
        </div>

        {/* Responsable */}
        <div className="bg-white rounded-2xl border p-5 space-y-4" style={{ borderColor: '#E4E7EC' }}>
          <h2 className="font-bold text-sm" style={{ color: '#002050' }}>Responsable de la structure</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nom complet</label>
              <input className={inputCls} value={form.responsible_name ?? ''} onChange={e => set('responsible_name', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Fonction</label>
              <input className={inputCls} value={form.responsible_function ?? ''} onChange={e => set('responsible_function', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Email</label>
              <input className={inputCls} type="email" value={form.responsible_email ?? ''} onChange={e => set('responsible_email', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Téléphone</label>
              <input className={inputCls} value={form.responsible_phone ?? ''} onChange={e => set('responsible_phone', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="flex justify-end pb-4">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white"
            style={{ background: saving ? '#9CA3AF' : '#002050' }}>
            <Save size={15} /> {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </button>
        </div>
      </div>
    </StructureLayout>
  );
}
