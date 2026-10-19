"use client";
import { useState } from "react";
import { Megaphone } from "lucide-react";
import type { AdminData } from "@/lib/admin-data";
// Announcements from Salon77; "Ойлголоо" hides them for this member.
export function NoticeBanner({ notices }: { notices: AdminData["notices"] }) {
  const [hidden, setHidden] = useState(false);
  if (hidden || !notices.length) return null;
  async function dismiss() {
    setHidden(true);
    await fetch("/api/notices", { method: "POST" }).catch(() => undefined);
  }
  return (
    <aside
      className="billing-banner calm notice-banner"
      role="status"
      aria-label="Salon77-ийн мэдэгдэл"
    >
      <Megaphone size={18} />
      <div className="notice-banner-body">
        {notices.map((n) => (
          <p key={n.id}>
            <strong>{n.title}</strong>
            <span>{n.message}</span>
          </p>
        ))}
      </div>
      <button type="button" onClick={dismiss}>
        Ойлголоо
      </button>
    </aside>
  );
}
