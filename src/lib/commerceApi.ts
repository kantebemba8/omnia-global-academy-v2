import { edgeAuthHeaders } from './edgeAuth';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/commerce-engine` : '/api/commerce-engine';

export async function commerceRequest<T = any>(action: string, body: Record<string, unknown> = {}, method: 'GET' | 'POST' = 'POST'): Promise<T> {
  const url = new URL(ENDPOINT, window.location.origin);
  url.searchParams.set('action', action);
  const response = await fetch(url.toString(), {
    method,
    headers: { ...edgeAuthHeaders(), ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
    ...(method === 'POST' ? { body: JSON.stringify({ action, ...body }) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || 'Une erreur est survenue.');
  return data as T;
}

export function formatXof(value: number | null | undefined) {
  return `${new Intl.NumberFormat('fr-FR').format(Number(value || 0))} XOF`;
}

export type CommerceBenefitDefinition = {
  id: string;
  benefit_key: string;
  module_key: string;
  name: string;
  description?: string | null;
  value_type: string;
  unit_label?: string | null;
  reset_period?: string | null;
  allowed_audiences: string[];
  configuration_schema?: Record<string, unknown>;
  is_active: boolean;
  is_system: boolean;
};

export type CommercePlanBenefit = {
  id?: string;
  benefit_definition_id: string;
  value_json: Record<string, unknown>;
  display_label?: string | null;
  is_active?: boolean;
  commerce_benefit_definitions?: CommerceBenefitDefinition;
};

export type CommercePlan = {
  id: string;
  code: string;
  name: string;
  subtitle?: string | null;
  description?: string | null;
  audience: string;
  commercial_type: string;
  billing_interval: string;
  interval_count: number;
  custom_duration_days?: number | null;
  price_xof: number;
  trial_days: number;
  auto_renew: boolean;
  visibility: string;
  starts_at?: string | null;
  ends_at?: string | null;
  max_subscribers?: number | null;
  country_codes?: string[];
  eligibility?: Record<string, unknown>;
  terms_text?: string | null;
  status: string;
  badge_label?: string | null;
  version: number;
  commerce_plan_benefits?: CommercePlanBenefit[];
};

export type CommerceCreatorOffer = {
  id: string;
  creator_user_id: string;
  module_key: 'coaching' | 'omnia_live';
  offer_kind: 'one_time' | 'pack' | 'subscription';
  title: string;
  description: string;
  billing_interval: string;
  interval_count: number;
  custom_duration_days?: number | null;
  price_xof: number;
  benefits_json: Array<{ benefit_key: string; value_json?: Record<string, unknown>; label?: string }>;
  capacity?: number | null;
  justification: string;
  supporting_documents: Array<{ path: string; name?: string; signed_url?: string | null }>;
  proposed_platform_percent?: number | null;
  approved_price_xof?: number | null;
  approved_platform_percent?: number | null;
  admin_reason?: string | null;
  creator_response?: string | null;
  status: string;
};
