import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent, type MouseEvent } from 'react';

type History = { previous: string[]; current: string; future: string[] };
const ALLOWED = new Set(['p','br','strong','em','u','ul','ol','li','a','blockquote','h2','h3','table','thead','tbody','tr','th','td']);
const BLOCKED = new Set(['script','style','meta','link','iframe','object','embed','svg','math','form','input','button','textarea','template']);

/** Sanitizes legacy HTML and Word paste before it is stored in lesson_blocks. */
export function cleanStudioRichHtml(raw: string): string {
  if (typeof document === 'undefined') return raw;
  const source = new DOMParser().parseFromString(String(raw || ''), 'text/html');
  const target = document.createElement('div');
  function appendSafe(node: Node, parent: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      parent.appendChild(document.createTextNode(node.textContent || ''));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const from = node as HTMLElement;
    const tag = from.tagName.toLowerCase();
    if (BLOCKED.has(tag)) return;
    let into: Node = parent;
    if (ALLOWED.has(tag) || ['b','i','h1','h4','h5','h6','div'].includes(tag)) {
      const normalized = tag === 'b' ? 'strong' : tag === 'i' ? 'em' : tag === 'div' ? 'p' : /^h[1456]$/.test(tag) ? 'h2' : tag;
      const element = document.createElement(normalized);
      if (normalized === 'a') {
        const href = String(from.getAttribute('href') || '').trim();
        if (/^https:\/\/[^\s<>]+$/i.test(href)) {
          element.setAttribute('href', href);
          element.setAttribute('rel', 'noopener noreferrer');
          element.setAttribute('target', '_blank');
        }
      }
      parent.appendChild(element);
      into = element;
    }
    Array.from(from.childNodes).forEach(child => appendSafe(child, into));
  }
  Array.from(source.body.childNodes).forEach(node => appendSafe(node, target));
  // An intentionally emptied field must remain empty after save/reload.
  if (!target.textContent?.trim() && !target.querySelector('table')) return '';
  return target.innerHTML;
}

function textToRichHtml(text: string): string {
  const escape = (value: string) => value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  return text.replace(/\r\n?/g,'\n').split(/\n{2,}/).map(paragraph => `<p>${escape(paragraph).replace(/\n/g,'<br>')}</p>`).join('');
}

