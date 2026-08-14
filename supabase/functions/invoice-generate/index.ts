import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

import { isOmniaInternalRequest, omniaInternalHeaders } from "../_shared/omnia-auth.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-omnia-internal-secret",
};

function buildInvoiceHtml(order: Record<string, unknown>, course: Record<string, unknown>, buyer: Record<string, unknown>): string {
  const invoiceDate = new Date(order.paid_at as string || order.created_at as string).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const fmtXof = (n: number) => n.toLocaleString("fr-FR") + " XOF";
  const legalAddress = String(Deno.env.get("OGA_LEGAL_ADDRESS") || "").trim();

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Facture ${order.invoice_number}</title>
<style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 40px; background: #fff; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
  .logo { font-size: 24px; font-weight: 800; color: #002050; }
  .logo span { color: #BF8813; }
  .invoice-meta { text-align: right; }
  .invoice-title { font-size: 32px; font-weight: 700; color: #002050; letter-spacing: -1px; }
  .invoice-sub { color: #666; font-size: 13px; margin-top: 4px; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
  .party-label { font-size: 11px; font-weight: 600; color: #BF8813; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
  .party-name { font-size: 15px; font-weight: 700; color: #002050; }
  .party-info { font-size: 13px; color: #555; line-height: 1.7; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead tr { background: #002050; }
  thead th { color: #fff; padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  tbody tr { border-bottom: 1px solid #f0f0f0; }
  tbody td { padding: 12px 16px; font-size: 13px; color: #444; }
  .totals { margin-left: auto; width: 320px; }
  .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; color: #555; }
  .total-row.discount { color: #1E7A52; }
  .total-row.final { border-top: 2px solid #002050; padding-top: 12px; font-size: 17px; font-weight: 700; color: #002050; }
  .payment-section { background: #f8fafc; border-radius: 8px; padding: 16px 20px; margin-bottom: 40px; font-size: 13px; }
  .payment-label { font-weight: 600; color: #002050; margin-bottom: 4px; }
  .footer { border-top: 1px solid #e8ecf0; padding-top: 20px; text-align: center; color: #999; font-size: 12px; }
  .footer strong { color: #002050; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">OMNIA<span>GLOBAL</span></div>
      <div style="font-size:12px;color:#999;margin-top:4px;">omniaglobalacademy.com</div>
    </div>
    <div class="invoice-meta">
      <div class="invoice-title">FACTURE</div>
      <div class="invoice-sub">N° ${order.invoice_number}</div>
      <div class="invoice-sub">Date : ${invoiceDate}</div>
      <div class="invoice-sub">Réf. commande : ${order.order_number}</div>
    </div>
  </div>

  <div class="parties">
    <div>
      <div class="party-label">Émetteur</div>
      <div class="party-name">Omnia Global Academy</div>
      <div class="party-info">
        ${legalAddress ? `${legalAddress}<br>` : ""}
        admission@omniaglobalacademy.com<br>
        omniaglobalacademy.com
      </div>
    </div>
    <div>
      <div class="party-label">Acheteur</div>
      <div class="party-name">${buyer.full_name || buyer.email}</div>
      <div class="party-info">
        ${buyer.email}<br>
        ${buyer.country_code || ""}
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Détail</th>
      </tr>
    </thead>
    <tbody>
      <tr><td><strong>Formation</strong></td><td>${course.title}</td></tr>
      <tr><td><strong>Niveau</strong></td><td>${course.level || "—"}</td></tr>
      <tr><td><strong>Catégorie</strong></td><td>${course.category || "—"}</td></tr>
      ${course.cpd_accredited ? `<tr><td><strong>Certification</strong></td><td>✓ Certifié CPD</td></tr>` : ""}
      <tr><td><strong>Mode de paiement</strong></td><td>${(order.payment_gateway as string)?.replace(/_/g, " ") || "FedaPay"}</td></tr>
      <tr><td><strong>Réf. transaction</strong></td><td>${order.fedapay_transaction_id || "—"}</td></tr>
    </tbody>
  </table>

  <div class="totals">
    <div class="total-row">
      <span>Prix HT</span>
      <span>${fmtXof(order.original_price_xof as number)}</span>
    </div>
    ${(order.discount_xof as number) > 0 ? `
    <div class="total-row discount">
      <span>Réduction coupon (${order.coupon_code || ""})</span>
      <span>-${fmtXof(order.discount_xof as number)}</span>
    </div>` : ""}
    <div class="total-row final">
      <span>TOTAL TTC</span>
      <span>${fmtXof(order.final_price_xof as number)}</span>
    </div>
  </div>

  <div class="footer">
    <p>Merci de votre confiance — <strong>Omnia Global Academy</strong> — omniaglobalacademy.com</p>
    <p>Document généré automatiquement — Conserver comme justificatif de paiement.</p>
  </div>
</body>
</html>`;
}


function cleanPdfText(value: unknown): string {
  return String(value ?? "")
    .replace(/[’‘]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/œ/g, "oe")
    .replace(/Œ/g, "OE")
    .replace(/…/g, "...")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/[\u0000-\u001f]/g, " ")
    .slice(0, 160);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function buildCoachingPdf(data: {
  invoiceNumber: string;
  orderNumber: string;
  buyerName: string;
  buyerEmail: string;
  coachName: string;
  offerTitle: string;
  sessionStart?: string | null;
  durationMinutes?: number | null;
  productType?: string;
  productDetail?: string | null;
  amountXof: number;
  providerTransactionId?: string | null;
}) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const blue = rgb(0, 32 / 255, 80 / 255);
  const gold = rgb(191 / 255, 136 / 255, 19 / 255);
  const dark = rgb(0.18, 0.2, 0.24);
  const muted = rgb(0.42, 0.45, 0.5);
  const x = 55;
  let y = 780;

  page.drawText("OMNIA", { x, y, size: 23, font: bold, color: blue });
  page.drawText("GLOBAL ACADEMY", { x: x + 82, y, size: 23, font: bold, color: gold });
  page.drawText("FACTURE COACHING", { x: 355, y, size: 18, font: bold, color: blue });
  y -= 28;
  page.drawText(`No ${cleanPdfText(data.invoiceNumber)}`, { x: 355, y, size: 10, font: regular, color: muted });
  y -= 15;
  page.drawText(`Commande ${cleanPdfText(data.orderNumber)}`, { x: 355, y, size: 10, font: regular, color: muted });
  y = 700;
  page.drawRectangle({ x, y: y - 4, width: 485, height: 2, color: gold });
  y -= 35;
  page.drawText("EMETTEUR", { x, y, size: 9, font: bold, color: gold });
  page.drawText("ACHETEUR", { x: 310, y, size: 9, font: bold, color: gold });
  y -= 20;
  page.drawText("Omnia Global Academy", { x, y, size: 12, font: bold, color: blue });
  page.drawText(cleanPdfText(data.buyerName), { x: 310, y, size: 12, font: bold, color: blue });
  y -= 17;
  const legalAddress = cleanPdfText(Deno.env.get("OGA_LEGAL_ADDRESS") || "");
  if (legalAddress) page.drawText(legalAddress, { x, y, size: 10, font: regular, color: dark });
  page.drawText(cleanPdfText(data.buyerEmail), { x: 310, y, size: 10, font: regular, color: dark });
  y -= 17;
  page.drawText("contact@omniaglobalacademy.com", { x, y, size: 10, font: regular, color: dark });

  y = 575;
  page.drawRectangle({ x, y, width: 485, height: 34, color: blue });
  page.drawText(data.productType && data.productType !== "session" ? "DETAIL DU SERVICE" : "DETAIL DE LA SESSION", { x: x + 14, y: y + 12, size: 11, font: bold, color: rgb(1, 1, 1) });
  y -= 30;
  const rows: Array<[string, string]> = [
    ["Service", data.offerTitle],
    ["Prestataire", data.coachName],
    ...(data.productDetail ? [["Détail", data.productDetail] as [string, string]] : []),
    ...(data.sessionStart ? [["Date et heure", new Date(data.sessionStart).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })] as [string, string]] : []),
    ...(data.durationMinutes ? [["Durée", `${data.durationMinutes} minutes`] as [string, string]] : []),
    ["Paiement", "FedaPay"],
    ["Référence transaction", data.providerTransactionId || "-"],
  ];
  for (const [label, value] of rows) {
    page.drawText(cleanPdfText(label), { x: x + 14, y, size: 10, font: bold, color: blue });
    page.drawText(cleanPdfText(value), { x: x + 190, y, size: 10, font: regular, color: dark });
    y -= 28;
  }
  y -= 8;
  page.drawRectangle({ x: 310, y: y - 12, width: 230, height: 48, color: rgb(0.96, 0.97, 0.98) });
  page.drawText("TOTAL PAYE", { x: 325, y: y + 7, size: 12, font: bold, color: blue });
  page.drawText(`${new Intl.NumberFormat("fr-FR").format(data.amountXof)} XOF`, { x: 430, y: y + 7, size: 13, font: bold, color: gold });
  page.drawText("Document genere automatiquement. Conservez-le comme justificatif de paiement.", { x, y: 80, size: 9, font: regular, color: muted });
  page.drawText("Omnia Global Academy - omniaglobalacademy.com", { x, y: 62, size: 9, font: bold, color: blue });
  return pdf.save();
}

async function notifyCoachingInvoice(userId: string, invoiceNumber: string, offerTitle: string, amountXof: number) {
  const url = Deno.env.get("SUPABASE_URL") || "";
  if (!url) return;
  await fetch(`${url}/functions/v1/notify-dispatch`, {
    method: "POST",
    headers: omniaInternalHeaders(),
    body: JSON.stringify({
      type: "coaching_invoice_available",
      payload: { userId, invoice_number: invoiceNumber, offer_title: offerTitle, amount_xof: amountXof, action_url: "/dashboard/coaching" },
    }),
  }).catch(() => undefined);
}

async function generateCoachingInvoice(sb: ReturnType<typeof createClient>, coachingOrderId: string) {
  const { data: order, error } = await sb.from("coaching_payment_orders").select("*").eq("id", coachingOrderId).maybeSingle();
  if (error) throw error;
  if (!order || !["paid", "partially_refunded", "refunded"].includes(String(order.payment_status))) {
    return new Response(JSON.stringify({ error: "COACHING_ORDER_NOT_PAID" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const existing = await sb.from("coaching_invoices").select("id,invoice_number").eq("order_id", order.id).maybeSingle();
  if (existing.data) return new Response(JSON.stringify({ success: true, invoice_id: existing.data.id, invoice_number: existing.data.invoice_number }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const [{ data: coachingSession }, { data: buyer }, { data: coachProfile }] = await Promise.all([
    order.session_id ? sb.from("coaching_sessions").select("*").eq("id", order.session_id).maybeSingle() : Promise.resolve({ data: null }),
    sb.from("users").select("id,full_name,email").eq("id", order.user_id).maybeSingle(),
    order.coach_id ? sb.from("coach_profiles").select("id,user_id").eq("id", order.coach_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!buyer) return new Response(JSON.stringify({ error: "COACHING_INVOICE_DATA_MISSING" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const coachUser = coachProfile ? await sb.from("users").select("full_name").eq("id", coachProfile.user_id).maybeSingle() : { data: null };
  const year = new Date().getFullYear();
  const invoiceNumber = `OGA-COACH-${year}-${String(order.order_number).split("-").slice(-1)[0]}`;
  const coachName = String(coachUser.data?.full_name || order.coach_name_snapshot || "Omnia Coaching");
  const productType = String(order.product_type || "session");
  const snapshot = (order.product_snapshot || {}) as Record<string, unknown>;
  const productDetail = productType === "package" ? `${snapshot.session_count || ""} séances de ${snapshot.session_duration_minutes || ""} minutes` : productType === "subscription" ? `Abonnement de ${snapshot.validity_days || 30} jours · réduction ${snapshot.discount_percent || 0}%` : productType === "group" ? `Coaching collectif · capacité ${snapshot.capacity || ""}` : null;
  const pdfBytes = await buildCoachingPdf({
    invoiceNumber,
    orderNumber: String(order.order_number),
    buyerName: String(buyer.full_name || buyer.email),
    buyerEmail: String(buyer.email),
    coachName,
    offerTitle: String(order.offer_title_snapshot),
    sessionStart: order.session_start_snapshot ? String(order.session_start_snapshot) : null,
    durationMinutes: coachingSession?.duration_minutes ? Number(coachingSession.duration_minutes) : null,
    productType,
    productDetail,
    amountXof: Number(order.amount_xof),
    providerTransactionId: order.provider_transaction_id,
  });
  const checksum = await sha256Hex(pdfBytes);
  const storagePath = `${order.user_id}/${year}/${invoiceNumber}.pdf`;
  const upload = await sb.storage.from("coaching-invoices").upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: false });
  if (upload.error && !String(upload.error.message).toLowerCase().includes("already exists")) throw upload.error;

  const invoiceInsert = await sb.from("coaching_invoices").insert({
    invoice_number: invoiceNumber,
    order_id: order.id,
    session_id: order.session_id || null,
    user_id: order.user_id,
    coach_id: order.coach_id || null,
    amount_xof: order.amount_xof,
    currency: order.currency,
    buyer_name: buyer.full_name || buyer.email,
    buyer_email: buyer.email,
    coach_name: coachName,
    offer_title: order.offer_title_snapshot,
    session_start: order.session_start_snapshot || null,
    duration_minutes: coachingSession?.duration_minutes || null,
    product_type: productType,
    product_id: order.product_id || null,
    invoice_snapshot: { order_number: order.order_number, provider_transaction_id: order.provider_transaction_id, coach_name: coachName, offer_title: order.offer_title_snapshot, session_start: order.session_start_snapshot, session_end: order.session_end_snapshot, amount_xof: order.amount_xof, currency: order.currency, product_type: productType, product_id: order.product_id, product_snapshot: snapshot },
    pdf_storage_path: storagePath,
    checksum_sha256: checksum,
  }).select("id,invoice_number").single();
  if (invoiceInsert.error) {
    const retry = await sb.from("coaching_invoices").select("id,invoice_number").eq("order_id", order.id).maybeSingle();
    if (!retry.data) throw invoiceInsert.error;
    return new Response(JSON.stringify({ success: true, invoice_id: retry.data.id, invoice_number: retry.data.invoice_number }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  await notifyCoachingInvoice(String(order.user_id), invoiceNumber, String(order.offer_title_snapshot), Number(order.amount_xof));
  return new Response(JSON.stringify({ success: true, invoice_id: invoiceInsert.data.id, invoice_number: invoiceNumber }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (!isOmniaInternalRequest(req)) return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json();
    if (body.coaching_order_id) {
      return await generateCoachingInvoice(sb, String(body.coaching_order_id));
    }
    const { order_id } = body;
    if (!order_id) return new Response(JSON.stringify({ error: "MISSING_ORDER_ID" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: order } = await sb.from("orders").select("*").eq("id", order_id).maybeSingle();
    if (!order) return new Response(JSON.stringify({ error: "ORDER_NOT_FOUND" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    if (order.invoice_url) {
      return new Response(JSON.stringify({ success: true, invoice_url: order.invoice_url }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: course } = await sb.from("courses").select("title, level, category, cpd_accredited").eq("id", order.course_id).maybeSingle();
    const { data: buyer } = await sb.from("users").select("full_name, email, country_code").eq("id", order.user_id).maybeSingle();

    const year = new Date().getFullYear();
    const invoiceNumber = `FACT-${year}-${(order.order_number as string).split("-").pop()}`;
    const html = buildInvoiceHtml(order, course ?? {}, buyer ?? {});

    // Store in Supabase Storage (invoices bucket)
    const filename = `invoices/${invoiceNumber}.html`;
    const { error: uploadErr } = await sb.storage.from("invoices").upload(filename, html, {
      contentType: "text/html; charset=utf-8",
      upsert: true,
    });

    let invoiceUrl: string;
    if (uploadErr) {
      // Fallback: store as data URI accessible via endpoint
      invoiceUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/invoice-generate?view=${order_id}`;
    } else {
      const { data: urlData } = sb.storage.from("invoices").getPublicUrl(filename);
      invoiceUrl = urlData.publicUrl;
    }

    await sb.from("orders").update({
      invoice_number: invoiceNumber,
      invoice_generated_at: new Date().toISOString(),
      invoice_url: invoiceUrl,
    }).eq("id", order_id);

    return new Response(JSON.stringify({ success: true, invoice_url: invoiceUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: "INTERNAL", message: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
