"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { platformSession } from "@/lib/auth";
import { hit } from "@/lib/rate-limit";
import { HttpError } from "@/lib/errors";
type State = { error?: string };
const denied = "Хандах эрхгүй байна.";
// First visit: a new authenticator secret. Only while no factor is verified,
// so a stolen password cannot add a second authenticator.
export async function startEnrollment(): Promise<
  { qr: string; secret: string; factorId: string } | { error: string }
> {
  const session = await platformSession();
  if (!session) return { error: denied };
  const client = await supabase();
  const { data: factors } = await client.auth.mfa.listFactors();
  if (factors?.totp.length)
    return { error: "Баталгаажуулах апп аль хэдийн холбогдсон байна." };
  // Abandoned attempts would otherwise pile up and block a new one.
  for (const f of factors?.all ?? [])
    if (f.status !== "verified")
      await client.auth.mfa.unenroll({ factorId: f.id });
  const { data, error } = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Salon77 платформ ${Date.now()}`,
    issuer: "Salon77",
  });
  if (error || !data)
    return {
      error:
        "Баталгаажуулах аппыг холбож чадсангүй. Хуудсыг дахин ачаалж оролдоно уу.",
    };
  return { qr: data.totp.qr_code, secret: data.totp.secret, factorId: data.id };
}
export async function verifyCode(_state: State, form: FormData): Promise<State> {
  const session = await platformSession();
  if (!session) return { error: denied };
  const code = z
    .string()
    .regex(/^\d{6}$/)
    .safeParse(String(form.get("code") ?? "").replace(/\s/g, ""));
  if (!code.success) return { error: "6 оронтой кодоо оруулна уу." };
  try {
    // Five tries per five minutes, on top of Supabase's own limit.
    await hit(db, `platform-mfa:${session.id}`, 5, 300);
  } catch (e) {
    if (e instanceof HttpError) return { error: e.message };
    throw e;
  }
  const client = await supabase();
  const { data: factors } = await client.auth.mfa.listFactors();
  const enrolling = String(form.get("factorId") ?? "");
  // A verified factor wins; the pending one counts only on first setup.
  const factorId =
    factors?.totp[0]?.id ??
    factors?.all.find((f) => f.id === enrolling && f.factor_type === "totp")
      ?.id;
  if (!factorId)
    return { error: "Баталгаажуулах апп олдсонгүй. Хуудсыг дахин ачаална уу." };
  const { error } = await client.auth.mfa.challengeAndVerify({
    factorId,
    code: code.data,
  });
  if (error)
    return {
      error:
        "Код буруу эсвэл хугацаа нь дууссан байна. Апп дээрх шинэ кодыг оруулна уу.",
    };
  redirect("/platform");
}
