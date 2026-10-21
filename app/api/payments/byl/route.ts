import { db } from "@/lib/db";
import { failure } from "@/lib/http";
import { bylClient, validSignature } from "@/lib/payments/byl";
import { settleCheckout } from "@/lib/services/billing";
// Byl's webhook. The payload only says which checkout changed; its state is
// read back from Byl, so a replayed or reordered event cannot mark it paid.
export async function POST(request: Request) {
  const raw = await request.text();
  if (!validSignature(raw, request.headers.get("byl-signature")))
    return Response.json({ error: "Зөвшөөрөлгүй." }, { status: 401 });
  const byl = bylClient();
  if (!byl) return Response.json({ error: "Тохиргоо дутуу." }, { status: 503 });
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Буруу хүсэлт." }, { status: 400 });
  }
  const id = Number(event?.data?.object?.id);
  // Other events and other projects' checkouts are acknowledged and ignored.
  const ours =
    event?.type === "checkout.completed" &&
    Number.isInteger(id) &&
    (await db.billingCheckout.findUnique({
      where: { bylId: id },
      select: { id: true },
    }));
  if (ours)
    try {
      await settleCheckout(db, await byl.get(id));
    } catch (e) {
      // A non-2xx answer makes Byl retry later.
      return failure(e);
    }
  return Response.json({ received: true });
}
