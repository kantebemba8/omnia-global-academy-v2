import { saveOrShareBlob } from './files';

export interface NativePdfOptions {
  fileName: string;
  title: string;
  orientation?: 'portrait' | 'landscape';
  pageFormat?: 'a4' | 'letter';
}

export async function exportElementAsNativePdf(
  element: HTMLElement,
  options: NativePdfOptions,
): Promise<void> {
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
      clonedDocument.querySelectorAll('[data-no-print="true"]').forEach(node => node.remove());
    },
  });

  const orientation = options.orientation ?? 'portrait';
  const format = options.pageFormat === 'letter' ? 'letter' : 'a4';
  const pdf = new jsPDF({ orientation, unit: 'mm', format, compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const renderedHeight = (canvas.height * pageWidth) / canvas.width;
  const image = canvas.toDataURL('image/jpeg', 0.96);

  let remaining = renderedHeight;
  let position = 0;
  pdf.addImage(image, 'JPEG', 0, position, pageWidth, renderedHeight, undefined, 'FAST');
  remaining -= pageHeight;

  while (remaining > 0.5) {
    position -= pageHeight;
    pdf.addPage(format, orientation);
    pdf.addImage(image, 'JPEG', 0, position, pageWidth, renderedHeight, undefined, 'FAST');
    remaining -= pageHeight;
  }

  await saveOrShareBlob(pdf.output('blob'), {
    fileName: options.fileName,
    mimeType: 'application/pdf',
    title: options.title,
    text: 'Document généré par Omnia Global Academy',
  });
}
