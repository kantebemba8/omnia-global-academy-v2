import { useEffect, useState } from 'react';
import { edgeAuthHeaders } from '../lib/edgeAuth';
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, Send, ShieldCheck, UploadCloud } from 'lucide-react';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quality-center`;
const BLUE = '#002050';
const GOLD = '#BF8813';

const LABELS: Record<string, string> = {
  draft: 'Brouillon qualité', submitted: 'Soumis au Centre Qualité', in_review: 'Contrôle en cours',
  changes_requested: 'Modifications demandées', approved: 'Validé par le Centre Qualité',
  rejected: 'Refusé', suspended: 'Suspendu', archived: 'Archivé',
};

export default function StudioQualityStatusPanel({ courseId }: { courseId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [evidence, setEvidence] = useState<Record<string, any[]>>({});
  const [error, setError] = useState('');

  async function call(action: string, body: any = {}) {
    const response = await fetch(API, { method: 'POST', headers: edgeAuthHeaders(), body: JSON.stringify({ action, ...body }) });
    const payload = await response.json();
    if (!response.ok || payload.success === false) throw new Error(payload.message || payload.error || 'Erreur');
    return payload;
  }

  async function load() {
    if (!courseId) return;
    setLoading(true); setError('');
    try { setData(await call('creator_status', { course_id: courseId })); }
    catch (e) { setError(e instanceof Error ? e.message : 'Impossible de charger le suivi qualité'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [courseId]);

  async function upload(changeId: string, file: File) {
    setBusy(`upload:${changeId}`);
    try {
      const signed = await call('prepare_evidence_upload', { course_id: courseId, review_id: data.review.id, file_name: file.name });
      const upload = await fetch(signed.signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
      if (!upload.ok) throw new Error('Téléversement impossible');
      setEvidence((current) => ({ ...current, [changeId]: [...(current[changeId] || []), { bucket: signed.bucket, path: signed.path, file_name: file.name, mime_type: file.type, size: file.size }] }));
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur de téléversement'); }
    finally { setBusy(''); }
  }

  async function respond(changeId: string) {
    const response = (responses[changeId] || '').trim();
    if (!response) { setError('Expliquez la correction réalisée.'); return; }
    setBusy(`respond:${changeId}`);
    try {
      await call('creator_respond_change_request', { change_request_id: changeId, response, evidence: evidence[changeId] || [] });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Réponse impossible'); }
    finally { setBusy(''); }
  }

  if (loading) return <div className="bg-white border border-gray-200 rounded-xl p-4 text-sm text-gray-400">Chargement du suivi qualité…</div>;
  if (error && !data) return <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>;
  if (!data?.review) return <div className="bg-white border border-gray-200 rounded-xl p-5"><div className="flex items-center gap-3"><ShieldCheck size={20} color={GOLD}/><div><p className="font-bold" style={{ color: BLUE }}>Centre Qualité</p><p className="text-sm text-gray-500">La revue sera créée automatiquement lors de la soumission.</p></div></div></div>;

  const review = data.review;
  const openChanges = (data.change_requests || []).filter((item: any) => ['open', 'responded', 'rejected'].includes(item.status));
  const Icon = review.status === 'approved' ? CheckCircle2 : review.status === 'changes_requested' ? AlertTriangle : Clock3;
  return <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
    <div className="p-5 border-b border-gray-200 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3"><Icon size={20} color={review.status === 'approved' ? '#047857' : GOLD}/><div><p className="font-bold" style={{ color: BLUE }}>Suivi du Centre Qualité</p><p className="text-sm text-gray-500 mt-1">{LABELS[review.status] || review.status}{review.accelerated ? ' · procédure accélérée Omnia' : ''}</p>{review.decision_summary && <p className="text-sm text-gray-600 mt-2">{review.decision_summary}</p>}</div></div>
      <button onClick={load} className="text-gray-500"><RefreshCw size={16}/></button>
    </div>
    {error && <div className="mx-5 mt-4 border-l-4 border-red-500 pl-3 text-sm text-red-700">{error}</div>}
    <div className="p-5 space-y-4">
      {openChanges.length === 0 ? <p className="text-sm text-gray-500">Aucune correction ouverte.</p> : openChanges.map((change: any) => <div key={change.id} className="border-l-4 pl-4 py-2" style={{ borderColor: change.severity === 'critical' ? '#DC2626' : GOLD }}>
        <div className="flex items-center justify-between gap-3"><p className="font-semibold text-sm" style={{ color: BLUE }}>{change.title}</p><span className="text-xs text-gray-400">{change.severity}</span></div>
        <p className="text-sm text-gray-600 mt-1">{change.description}</p>
        {change.creator_response && <div className="mt-2 bg-gray-50 rounded-lg p-3 text-sm text-gray-600"><strong>Réponse envoyée :</strong> {change.creator_response}</div>}
        {change.status !== 'resolved' && <div className="mt-3 space-y-2"><textarea value={responses[change.id] || ''} onChange={(event) => setResponses((current) => ({ ...current, [change.id]: event.target.value }))} placeholder="Expliquez les modifications réalisées" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-20"/><div className="flex flex-wrap items-center gap-2"><label className="inline-flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm cursor-pointer"><UploadCloud size={15}/>Joindre une preuve<input type="file" className="hidden" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) upload(change.id, file); event.currentTarget.value = ''; }}/></label>{(evidence[change.id] || []).map((file) => <span key={file.path} className="text-xs text-gray-500">{file.file_name}</span>)}<button onClick={() => respond(change.id)} disabled={busy === `respond:${change.id}`} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-white text-sm font-semibold disabled:opacity-50" style={{ background: BLUE }}><Send size={15}/>Envoyer la réponse</button></div></div>}
      </div>)}
    </div>
  </div>;
}
