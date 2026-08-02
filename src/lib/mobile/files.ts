import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNativeApp, openExternalUrl } from './platform';

export interface OmniaFileExportOptions {
  fileName: string;
  mimeType: string;
  title?: string;
  text?: string;
}

function safeFileName(value: string): string {
  const cleaned = (value || 'omnia-document')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._ -]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);
  return cleaned || 'omnia-document';
}

function triggerBrowserDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeFileName(fileName);
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Lecture du fichier impossible.'));
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

export async function saveOrShareBlob(blob: Blob, options: OmniaFileExportOptions): Promise<void> {
  const fileName = safeFileName(options.fileName);
  if (!isNativeApp()) {
    triggerBrowserDownload(blob, fileName);
    return;
  }

  const relativePath = `omnia-exports/${Date.now()}-${fileName}`;
  const data = await blobToBase64(blob);
  await Filesystem.writeFile({
    path: relativePath,
    data,
    directory: Directory.Cache,
    recursive: true,
  });
  const { uri } = await Filesystem.getUri({ path: relativePath, directory: Directory.Cache });
  await Share.share({
    title: options.title || fileName,
    text: options.text,
    files: [uri],
    dialogTitle: options.title || 'Enregistrer ou partager',
  });
}

export async function saveOrShareText(content: string, options: OmniaFileExportOptions): Promise<void> {
  await saveOrShareBlob(new Blob([content], { type: options.mimeType }), options);
}

export async function downloadOrShareRemoteFile(
  url: string,
  options: OmniaFileExportOptions,
): Promise<void> {
  if (!url) throw new Error('Adresse du fichier indisponible.');

  try {
    const response = await fetch(url, { credentials: 'omit' });
    if (!response.ok) throw new Error(`Téléchargement impossible (${response.status}).`);
    const blob = await response.blob();
    const mimeType = blob.type || options.mimeType;
    await saveOrShareBlob(blob, { ...options, mimeType });
  } catch (error) {
    if (isNativeApp() && /^https?:\/\//i.test(url)) {
      await Share.share({
        title: options.title || options.fileName,
        text: options.text,
        url,
        dialogTitle: options.title || 'Ouvrir ou partager',
      });
      return;
    }

    if (!isNativeApp()) {
      await openExternalUrl(url);
      return;
    }

    throw error;
  }
}
