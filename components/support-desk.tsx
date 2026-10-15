"use client";
import { useState } from "react";
import {
  Bug,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Lightbulb,
  MessageSquare,
  Plus,
  Send,
} from "lucide-react";
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
const kindIcons: Record<FeedbackKind, typeof Bug> = {
  BUG: Bug,
  SUGGESTION: Lightbulb,
  QUESTION: CircleHelp,
};
const kindNotes: Record<FeedbackKind, string> = {
  BUG: "Ямар нэг зүйл буруу ажиллаж байна",
  SUGGESTION: "Шинэ боломж, сайжруулалт",
  QUESTION: "Яаж хийхээ мэдэхгүй байна",
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
            бидэнд бичээрэй. Хүсэлт бүрд заавал хариу өгнө.
          </p>
        </div>
      </div>
      <div className="support-layout">
        <section className="panel support-card" aria-labelledby="support-new">
          {sent ? (
            <div className="support-sent" role="status">
              <span className="support-sent-icon">
                <CheckCircle2 size={34} />
              </span>
              <h2 id="support-new">Амжилттай илгээгдлээ!</h2>
              <p>
                Баярлалаа. Бид таны хүсэлтийг уншаад <b>заавал хариу илгээнэ</b>
                . Хариу ирэхэд «Илгээсэн хүсэлтүүд» хэсэгт харагдана.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSent(false)}
              >
                <Plus size={14} /> Шинэ хүсэлт бичих
              </Button>
            </div>
          ) : (
            <form
              onSubmit={submit}
              onInvalidCapture={localizeInvalidField}
              onInputCapture={clearFieldValidity}
            >
              <h2 id="support-new">Шинэ хүсэлт</h2>
              <div
                className="support-kinds"
                role="group"
                aria-label="Хүсэлтийн төрөл"
              >
                {feedbackKinds.map((k) => {
                  const Icon = kindIcons[k];
                  return (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={kind === k}
                      onClick={() => setKind(k)}
                    >
                      <Icon size={18} />
                      <strong>{FEEDBACK_KINDS[k]}</strong>
                      <small>{kindNotes[k]}</small>
                    </button>
                  );
                })}
              </div>
              <label className="field">
                Хүсэлт
                <textarea
                  required
                  minLength={5}
                  maxLength={2000}
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={hints[kind]}
                />
                <small className="support-count">{message.length} / 2000</small>
              </label>
              {error && (
                <div role="alert" className="error-message">
                  {error}
                </div>
              )}
              <div className="support-actions">
                <span>Ихэвчлэн 1 ажлын өдрийн дотор хариулна.</span>
                <Button disabled={pending || message.trim().length < 5}>
                  <Send size={14} /> {pending ? "Илгээж байна…" : "Илгээх"}
                </Button>
              </div>
            </form>
          )}
        </section>
        <section className="panel support-card" aria-labelledby="support-sent">
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
                      {f.status === "DONE"
                        ? "Хариу өгсөн"
                        : "Хариу хүлээж байна"}
                    </span>
                    <small>
                      {f.author && `${f.author} · `}
                      {formatTimeAgo(f.createdAt)}
                    </small>
                  </div>
                  <p>{f.message}</p>
                  {f.reply && (
                    <blockquote>
                      <span>Salon77-ийн хариу</span>
                      {f.reply}
                    </blockquote>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="support-empty">
              <MessageSquare size={26} />
              <p>Одоогоор илгээсэн хүсэлт алга.</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
