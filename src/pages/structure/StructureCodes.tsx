import { useEffect, useState } from 'react';
import { StructureLayout } from '../../components/StructureLayout';
import { QrCode, PlusCircle, Copy, CheckCircle, XCircle, Clock, AlertCircle, Eye, RefreshCw } from 'lucide-react';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/structure-manage`;

const CODE_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  draft:                    { label: 'Brouillon',                      color: '#6B7280', bg: '#F3F4F6' },
  pending_admin_validation: { label: 'En attente Super Admin',         color: '#92400E', bg: '#FEF3C7' },
  active:                   { label: 'Actif',                          color: '#065F46', bg: '#D1FAE5' },
  inactive:                 { label: 'Inactif',                        color: '#374151', bg: '#F3F4F6' },
  expired:                  { label: 'Expiré',                         color: '#6B7280', bg: '#F3F4F6' },
  suspended:                { label: 'Suspendu',                       color: '#991B1B', bg: '#FEE2E2' },
  rejected:                 { label: 'Refusé',                         color: '#991B1B', bg: '#FEE2E2' },
};

const CODE_TYPES = [
  { value: 'rattachement_simple', label: 'Rattachement simple' },
  { value: 'acces_formation',     label: 'Accès formation' },
  { value: 'reduction_formation', label: 'Réduction formation' },
  { value: 'acces_omnia_career',  label: 'Accès Omnia Career' },
  { value: 'acces_groupe',        label: 'Accès groupe' },
  { value: 'programme_special',   label: 'Programme spécial' },
  { value: 'autre',               label: 'Autre' },
];

export default function StructureCodes() {
  const [codes, setCodes] = useState<any[]>([]);
  const [structureId, setStructureId] = useState('');
  const [displayName, setDisplayName] = useState('Espace Structure');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState('');
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({
    code_name: '', code_type: 'rattachement_simple', description: '',
    max_uses: 100, expires_at: '', requires_manual_validation: true, pin: '',
  });

  const DISPLAY: Record<string, string> = {
    ministere: 'Espace Ministère', etablissement: 'Espace Établissement',
    universite: 'Espace Université', ecole: 'Espace École',
    centre_formation: 'Espace Centre de formation', entreprise: 'Espace Entreprise',
    ong: 'Espace ONG', association: 'Espace Association',
    institution_publique: 'Espace Institution publique',
    organisation_internationale: 'Espace Organisation internationale',
    cabinet_formation: 'Espace Cabinet de formation', autre: 'Espace Structure professionnelle',
  };

  const token = () => localStorage.getItem('omnia_session_token') || '';
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3500); }

  async function load() {
    setLoading(true);
    const res = await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_my_structure' }),
    });
    const data = await res.json();
    if (!data.success) { setLoading(false); return; }
    const sid = data.structure.id;
    setStructureId(sid);
    setDisplayName(DISPLAY[data.structure.structure_type] ?? 'Espace Structure');

    const codesRes = await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list_codes', structure_id: sid }),
    });
    const codesData = await codesRes.json();
    if (codesData.success) setCodes(codesData.codes ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    if (!form.code_name) { showToast('Nom du code requis'); return; }
    const res = await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_code', structure_id: structureId, ...form }),
    });
    const data = await res.json();
    if (data.success) {
      showToast('✅ Code créé avec succès');
      setShowModal(false);
      setForm({ code_name: '', code_type: 'rattachement_simple', description: '', max_uses: 100, expires_at: '', requires_manual_validation: true, pin: '' });
      load();
    } else { showToast(data.error ?? 'Erreur'); }
  }

  async function handleSubmit(codeId: string) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'submit_code', structure_id: structureId, code_id: codeId }),
    });
    const data = await res.json();
    if (data.success) { showToast('✅ Code soumis pour validation'); load(); }
    else showToast(data.error ?? 'Erreur');
  }

  function copyCode(val: string) {
    navigator.clipboard.writeText(val);
    setCopied(val);
    setTimeout(() => setCopied(''), 2000);
  }

  return (
    <StructureLayout displayName={displayName}>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {toast && (
          <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border"
            style={{ background: 'white', borderColor: '#E4E7EC', color: '#002050' }}>{toast}</div>
        )}

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-black" style={{ color: '#002050' }}>Codes structure</h1>
            <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
              Gérez les codes permettant aux membres de se rattacher à votre structure
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm border"
              style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>
              <RefreshCw size={13} />
            </button>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: '#002050' }}>
              <PlusCircle size={15} /> Créer un code
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="flex items-start gap-2 p-3 rounded-xl text-sm" style={{ background: '#EEF2FF', color: '#002050' }}>
          <QrCode size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <p>Un code de type <strong>Rattachement simple</strong> peut être utilisé sans validation Super Admin.
          Les codes avec avantage ou accès spéciaux nécessitent une validation.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
          </div>
        ) : codes.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed p-16 text-center" style={{ borderColor: '#E4E7EC' }}>
            <QrCode size={40} className="mx-auto mb-3 opacity-10" style={{ color: '#002050' }} />
            <p className="font-bold" style={{ color: '#002050' }}>Aucun code créé</p>
            <p className="text-sm mt-1 mb-5" style={{ color: '#9CA3AF' }}>Créez votre premier code structure</p>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white mx-auto"
              style={{ background: '#002050' }}>
              <PlusCircle size={15} /> Créer un code
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {codes.map(code => {
              const sc = CODE_STATUS[code.status] ?? CODE_STATUS.draft;
              return (
                <div key={code.id} className="bg-white rounded-2xl border p-5" style={{ borderColor: '#E4E7EC' }}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold" style={{ color: '#002050' }}>{code.code_name}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: '#F3F4F6', color: '#6B7280' }}>{code.type_label}</span>
                      </div>

                      {/* Code value */}
                      <div className="flex items-center gap-2 mt-2">
                        <code className="text-sm font-mono font-bold px-3 py-1.5 rounded-lg"
                          style={{ background: '#F0F4FF', color: '#002050' }}>{code.code_value}</code>
                        <button onClick={() => copyCode(code.code_value)}
                          className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border transition-colors"
                          style={{ borderColor: '#E4E7EC', color: copied === code.code_value ? '#065F46' : '#6B7280' }}>
                          {copied === code.code_value ? <CheckCircle size={12} /> : <Copy size={12} />}
                          {copied === code.code_value ? 'Copié' : 'Copier'}
                        </button>
                      </div>

                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        <span className="text-xs" style={{ color: '#9CA3AF' }}>
                          {code.current_uses ?? 0} / {code.max_uses ?? '∞'} utilisations
                        </span>
                        {code.expires_at && (
                          <span className="text-xs" style={{ color: '#9CA3AF' }}>
                            Expire le {new Date(code.expires_at).toLocaleDateString('fr-FR')}
                          </span>
                        )}
                        {code.requires_manual_validation && (
                          <span className="text-xs flex items-center gap-1" style={{ color: '#92400E' }}>
                            <AlertCircle size={11} /> Validation manuelle
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      {code.status === 'draft' && (
                        <button onClick={() => handleSubmit(code.id)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white"
                          style={{ background: '#1E7A52' }}>
                          <CheckCircle size={12} /> Soumettre
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal création */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black" style={{ color: '#002050' }}>Créer un code structure</h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  <XCircle size={20} />
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-gray-500">Nom du code *</label>
                <input className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#002050]"
                  placeholder="ex: Code Étudiants 2026" value={form.code_name} onChange={e => set('code_name', e.target.value)} />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-gray-500">Type de code</label>
                <select className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#002050]"
                  value={form.code_type} onChange={e => set('code_type', e.target.value)}>
                  {CODE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-gray-500">Description</label>
                <textarea className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#002050] resize-none"
                  rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5 text-gray-500">Max utilisations</label>
                  <input type="number" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#002050]"
                    value={form.max_uses} onChange={e => set('max_uses', parseInt(e.target.value))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 text-gray-500">Date d'expiration</label>
                  <input type="date" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#002050]"
                    value={form.expires_at} onChange={e => set('expires_at', e.target.value)} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-gray-500">PIN (optionnel)</label>
                <input className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#002050]"
                  placeholder="Code secret supplémentaire" value={form.pin} onChange={e => set('pin', e.target.value)} />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={form.requires_manual_validation}
                  onChange={e => set('requires_manual_validation', e.target.checked)}
                  className="w-4 h-4 rounded" style={{ accentColor: '#002050' }} />
                <span className="text-sm" style={{ color: '#374151' }}>Validation manuelle obligatoire par le responsable</span>
              </label>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm border"
                  style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>Annuler</button>
                <button onClick={handleCreate}
                  className="flex-1 py-3 rounded-xl font-bold text-white text-sm"
                  style={{ background: '#002050' }}>Créer le code</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </StructureLayout>
  );
}
