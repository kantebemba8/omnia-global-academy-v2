/**
 * Direct-write canvas between existing OGA lesson_blocks.
 * Storage remains HTML under the standard 'text' block contract; no migration.
 * Commands beginning with '/' insert another registered block rather than HTML tokens.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import StudioRichTextEditor from './StudioRichTextEditor';

type Choice = { type: string; label: string };
type Props = {
  language: string;
  draftKey: string;
  choices: Choice[];
  onCommit: (html: string) => Promise<boolean>;
  onInsertBlock: (type: string) => Promise<boolean>;
};

function readable(html: string) {
  if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, '');
  const host = document.createElement('div'); host.innerHTML = html;
  return host.textContent || '';
}

export default function StudioBlankPageComposer({ language, draftKey, choices, onCommit, onInsertBlock }: Props) {
  const storageKey = `oga_studio_v4_unsent_text_${draftKey}`;
  const [draft, setDraft] = useState(() => {
    try { return sessionStorage.getItem(storageKey) || ''; } catch { return ''; }
  });
  useEffect(() => {
    try { if (draft) sessionStorage.setItem(storageKey, draft); else sessionStorage.removeItem(storageKey); } catch {}
  }, [draft, storageKey]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const current = readable(draft).trim();
  const slash = /^\/([^\s\/]{0,40})$/u.exec(current);
  const matching = useMemo(() => slash ? choices.filter(choice =>
    `${choice.label} ${choice.type}`.toLocaleLowerCase('fr').includes(slash[1].toLocaleLowerCase('fr'))).slice(0, 8) : [], [choices, slash?.[1]]);

  async function saveDraft() {
    if (busyRef.current || !current || slash) return;
    busyRef.current = true; setBusy(true);
    try {
      if (await onCommit(draft)) setDraft('');
    } finally { busyRef.current = false; setBusy(false); }
  }
  async function choose(type: string) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try {
      // Keep the slash draft until Supabase confirms creation. This avoids lost
      // work when a mobile connection fails or the creator loses permissions.
      if (await onInsertBlock(type)) setDraft('');
    } finally { busyRef.current = false; setBusy(false); }
  }

  return <section aria-label="Rédaction directe de la leçon" className="mt-3 mb-2 rounded-xl bg-white px-1 py-2">
    <StudioRichTextEditor value={draft} onChange={setDraft} locked={busy}
      language={language} plainPage onEditorBlur={() => { if (current && !slash && !busyRef.current) void saveDraft(); }}
      placeholder="Commencez à écrire ici, ou tapez / pour insérer un bloc…" />
    {slash && matching.length > 0 && <div role="listbox" aria-label="Commandes de blocs" className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
      {matching.map(choice => <button key={choice.type} type="button" role="option" aria-selected={false}
        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 focus-visible:bg-blue-50"
        disabled={busy} onClick={() => void choose(choice.type)}>{choice.label}</button>)}
    </div>}
    {current && !slash && <div className="mt-2 flex justify-end gap-2 px-3">
      <span className="mr-auto self-center text-xs text-slate-400">Votre texte est conservé ici jusqu’à son ajout à la leçon.</span>
      <button type="button" disabled={busy} onClick={() => void saveDraft()}
        className="rounded-lg bg-[#002050] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy ? 'Enregistrement…' : 'Ajouter ce texte à la leçon'}</button>
    </div>}
  </section>;
}
