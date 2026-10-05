import { NextResponse } from "next/server";
import { safeAuthNext } from "@/lib/auth-navigation";
import { supabase } from "@/lib/supabase";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await (
      await supabase()
    ).auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(safeAuthNext(url.searchParams.get("next")), url.origin),
      );
  }
  return NextResponse.redirect(
    new URL("/sign-in?error=confirmation", url.origin),
  );
}
