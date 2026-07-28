import { edgeAuthHeaders } from './edgeAuth';
const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/partner-recognition-hub`;
export async function recognitionHubCall(action: string, payload: Record<string, unknown> = {}) {
  const response = await fetch(API, { method: 'POST', headers: edgeAuthHeaders(), body: JSON.stringify({ action, ...payload }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false || data.error) throw new Error(data.message || data.error || 'Erreur du Hub des partenaires');
  return data;
}
