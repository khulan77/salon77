import Link from "next/link";
import { SlidersHorizontal, ShieldCheck } from "lucide-react";
const tabs = [
  { href: "/settings", label: "Ерөнхий тохиргоо", icon: SlidersHorizontal },
  { href: "/team", label: "Баг ба эрх", icon: ShieldCheck },
];
export function SettingsTabs({ active }: { active: string }) {
  return (
    <nav className="settings-tabs" aria-label="Тохиргооны хэсгүүд">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={active === t.href ? "page" : undefined}
        >
          <t.icon size={14} /> {t.label}
        </Link>
      ))}
    </nav>
  );
}
