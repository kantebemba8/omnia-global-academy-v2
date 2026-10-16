import type { CareerDocType } from './careerStudioData';
import type { DesignOptions } from '../components/career/CvTemplates';
import type { LmDesign } from '../components/career/LmTemplates';
import { exportElementAsNativePdf } from './mobile/pdf';
import { isNativeApp } from './mobile/platform';

export type CareerPrintOptions = {
  title: string;
  docType: CareerDocType;
  tokensConsumed?: number;
  reservedWindow?: Window | null;
  design?: DesignOptions | LmDesign;
};

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function safeFileName(value: string) {
  return (value || 'omnia-career-document')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 80) || 'omnia-career-document';
}

function collectStyles() {
  return Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((node) => node.outerHTML)
    .join('\n');
}

/** Reserve the browser popup synchronously on the user's click, before async save/credit calls. */
export function reserveCareerPrintWindow(): Window | null {
  if (isNativeApp()) return null;
  const popup = window.open('', '_blank', 'width=920,height=1200');
  if (!popup) throw new Error('Le navigateur bloque la fenêtre PDF. Autorisez les fenêtres pour OGA avant de consommer des jetons.');
  try { popup.opener = null; } catch { /* Restrictive browser sandbox. */ }
  popup.document.title = 'Préparation du document OGA';
  return popup;
}

