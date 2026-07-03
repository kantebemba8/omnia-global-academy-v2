import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function randomPassword(len = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function hashPassword(plain: string): Promise<string> {
  const enc = new TextEncoder().encode(plain);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const { data: sess } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!sess) return json({ error: "SESSION_INVALID" }, 401);
    const directorId = sess.user_id;

    const { data: roleRow } = await sb.from("user_roles").select("role").eq("user_id", directorId).eq("role", "etablissement_directeur").maybeSingle();
    if (!roleRow) return json({ error: "FORBIDDEN" }, 403);

    const body = await req.json();
    const { full_name, email, phone_number } = body as { full_name: string; email: string; phone_number: string };
    if (!full_name || !email || !phone_number) return json({ error: "MISSING_FIELDS" }, 400);

    // Check duplicates
    const { data: existingEmail } = await sb.from("users").select("id").eq("email", email.toLowerCase()).maybeSingle();
    if (existingEmail) return json({ error: "EMAIL_TAKEN", message: "Cet email est déjà utilisé." }, 409);
    const { data: existingPhone } = await sb.from("users").select("id").eq("phone_number", phone_number).maybeSingle();
    if (existingPhone) return json({ error: "PHONE_TAKEN", message: "Ce numéro est déjà utilisé." }, 409);

    // Create user
    const tempPassword = randomPassword(8);
    const hashedPw = await hashPassword(tempPassword);
    const { data: newUser, error: userErr } = await sb.from("users").insert({
      full_name,
      email: email.toLowerCase(),
      phone_number,
      password_hash: hashedPw,
      status: "actif",
      force_password_change: true,
      birth_date: "2000-01-01",
      email_verified: true,
    }).select("id").single();
    if (userErr || !newUser) return json({ error: "CREATE_FAILED", message: userErr?.message }, 500);
    const teacherId = (newUser as unknown as { id: string }).id;

    // Roles
    await sb.from("user_roles").insert([
      { user_id: teacherId, role: "apprenant" },
      { user_id: teacherId, role: "etablissement_enseignant" },
    ]);

    // Get establishment
    const { data: etab } = await sb.from("etablissement_profiles").select("id").eq("user_id", directorId).maybeSingle();
    if (!etab) return json({ error: "ESTABLISHMENT_NOT_FOUND" }, 404);
    const estabId = (etab as unknown as { id: string }).id;

    // Link teacher to school
    await sb.from("school_teachers").insert({
      establishment_id: estabId,
      teacher_user_id: teacherId,
      created_by_director_id: directorId,
      status: "actif",
    });

    // Send Brevo email
    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (brevoKey) {
      await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": brevoKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: 1,
          to: [{ email: email.toLowerCase(), name: full_name }],
          params: {
            ROLE_NAME: "Enseignant",
            EMAIL: email.toLowerCase(),
            TEMPORARY_PASSWORD: tempPassword,
            FORCE_CHANGE_URL: "/changer-mot-de-passe",
          },
          sender: { name: "Omnia Global Academy", email: "support@omniaglobalacademy.com" },
        }),
      });
    }

    return json({ success: true, teacher_id: teacherId });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
