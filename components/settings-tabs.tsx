import Link from "next/link";
import {
  CalendarCheck,
  Link2,
  MessageSquare,
  ShieldCheck,
  Store,
} from "lucide-react";
// The settings page's own sections, switched in place on /settings.
export const settingsSections = [
  {
    key: "salon",
    label: "Салоны мэдээлэл",
    icon: Store,
    text: "Нэр, утас, танилцуулга, лого болон сошиал хаягаа шинэчилнэ.",
  },
  {
    key: "page",
    label: "Захиалгын хуудас",
    icon: Link2,
    text: "Захиалгын линк, QR код болон хуудасны өнгөө сонгоно.",
  },
  {
    key: "rules",
    label: "Захиалгын нөхцөл",
    icon: CalendarCheck,
    text: "Онлайн захиалга, баталгаажуулалт, ажлын цаг болон урьдчилгаа.",
  },
  {
    key: "notify",
    label: "Мэдэгдэл",
    icon: MessageSquare,
    text: "Үйлчлүүлэгчид очих мессеж болон сануулгын хугацаа.",
  },
] as const;
export type SettingsSection = (typeof settingsSections)[number]["key"];
export function isSettingsSection(v: unknown): v is SettingsSection {
  return settingsSections.some((s) => s.key === v);
}
export const teamTab = {
  href: "/team",
  label: "Баг ба эрх",
  icon: ShieldCheck,
};
// Used outside /settings (the team page): every tab is a link.
export function SettingsTabs({ active }: { active: string }) {
  return (
    <nav className="settings-tabs" aria-label="Тохиргооны хэсгүүд">
      {settingsSections.map((s) => (
        <Link key={s.key} href={`/settings?tab=${s.key}`}>
          <s.icon size={14} /> {s.label}
        </Link>
      ))}
      <Link
        href={teamTab.href}
        aria-current={active === teamTab.href ? "page" : undefined}
      >
        <teamTab.icon size={14} /> {teamTab.label}
      </Link>
    </nav>
  );
}
