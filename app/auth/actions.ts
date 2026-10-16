"use server";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { safeAuthNext } from "@/lib/auth-navigation";
import { configured } from "@/lib/env";
import { recordLogin } from "@/lib/login-activity";
import { db } from "@/lib/db";
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
  const next = safeAuthNext(form.get("next"));
  if (form.get("mode") === "sign-up") {
    const name = z.string().trim().min(1).max(100).safeParse(form.get("name"));
    if (!name.success) return { error: "Нэрээ оруулна уу." };
    const origin = (await headers()).get("origin");
    const { data, error } = await client.auth.signUp({
      ...parsed.data,
      options: {
        data: { name: name.data },
        ...(origin
          ? {
              emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
            }
          : {}),
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
    redirect(next === "/" ? "/onboarding" : next);
  }
  const { data, error } = await client.auth.signInWithPassword(parsed.data);
  if (error)
    return { error: "Нэвтэрч чадсангүй. Имэйл хаяг, нууц үгээ шалгана уу." };
  await recordLogin(data.user.id);
  redirect(next === "/" ? await homeFor(data.user.id) : next);
}
// The platform operator lands on the console; everyone else on their salon.
async function homeFor(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { isSuperAdmin: true },
  });
  return user?.isSuperAdmin ? "/platform" : "/";
}
// Always the same answer, so the form never reveals which emails have an
// account. Supabase sends the link and limits how often it can be asked.
export async function requestPasswordReset(
  _state: { error?: string; success?: string },
  form: FormData,
): Promise<{ error?: string; success?: string }> {
  if (!configured)
    return {
      error: "Нэвтрэхийн тулд системийн холболтыг тохируулах шаардлагатай.",
    };
  const email = z.email().safeParse(form.get("email"));
  if (!email.success) return { error: "Зөв имэйл хаяг оруулна уу." };
  const origin = (await headers()).get("origin");
  await (
    await supabase()
  ).auth.resetPasswordForEmail(email.data, {
    ...(origin
      ? { redirectTo: `${origin}/auth/callback?next=/reset-password` }
      : {}),
  });
  return {
    success:
      "Энэ имэйлээр бүртгэл байгаа бол нууц үг сэргээх холбоос илгээлээ. Имэйлээ шалгана уу.",
  };
}
// Reached from the recovery link, which signs the user in first.
export async function updatePassword(
  _state: { error?: string; success?: string },
  form: FormData,
): Promise<{ error?: string; success?: string }> {
  if (!configured)
    return {
      error: "Нэвтрэхийн тулд системийн холболтыг тохируулах шаардлагатай.",
    };
  const password = z.string().min(8).max(128).safeParse(form.get("password"));
  if (!password.success)
    return { error: "Нууц үг 8-аас доошгүй тэмдэгттэй байна." };
  if (form.get("password") !== form.get("confirm"))
    return { error: "Нууц үг таарахгүй байна." };
  const client = await supabase();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user)
    return {
      error:
        "Холбоосын хугацаа дууссан байна. Нууц үг сэргээх холбоосыг дахин авна уу.",
    };
  const { error } = await client.auth.updateUser({
    password: password.data,
  });
  if (error)
    return {
      error:
        "Нууц үгийг шинэчилж чадсангүй. Өмнөхөөсөө өөр нууц үг оруулаад дахин оролдоно уу.",
    };
  await recordLogin(user.id);
  redirect(await homeFor(user.id));
}
export async function signOut() {
  if (configured) await (await supabase()).auth.signOut();
  (await cookies()).delete("salon77-tenant");
  redirect("/sign-in");
}
