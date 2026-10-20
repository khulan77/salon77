"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  LogIn,
  UserPlus,
  Store,
  ArrowUpRight,
} from "lucide-react";
import "@/app/account-menu.css";

export function AccountMenu({
  signedIn = false,
  dashboardHref = "/",
}: {
  signedIn?: boolean;
  dashboardHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
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
      className="account-menu"
      ref={root}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="account-menu-trigger"
        aria-expanded={open}
        aria-controls="account-menu-panel"
        onClick={() => setOpen(!open)}
      >
        <Store size={17} aria-hidden="true" />
        <span>Миний салон</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div id="account-menu-panel" className="account-menu-panel">
          <p>Салоны бүртгэл</p>
          {signedIn && (
            <Link href={dashboardHref} onClick={() => setOpen(false)}>
              <Store size={17} aria-hidden="true" />
              <span>Салоноо удирдах</span>
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          )}
          <Link href="/sign-in" onClick={() => setOpen(false)}>
            <LogIn size={17} aria-hidden="true" />
            <span>Нэвтрэх</span>
          </Link>
          <Link href="/sign-up" onClick={() => setOpen(false)}>
            <UserPlus size={17} aria-hidden="true" />
            <span>Бүртгүүлэх</span>
          </Link>
        </div>
      )}
    </div>
  );
}
