/**
 * A live Tiptap prose segment backed by one stable historical lesson_blocks row.
 * It intentionally does NOT rewrite the schema or flatten specialized blocks.
 * Existing legacy blocks remain independent and retain their metadata.
 */
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import StudioRichTextEditor from './StudioRichTextEditor';

export type StudioProseComposerHandle = {
  flush: () => Promise<boolean>;
  hasUnsaved: () => boolean;
};
type Choice = { type: string; label: string };
type Props = {
  language: string;
  draftKey: string;
  initialHtml: string;
  blockId?: string;
  choices: Choice[];
  onCommit: (html: string, blockId?: string) => Promise<string | false>;
  onInsertBlock: (type: string) => Promise<boolean>;
  onDelete?: (blockId: string) => Promise<boolean>;
};

function readable(html: string) {
  if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, '');
  const host = document.createElement('div');
  host.innerHTML = html;
  return host.textContent || '';
}

const StudioBlankPageComposer = forwardRef<StudioProseComposerHandle, Props>(function StudioBlankPageComposer(
  { language, draftKey, initialHtml, blockId, choices, onCommit, onInsertBlock, onDelete }, ref,
) {
  const storageKey = `oga_studio_v4_unsent_text_${draftKey}`;
  const [draft, setDraft] = useState(() => {
    try { return sessionStorage.getItem(storageKey) ?? initialHtml; } catch { return initialHtml; }
  });
  const latestDraft = useRef(draft);
  latestDraft.current = draft;
  const savedHtml = useRef(initialHtml);
  const savedBlockId = useRef(blockId);
  const busyPromise = useRef<Promise<boolean> | null>(null);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'saved' | 'pending' | 'saving' | 'error'>(draft === initialHtml ? 'saved' : 'pending');
  const current = readable(draft).trim();
  const slash = /^\/([^\s\/]{0,40})$/u.exec(current);
  const matching = useMemo(() => slash ? choices.filter(choice =>
    `${choice.label} ${choice.type}`.toLocaleLowerCase('fr').includes(slash[1].toLocaleLowerCase('fr'))).slice(0, 8) : [], [choices, slash?.[1]]);

  useEffect(() => {
    if (blockId && !savedBlockId.current) savedBlockId.current = blockId;
  }, [blockId]);
  useEffect(() => {
    try {
      if (draft !== savedHtml.current) sessionStorage.setItem(storageKey, draft);
      else sessionStorage.removeItem(storageKey);
    } catch { /* Private browsing may disable session storage. */ }
  }, [draft, status, storageKey]);

  async function flush(): Promise<boolean> {
    if (busyPromise.current) {
      const completed = await busyPromise.current;
      if (!completed) return false;
    }
    const snapshot = latestDraft.current;
    if (snapshot === savedHtml.current) return true;
    if (/^\/([^\s\/]{0,40})$/u.test(readable(snapshot).trim())) return false;
    // Do not create empty rows. Clearing an existing segment is a valid update.
    if (!savedBlockId.current && !readable(snapshot).trim() && !/<img\b/i.test(snapshot)) return true;
    setBusy(true);
    setStatus('saving');
    const operation = (async () => {
      try {
        const id = await onCommitRef.current(snapshot, savedBlockId.current);
        if (!id) { setStatus('error'); return false; }
        savedBlockId.current = id;
        savedHtml.current = snapshot;
        // The component may remount under the server-assigned block id before an
        // effect runs; clear the old recovery key synchronously on confirmation.
        if (latestDraft.current === snapshot) {
          try { sessionStorage.removeItem(storageKey); } catch { /* optional recovery */ }
        }
        setStatus(latestDraft.current === snapshot ? 'saved' : 'pending');
        return true;
      } catch {
        setStatus('error');
        return false;
      } finally { setBusy(false); }
    })();
    busyPromise.current = operation;
    try { return await operation; }
    finally { if (busyPromise.current === operation) busyPromise.current = null; }
  }
  useImperativeHandle(ref, () => ({ flush, hasUnsaved: () => latestDraft.current !== savedHtml.current }));

  useEffect(() => {
    if (draft === savedHtml.current || slash || status === 'error' || busy) return;
    const timer = window.setTimeout(() => { void flush(); }, 2200);
    return () => window.clearTimeout(timer);
  }, [draft, status, busy, slash?.[1]]);

  async function choose(type: string) {
    if (busyPromise.current) return;
    // Slash commands must never discard previously saved prose.
    const ok = await onInsertBlock(type);
    if (ok) {
      const restored = savedHtml.current;
      latestDraft.current = restored;
      setDraft(restored);
      setStatus('saved');
    }
  }

  async function remove() {
    const id = savedBlockId.current;
    if (!id || !onDelete || busyPromise.current) return;
    if (!await flush()) return;
    if (await onDelete(id)) {
      savedBlockId.current = undefined;
      savedHtml.current = '';
      latestDraft.current = '';
      setDraft('');
      setStatus('saved');
    }
  }

  return <section aria-label="Rédaction directe de la leçon" className="mt-3 mb-2 rounded-xl bg-white px-1 py-2">
    <StudioRichTextEditor value={draft} onChange={html => { latestDraft.current = html; setDraft(html); setStatus('pending'); }} locked={busy}
      language={language} plainPage onEditorBlur={() => { if (!busyPromise.current) void flush(); }}
      placeholder="Commencez à écrire ici, ou tapez / pour insérer un bloc…" />
    {slash && matching.length > 0 && <div role="listbox" aria-label="Commandes de blocs" className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
      {matching.map(choice => <button key={choice.type} type="button" role="option" aria-selected={false}
        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 focus-visible:bg-blue-50"
        disabled={busy} onClick={() => void choose(choice.type)}>{choice.label}</button>)}
    </div>}
    <div className="mt-2 flex flex-wrap items-center gap-2 px-3 text-xs">
      <span role={status === 'error' ? 'alert' : 'status'} className={`mr-auto ${status === 'error' ? 'text-red-700' : status === 'saved' ? 'text-emerald-700' : 'text-amber-700'}`}>
        {status === 'saved' ? 'Texte enregistré' : status === 'saving' ? 'Enregistrement…' : status === 'error' ? 'Échec réseau : brouillon conservé dans cet onglet' : 'Modifications non enregistrées'}
      </span>
      {status === 'error' && <button type="button" onClick={() => void flush()} className="rounded-lg border border-red-300 px-3 py-1.5 font-semibold text-red-700">Réessayer</button>}
      {savedBlockId.current && onDelete && <button type="button" disabled={busy} onClick={() => void remove()}
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 disabled:opacity-50">Supprimer ce texte</button>}
    </div>
  </section>;
});

export default StudioBlankPageComposer;
