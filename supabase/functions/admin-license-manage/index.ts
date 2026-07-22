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
      const { data: licenses, error: licenseError } = await sb
        .from("group_licenses")
        .select("*")
        .order("created_at", { ascending: false });

      if (licenseError) throw licenseError;

      const { data: courses, error: courseError } = await sb
        .from("courses")
        .select("id,title,price_xof,is_published")
        .eq("is_published", true)
        .order("title");

      if (courseError) throw courseError;

      let structures: any[] = [];

      // Compatibilité avec le modèle Structure existant.
      // Une erreur sur cette table ne doit pas empêcher le chargement des licences.
      try {
        const { data, error } = await sb
          .from("partner_organizations")
          .select("id,org_name,org_type,status")
          .in("status", ["validated", "active", "approved"])
          .order("org_name");

        if (!error) structures = data || [];
      } catch {
        structures = [];
      }

      const courseMap = new Map(
        (courses || []).map((course: any) => [course.id, course]),
      );
      const structureMap = new Map(
        structures.map((structure: any) => [structure.id, structure]),
      );

      const enrichedLicenses = (licenses || []).map((license: any) => ({
        ...license,
        course_title:
          courseMap.get(license.course_id)?.title || "Formation inconnue",
        structure_name:
          structureMap.get(license.structure_id)?.org_name ||
          "Structure non renseignée",
        remaining_seats: Math.max(
          0,
          Number(license.max_seats || 0) - Number(license.used_seats || 0),
        ),
      }));

      return json({
        success: true,
        licenses: enrichedLicenses,
        lookups: {
          courses: courses || [],
          structures,
        },
      });
    }

    if (req.method !== "POST") {
      return json({ error: "METHOD_NOT_ALLOWED" }, 405);
    }

    const body = await req.json();
    const action = String(body?.action || "");

    if (action === "create") {
      const data = body?.license_data || {};

      const courseId = String(data.course_id || "").trim();
      const structureId = String(data.structure_id || "").trim();
      const licenseCode = String(data.code || "").trim().toUpperCase();
      const maxSeats = Number(data.max_seats || 0);

      if (!courseId || !structureId || !licenseCode || maxSeats <= 0) {
        return json(
          {
            error: "MISSING_FIELDS",
            message:
              "Formation, Structure, code et nombre de places sont obligatoires.",
          },
          400,
        );
      }

      const { data: existing, error: existingError } = await sb
        .from("group_licenses")
        .select("id")
        .eq("code", licenseCode)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing) {
        return json(
          {
            error: "CODE_EXISTS",
            message: "Ce code de licence existe déjà.",
          },
          409,
        );
      }

      const { data: created, error: createError } = await sb
        .from("group_licenses")
        .insert({
          course_id: courseId,
          structure_id: structureId,
          name: String(data.name || "").trim() || null,
          code: licenseCode,
          max_seats: maxSeats,
          used_seats: 0,
          price_per_seat_xof: Math.max(
            0,
            Number(data.price_per_seat_xof || 0),
          ),
          teacher_compensatory_xof: Math.max(
            0,
            Number(data.teacher_compensatory_xof || 0),
          ),
          expires_at: data.expires_at || null,
          is_active: true,
          created_by: adminId,
          updated_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (createError) throw createError;

      return json({ success: true, license: created });
    }

    if (action === "activate" || action === "deactivate") {
      const licenseId = String(body?.license_id || "").trim();

      if (!licenseId) {
        return json({ error: "LICENSE_ID_REQUIRED" }, 400);
      }

      const { error } = await sb
        .from("group_licenses")
        .update({
          is_active: action === "activate",
          updated_at: new Date().toISOString(),
        })
        .eq("id", licenseId);

      if (error) throw error;

      return json({ success: true });
    }

    if (action === "delete") {
      const licenseId = String(body?.license_id || "").trim();

      if (!licenseId) {
        return json({ error: "LICENSE_ID_REQUIRED" }, 400);
      }

      const { data: license, error: readError } = await sb
        .from("group_licenses")
        .select("used_seats")
        .eq("id", licenseId)
        .maybeSingle();

      if (readError) throw readError;

      if (!license) {
        return json({ error: "NOT_FOUND" }, 404);
      }

      if (Number(license.used_seats || 0) > 0) {
        return json(
          {
            error: "LICENSE_ALREADY_USED",
            message:
              "Une licence déjà utilisée ne peut pas être supprimée. Désactivez-la.",
          },
          409,
        );
      }

      const { error: deleteError } = await sb
        .from("group_licenses")
        .delete()
        .eq("id", licenseId);

      if (deleteError) throw deleteError;

      return json({ success: true });
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    console.error("admin-license-manage error:", error);
    return json(
      {
        error: "SERVER_ERROR",
        message: error instanceof Error ? error.message : "Erreur inconnue",
      },
      500,
    );
  }
});
