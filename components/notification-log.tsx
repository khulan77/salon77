"use client";
import { useEffect, useState } from "react";
import type { NotificationLog as Log } from "@/lib/services/notifications";
import { eventLabels } from "@/lib/notifications/templates";
import { formatTimeAgo, userFacingError } from "@/lib/ui-language";
const statusLabels: Record<string, string> = {
  PENDING: "Хүлээгдэж буй",
  SENDING: "Илгээж байна",
  SENT: "Илгээсэн",
  FAILED: "Амжилтгүй",
  SKIPPED: "Илгээгээгүй",
};
export function NotificationLog({ preview }: { preview: boolean }) {
  const [rows, setRows] = useState<Log | null>(preview ? [] : null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    fetch("/api/notifications", { signal: controller.signal })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setRows(data);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(
            userFacingError(e, "Мэдэгдлийн бүртгэлийг ачаалж чадсангүй."),
          );
      });
    return () => controller.abort();
  }, [preview]);
  if (error) return <p className="field-hint">{error}</p>;
  if (!rows) return <p className="field-hint">Ачаалж байна…</p>;
  if (!rows.length)
    return <p className="field-hint">Одоогоор мэдэгдэл бүртгэгдээгүй байна.</p>;
  return (
    <ul className="notice-log" aria-label="Сүүлийн мэдэгдлүүд">
      {rows.map((n) => (
        <li key={n.id}>
          <div>
            <strong>{eventLabels[n.event]}</strong>
            <span>
              {n.recipient} ·{" "}
              <time dateTime={n.createdAt} suppressHydrationWarning>
                {formatTimeAgo(n.createdAt)}
              </time>
            </span>
            <p>{n.body}</p>
            {n.lastError && <small>{n.lastError}</small>}
          </div>
          <span className={`notice-status ${n.status.toLowerCase()}`}>
            {statusLabels[n.status]}
          </span>
        </li>
      ))}
    </ul>
  );
}
