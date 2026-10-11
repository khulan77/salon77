import { z } from "zod";
import { db } from "@/lib/db";
import { membership } from "@/lib/auth";
import { actorFromMember } from "@/lib/access";
import { failure, sameOrigin } from "@/lib/http";
import { HttpError } from "@/lib/errors";
import { supabaseMediaStore } from "@/lib/storage";
import {
  MAX_IMAGE_BYTES,
  removePhoto,
  setPhoto,
} from "@/lib/services/salon-media";
// ?target=service|staff&id= — the photo of one service or staff member.
const query = z
  .object({
    target: z.enum(["service", "staff"]),
    id: z.string().min(1).max(100),
  })
  .strict();
const subject = (request: Request) => {
  const q = new URL(request.url).searchParams;
  return query.parse({ target: q.get("target"), id: q.get("id") });
};
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const actor = actorFromMember(await membership());
    const { target, id } = subject(request);
    if (
      Number(request.headers.get("content-length") ?? 0) >
      MAX_IMAGE_BYTES + 65536
    )
      throw new HttpError(413, "Зургийн хэмжээ 4 МБ-аас ихгүй байна.");
    const file = (await request.formData()).get("file");
    if (!(file instanceof Blob)) throw new HttpError(400, "Зургаа сонгоно уу.");
    return Response.json(
      await setPhoto(
        db,
        actor,
        target,
        id,
        new Uint8Array(await file.arrayBuffer()),
        supabaseMediaStore(),
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const { target, id } = subject(request);
    return Response.json(
      await removePhoto(
        db,
        actorFromMember(await membership()),
        target,
        id,
        supabaseMediaStore(),
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
