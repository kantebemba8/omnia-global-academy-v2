/**
 * Genuine upload progress for signed OGA endpoints. No file is persisted
 * in a lesson until the server confirms upload_block_file separately.
 * Never write the signed URL into a block's content_json.
 */
export type StudioTransferOptions = {
  signal?: AbortSignal;
  contentType?: string;
  onProgress?: (uploaded: number, total: number) => void;
};

export function transferCancelled(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'name' in error && error.name === 'AbortError');
}

export function uploadSignedResource(
  url: string,
  method: 'PUT' | 'POST',
  body: Blob | FormData,
  options: StudioTransferOptions = {},
): Promise<void> {
  const target = new URL(url);
  if (target.protocol !== 'https:') {
    throw new Error('Le point de transfert signé doit utiliser HTTPS.');
  }
  if (options.signal?.aborted) {
    return Promise.reject(new DOMException('Transfert annulé', 'AbortError'));
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;
    const cleanup = () => options.signal?.removeEventListener('abort', abort);
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };
    const abort = () => xhr.abort();
    xhr.open(method, target.href, true);
    if (options.contentType && !(body instanceof FormData)) xhr.setRequestHeader('Content-Type', options.contentType);
    xhr.upload.onprogress = event => {
      if (event.lengthComputable && event.total > 0) options.onProgress?.(event.loaded, event.total);
    };
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300
      ? finish()
      : finish(new Error(`Téléversement refusé par le fournisseur (${xhr.status}).`));
    xhr.onerror = () => finish(new Error('Erreur réseau pendant le téléversement. Le fichier n’a pas été enregistré.'));
    xhr.onabort = () => finish(new DOMException('Transfert annulé', 'AbortError'));
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) { abort(); return; }
    xhr.send(body);
  });
}
