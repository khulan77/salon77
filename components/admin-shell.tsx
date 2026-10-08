"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  ChevronDown,
  ChevronsUpDown,
  Menu,
  X,
  Sparkles,
  LogOut,
  Search,
  Command,
  CircleHelp,
  ArrowRight,
} from "lucide-react";
import { moduleAllowed } from "@/lib/access";
import { navigation, modules } from "@/lib/navigation";
import { signOut } from "@/app/auth/actions";
import type { AdminData } from "@/lib/admin-data";
export function AdminShell({
  data,
  children,
}: {
  data: AdminData;
  children: React.ReactNode;
}) {
  const path = usePathname();
  // The calendar uses the full viewport height, so it drops the page footer.
  const fullHeight = path === "/calendar" || path === "/bookings";
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [profile, setProfile] = useState(false);
  const current =
    modules.find((i) => i.href === path)?.title ?? "Хяналтын самбар";
  return (
    <div className="app-shell">
      {open && (
        <button
          className="sidebar-overlay"
          onClick={() => setOpen(false)}
          aria-label="Цэс хаах"
        />
      )}
      <aside className={`sidebar ${open ? "is-open" : ""}`}>
        <Link href="/" className="brand" aria-label="Salon77 нүүр хуудас">
          <span className="brand-symbol">
            s<span>·</span>
          </span>
          <span>
            salon<span className="brand-number">77</span>
            <span className="brand-dot">.</span>
          </span>
        </Link>
        <div className="workspace">
          <div className="workspace-avatar">
            <ScissorMark />
          </div>
          <div>
            <strong>{data.salonName}</strong>
            <span>Салоны удирдлага</span>
          </div>
          <ChevronsUpDown size={14} />
        </div>
        <nav aria-label="Үндсэн цэс">
          {navigation
            .map((g) => ({
              ...g,
              items: g.items.filter((i) => moduleAllowed(data.role, i.href)),
            }))
            .filter((g) => g.items.length)
            .map((group) => (
              <div className="nav-group" key={group.label}>
                <p>{group.label}</p>
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`nav-item ${isActive(path, item.href) ? "active" : ""}`}
                  >
                    <item.icon size={17} strokeWidth={1.65} />
                    <span>{item.title}</span>
                    {isActive(path, item.href) && (
                      <span className="active-dot" />
                    )}
                  </Link>
                ))}
              </div>
            ))}
        </nav>
        {data.role === "SALON_OWNER" && (
          <div className="sidebar-footer">
            <div className="small-spark">
              <Sparkles size={16} />
            </div>
            <div>
              <strong>Илүү олон боломж.</strong>
              <p>Шинэ боломжууд удахгүй.</p>
            </div>
            <Link href="/plan" aria-label="Багц харах">
              <ArrowUpRight size={17} />
            </Link>
          </div>
        )}
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              onClick={() => setOpen(true)}
              aria-label="Цэс нээх"
            >
              <Menu size={20} />
            </button>
            <span>Удирдлага</span>
            <span className="slash">/</span>
            <strong>{current}</strong>
          </div>
          <div className="header-actions">
            <span className="workspace-status">
              <i /> {data.preview ? "Танилцах горим" : "Идэвхтэй"}
            </span>
            <button
              className="icon-button"
              onClick={() => setSearch(true)}
              aria-label="Хуудас хайх"
            >
              <Search size={18} />
            </button>
            <Link
              className="icon-button help-link"
              href="/support"
              aria-label="Тусламж"
            >
              <CircleHelp size={18} />
            </Link>
            <span className="header-divider" />
            <div className="profile-wrap">
              <button
                className="profile-button"
                aria-label="Хэрэглэгчийн цэс"
                onClick={() => setProfile(!profile)}
                aria-expanded={profile}
              >
                <span className="user-avatar">
                  {data.preview ? "ТА" : data.name.slice(0, 2).toUpperCase()}
                </span>
                <ChevronDown size={13} />
              </button>
              {profile && (
                <div className="profile-popover">
                  <strong>{data.name}</strong>
                  <p>{data.email}</p>
                  {data.preview ? (
                    <Link href="/sign-in">
                      Нэвтрэх <ArrowRight size={15} />
                    </Link>
                  ) : (
                    <form action={signOut}>
                      <button>
                        <LogOut size={15} /> Гарах
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>
        <main
          className={fullHeight ? "page-content full-height" : "page-content"}
        >
          {children}
        </main>
        {!fullHeight && (
          <footer className="main-footer">
            <span>© {new Date().getFullYear()} Salon77</span>
            <span>
              Таны өсөлтөд зориуллаа.<span className="footer-dot">✦</span>
            </span>
            <Link href="/support">
              Тусламж авах <ArrowUpRight size={12} />
            </Link>
          </footer>
        )}
      </div>
      {search && (
        <div className="modal-backdrop" onClick={() => setSearch(false)}>
          <section
            className="search-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Хуудас хайх"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="search-input">
              <Search size={20} />
              <input
                autoFocus
                placeholder="Хуудасны нэрээр хайх…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setSearch(false);
                }}
              />
              <button
                className="icon-button"
                onClick={() => setSearch(false)}
                aria-label="Хайлт хаах"
              >
                <X size={18} />
              </button>
            </div>
            <div className="search-results">
              {navigation
                .flatMap((g) => g.items)
                .filter((i) => moduleAllowed(data.role, i.href))
                .filter((i) =>
                  i.title.toLowerCase().includes(query.toLowerCase()),
                )
                .map((i) => (
                  <Link
                    key={i.href}
                    href={i.href}
                    onClick={() => setSearch(false)}
                  >
                    <i.icon size={18} />
                    {i.title}
                    <ArrowUpRight size={15} />
                  </Link>
                ))}
            </div>
            <div className="search-footer">
              <Command size={13} /> Хэрэгтэй хуудсаа хурдан олоорой
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
function ScissorMark() {
  return (
    <svg
      width="23"
      height="23"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <circle cx="6" cy="17" r="3" />
      <circle cx="17" cy="17" r="3" />
      <path d="m8 15 10-12M15 15 5 3" />
    </svg>
  );
}
// Settings tabs (team) keep the «Тохиргоо» item highlighted.
function isActive(path: string, href: string) {
  return path === href || (href === "/settings" && path === "/team");
}
