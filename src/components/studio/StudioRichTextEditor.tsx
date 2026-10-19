/**
 * OGA Formation Studio V4 — Tiptap 3 editor
 * Storage contract: sanitized HTML strings in the existing lesson_blocks fields.
 * No schema/data migration is required. All pre-existing Builder callers retain
 * the same value/onChange/locked/placeholder/headingLevel/language props.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';

const ALLOWED = new Set([
  'p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre', 'ul', 'ol', 'li', 'a',
  'blockquote', 'h1', 'h2', 'h3', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img',
]);
const BLOCKED = new Set([
  'script', 'style', 'meta', 'link', 'iframe', 'object', 'embed', 'svg',
  'math', 'form', 'input', 'button', 'textarea', 'template', 'video', 'audio',
]);
const URL_OK = /^https:\/\/[^\s<>"']+$/i;

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Clean input HTML without executing it. Keeps the shapes already used by OGA. */
export function cleanStudioRichHtml(raw: string): string {
  if (!raw) return '';
  if (typeof document === 'undefined' || typeof DOMParser === 'undefined') return String(raw);
  const parsed = new DOMParser().parseFromString(String(raw), 'text/html');
  const output = document.createElement('div');
  function visit(node: Node, into: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      into.appendChild(document.createTextNode(node.textContent ?? ''));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const source = node as HTMLElement;
    const tag = source.tagName.toLowerCase();
    if (BLOCKED.has(tag)) return;
    let parent: Node = into;
    const normalized = tag === 'b' ? 'strong' : tag === 'i' ? 'em'
      : tag === 'strike' || tag === 'del' ? 's' : tag === 'div' ? 'p'
      : /^h[4-6]$/.test(tag) ? 'h3' : tag;
    if (ALLOWED.has(normalized)) {
      if (normalized === 'img') {
        const src = source.getAttribute('src')?.trim() ?? '';
        if (URL_OK.test(src)) {
          const img = document.createElement('img');
          img.setAttribute('src', src);
          img.setAttribute('alt', source.getAttribute('alt') || '');
          into.appendChild(img);
        }
        return;
      }
      const element = document.createElement(normalized);
      if (normalized === 'a') {
        const href = source.getAttribute('href')?.trim() ?? '';
        if (URL_OK.test(href)) {
          element.setAttribute('href', href);
          element.setAttribute('target', '_blank');
          element.setAttribute('rel', 'noopener noreferrer');
        } else {
          // Keep link text but never render an untrusted href.
          Array.from(source.childNodes).forEach(child => visit(child, into));
          return;
        }
      }
      if (normalized === 'th' || normalized === 'td') {
        for (const attribute of ['colspan', 'rowspan']) {
          const n = Number(source.getAttribute(attribute));
          if (Number.isInteger(n) && n >= 1 && n <= 20) element.setAttribute(attribute, String(n));
        }
      }
      into.appendChild(element);
      parent = element;
    }
    Array.from(source.childNodes).forEach(child => visit(child, parent));
  }
  Array.from(parsed.body.childNodes).forEach(node => visit(node, output));
  if (!output.textContent?.trim() && !output.querySelector('table,img')) return '';
  return output.innerHTML;
}