export default function StudioRichTextEditor({value,onChange,locked,placeholder,headingLevel,language='fr'}: {
  value: string;
  onChange: (html: string) => void;
  locked: boolean;
  placeholder: string;
  headingLevel?: 1 | 2;
  language?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const history = useRef<History>({ previous: [], current: '', future: [] });
  const savedSelection = useRef<Range | null>(null);
  const [selectionTools, setSelectionTools] = useState(false);

  useEffect(() => {
    const element = host.current;
    if (!element || document.activeElement === element) return;
    const clean = cleanStudioRichHtml(String(value || ''));
    if (element.innerHTML !== clean) element.innerHTML = clean;
    history.current = { previous: [], current: clean, future: [] };
  }, [value]);

  function publish() {
    if (!host.current) return;
    const html = cleanStudioRichHtml(host.current.innerHTML);
    const timeline = history.current;
    if (timeline.current !== html) {
      timeline.previous.push(timeline.current);
      if (timeline.previous.length > 80) timeline.previous.shift();
      timeline.current = html;
      timeline.future = [];
    }
    onChange(html);
  }

  function showHistory(html: string) {
    const element = host.current;
    if (!element) return;
    element.innerHTML = html;
    onChange(html);
    element.focus();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  function undo() {
    const h = history.current;
    if (!h.previous.length) return;
    h.future.push(h.current);
    h.current = h.previous.pop() as string;
    showHistory(h.current);
  }

  function redo() {
    const h = history.current;
    if (!h.future.length) return;
    h.previous.push(h.current);
    h.current = h.future.pop() as string;
    showHistory(h.current);
  }

  function recordSelection() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !host.current) { setSelectionTools(false); return; }
    const range = sel.getRangeAt(0);
    if (!host.current.contains(range.commonAncestorContainer)) { setSelectionTools(false); return; }
    savedSelection.current = range.cloneRange();
    setSelectionTools(!sel.isCollapsed);
  }

  function editorRange(): Range | null {
    const editor = host.current;
    if (!editor) return null;
    const selection = window.getSelection();
    const live = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const candidate = live && editor.contains(live.commonAncestorContainer) ? live : savedSelection.current;
    if (candidate && editor.contains(candidate.commonAncestorContainer)) return candidate.cloneRange();
    const fallback = document.createRange();
    fallback.selectNodeContents(editor);
    fallback.collapse(false);
    return fallback;
  }

  function commitInsertion(range: Range, inserted: Node) {
    range.deleteContents();
    const insertedNodes = inserted.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? Array.from(inserted.childNodes) : [inserted];
    range.insertNode(inserted);
    const caret = document.createRange();
    const lastInserted = insertedNodes[insertedNodes.length - 1];
    if (lastInserted?.parentNode) caret.setStartAfter(lastInserted);
    else { caret.selectNodeContents(host.current as HTMLDivElement); caret.collapse(false); }
    caret.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(caret);
    savedSelection.current = caret.cloneRange();
    host.current?.focus();
    publish();
  }

  function formatInline(tag: 'strong'|'em'|'u') {
    if (locked) return;
    const range = editorRange();
    if (!range || range.collapsed) return;
    const wrapper = document.createElement(tag);
    wrapper.appendChild(range.extractContents());
    range.insertNode(wrapper);
    const select = document.createRange();
    select.selectNodeContents(wrapper);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(select);
    savedSelection.current = select.cloneRange();
    publish();
  }

  function insertList(ordered: boolean) {
    if (locked) return;
    const range = editorRange();
    if (!range) return;
    const selected = range.toString().split(/\n/).map(line => line.trim()).filter(Boolean);
    const list = document.createElement(ordered ? 'ol' : 'ul');
    for (const line of selected.length ? selected : ['']) {
      const item = document.createElement('li');
      item.textContent = line;
      list.appendChild(item);
    }
    commitInsertion(range, list);
  }

  function insertLink() {
    if (locked) return;
    const selected = editorRange();
    if (!selected) return;
    const url = window.prompt('Adresse HTTPS du lien');
    if (url === null) return;
    const href = url.trim();
    if (!/^https:\/\/[^\s<>]+$/i.test(href)) { window.alert('Utilisez une adresse HTTPS valide.'); return; }
    const link = document.createElement('a');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.appendChild(document.createTextNode(selected.toString() || href));
    commitInsertion(selected, link);
  }

  function insertTable() {
    if (locked) return;
    const range = editorRange();
    if (!range) return;
    const table = document.createElement('table');
    const body = document.createElement('tbody');
    for (let r = 0; r < 2; r++) {
      const row = document.createElement('tr');
      for (let c = 0; c < 2; c++) {
        const cell = document.createElement(r === 0 ? 'th' : 'td');
        cell.textContent = r === 0 ? `Colonne ${c + 1}` : '';
        row.appendChild(cell);
      }
      body.appendChild(row);
    }
    table.appendChild(body);
    commitInsertion(range, table);
  }

  function onPaste(event: ClipboardEvent<HTMLDivElement>) {
    if (locked) return;
    event.preventDefault();
    const text = event.clipboardData.getData('text/plain') || '';
    const html = headingLevel ? '' : event.clipboardData.getData('text/html');
    const sanitized = headingLevel ? text.replace(/\s+/g,' ').trim() : cleanStudioRichHtml(html || textToRichHtml(text));
    const range = editorRange();
    if (!range) return;
    const wrapper = document.createElement('div');
    if (headingLevel) wrapper.textContent = sanitized;
    else wrapper.innerHTML = sanitized;
    const fragment = document.createDocumentFragment();
    while (wrapper.firstChild) fragment.appendChild(wrapper.firstChild);
    commitInsertion(range, fragment);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (locked || !(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
    if (key === 'y') { event.preventDefault(); redo(); }
    if (key === 'b' && !headingLevel) { event.preventDefault(); formatInline('strong'); }
    if (key === 'i' && !headingLevel) { event.preventDefault(); formatInline('em'); }
    if (key === 'u' && !headingLevel) { event.preventDefault(); formatInline('u'); }
  }

  const tool = 'rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BF8813]';
  const btnProps = { type: 'button' as const, onMouseDown: (event: MouseEvent) => event.preventDefault(), className: tool };
  return <div className="rounded-xl border border-slate-200 bg-white shadow-sm focus-within:ring-2 focus-within:ring-[#BF8813]/40">
    {!locked && !headingLevel && <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-2" role="toolbar" aria-label="Mise en forme du texte">
      <button {...btnProps} title="Gras (Ctrl+B)" onClick={() => formatInline('strong')}><strong>G</strong></button>
      <button {...btnProps} title="Italique (Ctrl+I)" onClick={() => formatInline('em')}><em>I</em></button>
      <button {...btnProps} title="Souligner (Ctrl+U)" onClick={() => formatInline('u')}><u>S</u></button>
      <button {...btnProps} title="Liste à puces" onClick={() => insertList(false)}>• Liste</button>
      <button {...btnProps} title="Liste numérotée" onClick={() => insertList(true)}>1. Liste</button>
      <button {...btnProps} title="Créer un lien HTTPS" onClick={insertLink}>Lien</button>
      <button {...btnProps} title="Insérer un tableau deux colonnes" onClick={insertTable}>Tableau</button>
      <span className="mx-1 h-5 border-l border-slate-200" aria-hidden="true"/>
      <button {...btnProps} aria-label="Annuler la dernière modification" title="Annuler (Ctrl+Z)" onClick={undo}>↶</button>
      <button {...btnProps} aria-label="Rétablir la dernière modification" title="Rétablir (Ctrl+Y)" onClick={redo}>↷</button>
      <span className="ml-auto text-[10px] text-slate-500">Collage Word nettoyé · Historique local</span>
    </div>}
    <div ref={host} contentEditable={!locked} suppressContentEditableWarning spellCheck lang={language} role="textbox"
      aria-multiline={!headingLevel} aria-label={placeholder || 'Éditeur de contenu'} data-placeholder={placeholder}
      onInput={publish} onPaste={onPaste} onKeyDown={onKeyDown} onKeyUp={recordSelection} onMouseUp={recordSelection}
      onBlur={() => { setSelectionTools(false); publish(); }}
      className={`${headingLevel === 1 ? 'text-xl font-bold' : headingLevel === 2 ? 'text-lg font-semibold' : 'text-sm'} min-h-[72px] px-3 py-3 outline-none rich-editor text-slate-700 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_a]:text-blue-700 [&_a]:underline [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:min-w-16 [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:bg-slate-100 [&_th]:p-2`}
    />
    {!locked && selectionTools && <p className="border-t border-slate-100 px-3 py-1 text-[10px] text-slate-500" role="status">Texte sélectionné : utilisez la barre de mise en forme.</p>}
  </div>;
}
