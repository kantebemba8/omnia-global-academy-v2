import { saveOrShareBlob } from './files';

export interface NativePdfOptions {
  fileName: string;
  title: string;
  orientation?: 'portrait' | 'landscape';
  pageFormat?: 'a4' | 'letter';
}

/**
 * Browser and native PDF: pixel-faithful visual page with an invisible, searchable text layer.
 * This is not a fully vector-rendered PDF. The selectable layer is rebuilt from
 * actual DOM text nodes, and must stay aligned with the captured content.
 */
type TextPosition = { text: string; x: number; y: number; top: number };

function getTextPositions(element: HTMLElement, width: number, height: number): TextPosition[] {
  const sourceRect = element.getBoundingClientRect();
  if (sourceRect.width <= 0 || sourceRect.height <= 0) return [];
  const rx = width / sourceRect.width;
  const ry = height / sourceRect.height;
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const result: TextPosition[] = [];
  const range = document.createRange();
  let node: Node | null;
  let count = 0;
  while ((node = walker.nextNode()) && count < 3000) {
    const parent = node.parentElement;
    if (!parent || parent.closest('[data-no-print="true"], [aria-hidden="true"], script, style, button, select, textarea, input')) continue;
    const raw = node.textContent || '';
    const words = /\S+/g;
    let match: RegExpExecArray | null;
    while ((match = words.exec(raw)) && count < 3000) {
      range.setStart(node, match.index);
      range.setEnd(node, match.index + match[0].length);
      const box = range.getBoundingClientRect();
      if (box.width < 0.1 || box.height < 0.1) continue;
      const x = (box.left - sourceRect.left) * rx;
      const top = (box.top - sourceRect.top) * ry;
      if (x < -2 || top < -2 || x > width + 2 || top > height + 2) continue;
      result.push({ text: match[0], x, y: (box.bottom - sourceRect.top) * ry, top });
      count++;
    }
  }
  range.detach?.();
  return result;
}

function safePageBreaks(element: HTMLElement, canvasHeight: number, scale: number): number[] {
  const origin = element.getBoundingClientRect();
  const candidates = Array.from(element.querySelectorAll('[data-career-section], article, li, [data-career-entry]'))
    .flatMap(node => {
      const box = node.getBoundingClientRect();
      return [(box.top - origin.top) * scale, (box.bottom - origin.top) * scale];
    })
    .filter(value => Number.isFinite(value) && value > 0 && value < canvasHeight)
    .sort((a, b) => a - b);
  return [...new Set(candidates.map(Math.round))];
}

/** Calculates non-overlapping page slices, preferring section boundaries. */
export function calculatePdfPageSlices(contentHeight: number, pageHeight: number, candidates: number[] = []): Array<{ from: number; to: number }> {
  if (!Number.isFinite(contentHeight) || !Number.isFinite(pageHeight) || contentHeight <= 0 || pageHeight <= 0) {
    throw new Error('Dimensions PDF invalides.');
  }
  const slices: Array<{ from: number; to: number }> = [];
  let from = 0;
  while (from < contentHeight - 0.5) {
    const limit = Math.min(contentHeight, from + pageHeight);
    const earliest = from + pageHeight * 0.70;
    const choices = candidates.filter(value => value >= earliest && value <= limit - 2);
    const to = limit === contentHeight ? contentHeight : choices.length ? choices[choices.length - 1] : limit;
    if (to <= from) throw new Error('Pagination PDF non progressive.');
    slices.push({ from, to });
    from = to;
    if (slices.length > 100) throw new Error('Document trop long pour un export PDF natif (plus de 100 pages).');
  }
  return slices;
}

