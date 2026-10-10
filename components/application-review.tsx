"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BadgeCheck, Hourglass, Undo2 } from "lucide-react";
import { userFacingError } from "@/lib/ui-language";
import {
  localizeInvalidField,
  clearFieldValidity,
} from "@/lib/form-validation";
import { hasSocial, socialRequired } from "@/lib/salon-application";
import type { Application } from "@/lib/services/application";
import { Button } from "./ui/button";
import { ApplicationFields } from "./application-fields";
// The owner's view of the platform's decision, with the form to correct the
// application and send it again.
export function ApplicationReview({ initial }: { initial: Application }) {
  const router = useRouter();
  const [application, setApplication] = useState(initial);
  const [data, setData] = useState({
    name: initial.name,
    phone: initial.phone,
    description: initial.description,
    instagram: initial.instagram,
    facebook: initial.facebook,
    serviceTypes: initial.serviceTypes,
    staffCount: initial.staffCount ? String(initial.staffCount) : "",
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const status = application.status;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSent(false);
    if (!hasSocial(data)) return setError(socialRequired);
    if (!data.serviceTypes.length)
      return setError("Үйлчилгээний төрлөөс дор хаяж нэгийг сонгоно уу.");
    setPending(true);
    try {
      const response = await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, staffCount: Number(data.staffCount) }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error);
      setApplication(body);
      setSent(true);
      router.refresh();
    } catch (e) {
      setError(
        userFacingError(e, "Хүсэлт илгээж чадсангүй. Дахин оролдоно уу."),
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="onboarding-page">
      <header className="onboarding-header">
        <Link href="/" className="brand">
          <span className="brand-symbol">
            s<span>·</span>
          </span>
          <span>
            salon<span className="brand-number">77</span>
            <span className="brand-dot">.</span>
          </span>
        </Link>
        <Link href="/">Удирдлагын хэсэгт буцах ↗</Link>
      </header>
      <main className="onboarding-container">
        <section className="onboarding-card">
          <div className={`review-state ${status.toLowerCase()}`}>
            {status === "APPROVED" ? (
              <BadgeCheck size={22} />
            ) : status === "REJECTED" ? (
              <Undo2 size={22} />
            ) : (
              <Hourglass size={22} />
            )}
            <div>
              <strong>
                {status === "APPROVED"
                  ? "Таны салон баталгаажсан"
                  : status === "REJECTED"
                    ? "Хүсэлтийг тань буцаалаа"
                    : "Хүсэлт хянагдаж байна"}
              </strong>
              <p>
                {status === "APPROVED"
                  ? "Салон тань нийтэд харагдаж, онлайн захиалга авч байна."
                  : status === "REJECTED"
                    ? "Доорх шалтгааныг уншаад мэдээллээ засаж, дахин илгээнэ үү."
                    : "Бид мэдээллийг тань шалгаж байна. Баталгаажмагц салон тань нийтэд харагдана."}
              </p>
            </div>
          </div>
          {status === "REJECTED" && application.note && (
            <blockquote className="review-note">
              <span>Буцаасан шалтгаан</span>
              {application.note}
            </blockquote>
          )}
          {status === "APPROVED" ? (
            <Button asChild>
              <Link href="/">
                Удирдлагын хэсэгт орох <ArrowRight size={15} />
              </Link>
            </Button>
          ) : (
            <>
              <h1>
                {status === "REJECTED"
                  ? "Мэдээллээ засаад дахин илгээнэ үү."
                  : "Илгээсэн мэдээлэл"}
              </h1>
              <p>
                {status === "REJECTED"
                  ? "Засвараа хадгалмагц хүсэлт тань дахин хянагдана."
                  : "Буруу бичсэн зүйл байвал засаад дахин илгээж болно."}
              </p>
              {error && (
                <div role="alert" className="error-message">
                  {error}
                </div>
              )}
              {sent && (
                <div role="status" className="notice">
                  Хүсэлтийг тань дахин илгээлээ.
                </div>
              )}
              <form
                onInvalidCapture={localizeInvalidField}
                onInputCapture={clearFieldValidity}
                onSubmit={submit}
              >
                <label className="field">
                  Салоны нэр
                  <input
                    required
                    maxLength={100}
                    value={data.name}
                    onChange={(e) => setData({ ...data, name: e.target.value })}
                  />
                </label>
                <label className="field">
                  Утасны дугаар
                  <input
                    type="tel"
                    required
                    maxLength={30}
                    value={data.phone}
                    onChange={(e) =>
                      setData({ ...data, phone: e.target.value })
                    }
                  />
                </label>
                <ApplicationFields
                  value={data}
                  onChange={(patch) => setData({ ...data, ...patch })}
                />
                <label className="field">
                  Товч танилцуулга · заавал биш
                  <textarea
                    maxLength={1000}
                    value={data.description}
                    onChange={(e) =>
                      setData({ ...data, description: e.target.value })
                    }
                  />
                </label>
                <div className="form-actions">
                  <Button disabled={pending}>
                    {pending ? "Түр хүлээнэ үү…" : "Дахин илгээх"}
                    <ArrowRight size={14} />
                  </Button>
                </div>
              </form>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
