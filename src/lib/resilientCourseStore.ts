const DB_NAME = 'omnia-resilient-learning';
const DB_VERSION = 1;
const STORE_LESSONS = 'lessons';
const STORE_PROGRESS = 'progress';

export interface ResilientLessonRecord<T = unknown> {
  key: string;
  courseId: string;
  lessonId: string;
  userId: string;
  expiresAt: string;
  savedAt: string;
  iv: string;
  payload: string;
  version: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_LESSONS)) db.createObjectStore(STORE_LESSONS, { keyPath: 'key' });
      if (!db.objectStoreNames.contains(STORE_PROGRESS)) db.createObjectStore(STORE_PROGRESS, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Stockage local indisponible.'));
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary);
}
function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

export function getResilientDeviceId(): string {
  const key = 'omnia_resilient_device_id';
  let value = localStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(key, value);
  }
  return value;
}

async function deriveKey(userId: string): Promise<CryptoKey> {
  const material = new TextEncoder().encode(`omnia:${userId}:${getResilientDeviceId()}:v1`);
  const digest = await crypto.subtle.digest('SHA-256', material);
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function saveResilientLesson<T>(args: {
  userId: string; courseId: string; lessonId: string; expiresAt: string; value: T;
}): Promise<void> {
  const key = await deriveKey(args.userId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(args.value));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
  const record: ResilientLessonRecord<T> = {
    key: `${args.userId}:${args.courseId}:${args.lessonId}`,
    userId: args.userId,
    courseId: args.courseId,
    lessonId: args.lessonId,
    expiresAt: args.expiresAt,
    savedAt: new Date().toISOString(),
    iv: bytesToBase64(iv),
    payload: bytesToBase64(new Uint8Array(encrypted)),
    version: 1,
  };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_LESSONS, 'readwrite');
    tx.objectStore(STORE_LESSONS).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Enregistrement local impossible.'));
  });
  db.close();
}

export async function loadResilientLesson<T>(args: {
  userId: string; courseId: string; lessonId: string;
}): Promise<T | null> {
  const db = await openDb();
  const record = await new Promise<ResilientLessonRecord<T> | undefined>((resolve, reject) => {
    const req = db.transaction(STORE_LESSONS, 'readonly').objectStore(STORE_LESSONS).get(`${args.userId}:${args.courseId}:${args.lessonId}`);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  if (!record || new Date(record.expiresAt).getTime() <= Date.now()) return null;
  try {
    const key = await deriveKey(args.userId);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(record.iv) }, key, base64ToBytes(record.payload));
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  } catch {
    return null;
  }
}

export async function queueOfflineSeconds(args: { userId: string; courseId: string; lessonId: string; seconds: number }): Promise<void> {
  const db = await openDb();
  const key = `${args.userId}:${args.courseId}:${args.lessonId}`;
  const current = await new Promise<any>((resolve) => {
    const req = db.transaction(STORE_PROGRESS, 'readonly').objectStore(STORE_PROGRESS).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_PROGRESS, 'readwrite');
    tx.objectStore(STORE_PROGRESS).put({ key, ...args, seconds: Math.min(3600, Number(current?.seconds || 0) + args.seconds), updatedAt: new Date().toISOString() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function takeOfflineSeconds(args: { userId: string; courseId: string; lessonId: string }): Promise<number> {
  const db = await openDb();
  const key = `${args.userId}:${args.courseId}:${args.lessonId}`;
  const current = await new Promise<any>((resolve) => {
    const req = db.transaction(STORE_PROGRESS, 'readonly').objectStore(STORE_PROGRESS).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
  if (current) {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_PROGRESS, 'readwrite');
      tx.objectStore(STORE_PROGRESS).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }
  db.close();
  return Math.max(0, Number(current?.seconds || 0));
}
