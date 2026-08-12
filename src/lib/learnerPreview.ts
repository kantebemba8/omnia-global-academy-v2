import type { ClrRecord, SkillsPassport } from './credentialsApi';

export function isLearnerPreviewMode(): boolean {
  if (typeof window === 'undefined') return false;
  const queryPreview = new URLSearchParams(window.location.search).get('preview') === 'true';
  const storedPreview = sessionStorage.getItem('omnia_admin_role_preview') === 'apprenant';
  let isSuperAdmin = false;
  try {
    isSuperAdmin = JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false;
  } catch { /* ignore invalid local storage */ }
  return (queryPreview || storedPreview) && isSuperAdmin && (window.location.pathname.startsWith('/dashboard') || window.location.pathname.startsWith('/omnia-career'));
}

export function withLearnerPreview(path: string): string {
  if (!isLearnerPreviewMode()) return path;
  const [withoutHash, hash = ''] = path.split('#', 2);
  const [pathname, query = ''] = withoutHash.split('?', 2);
  const params = new URLSearchParams(query);
  params.set('preview', 'true');
  return `${pathname}?${params.toString()}${hash ? `#${hash}` : ''}`;
}

export function previewClrRecord(): ClrRecord {
  return {
    id: 'preview-clr',
    record_uuid: 'preview',
    user_id: 'preview',
    title: 'Omnia Learning Record',
    description: 'Votre dossier portable de formations, compétences et réalisations vérifiées.',
    profile_headline: '',
    summary: '',
    language_code: 'fr',
    status: 'active',
    default_visibility: 'private',
    section_order: [
      'formations', 'certificats', 'competences_verifiees', 'evaluations', 'badges',
      'coaching', 'omnia_live', 'projets', 'experiences', 'recommandations', 'engagement_communautaire',
    ],
    hidden_sections: [],
    version: 1,
    standards_status: 'clr2_draft',
    entry_counts: { total: 0, verified: 0, pending: 0 },
  };
}

export function previewSkillsPassport(): SkillsPassport {
  return {
    id: 'preview-passport',
    passport_uuid: 'preview',
    user_id: 'preview',
    clr_record_id: 'preview-clr',
    title: 'Omnia Skills Passport',
    professional_headline: '',
    professional_summary: '',
    target_roles: [],
    languages: [],
    location_text: '',
    availability_text: '',
    selected_sections: ['competences_verifiees', 'certificats', 'badges', 'evaluations', 'projets', 'experiences', 'recommandations'],
    status: 'draft',
    version: 1,
    item_count: 0,
    active_share_count: 0,
  };
}
