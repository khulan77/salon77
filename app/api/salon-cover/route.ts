import { db } from "@/lib/db";
import { membership } from "@/lib/auth";
import { actorFromMember } from "@/lib/access";
import { failure, sameOrigin } from "@/lib/http";
import { HttpError } from "@/lib/errors";
import { supabaseMediaStore } from "@/lib/storage";
import {
  MAX_IMAGE_BYTES,
  removeSalonCover,
  setSalonCover,
} from "@/lib/services/salon-media";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const actor = actorFromMember(await membership());
    if (
      Number(request.headers.get("content-length") ?? 0) >
      MAX_IMAGE_BYTES + 65536
    )
      throw new HttpError(413, "Зургийн хэмжээ 4 МБ-аас ихгүй байна.");
    const file = (await request.formData()).get("file");
    if (!(file instanceof Blob)) throw new HttpError(400, "Зургаа сонгоно уу.");
    return Response.json(
      await setSalonCover(
        db,
        actor,
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
    return Response.json(
      await removeSalonCover(
        db,
        actorFromMember(await membership()),
        supabaseMediaStore(),
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
