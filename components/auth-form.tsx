"use client";
import "@fontsource-variable/source-serif-4";
import "@/app/auth.css";
import {
  localizeInvalidField,
  clearFieldValidity,
} from "@/lib/form-validation";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Logo } from "./logo";
import {
  ArrowRight,
  ArrowUpRight,
  AtSign,
  Eye,
  EyeOff,
  Lock,
  UserRound,
} from "lucide-react";
import {
  authenticate,
  requestPasswordReset,
  updatePassword,
} from "@/app/auth/actions";
export function AuthForm({
  signup,
  configured,
  next = "/",
}: {
  signup: boolean;
  configured: boolean;
  next?: string;
}) {
  const [state, action, pending] = useActionState(authenticate, {});
  const [shown, setShown] = useState(false);
  return (
    <AuthShell>
      <div className="ax-form">
        <span className="ax-eyebrow">Шинэ боломжийн эхлэл</span>
        <h2>
          {signup ? "Salon77-д нэгдээрэй" : "Тавтай морил"}
          <span>.</span>
        </h2>
        <p className="ax-lead">
          {signup
            ? "Бүртгэлээ үүсгээд салоныхоо ажлыг цэгцлээрэй."
            : "Salon77 бүртгэлдээ нэвтэрч салоныхоо үйл ажиллагааг удирдана уу."}
        </p>
        {!configured && (
          <div className="notice">
            Нэвтрэхийн тулд системийн холболтыг тохируулах шаардлагатай.
            Одоогоор <Link href="/">танилцах горимыг үзэх</Link> боломжтой.
          </div>
        )}
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
        <form
          onInvalidCapture={localizeInvalidField}
          onInputCapture={clearFieldValidity}
          action={action}
        >
          <input type="hidden" name="next" value={next} />
          <input
            type="hidden"
            name="mode"
            value={signup ? "sign-up" : "sign-in"}
          />
          {signup && (
            <div className="ax-field">
              <label htmlFor="ax-name">Таны нэр</label>
              <span className="ax-input">
                <UserRound size={18} aria-hidden="true" />
                <input
                  id="ax-name"
                  name="name"
                  required
                  maxLength={100}
                  autoComplete="name"
                  placeholder="Овог, нэр"
                />
              </span>
            </div>
          )}
          <div className="ax-field">
            <label htmlFor="ax-email">Имэйл хаяг</label>
            <span className="ax-input">
              <AtSign size={18} aria-hidden="true" />
              <input
                id="ax-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@your-salon.com"
              />
            </span>
          </div>
          <div className="ax-field">
            <span className="ax-label-row">
              <label htmlFor="ax-password">Нууц үг</label>
              {!signup && (
                <Link href="/forgot-password" className="ax-forgot">
                  Нууц үгээ мартсан уу?
                </Link>
              )}
            </span>
            <span className="ax-input">
              <Lock size={18} aria-hidden="true" />
              <input
                id="ax-password"
                name="password"
                type={shown ? "text" : "password"}
                required
                minLength={8}
                maxLength={128}
                autoComplete={signup ? "new-password" : "current-password"}
                placeholder="Доод тал нь 8 тэмдэгт"
              />
              <button
                type="button"
                className="ax-eye"
                aria-label={shown ? "Нууц үгийг нуух" : "Нууц үгийг харуулах"}
                aria-pressed={shown}
                onClick={() => setShown(!shown)}
              >
                {shown ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </div>
          <button
            type="submit"
            className="ax-submit"
            disabled={pending || !configured}
          >
            {pending ? "Түр хүлээнэ үү…" : signup ? "Бүртгүүлэх" : "Нэвтрэх"}
            <ArrowRight size={18} />
          </button>
        </form>
        <div className="ax-switch">
          {signup ? "Бүртгэлтэй юу?" : "Salon77-д шинээр нэгдэх үү?"}{" "}
          <Link
            href={`${signup ? "/sign-in" : "/sign-up"}?next=${encodeURIComponent(next)}`}
          >
            {signup ? "Нэвтрэх" : "Бүртгүүлэх"}
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
// The obsidian panel with the logo and headline, and the white form side.
function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="ax">
      <aside className="ax-aside">
        <Logo href="/" size="lg" tone="light" className="ax-brand" />
        <div className="ax-copy">
          <h1>
            Та үйлчлүүлэгчдээ <em>халамжил.</em>
            <br />
            Бид ажлыг тань <u>хөнгөвчилье.</u>
          </h1>
        </div>
      </aside>
      <main className="ax-main">
        <div className="ax-help">
          Асуух зүйл байна уу?{" "}
          <Link href="/business#faq">
            Тусламж <ArrowUpRight size={15} />
          </Link>
        </div>
        {children}
        <footer className="ax-legal">
          © {new Date().getFullYear()} Salon77. Бүх эрх хуулиар хамгаалагдсан.
        </footer>
      </main>
    </div>
  );
}
function Messages({ state }: { state: { error?: string; success?: string } }) {
  return (
    <>
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
    </>
  );
}
// Step 1: the email that gets a recovery link.
export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, {});
  return (
    <AuthShell>
      <div className="ax-form">
        <span className="ax-eyebrow">Нууц үг сэргээх</span>
        <h2>
          Нууц үгээ мартсан уу<span>?</span>
        </h2>
        <p className="ax-lead">
          Бүртгэлтэй имэйлээ оруулбал шинэ нууц үг тохируулах холбоос илгээнэ.
        </p>
        <Messages state={state} />
        <form
          onInvalidCapture={localizeInvalidField}
          onInputCapture={clearFieldValidity}
          action={action}
        >
          <div className="ax-field">
            <label htmlFor="ax-email">Имэйл хаяг</label>
            <span className="ax-input">
              <AtSign size={18} aria-hidden="true" />
              <input
                id="ax-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@your-salon.com"
              />
            </span>
          </div>
          <button type="submit" className="ax-submit" disabled={pending}>
            {pending ? "Түр хүлээнэ үү…" : "Холбоос илгээх"}
            <ArrowRight size={18} />
          </button>
        </form>
        <div className="ax-switch">
          Нууц үгээ санасан уу? <Link href="/sign-in">Нэвтрэх</Link>
        </div>
      </div>
    </AuthShell>
  );
}
// Step 2: reached from the recovery link, already signed in.
export function ResetPasswordForm({ signedIn }: { signedIn: boolean }) {
  const [state, action, pending] = useActionState(updatePassword, {});
  const [shown, setShown] = useState(false);
  return (
    <AuthShell>
      <div className="ax-form">
        <span className="ax-eyebrow">Нууц үг сэргээх</span>
        <h2>
          Шинэ нууц үг<span>.</span>
        </h2>
        {signedIn ? (
          <>
            <p className="ax-lead">
              Доод тал нь 8 тэмдэгттэй шинэ нууц үгээ оруулна уу.
            </p>
            <Messages state={state} />
            <form
              onInvalidCapture={localizeInvalidField}
              onInputCapture={clearFieldValidity}
              action={action}
            >
              {(["password", "confirm"] as const).map((name) => (
                <div className="ax-field" key={name}>
                  <label htmlFor={`ax-${name}`}>
                    {name === "password" ? "Шинэ нууц үг" : "Нууц үгээ давтах"}
                  </label>
                  <span className="ax-input">
                    <Lock size={18} aria-hidden="true" />
                    <input
                      id={`ax-${name}`}
                      name={name}
                      type={shown ? "text" : "password"}
                      required
                      minLength={8}
                      maxLength={128}
                      autoComplete="new-password"
                      placeholder="Доод тал нь 8 тэмдэгт"
                    />
                    {name === "password" && (
                      <button
                        type="button"
                        className="ax-eye"
                        aria-label={
                          shown ? "Нууц үгийг нуух" : "Нууц үгийг харуулах"
                        }
                        aria-pressed={shown}
                        onClick={() => setShown(!shown)}
                      >
                        {shown ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    )}
                  </span>
                </div>
              ))}
              <button type="submit" className="ax-submit" disabled={pending}>
                {pending ? "Түр хүлээнэ үү…" : "Нууц үг хадгалах"}
                <ArrowRight size={18} />
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="ax-lead">
              Холбоосын хугацаа дууссан эсвэл буруу байна. Нууц үг сэргээх
              холбоосыг дахин авна уу.
            </p>
            <Link href="/forgot-password" className="ax-submit">
              Холбоос дахин авах <ArrowRight size={18} />
            </Link>
          </>
        )}
      </div>
    </AuthShell>
  );
}
