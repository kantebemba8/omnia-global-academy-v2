const DB_NAME = 'omnia-resilient-learning';
const DB_VERSION = 2;
const STORE_LESSONS = 'lessons';
const STORE_PROGRESS = 'progress';
const STORE_SNAPSHOTS = 'snapshots';

export interface ResilientLessonRecord {
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

interface ResilientSnapshotRecord {
  key: string;
  userId: string;
  expiresAt: string;
  savedAt: string;
  iv: string;
  payload: string;
  version: number;
}

export interface OfflineProgressRecord {
  key: string;
  userId: string;
  courseId: string;
  lessonId: string;
  seconds: number;
  updatedAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_LESSONS)) db.createObjectStore(STORE_LESSONS, { keyPath: 'key' });
      if (!db.objectStoreNames.contains(STORE_PROGRESS)) db.createObjectStore(STORE_PROGRESS, { keyPath: 'key' });
      if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Stockage local indisponible.'));
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
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

async function encryptValue<T>(userId: string, value: T): Promise<{ iv: string; payload: string }> {
  const key = await deriveKey(userId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(value));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
  return {
    iv: bytesToBase64(iv),
    payload: bytesToBase64(new Uint8Array(encrypted)),
  };
}

async function decryptValue<T>(record: { userId: string; iv: string; payload: string }): Promise<T | null> {
  try {
    const key = await deriveKey(record.userId);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(record.iv) },
      key,
      base64ToBytes(record.payload),
    );
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  } catch {
    return null;
  }
}

async function putRecord(storeName: string, value: unknown): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Enregistrement local impossible.'));
  });
  db.close();
}

async function getRecord<T>(storeName: string, key: string): Promise<T | undefined> {
  const db = await openDb();
  const record = await new Promise<T | undefined>((resolve, reject) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error ?? new Error('Lecture locale impossible.'));
  });
  db.close();
  return record;
}

async function deleteRecord(storeName: string, key: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Suppression locale impossible.'));
  });
  db.close();
}

export async function saveResilientLesson<T>(args: {
  userId: string;
  courseId: string;
  lessonId: string;
  expiresAt: string;
  value: T;
}): Promise<void> {
  const encrypted = await encryptValue(args.userId, args.value);
  const record: ResilientLessonRecord = {
    key: `${args.userId}:${args.courseId}:${args.lessonId}`,
    userId: args.userId,
    courseId: args.courseId,
    lessonId: args.lessonId,
    expiresAt: args.expiresAt,
    savedAt: new Date().toISOString(),
    ...encrypted,
    version: 1,
  };
  await putRecord(STORE_LESSONS, record);
}

export async function loadResilientLesson<T>(args: {
  userId: string;
  courseId: string;
  lessonId: string;
}): Promise<T | null> {
  const key = `${args.userId}:${args.courseId}:${args.lessonId}`;
  const record = await getRecord<ResilientLessonRecord>(STORE_LESSONS, key);
  if (!record) return null;
  if (new Date(record.expiresAt).getTime() <= Date.now()) {
    await deleteRecord(STORE_LESSONS, key).catch(() => undefined);
    return null;
  }
  return decryptValue<T>(record);
}

export async function listResilientLessonIds(args: {
  userId: string;
  courseId: string;
}): Promise<string[]> {
  const db = await openDb();
  const records = await new Promise<ResilientLessonRecord[]>((resolve, reject) => {
    const request = db.transaction(STORE_LESSONS, 'readonly').objectStore(STORE_LESSONS).getAll();
    request.onsuccess = () => resolve((request.result ?? []) as ResilientLessonRecord[]);
    request.onerror = () => reject(request.error ?? new Error('Lecture locale impossible.'));
  });
  db.close();

  const now = Date.now();
  const expiredKeys: string[] = [];
  const lessonIds = records
    .filter(record => record.userId === args.userId && record.courseId === args.courseId)
    .filter(record => {
      const active = new Date(record.expiresAt).getTime() > now;
      if (!active) expiredKeys.push(record.key);
      return active;
    })
    .map(record => record.lessonId);

  await Promise.all(expiredKeys.map(key => deleteRecord(STORE_LESSONS, key).catch(() => undefined)));
  return [...new Set(lessonIds)];
}

async function saveResilientSnapshot<T>(args: {
  key: string;
  userId: string;
  expiresAt: string;
  value: T;
}): Promise<void> {
  const encrypted = await encryptValue(args.userId, args.value);
  const record: ResilientSnapshotRecord = {
    key: args.key,
    userId: args.userId,
    expiresAt: args.expiresAt,
    savedAt: new Date().toISOString(),
    ...encrypted,
    version: 1,
  };
  await putRecord(STORE_SNAPSHOTS, record);
}

