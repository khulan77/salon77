"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { userFacingError } from "@/lib/ui-language";
// Permanent removal: the operator types the salon's name to confirm.
export function DeleteSalon({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const matches = typed.trim() === name.trim();
  async function remove() {
    if (!matches) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/platform/salons?id=${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmName: typed.trim() }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error);
      router.push("/platform");
      router.refresh();
    } catch (e) {
      setError(userFacingError(e, "Салоныг устгаж чадсангүй."));
      setBusy(false);
    }
  }
  return (
    <section className="pf-panel pf-delete" aria-labelledby="pf-delete-title">
      <h2 id="pf-delete-title">Салоныг устгах</h2>
      <p>
        Салон болон түүний бүх мэдээлэл (салбар, ажилтан, үйлчилгээ, захиалга,
        үйлчлүүлэгч, төлбөрийн түүх) бүрмөсөн устана. Буцаах боломжгүй. Түр
        зогсоох бол дээрх «Идэвхгүй болгох»-ыг ашиглана уу.
      </p>
      <label className="pf-delete-field">
        Баталгаажуулахын тулд салоны нэрийг бичнэ үү: <b>{name}</b>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          placeholder={name}
        />
      </label>
      <button
        type="button"
        className="pf-danger"
        disabled={!matches || busy}
        onClick={remove}
      >
        <Trash2 size={15} /> {busy ? "Устгаж байна…" : "Бүрмөсөн устгах"}
      </button>
      {error && (
        <p className="pf-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
