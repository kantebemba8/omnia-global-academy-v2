export const LIVE_STATUS_LABELS: Record<string,string> = {
  draft: 'Brouillon',
  submitted: 'Soumis',
  under_review: 'En cours d’examen',
  changes_requested: 'Modifications demandées',
  approved: 'Approuvé',
  published: 'Publié',
  live: 'En direct',
  completed: 'Terminé',
  suspended: 'Suspendu',
  cancelled: 'Annulé',
  rejected: 'Refusé',
  confirmed: 'Confirmé',
  pending: 'En attente',
  paid: 'Payé',
  unpaid: 'Non payé',
  refunded: 'Remboursé',
  failed: 'Échec',
  processing: 'En traitement',
};

export function liveStatusLabel(value?: string | null): string {
  if (!value) return '—';
  return LIVE_STATUS_LABELS[value] || value.replaceAll('_',' ');
}

export const DELIVERY_LABELS: Record<string,string> = {
  synchronous_training: 'Formation synchrone',
  class_live: 'Classe en direct',
  live_event: 'Événement en direct',
  live: 'En direct',
  video: 'Vidéo',
  replay: 'Replay',
  prerecorded: 'Préenregistré',
};

export function deliveryLabel(value?: string | null): string {
  if (!value) return '—';
  return DELIVERY_LABELS[value] || value.replaceAll('_',' ');
}