/** Build the PDF before authorizing paid downloads so a rendering failure cannot spend a credit. */
export async function renderCareerPdfBlob(
  element: HTMLElement,
  options: NativePdfOptions,
): Promise<Blob> {
  const page = element.matches('[data-career-document-surface="true"]')
    ? element
    : element.querySelector<HTMLElement>('[data-career-document-surface="true"]');
  if (!page) throw new Error('Aperçu du document introuvable : export PDF annulé.');

  // Capture the exact rendered page in an isolated host: Builder zoom, sidebars,
  // tooltips, selection controls and print dialogs must never affect the PDF.
  const host = document.createElement('div');
  host.setAttribute('data-omnia-pdf-capture', 'true');
  host.style.cssText = 'position:fixed;left:0;top:0;z-index:-2147483647;pointer-events:none;overflow:visible;background:#fff;';
  const source = page.cloneNode(true) as HTMLElement;
  source.querySelectorAll('[data-no-print="true"],[data-career-page-marker="true"]')
    .forEach(node => node.remove());
  source.querySelectorAll('[contenteditable="true"]').forEach(node => node.setAttribute('contenteditable', 'false'));
  host.appendChild(source);
  document.body.appendChild(host);
  try {
    await (document.fonts?.ready ?? Promise.resolve());
    await Promise.all(Array.from(source.querySelectorAll('img')).map(img => img.complete
      ? Promise.resolve()
      : new Promise<void>(resolve => { img.addEventListener('load', () => resolve(), { once: true }); img.addEventListener('error', () => resolve(), { once: true }); })
    ));
    return await renderCloneToPdf(source, options);
  } finally {
    host.remove();
  }
}

async function renderCloneToPdf(
  element: HTMLElement,
  options: NativePdfOptions,
): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);
  const canvas = await html2canvas(element, {
    backgroundColor: '#FFFFFF',
    scale: Math.min(2, Math.max(1.35, window.devicePixelRatio || 1)),
    useCORS: true,
    allowTaint: false,
    logging: false,
    scrollX: 0,
    scrollY: -window.scrollY,
    windowWidth: Math.max(element.scrollWidth, element.clientWidth),
    windowHeight: Math.max(element.scrollHeight, element.clientHeight),
    onclone: clonedDocument => {
      clonedDocument.querySelectorAll('[data-no-print="true"]')
        .forEach(node => node.remove());
    },
  });
  if (!canvas.width || !canvas.height) throw new Error('Le rendu du document est vide.');

  const orientation = options.orientation ?? 'portrait';
  const format = options.pageFormat === 'letter' ? 'letter' : 'a4';
  const pdf = new jsPDF({ orientation, unit: 'mm', format, compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const mmPerPixel = pageWidth / canvas.width;
  const pagePixels = Math.round(pageHeight / mmPerPixel);
  const elementRect = element.getBoundingClientRect();
  const scale = elementRect.height > 0 ? canvas.height / elementRect.height : 1;
  const breaks = safePageBreaks(element, canvas.height, scale);
  const slices = calculatePdfPageSlices(canvas.height, pagePixels, breaks);
  const text = getTextPositions(element, canvas.width, canvas.height);

  for (let index = 0; index < slices.length; index++) {
    const { from, to } = slices[index];
    if (index) pdf.addPage(format, orientation);
    // Encode one page at a time, rather than embedding one huge JPEG on every page.
    const tile = document.createElement('canvas');
    tile.width = canvas.width;
    tile.height = Math.ceil(to - from);
    const context = tile.getContext('2d');
    if (!context) throw new Error('Canvas PDF indisponible.');
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, tile.width, tile.height);
    context.drawImage(canvas, 0, from, canvas.width, tile.height, 0, 0, tile.width, tile.height);
    pdf.addImage(tile.toDataURL('image/jpeg', 0.93), 'JPEG', 0, 0, pageWidth, tile.height * mmPerPixel, undefined, 'FAST');
    tile.width = 0;
    tile.height = 0;

    // Searchable/selection layer. Invisible rendering avoids doubling the text.
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    for (const word of text) {
      if (word.top < from || word.top >= to) continue;
      const x = Math.max(0, word.x * mmPerPixel);
      const y = Math.max(0, (word.y - from) * mmPerPixel);
      pdf.text(word.text, x, y, { renderingMode: 'invisible' });
    }
  }

  return pdf.output('blob');
}

export async function saveCareerPdfBlob(blob: Blob, options: NativePdfOptions): Promise<void> {
  await saveOrShareBlob(blob, {
    fileName: options.fileName,
    mimeType: 'application/pdf',
    title: options.title,
    text: 'Document généré par Omnia Global Academy',
  });
}

export async function exportElementAsNativePdf(element: HTMLElement, options: NativePdfOptions): Promise<void> {
  const blob = await renderCareerPdfBlob(element, options);
  await saveCareerPdfBlob(blob, options);
}

