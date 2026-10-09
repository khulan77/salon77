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
        ? `«${name}» салоныг түр зогсоох уу? Салоны ажилтнууд нэвтэрч чадахгүй, онлайн захиалгын хуудас нь хаагдана.`
        : `«${name}» салоныг дахин идэвхжүүлэх үү?`;
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
            ? "Түр зогсоох"
            : "Дахин идэвхжүүлэх"}
      </button>
      {error && (
        <p className="pf-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
