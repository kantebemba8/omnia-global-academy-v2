import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function getCategoryVisual(category: string): string {
  const visuals: Record<string, string> = {
    "Data & Intelligence Artificielle": "neural network nodes, data flows, glowing circuits, abstract patterns",
    "Informatique & Développement": "abstract code patterns, binary streams, geometric tech shapes",
    "Cybersécurité & Réseaux": "shield geometry, network nodes, abstract lock symbols",
    "Business & Entrepreneuriat": "growth charts abstract, geometric arrows upward, business symbols",
    "Finance & Comptabilité": "coins abstract geometric, financial wave patterns, number streams",
    "Langues & Linguistique": "speech bubble shapes abstract, wave forms, phonetic symbols",
    "Agriculture & Agro-business": "geometric leaf patterns, crop circle shapes, earth tones abstract",
    "Santé & Médecine": "cross symbol abstract, healing geometry, blue wave patterns",
    "Arts & Créativité": "color splash abstract, geometric art forms, brushstroke patterns",
    "Management & Leadership": "organizational chart abstract, hierarchy shapes, interconnected nodes",
  };
  return visuals[category] || "abstract geometric shapes, professional minimal design, flowing lines";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  const { data: sess } = await sb.from("user_sessions").select("user_id")
    .eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!sess) return json({ error: "SESSION_INVALID" }, 401);
  const userId = sess.user_id;

  // Rate limit: 3 generations / hour / user
  const { count: dallECount } = await sb.from("rate_limit_log")
    .select("*", { count: "exact", head: true })
    .eq("rate_key", `dalle-cover:${userId}`)
    .gte("created_at", new Date(Date.now() - 3600_000).toISOString());
  if ((dallECount ?? 0) >= 3) {
    return json({ error: "RATE_LIMIT", message: "Limite de 3 couvertures IA par heure atteinte. Réessayez plus tard." }, 429);
  }
  await sb.from("rate_limit_log").insert({ rate_key: `dalle-cover:${userId}`, created_at: new Date().toISOString() });

  const { data: u } = await sb.from("users").select("role").eq("id", userId).maybeSingle();
  const allowed = ["professeur", "enseignant", "directeur", "super_admin"];
  if (!u || !allowed.includes(u.role)) return json({ error: "FORBIDDEN" }, 403);

  const body = await req.json() as {
    course_id: string;
    title: string;
    category: string;
    level: string;
  };

  if (!body.course_id || !body.title) return json({ error: "MISSING_FIELDS" }, 400);

  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) return json({ error: "OPENAI_NOT_CONFIGURED" }, 500);

  // Fetch dall-e model from settings
  const { data: modelSetting } = await sb.from("site_settings").select("value").eq("key", "dall_e_model").maybeSingle();
  const dalleModel = modelSetting ? JSON.parse(modelSetting.value as string) : "dall-e-3";

  const dallePrompt = `Professional online course cover image for "${body.title}" in ${body.category || "education"} category, ${body.level || "intermediate"} level.
Style: Abstract, geometric, modern, professional.
NO people, NO faces, NO hands, NO human figures, NO body parts.
NO text, NO letters, NO numbers, NO words.
Colors: Deep navy blue #002050 as dominant color, gold #BF8813 as accent.
Visual concept representing: ${getCategoryVisual(body.category || "")}
Format: 16:9 widescreen, clean composition, suitable for e-learning platform.
High contrast, memorable, inspiring professional atmosphere.`;

  const dalleResp = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: dalleModel,
      prompt: dallePrompt,
      n: 1,
      size: "1792x1024",
      quality: "standard",
      response_format: "url",
    }),
  });

  if (!dalleResp.ok) {
    const err = await dalleResp.json();
    console.error("DALL-E error:", err);
    return json({ error: "DALLE_FAILED", detail: err.error?.message }, 500);
  }

  const dalleData = await dalleResp.json();
  const imageUrl: string = dalleData.data[0].url;

  // Fetch the image from OpenAI's temporary URL
  const imgResp = await fetch(imageUrl);
  if (!imgResp.ok) return json({ error: "IMAGE_FETCH_FAILED" }, 500);
  const imgBuffer = await imgResp.arrayBuffer();

  // Upload to Supabase Storage (course-covers bucket)
  const r2Key = `covers/${body.course_id}/${Date.now()}.jpg`;
  const { data: uploadData, error: uploadError } = await sb.storage
    .from("course-covers")
    .upload(r2Key, imgBuffer, { contentType: "image/jpeg", upsert: true });

  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    // Return the temporary OpenAI URL as fallback
    return json({ success: true, cover_url: imageUrl, temporary: true });
  }

  const { data: urlData } = sb.storage.from("course-covers").getPublicUrl(r2Key);
  const coverUrl = urlData.publicUrl;

  // Update course cover_image_url
  await sb.from("courses").update({ cover_image_url: coverUrl, ai_generated_cover: true }).eq("id", body.course_id);

  return json({ success: true, cover_url: coverUrl, temporary: false });
});
