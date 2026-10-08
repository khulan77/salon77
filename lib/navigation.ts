import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  Users,
  Star,
  Scissors,
  Package,
  Tag,
  Boxes,
  ReceiptText,
  UserRound,
  Clock3,
  ClipboardCheck,
  ShieldCheck,
  MapPin,
  PanelTop,
  Images,
  ChartNoAxesCombined,
  Gem,
  Handshake,
  CircleHelp,
  Settings,
} from "lucide-react";
// The sidebar lists working modules only.
export const navigation = [
  {
    label: "ТОЙМ",
    items: [
      { title: "Хяналтын самбар", href: "/", icon: LayoutDashboard },
      { title: "Тайлан", href: "/reports", icon: ChartNoAxesCombined },
    ],
  },
  {
    label: "ЗАХИАЛГА",
    items: [
      { title: "Календар", href: "/calendar", icon: CalendarDays },
      { title: "Үйлчлүүлэгчид", href: "/customers", icon: Users },
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
    ],
  },
];
// Still routable from in-page links, but hidden from the sidebar until built.
export const hiddenModules = [
  // Reached through the settings tabs.
  { title: "Баг ба эрхийн тохиргоо", href: "/team", icon: ShieldCheck },
  // Weekly schedules now live in each staff profile; kept for direct links.
  { title: "Ажлын хуваарь", href: "/schedules", icon: Clock3 },
  { title: "Захиалгууд", href: "/bookings", icon: BookOpen },
  { title: "Сэтгэгдлүүд", href: "/reviews", icon: Star },
  { title: "Багцууд", href: "/packages", icon: Package },
  { title: "Урамшуулал", href: "/promotions", icon: Tag },
  { title: "Борлуулалт", href: "/sales", icon: ReceiptText },
  { title: "Салоны хуудас", href: "/salon-page", icon: PanelTop },
  { title: "Зургийн цомог", href: "/gallery", icon: Images },
  { title: "Миний багц", href: "/plan", icon: Gem },
  { title: "Хамтын ажиллагаа", href: "/partnership", icon: Handshake },
  { title: "Тусламж", href: "/support", icon: CircleHelp },
];
export const modules = [
  ...navigation.flatMap((g) => g.items),
  ...hiddenModules,
];
