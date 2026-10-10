"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { userFacingError } from "@/lib/ui-language";
// Approve a salon's application or send it back with a reason.
export function ReviewAction({
  id,
  name,
  status,
}: {
  id: string;
  name: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  async function send(body: object) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/platform/salons?id=${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error);
      setRejecting(false);
      setNote("");
      router.refresh();
    } catch (e) {
      setError(userFacingError(e, "Шийдвэрийг хадгалж чадсангүй."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="pf-review">
      {rejecting ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send({ decision: "REJECT", note });
          }}
        >
          <label>
            Буцаах шалтгаан
            <textarea
              required
              minLength={3}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Салоны эзэн энэ тайлбарыг уншаад мэдээллээ засна"
            />
          </label>
          <div>
            <button
              type="button"
              className="pf-plain"
              disabled={busy}
              onClick={() => setRejecting(false)}
            >
              Болих
            </button>
            <button type="submit" className="pf-danger" disabled={busy}>
              {busy ? "Хадгалж байна…" : "Шалтгаантай буцаах"}
            </button>
          </div>
        </form>
      ) : (
        <div>
          {status !== "REJECTED" && (
            <button
              type="button"
              className="pf-danger"
              disabled={busy}
              onClick={() => setRejecting(true)}
            >
              {status === "APPROVED" ? "Зөвшөөрлийг цуцлах" : "Буцаах"}
            </button>
          )}
          {status !== "APPROVED" && (
            <button
              type="button"
              className="pf-primary"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    `«${name}» салоныг зөвшөөрөх үү? Салон нийтэд харагдаж, онлайн захиалга авч эхэлнэ.`,
                  )
                )
                  send({ decision: "APPROVE" });
              }}
            >
              {busy ? "Хадгалж байна…" : "Зөвшөөрөх"}
            </button>
          )}
        </div>
      )}
      {error && (
        <p className="pf-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
