import Link from "next/link";
import { db } from "@/lib/db";
import { platformAdminId } from "@/lib/auth";
import { listFeedback } from "@/lib/services/feedback";
import { FEEDBACK_KINDS, type FeedbackKind } from "@/lib/feedback";
import { FeedbackAnswer } from "@/components/platform/feedback-answer";
import { formatTimeAgo } from "@/lib/ui-language";
export default async function PlatformFeedback() {
  const adminId = await platformAdminId();
  const items = await listFeedback(db, adminId);
  const open = items.filter((f) => f.status === "OPEN").length;
  return (
    <>
      <div className="pf-heading">
        <h1>Санал хүсэлт</h1>
        <p>
          Салонуудаас ирсэн алдаа, санал, асуулт. {open} нь хариу хүлээж байна.
        </p>
      </div>
      {items.length ? (
        items.map((f) => (
          <section
            key={f.id}
            className={`pf-panel pf-feedback ${f.status === "DONE" ? "done" : ""}`}
          >
            <div className="pf-panel-head">
              <h2>
                <Link href={`/platform/salons/${f.salonId}`}>
                  {f.salonName}
                </Link>
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
        <section className="pf-panel">
          <p className="pf-note">Одоогоор санал хүсэлт ирээгүй байна.</p>
        </section>
      )}
    </>
  );
}
