import { getSessionToken } from '../../lib/session';
import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { QrCode, RefreshCw, CheckCircle, XCircle, AlertCircle, Search, Clock } from 'lucide-react';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/structure-manage`;

const CODE_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Brouillon', color: '#6B7280', bg: '#F3F4F6' },
  changes_requested: { label: 'Modifications demandées', color: '#92400E', bg: '#FEF3C7' },
  pending_admin_validation: { label: 'En attente', color: '#92400E', bg: '#FEF3C7' },
  active: { label: 'Actif', color: '#065F46', bg: '#D1FAE5' },
  inactive: { label: 'Inactif', color: '#374151', bg: '#F3F4F6' },
  expired: { label: 'Expiré', color: '#6B7280', bg: '#F3F4F6' },
  suspended: { label: 'Suspendu', color: '#991B1B', bg: '#FEE2E2' },
  rejected: { label: 'Refusé', color: '#991B1B', bg: '#FEE2E2' },
};

export default function AdminStructureCodes() {
  const [codes, setCodes] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState('');
  const [comments, setComments] = useState<Record<string, string>>({});
  const [edits, setEdits] = useState<Record<string, { max_uses: number; expires_at: string; description: string }>>({});

  const token = () => getSessionToken() || '';
  const showToast = (message: string) => { setToast(message); setTimeout(() => setToast(''), 3500); };

  async function api(body: Record<string, unknown>) {
    const response = await fetch(API, { method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success !== true) throw new Error(data.message || data.error || 'Action impossible.');
    return data;
  }

  async function load(nextFilter = filter, nextSearch = search) {
    setLoading(true);
    try {
      const data = await api({ action: 'admin_list_codes', status_filter: nextFilter, search: nextSearch });
      setCodes(data.codes ?? []);
      setStats(data.stats ?? {});
      const nextEdits: Record<string, any> = {};
      for (const code of data.codes ?? []) nextEdits[code.id] = { max_uses: Number(code.max_uses || 1), expires_at: code.expires_at ? String(code.expires_at).slice(0, 10) : '', description: code.description ?? '' };
      setEdits(nextEdits);
    } catch (error) { showToast(error instanceof Error ? error.message : 'Chargement impossible.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load('all', ''); }, []);

  async function handleDecision(code: any, decision: string) {
    setBusy(code.id);
    try {
      const edit = edits[code.id] ?? { max_uses: code.max_uses, expires_at: code.expires_at ?? '', description: code.description ?? '' };
      await api({ action: 'admin_validate_code', code_id: code.id, decision, admin_comment: comments[code.id] || '', ...edit });
      showToast(decision === 'activate' ? 'Code activé.' : decision === 'request_changes' ? 'Modifications demandées.' : decision === 'reject' ? 'Code refusé.' : 'Action effectuée.');
      await load();
    } catch (error) { showToast(error instanceof Error ? error.message : 'Action impossible.'); }
    finally { setBusy(''); }
  }

  const filters = [
    ['all', `Tous (${stats.total ?? 0})`],
    ['pending_admin_validation', `En attente (${stats.pending ?? 0})`],
    ['active', `Actifs (${stats.active ?? 0})`],
    ['changes_requested', `À modifier (${stats.changes_requested ?? 0})`],
    ['suspended', `Suspendus (${stats.suspended ?? 0})`],
  ];

  return <AdminLayout>
    <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
      {toast && <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border bg-white" style={{ borderColor: '#E4E7EC', color: '#002050' }}>{toast}</div>}
      <div className="flex items-start justify-between gap-3"><div><h1 className="text-2xl font-black" style={{ color: '#002050' }}>Codes Structure</h1><p className="text-sm mt-1" style={{ color: '#6B7280' }}>Contrôlez les codes spéciaux, leurs limites et leur cycle de validation.</p></div><button onClick={() => load()} className="px-3 py-2 rounded-xl border" style={{ borderColor: '#E4E7EC', color: '#6B7280' }}><RefreshCw size={14} /></button></div>

      <div className="flex flex-wrap gap-2">{filters.map(([key, label]) => <button key={key} onClick={() => { setFilter(key); load(key, search); }} className="px-3 py-2 rounded-xl text-xs font-semibold" style={filter === key ? { background: '#002050', color: 'white' } : { background: 'white', color: '#6B7280', border: '1px solid #E4E7EC' }}>{label}</button>)}</div>
      <div className="relative"><Search size={14} className="absolute left-3 top-3 text-gray-400" /><input className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm" placeholder="Rechercher un code ou une Structure..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load(filter, search)} /></div>

      {loading ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} /></div>
        : codes.length === 0 ? <div className="bg-white rounded-2xl border-2 border-dashed p-12 text-center" style={{ borderColor: '#E4E7EC' }}><QrCode size={36} className="mx-auto mb-3 opacity-10" style={{ color: '#002050' }} /><p className="font-bold" style={{ color: '#002050' }}>Aucun code dans cette catégorie</p></div>
        : <div className="space-y-3">{codes.map(code => {
          const sc = CODE_STATUS[code.status] ?? CODE_STATUS.draft;
          const edit = edits[code.id] ?? { max_uses: code.max_uses, expires_at: '', description: code.description ?? '' };
          return <div key={code.id} className="bg-white rounded-2xl border p-5 space-y-4" style={{ borderColor: '#E4E7EC' }}>
            <div className="flex justify-between gap-4 flex-wrap"><div><div className="flex items-center gap-2 flex-wrap"><h3 className="font-bold" style={{ color: '#002050' }}>{code.code_name}</h3><span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span><span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#F3F4F6', color: '#6B7280' }}>{code.type_label}</span></div><p className="text-sm font-semibold mt-1" style={{ color: '#374151' }}>{code.structure?.org_name ?? 'Structure'}</p><code className="text-sm font-mono font-bold px-3 py-1 rounded-lg mt-2 inline-block" style={{ background: '#F0F4FF', color: '#002050' }}>{code.code_value}</code></div><div className="text-xs space-y-1 text-right" style={{ color: '#6B7280' }}><div>{code.current_uses}/{code.max_uses} membres</div><div>{code.pending_uses} demande(s) en attente</div><div>{code.remaining_uses} place(s) restante(s)</div></div></div>

            {code.status === 'pending_admin_validation' && <div className="space-y-3 pt-3 border-t" style={{ borderColor: '#F3F4F6' }}>
              <div className="grid md:grid-cols-2 gap-3"><div><label className="block text-xs font-semibold mb-1 text-gray-500">Limite validée</label><input type="number" min={1} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" value={edit.max_uses} onChange={e => setEdits(v => ({ ...v, [code.id]: { ...edit, max_uses: Number(e.target.value) } }))} /></div><div><label className="block text-xs font-semibold mb-1 text-gray-500">Expiration</label><input type="date" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" value={edit.expires_at} onChange={e => setEdits(v => ({ ...v, [code.id]: { ...edit, expires_at: e.target.value } }))} /></div></div>
              <textarea rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none" placeholder="Description validée..." value={edit.description} onChange={e => setEdits(v => ({ ...v, [code.id]: { ...edit, description: e.target.value } }))} />
              <textarea rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none" placeholder="Commentaire Administration Omnia..." value={comments[code.id] ?? ''} onChange={e => setComments(v => ({ ...v, [code.id]: e.target.value }))} />
              <div className="flex gap-2 flex-wrap"><button disabled={busy === code.id} onClick={() => handleDecision(code, 'activate')} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white" style={{ background: '#1E7A52' }}><CheckCircle size={12} /> Valider</button><button disabled={busy === code.id} onClick={() => handleDecision(code, 'request_changes')} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border" style={{ borderColor: '#F59E0B', color: '#92400E' }}><Clock size={12} /> Demander des modifications</button><button disabled={busy === code.id} onClick={() => handleDecision(code, 'reject')} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border" style={{ borderColor: '#FECACA', color: '#DC2626' }}><XCircle size={12} /> Refuser</button></div>
            </div>}

            {code.status === 'active' && <div className="flex gap-2 pt-3 border-t" style={{ borderColor: '#F3F4F6' }}><button onClick={() => handleDecision(code, 'suspend')} className="px-3 py-1.5 rounded-xl text-xs font-semibold border" style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>Suspendre</button><button onClick={() => handleDecision(code, 'deactivate')} className="px-3 py-1.5 rounded-xl text-xs font-semibold border" style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>Désactiver</button></div>}
            {code.status === 'suspended' && <button onClick={() => handleDecision(code, 'activate')} className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white" style={{ background: '#1E7A52' }}>Réactiver</button>}
            {code.admin_comment && code.status !== 'pending_admin_validation' && <div className="flex items-start gap-2 p-3 rounded-xl text-xs" style={{ background: '#FEF3C7', color: '#92400E' }}><AlertCircle size={13} className="mt-0.5" />{code.admin_comment}</div>}
          </div>;
        })}</div>}
    </div>
  </AdminLayout>;
}
