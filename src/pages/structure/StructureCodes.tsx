import { useEffect, useState } from 'react';
import { StructureLayout } from '../../components/StructureLayout';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { QrCode, PlusCircle, Copy, CheckCircle, XCircle, AlertCircle, RefreshCw, Pencil } from 'lucide-react';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/structure-manage`;

const CODE_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Brouillon', color: '#6B7280', bg: '#F3F4F6' },
  changes_requested: { label: 'Modifications demandées', color: '#92400E', bg: '#FEF3C7' },
  pending_admin_validation: { label: 'En attente Omnia', color: '#92400E', bg: '#FEF3C7' },
  active: { label: 'Actif', color: '#065F46', bg: '#D1FAE5' },
  inactive: { label: 'Inactif', color: '#374151', bg: '#F3F4F6' },
  expired: { label: 'Expiré', color: '#6B7280', bg: '#F3F4F6' },
  suspended: { label: 'Suspendu', color: '#991B1B', bg: '#FEE2E2' },
  rejected: { label: 'Refusé', color: '#991B1B', bg: '#FEE2E2' },
};

const CODE_TYPES = [
  { value: 'rattachement_simple', label: 'Rattachement simple' },
  { value: 'acces_formation', label: 'Accès formation' },
  { value: 'reduction_formation', label: 'Réduction formation' },
  { value: 'acces_omnia_career', label: 'Accès Omnia Career' },
  { value: 'acces_groupe', label: 'Accès groupe' },
  { value: 'programme_special', label: 'Programme spécial' },
  { value: 'autre', label: 'Autre' },
];

const EMPTY_FORM = {
  code_name: '', code_type: 'rattachement_simple', description: '',
  max_uses: 100, expires_at: '', pin: '',
};

export default function StructureCodes() {
  const [codes, setCodes] = useState<any[]>([]);
  const [structureId, setStructureId] = useState('');
  const [displayName, setDisplayName] = useState('Espace Structure');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCode, setEditingCode] = useState<any>(null);
  const [copied, setCopied] = useState('');
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const DISPLAY: Record<string, string> = {
    ministere: 'Espace Ministère', etablissement: 'Espace Établissement', universite: 'Espace Université',
    ecole: 'Espace École', centre_formation: 'Espace Centre de formation', entreprise: 'Espace Entreprise',
    ong: 'Espace ONG', association: 'Espace Association', institution_publique: 'Espace Institution publique',
    organisation_internationale: 'Espace Organisation internationale', cabinet_formation: 'Espace Cabinet de formation',
    autre: 'Espace Structure professionnelle',
  };

  const set = (key: string, value: unknown) => setForm(current => ({ ...current, [key]: value }));
  const showToast = (message: string) => { setToast(message); setTimeout(() => setToast(''), 3500); };

  async function api(body: Record<string, unknown>) {
    const response = await fetch(API, { method: 'POST', headers: edgeAuthHeaders(), body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success !== true) throw new Error(data.message || data.error || 'Action impossible.');
    return data;
  }

  async function load() {
    setLoading(true);
    try {
      const data = await api({ action: 'get_my_structure' });
      const sid = data.structure.id;
      setStructureId(sid);
      setDisplayName(DISPLAY[data.structure.structure_type] ?? 'Espace Structure');
      const codesData = await api({ action: 'list_codes', structure_id: sid });
      setCodes(codesData.codes ?? []);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Chargement impossible.');
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditingCode(null);
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  }

  function openEdit(code: any) {
    setEditingCode(code);
    setForm({
      code_name: code.code_name ?? '',
      code_type: code.code_type ?? 'rattachement_simple',
      description: code.description ?? '',
      max_uses: Number(code.max_uses || 1),
      expires_at: code.expires_at ? String(code.expires_at).slice(0, 10) : '',
      pin: code.pin ?? '',
    });
    setShowModal(true);
  }

  async function handleSave() {
    try {
      if (!form.code_name.trim()) throw new Error('Nom du code requis.');
      if (!Number.isInteger(Number(form.max_uses)) || Number(form.max_uses) < 1) throw new Error('La limite doit être au minimum de 1 membre.');
      const payload = editingCode
        ? { action: 'update_code', structure_id: structureId, code_id: editingCode.id, ...form }
        : { action: 'create_code', structure_id: structureId, ...form };
      await api(payload);
      showToast(editingCode ? 'Code mis à jour.' : 'Code créé.');
      setShowModal(false);
      setEditingCode(null);
      setForm({ ...EMPTY_FORM });
      await load();
    } catch (error) { showToast(error instanceof Error ? error.message : 'Enregistrement impossible.'); }
  }

  async function handleSubmit(codeId: string) {
    try {
      await api({ action: 'submit_code', structure_id: structureId, code_id: codeId });
      showToast('Code soumis à l’Administration Omnia.');
      await load();
    } catch (error) { showToast(error instanceof Error ? error.message : 'Soumission impossible.'); }
  }

  function copyValue(value: string) {
    navigator.clipboard.writeText(value);
    setCopied(value);
    setTimeout(() => setCopied(''), 1800);
  }

  return (
    <StructureLayout displayName={displayName}>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {toast && <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border bg-white" style={{ borderColor: '#E4E7EC', color: '#002050' }}>{toast}</div>}

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-black" style={{ color: '#002050' }}>Codes Structure</h1>
            <p className="text-sm mt-1" style={{ color: '#6B7280' }}>Créez des codes avec une capacité définie et contrôlez chaque rattachement.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="px-3 py-2 rounded-xl border" style={{ borderColor: '#E4E7EC', color: '#6B7280' }}><RefreshCw size={14} /></button>
            <button onClick={openCreate} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: '#002050' }}><PlusCircle size={15} /> Créer un code</button>
          </div>
        </div>

        <div className="flex items-start gap-2 p-4 rounded-xl text-sm" style={{ background: '#EEF2FF', color: '#002050' }}>
          <QrCode size={16} className="mt-0.5 flex-shrink-0" />
          <p><strong>Rattachement simple :</strong> actif immédiatement. <strong>Accès ou avantage spécial :</strong> validation Omnia obligatoire. Dans tous les cas, la Structure vérifie la demande de chaque membre avant son rattachement.</p>
        </div>

        {loading ? <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} /></div>
          : codes.length === 0 ? <div className="bg-white rounded-2xl border-2 border-dashed p-16 text-center" style={{ borderColor: '#E4E7EC' }}><QrCode size={40} className="mx-auto mb-3 opacity-10" style={{ color: '#002050' }} /><p className="font-bold" style={{ color: '#002050' }}>Aucun code créé</p></div>
          : <div className="space-y-3">
            {codes.map(code => {
              const sc = CODE_STATUS[code.status] ?? CODE_STATUS.draft;
              const editable = ['draft', 'changes_requested', 'rejected'].includes(code.status);
              const submitable = code.requires_admin_validation && editable;
              return <div key={code.id} className="bg-white rounded-2xl border p-5" style={{ borderColor: '#E4E7EC' }}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold" style={{ color: '#002050' }}>{code.code_name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#F3F4F6', color: '#6B7280' }}>{code.type_label}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <code className="text-sm font-mono font-bold px-3 py-1.5 rounded-lg" style={{ background: '#F0F4FF', color: '#002050' }}>{code.code_value}</code>
                      <button onClick={() => copyValue(code.code_value)} className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border" style={{ borderColor: '#E4E7EC', color: '#6B7280' }}><Copy size={12} /> {copied === code.code_value ? 'Copié' : 'Copier'}</button>
                      {code.pin_enabled && <button onClick={() => copyValue(code.pin)} className="text-xs px-2 py-1.5 rounded-lg border" style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>PIN : {copied === code.pin ? 'copié' : code.pin}</button>}
                    </div>
                    <div className="flex gap-4 mt-3 flex-wrap text-xs" style={{ color: '#6B7280' }}>
                      <span><strong style={{ color: '#002050' }}>{code.current_uses}</strong> / {code.max_uses} membres</span>
                      <span><strong style={{ color: '#92400E' }}>{code.pending_uses}</strong> demande(s) en attente</span>
                      <span><strong style={{ color: '#065F46' }}>{code.remaining_uses}</strong> place(s) restante(s)</span>
                      {code.expires_at && <span>Expire le {new Date(code.expires_at).toLocaleDateString('fr-FR')}</span>}
                    </div>
                    {code.description && <p className="text-sm mt-2" style={{ color: '#6B7280' }}>{code.description}</p>}
                    {code.admin_comment && <div className="flex items-start gap-2 mt-3 p-3 rounded-xl text-xs" style={{ background: '#FEF3C7', color: '#92400E' }}><AlertCircle size={13} className="mt-0.5 flex-shrink-0" /><span><strong>Administration Omnia :</strong> {code.admin_comment}</span></div>}
                  </div>
                  <div className="flex gap-2">
                    {editable && <button onClick={() => openEdit(code)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border" style={{ borderColor: '#E4E7EC', color: '#374151' }}><Pencil size={12} /> Modifier</button>}
                    {submitable && <button onClick={() => handleSubmit(code.id)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white" style={{ background: '#1E7A52' }}><CheckCircle size={12} /> Soumettre</button>}
                  </div>
                </div>
              </div>;
            })}
          </div>}

        {showModal && <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-lg font-black" style={{ color: '#002050' }}>{editingCode ? 'Modifier le code' : 'Créer un code Structure'}</h2><button onClick={() => setShowModal(false)} className="text-gray-400"><XCircle size={20} /></button></div>
            <div><label className="block text-xs font-semibold mb-1.5 text-gray-500">Nom du code *</label><input className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" value={form.code_name} onChange={e => set('code_name', e.target.value)} /></div>
            <div><label className="block text-xs font-semibold mb-1.5 text-gray-500">Type</label><select className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" value={form.code_type} onChange={e => set('code_type', e.target.value)}>{CODE_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></div>
            <div><label className="block text-xs font-semibold mb-1.5 text-gray-500">Description</label><textarea rows={2} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none" value={form.description} onChange={e => set('description', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-semibold mb-1.5 text-gray-500">Limite de membres *</label><input type="number" min={1} max={100000} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" value={form.max_uses} onChange={e => set('max_uses', Number(e.target.value))} /></div>
              <div><label className="block text-xs font-semibold mb-1.5 text-gray-500">Expiration</label><input type="date" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" value={form.expires_at} onChange={e => set('expires_at', e.target.value)} /></div>
            </div>
            <div><label className="block text-xs font-semibold mb-1.5 text-gray-500">PIN optionnel</label><input className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" placeholder="Laissez vide pour aucun PIN" value={form.pin} onChange={e => set('pin', e.target.value)} /></div>
            <div className="p-3 rounded-xl text-xs" style={{ background: '#F8F9FA', color: '#6B7280' }}>Chaque utilisation crée une demande que votre Structure doit vérifier. Aucun rattachement n’est automatique.</div>
            <div className="flex gap-3"><button onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-xl text-sm font-semibold border" style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>Annuler</button><button onClick={handleSave} className="flex-1 py-3 rounded-xl text-sm font-bold text-white" style={{ background: '#002050' }}>Enregistrer</button></div>
          </div>
        </div>}
      </div>
    </StructureLayout>
  );
}
