import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/cors.ts";

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function verifySuperAdmin(sb: ReturnType<typeof createClient>, token: string) {
  const { data: sess } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!sess) return null;
  const { data: role } = await sb.from("user_roles").select("role").eq("user_id", (sess as { user_id: string }).user_id).eq("role", "super_admin").maybeSingle();
  if (!role) return null;
  return (sess as { user_id: string }).user_id;
}

// Clés interdites — ne peuvent jamais être modifiées via le CMS
const FORBIDDEN_KEYS = new Set([
  "super_admin_id",
  "service_role_key",
  "fedapay_secret_key",
  "brevo_api_key",
  "html2pdf_api_key",
  "cron_secret",
]);

async function sendBrevoLaunchEmail(sb: ReturnType<typeof createClient>) {
  const brevoKey = Deno.env.get("BREVO_API_KEY");
  if (!brevoKey) return;

  try {
    const res = await fetch("https://api.brevo.com/v3/emailCampaigns", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": brevoKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: `Lancement Omnia Global Academy — ${new Date().toISOString().slice(0, 10)}`,
        subject: "Omnia Global Academy est maintenant disponible !",
        sender: { name: "Omnia Global Academy", email: "noreply@omniaglobalacademy.com" },
        type: "classic",
        recipients: { listIds: [8] },
        htmlContent: `<!DOCTYPE html>
<html><body style="font-family:Inter,sans-serif;background:#f8f9fa;margin:0;padding:32px 0;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <div style="background:#002050;padding:40px 32px;text-align:center;">
    <h1 style="color:#ffffff;font-size:28px;margin:0 0 8px;">Omnia Global Academy</h1>
    <p style="color:#BF8813;font-size:14px;letter-spacing:0.1em;margin:0;">LA PLATEFORME EST EN LIGNE</p>
  </div>
  <div style="padding:40px 32px;">
    <p style="color:#002050;font-size:18px;font-weight:700;margin:0 0 16px;">La plateforme est enfin disponible !</p>
    <p style="color:#6B7280;font-size:15px;line-height:1.6;margin:0 0 24px;">
      Vous avez été parmi les premiers à vous inscrire sur notre liste d'attente. Aujourd'hui, la plateforme africaine de formation en ligne est officiellement ouverte.
    </p>
    <a href="https://omniaglobalacademy.com" style="display:inline-block;background:#002050;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">
      Découvrir la plateforme
    </a>
    <p style="color:#9CA3AF;font-size:12px;margin:32px 0 0;">© 2026 Omnia Global Academy</p>
  </div>
</div>
</body></html>`,
      }),
    });

    if (res.ok) {
      const campaign = await res.json();
      await fetch(`https://api.brevo.com/v3/emailCampaigns/${campaign.id}/sendNow`, {
        method: "POST",
        headers: { "api-key": brevoKey },
      });
    }
  } catch (e) {
    console.error("Brevo launch email error:", e);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const adminId = await verifySuperAdmin(sb, token);
    if (!adminId) return json({ error: "FORBIDDEN" }, 403);

    if (req.method === "GET") {
      const { data: settings } = await sb.from("site_settings").select("key,value");
      const { data: pricingTiers } = await sb.from("pricing_tiers").select("id,label,score_min,score_max,price_xof,is_base_tier,is_protected").order("score_min");
      return json({ settings: settings ?? [], pricing_tiers: pricingTiers ?? [] });
    }

    const body = await req.json() as {
      updates?: { key: string; value: unknown }[];
      action?: string;
      tier_id?: string;
      tier?: Record<string, unknown>;
      file_name?: string;
      mime_type?: string;
      base64?: string;
      favicon_url?: string;
    };

    // Favicon library management
    if (body.action === "upload_favicon") {
      if (!body.base64 || !body.file_name || !body.mime_type) return json({ error: "FAVICON_FILE_REQUIRED" }, 400);
      const allowedTypes = new Set(["image/png","image/x-icon","image/vnd.microsoft.icon","image/svg+xml","image/webp","image/jpeg"]);
      if (!allowedTypes.has(body.mime_type)) return json({ error: "FAVICON_TYPE_NOT_ALLOWED" }, 400);

      const binary = Uint8Array.from(atob(body.base64), c => c.charCodeAt(0));
      if (binary.byteLength > 1024 * 1024) return json({ error: "FAVICON_TOO_LARGE" }, 400);

      const bucketName = "site-assets";
      const { data: existingBucket } = await sb.storage.getBucket(bucketName);
      if (!existingBucket) {
        const { error: bucketError } = await sb.storage.createBucket(bucketName, {
          public: true,
          fileSizeLimit: 1024 * 1024,
          allowedMimeTypes: Array.from(allowedTypes),
        });
        if (bucketError && !String(bucketError.message || "").toLowerCase().includes("already")) throw bucketError;
      }

      const safeName = body.file_name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-80);
      const path = `favicons/${Date.now()}-${crypto.randomUUID()}-${safeName || "favicon.png"}`;
      const { error: uploadError } = await sb.storage.from(bucketName).upload(path, binary, {
        contentType: body.mime_type,
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { data: publicData } = sb.storage.from(bucketName).getPublicUrl(path);
      const faviconUrl = publicData.publicUrl;

      const { data: libraryRow } = await sb.from("site_settings").select("value").eq("key","favicon_library").maybeSingle();
      let library: Array<{url:string;name:string;created_at:string}> = [];
      if (Array.isArray(libraryRow?.value)) library = libraryRow.value as typeof library;
      else if (typeof libraryRow?.value === "string") {
        try { library = JSON.parse(libraryRow.value); } catch { library = []; }
      }
      library.push({ url: faviconUrl, name: body.file_name, created_at: new Date().toISOString() });

      const now = new Date().toISOString();
      await sb.from("site_settings").upsert([
        { key:"favicon_url", value:faviconUrl, updated_at:now },
        { key:"favicon_library", value:library, updated_at:now },
      ], { onConflict:"key" });

      return json({ success:true, favicon_url:faviconUrl, favicon_library:library });
    }

    if (body.action === "set_active_favicon") {
      if (!body.favicon_url) return json({ error:"FAVICON_URL_REQUIRED" },400);
      await sb.from("site_settings").upsert({
        key:"favicon_url", value:body.favicon_url, updated_at:new Date().toISOString(),
      }, { onConflict:"key" });
      return json({ success:true, favicon_url:body.favicon_url });
    }

    if (body.action === "delete_favicon") {
      if (!body.favicon_url) return json({ error:"FAVICON_URL_REQUIRED" },400);
      const { data: activeRow } = await sb.from("site_settings").select("value").eq("key","favicon_url").maybeSingle();
      if (activeRow?.value === body.favicon_url) {
        return json({ error:"FAVICON_ACTIVE_CANNOT_DELETE", message:"Activez un autre favicon avant de supprimer celui-ci." },409);
      }

      const { data: libraryRow } = await sb.from("site_settings").select("value").eq("key","favicon_library").maybeSingle();
      let library: Array<{url:string;name:string;created_at?:string}> = [];
      if (Array.isArray(libraryRow?.value)) library = libraryRow.value as typeof library;
      else if (typeof libraryRow?.value === "string") {
        try { library = JSON.parse(libraryRow.value); } catch { library = []; }
      }
      library = library.filter(item => item?.url !== body.favicon_url);

      try {
        const marker = "/storage/v1/object/public/site-assets/";
        const i = body.favicon_url.indexOf(marker);
        if (i >= 0) {
          const objectPath = decodeURIComponent(body.favicon_url.slice(i + marker.length));
          if (objectPath) await sb.storage.from("site-assets").remove([objectPath]);
        }
      } catch (e) { console.error("favicon cleanup", e); }

      await sb.from("site_settings").upsert({
        key:"favicon_library", value:library, updated_at:new Date().toISOString(),
      }, { onConflict:"key" });
      return json({ success:true, favicon_library:library });
    }

    // Pricing tier management
    if (body.action === "delete_pricing_tier") {
      if (!body.tier_id) return json({ error: "tier_id requis" }, 400);
      const { data: palier } = await sb.from("pricing_tiers").select("is_protected,label").eq("id", body.tier_id).maybeSingle();
      if (!palier) return json({ error: "TIER_NOT_FOUND" }, 404);
      const p = palier as { is_protected: boolean; label: string };
      if (p.is_protected) return json({ error: "PALIER_PROTECTED", message: `Le palier "${p.label}" est protégé et ne peut pas être supprimé.` }, 403);
      await sb.from("pricing_tiers").delete().eq("id", body.tier_id);
      return json({ success: true });
    }

    if (body.action === "upsert_pricing_tier") {
      if (!body.tier) return json({ error: "tier requis" }, 400);
      const t = body.tier as { id?: string; label: string; score_min: number; score_max: number; price_xof: number };
      if (t.id) {
        await sb.from("pricing_tiers").update({ label: t.label, score_min: t.score_min, score_max: t.score_max, price_xof: t.price_xof }).eq("id", t.id);
      } else {
        await sb.from("pricing_tiers").insert({ label: t.label, score_min: t.score_min, score_max: t.score_max, price_xof: t.price_xof, created_by: adminId });
      }
      return json({ success: true });
    }

    const { updates } = body;
    if (!Array.isArray(updates)) return json({ error: "INVALID_PARAMS" }, 400);

    // Vérifier uniquement les clés interdites (secrets)
    const forbidden = updates.filter((u) => FORBIDDEN_KEYS.has(u.key.toLowerCase()));
    if (forbidden.length > 0) {
      return json({ error: "FORBIDDEN_KEY", keys: forbidden.map((u) => u.key) }, 400);
    }

    // Detect coming_soon → live toggle
    const comingSoonUpdate = updates.find((u) => u.key === "coming_soon_enabled");
    let wasComingSoon = false;
    if (comingSoonUpdate && comingSoonUpdate.value === "false") {
      const { data: current } = await sb
        .from("site_settings")
        .select("value")
        .eq("key", "coming_soon_enabled")
        .maybeSingle();
      wasComingSoon = (current as { value: string } | null)?.value === "true";
    }

    const now = new Date().toISOString();
    let updated = 0;
    for (const { key, value } of updates) {
      await sb.from("site_settings").upsert({ key, value, updated_at: now }, { onConflict: "key" });
      updated++;
    }

    // Site launch detected — log + send Brevo email
    if (wasComingSoon) {
      await sb.from("security_audit_log").insert({
        event_type: "site_launched",
        severity: "info",
        user_id: adminId,
        metadata: { triggered_by: adminId, timestamp: now },
      });
      await sendBrevoLaunchEmail(sb);
    }

    return json({ success: true, updated, launched: wasComingSoon });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