async function loadResilientSnapshot<T>(key: string): Promise<T | null> {
  const record = await getRecord<ResilientSnapshotRecord>(STORE_SNAPSHOTS, key);
  if (!record) return null;
  if (new Date(record.expiresAt).getTime() <= Date.now()) {
    await deleteRecord(STORE_SNAPSHOTS, key).catch(() => undefined);
    return null;
  }
  return decryptValue<T>(record);
}

export async function saveResilientCourseProgress<T>(args: {
  userId: string;
  courseId: string;
  expiresAt: string;
  value: T;
}): Promise<void> {
  return saveResilientSnapshot({
    key: `course-progress:${args.userId}:${args.courseId}`,
    userId: args.userId,
    expiresAt: args.expiresAt,
    value: args.value,
  });
}

export async function loadResilientCourseProgress<T>(args: {
  userId: string;
  courseId: string;
}): Promise<T | null> {
  return loadResilientSnapshot<T>(`course-progress:${args.userId}:${args.courseId}`);
}

export async function saveResilientLearnerDashboard<T>(args: {
  userId: string;
  expiresAt: string;
  value: T;
}): Promise<void> {
  return saveResilientSnapshot({
    key: `learner-dashboard:${args.userId}`,
    userId: args.userId,
    expiresAt: args.expiresAt,
    value: args.value,
  });
}

export async function loadResilientLearnerDashboard<T>(userId: string): Promise<T | null> {
  return loadResilientSnapshot<T>(`learner-dashboard:${userId}`);
}

export async function queueOfflineSeconds(args: {
  userId: string;
  courseId: string;
  lessonId: string;
  seconds: number;
}): Promise<void> {
  const key = `${args.userId}:${args.courseId}:${args.lessonId}`;
  const current = await getRecord<OfflineProgressRecord>(STORE_PROGRESS, key).catch(() => undefined);
  const record: OfflineProgressRecord = {
    key,
    userId: args.userId,
    courseId: args.courseId,
    lessonId: args.lessonId,
    seconds: Math.min(3600, Math.max(0, Number(current?.seconds ?? 0)) + Math.max(0, args.seconds)),
    updatedAt: new Date().toISOString(),
  };
  await putRecord(STORE_PROGRESS, record);
}


export async function listOfflineProgress(args: {
  userId: string;
  courseId?: string;
}): Promise<OfflineProgressRecord[]> {
  const db = await openDb();
  const records = await new Promise<OfflineProgressRecord[]>((resolve, reject) => {
    const request = db.transaction(STORE_PROGRESS, 'readonly').objectStore(STORE_PROGRESS).getAll();
    request.onsuccess = () => resolve((request.result ?? []) as OfflineProgressRecord[]);
    request.onerror = () => reject(request.error ?? new Error('Lecture locale impossible.'));
  });
  db.close();

  return records.filter(record =>
    record.userId === args.userId &&
    (!args.courseId || record.courseId === args.courseId) &&
    Number(record.seconds) > 0,
  );
}

export async function peekOfflineSeconds(args: {
  userId: string;
  courseId: string;
  lessonId: string;
}): Promise<number> {
  const key = `${args.userId}:${args.courseId}:${args.lessonId}`;
  const current = await getRecord<OfflineProgressRecord>(STORE_PROGRESS, key).catch(() => undefined);
  return Math.max(0, Number(current?.seconds ?? 0));
}

export async function acknowledgeOfflineSeconds(args: {
  userId: string;
  courseId: string;
  lessonId: string;
  seconds: number;
}): Promise<void> {
  const key = `${args.userId}:${args.courseId}:${args.lessonId}`;
  const current = await getRecord<OfflineProgressRecord>(STORE_PROGRESS, key).catch(() => undefined);
  if (!current) return;

  const remaining = Math.max(0, Number(current.seconds) - Math.max(0, args.seconds));
  if (remaining === 0) {
    await deleteRecord(STORE_PROGRESS, key);
    return;
  }

  await putRecord(STORE_PROGRESS, {
    ...current,
    seconds: remaining,
    updatedAt: new Date().toISOString(),
  } satisfies OfflineProgressRecord);
}

/**
 * Kept for compatibility with older callers. New mobile code should use the
 * non-destructive peek/ack pair so progress cannot be lost during a failed sync.
 */
export async function takeOfflineSeconds(args: {
  userId: string;
  courseId: string;
  lessonId: string;
}): Promise<number> {
  const seconds = await peekOfflineSeconds(args);
  if (seconds > 0) await acknowledgeOfflineSeconds({ ...args, seconds });
  return seconds;
}