function printCareerElementInBrowser(element: HTMLElement, options: CareerPrintOptions): void {
  const cloned = element.cloneNode(true) as HTMLElement;
  cloned.querySelectorAll('[data-no-print="true"]').forEach((node) => node.remove());

  const title = options.title || 'Document Omnia Career';
  const escapedTitle = escapeHtml(title);
  const fileName = safeFileName(title);
  const pageFormat = options.design?.page_format === 'letter' ? 'letter' : 'a4';
  const landscape = options.design?.orientation === 'landscape';
  const pageWidth = pageFormat === 'letter' ? '8.5in' : '210mm';
  const pageHeight = pageFormat === 'letter' ? '11in' : '297mm';
  const pageRule = `${pageFormat === 'letter' ? 'letter' : 'A4'} ${landscape ? 'landscape' : 'portrait'}`;
  const styles = collectStyles();
  const popup = options.reservedWindow || reserveCareerPrintWindow();

  if (!popup) {
    throw new Error('Le navigateur a bloqué la fenêtre PDF. Autorisez les pop-ups pour Omnia Global Academy.');
  }

  try { popup.opener = null; } catch { /* Some browser contexts disallow changing opener. */ }
  popup.document.open();
  popup.document.write(`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapedTitle}</title>
  ${styles}
  <style>
    :root { --omnia-blue: #002050; --omnia-gold: #bf8813; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #f3f4f6; color: #111827; }
    body { font-family: Inter, Arial, sans-serif; }
    .print-toolbar {
      position: sticky; top: 0; z-index: 9999;
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      padding: 14px 20px; background: white; border-bottom: 1px solid #e5e7eb;
      box-shadow: 0 8px 24px rgba(15,23,42,.08);
    }
    .print-toolbar h1 { margin: 0; font-size: 15px; color: var(--omnia-blue); font-weight: 700; }
    .print-toolbar p { margin: 3px 0 0; font-size: 12px; color: #64748b; }
    .print-toolbar button {
      border: 0; border-radius: 12px; padding: 10px 14px; font-size: 13px; font-weight: 700;
      color: white; background: var(--omnia-blue); cursor: pointer;
    }
    .print-toolbar button.secondary { color: var(--omnia-blue); background: #f8fafc; border: 1px solid #e5e7eb; }
    .print-page-wrap { width: 100%; padding: 24px 16px; display: flex; justify-content: center; }
    .print-page { background: white; box-shadow: 0 12px 40px rgba(15,23,42,.12); }
    .print-page > * { transform: none !important; transform-origin: initial !important; }
    .print-page { overflow: visible !important; }
    .print-page { break-inside: auto; }
    /* Keep short entries together while allowing long lists to flow across pages. */
    [data-career-section] { break-inside: avoid-page; page-break-inside: avoid; }
    article, li, tr, [data-career-entry] { break-inside: avoid-page; page-break-inside: avoid; }
    /* Nested columns are not independent fixed-height pages. */
    [data-career-document-surface], [data-career-surface-content] { overflow: visible; }
    @page { size: ${pageRule}; margin: 0; }
    @media print {
      html, body { background: white !important; }
      .print-toolbar { display: none !important; }
      .print-page-wrap { padding: 0 !important; display: block !important; }
      .print-page { box-shadow: none !important; margin: 0 auto !important; width: ${landscape ? pageHeight : pageWidth} !important; min-height: ${landscape ? pageWidth : pageHeight} !important; height: auto !important; overflow: visible !important; }
      #omnia-career-print-root, #omnia-career-print-root > * { overflow: visible !important; height: auto !important; }
      /* The screen preview uses zoom transforms; printing must use real flowing text. */
      [data-career-document-surface="true"] { min-height: 0 !important; height: auto !important; overflow: visible !important; }
      [data-career-surface-content="true"] { transform: none !important; position: static !important; left: auto !important; margin: 0 auto !important; width: 794px !important; min-height: 0 !important; }
      /* The screen renderer may use overflow:hidden and a 1123px frame. In print,
         the content must be allowed to flow, not disappear on page two. */
      [data-career-surface-content="true"] > * { overflow: visible !important; height: auto !important; min-height: 0 !important; max-height: none !important; }
      [data-career-section] { break-inside: avoid-page !important; page-break-inside: avoid !important; }
      [data-career-section] [data-career-section] { break-inside: auto !important; }
      .print-page-wrap { overflow: visible !important; }
      .print-page * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
  </style>
</head>
<body>
  <div class="print-toolbar">
    <div>
      <h1>${escapedTitle}</h1>
      <p>${options.docType === 'cv' ? 'CV Omnia Career' : 'Lettre de motivation Omnia Career'}${options.tokensConsumed ? ` · ${options.tokensConsumed} jeton consommé` : ''} · Confirmez l’enregistrement dans le dialogue de votre navigateur.</p>
    </div>
    <div style="display:flex;gap:10px;align-items:center">
      <button class="secondary" onclick="window.close()">Fermer</button>
      <button onclick="window.print()">Enregistrer en PDF</button>
    </div>
  </div>
  <main class="print-page-wrap">
    <section class="print-page" id="omnia-career-print-root">${cloned.outerHTML}</section>
  </main>
  <script>
    window.OMNIA_PDF_FILE_NAME = ${JSON.stringify(fileName + '.pdf')};
    window.addEventListener('load', function () {
      Promise.all([
        document.fonts ? document.fonts.ready : Promise.resolve(),
        ...Array.from(document.images).map(function (img) { return img.complete ? Promise.resolve() : new Promise(function (resolve) { img.onload = resolve; img.onerror = resolve; }); })
      ]).then(function () { setTimeout(function () { window.print(); }, 200); });
    });
  </script>
</body>
</html>`);
  popup.document.close();
}

export async function printCareerElementAsPdf(
  element: HTMLElement | null,
  options: CareerPrintOptions,
): Promise<void> {
  if (!element) {
    throw new Error("Aucun aperçu imprimable n'est disponible.");
  }
  if (!element.querySelector('[data-career-document-surface="true"]')) {
    throw new Error('Le moteur documentaire est indisponible : export PDF annulé avant tout débit.');
  }

  if (isNativeApp()) {
    const title = options.title || 'Document Omnia Career';
    await exportElementAsNativePdf(element, {
      title,
      fileName: `${safeFileName(title)}.pdf`,
      orientation: options.design?.orientation === 'landscape' ? 'landscape' : 'portrait',
      pageFormat: options.design?.page_format === 'letter' ? 'letter' : 'a4',
    });
    return;
  }

  printCareerElementInBrowser(element, options);
}
