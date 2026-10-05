"use client";
import {
  localizeInvalidField,
  clearFieldValidity,
} from "@/lib/form-validation";
import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { authenticate } from "@/app/auth/actions";
import { Button } from "./ui/button";
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
  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <Link className="brand" href="/">
          <span className="brand-symbol">
            s<span>·</span>
          </span>
          <span>
            salon<span className="brand-number">77</span>
            <span className="brand-dot">.</span>
          </span>
        </Link>
        <div>
          <h1>
            Та үйлчлүүлэгчдээ халамжил.
            <br />
            Бид ажлыг тань хөнгөвчилье.
          </h1>
          <p>Салоныхоо ажлыг нэг дороос, илүү хялбараар удирдаарай.</p>
        </div>
        <span className="auth-decoration">✳</span>
        <small>ТАНЫ САЛОН. ТАНЫ БАГ. ТАНЫ БОЛОМЖ.</small>
      </aside>
      <main className="auth-main">
        <div className="auth-form">
          <div className="eyebrow">ШИНЭ БОЛОМЖИЙН ЭХЛЭЛ</div>
          <h1>{signup ? "Salon77-д нэгдээрэй." : "Тавтай морил."}</h1>
          <p>
            {signup
              ? "Бүртгэлээ үүсгээд салоныхоо ажлыг цэгцлээрэй."
              : "Salon77 бүртгэлдээ нэвтэрнэ үү."}
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
              <label className="field">
                Таны нэр
                <input
                  name="name"
                  required
                  maxLength={100}
                  autoComplete="name"
                  placeholder="Овог, нэр"
                />
              </label>
            )}
            <label className="field">
              Имэйл хаяг
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@your-salon.com"
              />
            </label>
            <label className="field">
              Нууц үг
              <input
                name="password"
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete={signup ? "new-password" : "current-password"}
                placeholder="Доод тал нь 8 тэмдэгт"
              />
            </label>
            <Button disabled={pending || !configured}>
              {pending ? "Түр хүлээнэ үү…" : signup ? "Бүртгүүлэх" : "Нэвтрэх"}
              <ArrowRight size={15} />
            </Button>
          </form>
          <div className="auth-switch">
            {signup ? "Бүртгэлтэй юу?" : "Salon77-д шинээр нэгдэх үү?"}{" "}
            <Link
              href={`${signup ? "/sign-in" : "/sign-up"}?next=${encodeURIComponent(next)}`}
            >
              {signup ? "Нэвтрэх" : "Бүртгүүлэх"}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
