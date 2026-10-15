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
  // Signed-out visitors to the root see a public page, not a login wall.
  // /landing picks the directory or the business page; the salon count it
  // needs is a database read, which does not belong in the proxy.
  if (!user && request.nextUrl.pathname === "/") {
    // Clone so search parameters (query, district, page) survive the rewrite.
    const home = request.nextUrl.clone();
    home.pathname = "/landing";
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
