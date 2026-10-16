import { z } from "zod";
import { db } from "@/lib/db";
import { membership, setupAccess } from "@/lib/auth";
import { actorFromMember } from "@/lib/access";
import { failure, sameOrigin } from "@/lib/http";
import { HttpError } from "@/lib/errors";
import { supabaseMediaStore } from "@/lib/storage";
import {
  MAX_IMAGE_BYTES,
  addBranchImage,
  moveBranchImage,
  readBranchGallery,
  removeBranchImage,
} from "@/lib/services/salon-media";
// ?branchId= lists or adds a branch's photos; ?id= moves or removes one.
const param = (request: Request, name: "branchId" | "id") =>
  z.string().min(1).max(100).parse(new URL(request.url).searchParams.get(name));
export async function GET(request: Request) {
  try {
    return Response.json(
      await readBranchGallery(
        db,
        actorFromMember(await membership(setupAccess)),
        param(request, "branchId"),
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const actor = actorFromMember(await membership(setupAccess));
    const branchId = param(request, "branchId");
    if (
      Number(request.headers.get("content-length") ?? 0) >
      MAX_IMAGE_BYTES + 65536
    )
      throw new HttpError(413, "Зургийн хэмжээ 4 МБ-аас ихгүй байна.");
    const file = (await request.formData()).get("file");
    if (!(file instanceof Blob)) throw new HttpError(400, "Зургаа сонгоно уу.");
    return Response.json(
      await addBranchImage(
        db,
        actor,
        branchId,
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
      .object({ direction: z.enum(["earlier", "later", "first"]) })
      .strict()
      .parse(await request.json());
    return Response.json(
      await moveBranchImage(
        db,
        actorFromMember(await membership(setupAccess)),
        param(request, "id"),
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
      await removeBranchImage(
        db,
        actorFromMember(await membership(setupAccess)),
        param(request, "id"),
        supabaseMediaStore(),
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
