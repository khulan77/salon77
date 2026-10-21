"use client";
import { useState } from "react";
import { QrCode } from "lucide-react";
import { requestJson } from "@/lib/client-request";
import { userFacingError, formatMnt } from "@/lib/ui-language";
// Sends the owner to Byl's payment page (QPay, SocialPay, bank apps).
// Byl returns to /billing, which checks the payment and extends access.
export function OnlinePay({ amountMnt }: { amountMnt: number }) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function pay() {
    setPending(true);
    setError("");
    try {
      const { url } = await requestJson<{ url: string }>(
        "/api/billing/checkout",
        "POST",
      );
      window.location.assign(url);
    } catch (e) {
      setError(userFacingError(e, "Төлбөрийн хуудсыг нээж чадсангүй."));
      setPending(false);
    }
  }
  return (
    <div className="online-pay">
      <button
        type="button"
        className="online-pay-button"
        disabled={pending}
        onClick={pay}
      >
        <QrCode size={18} aria-hidden="true" />
        {pending ? "Нээж байна…" : `QPay-ээр төлөх · ${formatMnt(amountMnt)}`}
      </button>
      <p>
        QPay, SocialPay болон банкны аппаар төлж болно. Төлбөр ормогц 30
        хоногийн эрх автоматаар нээгдэнэ.
      </p>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
