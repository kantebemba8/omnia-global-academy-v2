import { API_BASE_URL } from './config';
import { edgeAuthHeaders } from './edgeAuth';

export type PortfolioVisibility = 'private' | 'anonymized' | 'recruiters' | 'public';
export type ProjectEvidence = { id:string; title:string; summary?:string|null; description?:string|null; skill_codes:string[]; validation_status:string; portfolio_permission:PortfolioVisibility; validated_at?:string|null; project?:{id:string;slug:string;title:string;organization_name?:string|null;project_type?:string}; deliverable?:{id:string;title:string;evaluation_score?:number|null;evaluation_feedback?:string|null;evaluated_at?:string|null} };
export type PortfolioProfile = { id:string; user_id:string; headline?:string|null; professional_summary?:string|null; target_roles:string[]; featured_skill_codes:string[]; default_visibility:'private'|'recruiters'|'public'; allow_recruiter_contact:boolean; show_identity_publicly:boolean; status:'draft'|'published'|'archived'; published_at?:string|null };
export type PortfolioItem = { id?:string; evidence_id:string; display_title?:string|null; display_summary?:string|null; visibility:PortfolioVisibility; is_featured:boolean; display_order:number; show_score:boolean; show_organization:boolean; show_deliverable_link:boolean };
export type ProjectRecommendation = { id:string; recommendation_text:string; skill_codes:string[]; rating?:number|null; status:string; recipient_visibility:PortfolioVisibility; author_name_snapshot:string; author_role_snapshot?:string|null; organization_name_snapshot?:string|null; project?:{id:string;slug:string;title:string;organization_name?:string|null} };
export type PortfolioDashboard = { success:true; profile:PortfolioProfile; evidence:ProjectEvidence[]; items:PortfolioItem[]; recommendations:ProjectRecommendation[] };
export async function projectPortfolioRequest<T>(action:string,payload:Record<string,unknown>={}):Promise<T>{
 const r=await fetch(`${API_BASE_URL}/project-portfolio`,{method:'POST',headers:edgeAuthHeaders(),body:JSON.stringify({action,...payload})});
 const data=await r.json().catch(()=>({})) as T & {error?:string}; if(!r.ok||data.error) throw new Error(data.error||'PROJECT_PORTFOLIO_REQUEST_FAILED'); return data;
}
