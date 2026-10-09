import { db } from "@/lib/db";
import { failure } from "@/lib/http";
import { guardPublic } from "@/lib/rate-limit";
import { listDirectory } from "@/lib/services/directory";
export async function GET(request: Request) {
  try {
    await guardPublic(db, request, "directory", "availability");
    return Response.json(
      await listDirectory(
        db,
        Object.fromEntries(new URL(request.url).searchParams),
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
