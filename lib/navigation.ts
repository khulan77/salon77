import {
  CalendarDays,
  BookOpen,
  Users,
  Star,
  Scissors,
  Boxes,
  UserRound,
  Clock3,
  ClipboardCheck,
  ShieldCheck,
  MapPin,
  ChartNoAxesCombined,
  MessageSquare,
  Settings,
} from "lucide-react";
// The sidebar lists working modules only.
export const navigation = [
  {
    label: "ТОЙМ",
    items: [{ title: "Тайлан", href: "/reports", icon: ChartNoAxesCombined }],
  },
  {
    label: "ЗАХИАЛГА",
    items: [
      { title: "Календарь", href: "/calendar", icon: CalendarDays },
      { title: "Үйлчлүүлэгчид", href: "/customers", icon: Users },
      { title: "Сэтгэгдлүүд", href: "/reviews", icon: Star },
    ],
  },
  {
    label: "ҮЙЛ АЖИЛЛАГАА",
    items: [
      { title: "Үйлчилгээнүүд", href: "/services", icon: Scissors },
      { title: "Ажилтнууд", href: "/employees", icon: UserRound },
      { title: "Цагийн бүртгэл", href: "/timesheet", icon: ClipboardCheck },
      { title: "Бараа бүртгэл", href: "/inventory", icon: Boxes },
    ],
  },
  {
    label: "САЛОН",
    items: [
      { title: "Салбарууд", href: "/branches", icon: MapPin },
      { title: "Тохиргоо", href: "/settings", icon: Settings },
      { title: "Санал хүсэлт", href: "/support", icon: MessageSquare },
    ],
  },
];
// Working pages reached from in-page links rather than the sidebar.
export const hiddenModules = [
  // Reached through the settings tabs.
  { title: "Баг ба эрхийн тохиргоо", href: "/team", icon: ShieldCheck },
  // Weekly schedules now live in each staff profile; kept for direct links.
  { title: "Ажлын хуваарь", href: "/schedules", icon: Clock3 },
  { title: "Захиалгууд", href: "/bookings", icon: BookOpen },
];
export const modules = [
  ...navigation.flatMap((g) => g.items),
  ...hiddenModules,
];
