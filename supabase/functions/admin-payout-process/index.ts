import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type,Authorization,X-Client-Info,Apikey,x-omnia-session-token",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

async function requireSuperAdmin(sb: any, req: Request): Promise<string | null> {
  const token = (
    req.headers.get("x-omnia-session-token") ||
    req.headers.get("Authorization") ||
    ""
  )
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!token) return null;

  const { data: session, error: sessionError } = await sb
    .from("user_sessions")
    .select("user_id")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (sessionError || !session) return null;

  const { data: role, error: roleError } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user_id)
    .eq("role", "super_admin")
    .maybeSingle();

  if (roleError || !role) return null;

  return session.user_id;
}

function roleLabel(roles: string[]): string {
  if (roles.includes("coach")) return "Coach Omnia";
  if (roles.includes("professeur")) return "Professeur";

  if (
    roles.some((role) =>
      [
        "responsable_structure",
        "gestionnaire_partenaire",
        "structure",
      ].includes(role)
    )
  ) {
    return "Structure";
  }

  if (roles.some((role) => ["organizer", "organisateur"].includes(role))) {
    return "Organisateur";
  }

  return "Autre";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json(
        {
          error: "SERVER_CONFIG_ERROR",
          message: "Configuration Supabase serveur incomplète.",
        },
        500,
      );
    }

    const sb = createClient(supabaseUrl, serviceRoleKey);
    const adminId = await requireSuperAdmin(sb, req);

    if (!adminId) {
      return json({ error: "FORBIDDEN" }, 403);
    }

    if (req.method === "GET") {
      const url = new URL(req.url);
      const status = url.searchParams.get("status") || "";

      let query = sb
        .from("payout_requests")
        .select(
          [
            "id",
            "wallet_id",
            "user_id",
            "amount_xof",
            "channel",
            "mm_operator",
            "mm_phone",
            "bank_name",
            "account_holder",
            "bank_code",
            "branch_code",
            "account_number",
            "rib_key",
            "iban",
            "swift",
            "status",
            "admin_note",
            "requested_at",
            "processed_at",
            "approved_at",
            "paid_at",
            "provider",
            "provider_reference",
            "failure_reason",
          ].join(","),
        )
        .order("requested_at", { ascending: false })
        .limit(200);

      if (status) {
        query = query.eq("status", status);
      }

      const { data: payouts, error: payoutError } = await query;

      if (payoutError) throw payoutError;

      const userIds = [
        ...new Set((payouts || []).map((payout: any) => payout.user_id)),
      ].filter(Boolean);

      let users: any[] = [];
      let roles: any[] = [];

      if (userIds.length > 0) {
        const { data: userRows, error: userError } = await sb
          .from("users")
          .select("id,full_name,email")
          .in("id", userIds);

        if (userError) throw userError;
        users = userRows || [];

        const { data: roleRows, error: roleRowsError } = await sb
          .from("user_roles")
          .select("user_id,role")
          .in("user_id", userIds);

        if (roleRowsError) throw roleRowsError;
        roles = roleRows || [];
      }

      const userMap = new Map(users.map((user: any) => [user.id, user]));
      const roleMap = new Map<string, string[]>();

      for (const row of roles) {
        const current = roleMap.get(row.user_id) || [];
        current.push(row.role);
        roleMap.set(row.user_id, current);
      }

      const enriched = (payouts || []).map((payout: any) => {
        const user = userMap.get(payout.user_id);

        return {
          ...payout,
          user_name: user?.full_name || "—",
          user_email: user?.email || "—",
          user_type: roleLabel(roleMap.get(payout.user_id) || []),
          payout_details: {
            mm_operator: payout.mm_operator,
            mm_phone: payout.mm_phone,
            bank_name: payout.bank_name,
            account_holder: payout.account_holder,
            bank_code: payout.bank_code,
            branch_code: payout.branch_code,
            account_number: payout.account_number,
            rib_key: payout.rib_key,
            iban: payout.iban,
            swift: payout.swift,
          },
        };
      });

      const { count: pendingCount, error: pendingError } = await sb
        .from("payout_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      if (pendingError) throw pendingError;

      const { count: approvedCount, error: approvedError } = await sb
        .from("payout_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "approved");

      if (approvedError) throw approvedError;

      const monthStart = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1,
      ).toISOString();

      const { data: paidRows, error: paidError } = await sb
        .from("payout_requests")
        .select("amount_xof")
        .eq("status", "paid")
        .gte("paid_at", monthStart);

      if (paidError) throw paidError;

      const { data: wallets, error: walletError } = await sb
        .from("wallets")
        .select("balance_xof,reserved_xof");

      if (walletError) throw walletError;

      const totalPaidThisMonth = (paidRows || []).reduce(
        (sum: number, row: any) => sum + Number(row.amount_xof || 0),
        0,
      );

      const totalBalance = (wallets || []).reduce(
        (sum: number, row: any) => sum + Number(row.balance_xof || 0),
        0,
      );

      const totalReserved = (wallets || []).reduce(
        (sum: number, row: any) => sum + Number(row.reserved_xof || 0),
        0,
      );

      return json({
        success: true,
        payouts: enriched,
        stats: {
          pending: pendingCount || 0,
          approved_waiting_payment: approvedCount || 0,
          total_verse_mois: totalPaidThisMonth,
          total_a_reverser: totalBalance,
          reserved_xof: totalReserved,
        },
      });
    }

    if (req.method !== "POST") {
      return json({ error: "METHOD_NOT_ALLOWED" }, 405);
    }

    const body = await req.json();

    const payoutId = String(body?.payout_id || "").trim();
    const action = String(body?.action || "").trim();

    const allowedActions = new Set([
      "approve",
      "reject",
      "mark_paid",
      "mark_failed",
    ]);

    if (!payoutId || !allowedActions.has(action)) {
      return json(
        {
          error: "INVALID_PARAMS",
          message: "Identifiant de retrait ou action invalide.",
        },
        400,
      );
    }

    const adminNote = String(body.admin_note || "").trim();
    const providerReference = String(body.provider_reference || "").trim();
    const failureReason = String(body.failure_reason || adminNote || "").trim();

    if (action === "mark_paid" && !providerReference) {
      return json({ error: "PROVIDER_REFERENCE_REQUIRED", message: "La référence réelle du paiement est obligatoire." }, 400);
    }
    if (action === "reject" && !adminNote) {
      return json({ error: "ADMIN_REASON_REQUIRED", message: "Le motif du rejet est obligatoire." }, 400);
    }
    if (action === "mark_failed" && !failureReason) {
      return json({ error: "FAILURE_REASON_REQUIRED", message: "Le motif de l’échec est obligatoire." }, 400);
    }

    const { data: newStatus, error: processError } = await sb.rpc(
      "finance_process_payout",
      {
        p_payout_id: payoutId,
        p_action: action,
        p_admin_id: adminId,
        p_admin_note: adminNote || null,
        p_provider: body.provider || null,
        p_provider_reference: providerReference || null,
        p_failure_reason: failureReason || null,
      },
    );

    if (processError) {
      return json(
        {
          error: "PAYOUT_PROCESS_FAILED",
          message: processError.message,
        },
        409,
      );
    }

    return json({
      success: true,
      status: newStatus,
    });
  } catch (error) {
    console.error("admin-payout-process error:", error);

    return json(
      {
        error: "SERVER_ERROR",
        message: error instanceof Error ? error.message : "Erreur inconnue",
      },
      500,
    );
  }
});
