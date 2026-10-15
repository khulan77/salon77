"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { userFacingError } from "@/lib/ui-language";
export function SalonStatusAction({
  id,
  name,
  status,
}: {
  id: string;
  name: string;
  status: "ACTIVE" | "SUSPENDED";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const next = status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
  async function change() {
    const question =
      next === "SUSPENDED"
        ? `«${name}» салоныг сарын төлбөр төлөөгүй тул хаах уу? Эзэн, ажилтнууд удирдлагын хэсэгт орж чадахгүй, онлайн захиалгын хуудас нь хаагдана. Мэдээлэл нь устахгүй.`
        : `«${name}» салоныг дахин нээх үү? Удирдлага болон захиалгын хуудас нь дахин ажиллана.`;
    if (!window.confirm(question)) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/platform/salons?id=${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error);
      router.refresh();
    } catch (e) {
      setError(userFacingError(e, "Төлөв өөрчилж чадсангүй."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="pf-action">
      <button
        type="button"
        className={next === "SUSPENDED" ? "pf-danger" : "pf-primary"}
        disabled={busy}
        onClick={change}
      >
        {busy
          ? "Хадгалж байна…"
          : next === "SUSPENDED"
            ? "Төлбөр төлөөгүй · Хаах"
            : "Дахин нээх"}
      </button>
      {error && (
        <p className="pf-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
