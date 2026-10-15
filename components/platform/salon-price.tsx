"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "@/lib/client-request";
import { formatMnt, userFacingError } from "@/lib/ui-language";
// One salon's monthly fee: the per-branch price, or a fee set by hand.
export function SalonPrice({
  id,
  amountMnt,
  custom,
}: {
  id: string;
  amountMnt: number | null;
  custom: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(
    amountMnt === null ? "" : String(amountMnt),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(monthlyPriceMnt: number | null) {
    setBusy(true);
    setError("");
    try {
      await requestJson(
        `/api/platform/salons?id=${encodeURIComponent(id)}`,
        "PATCH",
        { monthlyPriceMnt },
      );
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
      <div className="pf-salon-price">
        <span>{amountMnt === null ? "—" : formatMnt(amountMnt)}</span>
        {custom && <em className="pf-badge plain">Тусгай</em>}
        <button type="button" onClick={() => setEditing(true)}>
          Үнэ өөрчлөх
        </button>
      </div>
    );
  return (
    <form
      className="pf-salon-price editing"
      onSubmit={(e) => {
        e.preventDefault();
        save(Number(value));
      }}
    >
      <input
        type="number"
        required
        min={0}
        max={100000000}
        step={1000}
        inputMode="numeric"
        aria-label="Энэ салоны сарын төлбөр"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="submit" className="pf-primary" disabled={busy}>
        Хадгалах
      </button>
      {custom && (
        <button type="button" disabled={busy} onClick={() => save(null)}>
          Үндсэн үнэ
        </button>
      )}
      <button type="button" onClick={() => setEditing(false)}>
        Болих
      </button>
      {error && (
        <p className="pf-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
