import { createHmac, timingSafeEqual } from "node:crypto";
import { HttpError } from "../errors";
// Byl (byl.mn) puts QPay, SocialPay, Pocket and bank apps behind one API.
// Docs: https://byl.mn/docs/api/checkouts.html, https://byl.mn/docs/webhook.html
const BASE = "https://byl.mn/api/v1";
export type CheckoutState = "open" | "pending" | "complete" | "expired";
export type RemoteCheckout = {
  id: number;
  url: string;
  status: CheckoutState;
  amountTotal: number;
  reference: string | null;
};
export type NewCheckout = {
  amountMnt: number;
  name: string;
  reference: string;
  successUrl?: string;
  cancelUrl?: string;
};
// What the billing service needs; tests pass a fake.
export type BylClient = {
  create(input: NewCheckout): Promise<{ id: number; url: string }>;
  get(id: number): Promise<RemoteCheckout>;
};
const unavailable =
  "Онлайн төлбөрийн систем түр ажиллахгүй байна. Дараа дахин оролдоно уу.";
// All three values are needed; without them the billing page shows only the
// bank transfer.
export function bylClient(
  env: Record<string, string | undefined> = process.env,
): BylClient | null {
  const token = env.BYL_TOKEN;
  const project = env.BYL_PROJECT_ID;
  if (!token || !project || !env.BYL_SIGNING_SECRET) return null;
  async function call(path: string, body?: unknown) {
    const response = await fetch(`${BASE}/projects/${project}${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    }).catch(() => null);
    const data = await response?.json().catch(() => null);
    if (!response?.ok || !data?.data) {
      // Byl's error code names the cause (e.g. missing_bank_account) without
      // any customer data.
      console.error("Byl request failed", response?.status, data?.error ?? "");
      throw new HttpError(503, unavailable);
    }
    return data.data;
  }
  return {
    async create(input) {
      const data = await call("/checkouts", {
        items: [
          {
            price_data: {
              unit_amount: input.amountMnt,
              product_data: { name: input.name },
            },
            quantity: 1,
          },
        ],
        client_reference_id: input.reference,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
      });
      return { id: Number(data.id), url: String(data.url) };
    },
    async get(id) {
      const data = await call(`/checkouts/${id}`);
      return {
        id: Number(data.id),
        url: String(data.url),
        status: data.status,
        amountTotal: Number(data.amount_total),
        reference: data.client_reference_id ?? null,
      };
    },
  };
}
// Byl signs the raw body with HMAC-SHA256 (hex) in the Byl-Signature header.
export function validSignature(
  raw: string,
  signature: string | null,
  secret = process.env.BYL_SIGNING_SECRET,
) {
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  return (
    signature.length === expected.length &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  );
}
