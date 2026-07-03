import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function buildInvoiceHtml(order: Record<string, unknown>, course: Record<string, unknown>, buyer: Record<string, unknown>): string {
  const invoiceDate = new Date(order.paid_at as string || order.created_at as string).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const fmtXof = (n: number) => n.toLocaleString("fr-FR") + " XOF";

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
        Bamako, Mali<br>
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json();
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
