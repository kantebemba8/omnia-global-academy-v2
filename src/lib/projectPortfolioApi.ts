import { API_BASE_URL } from './config';
import { edgeAuthHeaders } from './edgeAuth';

export type PortfolioVisibility = 'private' | 'anonymized' | 'recruiters' | 'public';
export type ProjectEvidence = { id:string; title:string; summary?:string|null; description?:string|null; skill_codes:string[]; validation_status:string; portfolio_permission:PortfolioVisibility; validated_at?:string|null; project?:{id:string;slug:string;title:string;organization_name?:string|null;project_type?:string}; deliverable?:{id:string;title:string;evaluation_score?:number|null;evaluation_feedback?:string|null;evaluated_at?:string|null} };
export type PortfolioProfile = { id:string; user_id:string; headline?:string|null; professional_summary?:string|null; target_roles:string[]; featured_skill_codes:string[]; default_visibility:'private'|'recruiters'|'public'; allow_recruiter_contact:boolean; show_identity_publicly:boolean; status:'draft'|'published'|'archived'; published_at?:string|null };
export type PortfolioItem = { id?:string; evidence_id:string; display_title?:string|null; display_summary?:string|null; visibility:PortfolioVisibility; is_featured:boolean; display_order:number; show_score:boolean; show_organization:boolean; show_deliverable_link:boolean };
export type ProjectRecommendation = { id:string; recommendation_text:string; skill_codes:string[]; rating?:number|null; status:string; recipient_visibility:PortfolioVisibility; author_name_snapshot:string; author_role_snapshot?:string|null; organization_name_snapshot?:string|null; project?:{id:string;slug:string;title:string;organization_name?:string|null} };

export type ProjectRecommendationAdmin = ProjectRecommendation & {
  recipient?: { id:string; full_name?:string|null; email?:string|null } | null;
  revocation_reason?: string | null;
  revoked_at?: string | null;
};

export type PortfolioDashboard = { success:true; profile:PortfolioProfile; evidence:ProjectEvidence[]; items:PortfolioItem[]; recommendations:ProjectRecommendation[] };
const PORTFOLIO_ERROR_LABELS: Record<string,string> = {
  AUTH_REQUIRED: 'Votre session a expiré. Veuillez vous reconnecter.',
  FORBIDDEN: 'Vous n’êtes pas autorisé à effectuer cette action.',
  REASON_REQUIRED: 'Un motif est obligatoire.',
  PROJECT_PORTFOLIO_REQUEST_FAILED: 'La gestion des recommandations est momentanément indisponible.',
  UNKNOWN_ACTION: 'Cette action de recommandation n’est pas reconnue par le service. Déployez la dernière version de la fonction « project-portfolio ».',
  INTERNAL_ERROR: 'Une erreur interne empêche le chargement des recommandations professionnelles.',
};

export async function projectPortfolioRequest<T>(action:string,payload:Record<string,unknown>={}):Promise<T>{
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/project-portfolio`, {
      method: 'POST',
      headers: edgeAuthHeaders(),
      body: JSON.stringify({ action, ...payload }),
    });
  } catch {
    throw new Error('Connexion impossible au service des recommandations professionnelles. Vérifiez que la fonction « project-portfolio » est bien déployée.');
  }
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok || data.error) {
    const code = data.error || 'PROJECT_PORTFOLIO_REQUEST_FAILED';
    throw new Error(PORTFOLIO_ERROR_LABELS[code] || code);
  }
  return data;
}
