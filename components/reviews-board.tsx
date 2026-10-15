"use client";
import { useState } from "react";
import { Eye, EyeOff, MessageSquareText, Star } from "lucide-react";
import type { ReviewList } from "@/lib/services/reviews";
import { requestJson } from "@/lib/client-request";
import { formatTimeAgo, userFacingError } from "@/lib/ui-language";
import { Stars } from "./manage-visit";
// Guest ratings: the overall picture first, then each review.
export function ReviewsBoard({
  initial,
  owner,
}: {
  initial: ReviewList;
  owner: boolean;
}) {
  const [reviews, setReviews] = useState(initial),
    [error, setError] = useState("");
  const shown = reviews.filter((r) => !r.hidden),
    average = shown.length
      ? shown.reduce((sum, r) => sum + r.rating, 0) / shown.length
      : 0;
  async function toggle(id: string, hidden: boolean) {
    setError("");
    try {
      await requestJson(`/api/reviews?id=${encodeURIComponent(id)}`, "PATCH", {
        hidden,
      });
      setReviews(reviews.map((r) => (r.id === id ? { ...r, hidden } : r)));
    } catch (e) {
      setError(userFacingError(e, "Өөрчилж чадсангүй."));
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ЗАХИАЛГА</div>
          <h1>
            Сэтгэгдлүүд<span className="heading-dot">.</span>
          </h1>
          <p>
            Үйлчлүүлэгчид захиалгын линкээрээ үйлчилгээ авсны дараа үнэлгээ
            үлдээнэ.
          </p>
        </div>
      </div>
      {error && (
        <div role="alert" className="error-message">
          {error}
        </div>
      )}
      {reviews.length ? (
        <>
          <section className="panel reviews-summary">
            <div className="reviews-score">
              <strong>{average.toFixed(1)}</strong>
              <Stars value={Math.round(average)} />
              <span>{shown.length} үнэлгээ</span>
            </div>
            <ul className="reviews-bars">
              {[5, 4, 3, 2, 1].map((n) => {
                const count = shown.filter((r) => r.rating === n).length;
                return (
                  <li key={n}>
                    <span>
                      {n} <Star size={11} />
                    </span>
                    <i>
                      <b
                        style={{
                          width: `${shown.length ? (count / shown.length) * 100 : 0}%`,
                        }}
                      />
                    </i>
                    <small>{count}</small>
                  </li>
                );
              })}
            </ul>
          </section>
          <ul className="reviews-list">
            {reviews.map((r) => (
              <li key={r.id} className={r.hidden ? "is-hidden" : ""}>
                <div className="reviews-head">
                  <span className="customer-avatar tone-violet">
                    {(r.customerName[0] ?? "?").toUpperCase()}
                  </span>
                  <div>
                    <strong>{r.customerName}</strong>
                    <small>
                      {r.serviceName} · {r.staffName} ·{" "}
                      {formatTimeAgo(r.createdAt)}
                    </small>
                  </div>
                  <Stars value={r.rating} />
                </div>
                {r.comment ? (
                  <p>{r.comment}</p>
                ) : (
                  <p className="muted-text">Сэтгэгдэл бичээгүй.</p>
                )}
                <div className="reviews-foot">
                  <small>{r.customerPhone}</small>
                  {r.hidden && <em>Захиалгын хуудсанд харагдахгүй</em>}
                  {owner && (
                    <button
                      type="button"
                      onClick={() => toggle(r.id, !r.hidden)}
                    >
                      {r.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                      {r.hidden ? "Харуулах" : "Нуух"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <section className="panel empty-page">
          <div className="empty-page-icon">
            <MessageSquareText size={27} />
          </div>
          <h2>Одоогоор сэтгэгдэл алга</h2>
          <p>
            Онлайнаар захиалсан үйлчлүүлэгч үйлчилгээ авсны дараа «Захиалгаа
            удирдах» линкээрээ үнэлгээ өгнө. Захиалгыг «Дууссан» болгосны дараа
            үнэлгээ өгөх боломж нээгдэнэ.
          </p>
        </section>
      )}
    </>
  );
}
