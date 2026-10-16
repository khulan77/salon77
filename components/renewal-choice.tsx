"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "@/lib/client-request";
import { userFacingError } from "@/lib/ui-language";
type Choice = "CONTINUE" | "STOP";
// Asked as the free trial ends: keep using Salon77 or stop. Either answer can
// be changed later; stopping never deletes data.
export function RenewalChoice({
  choice: initial,
  expired,
}: {
  choice: Choice | null;
  expired: boolean;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState(initial),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function pick(next: Choice) {
    setPending(true);
    setError("");
    try {
      await requestJson("/api/billing", "PATCH", { choice: next });
      setChoice(next);
      router.refresh();
    } catch (e) {
      setError(userFacingError(e, "Сонголтыг хадгалж чадсангүй."));
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="renewal-choice" aria-labelledby="renewal-title">
      <h2 id="renewal-title">
        {expired
          ? "Үнэгүй хугацаа дууслаа. Цааш нь яах вэ?"
          : "Үнэгүй хугацаа удахгүй дуусна. Цааш нь яах вэ?"}
      </h2>
      <div className="renewal-options">
        <button
          type="button"
          className={choice === "CONTINUE" ? "on" : ""}
          aria-pressed={choice === "CONTINUE"}
          disabled={pending}
          onClick={() => pick("CONTINUE")}
        >
          <strong>Үргэлжлүүлэх</strong>
          <span>
            Доорх данс руу сарын төлбөрөө шилжүүлнэ. Төлбөр орсныг бид шалгаад
            30 хоногийн эрх нээнэ.
          </span>
        </button>
        <button
          type="button"
          className={choice === "STOP" ? "on" : ""}
          aria-pressed={choice === "STOP"}
          disabled={pending}
          onClick={() => pick("STOP")}
        >
          <strong>Зогсоох</strong>
          <span>
            Үнэгүй хугацаа дуусмагц захиалгын хуудас түр хаагдана. Мэдээлэл тань
            устахгүй, хүссэн үедээ төлбөр хийгээд сэргээнэ.
          </span>
        </button>
      </div>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {choice && !error && !pending && (
        <p role="status" className="renewal-note">
          {choice === "CONTINUE"
            ? "Баярлалаа! Төлбөр орсны дараа эрх тань автоматаар сунгагдана."
            : "Ойлголоо. Хэзээ ч эргэн ирж, «Үргэлжлүүлэх» дээр дарж болно."}
        </p>
      )}
    </section>
  );
}
