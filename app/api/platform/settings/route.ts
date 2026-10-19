import { z } from "zod";
import { db } from "@/lib/db";
import { platformAdmin } from "@/lib/auth";
import { failure, sameOrigin } from "@/lib/http";
import { pricePerBranch, setPricePerBranch } from "@/lib/services/billing";
import { priceNotice } from "@/lib/services/notices";
import { announce } from "@/lib/announce";
const body = z
  .object({ notify: z.boolean().default(false) })
  .passthrough();
export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const user = await platformAdmin();
    const { notify, ...input } = body.parse(await request.json());
    const before = await pricePerBranch(db);
    const saved = await setPricePerBranch(db, user.id, input);
    // Salons hear about a new price only when it actually changed.
    const notified =
      notify && before !== saved.pricePerBranchMnt
        ? Boolean(await announce(user.id, priceNotice(saved.pricePerBranchMnt)))
        : false;
    return Response.json({ ...saved, notified });
  } catch (e) {
    return failure(e);
  }
}
