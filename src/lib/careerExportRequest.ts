import type { CareerDocumentFull } from './careerStudioData';

/** Stable retry IDs prevent a lost HTTP response from triggering another debit. */
function fingerprint(doc: CareerDocumentFull): string {
  const text = JSON.stringify({
    doc_data: doc.doc_data,
    design_options: doc.design_options,
    template_key: doc.template_key,
    title: doc.title,
  });
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${text.length}-${(hash >>> 0).toString(16)}`;
}

export function getCareerPdfRequestId(doc: CareerDocumentFull): string {
  const key = `omnia_pdf_request_v3_${doc.id}`;
  const digest = fingerprint(doc);
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || '{}') as { digest?: string; requestId?: string };
    if (saved.digest === digest && saved.requestId && /^[0-9a-f-]{36}$/i.test(saved.requestId)) return saved.requestId;
    const requestId = crypto.randomUUID();
    sessionStorage.setItem(key, JSON.stringify({ digest, requestId }));
    return requestId;
  } catch {
    // If storage is blocked, keep the request id stable during the tab lifetime.
    return getMemoryRequestId(key, digest);
  }
}

const memoryRequests = new Map<string, { digest: string; requestId: string }>();
function getMemoryRequestId(key: string, digest: string): string {
  const existing = memoryRequests.get(key);
  if (existing?.digest === digest) return existing.requestId;
  const requestId = crypto.randomUUID();
  memoryRequests.set(key, { digest, requestId });
  return requestId;
}
