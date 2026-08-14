export const PRIVATE_COURSE_BUCKETS = [
  "course-videos",
  "course-audios",
  "course-documents",
  "course-excel",
  "course-scorm",
  "course-resources",
] as const;

export const PRIVATE_COURSE_BUCKET_SET = new Set<string>(PRIVATE_COURSE_BUCKETS);

export function storageRef(bucket: string, path: string) {
  return `storage://${bucket}/${String(path || "").replace(/^\/+/, "")}`;
}

export function parseStorageLocator(value: unknown, bucketHint?: string | null): { bucket: string; path: string } | null {
  const raw = String(value || "").trim();
  if (!raw) return null;

  if (raw.startsWith("storage://")) {
    const rest = raw.slice("storage://".length);
    const slash = rest.indexOf("/");
    if (slash <= 0 || slash === rest.length - 1) return null;
    return { bucket: rest.slice(0, slash), path: decodeURIComponent(rest.slice(slash + 1)) };
  }

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      const match = url.pathname.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/i);
      if (!match) return null;
      return { bucket: decodeURIComponent(match[1]), path: decodeURIComponent(match[2]) };
    } catch {
      return null;
    }
  }

  if (bucketHint && !raw.includes("://")) {
    return { bucket: bucketHint, path: raw.replace(/^\/+/, "") };
  }
  return null;
}

export async function createSignedObjectUrl(sb: any, bucket: string, path: string, expiresIn = 300) {
  if (!bucket || !path) return null;
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) return null;
  return data?.signedUrl || null;
}

export async function signStoredValue(sb: any, value: unknown, bucketHint?: string | null, expiresIn = 300) {
  const locator = parseStorageLocator(value, bucketHint);
  if (!locator) return null;
  return createSignedObjectUrl(sb, locator.bucket, locator.path, expiresIn);
}


export async function signCertificatePdf(sb: any, storagePath: unknown, legacyUrl: unknown, expiresIn = 300) {
  const explicitPath = String(storagePath || "").trim().replace(/^\/+/, "");
  if (explicitPath) return createSignedObjectUrl(sb, "certificates", explicitPath, expiresIn);

  const raw = String(legacyUrl || "").trim();
  if (!raw) return null;
  const locator = parseStorageLocator(raw);
  if (locator?.bucket === "certificates") return createSignedObjectUrl(sb, locator.bucket, locator.path, expiresIn);
  return /^https:\/\//i.test(raw) ? raw : null;
}

export async function downloadStoredValue(sb: any, value: unknown, bucketHint?: string | null) {
  const locator = parseStorageLocator(value, bucketHint);
  if (!locator) return null;
  const { data, error } = await sb.storage.from(locator.bucket).download(locator.path);
  if (error || !data) return null;
  const bytes = new Uint8Array(await data.arrayBuffer());
  return {
    ...locator,
    bytes,
    mimeType: String(data.type || "application/octet-stream").split(";")[0].toLowerCase(),
  };
}

export function normalizeAssistedDocument(input: any, courseId: string) {
  const name = String(input?.name || "Document").trim().slice(0, 255);
  const size = Math.max(0, Number(input?.size || 0));
  const mime = String(input?.mime || "application/octet-stream").trim().slice(0, 160);
  let bucket = String(input?.bucket_name || input?.bucket || "course-resources").trim();
  let path = String(input?.storage_path || input?.path || "").trim().replace(/^\/+/, "");

  if ((!path || !PRIVATE_COURSE_BUCKET_SET.has(bucket)) && input?.url) {
    const locator = parseStorageLocator(input.url);
    if (locator) {
      bucket = locator.bucket;
      path = locator.path;
    }
  }

  if (!PRIVATE_COURSE_BUCKET_SET.has(bucket)) throw new Error("INVALID_ASSISTED_BUCKET");
  if (!path || !path.startsWith(`${courseId}/`)) throw new Error("INVALID_ASSISTED_PATH");
  return { name, size, mime, bucket_name: bucket, storage_path: path };
}

export async function signAssistedDocuments(sb: any, documents: unknown, expiresIn = 300) {
  if (!Array.isArray(documents)) return [];
  return Promise.all(documents.map(async (document: any) => {
    const bucket = String(document?.bucket_name || document?.bucket || "course-resources");
    const path = String(document?.storage_path || document?.path || "");
    const signed = PRIVATE_COURSE_BUCKET_SET.has(bucket) && path
      ? await createSignedObjectUrl(sb, bucket, path, expiresIn)
      : null;
    return { ...document, url: signed };
  }));
}
