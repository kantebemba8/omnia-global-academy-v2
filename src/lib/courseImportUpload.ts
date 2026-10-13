import { createClient } from '@supabase/supabase-js';

type PreparedCourseImportUpload = {
  bucket: string;
  path: string;
  token: string;
  upload_mime?: string;
};

let storageClient: ReturnType<typeof createClient> | null = null;

function client() {
  if (storageClient) return storageClient;
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  if (!url || !anonKey) throw new Error('SUPABASE_STORAGE_NOT_CONFIGURED');
  storageClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return storageClient;
}

export async function uploadCourseImportFile(prepared: PreparedCourseImportUpload, file: File) {
  if (!prepared?.bucket || !prepared?.path || !prepared?.token) {
    throw new Error('Le lien sécurisé de téléversement est incomplet. Relancez l’import.');
  }
  const { error } = await client().storage.from(prepared.bucket).uploadToSignedUrl(
    prepared.path,
    prepared.token,
    file,
    { contentType: prepared.upload_mime || file.type || 'application/octet-stream' },
  );
  if (error) throw new Error(error.message || 'Le téléversement sécurisé du document a échoué.');
}
