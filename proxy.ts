import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { configured, authEnv } from "./lib/env";
export async function proxy(request: NextRequest) {
  if (!configured) return NextResponse.next();
  let response = NextResponse.next({ request });
  const env = authEnv();
  const client = createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  const {
    data: { user },
  } = await client.auth.getUser();
  // Signed-out visitors to the root see the salon directory, not a login wall.
  if (!user && request.nextUrl.pathname === "/") {
    // Clone so search parameters (query, district, page) survive the rewrite.
    const home = request.nextUrl.clone();
    home.pathname = "/home";
    const landing = NextResponse.rewrite(home);
    response.cookies.getAll().forEach((c) => landing.cookies.set(c));
    return landing;
  }
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|webp)$).*)",
  ],
};
