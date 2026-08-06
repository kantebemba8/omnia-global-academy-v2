export const MODERATOR_PERMISSION_DEFINITIONS = [
  {
    key: 'can_see_pending_courses',
    label: 'Voir les formations en attente',
    description: 'Consulter la file des formations soumises à contrôle.',
    workspace: '/moderator/courses',
  },
  {
    key: 'can_review_course_content',
    label: 'Contrôler le contenu pédagogique',
    description: 'Examiner les contenus, évaluations et éléments pédagogiques.',
    workspace: '/moderator/courses',
  },
  {
    key: 'can_request_course_modification',
    label: 'Demander des modifications',
    description: 'Préparer une demande de correction adressée au créateur.',
    workspace: '/moderator/courses',
  },
  {
    key: 'can_reject_course',
    label: 'Rejeter une formation non conforme',
    description: 'Refuser une soumission qui ne respecte pas les règles applicables.',
    workspace: '/moderator/courses',
  },
  {
    key: 'can_recommend_course_price',
    label: 'Proposer une décision de prix',
    description: 'Formuler une recommandation de prix sans publication finale.',
    workspace: '/moderator/courses',
  },
  {
    key: 'can_approve_transmit_course',
    label: 'Approuver et transmettre à l’Administration Omnia',
    description: 'Transmettre une formation contrôlée pour décision finale de l’Administration Omnia.',
    workspace: '/moderator/courses',
  },
  {
    key: 'can_manage_course_certifications',
    label: 'Contrôler les demandes de certifications et badges',
    description: 'Examiner les preuves et demandes associées aux certifications.',
    workspace: '/moderator/missions',
  },
  {
    key: 'can_create_assisted_course',
    label: 'Créer ou corriger une saisie assistée',
    description: 'Préparer une saisie assistée soumise aux validations habituelles.',
    workspace: '/moderator/missions',
  },
  {
    key: 'can_see_learners_list',
    label: 'Voir la liste des apprenants',
    description: 'Consulter les apprenants selon les limites de la modération.',
    workspace: '/moderator/users',
  },
  {
    key: 'can_see_professors_list',
    label: 'Voir la liste des professeurs',
    description: 'Consulter les professeurs selon les limites de la modération.',
    workspace: '/moderator/users',
  },
  {
    key: 'can_see_structures_list',
    label: 'Voir les Structures',
    description: 'Consulter les Structures sans modifier leur statut final.',
    workspace: '/moderator/missions',
  },
  {
    key: 'can_see_organizers_list',
    label: 'Voir les organisateurs',
    description: 'Consulter les organisateurs Omnia Live autorisés.',
    workspace: '/moderator/missions',
  },
  {
    key: 'can_validate_professor_kyc',
    label: 'Vérifier l’identité et les justificatifs des professeurs',
    description: 'Consulter les informations et documents transmis afin de confirmer que le professeur est bien identifié avant la décision finale.',
    workspace: '/moderator/kyc',
  },
  {
    key: 'can_validate_structure_kyc',
    label: 'Vérifier l’identité et les justificatifs des Structures',
    description: 'Contrôler les informations légales et les documents fournis par une Structure avant la décision finale de l’Administration Omnia.',
    workspace: '/moderator/missions',
  },
  {
    key: 'can_request_account_suspension',
    label: 'Demander la suspension temporaire d’un compte',
    description: 'Préparer une demande motivée, sans pouvoir agir sur le compte système de l’Administration Omnia.',
    workspace: '/moderator/users',
  },
  {
    key: 'can_moderate_forum',
    label: 'Modérer le forum',
    description: 'Traiter les contenus et signalements du forum.',
    workspace: '/moderator/forum',
  },
  {
    key: 'can_moderate_jobs',
    label: "Modérer les offres d'emploi",
    description: "Contrôler les offres d'emploi avant leur validation.",
    workspace: '/moderator/jobs',
  },
  {
    key: 'can_manage_support',
    label: 'Gérer les tickets de support',
    description: 'Consulter et traiter les demandes de support autorisées.',
    workspace: '/moderator/support',
  },
  {
    key: 'can_view_ai_conversations',
    label: 'Consulter les conversations IA autorisées',
    description: 'Contrôler uniquement les conversations rendues accessibles à la modération.',
    workspace: '/moderator/missions',
  },
  {
    key: 'can_manage_reports',
    label: 'Traiter les signalements',
    description: 'Centraliser les signalements qui ne disposent pas encore d’un espace dédié.',
    workspace: '/moderator/missions',
  },
  {
    key: 'can_review_live_events',
    label: 'Examiner les événements Omnia Live',
    description: 'Préparer le contrôle des événements avant décision finale.',
    workspace: '/moderator/missions',
  },
  {
    key: 'can_review_live_reports',
    label: 'Traiter les signalements Omnia Live',
    description: 'Examiner les signalements relatifs aux directs et replays.',
    workspace: '/moderator/missions',
  },
  {
    key: 'can_review_live_refunds',
    label: 'Préparer les dossiers de remboursement',
    description: 'Préparer les éléments d’un remboursement sans exécuter le paiement.',
    workspace: '/moderator/missions',
  },
  {
    key: 'can_review_live_organizers',
    label: 'Examiner les demandes organisateur',
    description: 'Contrôler les demandes d’accès au rôle Organisateur Omnia Live.',
    workspace: '/moderator/missions',
  },
  {
    key: 'can_review_structure_requests',
    label: 'Examiner les demandes Structure',
    description: 'Préparer le contrôle des demandes de création ou modification de Structure.',
    workspace: '/moderator/missions',
  },
  {
    key: 'can_review_structure_codes',
    label: 'Examiner les codes Structure',
    description: 'Contrôler les demandes liées aux codes de rattachement.',
    workspace: '/moderator/missions',
  },
  {
    key: 'can_view_analytics',
    label: "Voir les statistiques d'audience et d'activité",
    description: 'Consulter les indicateurs non financiers de la modération.',
    workspace: '/moderator/analytics',
  },
] as const;

