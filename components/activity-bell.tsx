"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  CalendarClock,
  CalendarPlus,
  CalendarX,
  Hourglass,
} from "lucide-react";
import type { Inbox } from "@/lib/services/activity";
import { localStamp } from "@/lib/business-time";
import { formatTimeAgo } from "@/lib/ui-language";
const POLL_MS = 60000;
const kinds = {
  ONLINE_CREATED: { icon: CalendarPlus, text: "Шинэ онлайн захиалга" },
  CUSTOMER_CANCELLED: { icon: CalendarX, text: "Үйлчлүүлэгч цуцалсан" },
  CUSTOMER_RESCHEDULED: {
    icon: CalendarClock,
    text: "Үйлчлүүлэгч цагаа өөрчилсөн",
  },
  EXPIRED: { icon: Hourglass, text: "Баталгаажаагүй тул цуцлагдсан" },
} as const;
export function ActivityBell() {
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/activity", { cache: "no-store" });
      if (r.ok) setInbox(await r.json());
    } catch {
      /* Keep the last known state; the next poll retries. */
    }
  }, []);
  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(load, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && inbox?.unread) {
      // Opening the panel marks everything shown as read.
      await fetch("/api/activity", { method: "POST" }).catch(() => undefined);
      setInbox((i) => (i ? { ...i, unread: 0 } : i));
    }
  }
  const badge = inbox ? inbox.unread : 0;
  return (
    <div className="bell-wrap" ref={wrap}>
      <button
        type="button"
        className="icon-button bell-button"
        aria-label={badge ? `Мэдэгдэл, ${badge} шинэ` : "Мэдэгдэл"}
        aria-expanded={open}
        onClick={toggle}
      >
        <Bell size={18} />
        {badge > 0 && (
          <span className="bell-badge">{badge > 99 ? "99+" : badge}</span>
        )}
      </button>
      {open && (
        <section className="bell-panel" aria-label="Мэдэгдлүүд">
          <header>
            <strong>Мэдэгдэл</strong>
          </header>
          {inbox && inbox.pending > 0 && (
            <Link
              href="/calendar"
              className="bell-pending"
              onClick={() => setOpen(false)}
            >
              <Hourglass size={15} />
              <span>
                <b>{inbox.pending} захиалга</b> баталгаажуулахыг хүлээж байна
              </span>
            </Link>
          )}
          {inbox?.items.length ? (
            <ul>
              {inbox.items.map((item) => {
                const kind = kinds[item.type];
                return (
                  <li key={item.id} className={item.unread ? "unread" : ""}>
                    <span className={`bell-icon ${item.type.toLowerCase()}`}>
                      <kind.icon size={15} />
                    </span>
                    <div>
                      <strong>{kind.text}</strong>
                      <span>
                        {item.customerName} · {item.serviceName}
                        {item.multi && " +1"}
                      </span>
                      <small>
                        {localStamp(item.startAt).replace("T", " ")} ·{" "}
                        {item.branchName} ·{" "}
                        <time
                          dateTime={item.createdAt}
                          suppressHydrationWarning
                        >
                          {formatTimeAgo(item.createdAt)}
                        </time>
                      </small>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="bell-empty">
              {inbox ? "Одоогоор мэдэгдэл алга." : "Ачаалж байна…"}
            </p>
          )}
          <Link
            href="/calendar"
            className="bell-footer"
            onClick={() => setOpen(false)}
          >
            Календар нээх
          </Link>
        </section>
      )}
    </div>
  );
}
