import { useEffect, useMemo, useState } from 'react';
import { Radio, Trash2, Video, X } from 'lucide-react';

type ApiCall = (action: string, payload?: Record<string, unknown>) => Promise<any>;

export function CourseLiveLinksManager({ courseId, courseTitle, call, onClose }: {
  courseId: string;
  courseTitle: string;
  call: ApiCall;
  onClose: () => void;
}) {
  const [links, setLinks] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [target, setTarget] = useState('');
  const [required, setRequired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const options = useMemo(() => [
    ...events.map((item: any) => ({ value: `event:${item.id}`, label: `Live · ${item.title || 'Sans titre'}` })),
    ...media.map((item: any) => ({ value: `media:${item.id}`, label: `${item.media_type === 'replay' ? 'Replay' : 'Vidéo'} · ${item.title || 'Sans titre'}` })),
  ], [events, media]);

  async function reload() {
    setError('');
    try {
      const [commercial, available] = await Promise.all([
        call('get_commercialization', { course_id: courseId }),
        call('list_live_content_options', { course_id: courseId }),
      ]);
      setLinks(commercial.live_links || []);
      setEvents(available.events || []);
      setMedia(available.media || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger les Lives et Replays.');
    }
  }

  useEffect(() => { void reload(); }, [courseId]);

  async function add() {
    if (!target) return;
    const [kind, id] = target.split(':');
    setBusy(true); setError('');
    try {
      await call('add_course_live_link', {
        course_id: courseId,
        event_id: kind === 'event' ? id : undefined,
        media_id: kind === 'media' ? id : undefined,
        required,
        position: links.length,
      });
      setTarget(''); setRequired(false); await reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Liaison impossible.'); }
    finally { setBusy(false); }
  }

  async function remove(linkId: string) {
    if (!window.confirm('Retirer ce contenu Live/Replay de la formation ?')) return;
    setBusy(true); setError('');
    try { await call('remove_course_live_link', { course_id: courseId, link_id: linkId }); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Suppression impossible.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: '#E4E7EC' }}>
          <div><p className="text-xs font-bold uppercase tracking-[.12em] text-[#BF8813]">Contenus complémentaires</p><h2 className="mt-1 font-bold text-[#002050]">Lives, Replays et vidéos</h2><p className="mt-1 text-xs text-slate-500 line-clamp-1">{courseTitle}</p></div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-50" aria-label="Fermer"><X size={18}/></button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">
          <p className="text-sm text-slate-600">Vous pouvez compléter une formation déjà agréée sans créer une nouvelle version lorsqu’il s’agit d’un contenu complémentaire. Un remplacement d’un élément pédagogique obligatoire doit passer par une nouvelle version.</p>
          {error && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}
          <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto_auto]">
            <select value={target} onChange={e=>setTarget(e.target.value)} disabled={busy} className="rounded-lg border px-3 py-2 text-sm" style={{borderColor:'#E4E7EC'}}>
              <option value="">Choisir un Live, Replay ou vidéo</option>
              {options.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold text-slate-600" style={{borderColor:'#E4E7EC'}}><input type="checkbox" checked={required} onChange={e=>setRequired(e.target.checked)} disabled={busy}/> Obligatoire</label>
            <button type="button" onClick={add} disabled={busy || !target} className="rounded-lg bg-[#002050] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Ajouter</button>
          </div>
          <div className="mt-5 divide-y rounded-xl border" style={{borderColor:'#E4E7EC'}}>
            {links.length === 0 && <p className="p-4 text-sm text-slate-500">Aucun contenu Live/Replay lié.</p>}
            {links.map(link => {
              const ev=link.live_events, m=link.live_media;
              return <div key={link.id} className="flex items-center gap-3 p-3">
                <span className="rounded-lg bg-slate-50 p-2 text-[#BF8813]">{m ? <Video size={16}/> : <Radio size={16}/>}</span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#002050]">{link.title_override || m?.title || ev?.title || 'Contenu Omnia Live'}</p><p className="text-[11px] text-slate-500">{m ? (m.media_type === 'replay' ? 'Replay' : 'Vidéo') : 'Live'}{link.required ? ' · obligatoire' : ' · complémentaire'}</p></div>
                <button type="button" onClick={()=>remove(link.id)} disabled={busy} className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-40" title="Retirer"><Trash2 size={15}/></button>
              </div>;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
