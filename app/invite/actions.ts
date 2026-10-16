"use server";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { configured } from "@/lib/env";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { joinSchema, tokenSchema } from "@/lib/validation";
import { recordLogin } from "@/lib/login-activity";
import { createInvitedUser } from "@/lib/auth-admin";
import { roleHome } from "@/lib/auth-navigation";
import {
  acceptInvitation,
  invalidInvitation,
  previewInvitation,
} from "@/lib/services/team";
export type JoinState = {
  error?: string;
  success?: string;
  mode?: "sign-up" | "sign-in";
};
const problem = (e: unknown, fallback: string) =>
  e instanceof HttpError ? e.message : fallback;
// Creates the receptionist's own account (or signs in an existing one) and
// joins the salon in one step. The email is always the invited one.
export async function joinInvitation(
  _state: JoinState,
  form: FormData,
): Promise<JoinState> {
  if (!configured)
    return { error: "Системийн холболт тохируулагдаагүй байна." };
  const token = tokenSchema.safeParse(form.get("token"));
  if (!token.success) return { error: invalidInvitation };
  let invite;
  try {
    invite = await previewInvitation(db, token.data);
  } catch (e) {
    return { error: problem(e, invalidInvitation) };
  }
  const signIn = form.get("mode") === "sign-in";
  const mode = signIn ? "sign-in" : "sign-up";
  const client = await supabase();
  let user, name: string | undefined;
  if (signIn) {
    const password = z.string().min(8).max(128).safeParse(form.get("password"));
    if (!password.success)
      return {
        mode,
        error: "Нууц үгээ зөв оруулна уу (8-аас доошгүй тэмдэгт).",
      };
    const { data, error } = await client.auth.signInWithPassword({
      email: invite.email,
      password: password.data,
    });
    if (error)
      return {
        mode,
        error:
          "Нэвтэрч чадсангүй. Нууц үгээ шалгана уу. Бүртгэлгүй бол «Шинээр нэгдэх»-ийг сонгоно уу.",
      };
    user = data.user;
    await recordLogin(user.id);
  } else {
    const input = joinSchema.safeParse({
      name: form.get("name"),
      password: form.get("password"),
      confirm: form.get("confirm"),
    });
    if (!input.success) {
      const field = input.error.issues[0]?.path[0];
      return {
        mode,
        error:
          field === "name"
            ? "Нэрээ оруулна уу."
            : field === "confirm"
              ? "Нууц үг хоорондоо таарахгүй байна."
              : "Нууц үг 8-аас доошгүй тэмдэгттэй байна.",
      };
    }
    name = input.data.name;
    const exists = {
      mode: "sign-in" as const,
      error:
        "Энэ имэйлээр Salon77 бүртгэл аль хэдийн байна. Одоогийн нууц үгээрээ нэвтэрч нэгдэнэ үү.",
    };
    // With the secret key the account is created confirmed, so joining takes
    // one step; without it Supabase asks the person to confirm their email.
    const created = await createInvitedUser({
      email: invite.email,
      password: input.data.password,
      name,
    });
    if (!created.ok && created.reason === "exists") return exists;
    if (!created.ok && created.reason === "failed")
      return {
        mode,
        error: "Бүртгэл үүсгэж чадсангүй. Түр хүлээгээд дахин оролдоно уу.",
      };
    if (created.ok) {
      const { data, error } = await client.auth.signInWithPassword({
        email: invite.email,
        password: input.data.password,
      });
      if (error)
        return {
          mode: "sign-in",
          error: "Бүртгэл үүслээ. Шинэ нууц үгээрээ нэвтэрч нэгдэнэ үү.",
        };
      user = data.user;
    } else {
      const origin = (await headers()).get("origin");
      const next = `/invite?token=${token.data}`;
      const { data, error } = await client.auth.signUp({
        email: invite.email,
        password: input.data.password,
        options: {
          data: { name },
          ...(origin
            ? {
                emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
              }
            : {}),
        },
      });
      if (error || !data.user)
        return {
          mode,
          error: "Бүртгэл үүсгэж чадсангүй. Түр хүлээгээд дахин оролдоно уу.",
        };
      // Supabase answers an already registered email with an empty identity list.
      if (!data.user.identities?.length) return exists;
      if (!data.session)
        return {
          mode,
          success:
            "Бүртгэл үүслээ. Имэйлдээ ирсэн баталгаажуулах холбоос дээр дарна уу — энэ урилга руу буцаж ирээд «Нэгдэх» товчийг дарна.",
        };
      user = data.user;
    }
    await recordLogin(user.id);
  }
  let joined;
  try {
    joined = await acceptInvitation(
      db,
      {
        id: user.id,
        email: user.email ?? invite.email,
        emailConfirmed: Boolean(user.email_confirmed_at),
      },
      token.data,
      name,
    );
  } catch (e) {
    return {
      mode,
      error: problem(e, "Урилга хүлээн авч чадсангүй. Дахин оролдоно уу."),
    };
  }
  (await cookies()).set("salon77-tenant", joined.salonId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  redirect(roleHome(joined.role));
}
// Signed in as someone else: sign out and come back to the same link.
export async function switchAccount(form: FormData) {
  const token = tokenSchema.safeParse(form.get("token"));
  if (configured) await (await supabase()).auth.signOut();
  (await cookies()).delete("salon77-tenant");
  redirect(token.success ? `/invite?token=${token.data}` : "/sign-in");
}
