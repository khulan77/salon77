"use client";
import { Button } from "@/components/ui/button";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <section className="panel empty-page">
      <div className="empty-page-icon">!</div>
      <h2>Удирдлагын хэсгийг ачаалж чадсангүй</h2>
      <p>
        Дахин оролдоно уу. Асуудал үргэлжилбэл холболт болон салоны хандах эрхээ
        шалгана уу.
      </p>
      <Button onClick={reset}>Дахин оролдох</Button>
    </section>
  );
}
