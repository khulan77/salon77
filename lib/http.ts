import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { validationMessage } from "./ui-language";
import { HttpError } from "./auth";
export function sameOrigin(request: Request) {
  // Next may construct request.url with an internal hostname behind a proxy.
  // Host is browser-controlled only through the target URL, unlike arbitrary
  // cross-origin request headers. Keep the scheme and port in the comparison.
  const expected = new URL(request.url);
  expected.host = request.headers.get("host") ?? expected.host;
  if (request.headers.get("origin") !== expected.origin)
    throw new HttpError(
      403,
      "Хүсэлтийг зөвшөөрөөгүй эх сурвалжаас илгээсэн байна.",
    );
}
export function failure(error: unknown) {
  if (error instanceof HttpError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError)
    return Response.json(
      { error: error.issues.map(validationMessage).join(" ") },
      { status: 400 },
    );
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  )
    return Response.json(
      { error: "Энэ хаяг эсвэл бүртгэл өмнө нь үүссэн байна." },
      { status: 409 },
    );
  console.error(
    "Salon77 request failed",
    error instanceof Error ? error.name : "Unknown error",
  );
  return Response.json(
    { error: "Алдаа гарлаа. Дахин оролдоно уу." },
    { status: 500 },
  );
}
