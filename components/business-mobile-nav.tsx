"use client";

import { useState, useRef, useEffect } from "react";
import { Menu, X } from "lucide-react";

export function BusinessMobileNav() {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div
      className="bx-mobile-nav"
      ref={container}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-label={open ? "Цэс хаах" : "Цэс нээх"}
        aria-expanded={open}
        aria-controls="bx-mobile-links"
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      {open && (
        <div id="bx-mobile-links" className="bx-mobile-links">
          {[
            ["#problems", "Шийдэл"],
            ["#product", "Боломжууд"],
            ["#pricing", "Үнэ тариф"],
            ["#prepare", "Бүртгүүлэхээс өмнө"],
            ["#faq", "Түгээмэл асуулт"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              {label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
