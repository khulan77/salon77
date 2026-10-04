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
export const navigation = [
  {
    label: "ТОЙМ",
    items: [{ title: "Хяналтын самбар", href: "/", icon: LayoutDashboard }],
  },
  {
    label: "ЗАХИАЛГА",
    items: [
      { title: "Календар", href: "/calendar", icon: CalendarDays },
      { title: "Захиалгууд", href: "/bookings", icon: BookOpen },
    ],
  },
  {
    label: "ҮЙЛЧЛҮҮЛЭГЧИД",
    items: [
      { title: "Үйлчлүүлэгчид", href: "/customers", icon: Users },
      { title: "Сэтгэгдлүүд", href: "/reviews", icon: Star },
    ],
  },
  {
    label: "ҮЙЛ АЖИЛЛАГАА",
    items: [
      { title: "Үйлчилгээнүүд", href: "/services", icon: Scissors },
      { title: "Багцууд", href: "/packages", icon: Package },
      { title: "Урамшуулал", href: "/promotions", icon: Tag },
      { title: "Бараа материал", href: "/inventory", icon: Boxes },
      { title: "Борлуулалт", href: "/sales", icon: ReceiptText },
    ],
  },
  {
    label: "БАГ",
    items: [
      { title: "Ажилтнууд", href: "/employees", icon: UserRound },
      { title: "Ажлын хуваарь", href: "/schedules", icon: Clock3 },
      { title: "Баг ба эрхийн тохиргоо", href: "/team", icon: ShieldCheck },
    ],
  },
  {
    label: "МИНИЙ САЛОН",
    items: [
      { title: "Салбарууд", href: "/branches", icon: MapPin },
      { title: "Салоны хуудас", href: "/salon-page", icon: PanelTop },
      { title: "Зургийн цомог", href: "/gallery", icon: Images },
    ],
  },
  {
    label: "ТАЙЛАН",
    items: [{ title: "Тайлан", href: "/reports", icon: ChartNoAxesCombined }],
  },
  {
    label: "SALON77",
    items: [
      { title: "Миний багц", href: "/plan", icon: Gem },
      { title: "Хамтын ажиллагаа", href: "/partnership", icon: Handshake },
      { title: "Тусламж", href: "/support", icon: CircleHelp },
    ],
  },
  {
    label: "ТОХИРГОО",
    items: [{ title: "Тохиргоо", href: "/settings", icon: Settings }],
  },
];