export type ModeratorPermissionKey = typeof MODERATOR_PERMISSION_DEFINITIONS[number]['key'];
export type ModeratorPermissions = Record<ModeratorPermissionKey, boolean>;
export type ModeratorPermissionDefinition = typeof MODERATOR_PERMISSION_DEFINITIONS[number];

const DEFINITIONS_BY_KEY = new Map<ModeratorPermissionKey, ModeratorPermissionDefinition>(
  MODERATOR_PERMISSION_DEFINITIONS.map(definition => [definition.key, definition]),
);

const SECTION_CONFIG = [
  {
    id: 'courses',
    title: 'Formations & certifications',
    icon: 'courses',
    keys: [
      'can_see_pending_courses',
      'can_review_course_content',
      'can_request_course_modification',
      'can_reject_course',
      'can_recommend_course_price',
      'can_approve_transmit_course',
      'can_manage_course_certifications',
      'can_create_assisted_course',
    ],
  },
  {
    id: 'users',
    title: 'Utilisateurs, Structures et vérification d’identité',
    icon: 'users',
    keys: [
      'can_see_learners_list',
      'can_see_professors_list',
      'can_see_structures_list',
      'can_see_organizers_list',
      'can_validate_professor_kyc',
      'can_validate_structure_kyc',
      'can_request_account_suspension',
    ],
  },
  {
    id: 'moderation',
    title: 'Modération, support & communication',
    icon: 'moderation',
    keys: [
      'can_moderate_forum',
      'can_moderate_jobs',
      'can_manage_support',
      'can_view_ai_conversations',
      'can_manage_reports',
    ],
  },
  {
    id: 'live',
    title: 'Omnia Live',
    icon: 'live',
    keys: [
      'can_review_live_events',
      'can_review_live_reports',
      'can_review_live_refunds',
      'can_review_live_organizers',
    ],
  },
  {
    id: 'structures',
    title: 'Structures',
    icon: 'structures',
    keys: [
      'can_review_structure_requests',
      'can_review_structure_codes',
    ],
  },
  {
    id: 'analytics',
    title: 'Statistiques non financières',
    icon: 'analytics',
    keys: ['can_view_analytics'],
  },
] as const satisfies ReadonlyArray<{
  id: string;
  title: string;
  icon: string;
  keys: readonly ModeratorPermissionKey[];
}>;

export const MODERATOR_PERMISSION_SECTIONS = SECTION_CONFIG.map(section => ({
  id: section.id,
  title: section.title,
  icon: section.icon,
  permissions: section.keys.map(key => {
    const definition = DEFINITIONS_BY_KEY.get(key);
    if (!definition) throw new Error(`Permission modérateur inconnue: ${key}`);
    return definition;
  }),
}));

export const MODERATOR_PERMISSION_KEYS = MODERATOR_PERMISSION_DEFINITIONS.map(
  definition => definition.key,
) as ModeratorPermissionKey[];

export function normalizeModeratorPermissions(
  source: Record<string, unknown> | null | undefined,
): ModeratorPermissions {
  const nested = source?.permissions && typeof source.permissions === 'object' && !Array.isArray(source.permissions)
    ? source.permissions as Record<string, unknown>
    : {};
  const merged = { ...(source ?? {}), ...nested };
  const normalized = Object.fromEntries(
    MODERATOR_PERMISSION_KEYS.map(key => [key, merged[key] === true]),
  ) as ModeratorPermissions;

  normalized.can_recommend_course_price = normalized.can_recommend_course_price
    || merged.can_validate_course_price === true;
  normalized.can_approve_transmit_course = normalized.can_approve_transmit_course
    || merged.can_transmit_course_to_admin === true;
  normalized.can_validate_structure_kyc = normalized.can_validate_structure_kyc
    || merged.can_validate_establishment_kyc === true;
  normalized.can_request_account_suspension = normalized.can_request_account_suspension
    || merged.can_suspend_account === true;

  return normalized;
}

export function moderatorHasAnyPermission(
  permissions: ModeratorPermissions,
  keys: readonly ModeratorPermissionKey[] = MODERATOR_PERMISSION_KEYS,
): boolean {
  return keys.some(key => permissions[key]);
}
