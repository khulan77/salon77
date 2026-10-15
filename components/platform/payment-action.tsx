"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "@/lib/client-request";
import { formatMnt, userFacingError } from "@/lib/ui-language";
import { localStamp } from "@/lib/business-time";
const date = (iso: string) => localStamp(iso).slice(0, 10).replace(/-/g, ".");
// Records a monthly fee the operator received; the server computes the amount.
export function PaymentAction({
  id,
  name,
  amountMnt,
  branches,
  nextEnd,
}: {
  id: string;
  name: string;
  amountMnt: number | null;
  branches: number;
  nextEnd: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function record() {
    if (amountMnt === null) return;
    if (
      !window.confirm(
        `«${name}» салоноос ${formatMnt(amountMnt)} (${Math.max(1, branches)} салбар) хүлээн авсан уу? Эрх нь ${date(nextEnd)} хүртэл сунгагдана.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await requestJson(
        `/api/platform/payments?id=${encodeURIComponent(id)}`,
        "POST",
        {},
      );
      router.refresh();
    } catch (e) {
      setError(userFacingError(e, "Төлбөр бүртгэж чадсангүй."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="pf-action">
      <button
        type="button"
        className="pf-primary"
        disabled={busy || amountMnt === null}
        title={
          amountMnt === null ? "Эхлээд сарын үнээ тохируулна уу" : undefined
        }
        onClick={record}
      >
        {busy ? "Хадгалж байна…" : "Төлбөр бүртгэх"}
      </button>
      {error && (
        <p className="pf-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
