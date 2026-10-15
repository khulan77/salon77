"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "@/lib/client-request";
import { formatMnt, userFacingError } from "@/lib/ui-language";
// The one price the platform charges: per active branch, per 30 days.
export function PriceForm({ price }: { price: number | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(price === null);
  const [value, setValue] = useState(price === null ? "" : String(price));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await requestJson("/api/platform/settings", "PATCH", {
        pricePerBranchMnt: Number(value),
      });
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(userFacingError(e, "Үнэ хадгалж чадсангүй."));
    } finally {
      setBusy(false);
    }
  }
  if (!editing)
    return (
      <div className="pf-price">
        <strong>{formatMnt(price ?? 0)}</strong>
        <span>нэг салбар · 30 хоног</span>
        <button type="button" onClick={() => setEditing(true)}>
          Өөрчлөх
        </button>
      </div>
    );
  return (
    <form className="pf-price" onSubmit={save}>
      <label>
        <span>Нэг салбарын сарын үнэ (₮)</span>
        <input
          type="number"
          required
          min={0}
          max={10000000}
          step={1000}
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Жишээ: 149000"
        />
      </label>
      <button type="submit" className="pf-primary" disabled={busy}>
        {busy ? "Хадгалж байна…" : "Хадгалах"}
      </button>
      {price !== null && (
        <button type="button" onClick={() => setEditing(false)}>
          Болих
        </button>
      )}
      {error && (
        <p className="pf-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
