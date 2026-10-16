import type { CareerDocType } from './careerStudioData';
import type { DesignOptions } from '../components/career/CvTemplates';
import type { LmDesign } from '../components/career/LmTemplates';
import { renderCareerPdfBlob, saveCareerPdfBlob } from './mobile/pdf';

export type CareerPrintOptions = {
  title: string;
  docType: CareerDocType;
  tokensConsumed?: number;
  reservedWindow?: Window | null;
  design?: DesignOptions | LmDesign;
};

function safeFileName(value: string): string {
  return (value || 'omnia-career-document')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_\s]/g, '').trim().replace(/\s+/g, '-')
    .toLowerCase().slice(0, 80) || 'omnia-career-document';
}

/** Deprecated compatibility symbol. No window is opened for PDF downloads. */
export function reserveCareerPrintWindow(): Window | null { return null; }

export async function renderCareerPdfBeforeAuthorization(
  element: HTMLElement | null,
  options: CareerPrintOptions,
): Promise<Blob> {
  if (!element?.querySelector('[data-career-document-surface="true"]')) {
    throw new Error('Aucun document prêt à exporter. Aucun jeton consommé.');
  }
  return renderCareerPdfBlob(element, {
    fileName: `${safeFileName(options.title)}.pdf`,
    title: options.title,
    orientation: options.design?.orientation === 'landscape' ? 'landscape' : 'portrait',
    pageFormat: options.design?.page_format === 'letter' ? 'letter' : 'a4',
  });
}

export async function downloadPreparedCareerPdf(blob: Blob, options: CareerPrintOptions): Promise<void> {
  if (!(blob instanceof Blob) || blob.type !== 'application/pdf' || blob.size < 100) {
    throw new Error('Le fichier PDF généré est invalide. Aucun téléchargement lancé.');
  }
  await saveCareerPdfBlob(blob, {
    fileName: `${safeFileName(options.title)}.pdf`,
    title: options.title,
    orientation: options.design?.orientation === 'landscape' ? 'landscape' : 'portrait',
    pageFormat: options.design?.page_format === 'letter' ? 'letter' : 'a4',
  });
}

/** Legacy public API: now triggers a direct file download, NEVER window.print(). */
export async function printCareerElementAsPdf(
  element: HTMLElement | null,
  options: CareerPrintOptions,
): Promise<void> {
  const blob = await renderCareerPdfBeforeAuthorization(element, options);
  await downloadPreparedCareerPdf(blob, options);
}
