import Link from "next/link";
import { db } from "@/lib/db";
import { platformAdminId } from "@/lib/auth";
import { listFeedback, markFeedbackRead } from "@/lib/services/feedback";
import { FEEDBACK_KINDS, type FeedbackKind } from "@/lib/feedback";
import { FeedbackAnswer } from "@/components/platform/feedback-answer";
import { formatTimeAgo } from "@/lib/ui-language";
const filters = [
  ["all", "Бүгд"],
  ["new", "Шинэ"],
  ["open", "Хүлээгдэж буй"],
  ["done", "Шийдвэрлэсэн"],
] as const;
type Filter = (typeof filters)[number][0];
export default async function PlatformFeedback({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const adminId = await platformAdminId();
  const requested = (await searchParams).show;
  const show: Filter = filters.some(([v]) => v === requested)
    ? (requested as Filter)
    : "all";
  const items = await listFeedback(db, adminId);
  // Shown once as new, then counted as read.
  await markFeedbackRead(
    db,
    adminId,
    items.filter((f) => f.unread).map((f) => f.id),
  );
  const counts: Record<Filter, number> = {
    all: items.length,
    new: items.filter((f) => f.unread).length,
    open: items.filter((f) => f.status === "OPEN").length,
    done: items.filter((f) => f.status === "DONE").length,
  };
  const shown = items.filter((f) =>
    show === "new"
      ? f.unread
      : show === "open"
        ? f.status === "OPEN"
        : show === "done"
          ? f.status === "DONE"
          : true,
  );
  return (
    <>
      <div className="pf-heading">
        <h1>Санал хүсэлт</h1>
        <p>
          Салонуудаас ирсэн алдаа, санал, асуулт. {counts.new} шинэ,{" "}
          {counts.open} нь хариу хүлээж байна.
        </p>
      </div>
      <nav className="pf-chips" aria-label="Санал хүсэлт шүүх">
        {filters.map(([value, text]) => (
          <Link
            key={value}
            href={value === "all" ? "/platform/feedback" : `?show=${value}`}
            aria-current={show === value ? "true" : undefined}
          >
            {text} <span>{counts[value]}</span>
          </Link>
        ))}
      </nav>
      {shown.length ? (
        shown.map((f) => (
          <section
            key={f.id}
            className={`pf-panel pf-feedback ${f.status === "DONE" ? "done" : ""} ${f.unread ? "unread" : ""}`}
          >
            <div className="pf-panel-head">
              <h2>
                <Link href={`/platform/salons/${f.salonId}`}>
                  {f.salonName}
                </Link>
                {f.unread && <em className="pf-badge new">Шинэ</em>}
                <em
                  className={`pf-badge ${f.status === "DONE" ? "ok" : "wait"}`}
                >
                  {f.status === "DONE" ? "Шийдвэрлэсэн" : "Хүлээгдэж буй"}
                </em>
                <em className="pf-badge plain">
                  {FEEDBACK_KINDS[f.kind as FeedbackKind]}
                </em>
              </h2>
              <small>
                {f.authorName || f.authorEmail} · {f.authorEmail} · Утас{" "}
                {f.salonPhone} · {formatTimeAgo(f.createdAt)}
              </small>
            </div>
            <p className="pf-message">{f.message}</p>
            <FeedbackAnswer id={f.id} status={f.status} reply={f.reply} />
          </section>
        ))
      ) : (
        <section className="pf-panel pf-empty-state">
          <p className="pf-note">
            {items.length
              ? "Энэ шүүлтүүрт тохирох санал хүсэлт алга."
              : "Одоогоор санал хүсэлт ирээгүй байна. Салонууд удирдлагын «Санал хүсэлт» хэсгээс илгээхэд энд харагдана."}
          </p>
          {show !== "all" && (
            <Link href="/platform/feedback">Бүгдийг харах</Link>
          )}
        </section>
      )}
    </>
  );
}
