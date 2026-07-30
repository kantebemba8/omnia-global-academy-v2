import { useEffect, useState } from 'react';
import { StructureLayout } from '../../components/StructureLayout';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { Gift, PlusCircle, RefreshCw, XCircle, CheckCircle, AlertCircle, Clock } from 'lucide-react';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/structure-manage`;

const STATUS: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  draft:                    { label: 'Brouillon',                    color: '#6B7280', bg: '#F3F4F6',  icon: Clock },
  pending_admin_validation: { label: 'En attente Super Admin',       color: '#92400E', bg: '#FEF3C7',  icon: Clock },
  changes_requested:        { label: 'Modification demandée',        color: '#1D4ED8', bg: '#EFF6FF',  icon: AlertCircle },
  validated:                { label: 'Validé',                       color: '#065F46', bg: '#D1FAE5',  icon: CheckCircle },
  active:                   { label: 'Actif ✓',                      color: '#065F46', bg: '#D1FAE5',  icon: CheckCircle },
  rejected:                 { label: 'Refusé',                       color: '#991B1B', bg: '#FEE2E2',  icon: XCircle },
  suspended:                { label: 'Suspendu',                     color: '#374151', bg: '#F3F4F6',  icon: AlertCircle },
  expired:                  { label: 'Expiré',                       color: '#6B7280', bg: '#F3F4F6',  icon: Clock },
};

const BENEFIT_TYPES = [
  { value: 'reduction_formation',      label: 'Réduction formation' },
  { value: 'acces_gratuit_formation',  label: 'Accès gratuit formation' },
  { value: 'acces_formation_reservee', label: 'Accès formation réservée' },
  { value: 'acces_omnia_career',       label: 'Accès Omnia Career' },
  { value: 'acces_cv_builder',         label: 'Accès CV Builder' },
  { value: 'bonus_jetons_cv',          label: 'Bonus jetons CV' },
  { value: 'reduction_abonnement',     label: 'Réduction abonnement' },
  { value: 'acces_programme_special',  label: 'Accès programme spécial' },
  { value: 'certificat_special',       label: 'Certificat spécial' },
  { value: 'autre',                    label: 'Autre avantage personnalisé' },
];

const DISPLAY: Record<string, string> = {
  ministere: 'Espace Ministère', etablissement: 'Espace Établissement',
  universite: 'Espace Université', ecole: 'Espace École',
  centre_formation: 'Espace Centre de formation', entreprise: 'Espace Entreprise',
  ong: 'Espace ONG', association: 'Espace Association',
  institution_publique: 'Espace Institution publique',
  organisation_internationale: 'Espace Organisation internationale',
  cabinet_formation: 'Espace Cabinet de formation', autre: 'Espace Structure professionnelle',
};

export default function StructureAvantages() {
  const [benefits, setBenefits] = useState<any[]>([]);
  const [structureId, setStructureId] = useState('');
  const [displayName, setDisplayName] = useState('Espace Structure');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({
    benefit_name: '', benefit_type: 'reduction_formation',
    description: '', eligibility_conditions: '',
    discount_percentage: 0, max_beneficiaries: 0,
    starts_at: '', ends_at: '', structure_comment: '',
    free_access: false, omnia_career_access: false, cv_token_bonus: 0,
  });
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  async function load(sid?: string) {
    const id = sid || structureId;
    if (!id) return;
    const res = await fetch(API, {
      method: 'POST',
      headers: edgeAuthHeaders(),
      body: JSON.stringify({ action: 'list_benefits', structure_id: id }),
    });
    const data = await res.json();
    if (data.success) setBenefits(data.benefits ?? []);
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      const res = await fetch(API, {
        method: 'POST',
        headers: edgeAuthHeaders(),
        body: JSON.stringify({ action: 'get_my_structure' }),
      });
      const data = await res.json();
      if (data.success) {
        setStructureId(data.structure.id);
        setDisplayName(DISPLAY[data.structure.structure_type] ?? 'Espace Structure');
        load(data.structure.id);
      } else setLoading(false);
    })();
  }, []);

  async function handlePropose() {
    if (!form.benefit_name || !form.benefit_type) { showToast('Nom et type requis'); return; }
    const res = await fetch(API, {
      method: 'POST',
      headers: edgeAuthHeaders(),
      body: JSON.stringify({ action: 'propose_benefit', structure_id: structureId, ...form }),
    });
    const data = await res.json();
    if (data.success) {
      showToast('✅ Demande envoyée au Super Admin');
      setShowModal(false);
      setForm({ benefit_name: '', benefit_type: 'reduction_formation', description: '', eligibility_conditions: '', discount_percentage: 0, max_beneficiaries: 0, starts_at: '', ends_at: '', structure_comment: '', free_access: false, omnia_career_access: false, cv_token_bonus: 0 });
      load();
    } else showToast(data.error ?? 'Erreur');
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
            <h1 className="text-2xl font-black" style={{ color: '#002050' }}>Avantages structure</h1>
            <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
              Proposez des avantages pour vos membres liés — validés par le Super Admin
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => load()} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm border"
              style={{ borderColor: '#E4E7EC', color: '#6B7280' }}><RefreshCw size={13} /></button>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: '#002050' }}>
              <PlusCircle size={15} /> Demander un avantage
            </button>
          </div>
        </div>

        {/* Info workflow */}
        <div className="flex items-start gap-2 p-3 rounded-xl text-sm" style={{ background: '#FEF3C7', border: '1px solid #FDE68A' }}>
          <AlertCircle size={15} style={{ color: '#92400E', flexShrink: 0, marginTop: 1 }} />
          <p style={{ color: '#78350F' }}>
            Vous pouvez <strong>proposer</strong> un avantage. Il sera examiné et activé uniquement par le Super Admin.
            Aucun avantage ne peut être activé sans validation.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
          </div>
        ) : benefits.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed p-16 text-center" style={{ borderColor: '#E4E7EC' }}>
            <Gift size={40} className="mx-auto mb-3 opacity-10" style={{ color: '#002050' }} />
            <p className="font-bold" style={{ color: '#002050' }}>Aucun avantage demandé</p>
            <p className="text-sm mt-1 mb-5" style={{ color: '#9CA3AF' }}>Proposez votre premier avantage pour vos membres</p>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white mx-auto"
              style={{ background: '#002050' }}>
              <PlusCircle size={15} /> Demander un avantage
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {benefits.map(b => {
              const sc = STATUS[b.status] ?? STATUS.draft;
              const Icon = sc.icon;
              return (
                <div key={b.id} className="bg-white rounded-2xl border p-5" style={{ borderColor: '#E4E7EC' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold" style={{ color: '#002050' }}>{b.benefit_name}</h3>
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: sc.bg, color: sc.color }}>
                          <Icon size={10} /> {sc.label}
                        </span>
                      </div>
                      {b.description && <p className="text-sm mt-1" style={{ color: '#6B7280' }}>{b.description}</p>}
                      <div className="flex items-center gap-3 mt-2 flex-wrap text-xs" style={{ color: '#9CA3AF' }}>
                        {b.discount_percentage > 0 && <span>🏷️ {b.discount_percentage}% de réduction</span>}
                        {b.free_access && <span>🎁 Accès gratuit</span>}
                        {b.omnia_career_access && <span>💼 Accès Omnia Career</span>}
                        {b.cv_token_bonus > 0 && <span>🪙 +{b.cv_token_bonus} jetons CV</span>}
                        {b.max_beneficiaries > 0 && <span>👥 Max {b.max_beneficiaries} bénéficiaires</span>}
                      </div>
                      {b.admin_comment && (
                        <div className="mt-2 p-2 rounded-lg text-xs" style={{ background: b.status === 'rejected' ? '#FEE2E2' : '#EFF6FF', color: b.status === 'rejected' ? '#991B1B' : '#1D4ED8' }}>
                          💬 Super Admin : {b.admin_comment}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 my-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black" style={{ color: '#002050' }}>Proposer un avantage</h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400"><XCircle size={20} /></button>
              </div>

              {[
                { label: 'Nom de l\'avantage *', field: 'benefit_name', type: 'text' },
                { label: 'Description', field: 'description', type: 'textarea' },
                { label: 'Conditions d\'éligibilité', field: 'eligibility_conditions', type: 'textarea' },
                { label: 'Message justificatif', field: 'structure_comment', type: 'textarea' },
              ].map(({ label, field, type }) => (
                <div key={field}>
                  <label className="block text-xs font-semibold mb-1.5 text-gray-500">{label}</label>
                  {type === 'textarea' ? (
                    <textarea className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#002050] resize-none"
                      rows={2} value={(form as any)[field]} onChange={e => set(field, e.target.value)} />
                  ) : (
                    <input className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#002050]"
                      value={(form as any)[field]} onChange={e => set(field, e.target.value)} />
                  )}
                </div>
              ))}

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-gray-500">Type d'avantage *</label>
                <select className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#002050]"
                  value={form.benefit_type} onChange={e => set('benefit_type', e.target.value)}>
                  {BENEFIT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5 text-gray-500">Réduction (%)</label>
                  <input type="number" min="0" max="100" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#002050]"
                    value={form.discount_percentage} onChange={e => set('discount_percentage', parseInt(e.target.value))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 text-gray-500">Max bénéficiaires</label>
                  <input type="number" min="0" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#002050]"
                    value={form.max_beneficiaries} onChange={e => set('max_beneficiaries', parseInt(e.target.value))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5 text-gray-500">Date de début</label>
                  <input type="date" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#002050]"
                    value={form.starts_at} onChange={e => set('starts_at', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 text-gray-500">Date de fin</label>
                  <input type="date" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#002050]"
                    value={form.ends_at} onChange={e => set('ends_at', e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                {[
                  { field: 'free_access', label: 'Inclut un accès gratuit à une formation' },
                  { field: 'omnia_career_access', label: 'Inclut un accès Omnia Career' },
                ].map(({ field, label }) => (
                  <label key={field} className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={(form as any)[field]} onChange={e => set(field, e.target.checked)}
                      className="w-4 h-4 rounded" style={{ accentColor: '#002050' }} />
                    <span className="text-sm" style={{ color: '#374151' }}>{label}</span>
                  </label>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm border"
                  style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>Annuler</button>
                <button onClick={handlePropose}
                  className="flex-1 py-3 rounded-xl font-bold text-white text-sm"
                  style={{ background: '#002050' }}>Soumettre la demande</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </StructureLayout>
  );
}
