export type RuntimeConfigIssue = {
  key: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY';
  message: string;
};

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || (!import.meta.env.PROD && url.protocol === 'http:');
  } catch {
    return false;
  }
}

export function getRuntimeConfigIssues(): RuntimeConfigIssue[] {
  const issues: RuntimeConfigIssue[] = [];
  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
  const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  if (!supabaseUrl) {
    issues.push({
      key: 'VITE_SUPABASE_URL',
      message: "L'adresse de connexion à la plateforme est absente.",
    });
  } else if (!isValidHttpUrl(supabaseUrl)) {
    issues.push({
      key: 'VITE_SUPABASE_URL',
      message: "L'adresse de connexion à la plateforme est invalide.",
    });
  }

  if (!anonKey) {
    issues.push({
      key: 'VITE_SUPABASE_ANON_KEY',
      message: 'La clé publique de connexion à la plateforme est absente.',
    });
  }

  return issues;
}
