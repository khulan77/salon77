"use client";
import { useActionState, useEffect, useState } from "react";
import { ArrowRight, KeyRound } from "lucide-react";
import { AuthShell, Messages } from "./auth-form";
import { startEnrollment, verifyCode } from "@/app/platform-verify/actions";
import { signOut } from "@/app/auth/actions";
import { PLATFORM_MFA_HOURS } from "@/lib/platform-access";
type Setup = { qr: string; secret: string; factorId: string };
// Enrol an authenticator app on first visit, then ask for its code.
export function PlatformVerify({ enrolled }: { enrolled: boolean }) {
  const [state, action, pending] = useActionState(verifyCode, {});
  const [setup, setSetup] = useState<Setup | null>(null);
  const [setupError, setSetupError] = useState("");
  useEffect(() => {
    if (enrolled) return;
    startEnrollment().then((r) =>
      "error" in r ? setSetupError(r.error) : setSetup(r),
    );
  }, [enrolled]);
  return (
    <AuthShell>
      <div className="ax-form">
        <span className="ax-eyebrow">Платформ · Хоёр шаттай хамгаалалт</span>
        <h2>
          {enrolled ? "Кодоо оруулна уу" : "Баталгаажуулах апп холбох"}
          <span>.</span>
        </h2>
        {enrolled ? (
          <p className="ax-lead">
            Google Authenticator зэрэг апп дээрх Salon77-ийн 6 оронтой кодыг
            оруулна уу. Код {PLATFORM_MFA_HOURS} цаг тутам дахин асуугдана.
          </p>
        ) : (
          <>
            <p className="ax-lead">
              Утсан дээрээ Google Authenticator эсвэл Microsoft Authenticator
              аппыг нээгээд доорх QR кодыг уншуулна уу. Дараа нь апп дээр гарсан
              6 оронтой кодыг оруулна.
            </p>
            {setup ? (
              <div className="ax-mfa-setup">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={setup.qr} alt="Баталгаажуулах аппад уншуулах QR код" />
                <small>
                  QR уншихгүй бол энэ түлхүүрийг гараар оруулна уу:
                  <code>{setup.secret}</code>
                </small>
              </div>
            ) : (
              !setupError && <p role="status">QR код бэлдэж байна…</p>
            )}
          </>
        )}
        <Messages state={setupError ? { error: setupError } : state} />
        <form action={action}>
          {setup && (
            <input type="hidden" name="factorId" value={setup.factorId} />
          )}
          <div className="ax-field">
            <label htmlFor="ax-code">6 оронтой код</label>
            <span className="ax-input">
              <KeyRound size={18} aria-hidden="true" />
              <input
                id="ax-code"
                name="code"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]{6,7}"
                maxLength={7}
                placeholder="123456"
                autoFocus
              />
            </span>
          </div>
          <button
            type="submit"
            className="ax-submit"
            disabled={pending || (!enrolled && !setup)}
          >
            {pending ? "Шалгаж байна…" : "Баталгаажуулах"}
            <ArrowRight size={18} />
          </button>
        </form>
        <form action={signOut}>
          <button type="submit" className="ax-link-button">
            Гарах
          </button>
        </form>
      </div>
    </AuthShell>
  );
}
