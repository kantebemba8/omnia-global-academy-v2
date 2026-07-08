import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/cors.ts";

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function generateCode(prefix: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const suffix = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${suffix}`;
}

function generatePin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

async function verifySession(sb: ReturnType<typeof createClient>, token: string) {
  const { data: sess } = await sb.from("user_sessions")
    .select("user_id")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!sess) return null;
  const userId = (sess as { user_id: string }).user_id;
  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", userId);
  return { user_id: userId, roles: (roles ?? []).map((r: { role: string }) => r.role) };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const session = await verifySession(sb, token);
    if (!session) return json({ error: "SESSION_INVALID" }, 401);

    const { user_id, roles } = session;
    const isSuperAdmin = roles.includes("super_admin");
    const isManager = roles.includes("gestionnaire_partenaire");
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ── Action CREATE_CODE : créer un code partenaire ────────
    if (action === "create_code") {
      if (!isManager && !isSuperAdmin) return json({ error: "FORBIDDEN" }, 403);
      const { org_id, code_name, custom_code, custom_pin, max_users, expires_at, advantages, requires_manual_validation, qr_code_enabled } = body;
      if (!org_id) return json({ error: "ORG_ID_REQUIRED" }, 400);

      const finalCode = custom_code || generateCode("OGA");
      const finalPin = custom_pin || generatePin();

      const { data: code, error } = await sb.from("partner_codes").insert({
        organization_id: org_id,
        created_by: user_id,
        code_name: code_name || "Code partenaire",
        code: finalCode,
        pin: finalPin,
        max_users: max_users || 100,
        expires_at: expires_at || null,
        advantages: advantages || {},
        requires_manual_validation: requires_manual_validation ?? false,
        qr_code_enabled: qr_code_enabled ?? true,
        status: "draft",
      }).select("id, code, pin, code_name, status").single();

      if (error) {
        if (error.code === "23505") return json({ error: "CODE_EXISTS", message: "Ce code existe déjà." }, 400);
        throw error;
      }
      return json({ success: true, code, message: "Code créé en brouillon. Soumettez-le au super-admin pour validation." });
    }

    // ── Action SUBMIT_CODE : soumettre pour validation ───────
    if (action === "submit_code") {
      const { code_id } = body;
      if (!code_id) return json({ error: "CODE_ID_REQUIRED" }, 400);
      await sb.from("partner_codes").update({
        status: "pending",
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", code_id);
      return json({ success: true, message: "Votre demande a été envoyée au super-admin pour validation." });
    }

    // ── Action VALIDATE_CODE : super-admin valide ────────────
    if (action === "validate_code" || action === "refuse_code" || action === "suspend_code") {
      if (!isSuperAdmin) return json({ error: "FORBIDDEN" }, 403);
      const { code_id, reason, modified_advantages } = body;
      if (!code_id) return json({ error: "CODE_ID_REQUIRED" }, 400);

      const statusMap: Record<string, string> = {
        validate_code: "validated",
        refuse_code: "refused",
        suspend_code: "suspended",
      };

      const updateData: Record<string, unknown> = {
        status: statusMap[action],
        updated_at: new Date().toISOString(),
      };
      if (action === "validate_code") {
        updateData.validated_by = user_id;
        updateData.validated_at = new Date().toISOString();
        if (modified_advantages) {
          updateData.advantages = modified_advantages;
          updateData.modified_by_admin = true;
        }
      }
      if (reason) updateData.refusal_reason = reason;

      await sb.from("partner_codes").update(updateData).eq("id", code_id);
      return json({ success: true, action, code_id });
    }

    // ── Action ACTIVATE_CODE : apprenant active un code ─────
    if (action === "activate_code") {
      const { code, pin } = body;
      if (!code || !pin) return json({ error: "CODE_AND_PIN_REQUIRED" }, 400);

      // Vérifier le code
      const { data: codeData } = await sb.from("partner_codes")
        .select("*, partner_organizations(org_name, status)")
        .eq("code", code.toUpperCase().trim())
        .maybeSingle();

      if (!codeData) return json({ error: "INVALID_CODE", message: "Code ou PIN incorrect." }, 400);
      if ((codeData as { pin: string }).pin !== pin.trim()) return json({ error: "INVALID_PIN", message: "Code ou PIN incorrect." }, 400);
      if ((codeData as { status: string }).status !== "validated") return json({ error: "CODE_NOT_VALIDATED", message: "Ce code n'est pas encore actif." }, 400);
      if ((codeData as { expires_at: string }).expires_at && new Date((codeData as { expires_at: string }).expires_at) < new Date()) return json({ error: "CODE_EXPIRED", message: "Code expiré." }, 400);
      if ((codeData as { used_count: number }).used_count >= (codeData as { max_users: number }).max_users) return json({ error: "QUOTA_REACHED", message: "Quota atteint." }, 400);

      // Vérifier si déjà lié
      const { data: existing } = await sb.from("partner_code_users")
        .select("id, status")
        .eq("code_id", (codeData as { id: string }).id)
        .eq("user_id", user_id)
        .maybeSingle();

      if (existing) return json({ error: "ALREADY_LINKED", message: "Vous êtes déjà lié à ce code." }, 400);

      // Créer le lien
      const needsValidation = (codeData as { requires_manual_validation: boolean }).requires_manual_validation;
      const advantages = (codeData as { advantages: Record<string, unknown> }).advantages || {};

      const { data: link } = await sb.from("partner_code_users").insert({
        code_id: (codeData as { id: string }).id,
        user_id,
        organization_id: (codeData as { organization_id: string }).organization_id,
        status: needsValidation ? "pending" : "validated",
        advantages_remaining: needsValidation ? {} : advantages,
        expires_at: (codeData as { expires_at: string }).expires_at || null,
      }).select("id, status").single();

      // Incrémenter le compteur si validé immédiatement
      if (!needsValidation) {
        await sb.from("partner_codes")
          .update({ used_count: (codeData as { used_count: number }).used_count + 1 })
          .eq("id", (codeData as { id: string }).id);

        // Créditer les jetons si l'avantage inclut des jetons
        if (advantages.cv_tokens && typeof advantages.cv_tokens === "number") {
          const { data: userRow } = await sb.from("users").select("cv_tokens").eq("id", user_id).maybeSingle();
          const newBalance = ((userRow as { cv_tokens: number })?.cv_tokens || 0) + (advantages.cv_tokens as number);
          await sb.from("users").update({ cv_tokens: newBalance }).eq("id", user_id);
          await sb.from("career_token_transactions").insert({
            user_id,
            transaction_type: "credit",
            amount: advantages.cv_tokens as number,
            balance_after: newBalance,
            reason: "partner_code",
            reference_id: (link as { id: string }).id,
            reference_type: "partner_code",
          });
        }
      }

      return json({
        success: true,
        status: needsValidation ? "pending" : "validated",
        organization: (codeData as { partner_organizations: { org_name: string } }).partner_organizations?.org_name,
        advantages: needsValidation ? {} : advantages,
        message: needsValidation
          ? "Votre code est en attente de validation par l'organisation."
          : "Code activé avec succès ! Vos avantages sont disponibles.",
      });
    }

    // ── Action GET_MY_CODES : organisation voit ses codes ────
    if (action === "get_my_codes") {
      const { org_id } = body;
      if (!org_id) return json({ error: "ORG_ID_REQUIRED" }, 400);
      const { data: codes } = await sb.from("partner_codes")
        .select("*, partner_code_users(id, status)")
        .eq("organization_id", org_id)
        .order("created_at", { ascending: false });
      return json({ codes: codes ?? [] });
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);

  } catch (err) {
    console.error("partner-code-manage error:", err);
    return json({ error: "SERVER_ERROR", message: (err as Error).message }, 500);
  }
});