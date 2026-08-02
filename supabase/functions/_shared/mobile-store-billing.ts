import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";

export type StorePlatform = "android" | "ios";
export type StoreProductType = "consumable" | "non_consumable" | "subscription";
export type StoreTargetType = "course" | "commerce" | "omnia_live" | "coaching" | "coaching_advanced";

export type VerifiedStorePurchase = {
  platform: StorePlatform;
  storeProductId: string;
  providerTransactionId: string | null;
  purchaseTokenHash: string;
  purchaseState: string;
  acknowledgementState: string | null;
  consumptionState: string | null;
  payload: Record<string, unknown>;
  needsAcknowledge: boolean;
  needsConsume: boolean;
};

const GOOGLE_SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_ANDROID_PUBLISHER = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";

function base64Url(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pemToDer(value: string): Uint8Array {
  const body = value.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g, "");
  const binary = atob(body);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function obfuscatedStoreAccountId(userId: string): Promise<string> {
  return (await sha256Hex(`omnia-store-account:${userId}`)).slice(0, 64);
}

function googleServiceAccount(): { client_email: string; private_key: string } {
  const raw = Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON") || "";
  if (!raw) throw new Error("GOOGLE_PLAY_CONFIGURATION_MISSING");
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_PLAY_SERVICE_ACCOUNT_INVALID");
  }
  const clientEmail = String(parsed.client_email || "").trim();
  const privateKey = String(parsed.private_key || "").replace(/\\n/g, "\n").trim();
  if (!clientEmail || !privateKey.includes("BEGIN PRIVATE KEY")) {
    throw new Error("GOOGLE_PLAY_SERVICE_ACCOUNT_INVALID");
  }
  return { client_email: clientEmail, private_key: privateKey };
}

async function googleAccessToken(): Promise<string> {
  const account = googleServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iss: account.client_email,
    scope: GOOGLE_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }));
  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(account.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  const assertion = `${signingInput}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.access_token) {
    console.error("googleAccessToken", response.status, result);
    throw new Error("GOOGLE_PLAY_AUTH_FAILED");
  }
  return String(result.access_token);
}

async function googleApi(path: string, method = "GET", body?: unknown) {
  const token = await googleAccessToken();
  const response = await fetch(`${GOOGLE_ANDROID_PUBLISHER}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("googleApi", method, path, response.status, payload);
    const error = new Error("GOOGLE_PLAY_VERIFICATION_FAILED");
    (error as Error & { details?: unknown }).details = payload;
    throw error;
  }
  return payload as Record<string, any>;
}

export async function verifyGooglePlayPurchase(input: {
  packageName: string;
  productId: string;
  productType: StoreProductType;
  purchaseToken: string;
  expectedAccountId: string;
}): Promise<VerifiedStorePurchase> {
  const packageName = input.packageName.trim();
  if (packageName !== "com.omniaglobalacademy.app") throw new Error("GOOGLE_PLAY_PACKAGE_INVALID");
  if (!input.purchaseToken || !input.productId) throw new Error("STORE_PURCHASE_DATA_INCOMPLETE");

  if (input.productType === "subscription") {
    const payload = await googleApi(
      `${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(input.purchaseToken)}`,
    );
    const state = String(payload.subscriptionState || "");
    if (!["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD"].includes(state)) {
      throw new Error(`GOOGLE_PLAY_SUBSCRIPTION_NOT_ACTIVE:${state || "UNKNOWN"}`);
    }
    const lineItems = Array.isArray(payload.lineItems) ? payload.lineItems : [];
    if (!lineItems.some((item: Record<string, unknown>) => String(item.productId || "") === input.productId)) {
      throw new Error("GOOGLE_PLAY_PRODUCT_MISMATCH");
    }
    const accountId = String(payload.externalAccountIdentifiers?.obfuscatedExternalAccountId || "");
    if (accountId && accountId !== input.expectedAccountId) throw new Error("GOOGLE_PLAY_ACCOUNT_MISMATCH");
    const providerTransactionId = String(
      lineItems.find((item: Record<string, unknown>) => String(item.productId || "") === input.productId)?.latestSuccessfulOrderId
        || payload.latestOrderId
        || "",
    ) || null;
    return {
      platform: "android",
      storeProductId: input.productId,
      providerTransactionId,
      purchaseTokenHash: await sha256Hex(input.purchaseToken),
      purchaseState: state,
      acknowledgementState: String(payload.acknowledgementState || ""),
      consumptionState: null,
      payload,
      needsAcknowledge: String(payload.acknowledgementState || "") !== "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
      needsConsume: false,
    };
  }

  const payload = await googleApi(
    `${encodeURIComponent(packageName)}/purchases/products/${encodeURIComponent(input.productId)}/tokens/${encodeURIComponent(input.purchaseToken)}`,
  );
  if (Number(payload.purchaseState) !== 0) throw new Error("GOOGLE_PLAY_PURCHASE_NOT_COMPLETED");
  const accountId = String(payload.obfuscatedExternalAccountId || "");
  if (accountId && accountId !== input.expectedAccountId) throw new Error("GOOGLE_PLAY_ACCOUNT_MISMATCH");
  return {
    platform: "android",
    storeProductId: input.productId,
    providerTransactionId: String(payload.orderId || "") || null,
    purchaseTokenHash: await sha256Hex(input.purchaseToken),
    purchaseState: "PURCHASED",
    acknowledgementState: String(payload.acknowledgementState ?? ""),
    consumptionState: String(payload.consumptionState ?? ""),
    payload,
    needsAcknowledge: input.productType === "non_consumable" && Number(payload.acknowledgementState) !== 1,
    needsConsume: input.productType === "consumable" && Number(payload.consumptionState) !== 1,
  };
}

export async function finishGooglePlayPurchase(input: {
  packageName: string;
  productId: string;
  productType: StoreProductType;
  purchaseToken: string;
  needsAcknowledge: boolean;
  needsConsume: boolean;
}) {
  if (input.needsConsume) {
    await googleApi(
      `${encodeURIComponent(input.packageName)}/purchases/products/${encodeURIComponent(input.productId)}/tokens/${encodeURIComponent(input.purchaseToken)}:consume`,
      "POST",
      {},
    );
    return { consumed: true, acknowledged: false };
  }
  if (input.needsAcknowledge) {
    const path = input.productType === "subscription"
      ? `${encodeURIComponent(input.packageName)}/purchases/subscriptions/${encodeURIComponent(input.productId)}/tokens/${encodeURIComponent(input.purchaseToken)}:acknowledge`
      : `${encodeURIComponent(input.packageName)}/purchases/products/${encodeURIComponent(input.productId)}/tokens/${encodeURIComponent(input.purchaseToken)}:acknowledge`;
    await googleApi(path, "POST", {});
    return { consumed: false, acknowledged: true };
  }
  return { consumed: false, acknowledged: false };
}

export async function loadStoreSession(
  sb: SupabaseClient,
  userId: string,
  sessionId: string,
) {
  const { data, error } = await sb
    .from("mobile_store_purchase_sessions")
    .select("*,mobile_store_products(*)")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("STORE_SESSION_NOT_FOUND");
  if (new Date(String(data.expires_at)).getTime() <= Date.now() && data.status !== "completed") {
    await sb.from("mobile_store_purchase_sessions").update({ status: "expired", error_code: "SESSION_EXPIRED" }).eq("id", data.id);
    throw new Error("STORE_SESSION_EXPIRED");
  }
  return data as Record<string, any>;
}
