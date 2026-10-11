"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { userFacingError } from "@/lib/ui-language";
// The operator's answer to one request; the salon reads it on its own page.
export function FeedbackAnswer({
  id,
  status,
  reply,
}: {
  id: string;
  status: string;
  reply: string;
}) {
  const router = useRouter();
  const [text, setText] = useState(reply);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(next: "OPEN" | "DONE") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/platform/feedback?id=${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next, reply: text }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error);
      router.refresh();
    } catch (e) {
      setError(userFacingError(e, "Хариуг хадгалж чадсангүй."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="pf-review">
      <label>
        Хариу
        <textarea
          maxLength={2000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Салонд харагдах хариугаа бичнэ үү"
        />
      </label>
      <div>
        {status === "DONE" ? (
          <button
            type="button"
            className="pf-plain"
            disabled={busy}
            onClick={() => save("OPEN")}
          >
            Дахин нээх
          </button>
        ) : (
          <button
            type="button"
            className="pf-plain"
            disabled={busy}
            onClick={() => save("OPEN")}
          >
            Хариу хадгалах
          </button>
        )}
        <button
          type="button"
          className="pf-primary"
          disabled={busy}
          onClick={() => save("DONE")}
        >
          {busy
            ? "Хадгалж байна…"
            : status === "DONE"
              ? "Хариу шинэчлэх"
              : "Шийдвэрлэсэн гэж тэмдэглэх"}
        </button>
      </div>
      {error && (
        <p className="pf-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
