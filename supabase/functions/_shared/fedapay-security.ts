import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const encoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((value) => value.toString(16).padStart(2, "0")).join("");
}

function constantTimeHexEqual(left: string, right: string): boolean {
  const a = encoder.encode(left.toLowerCase());
  const b = encoder.encode(right.toLowerCase());
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

async function hmacSha256Hex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return bytesToHex(new Uint8Array(signature));
}

export async function verifyFedaPayWebhook(
  rawBody: string,
  signatureHeader: string | null,
  endpointSecret: string,
  toleranceSeconds = 300,
): Promise<void> {
  if (!endpointSecret.trim()) throw new Error("FEDAPAY_WEBHOOK_SECRET_MISSING");
  if (!signatureHeader?.trim()) throw new Error("FEDAPAY_SIGNATURE_MISSING");

  let timestampText = "";
  const signatures: string[] = [];

  for (const part of signatureHeader.split(/[,;]/)) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const key = part.slice(0, separator).trim().toLowerCase();
    const value = part.slice(separator + 1).trim();
    if (key === "t") timestampText = value;
    if (key === "s" || key === "v1") signatures.push(value);
  }

  if (!timestampText || signatures.length === 0) throw new Error("FEDAPAY_SIGNATURE_FORMAT_INVALID");

  const rawTimestamp = Number(timestampText);
  if (!Number.isFinite(rawTimestamp)) throw new Error("FEDAPAY_SIGNATURE_TIMESTAMP_INVALID");
  const timestampSeconds = rawTimestamp > 1_000_000_000_000 ? Math.floor(rawTimestamp / 1000) : Math.floor(rawTimestamp);
  const age = Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds);
  if (age > toleranceSeconds) throw new Error("FEDAPAY_SIGNATURE_EXPIRED");

  const expected = await hmacSha256Hex(endpointSecret, `${timestampText}.${rawBody}`);
  if (!signatures.some((candidate) => constantTimeHexEqual(candidate, expected))) {
    throw new Error("FEDAPAY_SIGNATURE_INVALID");
  }
}

export function fedaPayApiBase(): string {
  const mode = (Deno.env.get("FEDAPAY_MODE") || Deno.env.get("FEDAPAY_ENV") || "live").toLowerCase();
  return mode === "sandbox" || mode === "test" || mode === "development"
    ? "https://sandbox-api.fedapay.com/v1"
    : "https://api.fedapay.com/v1";
}

export function extractFedaPayTransaction(payload: Record<string, unknown>): Record<string, any> {
  const data = payload.data as Record<string, unknown> | undefined;
  return (
    (payload.entity as Record<string, any> | undefined) ||
    (data?.entity as Record<string, any> | undefined) ||
    (data as Record<string, any> | undefined) ||
    (payload.transaction as Record<string, any> | undefined) ||
    {}
  );
}

export function transactionMetadata(transaction: Record<string, any>): Record<string, any> {
  return (transaction.custom_metadata || transaction.metadata || {}) as Record<string, any>;
}

export function transactionCurrency(transaction: Record<string, any>): string {
  const currency = transaction.currency;
  if (typeof currency === "string") return currency.toUpperCase();
  return String(currency?.iso || currency?.code || transaction.currency_code || "").toUpperCase();
}

export function assertTransactionMatches(
  transaction: Record<string, any>,
  expectedAmountXof: number,
  expectedCurrency = "XOF",
): void {
  const actualAmount = Number(transaction.amount);
  if (!Number.isFinite(actualAmount) || Math.round(actualAmount) !== Math.round(expectedAmountXof)) {
    throw new Error(`FEDAPAY_AMOUNT_MISMATCH:${actualAmount}:${expectedAmountXof}`);
  }
  const currency = transactionCurrency(transaction);
  if (currency && currency !== expectedCurrency.toUpperCase()) {
    throw new Error(`FEDAPAY_CURRENCY_MISMATCH:${currency}:${expectedCurrency}`);
  }
}

export async function retrieveFedaPayTransaction(transactionId: string): Promise<Record<string, any>> {
  const secretKey = Deno.env.get("FEDAPAY_SECRET_KEY") || "";
  if (!secretKey) throw new Error("FEDAPAY_SECRET_KEY_MISSING");
  if (!transactionId) throw new Error("FEDAPAY_TRANSACTION_ID_MISSING");

  const response = await fetch(`${fedaPayApiBase()}/transactions/${encodeURIComponent(transactionId)}`, {
    headers: { Authorization: `Bearer ${secretKey}`, Accept: "application/json" },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`FEDAPAY_TRANSACTION_LOOKUP_FAILED:${response.status}`);
  return (body.v1Transaction || body.transaction || body.data || body) as Record<string, any>;
}

export function approvedStatus(transaction: Record<string, any>): boolean {
  return ["approved", "paid", "successful", "success", "completed"].includes(String(transaction.status || "").toLowerCase());
}

export function failedStatus(transaction: Record<string, any>): boolean {
  return ["declined", "failed", "canceled", "cancelled"].includes(String(transaction.status || "").toLowerCase());
}
