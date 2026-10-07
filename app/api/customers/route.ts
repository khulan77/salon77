import { z } from "zod";
import { db } from "@/lib/db";
import { membership } from "@/lib/auth";
import { actorFromMember } from "@/lib/access";
import { failure, sameOrigin } from "@/lib/http";
import {
  listCustomers,
  customerDetail,
  updateCustomer,
} from "@/lib/services/customers";
const query = z
  .object({
    id: z.string().min(1).max(100).optional(),
    search: z.string().max(100).default(""),
    page: z.coerce.number().int().min(0).max(10000).default(0),
  })
  .strict();
export async function GET(request: Request) {
  try {
    const actor = actorFromMember(await membership()),
      q = query.parse(Object.fromEntries(new URL(request.url).searchParams));
    return Response.json(
      q.id
        ? await customerDetail(db, actor, q.id, q.page)
        : await listCustomers(db, actor, q.search, q.page),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const q = query.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return Response.json(
      await updateCustomer(
        db,
        actorFromMember(await membership()),
        z.string().min(1).parse(q.id),
        await request.json(),
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
