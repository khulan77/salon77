"use client";
import { useState } from "react";
import { CheckCircle2, Clock3, Send } from "lucide-react";
import {
  FEEDBACK_KINDS,
  feedbackKinds,
  type FeedbackKind,
} from "@/lib/feedback";
import type { OwnFeedback } from "@/lib/services/feedback";
import { requestJson } from "@/lib/client-request";
import { formatTimeAgo, userFacingError } from "@/lib/ui-language";
import {
  localizeInvalidField,
  clearFieldValidity,
} from "@/lib/form-validation";
import { Button } from "./ui/button";
const hints: Record<FeedbackKind, string> = {
  BUG: "Аль хуудсанд, юу хийх үед, юу болсныг бичнэ үү.",
  SUGGESTION: "Ямар боломж нэмбэл ажил тань хөнгөрөхийг бичнэ үү.",
  QUESTION: "Юуг яаж хийхээ мэдэхгүй байгаагаа бичнэ үү.",
};
// Where a salon writes to the Salon77 team and reads the answers.
export function SupportDesk({
  preview,
  initial,
}: {
  preview: boolean;
  initial: OwnFeedback;
}) {
  const [items, setItems] = useState(initial);
  const [kind, setKind] = useState<FeedbackKind>("BUG");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSent(false);
    if (preview) return setError("Хүсэлт илгээхийн тулд нэвтэрнэ үү.");
    setPending(true);
    try {
      setItems(
        await requestJson<OwnFeedback>("/api/feedback", "POST", {
          kind,
          message,
        }),
      );
      setMessage("");
      setSent(true);
    } catch (e) {
      setError(
        userFacingError(e, "Хүсэлт илгээж чадсангүй. Дахин оролдоно уу."),
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ХОЛБОО БАРИХ</div>
          <h1>
            Санал хүсэлт<span className="heading-dot">.</span>
          </h1>
          <p>
            Алдаа гарсан, засах зүйл байгаа эсвэл шинэ боломж хэрэгтэй бол
            бидэнд бичээрэй.
          </p>
        </div>
      </div>
      <section className="panel support-form" aria-labelledby="support-new">
        <h2 id="support-new">Шинэ хүсэлт</h2>
        <form
          onSubmit={submit}
          onInvalidCapture={localizeInvalidField}
          onInputCapture={clearFieldValidity}
        >
          <div className="segmented" role="group" aria-label="Хүсэлтийн төрөл">
            {feedbackKinds.map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
              >
                {FEEDBACK_KINDS[k]}
              </button>
            ))}
          </div>
          <label className="field">
            Хүсэлт
            <textarea
              required
              minLength={5}
              maxLength={2000}
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={hints[kind]}
            />
          </label>
          {error && (
            <div role="alert" className="error-message">
              {error}
            </div>
          )}
          {sent && (
            <div role="status" className="notice">
              Хүсэлтийг тань хүлээн авлаа. Хариуг энэ хуудаснаас харна уу.
            </div>
          )}
          <div className="form-actions">
            <Button disabled={pending}>
              <Send size={14} /> {pending ? "Илгээж байна…" : "Илгээх"}
            </Button>
          </div>
        </form>
      </section>
      <section className="panel" aria-labelledby="support-sent">
        <h2 id="support-sent" className="support-title">
          Илгээсэн хүсэлтүүд <span>{items.length}</span>
        </h2>
        {items.length ? (
          <ul className="support-list">
            {items.map((f) => (
              <li key={f.id}>
                <div className="support-meta">
                  <span className="service-tag">
                    {FEEDBACK_KINDS[f.kind as FeedbackKind]}
                  </span>
                  <span
                    className={`support-status ${f.status === "DONE" ? "done" : ""}`}
                  >
                    {f.status === "DONE" ? (
                      <CheckCircle2 size={13} />
                    ) : (
                      <Clock3 size={13} />
                    )}
                    {f.status === "DONE" ? "Шийдвэрлэсэн" : "Хүлээгдэж байна"}
                  </span>
                  <small>
                    {f.author && `${f.author} · `}
                    {formatTimeAgo(f.createdAt)}
                  </small>
                </div>
                <p>{f.message}</p>
                {f.reply && (
                  <blockquote>
                    <span>Хариу</span>
                    {f.reply}
                  </blockquote>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="support-empty">Одоогоор илгээсэн хүсэлт алга.</p>
        )}
      </section>
    </>
  );
}
