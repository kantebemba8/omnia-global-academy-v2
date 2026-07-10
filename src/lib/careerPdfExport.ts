import type { CareerDocType } from './careerStudioData';

export type CareerPrintOptions = {
  title: string;
  docType: CareerDocType;
  tokensConsumed?: number;
};

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

export function printCareerElementAsPdf(element: HTMLElement | null, options: CareerPrintOptions) {
  if (!element) {
    throw new Error("Aucun aperçu imprimable n'est disponible.");
  }

  const cloned = element.cloneNode(true) as HTMLElement;
  cloned.querySelectorAll('[data-no-print="true"]').forEach((node) => node.remove());

  const title = options.title || 'Document Omnia Career';
  const fileName = safeFileName(title);
  const styles = collectStyles();
  const popup = window.open('', '_blank', 'width=920,height=1200,noopener,noreferrer');

  if (!popup) {
    throw new Error('Le navigateur a bloqué la fenêtre PDF. Autorisez les pop-ups pour Omnia Global Academy.');
  }

  popup.document.open();
  popup.document.write(`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
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
    @page { size: A4; margin: 0; }
    @media print {
      html, body { background: white !important; }
      .print-toolbar { display: none !important; }
      .print-page-wrap { padding: 0 !important; display: block !important; }
      .print-page { box-shadow: none !important; margin: 0 auto !important; width: 210mm !important; min-height: 297mm !important; }
      .print-page * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
  </style>
</head>
<body>
  <div class="print-toolbar">
    <div>
      <h1>${title}</h1>
      <p>${options.docType === 'cv' ? 'CV Omnia Career' : 'Lettre de motivation Omnia Career'}${options.tokensConsumed ? ` · ${options.tokensConsumed} jeton consommé` : ''}</p>
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
      setTimeout(function () { window.print(); }, 450);
    });
  </script>
</body>
</html>`);
  popup.document.close();
}
