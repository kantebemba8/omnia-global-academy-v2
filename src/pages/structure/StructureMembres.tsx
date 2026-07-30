import { useEffect, useState } from 'react';
import { StructureLayout } from '../../components/StructureLayout';
import { Users, CheckCircle, XCircle, RefreshCw, Search, UserCheck } from 'lucide-react';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/structure-manage`;

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: 'En attente',  color: '#92400E', bg: '#FEF3C7' },
  approved: { label: 'Accepté',     color: '#065F46', bg: '#D1FAE5' },
  rejected: { label: 'Refusé',      color: '#991B1B', bg: '#FEE2E2' },
  removed:  { label: 'Retiré',      color: '#374151', bg: '#F3F4F6' },
};

const DISPLAY: Record<string, string> = {
  ministere: 'Espace Ministère', etablissement: 'Espace Établissement',
  universite: 'Espace Université', ecole: 'Espace École',
  centre_formation: 'Espace Centre de formation', entreprise: 'Espace Entreprise',
  ong: 'Espace ONG', association: 'Espace Association',
  institution_publique: 'Espace Institution publique',
  organisation_internationale: 'Espace Organisation internationale',
  cabinet_formation: 'Espace Cabinet de formation', autre: 'Espace Structure professionnelle',
};

export default function StructureMembres() {
  const [members, setMembers] = useState<any[]>([]);
  const [structureId, setStructureId] = useState('');
  const [displayName, setDisplayName] = useState('Espace Structure');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');

  const token = () => localStorage.getItem('omnia_session_token') || '';
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  async function load(sid?: string) {
    const id = sid || structureId;
    if (!id) return;
    setLoading(true);
    const res = await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list_members', structure_id: id }),
    });
    const data = await res.json();
    if (data.success) setMembers(data.members ?? []);
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      const res = await fetch(API, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
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

  async function handleDecision(membershipId: string, decision: 'approve' | 'reject') {
    await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'handle_membership', structure_id: structureId, membership_id: membershipId, decision }),
    });
    showToast(decision === 'approve' ? '✅ Membre accepté' : '❌ Demande refusée');
    load();
  }

  const filtered = members.filter(m => {
    const matchStatus = filter === 'all' || m.status === filter;
    const name = m.users?.full_name ?? '';
    const email = m.users?.email ?? '';
    const matchSearch = !search || name.toLowerCase().includes(search.toLowerCase()) || email.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const pending = members.filter(m => m.status === 'pending').length;

  return (
    <StructureLayout displayName={displayName}>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {toast && (
          <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border"
            style={{ background: 'white', borderColor: '#E4E7EC', color: '#002050' }}>{toast}</div>
        )}

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-black" style={{ color: '#002050' }}>Membres liés</h1>
            <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
              Apprenants rattachés à votre structure via un code
              {pending > 0 && <span className="ml-2 font-bold" style={{ color: '#92400E' }}>· {pending} en attente</span>}
            </p>
          </div>
          <button onClick={() => load()} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm border"
            style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>
            <RefreshCw size={13} />
          </button>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-3 text-gray-400" />
            <input className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#002050]"
              placeholder="Rechercher un membre..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'all', label: 'Tous' },
              { key: 'pending', label: `En attente${pending > 0 ? ` (${pending})` : ''}` },
              { key: 'approved', label: 'Acceptés' },
              { key: 'rejected', label: 'Refusés' },
            ].map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                style={filter === f.key ? { background: '#002050', color: 'white' } : { background: 'white', color: '#6B7280', border: '1px solid #E4E7EC' }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed p-16 text-center" style={{ borderColor: '#E4E7EC' }}>
            <Users size={40} className="mx-auto mb-3 opacity-10" style={{ color: '#002050' }} />
            <p className="font-bold" style={{ color: '#002050' }}>Aucun membre</p>
            <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>
              {filter !== 'all' ? 'Aucun membre dans cette catégorie' : 'Partagez votre code structure pour recevoir des demandes'}
            </p>
          </div>
        ) : (
          <div className="oga-table-scroll bg-white rounded-2xl border" style={{ borderColor: '#E4E7EC' }}>
            <table className="w-full min-w-[760px]">
              <thead>
                <tr style={{ background: '#F8F9FA', borderBottom: '1px solid #E4E7EC' }}>
                  {['Membre', 'Code utilisé', 'Date demande', 'Statut', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#6B7280' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, i) => {
                  const sc = STATUS[m.status] ?? STATUS.pending;
                  return (
                    <tr key={m.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{ background: '#EEF2FF', color: '#002050' }}>
                            {(m.users?.full_name ?? '?').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold" style={{ color: '#002050' }}>{m.users?.full_name ?? '-'}</p>
                            <p className="text-xs" style={{ color: '#9CA3AF' }}>{m.users?.email ?? '-'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono px-2 py-1 rounded" style={{ background: '#F0F4FF', color: '#002050' }}>
                          {m.structure_code_id ? '••••' : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#6B7280' }}>
                        {new Date(m.requested_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        {m.status === 'pending' && (
                          <div className="flex gap-1.5">
                            <button onClick={() => handleDecision(m.id, 'approve')}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                              style={{ background: '#1E7A52' }}>
                              <CheckCircle size={11} /> Accepter
                            </button>
                            <button onClick={() => handleDecision(m.id, 'reject')}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border"
                              style={{ borderColor: '#FECACA', color: '#DC2626' }}>
                              <XCircle size={11} /> Refuser
                            </button>
                          </div>
                        )}
                        {m.status === 'approved' && (
                          <span className="flex items-center gap-1 text-xs" style={{ color: '#065F46' }}>
                            <UserCheck size={12} /> Lié
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </StructureLayout>
  );
}
