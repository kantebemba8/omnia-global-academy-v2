import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const url = new URL(req.url);
    const certId = url.searchParams.get("id");

    if (!certId) return new Response(JSON.stringify({ valid: false, status: "invalid_request", message: "Identifiant manquant." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: cert } = await sb.from("certificates").select("*").eq("omnia_certificate_id", certId.toUpperCase().trim()).maybeSingle();

    if (!cert) return new Response(JSON.stringify({ valid: false, status: "not_found", message: "Ce certificat n'est pas authentique." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: accreditations } = await sb.from("certificate_accreditations").select("organization_name,certification_name,certification_code,credit_value,credit_unit,badge_url,logo_url,verification_url,valid_from,expires_at,status").eq("certificate_id", cert.id).order("created_at");
    const expired = (accreditations || []).some((a:any)=>a.status === "expired" || (a.expires_at && new Date(a.expires_at) < new Date()));

    if (cert.status === "revoque") {
      return new Response(JSON.stringify({
        valid: false, status: "revoque",
        message: "Ce certificat a été révoqué.",
        revocation_reason: cert.revocation_reason,
        revoked_at: cert.revoked_at,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      valid: true,
      omnia_certificate_id: cert.omnia_certificate_id,
      student_name: cert.student_full_name,
      course_title: cert.course_title,
      course_level: cert.course_level,
      course_category: cert.course_category,
      cpd_hours: cert.cpd_hours,
      cpd_accredited: cert.cpd_accredited,
      cpd_provider_code: cert.cpd_provider_code,
      cpd_badge_url: cert.cpd_badge_url,
      template_type: cert.template_type,
      creator_name: cert.creator_name,
      establishment_name: cert.establishment_name,
      issued_at: cert.issued_at,
      pdf_url: cert.pdf_url,
      status: expired ? "partially_expired" : "valid",
      accreditations: accreditations || [],
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ valid: false, status: "error", message: "Erreur serveur." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
