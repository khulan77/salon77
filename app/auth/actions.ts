"use server";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { configured } from "@/lib/env";
const credentials = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
});
export async function authenticate(
  _state: { error?: string; success?: string },
  form: FormData,
): Promise<{ error?: string; success?: string }> {
  if (!configured)
    return {
      error: "Нэвтрэхийн тулд системийн холболтыг тохируулах шаардлагатай.",
    };
  const parsed = credentials.safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success)
    return {
      error:
        "Зөв имэйл хаяг болон 8-аас доошгүй тэмдэгттэй нууц үг оруулна уу.",
    };
  const client = await supabase();
  if (form.get("mode") === "sign-up") {
    const name = z.string().trim().min(1).max(100).safeParse(form.get("name"));
    if (!name.success) return { error: "Нэрээ оруулна уу." };
    const origin = (await headers()).get("origin");
    const { data, error } = await client.auth.signUp({
      ...parsed.data,
      options: {
        data: { name: name.data },
        ...(origin ? { emailRedirectTo: `${origin}/auth/callback` } : {}),
      },
    });
    if (error)
      return {
        error:
          "Бүртгэл үүсгэж чадсангүй. Мэдээллээ шалгах эсвэл нэвтэрч үзнэ үү.",
      };
    if (!data.session)
      return {
        success:
          "Имэйлдээ ирсэн холбоосоор бүртгэлээ баталгаажуулаад нэвтэрнэ үү.",
      };
    redirect("/onboarding");
  }
  const { error } = await client.auth.signInWithPassword(parsed.data);
  if (error)
    return { error: "Нэвтэрч чадсангүй. Имэйл хаяг, нууц үгээ шалгана уу." };
  redirect("/");
}
export async function signOut() {
  if (configured) await (await supabase()).auth.signOut();
  (await cookies()).delete("salon77-tenant");
  redirect("/sign-in");
}
