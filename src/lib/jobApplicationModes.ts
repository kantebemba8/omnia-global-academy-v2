export type JobApplicationMode = 'external_link' | 'external_email' | 'omnia_managed';

export type ExternalApplicationStatus =
  | 'draft'
  | 'prepared'
  | 'redirected'
  | 'email_prepared'
  | 'declared_sent'
  | 'waiting_response'
  | 'follow_up_recommended'
  | 'followed_up'
  | 'response_received'
  | 'interview'
  | 'rejected'
  | 'accepted'
  | 'archived';

export type OmniaManagedApplicationStatus =
  | 'submitted'
  | 'received'
  | 'viewed'
  | 'under_review'
  | 'shortlisted'
  | 'interview'
  | 'accepted'
  | 'rejected'
  | 'archived';

export type ApplicationStatus = ExternalApplicationStatus | OmniaManagedApplicationStatus;

export const APPLICATION_MODE_LABELS: Record<JobApplicationMode, string> = {
  external_link: 'Candidature externe par lien',
  external_email: 'Candidature externe par email',
  omnia_managed: 'Candidature gérée sur Omnia',
};

export const APPLICATION_MODE_SHORT_LABELS: Record<JobApplicationMode, string> = {
  external_link: 'Lien externe',
  external_email: 'Email externe',
  omnia_managed: 'Gérée sur Omnia',
};

export const APPLICATION_MODE_HELP: Record<JobApplicationMode, string> = {
  external_link: "L’apprenant est redirigé vers le site de l’employeur. Le suivi dépend ensuite de ses propres mises à jour.",
  external_email: "L’apprenant prépare ses documents et contacte l’employeur par email. Le statut dépend ensuite de ses propres mises à jour.",
  omnia_managed: "La candidature est reçue dans Omnia. La plateforme peut indiquer si elle est reçue, vue et traitée.",
};

export const STATUS_LABELS: Record<string, string> = {
  draft: 'À préparer',
  prepared: 'Préparée avec Omnia Career',
  redirected: 'Redirigée vers l’employeur',
  email_prepared: 'Email préparé',
  declared_sent: 'Candidature déclarée envoyée',
  waiting_response: 'En attente de retour',
  follow_up_recommended: 'Relance recommandée',
  followed_up: 'Relancée',
  response_received: 'Réponse reçue',
  submitted: 'Envoyée',
  received: 'Reçue',
  viewed: 'Vue par le recruteur',
  under_review: 'En analyse',
  shortlisted: 'Présélectionnée',
  interview: 'Entretien',
  accepted: 'Acceptée',
  rejected: 'Refusée',
  archived: 'Archivée',
};

export const STATUS_TONE: Record<string, 'blue' | 'gold' | 'green' | 'purple' | 'red' | 'gray'> = {
  draft: 'gray',
  prepared: 'blue',
  redirected: 'gold',
  email_prepared: 'gold',
  declared_sent: 'blue',
  waiting_response: 'gold',
  follow_up_recommended: 'gold',
  followed_up: 'purple',
  response_received: 'purple',
  submitted: 'blue',
  received: 'blue',
  viewed: 'purple',
  under_review: 'gold',
  shortlisted: 'green',
  interview: 'purple',
  accepted: 'green',
  rejected: 'red',
  archived: 'gray',
};

export function normalizeApplicationMode(mode?: string | null): JobApplicationMode {
  if (mode === 'external_link' || mode === 'external_email' || mode === 'omnia_managed') return mode;
  return 'omnia_managed';
}

export function labelApplicationStatus(status?: string | null) {
  if (!status) return 'À préparer';
  return STATUS_LABELS[status] || status;
}

export function nextRecommendedExternalStatus(status?: string | null): ApplicationStatus {
  switch (status) {
    case 'draft': return 'prepared';
    case 'prepared': return 'declared_sent';
    case 'redirected': return 'declared_sent';
    case 'email_prepared': return 'declared_sent';
    case 'declared_sent': return 'waiting_response';
    case 'waiting_response': return 'follow_up_recommended';
    case 'follow_up_recommended': return 'followed_up';
    case 'followed_up': return 'response_received';
    default: return 'waiting_response';
  }
}