function normalizeInput(raw: string): string {
  let value = String(raw ?? '');
  if (!value.trim()) return '';
  // Some earlier Builders stored already-escaped HTML in their text fields.
  // Decode only a recognized document fragment, not arbitrary lessons teaching HTML.
  // The decoded result still goes through the allow-list sanitizer below.
  if (/^\s*&lt;(?:p|h[1-6]|ul|ol|blockquote|table|div|strong|em)\b/i.test(value) && typeof document !== 'undefined') {
    const decoder = document.createElement('textarea');
    decoder.innerHTML = value;
    const decoded = decoder.value;
    if (/^\s*<(?:p|h[1-6]|ul|ol|blockquote|table|div|strong|em)\b/i.test(decoded)) value = decoded;
  }
  // Old blocks can contain plain text, including literal angle brackets.
  if (!/<\/?[a-z][\s\S]*?>/i.test(value)) {
    return value.replace(/\r\n?/g, '\n').split(/\n\n+/)
      .map(paragraph => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`).join('');
  }
  return cleanStudioRichHtml(value);
}

const clipboardGuard = Extension.create({
  name: 'ogaSafePaste',
  transformPastedHTML(html) {
    return cleanStudioRichHtml(html);
  },
});

const editableExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: { openOnClick: false, autolink: false, protocols: ['https'] },
  }),
  TableKit,
  Image.configure({ allowBase64: false, inline: false }),
  clipboardGuard,
];

const translations: Record<string, Record<string, string>> = {
  fr: { bold: 'Gras', italic: 'Italique', underline: 'Souligner', strike: 'Barré', paragraph: 'Paragraphe',
    bullet: 'Puces', ordered: 'Numéros', link: 'Lien HTTPS', table: 'Tableau', undo: 'Annuler',
    redo: 'Rétablir', title: 'Titre', quote: 'Citation', code: 'Code', image: 'Image HTTPS',
    invalid: 'Adresse HTTPS invalide', tableAdd: 'Ligne +', tableRemove: 'Supprimer tableau' },
  en: { bold: 'Bold', italic: 'Italic', underline: 'Underline', strike: 'Strike', paragraph: 'Paragraph',
    bullet: 'Bullets', ordered: 'Numbers', link: 'HTTPS link', table: 'Table', undo: 'Undo',
    redo: 'Redo', title: 'Heading', quote: 'Quote', code: 'Code', image: 'HTTPS image',
    invalid: 'Invalid HTTPS address', tableAdd: 'Add row', tableRemove: 'Delete table' },
  es: { bold: 'Negrita', italic: 'Cursiva', underline: 'Subrayar', strike: 'Tachado', paragraph: 'Párrafo',
    bullet: 'Viñetas', ordered: 'Números', link: 'Enlace HTTPS', table: 'Tabla', undo: 'Deshacer',
    redo: 'Rehacer', title: 'Título', quote: 'Cita', code: 'Código', image: 'Imagen HTTPS',
    invalid: 'Dirección HTTPS inválida', tableAdd: 'Añadir fila', tableRemove: 'Eliminar tabla' },
  pt: { bold: 'Negrito', italic: 'Itálico', underline: 'Sublinhar', strike: 'Riscado', paragraph: 'Parágrafo',
    bullet: 'Marcadores', ordered: 'Numeração', link: 'Ligação HTTPS', table: 'Tabela', undo: 'Anular',
    redo: 'Refazer', title: 'Título', quote: 'Citação', code: 'Código', image: 'Imagem HTTPS',
    invalid: 'Endereço HTTPS inválido', tableAdd: 'Adicionar linha', tableRemove: 'Eliminar tabela' },
  de: { bold: 'Fett', italic: 'Kursiv', underline: 'Unterstreichen', strike: 'Durchstreichen', paragraph: 'Absatz',
    bullet: 'Aufzählung', ordered: 'Nummerierung', link: 'HTTPS-Link', table: 'Tabelle', undo: 'Rückgängig',
    redo: 'Wiederholen', title: 'Überschrift', quote: 'Zitat', code: 'Code', image: 'HTTPS-Bild',
    invalid: 'Ungültige HTTPS-Adresse', tableAdd: 'Zeile hinzufügen', tableRemove: 'Tabelle löschen' },
  ar: { bold: 'عريض', italic: 'مائل', underline: 'تسطير', strike: 'يتوسطه خط', paragraph: 'فقرة',
    bullet: 'قائمة نقطية', ordered: 'قائمة مرقمة', link: 'رابط HTTPS', table: 'جدول', undo: 'تراجع',
    redo: 'إعادة', title: 'عنوان', quote: 'اقتباس', code: 'رمز برمجي', image: 'صورة HTTPS',
    invalid: 'عنوان HTTPS غير صالح', tableAdd: 'إضافة صف', tableRemove: 'حذف الجدول' },
  zh: { bold: '粗体', italic: '斜体', underline: '下划线', strike: '删除线', paragraph: '段落',
    bullet: '项目符号', ordered: '编号列表', link: 'HTTPS 链接', table: '表格', undo: '撤销',
    redo: '重做', title: '标题', quote: '引用', code: '代码', image: 'HTTPS 图片',
    invalid: '无效的 HTTPS 地址', tableAdd: '添加行', tableRemove: '删除表格' },
  ru: { bold: 'Жирный', italic: 'Курсив', underline: 'Подчеркнуть', strike: 'Зачеркнуть', paragraph: 'Абзац',
    bullet: 'Маркеры', ordered: 'Нумерация', link: 'HTTPS-ссылка', table: 'Таблица', undo: 'Отменить',
    redo: 'Повторить', title: 'Заголовок', quote: 'Цитата', code: 'Код', image: 'HTTPS-изображение',
    invalid: 'Недопустимый HTTPS-адрес', tableAdd: 'Добавить строку', tableRemove: 'Удалить таблицу' },
};

type RichTextProps = {
  value: string;
  onChange: (html: string) => void;
  locked: boolean;
  placeholder: string;
  headingLevel?: 1 | 2;
  language?: string;
  plainPage?: boolean;
  onEditorBlur?: () => void;
};

export default function StudioRichTextEditor({
  value, onChange, locked, placeholder, headingLevel, language = 'fr', plainPage = false, onEditorBlur,
}: RichTextProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onBlurRef = useRef(onEditorBlur);
  onBlurRef.current = onEditorBlur;
  const lastEmitted = useRef<string | null>(null);
  const lastExternal = useRef(String(value ?? ''));
  const [error, setError] = useState('');
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [advancedToolbar, setAdvancedToolbar] = useState(false);
  const [, refreshToolbar] = useState(0);
  const labels = translations[language.slice(0, 2).toLowerCase()] || translations.fr;
  const initialValue = useRef(normalizeInput(String(value ?? '')));

  // This memoization prevents extension recreation on every keystroke.
  const extensions = useMemo(() => editableExtensions, []);
  const editor = useEditor({
    extensions,
    content: initialValue.current,
    editable: !locked,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    // Tiptap controls input/history/selection; never mutate the DOM manually.
    editorProps: {
      attributes: {
        class: `oga-tiptap-content rich-editor min-h-[110px] px-4 py-3 outline-none text-slate-700 text-sm
          [&_p]:my-2 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-semibold
          [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6
          [&_li]:my-1 [&_a]:text-blue-700 [&_a]:underline [&_blockquote]:border-l-4
          [&_blockquote]:border-amber-600 [&_blockquote]:pl-3 [&_table]:my-3
          [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:p-2
          [&_th]:border [&_th]:bg-slate-100 [&_th]:p-2 [&_img]:max-w-full`,
        role: 'textbox',
        'aria-label': placeholder || 'Éditeur pédagogique',
        'aria-multiline': headingLevel ? 'false' : 'true',
        lang: language,
      },
      handleKeyDown: (_view, event) => {
        if (headingLevel && event.key === 'Enter') {
          event.preventDefault();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: current }) => {
      const html = current.isEmpty ? '' : cleanStudioRichHtml(current.getHTML());
      // An intentionally emptied field must be saved as empty, never restored from stale props.
      lastEmitted.current = html;
      onChangeRef.current(html);
    },
    onSelectionUpdate: () => refreshToolbar(v => (v + 1) % 100000),
    onFocus: () => setToolbarOpen(true),
    onBlur: () => { setToolbarOpen(false); setAdvancedToolbar(false); onBlurRef.current?.(); },
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.setEditable(!locked);
  }, [editor, locked]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const incoming = String(value ?? '');
    if (incoming === lastExternal.current || incoming === lastEmitted.current) {
      lastExternal.current = incoming;
      return;
    }
    // External block selection/reload: update without emitting another save event.
    const cleaned = normalizeInput(incoming);
    if (cleaned !== cleanStudioRichHtml(editor.isEmpty ? '' : editor.getHTML())) {
      editor.commands.setContent(cleaned || '<p></p>', { emitUpdate: false });
    }
    lastExternal.current = incoming;
    lastEmitted.current = null;
  }, [editor, value]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.setOptions({ editorProps: {
      ...editor.options.editorProps,
      attributes: {
        ...editor.options.editorProps?.attributes,
        lang: language,
        dir: language.toLowerCase().startsWith('ar') ? 'rtl' : 'auto',
        'aria-label': placeholder || 'Éditeur pédagogique',
        'aria-multiline': headingLevel ? 'false' : 'true',
      },
    } });
  }, [editor, language, placeholder, headingLevel]);

  function setHttpsLink() {
    if (!editor || locked) return;
    const previous = editor.getAttributes('link').href || 'https://';
    const result = window.prompt(labels.link, previous);
    if (result === null) return;
    const url = result.trim();
    if (!url) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    if (!URL_OK.test(url)) { setError(labels.invalid); return; }
    setError('');
    if (editor.state.selection.empty) {
      editor.chain().focus().insertContent(`<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`).run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url, target: '_blank', rel: 'noopener noreferrer' }).run();
    }
  }

  function insertHttpsImage() {
    if (!editor || locked) return;
    const result = window.prompt(labels.image, 'https://');
    if (result === null) return;
    const url = result.trim();
    if (!URL_OK.test(url)) { setError(labels.invalid); return; }
    setError('');
    editor.chain().focus().setImage({ src: url, alt: '' }).run();
  }

  const toolCls = 'rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold transition-colors hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#BF8813] disabled:opacity-40';
  function tool(name: string, text: string, action: () => void, active = false, disabled = false) {
    return <button key={name} type="button" className={`${toolCls} ${active ? 'bg-[#002050] text-white hover:bg-[#002050]' : 'bg-white text-slate-700'}`}
      title={name} aria-label={name} aria-pressed={active} disabled={disabled || locked || !editor}
      onMouseDown={event => event.preventDefault()} onClick={action}>{text}</button>;
  }

  return <div className={plainPage ? 'rounded-lg bg-white focus-within:ring-1 focus-within:ring-[#CBD5E1]' : 'rounded-xl border border-slate-200 bg-white shadow-sm focus-within:ring-2 focus-within:ring-[#BF8813]/40'}>
    {!locked && !headingLevel && toolbarOpen && <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-[#FAFBFD] px-3 py-2" role="toolbar" aria-label="Mise en forme du texte">
      {tool(labels.bold, 'G', () => editor?.chain().focus().toggleBold().run(), !!editor?.isActive('bold'))}
      {tool(labels.italic, 'I', () => editor?.chain().focus().toggleItalic().run(), !!editor?.isActive('italic'))}
      {tool(labels.underline, 'S', () => editor?.chain().focus().toggleUnderline().run(), !!editor?.isActive('underline'))}
      <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => setAdvancedToolbar(value => !value)}
        className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700" aria-expanded={advancedToolbar}>
        {advancedToolbar ? 'Moins' : 'Plus de formats'}
      </button>
      {tool(labels.strike, 'S', () => editor?.chain().focus().toggleStrike().run(), !!editor?.isActive('strike'))}
      <span aria-hidden="true" className="mx-1 h-5 border-l border-slate-200" />
      <>
      {tool(labels.paragraph, '¶', () => editor?.chain().focus().setParagraph().run(), !!editor?.isActive('paragraph'))}
      {tool(`${labels.title} 2`, 'H2', () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), !!editor?.isActive('heading', { level: 2 }))}
      {tool(`${labels.title} 3`, 'H3', () => editor?.chain().focus().toggleHeading({ level: 3 }).run(), !!editor?.isActive('heading', { level: 3 }))}
      {tool(labels.bullet, '• Liste', () => editor?.chain().focus().toggleBulletList().run(), !!editor?.isActive('bulletList'))}
      {tool(labels.ordered, '1. Liste', () => editor?.chain().focus().toggleOrderedList().run(), !!editor?.isActive('orderedList'))}
      {tool(labels.quote, '❝', () => editor?.chain().focus().toggleBlockquote().run(), !!editor?.isActive('blockquote'))}
      {tool(labels.code, '</>', () => editor?.chain().focus().toggleCodeBlock().run(), !!editor?.isActive('codeBlock'))}
      </>
      {tool(labels.link, 'Lien', setHttpsLink, !!editor?.isActive('link'))}
      {advancedToolbar && <>
      {tool(labels.table, 'Tableau', () => editor?.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run())}
      {tool(labels.image, 'Image', insertHttpsImage)}
      </>}
      {editor?.isActive('table') && <>
        {tool(labels.tableAdd, '+ Ligne', () => editor?.chain().focus().addRowAfter().run())}
        {tool(labels.tableRemove, '× Tableau', () => editor?.chain().focus().deleteTable().run())}
      </>}
      <span aria-hidden="true" className="mx-1 h-5 border-l border-slate-200" />
      {tool(labels.undo, '↶', () => editor?.chain().focus().undo().run(), false, !editor?.can().undo())}
      {tool(labels.redo, '↷', () => editor?.chain().focus().redo().run(), false, !editor?.can().redo())}
    </div>}
    <div className={headingLevel === 1 ? '[&_.oga-tiptap-content]:text-xl [&_.oga-tiptap-content]:font-bold' : headingLevel === 2 ? '[&_.oga-tiptap-content]:text-lg [&_.oga-tiptap-content]:font-semibold' : ''}>
      <EditorContent editor={editor} />
    </div>
    {!locked && !editor?.getText().trim() && <p aria-hidden="true" className="pointer-events-none px-4 pb-2 text-xs text-slate-400">{placeholder}</p>}
    {error && <p className="border-t border-red-100 px-3 py-1 text-xs text-red-700" role="alert">{error}</p>}
  </div>;
}
