"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound, LogIn } from "lucide-react";
import { Button } from "./ui/button";
import { userFacingError, roleLabel } from "@/lib/ui-language";
import { localStamp } from "@/lib/business-time";
import {
  localizeInvalidField,
  clearFieldValidity,
} from "@/lib/form-validation";
import { joinInvitation, switchAccount } from "@/app/invite/actions";
type Invitation = {
  salonName: string;
  name: string;
  email: string;
  role: string;
  branches: string[];
  expiresAt: string;
  hasAccount: boolean;
};
export function InvitationAccept({
  token,
  invitation,
  error,
  signedInEmail = null,
}: {
  token: string;
  invitation?: Invitation;
  error?: string;
  signedInEmail?: string | null;
}) {
  return (
    <main className="onboarding-container invite-page">
      <section className="onboarding-card">
        <div className="eyebrow">SALON77</div>
        <h1>Багт нэгдэх урилга</h1>
        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}
        {invitation && (
          <>
            <dl className="invite-summary">
              <div>
                <dt>Салон</dt>
                <dd>{invitation.salonName}</dd>
              </div>
              <div>
                <dt>Эрх</dt>
                <dd>{roleLabel(invitation.role)}</dd>
              </div>
              <div>
                <dt>Салбар</dt>
                <dd>{invitation.branches.join(", ")}</dd>
              </div>
              <div>
                <dt>Хүчинтэй</dt>
                <dd>
                  {localStamp(invitation.expiresAt)
                    .slice(0, 10)
                    .replace(/-/g, ".")}{" "}
                  хүртэл
                </dd>
              </div>
            </dl>
            {signedInEmail ? (
              signedInEmail.toLowerCase() === invitation.email.toLowerCase() ? (
                <SignedInJoin token={token} />
              ) : (
                <form action={switchAccount}>
                  <input type="hidden" name="token" value={token} />
                  <div className="error-message" role="alert">
                    Та {signedInEmail} хаягаар нэвтэрсэн байна. Энэ урилга{" "}
                    {invitation.email} хаягт зориулагдсан.
                  </div>
                  <Button className="invite-submit" variant="outline">
                    Гараад {invitation.email} хаягаар үргэлжлүүлэх
                  </Button>
                </form>
              )
            ) : (
              <JoinForm token={token} invitation={invitation} />
            )}
          </>
        )}
        <p className="invite-back">
          <Link href="/sign-in">Нэвтрэх хуудас руу очих</Link>
        </p>
      </section>
    </main>
  );
}
function JoinForm({
  token,
  invitation,
}: {
  token: string;
  invitation: Invitation;
}) {
  const [state, action, pending] = useActionState(joinInvitation, {});
  const [chosen, setChosen] = useState<"sign-up" | "sign-in">(
    invitation.hasAccount ? "sign-in" : "sign-up",
  );
  // The server may switch modes, e.g. when the email turns out to be registered.
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    if (state.mode) setChosen(state.mode);
  }
  const signIn = chosen === "sign-in";
  return (
    <form
      className="invite-form"
      action={action}
      onInvalidCapture={localizeInvalidField}
      onInputCapture={clearFieldValidity}
    >
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="mode" value={chosen} />
      <div className="notice invite-password-note">
        <KeyRound size={15} aria-hidden />
        {signIn ? (
          <span>
            Энэ имэйлээр Salon77 бүртгэл байна. Өөрийн одоогийн нууц үгээрээ
            нэвтэрч нэгдэнэ.
          </span>
        ) : (
          <span>
            <strong>Нууц үгээ та өөрөө үүсгэнэ.</strong> Салоны админ ч, өөр хэн
            ч таны нууц үгийг урьдчилж үүсгээгүй бөгөөд мэдэхгүй.
          </span>
        )}
      </div>
      {state.error && (
        <div className="error-message" role="alert">
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="success-message" role="status">
          {state.success}
        </div>
      )}
      <label className="field">
        Имэйл
        <input
          value={invitation.email}
          readOnly
          aria-readonly
          autoComplete="email"
          title="Имэйлийг урилгаас авсан тул өөрчлөх боломжгүй."
        />
        <small>Урилгаас авсан тул өөрчлөх боломжгүй.</small>
      </label>
      {!signIn && (
        <label className="field">
          Таны нэр
          <input
            name="name"
            required
            maxLength={100}
            autoComplete="name"
            defaultValue={invitation.name}
          />
        </label>
      )}
      <label className="field">
        {signIn ? "Нууц үг" : "Шинэ нууц үг"}
        <input
          name="password"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete={signIn ? "current-password" : "new-password"}
          placeholder="Доод тал нь 8 тэмдэгт"
        />
      </label>
      {!signIn && (
        <label className="field">
          Нууц үгээ давтах
          <input
            name="confirm"
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
          />
        </label>
      )}
      <Button className="invite-submit" disabled={pending}>
        {signIn ? <LogIn size={15} /> : <CheckCircle2 size={15} />}
        {pending ? "Түр хүлээнэ үү…" : signIn ? "Нэвтэрч нэгдэх" : "Нэгдэх"}
      </Button>
      <p className="auth-switch">
        {signIn ? "Salon77 бүртгэлгүй юу?" : "Salon77-д бүртгэлтэй юу?"}{" "}
        <button
          type="button"
          className="link-button"
          onClick={() => setChosen(signIn ? "sign-up" : "sign-in")}
        >
          {signIn ? "Шинээр нэгдэх" : "Нэвтэрч нэгдэх"}
        </button>
      </p>
    </form>
  );
}
function SignedInJoin({ token }: { token: string }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  async function accept() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      router.replace(result.redirectTo);
      router.refresh();
    } catch (e) {
      setError(
        userFacingError(e, "Урилга хүлээн авч чадсангүй. Дахин оролдоно уу."),
      );
      setPending(false);
    }
  }
  return (
    <>
      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}
      <p className="invite-lead">Та урилгын имэйлээр нэвтэрсэн байна.</p>
      <Button className="invite-submit" disabled={pending} onClick={accept}>
        <CheckCircle2 size={16} />
        {pending ? "Түр хүлээнэ үү…" : "Нэгдэх"}
      </Button>
    </>
  );
}
