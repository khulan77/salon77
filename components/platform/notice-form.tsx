"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "@/lib/client-request";
import { userFacingError } from "@/lib/ui-language";
// An announcement to every salon's dashboard (and owners' email when set up).
export function NoticeForm({ ownerMail }: { ownerMail: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    if (!window.confirm("Энэ мэдэгдлийг бүх салон руу илгээх үү?")) return;
    setBusy(true);
    setError("");
    setDone("");
    try {
      const sent = await requestJson<{ emailing: boolean }>(
        "/api/platform/notices",
        "POST",
        { title: data.get("title"), message: data.get("message") },
      );
      form.reset();
      setDone(
        sent.emailing
          ? "Илгээлээ. Салонуудын удирдлага дээр харагдаж, эздэд имэйлээр очно."
          : "Илгээлээ. Салонуудын удирдлага дээр харагдана.",
      );
      router.refresh();
    } catch (e) {
      setError(userFacingError(e, "Мэдэгдэл илгээж чадсангүй."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="pf-notice-form" onSubmit={send}>
      <label>
        <span>Гарчиг</span>
        <input
          name="title"
          required
          maxLength={120}
          placeholder="Жишээ: Системийн шинэчлэл"
        />
      </label>
      <label>
        <span>Мэдэгдэл</span>
        <textarea
          name="message"
          required
          maxLength={2000}
          rows={4}
          placeholder="Салонуудад хүргэх мэдээллээ бичнэ үү."
        />
      </label>
      <p className="pf-note">
        {ownerMail
          ? "Салон бүрийн удирдлага дээр баннер болж гарч, баталгаажсан салоны эзэнд имэйлээр очно."
          : "Салон бүрийн удирдлага дээр баннер болж гарна. Имэйлээр илгээхэд баталгаажсан домэйн (RESEND_FROM) хэрэгтэй."}
      </p>
      <button type="submit" className="pf-primary" disabled={busy}>
        {busy ? "Илгээж байна…" : "Бүх салон руу илгээх"}
      </button>
      {error && (
        <p className="pf-error" role="alert">
          {error}
        </p>
      )}
      {done && <p role="status">{done}</p>}
    </form>
  );
}
