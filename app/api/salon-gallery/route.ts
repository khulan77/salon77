import { z } from "zod";
import { db } from "@/lib/db";
import { membership } from "@/lib/auth";
import { actorFromMember } from "@/lib/access";
import { failure, sameOrigin } from "@/lib/http";
import { HttpError } from "@/lib/errors";
import { supabaseMediaStore } from "@/lib/storage";
import {
  MAX_IMAGE_BYTES,
  addGalleryImage,
  moveGalleryImage,
  readGallery,
  removeGalleryImage,
} from "@/lib/services/salon-media";
const idParam = (request: Request) =>
  z.string().min(1).max(100).parse(new URL(request.url).searchParams.get("id"));
export async function GET() {
  try {
    return Response.json(
      await readGallery(db, actorFromMember(await membership())),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
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
      await addGalleryImage(
        db,
        actor,
        new Uint8Array(await file.arrayBuffer()),
        supabaseMediaStore(),
      ),
      { status: 201 },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const { direction } = z
      .object({ direction: z.enum(["earlier", "later"]) })
      .strict()
      .parse(await request.json());
    return Response.json(
      await moveGalleryImage(
        db,
        actorFromMember(await membership()),
        idParam(request),
        direction,
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
      await removeGalleryImage(
        db,
        actorFromMember(await membership()),
        idParam(request),
        supabaseMediaStore(),
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
